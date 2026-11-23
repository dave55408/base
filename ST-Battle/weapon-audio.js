/* Direct media playback supports file:/// pages without fetch/CORS restrictions. */
window.BattleFileWeaponAudio=class{
  constructor(context){
    this.context=context;this.enabled=false;this.voices=new Set();this.generation=0;this.frame=0;this.pools={};
    this.hitCount=0;this.lastBreakAt=-Infinity;
    for(const kind of ['phaser','torpedo','explosion','bump','break','end'])this.pools[kind]=Array.from({length:kind==='phaser'?3:6},()=>{
      const audio=new window.Audio('assets/'+(kind==='phaser'?'phaser2':kind==='break'?'bang_together':kind)+'.mp3');audio.preload='auto';audio.loop=kind==='phaser';audio.volume=0;audio._token=0;
      audio.onerror=()=>this.report('Could not load '+(kind==='phaser'?'phaser2':kind==='break'?'bang_together':kind)+'.mp3. Keep the assets folder beside index.html.');
      window.BattleReplayCapture?.trackMedia(audio);audio.load();return audio;
    });
    this.ready=Promise.resolve();
  }
  report(message){
    if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('battle-audio-error',{detail:message}));
    else console.warn(message);
  }
  setEnabled(enabled){
    this.enabled=enabled;if(!enabled){this.stopAll();return;}
    // Prime the reusable players during the Audio-button interaction.
    for(const audio of Object.values(this.pools).flat()){
      if([...this.voices].some(v=>v.audio===audio))continue;
      const token=++audio._token;audio.volume=0;
      const done=()=>{if(audio._token===token){audio.pause();try{audio.currentTime=0;}catch{}}};
      try{Promise.resolve(audio.play()).then(done,done);}catch{done();}
    }
  }
  playPhaser(duration=1.4){this.play('phaser',duration);}
  playTorpedo(){this.play('torpedo');}
  playExplosion(){this.play('explosion');}
  playEnd(){this.play('end');}
  playHit(){if(!this.enabled)return;this.play(this.hitCount++%2?'bump':'explosion');}
  playBreak(){if(!this.enabled||this.context.currentTime-this.lastBreakAt<.75)return;this.lastBreakAt=this.context.currentTime;this.play('break');}
  play(kind,duration){
    if(!this.enabled)return;
    const pool=this.pools[kind];
    let audio=pool.find(a=>![...this.voices].some(v=>v.audio===a));
    if(!audio){const old=[...this.voices].find(v=>pool.includes(v.audio));this.finish(old);audio=old.audio;}
    const voice={audio,token:++audio._token,start:this.context.currentTime,end:duration===undefined?Infinity:this.context.currentTime+duration,fade:.18,peak:kind==='phaser'?.8:kind==='torpedo'?.255:.8,stopping:false};
    audio.pause();try{audio.currentTime=0;}catch{}audio.loop=kind==='phaser';audio.volume=0;
    window.BattleReplayCapture?.trackMedia(audio);this.voices.add(voice);audio.onended=()=>this.finish(voice);
    try{Promise.resolve(audio.play()).catch(()=>{if(audio._token===voice.token){this.finish(voice);this.report('Weapon audio was blocked. Toggle Audio off and on, then fire again.');}});}
    catch{this.finish(voice);this.report('Weapon audio could not start. Toggle Audio off and on.');}
    this.schedule();
  }
  schedule(){if(!this.frame&&this.voices.size)this.frame=requestAnimationFrame(()=>{this.frame=0;this.update();this.schedule();});}
  update(){
    const now=this.context.currentTime;
    for(const voice of [...this.voices]){
      if(now>=voice.end+voice.fade){this.finish(voice);continue;}
      const fade=now>voice.end?Math.max(0,1-(now-voice.end)/voice.fade):1;
      const attack=Math.min(1,Math.max(0,(now-voice.start)/.02));
      voice.audio.volume=Math.max(0,Math.min(1,(voice.stopping?voice.fadeVolume:voice.peak*attack)*fade));
    }
  }
  finish(voice){
    if(!voice)return;this.voices.delete(voice);
    if(voice.audio._token!==voice.token)return;
    voice.audio._token++;voice.audio.pause();voice.audio.volume=0;voice.audio.onended=null;
    try{voice.audio.currentTime=0;}catch{}
  }
  stopAll(fade=.12){
    this.generation++;const now=this.context.currentTime;
    for(const voice of this.voices){if(voice.stopping)continue;voice.stopping=true;voice.fadeVolume=voice.audio.volume;voice.end=now;voice.fade=fade;}
    this.schedule();
  }
};

