/* Transactional planner: edits stay local until Commit or Apply changes. */
(()=>{
  const copy=value=>JSON.parse(JSON.stringify(value));
  class BattlePlanner{
    constructor(sim,onCommit,onChange){
      this.sim=sim;this.onCommit=onCommit;this.onChange=onChange;this.index=0;this.maneuverIndex=0;this.view='maneuver';this.selection={weapon:null,target:null,range:1000};
      this.$=id=>document.getElementById(id);this.dialog=this.$('plan-wizard');
      for(const style of ['timid','strong','aggressive'])this.$('preset-'+style).onclick=()=>{
        if(!this.openWasPlanning||!this.editor?.applyPlanPreset(style))return;
        this.selectedPreset=style;this.presetSignature=JSON.stringify([this.editor.turn.draftManeuvers,this.editor.turn.draft]);
        this.editingManeuver=null;this.maneuverIndex=0;this.selectStep(0);this.onChange();
      };
      for(let i=0;i<3;i++){
        this.$('plan-step-'+i).onclick=()=>this.selectStep(i);
        this.$('route-stage-'+i).onclick=()=>{if(!this.openWasPlanning&&!this.sim.canReviseManeuver(i))return;this.maneuverIndex=i;this.editingManeuver=i;this.view='maneuver';this.render();};
        this.$('route-delete-'+i).onclick=()=>{if(this.openWasPlanning&&this.editor.deleteManeuver(i)){this.editingManeuver=null;this.maneuverIndex=i;this.view='maneuver';this.error(`M${i+1} deleted. Reassign attacks that used only this maneuver.`);this.render();this.onChange();}};
        this.$('attack-maneuver-'+i).onclick=()=>{
          const button=this.$('attack-maneuver-'+i);if(button.disabled||button.hidden)return;
          const assigned=this.selection.maneuvers||[];
          this.selection.maneuvers=assigned.includes(i)?assigned.filter(m=>m!==i):[...assigned,i].sort();
          this.error('');this.render();this.advanceCompletedAttack();
        };
      }
      this.$('maneuver-step').onclick=()=>{this.editingManeuver=this.openWasPlanning?null:this.sim.turn.stageIndex;if(!this.openWasPlanning)this.maneuverIndex=this.sim.turn.stageIndex;this.view='maneuver';this.render();};
      for(const key of Object.keys(Battle.maneuvers))this.$('maneuver-'+key).onclick=()=>{
        const slot=this.editingManeuver??this.editor?.turn.draftManeuvers.findIndex(k=>!k);
        if(this.openWasPlanning&&slot>=0&&this.editor.selectManeuver(key,slot)){
          this.editingManeuver=null;this.maneuverIndex=this.editor.turn.draftManeuvers.findIndex(k=>!k);this.error('');this.render();this.onChange();
        }else if(!this.openWasPlanning&&this.sim.canReviseManeuver(this.maneuverIndex)){
          const routes=this.editor.turn.draftManeuvers,before=routes[this.maneuverIndex];routes[this.maneuverIndex]=key;
          const cost=this.liveRevisionCost();if(cost>this.sim.turn.revisions){routes[this.maneuverIndex]=before;this.error('Not enough plan revisions remain for this change.');}
          else{this.editor.turn.revisions=this.sim.turn.revisions-cost;this.error('Maneuver change staged. Apply changes to use it.');}
          this.render();this.onChange();
        }
      };
      this.$('maneuver-next').onclick=()=>{
        const missing=this.editor.turn.draftManeuvers.findIndex(k=>!k);
        if(missing>=0){this.maneuverIndex=missing;this.render();}else this.selectStep(0);
      };
      this.$('done-maneuvers').onclick=()=>{
        const t=this.editor.turn;if(!t.draftManeuvers.some(Boolean))return;
        const available=t.draftManeuvers.map((key,i)=>key&&key!=='flee'?i:-1).filter(i=>i>=0);
        if(this.openWasPlanning&&available.length===1)t.draft=t.draft.map(shot=>shot?{...shot,maneuvers:[available[0]]}:null);
        const next=this.openWasPlanning?0:this.sim.turn.orders.findIndex(order=>order.weapon&&order.status==='pending');
        if(next>=0)this.selectStep(next);
      };
      for(const weapon of ['phaser','torpedo'])this.$('choose-'+weapon).onclick=()=>{
        if(this.$('choose-'+weapon).disabled)return;
        this.selection.weapon=this.openWasPlanning&&this.selection.weapon===weapon?null:weapon;
        if(!this.selection.weapon){this.autoAdvancePending=true;this.rangeConfirmed=false;}
        this.selection.range=Math.min(this.selection.range,Battle.weaponSpecs[weapon].maxRange);this.error('');this.render();this.advanceCompletedAttack();
      };
      for(const target of Object.keys(Battle.targets))this.$('target-'+target).onclick=()=>{this.selection.target=target;this.error('');this.render();this.advanceCompletedAttack();};
      for(const layer of ['systems','shields'])this.$('map-'+layer).onclick=()=>this.layer(layer);
      this.diagram=new window.BattleTargetDiagram(this.$('target-map'),key=>{const button=this.$('target-'+key);if(!button.disabled)button.onclick();});
      this.$('reset-target-view').onclick=()=>this.diagram.reset();
      this.$('attack-range').oninput=e=>{this.selection.range=+e.target.value;this.error('');this.render();};
      this.$('attack-range').onchange=e=>{this.selection.range=+e.target.value;this.rangeConfirmed=true;this.error('');this.render();this.advanceCompletedAttack();};
      this.$('save-plan-step').onclick=()=>this.save();
      this.$('clear-plan-step').onclick=()=>{if(this.editor.clearStep(this.index)){this.selectStep(this.index);this.onChange();}};
      this.$('wizard-commit').onclick=()=>this.commit();this.$('wizard-apply').onclick=()=>this.commit();
      this.$('wizard-cancel').onclick=()=>this.cancel();this.$('close-planner').onclick=()=>this.cancel();
      this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.cancel();});
    }
    error(message){this.$('wizard-error').textContent=message;}
    open(){
      if(this.sim.result||this.dialog.open)return;
      this.openWasPlanning=!this.sim.maneuvering;this.openPass=this.sim.turn.number;
      this.selectedPreset=null;this.presetSignature=null;
      this.pausedForPlanning=this.openWasPlanning&&this.sim.running;
      if(this.openWasPlanning)this.sim.running=false;
      this.editor=Object.create(this.sim);this.editor.turn=copy(this.sim.turn);if(!this.openWasPlanning)this.editor.running=true;
      this.maneuverIndex=this.openWasPlanning?0:this.sim.turn.stageIndex;this.editingManeuver=null;
      this.view='maneuver';this.editingManeuver=this.openWasPlanning?null:this.maneuverIndex;this.render();
      this.dialog.showModal();this.onChange();
    }
    cancel(){
      this.dialog.close();this.editor=null;
      if(this.pausedForPlanning&&!this.sim.result)this.sim.running=true;
      this.pausedForPlanning=false;this.onChange();
    }
    close(){this.cancel();}
    selectStep(index){
      if(!this.editor||!this.editor.turn.draftManeuvers.some(Boolean))return;
      this.index=index;this.view='shots';this.selection=copy(this.editor.turn.draft[index]||{weapon:null,target:null,range:1000,maneuvers:this.editor.defaultAttackAssignments(index)});
      if(this.openWasPlanning&&!this.selection.weapon){
        const available=['phaser','torpedo'].filter(weapon=>this.editor.turn.draft.filter((shot,i)=>i!==index&&shot?.weapon===weapon).length<(weapon==='phaser'?2:1));
        if(available.length===1){this.selection.weapon=available[0];this.selection.range=Math.min(this.selection.range,Battle.weaponSpecs[available[0]].maxRange);}
      }
      this.autoAdvancePending=this.openWasPlanning&&!this.editor.validStep(this.editor.turn.draft[index]);this.rangeConfirmed=!!this.editor.turn.draft[index];
      this.layer(this.selection.target?.startsWith('shield-')?'shields':'systems');this.error('');this.render();
    }
    advanceCompletedAttack(){
      if(!this.openWasPlanning||!this.autoAdvancePending||!this.rangeConfirmed||!this.editor.validStep(this.selection))return;
      const t=this.editor.turn,assigned=step=>step?.maneuvers?.every(m=>t.draftManeuvers[m]&&t.draftManeuvers[m]!=='flee');
      if(!assigned(this.selection))return;
      this.autoAdvancePending=false;
      const next=t.draft.findIndex(step=>!this.editor.validStep(step)||!assigned(step));
      if(next>=0)this.selectStep(next);
      else{this.render();if(this.editor.planReady())this.$('wizard-commit').focus?.();}
      this.onChange();
    }
    liveRevisionCost(){
      const t=this.editor.turn,actual=this.sim.turn;
      return t.draft.filter((shot,i)=>JSON.stringify(shot)!==JSON.stringify(actual.draft[i])).length+t.draftManeuvers.filter((key,i)=>key!==actual.maneuvers[i]).length;
    }
    layer(layer){
      this.$('target-map').setAttribute('data-layer',layer);
      for(const name of ['systems','shields'])this.$('map-'+name).setAttribute('aria-pressed',String(name===layer));
      this.mapLayer=layer;this.diagram?.setSelection(this.selection.target,layer);
    }
    sync(){
      if(!this.editor||this.openWasPlanning)return;
      const actual=this.sim.turn,t=this.editor.turn;
      t.phase=actual.phase;t.stageIndex=actual.stageIndex;t.maneuver=actual.maneuver;t.navigation=actual.navigation;
      if(actual.number===this.openPass)for(let i=0;i<3;i++)if(t.orders?.[i])t.orders[i].status=actual.orders[i].status;
    }
    save(){
      this.sync();const t=this.editor.turn;
      if(t.draftManeuvers.some(key=>key&&key!=='flee')&&!this.stageSelection()){this.error('Choose a weapon, target, range and at least one selected attack maneuver. Each attack is used only once.');return false;}
      const missing=t.draft.findIndex(s=>!s);
      this.selectStep(missing>=0?missing:Math.min(2,this.index+1));this.onChange();return true;
    }
    stageSelection(){
      const t=this.editor.turn;if(JSON.stringify(this.selection)===JSON.stringify(t.draft[this.index]))return true;
      if(this.openWasPlanning)return this.editor.updateStep(this.index,this.selection);
      const before=copy({draft:t.draft,orders:t.orders,revisions:t.revisions});t.revisions=this.sim.turn.revisions;
      if(!this.editor.updateStep(this.index,this.selection)){Object.assign(t,before);return false;}
      const changed=t.draft.filter((shot,i)=>JSON.stringify(shot)!==JSON.stringify(this.sim.turn.draft[i])).length;
      const cost=changed+t.draftManeuvers.filter((key,i)=>key!==this.sim.turn.maneuvers[i]).length;
      if(cost>this.sim.turn.revisions){Object.assign(t,before);return false;}t.revisions=this.sim.turn.revisions-cost;return true;
    }
    commit(){
      if(!this.editor)return;this.sync();const edit=this.editor,t=edit.turn;
      if(this.view==='shots'&&t.draftManeuvers.some(key=>key&&key!=='flee')&&this.selection.weapon&&this.selection.target&&JSON.stringify(this.selection)!==JSON.stringify(t.draft[this.index])){
        if(!this.stageSelection()){this.error('Save a valid action before applying this plan.');return;}
      }
      if(!edit.planReady()){this.error('Choose one to three maneuvers and assign all three attacks to selected offensive maneuvers.');return;}
      if(this.openWasPlanning){
        const real=this.sim.turn,previous={draft:real.draft,draftManeuvers:real.draftManeuvers,draftManeuver:real.draftManeuver};
        real.draft=copy(t.draft);real.draftManeuvers=[...t.draftManeuvers];real.draftManeuver=real.draftManeuvers.find(Boolean)||null;
        if(!this.onCommit()){Object.assign(real,previous);return;}
      }else{
        if(this.sim.turn.number!==this.openPass||!this.sim.applyRevisions(t.draft,t.draftManeuvers)){this.error('The turn advanced, an edited maneuver completed, or an attack fired. Cancel and reopen to edit the remaining plan.');return;}
      }
      this.dialog.close();this.editor=null;this.pausedForPlanning=false;this.onChange();
    }
    render(){
      if(!this.editor)return;this.sync();
      const B=Battle,s=this.editor,t=s.turn,selected=this.selection,planning=this.openWasPlanning,choosing=this.view==='maneuver';
      // Track complete attack selections immediately inside the transactional editor.
      if(planning&&!choosing)t.draft[this.index]=selected.weapon&&selected.target?copy(selected):null;
      const budget=t.draft.map((shot,i)=>!choosing&&i===this.index?selected:shot);
      const full=budget.filter(shot=>shot?.weapon==='phaser').length===2&&budget.filter(shot=>shot?.weapon==='torpedo').length===1;
      const count=t.draftManeuvers.filter(Boolean).length,routesReady=count>0,flee=!t.draftManeuvers.some(key=>key&&key!=='flee');
      const stale=!planning&&(this.sim.turn.number!==this.openPass||!['approach','attack','withdraw'].includes(this.sim.turn.phase));
      const alreadyChanged=JSON.stringify(t.draft[this.index])!==JSON.stringify(this.sim.turn.draft[this.index]);
      const locked=!!s.result||stale||!planning&&(this.sim.turn.orders?.[this.index]?.status!=='pending'||this.sim.turn.revisions<=0||t.revisions<=0&&!alreadyChanged);
      this.$('maneuver-choice').hidden=!choosing;this.$('shot-choice').hidden=choosing||flee;this.$('repair-choice').hidden=choosing||!flee;
      this.$('maneuver-step').setAttribute('aria-current',choosing?'step':'false');
      this.$('maneuver-step-label').textContent=`${count}/3 maneuvers selected`;
      this.$('route-editing').textContent=!planning||this.editingManeuver!==null?`EDIT MANEUVER ${this.maneuverIndex+1} / CHOOSE A REPLACEMENT`:count<3?`CLICK TO ADD MANEUVER ${count+1} / THEN DONE`:'THREE MANEUVERS ADDED / SELECT DONE';
      for(let i=0;i<3;i++){
        this.$('route-stage-'+i).setAttribute('aria-current',i===this.maneuverIndex?'step':'false');
        this.$('route-stage-'+i).disabled=!planning&&!this.sim.canReviseManeuver(i);
        this.$('route-label-'+i).textContent=B.maneuvers[t.draftManeuvers[i]]?.name||'Choose maneuver';
        this.$('route-delete-'+i).hidden=!t.draftManeuvers[i];this.$('route-delete-'+i).disabled=!planning;
        const shot=t.draft[i];
        this.$('plan-step-'+i).disabled=!routesReady||flee;this.$('plan-step-'+i).setAttribute('aria-current',!choosing&&i===this.index?'step':'false');
        this.$('plan-step-label-'+i).textContent=shot?`${B.weaponSpecs[shot.weapon].name} / ${s.attackAssignments(shot,i).map(m=>'M'+(m+1)).join(', ')||'assign maneuver'}`:`Attack ${i+1} / choose weapon`;
        this.$('plan-step-'+i).setAttribute('data-budget-full',String(full));
        this.$('plan-step-'+i).title=shot?'Review or deselect this attack':'Configure an available attack';
        this.$('attack-maneuver-'+i).setAttribute('aria-pressed',String(!!selected.maneuvers?.includes(i)));
        this.$('attack-maneuver-'+i).hidden=!t.draftManeuvers[i];
        this.$('attack-maneuver-'+i).disabled=locked||!t.draftManeuvers[i]||t.draftManeuvers[i]==='flee'||count===1;
        this.$('attack-maneuver-label-'+i).textContent=`M${i+1} / ${B.maneuvers[t.draftManeuvers[i]]?.name||'not selected'}`;
      }
      for(const key of Object.keys(B.maneuvers)){const button=this.$('maneuver-'+key);button.disabled=!!s.result||(planning?count>=3&&this.editingManeuver===null:!this.sim.canReviseManeuver(this.maneuverIndex));button.setAttribute('aria-pressed',String(this.editingManeuver!==null||!planning?t.draftManeuvers[this.maneuverIndex]===key:t.draftManeuvers.includes(key)));}
      this.$('maneuver-next').hidden=true;
      this.$('done-maneuvers').hidden=!choosing;this.$('done-maneuvers').disabled=count<1;
      this.$('done-maneuvers').title=count?'Continue with '+count+' selected maneuver'+(count===1?'':'s'):'Select at least one maneuver';
      this.$('wizard-title').textContent=choosing?!planning||this.editingManeuver!==null?'Edit selected maneuver':'Choose up to three maneuvers':flee?'Repair turn':`Attack ${this.index+1} / configure once`;
      this.$('editing-step').textContent=`ATTACK ${this.index+1} / WEAPON AND MANEUVERS`;
      for(const weapon of ['phaser','torpedo']){
        const button=this.$('choose-'+weapon),others=t.draft.filter((shot,i)=>i!==this.index&&shot?.weapon===weapon).length;
        button.setAttribute('aria-pressed',String(selected.weapon===weapon));button.disabled=locked||others>=(weapon==='phaser'?2:1)||full&&selected.weapon!==weapon;
        button.title=selected.weapon===weapon&&planning?'Click again to deselect this attack':button.disabled?'Attack budget allocated':`Choose ${B.weaponSpecs[weapon].name}`;
      }
      const spec=B.weaponSpecs[selected.weapon]||B.weaponSpecs.phaser,input=this.$('attack-range');
      input.max=spec.maxRange;input.value=selected.range;input.disabled=locked||!selected.weapon;
      input.setAttribute('aria-valuetext',(selected.range/100).toFixed(1)+' kilometers');
      this.$('range-value').textContent=(selected.range/100).toFixed(1)+' km';this.$('range-max').textContent=spec.maxRange/100+' km';
      this.$('optimal-band').style.left=((spec.optimal[0]-300)/(spec.maxRange-300)*100)+'%';this.$('optimal-band').style.width=((spec.optimal[1]-spec.optimal[0])/(spec.maxRange-300)*100)+'%';
      this.$('optimal-description').textContent=selected.weapon?`Optimal ${spec.optimal[0]/100}-${spec.optimal[1]/100} km / +15% damage in the green band.`:'Select a weapon to see its optimal range.';
      this.$('wizard-target').textContent=selected.target?B.targets[selected.target]:'Select a point on Yorktown';
      this.$('target-advice').textContent=selected.target?.startsWith('shield-')?'Automatic helm attempts to expose this shield before firing.':selected.target==='hull'?'Primary-hull focus increases penetrating hull damage.':'Internal targets are protected by the shield facing you.';
      for(const target of Object.keys(B.targets)){const button=this.$('target-'+target);button.disabled=locked||!selected.weapon;button.setAttribute('aria-pressed',String(selected.target===target));}
      this.$('weapon-budget').textContent=`SELECTED: ${budget.filter(v=>v?.weapon==='phaser').length}/2 phasers / ${budget.filter(v=>v?.weapon==='torpedo').length}/1 torpedo`+(full?' / All attacks allocated. Deselect a weapon to reopen its stage.':'');
      this.$('save-plan-step').hidden=choosing||flee;this.$('save-plan-step').disabled=locked||!s.validStep(selected)||!selected.maneuvers?.every(m=>t.draftManeuvers[m]&&t.draftManeuvers[m]!=='flee');
      this.$('save-plan-step').textContent=planning?'SAVE ATTACK & NEXT':'STAGE EDIT & NEXT';
      this.$('clear-plan-step').hidden=!planning||choosing||flee;this.$('clear-plan-step').disabled=!t.draft[this.index];
      const preview=[...t.draft];if(!choosing&&!flee)preview[this.index]=selected;
      const ready=s.planReady(preview);
      const presetUnchanged=this.presetSignature===JSON.stringify([t.draftManeuvers,t.draft]);
      for(const style of ['timid','strong','aggressive']){
        const button=this.$('preset-'+style);button.disabled=!planning||!!s.result;
        button.setAttribute('aria-pressed',String(presetUnchanged&&this.selectedPreset===style));
        button.title=planning?'Fill the draft with this plan; review or customize before Commit':'Quick plans are available when planning the next turn';
      }
      if(planning&&ready)this.$('save-plan-step').disabled=true;
      this.$('wizard-commit').hidden=!planning;this.$('wizard-commit').disabled=!ready||!!s.result;
      this.$('wizard-apply').hidden=planning;this.$('wizard-apply').disabled=stale||!!s.result||!s.planReady()||!planning&&this.liveRevisionCost()>this.sim.turn.revisions;
      this.$('wizard-ready').textContent=stale?'This turn has advanced. Cancel and reopen the planner.':planning?(ready?`Ready: all attacks assigned across ${count} maneuver(s). Commit plan to begin.`:'Choose one to three maneuvers, then configure and assign your three attacks.'): `Edit current or upcoming maneuvers and pending attacks. ${this.sim.turn.revisions-this.liveRevisionCost()} revision(s) remaining after Apply. Cancel discards edits.`;
      if(planning&&choosing&&count)this.$('wizard-ready').textContent=`${count} maneuver${count===1?'':'s'} selected. Select Done to configure attacks${count<3?', or add another maneuver':''}.`;
      this.diagram.setSelection(selected.target,this.mapLayer||'systems');this.list('wizard-review',t.draft,false,s);
    }
    list(id,orders,live,source=this.sim){
      const t=source.turn,routes=live?t.maneuvers:t.draftManeuvers,next=live?source.nextOrder():null;
      const rows=[0,1,2].filter(i=>routes?.[i]).map(m=>{
        const route=routes[m],row=document.createElement('li'),title=document.createElement('strong');
        const assigned=(orders||[]).map((shot,i)=>({shot,i})).filter(({shot,i})=>shot?.weapon&&source.attackAssignments(shot,i).includes(m));
        title.textContent=`M${m+1}. ${Battle.maneuvers[route].name}`+assigned.map(({shot,i})=>` / Attack ${i+1}: ${Battle.weaponSpecs[shot.weapon].name} -> ${Battle.targets[shot.target]}`).join('');row.append(title);
        if(route==='flee'||!assigned.length){const note=document.createElement('span');note.textContent=route==='flee'?'30s / withdrawal and repairs':'Flight only / no attack assigned';row.append(note);}
        for(const {shot,i} of assigned){
          const note=document.createElement('span');let status=shot.status||'queued';
          if(live&&shot===next)status=source.maneuvering?source.status(shot.weapon):'queued';
          if(live&&shot.status!=='pending'&&shot.firedStage!==undefined&&shot.firedStage!==m)status=`USED IN M${shot.firedStage+1} / ${status}`;
          note.textContent=`Attack ${i+1} / ${(shot.range/100).toFixed(1)} km`+(live?' / '+status.toUpperCase():' / once per turn');row.append(note);
        }
        row.setAttribute('data-status',live&&source.maneuvering&&m===t.stageIndex?'next':t.maneuverStatus?.[m]||'draft');return row;
      });
      if(!rows.length){const row=document.createElement('li');row.textContent='Choose one to three maneuvers, then assign attacks.';rows.push(row);}
      this.$(id).replaceChildren(...rows);
    }
    refresh(){
      const t=this.sim.turn;
      this.$('planner-progress').textContent=`${t.draftManeuvers.filter(Boolean).length}/3 maneuvers / one turn`;
      this.$('open-planner').textContent=this.sim.maneuvering?'REVIEW / EDIT PLAN':'BUILD ATTACK PLAN';
      this.list('live-plan',t.orders||t.draft,!!t.orders);
      if(this.dialog.open)this.render();
    }
  }
  window.BattlePlanner=BattlePlanner;
})();
