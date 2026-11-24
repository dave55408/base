/* A separate scene and recorded state keep the live engagement untouched. */
(()=>{
  const stamp=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  class ReplayView{
    constructor(sim,options){
      this.sim=sim;this.options=options;this.active=false;this.$=id=>document.getElementById(id);this.dialog=this.$('replay-dialog');
      for(const id of ['replay-last-pass','replay-result'])this.$(id).onclick=()=>this.open();
      this.$('replay-download').onclick=()=>{if(this.exporter)this.cancelExport();else this.download();};
      this.$('replay-record-hd').onclick=()=>this.replayHD();
      this.$('replay-close').onclick=()=>this.close();this.$('replay-restart').onclick=()=>{if(!this.exporter)this.restart();};
      this.$('replay-play').onclick=()=>{if(this.exporter||this.hdRequest)return;if(this.player.ended)this.restart();else{this.player.paused=!this.player.paused;if(this.player.paused)this.options.stopSound();this.renderUI();}};
      this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
      this.controlsIdle=0;this.keyboardControls=false;
      for(const name of ['pointermove','pointerdown'])this.dialog.addEventListener(name,()=>{this.controlsIdle=0;this.keyboardControls=false;this.dialog.setAttribute('data-controls-hidden','false');});
      this.dialog.addEventListener('keydown',()=>{this.controlsIdle=0;this.keyboardControls=true;this.dialog.setAttribute('data-controls-hidden','false');});
    }
    open(){
      if(this.active||!this.sim.lastReplay?.frames.length)return;
      this.record=this.sim.lastReplay;this.controlsIdle=0;this.keyboardControls=false;this.resumeBattle=this.sim.running;this.sim.running=false;this.options.stopSound();this.options.resetDialogue?.();this.dialog.showModal();
      try{
        if(this.hd){this.scene.setReplayHD(false);this.hd=false;}
        this.player=new BattleReplay.Player(this.record,this.sim);
        if(!this.scene)this.scene=this.options.createScene(this.$('replay-viewport'),this.player.state);
        else{this.scene.sim=this.player.state;this.scene.replayCut=null;this.scene.reset();}
        this.scene.spatialEnabled=false;this.scene.engineTrailsEnabled=false;this.scene.setCamera('cinematic');this.active=true;this.renderUI();this.options.changed();
      }catch(error){this.dialog.close();this.sim.running=this.resumeBattle;this.options.error('Cinematic replay could not start: '+error.message);}
    }
    close(resume=true){
      if(!this.active)return;this.hdRequest=null;this.cancelExport();this.options.stopSound();this.dialog.close();this.active=false;this.player.paused=true;
      this.sim.running=!!(resume&&this.resumeBattle&&!this.sim.result&&!document.hidden);this.options.changed();
    }
    restart({forExport=false,fullTurn=!!this.hd}={}){
      if(!this.active||this.hdRequest||this.exporter&&!forExport)return;this.controlsIdle=0;this.options.stopSound();this.options.resetDialogue?.();this.player=new BattleReplay.Player(this.record,this.sim,{fullTurn});this.scene.sim=this.player.state;this.scene.replayCut=null;this.scene.reset();this.scene.spatialEnabled=false;this.scene.engineTrailsEnabled=false;this.scene.setCamera('cinematic');this.renderUI();
    }
    async replayHD(){
      if(!this.active||this.exporter||this.hdRequest)return;
      if(this.hd){this.restart();return;}
      const request=this.hdRequest={};this.player.paused=true;this.options.stopSound();this.renderUI();
      try{
        await window.BattleReplayHD.load();if(!this.active||this.hdRequest!==request)return;
        this.scene.setReplayHD(true);this.hd=true;this.hdRequest=null;this.restart();
      }catch(error){if(this.active&&this.hdRequest===request)this.options.error(error.message||'HD replay could not start.');}
      finally{if(this.hdRequest===request)this.hdRequest=null;if(this.active)this.renderUI();}
    }
    async download(){
      if(!this.active||this.exporter||this.hdRequest)return;
      if(!window.BattleReplayExporter?.supported()){this.options.error('This browser does not support replay video recording.');return;}
      const hd=!!this.hd,exporter=this.exporter=new window.BattleReplayExporter({hd});this.exportHD=hd;
      try{
        this.restart({forExport:true,fullTurn:hd});this.player.paused=true;this.exportStatus='PREPARING AUDIO...';this.renderUI();
        this.scene.update(0,true);
        await exporter.prepare(this.record);if(exporter.cancelled)return;
        const recording=exporter.start(this.scene.renderer.domElement);this.player.paused=false;this.exportStatus='RECORDING - CANCEL';this.renderUI();
        const video=await recording;if(exporter.cancelled)return;
        this.exportStatus='CONVERTING - CANCEL';this.renderUI();const mp4=await exporter.mp4(video);exporter.download(mp4,this.record.pass,{hd});
      }catch(error){if(!exporter.cancelled){this.options.error(error.message||'Replay export failed.');this.player.paused=true;}}
      finally{
        exporter.dispose();
        if(this.exporter===exporter){this.exporter=null;this.exportStatus='';this.exportHD=false;}if(this.active)this.renderUI();
      }
    }
    cancelExport(){
      if(!this.exporter)return;this.exporter.cancel();this.exportStatus='CANCELLING...';
      if(this.active){this.player.paused=true;this.options.stopSound();this.renderUI();}
    }
    pause(){if(this.active){this.hdRequest=null;this.cancelExport();this.player.paused=true;this.options.stopSound();this.renderUI();}}
    tick(dt){
      if(!this.active)return;
      this.controlsIdle+=Math.max(0,dt);
      this.player.dialogueBusy=!!this.options.voicesBusy?.();
      const wasEnded=this.player.ended,update=this.player.advance(dt);if(this.player.ended&&!wasEnded)this.options.stopSound({music:false});
      if(update.cut){
        this.options.stopSound({music:false});
        this.scene.clearReplayTransient?.();
      }
      for(const event of update.events){if(event.type==='bridge-dialogue')this.options.dialogue?.(this.exporter?.recording?{...event,clip:this.exporter.clipFor(event)||event.clip}:event);else{this.scene.event(event);this.options.sound(event,update.rate||1);}}
      let sceneDt=update.dt||(!this.player.paused&&!this.player.ended?dt:0);
      if(this.record.result&&this.player.position>=this.record.duration)sceneDt=this.player.paused||this.player.ended?0:Math.min(dt,Math.max(0,BattleReplay.DESTRUCTION_DURATION-(this.player.hold-dt)));
      this.player.state.replayShot.frameDt=this.player.paused||this.player.ended?0:dt;
      this.scene.update(sceneDt);if(this.exporter?.recording)this.exporter.frame(this.scene.renderer.domElement);if(this.player.ended&&this.exporter?.recording)this.exporter.stop();this.renderUI();
    }
    renderUI(){
      const p=this.player,r=this.record,shot=p.state.replayShot,t=p.state.turn;
      this.$('replay-download').textContent=this.exportStatus||'DOWNLOAD MP4';this.$('replay-download').disabled=!!this.hdRequest;
      this.$('replay-record-hd').textContent=this.hdRequest?'LOADING HD MODEL...':'Replay in HD';this.$('replay-record-hd').disabled=!!(this.exporter||this.hdRequest);
      this.$('replay-play').disabled=!!(this.exporter||this.hdRequest);this.$('replay-restart').disabled=!!(this.exporter||this.hdRequest);
      this.dialog.setAttribute('data-hd',String(!!this.hd));
      this.$('replay-title').textContent=`Turn ${r.pass} / ${this.exportHD?'HD recording':this.hd?'HD replay':p.fullTurn?'Full turn':'Highlights'}`;
      this.$('replay-caption').textContent=`${shot.cameraFocus||shot.focus||'Enterprise'} / M${t.stageIndex+1} / ${Battle.maneuvers[t.maneuver]?.name||'Breakaway'}`;
      this.$('replay-shot').textContent=({establishing:'BATTLESPACE',duel:'CLOSE MANEUVER',withdrawal:'WITHDRAWAL',phaser:'PHASERS',torpedo:'TORPEDO',destruction:'DESTRUCTION',impact:'TARGET REACTION',launch:'TORPEDO',weapons:'WEAPONS',wide:'BATTLESPACE',hero:'SHIP PORTRAIT',tracking:'TRACKING',flyby:'FLY-BY',trailing:'TRAILING',component:'DAMAGE DETAIL'})[shot.cameraKind||shot.kind]||'';
      this.dialog.setAttribute('data-controls-hidden',String(!p.paused&&!p.ended&&!this.keyboardControls&&this.controlsIdle>=2.8));
      this.$('replay-speed').textContent=p.ended?'REPLAY COMPLETE':p.paused?'PAUSED':p.rate()<1?'SLOW MOTION':p.rate()>1?'TRAVEL':'CINEMATIC';
      this.$('replay-time').textContent=`${stamp(p.position)} / ${stamp(r.duration)}`;const selected=p.sequences.reduce((sum,s)=>sum+s.end-s.start,0),elapsed=p.sequences.reduce((sum,s,i)=>sum+(i<p.sequenceIndex?s.end-s.start:i===p.sequenceIndex?Math.max(0,p.position-s.start):0),0);
      this.$('replay-progress').value=p.ended?100:selected?elapsed/selected*100:100;
      this.$('replay-play').textContent=p.ended?'PLAY AGAIN':p.paused?'RESUME':'PAUSE';this.$('replay-play').setAttribute('aria-pressed',String(!p.paused&&!p.ended));
    }
    refresh(){for(const id of ['replay-last-pass','replay-result'])this.$(id).disabled=!this.sim.lastReplay?.frames.length||this.active;}
  }
  window.BattleReplayView=ReplayView;
})();
