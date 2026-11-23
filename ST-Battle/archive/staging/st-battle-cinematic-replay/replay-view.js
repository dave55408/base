/* A separate scene and recorded state keep the live engagement untouched. */
(()=>{
  const stamp=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
  class ReplayView{
    constructor(sim,options){
      this.sim=sim;this.options=options;this.active=false;this.$=id=>document.getElementById(id);this.dialog=this.$('replay-dialog');
      for(const id of ['replay-last-pass','replay-review','replay-result'])this.$(id).onclick=()=>this.open();
      this.$('replay-close').onclick=()=>this.close();this.$('replay-restart').onclick=()=>this.restart();
      this.$('replay-play').onclick=()=>{if(this.player.ended)this.restart();else{this.player.paused=!this.player.paused;if(this.player.paused)this.options.stopSound();this.renderUI();}};
      this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
      this.controlsIdle=0;this.keyboardControls=false;
      for(const name of ['pointermove','pointerdown'])this.dialog.addEventListener(name,()=>{this.controlsIdle=0;this.keyboardControls=false;this.dialog.setAttribute('data-controls-hidden','false');});
      this.dialog.addEventListener('keydown',()=>{this.controlsIdle=0;this.keyboardControls=true;this.dialog.setAttribute('data-controls-hidden','false');});
    }
    open(){
      if(this.active||!this.sim.lastReplay?.frames.length)return;
      this.record=this.sim.lastReplay;this.controlsIdle=0;this.keyboardControls=false;this.resumeBattle=this.sim.running;this.sim.running=false;this.options.stopSound();this.dialog.showModal();
      try{
        this.player=new BattleReplay.Player(this.record,this.sim);
        if(!this.scene)this.scene=this.options.createScene(this.$('replay-viewport'),this.player.state);
        else{this.scene.sim=this.player.state;this.scene.replayCut=null;this.scene.reset();}
        this.scene.spatialEnabled=false;this.scene.engineTrailsEnabled=false;this.scene.setCamera('cinematic');this.active=true;this.renderUI();this.options.changed();
      }catch(error){this.dialog.close();this.sim.running=this.resumeBattle;this.options.error('Cinematic replay could not start: '+error.message);}
    }
    close(resume=true){
      if(!this.active)return;this.options.stopSound();this.dialog.close();this.active=false;this.player.paused=true;
      this.sim.running=!!(resume&&this.resumeBattle&&!this.sim.result&&!document.hidden);this.options.changed();
    }
    restart(){
      if(!this.active)return;this.controlsIdle=0;this.options.stopSound();this.player=new BattleReplay.Player(this.record,this.sim);this.scene.sim=this.player.state;this.scene.replayCut=null;this.scene.reset();this.scene.spatialEnabled=false;this.scene.engineTrailsEnabled=false;this.scene.setCamera('cinematic');this.renderUI();
    }
    pause(){if(this.active){this.player.paused=true;this.options.stopSound();this.renderUI();}}
    tick(dt){
      if(!this.active)return;
      this.controlsIdle+=Math.max(0,dt);
      const wasEnded=this.player.ended,update=this.player.advance(dt);if(this.player.ended&&!wasEnded)this.options.stopSound();
      for(const event of update.events){this.scene.event(event);this.options.sound(event,update.rate||1);}
      let sceneDt=update.dt||(!this.player.paused&&!this.player.ended?dt:0);
      if(this.record.result&&this.player.position>=this.record.duration)sceneDt=this.player.paused||this.player.ended?0:Math.min(dt,Math.max(0,BattleReplay.DESTRUCTION_DURATION-(this.player.hold-dt)));
      this.scene.update(sceneDt);this.renderUI();
    }
    renderUI(){
      const p=this.player,r=this.record,shot=p.state.replayShot,t=p.state.turn;
      this.$('replay-title').textContent=`Turn ${r.pass} / Cinematic replay`;
      this.$('replay-caption').textContent=`M${t.stageIndex+1} / ${Battle.maneuvers[t.maneuver]?.name||'Breakaway'}`;
      this.$('replay-shot').textContent=({establishing:'',phaser:'PHASERS',torpedo:'TORPEDO',destruction:'',impact:'IMPACT',launch:'TORPEDO',weapons:'',wide:'',hero:''})[shot.cameraKind||shot.kind]||'';
      this.dialog.setAttribute('data-controls-hidden',String(!p.paused&&!p.ended&&!this.keyboardControls&&this.controlsIdle>=2.8));
      this.$('replay-speed').textContent=p.ended?'REPLAY COMPLETE':p.paused?'PAUSED':p.rate()<1?'SLOW MOTION':p.rate()>1?'TRAVEL':'CINEMATIC';
      this.$('replay-time').textContent=`${stamp(p.position)} / ${stamp(r.duration)}`;this.$('replay-progress').value=r.duration?p.position/r.duration*100:100;
      this.$('replay-play').textContent=p.ended?'PLAY AGAIN':p.paused?'RESUME':'PAUSE';this.$('replay-play').setAttribute('aria-pressed',String(!p.paused&&!p.ended));
    }
    refresh(){for(const id of ['replay-last-pass','replay-review','replay-result'])this.$(id).disabled=!this.sim.lastReplay?.frames.length||this.active;}
  }
  window.BattleReplayView=ReplayView;
})();