/* Recorded weapon cues, synchronized to the 1.4 second phaser visual. */
window.BattleWeaponAudio=class{
  constructor(context){
    if(window.location?.protocol==='file:')return new window.BattleFileWeaponAudio(context);
    this.context=context;this.buffers={};this.voices=new Set();this.enabled=false;this.generation=0;
    this.hitCount=0;this.lastBreakAt=-Infinity;
    this.ready=Promise.all(['phaser','torpedo','explosion','bump','break','end'].map(async kind=>{
      try{
        const response=await fetch('assets/'+(kind==='phaser'?'phaser2':kind==='break'?'bang_together':kind)+'.mp3');if(!response.ok)throw new Error('HTTP '+response.status);
        this.buffers[kind]=await context.decodeAudioData(await response.arrayBuffer());
      }catch(error){console.warn('Could not load '+(kind==='phaser'?'phaser2':kind==='break'?'bang_together':kind)+'.mp3',error);}
    }));
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stopAll();}
  playPhaser(duration=1.4){this.play('phaser',duration);}
  playTorpedo(){this.play('torpedo');}
  playExplosion(){this.play('explosion');}
  playEnd(){this.play('end');}
  playHit(){if(!this.enabled)return;this.play(this.hitCount++%2?'bump':'explosion');}
  playBreak(){if(!this.enabled||this.context.currentTime-this.lastBreakAt<.75)return;this.lastBreakAt=this.context.currentTime;this.play('break');}
  play(kind,duration){
    if(!this.enabled)return;
    if(!this.buffers[kind]){
      const generation=this.generation,started=this.context.currentTime;
      this.ready.then(()=>{
        const elapsed=this.context.currentTime-started;
        if(this.enabled&&this.generation===generation&&this.buffers[kind]&&elapsed<(duration??.3))this.play(kind,duration===undefined?undefined:duration-elapsed);
      });return;
    }
    const ctx=this.context,now=ctx.currentTime,source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=this.buffers[kind];source.loop=kind==='phaser';source.connect(gain);gain.connect(ctx.destination);window.BattleReplayCapture?.trackNode(gain,ctx);
    const voice={source,gain,stopping:false};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};
    const peak=kind==='phaser'?.42:kind==='torpedo'?.165:.5;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(peak,now+.02);
    source.start(now);
    if(kind==='phaser'){
      gain.gain.setValueAtTime(peak,now+duration);
      gain.gain.linearRampToValueAtTime(0,now+duration+.18);
      source.stop(now+duration+.2);
    }
  }
  stopAll(fade=.12){
    this.generation++;
    const now=this.context.currentTime;
    for(const voice of this.voices){
      if(voice.stopping)continue;voice.stopping=true;
      const parameter=voice.gain.gain;
      if(parameter.cancelAndHoldAtTime)parameter.cancelAndHoldAtTime(now);
      else{parameter.cancelScheduledValues(now);parameter.setValueAtTime(parameter.value,now);}
      parameter.linearRampToValueAtTime(0,now+fade);
      voice.source.stop(now+fade+.02);
    }
  }
};

/* Ship impulse engines: native media supports both file and web pages. */
window.BattleEngineAudio=class{
  constructor(source='assets/drone_hum.mp3'){
    this.audio=new window.Audio(source);window.BattleReplayCapture?.trackMedia(this.audio);this.audio.preload='auto';this.audio.loop=true;this.audio.volume=0;
    this.audio.preservesPitch=false;this.audio.mozPreservesPitch=false;this.audio.webkitPreservesPitch=false;
    this.enabled=false;this.active=false;this.starting=false;this.playing=false;this.generation=0;
    this.audio.onerror=()=>{this.stop();console.warn('Could not load '+source);};
    this.audio.load();
  }
  setEnabled(enabled){
    if(this.enabled===enabled)return;this.enabled=enabled;
    if(!enabled)this.stop();else this.start(true);
  }
  start(prime=false){
    window.BattleReplayCapture?.trackMedia(this.audio);
    if(!this.enabled||this.starting||this.playing||(!prime&&!this.active))return;
    const token=this.generation;this.starting=true;
    try{Promise.resolve(this.audio.play()).then(()=>{
      if(token!==this.generation)return;
      this.starting=false;this.playing=true;
      if(!this.enabled||!this.active)this.stop();
    }).catch(()=>{if(token===this.generation){this.starting=false;this.playing=false;this.enabled=false;}});}
    catch{this.starting=false;this.playing=false;this.enabled=false;}
  }
  update({speed=0,maximum=300,active=false,volume=.2}={}){
    this.active=active;
    const fraction=Math.max(0,Math.min(1,Math.abs(speed)/Math.max(1,maximum)));
    const rate=1+.4*fraction,targetVolume=this.enabled&&active?volume:0;
    if(this.audio.playbackRate!==rate)this.audio.playbackRate=rate;
    if(this.audio.volume!==targetVolume)this.audio.volume=targetVolume;
    if(this.enabled&&active)this.start();else if(this.playing||this.starting)this.stop();
  }
  stop(){
    this.generation++;this.starting=false;this.playing=false;this.audio.volume=0;this.audio.pause();
  }
};

/* Quiet viewscreen ambience, independent of ship speed and battle state. */
window.BattleViewscreenAudio=class extends window.BattleEngineAudio{
  constructor(){super('assets/viewscreen_slow.mp3');}
  update({active=false}={}){
    super.update({speed:0,active,volume:.025});
  }
};

/* Quiet, fixed-pitch alert loop; shares native-media lifecycle and file support. */
window.BattleAlertAudio=class extends window.BattleEngineAudio{
  constructor(){super('assets/tos_red_alert.mp3');}
  setEnabled(enabled){
    this.enabled=enabled;
    // Do not prime or start this recording merely because audio was enabled.
    if(!enabled){this.active=false;this.stop();}
  }
  update({active=false}={}){
    super.update({speed:0,active,volume:.06});
  }
};

/* Combat score follows the opening cue and pauses with the engagement. */
window.BattleFightAudio=class extends window.BattleEngineAudio{
  constructor(){super('assets/FightMusic.mp3');}
  setEnabled(enabled){this.enabled=enabled;if(!enabled)this.stop();}
  update({active=false,dt=0,fade=false}={}){
    if(!this.enabled){this.active=false;this.stop();return;}
    const target=active?.2:0,step=.2*Math.max(0,dt)/1.2;
    this.audio.volume=fade?this.audio.volume+Math.max(-step,Math.min(step,target-this.audio.volume)):target;
    if(Math.abs(this.audio.volume-target)<1e-8)this.audio.volume=target;
    this.audio.playbackRate=1;this.active=active||this.audio.volume>0;
    if(this.active)this.start();else if(this.playing||this.starting)this.stop();
  }
};

/* One introduction per engagement; pause/resume retains its playback position. */
window.BattleIntroAudio=class extends window.BattleEngineAudio{
  constructor(){
    super('assets/introwav.mp3');this.audio.loop=false;this.triggered=false;this.finished=false;this.requestedActive=false;
    this.fight=new window.BattleFightAudio();
    this.audio.onended=()=>{
      this.finished=true;this.active=false;this.playing=false;this.audio.volume=0;
      this.update(this.musicState||{active:this.requestedActive});
    };
  }
  setEnabled(enabled){this.enabled=enabled;this.fight.setEnabled(enabled);if(!enabled)this.stop();}
  playOnce(){
    if(this.triggered)return;this.triggered=true;
    try{this.audio.currentTime=0;}catch{}
    this.update({active:true});
  }
  update({active=false,musicActive=active,replay=false,fadeMusic=false,fadeOut=false,dt=0}={}){
    this.musicState={active,musicActive,replay,fadeMusic,fadeOut};
    this.requestedActive=active;
    this.active=this.triggered&&!this.finished&&(active||fadeOut&&(this.playing||this.starting));
    this.audio.playbackRate=1;
    this.audio.volume=fadeOut?Math.max(0,this.audio.volume-.5*Math.max(0,dt)/1.2):this.enabled&&this.active?.5:0;
    if(fadeOut&&this.audio.volume<1e-8){this.audio.volume=0;this.active=false;}
    if(this.enabled&&this.active)this.start();else if(this.playing||this.starting)this.stop();
    this.fight.update({active:musicActive&&!fadeOut&&(replay||this.triggered&&this.finished),dt,fade:fadeMusic||fadeOut});
  }
  reset(){
    this.stop();this.fight.stop();this.fight.active=false;this.triggered=false;this.finished=false;this.active=false;this.requestedActive=false;this.musicState=null;
    try{this.audio.currentTime=0;this.fight.audio.currentTime=0;}catch{}
  }
};
