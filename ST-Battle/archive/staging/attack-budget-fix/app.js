(()=>{
  'use strict';
  const $=id=>document.getElementById(id),B=Battle,sim=window.battle=new B.Simulation((Math.random()*0x100000000)>>>0,{randomStart:true});
  const colors={engines:'#d9aa73',shields:'#7bd3da',weapons:'#dd8278',sensors:'#ad9ac9'};
  const career=loadCareer();let resultSaved=false,newBest=false,calloutUntil=0,bestGuessEnabled=false,yorktownStrategyVisible=false;
  function loadCareer(){
    const fresh={best:0,wins:0,played:0};
    try{const saved=JSON.parse(window.localStorage?.getItem('st-battle-career')||'null');for(const key of Object.keys(fresh))if(Number.isFinite(saved?.[key])&&saved[key]>=0)fresh[key]=Math.floor(saved[key]);}catch{}
    return fresh;
  }
  function renderDebrief(){
    if(!resultSaved){
      newBest=sim.battleStats.score>career.best;career.best=Math.max(career.best,sim.battleStats.score);career.played++;if(sim.result==='victory')career.wins++;
      try{window.localStorage?.setItem('st-battle-career',JSON.stringify(career));}catch{}
      resultSaved=true;
    }
    text('result-grade',sim.battleGrade);text('result-score',sim.battleStats.score.toLocaleString());
    text('result-performance',`${sim.accuracy}% accuracy / best chain ${sim.battleStats.bestChain} / ${sim.difficultyProfile.name}`);
    text('result-challenge',sim.challengeComplete?'BONUS OBJECTIVE COMPLETE +'+Math.round(750*sim.difficultyProfile.scoreMultiplier):sim.challengeDescription);
    text('result-record',newBest?'NEW PERSONAL BEST':'PERSONAL BEST '+career.best.toLocaleString());
  }
  function quickBattle(){
    if(!scene||sim.result||sim.freeFlight||!sim.applyPlanPreset('strong'))return false;
    return commitPlan();
  }
  function showCombatCallout(title,detail,tone='hit'){
    text('callout-title',title);text('callout-detail',detail);$('combat-callout').setAttribute('data-tone',tone);$('combat-callout').hidden=false;calloutUntil=lastFrame+1800;
  }
  const keys={},held=new Set();let planner,replayView,scene,audioOn=true,ctx,weaponAudio,engineAudio,yorktownEngineAudio,audioStarting,toastTimer,lastUI=0,lastFrame=performance.now(),wasRunning=false,endingElapsed=0,endingStarted=false;
  const fmt=n=>Math.round(n),deg=n=>String(Math.round(n)%360).padStart(3,'0')+'°',signed=n=>(n<0?'−':'+')+String(Math.abs(Math.round(n))).padStart(2,'0')+'°';
  const time=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
  const text=(id,value)=>{const e=$(id);if(e.textContent!==String(value))e.textContent=value;};
  function toast(message){text('toast',message);$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
  function tone(freq,duration=.15,wave='sine',volume=.025,endFreq=freq){if(!audioOn||!ctx)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type=wave;o.frequency.setValueAtTime(freq,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),ctx.currentTime+duration);g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);o.connect(g).connect(ctx.destination);o.start();o.stop(ctx.currentTime+duration);}
  function syncAudioButton(){
    $('audio').setAttribute('aria-pressed',String(audioOn));
    text('audio-label',audioOn?'Audio on':'Audio off');text('replay-audio',audioOn?'AUDIO ON':'AUDIO OFF');
    $('audio').title=audioOn?'Mute engines, weapons and action sounds':'Enable engines, weapons and action sounds';
  }
  function audioFailed(){
    if(!audioOn)return false;
    audioOn=false;weaponAudio?.setEnabled(false);engineAudio?.setEnabled(false);yorktownEngineAudio?.setEnabled(false);syncAudioButton();
    toast('Audio could not start. Click Audio again and check that the browser tab is not muted.');
    return false;
  }
  function unlockAudio(){
    if(!audioOn)return Promise.resolve(false);
    if(weaponAudio&&ctx.state==='running')return Promise.resolve(true);
    if(audioStarting)return audioStarting;
    try{
      if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();
      if(!weaponAudio)weaponAudio=new window.BattleWeaponAudio(ctx);
      // Prime local MP3 players synchronously inside the user's interaction.
      weaponAudio.setEnabled(true);
      if(!engineAudio&&window.BattleEngineAudio&&window.Audio){engineAudio=new window.BattleEngineAudio();yorktownEngineAudio=new window.BattleEngineAudio('assets/drone_hum_yorktown.mp3');}
      engineAudio?.setEnabled(true);yorktownEngineAudio?.setEnabled(true);
      audioStarting=Promise.resolve(ctx.resume()).then(()=>{
        if(!audioOn)return false;
        if(ctx.state&&ctx.state!=='running')throw new Error('Audio context is not running');
        return true;
      }).catch(audioFailed).finally(()=>{audioStarting=null;});
      return audioStarting;
    }catch{return Promise.resolve(audioFailed());}
  }
  async function audio(){
    audioOn=!audioOn;syncAudioButton();
    if(!audioOn){weaponAudio?.setEnabled(false);engineAudio?.setEnabled(false);yorktownEngineAudio?.setEnabled(false);return;}
    weaponAudio?.setEnabled(true);engineAudio?.setEnabled(true);yorktownEngineAudio?.setEnabled(true);
    if(await unlockAudio())tone(550,.18,'sine',.06,750);
  }
  document.addEventListener('pointerdown',()=>{if(audioOn)unlockAudio();},{capture:true});
  function buildControls(){
    for(const arc of B.arcs){const row=document.createElement('div');row.className='shield-control';row.innerHTML=`<div class="shield-label"><label for="bias-${arc}">${arc==='starboard'?'STBD':arc}</label><b id="shield-${arc}">100%</b></div><input id="bias-${arc}" type="range" min="0" max="100" value="${sim.player.bias[arc]}" aria-label="${arc} shield recharge allocation" title="Share of shield recharge power">`;row.querySelector('input').addEventListener('input',e=>B.redistribute(sim.player.bias,arc,+e.target.value));$('shield-controls').append(row);}
    for(const key of B.systems){const row=document.createElement('div');row.className='power-row';row.style.setProperty('--system-color',colors[key]);row.innerHTML=`<label for="power-${key}"><span>${key}<small id="integrity-${key}">100% intact</small></span></label><input id="power-${key}" type="range" min="0" max="100" value="${sim.player.power[key]}" aria-label="${key} reactor allocation"><output id="output-${key}"></output>`;row.querySelector('input').addEventListener('input',e=>B.redistribute(sim.player.power,key,+e.target.value));$('power-controls').append(row);const segment=document.createElement('i');segment.id='stack-'+key;segment.style.background=colors[key];$('power-stack').append(segment);}
    for(const key of ['engines','mainEngines','bridge','sensors']){const row=document.createElement('div');row.innerHTML=`<span>${B.targets[key]}</span><b id="yorktown-system-${key}">UNKNOWN</b>`;$('yt-system-integrity').append(row);}
    for(let i=0;i<12;i++)$('magazine').append(document.createElement('i'));
    for(const key of B.systems){const row=document.createElement('div');row.style.setProperty('--system-color',colors[key]);row.innerHTML=`<span>${key.toUpperCase()}</span><b id="yt-power-${key}">UNKNOWN</b>`;$('yt-power').append(row);const segment=document.createElement('i');segment.id='yt-stack-'+key;segment.style.background=colors[key];$('yt-power-stack').append(segment);}
    for(const arc of B.arcs){const row=document.createElement('div');row.innerHTML=`<span>${arc.toUpperCase()}</span><b id="yt-shield-${arc}">UNKNOWN</b>`;$('yt-shield-readouts').append(row);}
  }
  function begin(){if(sim.freeFlight)reset();if(sim.result)return;if(!scene){toast('The 3D viewscreen must be available before starting.');return;}sim.running=true;$('start').hidden=true;tone(450,.25,'triangle',.025,880);sim.message('CONN','Engagement underway. Yorktown closing. Helm is yours.');ui();if(sim.turnBased&&!sim.maneuvering&&!sim.planReady())planner.open();}
  function pause(){if(sim.result)return;if(!sim.freeFlight&&!sim.running&&sim.time===0){begin();return;}sim.running=!sim.running;keysClear();ui();}
  function reset(){resultSaved=false;newBest=false;calloutUntil=0;$('combat-callout').hidden=true;endingElapsed=0;endingStarted=false;engineAudio?.stop();yorktownEngineAudio?.stop();replayView?.close(false);weaponAudio?.stopAll(.03);sim.reset();sim.environment=$('environment').value;$('repair-system').value='sensors';scene?.reset();camera('chase');held.clear();keysClear();$('result').hidden=true;$('start').hidden=false;document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera==='chase'));ui();}
  function keysClear(){for(const k of Object.keys(keys))keys[k]=false;held.clear();}
  function fire(type){if(sim.fire(type))return;const status=sim.status(type);if(status!=='OUTSIDE FIRING ARC')toast(status);tone(160,.1);}
  function scan(){if(!sim.scan())toast(sim.player.cooldown.scan>0?'Sensor sweep recharging.':!sim.running?'Engage the simulation first.':'Scan needs operating sensors and 12% capacitor.');}
  function openHelp(){wasRunning=sim.running;sim.running=false;keysClear();$('briefing').showModal();ui();}
  function closeHelp(){sim.environment=$('environment').value;$('briefing').close();sim.running=wasRunning;ui();}
  function camera(mode){scene?.setCamera(mode);$('game-shell').classList.toggle('cinema-view',mode==='cinematic'&&!replayView?.active);document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===mode));text('view-mode',({chase:'CHASE CAM',tactical:'TACTICAL OVERVIEW',forward:'FORWARD VIEW',cinematic:'CINEMA VIEW'})[mode]);}
  function cycleCamera(){const modes=['chase','tactical','forward','cinematic'];camera(modes[(modes.indexOf(scene?.mode)+1)%4]);}
  buildControls();syncAudioButton();
  try{scene=window.battleScene=new BattleScene($('viewport'),sim);}catch(error){console.error(error);$('viewport').innerHTML='<div class="fallback"><h2>Viewscreen unavailable</h2><p>ST Battle needs WebGL. Enable graphics acceleration in Chrome or Edge, then reload this page.</p></div>';toast('3D renderer could not start.');$('start').disabled=true;}
  window.addEventListener('battle-audio-error',e=>toast(e.detail));
  if(scene?.resolveWeaponHit)sim.resolveWeaponHit=(...args)=>scene.resolveWeaponHit(...args);
  window.addEventListener('battle-render-error',e=>{sim.running=false;toast(e.detail);});
  $('start').onclick=begin;$('pause').onclick=pause;$('rematch').onclick=()=>{reset();begin();};$('audio').onclick=audio;$('scan').onclick=scan;$('phaser').onclick=()=>fire('phaser');$('torpedo').onclick=()=>fire('torpedo');$('help').onclick=openHelp;$('close-help').onclick=closeHelp;
  $('quick-battle').onclick=quickBattle;$('quick-rematch').onclick=()=>{reset();quickBattle();};
  $('plan-attack').onclick=begin;
  $('toggle-yorktown-strategy').onclick=()=>{yorktownStrategyVisible=!yorktownStrategyVisible;ui();};
  $('launch-practice').onclick=()=>{$('free-flight').onclick();};
  for(const level of ['cadet','captain','admiral'])$('difficulty-'+level).onclick=()=>{if(sim.setDifficulty(level))ui();};
  async function toggleFullscreen(){
    const playfield=replayView?.active?$('replay-dialog'):$('battle-screen');
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else if(playfield.requestFullscreen)await playfield.requestFullscreen();
      else toast('Fullscreen is not supported by this browser.');
    }catch{toast('Fullscreen could not start. Press F or double-click to try again.');}
  }
  $('battle-screen').addEventListener('dblclick',async e=>{
    if(e.target.closest?.('button,input,select,label,a,[role="slider"]'))return;
    e.preventDefault();await toggleFullscreen();
  });
  $('briefing').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});$('brief-engage').onclick=()=>{closeHelp();if(!sim.result)begin();};
  $('warp').onclick=()=>{if(sim.warp()){toast('Warp complete. 30 km jump. Charge spent.');tone(180,.7,'sine',.04,1000);}else if(sim.running&&!sim.warpUsed)toast('Warp destination obstructed. Change heading.');ui();};
  $('stop').onclick=()=>{sim.slowAhead();toast('Slow ahead. Minimum impulse maintained.');ui();};$('level').onclick=()=>{sim.player.pitch=0;sim.player.bank=0;sim.player.turnRate=0;};
  for(const field of ['heading','pitch','throttle'])$(field).addEventListener('input',e=>{if(!sim.turnBased)sim.player[field]=+e.target.value;});
  $('enterprise-speed').addEventListener('input',e=>{
    if(sim.turnBased)return;
    const maximum=125*B.clamp(sim.output(sim.player,'engines')/24,.12,1.6)*1.5;
    sim.player.throttle=B.clamp(Number(e.target.value)/10/maximum*100,-100,100);
  });
  function commitPlan(captain=false){
    if(sim.freeFlight)return false;
    if(!scene){toast('The viewscreen must be available before committing.');return false;}
    const previous=sim.running,previousCaptain=sim.captainEnabled;sim.running=true;sim.captainEnabled=captain===true;
    if(!sim.commitOrders()){sim.running=previous;sim.captainEnabled=previousCaptain;toast('Configure all five phasers and two torpedoes before committing.');return false;}
    if(sim.captainEnabled)sim.playerMind.nextThink=0;
    $('start').hidden=true;keysClear();ui();return true;
  }
  function canBestGuessTurn(){
    return !!scene&&sim.turnBased&&!sim.freeFlight&&!sim.result&&['planning','review'].includes(sim.turn.phase)&&!planner?.dialog.open&&!$('briefing').open&&!replayView?.active;
  }
  function bestGuessTurn(){
    if(!canBestGuessTurn()||!sim.bestGuessPlan())return false;
    return commitPlan(true);
  }
  planner=new window.BattlePlanner(sim,commitPlan,()=>ui());
  replayView=window.battleReplay=new window.BattleReplayView(sim,{
    createScene:(host,state)=>new BattleScene(host,state),stopSound:()=>{weaponAudio?.stopAll(.03);engineAudio?.stop();yorktownEngineAudio?.stop();},changed:()=>{keysClear();ui();},error:toast,
    sound:eventSound
  });
  $('replay-audio').onclick=audio;

  $('open-planner').onclick=()=>{sim.captainEnabled=false;keysClear();planner.open();};
  $('free-flight').onclick=()=>{
    if(!scene)return;
    if(planner.dialog.open)planner.cancel();reset();sim.startFreeFlight();keysClear();ui();
    toast('Free Flight: arrows steer, W/S adjust speed. Yorktown is cruising near K7.');
  };
  $('commit-orders').onclick=commitPlan;
  $('random-turn').onclick=()=>{
    if($('random-turn').disabled)return;
    bestGuessEnabled=!bestGuessEnabled;
    if(bestGuessEnabled&&canBestGuessTurn())bestGuessTurn();
    ui();
  };
  $('end-pass').onclick=()=>{
    if(replayView?.active)return;
    if(planner.dialog.open)planner.cancel();
    if(!sim.endPass())return;
    keysClear();weaponAudio?.stopAll(.03);scene?.clearTransientEffects?.();
    sim.events=sim.events.filter(event=>['message','phase'].includes(event.type));
    ui();
  };
  $('repair-system').onchange=e=>{sim.repair(e.target.value);toast('Repair team assigned to '+e.target.value+'.');};
  document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>camera(b.dataset.camera));
  document.querySelectorAll('[data-power]').forEach(button=>button.onclick=()=>{Object.assign(sim.player.power,({balanced:{engines:24,shields:30,weapons:30,sensors:16},attack:{engines:18,shields:20,weapons:48,sensors:14},defend:{engines:15,shields:53,weapons:20,sensors:12},evasive:{engines:53,shields:25,weapons:10,sensors:12}})[button.dataset.power]);toast(button.textContent+' power configuration.');tone(600,.06);});
  document.querySelectorAll('[data-bias]').forEach(button=>button.onclick=()=>{const type=button.dataset.bias;if(type==='balanced')for(const a of B.arcs)sim.player.bias[a]=100/6;else{const arc=type==='threat'?B.facing(sim.player,sim.enemy):type;B.redistribute(sim.player.bias,arc,55);toast('Shield recharge diverted '+arc+'.');}tone(700,.08);});
  document.querySelectorAll('[data-hold]').forEach(button=>{button.addEventListener('pointerdown',e=>{if(sim.turnBased)return;e.preventDefault();keys[button.dataset.hold]=true;button.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys[button.dataset.hold]=false);});
  const mapping={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',KeyA:'left',KeyW:'more',KeyS:'less',Space:'stop'};
  const keyCode=e=>{const key=e.key||'';return key===' '?'Space':key.length===1?'Key'+key.toUpperCase():(e.code||key);};
  addEventListener('keydown',e=>{
    const code=keyCode(e);
    if(audioOn&&!e.ctrlKey&&!e.metaKey&&!e.altKey)unlockAudio();
    if(code==='KeyF'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!$('plan-wizard').open&&!$('briefing').open){e.preventDefault();if(!e.repeat)toggleFullscreen();return;}
    if(replayView?.active&&!e.ctrlKey&&!e.metaKey&&!e.altKey){if(e.repeat)return;if(code==='Escape'){e.preventDefault();replayView.close();}if(code==='KeyP'||code==='Space'){e.preventDefault();$('replay-play').onclick();}if(code==='KeyR')replayView.restart();if(code==='KeyB')audio();return;}
    if($('plan-wizard').open||$('briefing').open||e.ctrlKey||e.metaKey||e.altKey||(['SELECT','TEXTAREA'].includes(e.target.tagName)||(e.target.tagName==='INPUT'&&e.target.type==='checkbox')))return;
    if(code==='Escape'&&document.fullscreenElement)return;
    if(mapping[code]&&(!sim.turnBased||code==='KeyW'||code==='KeyS')){e.preventDefault();keys[mapping[code]]=true;}
    if(code==='KeyR'&&sim.freeFlight){e.preventDefault();if(!e.repeat)fire('phaser');held.add('phaser');}
    if(e.repeat)return;
    if(code==='NumpadEnter'||code==='Enter'&&e.location===3){
      e.preventDefault();keysClear();
      Object.assign(sim.player,{heading:0,pitch:0,bank:0,turnRate:0,pitchRate:0});
      camera('chase');ui();return;
    }
    if(code==='KeyD'){e.preventDefault();if(sim.selfDestruct()){keysClear();ui();}return;}
    if(code==='KeyT'){e.preventDefault();fire('torpedo');}if(code==='KeyC')scan();if(code==='KeyP')pause();if(code==='KeyV')cycleCamera();if(code==='KeyB')audio();if(code==='Enter'&&!sim.running&&!sim.result)begin();if(code==='Escape'&&sim.running)pause();
  });
  addEventListener('keyup',e=>{const code=keyCode(e);if(mapping[code])keys[mapping[code]]=false;if(code==='KeyR')held.delete('phaser');});
  addEventListener('blur',()=>{replayView?.pause();keysClear();engineAudio?.stop();yorktownEngineAudio?.stop();if(sim.running){sim.running=false;toast('Simulation paused while you were away.');ui();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)replayView?.pause();if(document.hidden&&sim.running){sim.running=false;keysClear();}});
  function dragDial(id,onMove){let drag;const el=$(id);el.addEventListener('pointerdown',e=>{if(sim.turnBased)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,heading:sim.player.heading,pitch:sim.player.pitch,throttle:sim.player.throttle};el.setPointerCapture(e.pointerId);});el.addEventListener('pointermove',e=>{if(drag)onMove(e,drag);});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,()=>drag=null);}
  dragDial('attitude',(e,d)=>{sim.player.heading=B.wrap(d.heading+(e.clientX-d.x)*1.2);sim.player.pitch=B.clamp(d.pitch+(e.clientY-d.y)*.8,-85,85);});
  dragDial('power-dial',(e,d)=>sim.player.throttle=B.clamp(d.throttle+(d.y-e.clientY)*1.2,-100,100));
  $('attitude').addEventListener('keydown',e=>{if(e.key==='Home'&&!sim.turnBased){e.preventDefault();sim.player.heading=0;sim.player.pitch=0;sim.player.bank=0;sim.player.turnRate=0;}});
  $('power-dial').addEventListener('keydown',e=>{if(sim.turnBased)return;if(e.key==='Home'){e.preventDefault();sim.player.throttle=0;}if(e.key==='PageUp'){e.preventDefault();sim.player.throttle=B.clamp(sim.player.throttle+10,-100,100);}if(e.key==='PageDown'){e.preventDefault();sim.player.throttle=B.clamp(sim.player.throttle-10,-100,100);}});
  function attackGuidance(){
    const p=sim.player,e=sim.enemy,box=$('attack-hud');box.hidden=!!sim.result;
    $('attack-directions').setAttribute('data-turn','none');
    $('attack-turn-arrow').hidden=true;$('attack-pitch-arrow').hidden=true;
    if(sim.freeFlight){
      $('distance-hud').hidden=true;text('attack-title','FREE FLIGHT / MANUAL HELM');
      text('attack-turn','');text('attack-pitch','PLANET HDG '+deg(B.bearing(p,sim.planet))+' / PITCH '+signed(B.elevation(p,sim.planet)));
      text('attack-solution','ATMOSPHERE '+(Math.max(0,sim.planetClearance())/100).toFixed(1)+' KM');box.style.color='#79cbd7';return;
    }
    const rangeKnown=sim.contact||sim.range>=2000,rangeKm=Math.min(20,sim.range/100);
    $('distance-hud').hidden=!rangeKnown;
    $('distance-fill').style.width=(rangeKnown?Math.min(100,sim.range/20):0)+'%';
    $('distance-hud').style.color=B.targetingColor(sim,scene?.project(e).visible||false);
    text('distance-value',sim.range>=2000?'OUT OF RANGE':sim.contact?rangeKm.toFixed(1)+' KM':'NO CONTACT');
    $('distance-meter').setAttribute('aria-valuenow',rangeKnown?String(rangeKm):'0');
    $('distance-meter').setAttribute('aria-valuetext',sim.range>=2000?'Out of range: 20 kilometers or more':sim.contact?rangeKm.toFixed(1)+' kilometers':'No contact');
    text('attack-title',sim.contact&&sim.enemyRetreating?'YORKTOWN RETREATING / PURSUIT GUIDANCE':'YORKTOWN / STEERING GUIDANCE');
    if(sim.turnBased){
      const t=sim.turn,n=t.navigation,key=sim.maneuvering?t.maneuver:t.draftManeuver;
      text('attack-title','AUTO HELM / '+(B.maneuvers[key]?.name||'AWAITING FLIGHT PLAN').toUpperCase());
      text('attack-turn',!sim.maneuvering?'PLANNING / MOTION PAUSED':n?.avoiding?'AVOIDING K7':t.phase==='withdraw'?'WITHDRAWING FOR REPAIRS':t.phase==='disengage'||n?.retiring?'AUTOMATIC BREAKAWAY':n?.stage==='hiding'?'HOLDING COVER':n?.stage==='position'?'POSITIONING FOR ATTACK':'EXECUTING ATTACK RUN');
      text('attack-pitch',sim.maneuvering?'HELM UNDER PLAN CONTROL':'SELECT MANEUVER AND SHOTS');
      text('attack-solution',sim.maneuvering?sim.status(sim.nextOrder()?.weapon||'phaser'):'COMMIT YOUR FLIGHT PLAN');
      box.style.color='#79cbd7';return;
    }
    if(sim.range>=2000){
      text('attack-turn','YORKTOWN OUT OF RANGE');text('attack-pitch','');text('attack-solution','20 KM LIMIT / CLOSE DISTANCE TO REACQUIRE');box.style.color='#a8b7c5';return;
    }
    if(!sim.contact){
      text('attack-turn','CONTACT LOST');text('attack-pitch','');text('attack-solution','RESTORE SENSORS / ACTIVE SCAN [C]');box.style.color='#a8b7c5';return;
    }
    const breaking=sim.turnBased&&sim.turn.phase==='disengage',aim=breaking?{x:p.x-(e.x-p.x),y:p.y-(e.y-p.y),z:p.z-(e.z-p.z)}:e;
    if(breaking)text('attack-title','BREAKAWAY / STEER AWAY FROM YORKTOWN');
    const yaw=B.delta(p.heading,B.bearing(p,aim)),pitch=B.elevation(p,aim)-p.pitch;
    const horizontal=Math.hypot(e.x-p.x,e.z-p.z);
    const turnNeeded=horizontal>=1&&Math.abs(yaw)>3,pitchNeeded=Math.abs(pitch)>3;
    $('attack-directions').setAttribute('data-turn',turnNeeded?(yaw>0?'right':'left'):'none');
    $('attack-turn-arrow').hidden=!turnNeeded;text('attack-turn-arrow',yaw>0?'\u2192':'\u2190');
    $('attack-pitch-arrow').hidden=!pitchNeeded;text('attack-pitch-arrow',pitch>0?'\u2191':'\u2193');
    text('attack-turn',!turnNeeded?'HEADING ALIGNED':(yaw>0?'RIGHT ':'LEFT ')+Math.round(Math.abs(yaw))+'\u00b0');
    // Pitch arrows show nose direction; flight controls remain inverted.
    text('attack-pitch',!pitchNeeded?'PITCH ALIGNED':(pitch>0?'NOSE UP ':'NOSE DOWN ')+Math.round(Math.abs(pitch))+'\u00b0');
    const solution=sim.lock&&sim.range<=1500;
    box.style.color=solution?'#79f0a3':'#ffad45';
    text('attack-solution',sim.stationTrace(p,e)?'K7 BLOCKING SHOT / MANEUVER AROUND STATION':solution?'PHASER ARC + RANGE / FIRE [F]':sim.range>1500?'CLOSE DISTANCE / '+(sim.range/100).toFixed(1)+' KM':'');
    if(sim.turnBased)text('attack-solution',breaking?'WEAPONS HOLD / FOLLOW BREAKAWAY GUIDANCE':sim.maneuvering?sim.status(sim.nextOrder()?.weapon||'phaser')+' / AUTO SHOT':sim.turn.phase.toUpperCase()+' / SET YOUR ATTACK PLAN');
  }
  function meter(id,value){$(id).style.width=B.clamp(value)+'%';}
  function ui(){
    $('game-shell').classList.toggle('cinema-view',scene?.mode==='cinematic'&&!replayView?.active);
    const standby=!sim.freeFlight&&!sim.result&&!sim.turn.orders&&!$('start').hidden&&!planner?.dialog.open;
    $('launch-card').hidden=!standby;$('battle-screen').classList.toggle('standby',standby);
    $('quick-battle').disabled=!scene;
    $('plan-attack').disabled=!scene;
    for(const level of ['cadet','captain','admiral'])$('difficulty-'+level).setAttribute('aria-pressed',String(sim.difficulty===level));
    text('difficulty-note',({cadet:'Forgiving enemy fire. Learn the ship, find your opening.',captain:'A balanced duel. Outsmart Yorktown and bring your crew home.',admiral:'Punishing enemy fire. Bigger risk, bigger scores.'})[sim.difficulty]);
    text('career-summary',`PERSONAL BEST ${career.best.toLocaleString()} / ${career.wins} WINS`);
    text('launch-objective',sim.challengeDescription);
    $('score-strip').hidden=!!sim.freeFlight;text('score-value',sim.battleStats.score.toLocaleString());text('chain-value',sim.activeChain>1?'CHAIN '+sim.activeChain:'BUILD A CHAIN');text('best-value',career.best.toLocaleString());
    text('battle-objective',sim.player.hull<25?'SURVIVE: repair or withdraw.':sim.enemy.hull<25?'FINISH YORKTOWN — keep your shields facing the threat.':Object.values(sim.enemy.shields).some(value=>value<25)?'BREACH OPEN — strike hull or critical systems.':'BREAK A SHIELD — then strike through the breach.');
    if(scene)scene.engineTrailsEnabled=!planner?.dialog.open;
    text('phaser-key',sim.freeFlight?'R':'');
    attackGuidance();replayView?.refresh();
    const p=sim.player,e=sim.enemy,contact=sim.contact,detail=sim.yorktownTelemetry;
    const t=sim.turn,planning=['planning','review'].includes(t.phase),live=['approach','attack'].includes(t.phase);
    $('game-shell').classList.toggle('auto-helm',sim.turnBased);
    text('auto-flight-plan',planning?'Up to three maneuvers / one turn':`M${t.stageIndex+1} / ${B.maneuvers[t.maneuver]?.name||'Breakaway'}`);
    text('auto-flight-speed',fmt(Math.abs(p.speed)*10)+' M/S'+(p.speed<0?' ASTERN':''));
    const speedSlider=$('enterprise-speed'),speedLabel=fmt(Math.abs(p.speed)*10)+' M/S'+(p.speed<0?' ASTERN':'');
    if(document.activeElement!==speedSlider)speedSlider.value=String(Math.round(p.speed*10));
    speedSlider.disabled=sim.turnBased;speedSlider.setAttribute('aria-valuetext',speedLabel);
    speedSlider.title=sim.turnBased?'Current speed / hold W or S to override; release to resume the plan':'Set speed / astern to ahead';
    text('enterprise-speed-value',speedLabel);
    text('auto-flight-stage',planning?'Select a maneuver in the attack wizard.':'Automatic helm / '+t.phase.toUpperCase()+(p.speedIntent?' / '+p.speedIntent:''));
    text('live-maneuver',planning?'Plan one to three maneuvers':`M${t.stageIndex+1} / ${B.maneuvers[t.maneuver]?.name||'Breakaway'}`);
    for(const field of ['heading','pitch','throttle','level','stop'])$(field).disabled=sim.turnBased;
    for(const id of ['attitude','power-dial']){$(id).setAttribute('aria-disabled',String(sim.turnBased));$(id).tabIndex=sim.turnBased?-1:0;}
    document.querySelectorAll('[data-hold]').forEach(button=>button.disabled=sim.turnBased);
    text('pass-phase',`TURN ${t.number} / ${t.phase.toUpperCase()}`);text('pass-clock',t.phase==='review'?'-':Math.ceil(t.remaining)+'s');
    $('pass-clock').setAttribute('role',t.phase==='review'?'status':'timer');
    text('pass-instruction',({planning:'Choose up to three maneuvers and assign attacks, then Commit.',approach:'Automatic helm is positioning for your attack plan.',attack:'Automatic helm is executing the shot sequence.',withdraw:'Withdrawing. Repair crews prioritize damage when clear of fire.',disengage:'Automatic breakaway. Weapons hold.',review:'Review the complete turn and plan up to three maneuvers.'})[t.phase]);
    text('orders-summary',t.orders?'COMMITTED PLAN / LIVE EXECUTION':'DRAFT / CHOOSE A FLIGHT PLAN');
    text('salvo-state',`PHASERS ${t.spent.player.phaser}/5 ? TORPEDO ${t.spent.player.torpedo}/2 FIRED`);
    $('commit-orders').hidden=!planning;$('commit-orders').disabled=!sim.planReady()||!!sim.result;
    text('commit-orders',t.phase==='review'?'COMMIT NEXT TURN':'COMMIT PLAN');
    $('spatial-guides').hidden=!!sim.freeFlight;
    $('random-turn').disabled=!scene||!sim.turnBased||!!sim.freeFlight||!!sim.result;
    $('random-turn').setAttribute('aria-checked',String(bestGuessEnabled));
    text('best-guess-state',bestGuessEnabled?'ON':'OFF');
    $('open-planner').disabled=!!sim.result||!!sim.freeFlight;
    $('free-flight').hidden=!!sim.freeFlight||sim.running||sim.time>0;
    planner?.refresh();
    $('captain-advice').hidden=!sim.captainEnabled;text('captain-advice',sim.captainEnabled?'ENTERPRISE CAPTAIN / '+sim.captainStatus:'');
    $('damage-review').hidden=t.phase!=='review';
    if(t.report){
      const describe=(r,label,known)=>!known?label+': telemetry unavailable.':label+': hull -'+r.hull.toFixed(1)+'%; '+Object.entries(r.shields).filter(([,v])=>v>.05).map(([k,v])=>k+' shield -'+v.toFixed(0)+'%').concat(Object.entries(r.integrity).filter(([,v])=>v>.05).map(([k,v])=>B.targets[k]+' -'+v.toFixed(1)+'%'),r.reactor>.05?['reactor -'+r.reactor.toFixed(1)+'%']:[]).join(', ');
      text('review-player',describe(t.report[0],'Enterprise',true));text('review-enemy',describe(t.report[1],'Yorktown',detail));
    }
    text('component-state',`BRIDGE ${fmt(p.integrity.bridge)}% / MAIN ENGINES ${fmt(p.integrity.mainEngines)}%`);
    $('pass-panel').hidden=!!sim.result||!!sim.freeFlight;
    $('end-pass').disabled=!sim.turnBased||!!sim.result||planning||!!replayView?.active;
    $('warp').disabled=!sim.running||!sim.maneuvering||!!sim.result||sim.warpUsed;
    text('warp',sim.warpUsed?'WARP CHARGE SPENT':'WARP 30 KM / 1 CHARGE');
    const critical=p.hull>0&&p.hull<25&&!sim.result;
    $('hull-warning').hidden=!critical;$('battle-screen').classList.toggle('hull-critical',critical);
    text('alert-label',sim.freeFlight?'FREE FLIGHT':critical?'CRITICAL HULL':'RED ALERT');
    text('hull-warning-detail',Math.round(p.hull)+'% HULL / REINFORCE SHIELDS OR DISENGAGE');
    text('helm-turn-state',sim.turnBased?'AUTO HELM':Math.abs(p.turnRate)<.05?'MANUAL CONN':'TURN '+(p.turnRate>0?'RIGHT ':'LEFT ')+Math.abs(p.turnRate).toFixed(0)+' DEG/S');
    text('hud-heading',deg(p.heading));text('hud-pitch',signed(p.pitch));text('hud-speed',fmt(Math.abs(p.speed)*10)+(p.speed<0?' ASTERN':' M/S'));
    text('dial-heading',deg(p.heading));text('dial-power',fmt(p.throttle)+'%');text('drive-state',p.throttle===0?'SLOW AHEAD':p.throttle<0?'REVERSE':'IMPULSE');$('power-dial').style.setProperty('--power',Math.abs(p.throttle)*2.8+'deg');
    $('attitude-grid').style.transform=`translateY(${p.pitch*.55}px) rotate(${-p.bank*70}deg)`;$('attitude').setAttribute('aria-valuenow',String(fmt(p.heading)));$('attitude').setAttribute('aria-valuetext',deg(p.heading)+' heading, '+signed(p.pitch)+' pitch');$('power-dial').setAttribute('aria-valuenow',String(fmt(p.throttle)));
    for(const field of ['heading','pitch','throttle']){if(document.activeElement!==$(field))$(field).value=fmt(p[field]);text(field+'-value',field==='heading'?deg(p.heading):field==='pitch'?signed(p.pitch):fmt(p.throttle)+'%');}
    text('target-range',detail?(sim.range/100).toFixed(2)+' KM':'—.— KM');text('target-bearing',detail?deg(B.bearing(p,e))+' / '+signed(B.elevation(p,e)):'— / —');
    text('sensor-state',!detail?'SENSORS DAMAGED':sim.enemyRetreating?'RETREATING':e.hull<25?'CRITICAL':'TRACKING');$('sensor-state').classList.toggle('danger',!detail);
    const enemyPending=t.enemyOrders?.some(order=>order.status==='pending');
    const enemyFiring=t.enemyOrders?.some(order=>order.weapon==='phaser'&&order.firedAt!==undefined&&sim.time<order.firedAt+B.PHASER_DURATION)||sim.projectiles.some(projectile=>projectile.from===e.name);
    const enemyEnded=!!sim.result||sim.turnBased&&(t.phase==='review'||t.phase==='disengage'||!planning&&(!enemyPending&&!enemyFiring||sim.enemyRetreating));
    const enemyPlanState=!detail?'UNKNOWN':sim.freeFlight?'ORBITING K7':enemyEnded?'END TURN':planning&&sim.turnBased?'PLANNING':'EXECUTING PLAN';
    text('yorktown-plan-state',enemyPlanState);$('yorktown-plan-state').setAttribute('data-status',!detail?'unknown':enemyEnded?'ended':enemyPlanState==='EXECUTING PLAN'?'executing':'standby');

    const enemyPlan=t.enemyOrders||[],enemyNext=enemyPlan.findIndex(order=>order.status==='pending');
    $('yorktown-plan-progress').hidden=!detail||sim.freeFlight||!sim.turnBased||!enemyPlan.length;
    text('yorktown-plan-progress','ATTACK '+(enemyNext<0?enemyPlan.length:enemyNext+1)+' OF '+enemyPlan.length);

    $('yorktown-strategy-details').hidden=!yorktownStrategyVisible;
    $('toggle-yorktown-strategy').setAttribute('aria-expanded',String(yorktownStrategyVisible));
    text('toggle-yorktown-strategy',yorktownStrategyVisible?'Hide Strategy':'Show Strategy');
    if(yorktownStrategyVisible){
      const mind=sim.enemyMind,returning=mind.reengageUntil>sim.time;
      const tactic=sim.result?'Engagement complete':sim.freeFlight?'Orbiting K7':planning&&sim.turnBased?'Planning next attack':returning?'Re-engaging / '+(B.maneuvers[mind.returnManeuver]?.name||'Turning back'):sim.enemyRetreating?'Retreating and repairing':sim.turnBased&&!enemyPending?'Breaking away':mind.evadeUntil>sim.time?'Evasive maneuver':e.tactic||'Pursuing Enterprise';
      text('yorktown-strategy-tactic',tactic);
      const orders=$('yorktown-strategy-orders');orders.replaceChildren();
      if(sim.freeFlight||!t.enemyOrders?.length){
        const item=document.createElement('li');item.textContent=sim.freeFlight?'Weapons hold.':sim.turnBased?'Attack plan available after Commit.':'Adaptive fire at Enterprise.';orders.append(item);
      }else{
        const index=enemyNext<0?enemyPlan.length-1:enemyNext,order=enemyPlan[index];
        const item=document.createElement('li'),title=document.createElement('strong'),note=document.createElement('span');
        const status=order.status==='pending'?(!enemyEnded?'NEXT':'PENDING'):(order.status||'pending').toUpperCase();
        title.textContent='Attack '+(index+1)+': '+B.weaponSpecs[order.weapon].name+' -> '+(B.targets[order.target]||order.target);
        note.textContent='Attack '+(index+1)+' / '+(order.range/100).toFixed(1)+' km / '+status;
        item.setAttribute('data-status',status==='NEXT'?'next':order.status);
        item.append(title,note);orders.append(item);
      }
    }

    text('yorktown-damage-hull',detail?fmt(e.hull)+'%':'UNKNOWN');meter('yorktown-damage-hull-bar',detail?e.hull:0);
    for(const key of ['engines','mainEngines','bridge','sensors']){text('yorktown-system-'+key,detail?fmt(e.integrity[key])+'%':'--');$('yorktown-system-'+key).style.color=detail&&e.integrity[key]<30?'var(--red)':'var(--text)';}
    text('yt-reactor',detail?fmt(e.reactor)+' / 100 GW':'UNKNOWN');meter('yt-reactor-bar',detail?e.reactor:0);
    for(const key of B.systems){text('yt-power-'+key,detail?fmt(e.power[key])+'% / '+sim.output(e,key).toFixed(1)+' GW':'UNKNOWN');$('yt-stack-'+key).style.width=detail?e.power[key]+'%':'0%';}
    text('yt-repair',detail?'REPAIR: '+B.targets[e.repair]+' / '+e.repairBudget.toFixed(0)+' parts':'Repair telemetry unavailable');
    text('yt-propulsion',detail?'SPEED '+fmt(Math.abs(e.speed)*10)+' M/S':'Propulsion telemetry unavailable');
    for(const arc of B.arcs){
      text('yt-shield-'+arc,detail?fmt(e.bias[arc])+'%':'UNKNOWN');
      text('yorktown-svg-'+arc,detail?fmt(e.shields[arc])+'%':'--');
      $('yorktown-arc-'+arc).style.stroke=!detail?'#626970':e.shields[arc]<25?'var(--red)':e.shields[arc]<55?'var(--amber)':'var(--cyan)';
    }
    text('yt-generator-integrity',detail?'GENERATOR INTEGRITY '+fmt(e.integrity.shields)+'%':'Generator integrity unknown');
    const enemyMinimum=Math.min(...Object.values(e.shields));
    text('yt-shield-status',!detail?'UNKNOWN':enemyMinimum<25?'BREACH RISK':enemyMinimum<55?'WEAKENED':'NOMINAL');
    text('yt-phasers',detail?sim.status('phaser',e,p):'UNKNOWN');meter('yt-phaser-charge',detail?(1-e.cooldown.phaser/1.65)*100:0);
    text('yt-torpedoes',detail?e.torpedoes+' / 24':'UNKNOWN');text('yt-torpedo-status',detail?sim.status('torpedo',e,p):'Weapons telemetry unavailable');
    text('yt-capacitor',detail?fmt(e.capacitor)+'%':'UNKNOWN');meter('yt-capacitor-bar',detail?e.capacitor:0);
    text('yt-heat',detail?fmt(e.heat)+'%':'UNKNOWN');meter('yt-heat-bar',detail?e.heat:0);
    text('yt-weapons-integrity',detail?'WEAPONS INTEGRITY '+fmt(e.integrity.weapons)+'%':'Weapons integrity unknown');
    text('sensor-note',detail?'Live telemetry / all ranges':'Enterprise sensors damaged / repair to restore stats');
    $('scan').disabled=!sim.running||!sim.maneuvering||sim.result||p.cooldown.scan>0||sim.output(p,'sensors')<3.5||p.capacitor<12;$('scan').firstChild.textContent=p.cooldown.scan>0?'◎ SWEEP '+Math.ceil(p.cooldown.scan)+'s ':'◎ ACTIVE SCAN ';
    for(const a of B.arcs){text('shield-'+a,fmt(p.shields[a])+'%');if(document.activeElement!==$('bias-'+a))$('bias-'+a).value=p.bias[a];$('bias-'+a).setAttribute('aria-valuetext',fmt(p.bias[a])+'% recharge allocation, '+fmt(p.shields[a])+'% shield strength');if($('svg-'+a)){text('svg-'+a,fmt(p.shields[a])+'%');$('arc-'+a).style.stroke=p.shields[a]<25?'var(--red)':p.shields[a]<55?'var(--amber)':'var(--cyan)';}}
    const minimum=Math.min(...Object.values(p.shields));text('shield-status',minimum<25?'BREACH RISK':minimum<55?'WEAKENED':'NOMINAL');$('shield-status').classList.toggle('danger',minimum<25);
    for(const key of B.systems){text('integrity-'+key,fmt(p.integrity[key])+'% intact');$('integrity-'+key).style.color=p.integrity[key]<30?'var(--red)':'var(--muted)';if(document.activeElement!==$('power-'+key))$('power-'+key).value=p.power[key];text('output-'+key,fmt(p.power[key])+'%');$('stack-'+key).style.width=p.power[key]+'%';$('power-'+key).setAttribute('aria-valuetext',fmt(p.power[key])+'% allocated, '+sim.output(p,key).toFixed(1)+' GW effective, '+fmt(p.integrity[key])+'% integrity');$('power-'+key).title=fmt(p.integrity[key])+'% system integrity · '+sim.output(p,key).toFixed(1)+' GW effective';}
    text('reactor-value',fmt(p.reactor)+' / 100 GW');text('reactor-note',p.reactor<50?'CRITICAL':p.reactor<85?'DEGRADED':'STABLE');$('reactor-note').classList.toggle('danger',p.reactor<50);text('hull-value',fmt(p.hull)+'%');meter('hull-bar',p.hull);$('hull-bar').style.background=p.hull<30?'var(--red)':'var(--cyan)';text('repair-stock',p.repairBudget.toFixed(0)+' parts');$('repair-system').disabled=sim.turnBased&&t.phase==='withdraw';if(document.activeElement!==$('repair-system'))$('repair-system').value=p.repair;
    text('capacitor-value',fmt(p.capacitor)+'%');meter('capacitor-bar',p.capacitor);text('heat-value',fmt(p.heat)+'%');meter('heat-bar',p.heat);meter('phaser-charge',(1-p.cooldown.phaser/1.65)*100);
    for(const type of ['phaser','torpedo']){const status=sim.status(type);$(type).disabled=status!=='READY';$(type).title=status;if(type==='phaser')text('phaser-status',status);else text('torpedo-count',p.cooldown.torpedo>0?Math.ceil(p.cooldown.torpedo)+'s RELOAD':p.torpedoes+' / 24');}
    [...$('magazine').children].forEach((i,index)=>i.classList.toggle('empty',index>=Math.ceil(p.torpedoes/2)));
    text('lock-state',sim.lock?'TARGET ACQUIRED':!contact?'NO SENSOR LOCK':'NO FIRING SOLUTION');$('lock-state').style.color=sim.lock?'var(--cyan)':'var(--red)';
    $('pause').innerHTML=(sim.running?'Ⅱ <span>Pause</span>':'▷ <span>Resume</span>');text('sector-label',sim.environment==='nebula'?'MUTARA NEBULA /// SECTOR 04':'OPEN SPACE /// SECTOR 04');
    text('mission-hint',sim.freeFlight?'Free Flight: arrows steer, W/S adjust speed. R fires phasers, T fires torpedoes. F toggles fullscreen. Practice shots cause no damage.':sim.turnBased&&!sim.result?(sim.running?`Turn ${t.number}: ${t.phase}. `+(planning?'Set orders in Weapons.':t.phase==='disengage'?'Automatic breakaway.':t.phase==='withdraw'?'Automatic withdrawal and repairs.':'Automatic helm is flying your plan.'):'Engage or resume to continue the turn clock.'):sim.result?'Engagement complete.':!sim.running&&sim.time>0?'Simulation paused. P to resume.':!sim.running?'Your ship. Your command.':sim.range>=2000?'Yorktown is outside tracking range.':!contact?'Sensor contact lost. Restore your science station.':sim.enemyRetreating?'Yorktown is retreating. Close distance to maintain contact.':!sim.lock?'Yorktown tracked.':'Yorktown closing. Weaken its shields, then strike.');
    if(sim.result&&endingElapsed<B.DESTRUCTION_DURATION+10)$('result').hidden=true;
    if(sim.result&&endingElapsed>=B.DESTRUCTION_DURATION+10&&$('result').hidden){$('result').hidden=false;text('result-kicker',sim.result==='victory'?'TACTICAL OBJECTIVE COMPLETE':'COMMAND SIGNAL LOST');text('result-title',sim.result==='victory'?'Yorktown neutralized.':'Enterprise lost.');text('result-description',`Engagement ${time(sim.time)} · ${sim.shots} weapons fired · Enterprise hull ${fmt(p.hull)}%`);renderDebrief();}
  }
  function radar(){
    const canvas=$('radar'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=w*dpr;canvas.height=h*dpr;}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const x=w/2,y=h/2,r=h*.39;
    c.strokeStyle='#98a3ad';c.lineWidth=.7;for(const k of [.35,.7,1]){c.beginPath();c.ellipse(x,y,r*k*1.65,r*k*.72,0,0,Math.PI*2);c.stroke();}c.setLineDash([2,4]);c.beginPath();c.moveTo(x-r*1.9,y);c.lineTo(x+r*1.9,y);c.moveTo(x,y-r);c.lineTo(x,y+r);c.stroke();c.setLineDash([]);
    c.save();c.translate(x,y);const sweep=sim.time*.7;c.strokeStyle='#7bd3da20';c.beginPath();c.moveTo(0,0);c.lineTo(Math.sin(sweep)*r*1.65,-Math.cos(sweep)*r*.72);c.stroke();c.fillStyle='#7bd3da';c.beginPath();c.moveTo(0,-7);c.lineTo(-4,5);c.lineTo(0,2);c.lineTo(4,5);c.closePath();c.fill();
    if(sim.contact){const p=sim.player,e=sim.enemy,a=(B.bearing(p,e)-p.heading)*Math.PI/180,range=Math.max(1200,sim.range*1.15),q=Math.min(1,sim.range/range),tx=Math.sin(a)*r*1.65*q,ty=-Math.cos(a)*r*.72*q,alt=B.clamp((e.y-p.y)/20,-18,18);c.strokeStyle='#c6776c88';c.beginPath();c.moveTo(tx,ty);c.lineTo(tx,ty-alt);c.stroke();c.strokeStyle='#e9897d';c.strokeRect(tx-4,ty-alt-4,8,8);c.fillStyle='#dc857b';c.font='7px Consolas';c.fillText('YT',tx+8,ty-alt+2);}
    {const p=sim.player,k=sim.station,distance=B.distance(p,k),a=(B.bearing(p,k)-p.heading)*Math.PI/180,scale=Math.max(1200,sim.contact?sim.range*1.15:1200),q=Math.min(1,distance/scale),sx=Math.sin(a)*r*1.65*q,sy=-Math.cos(a)*r*.72*q;
      c.strokeStyle='#e2c88a';c.beginPath();c.moveTo(sx,sy-5);c.lineTo(sx+5,sy);c.lineTo(sx,sy+5);c.lineTo(sx-5,sy);c.closePath();c.stroke();c.fillStyle='#e2c88a';c.font='8px Consolas';c.fillText('K7',sx+8,sy+3);}
    c.restore();c.fillStyle='#dce2e7';c.font='7px Consolas';c.fillText('RELATIVE / 3D',14,h-8);c.textAlign='right';c.fillText(sim.contact?'CONTACT 01':'NO CONTACT',w-14,h-8);c.textAlign='left';
  }
  $('spatial-guides').addEventListener('click',()=>{
    if(!scene)return;scene.spatialEnabled=!scene.spatialEnabled;
    $('spatial-guides').setAttribute('aria-pressed',String(scene.spatialEnabled));
    text('spatial-guides',scene.spatialEnabled?'Grid on':'Grid off');
  });
  function hud(){
    const canvas=$('hud'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=w*dpr;canvas.height=h*dpr;}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
    if(!scene)return;const projection=scene.project(sim.enemy),tag=$('target-tag');tag.hidden=!!sim.freeFlight||!sim.contact||!projection.visible||!!sim.result;
    if(!sim.freeFlight&&sim.contact&&projection.visible&&!sim.result){const x=projection.x*w,y=projection.y*h,s=17;c.strokeStyle=sim.lock?'#e59b80aa':'#d66c65aa';c.lineWidth=1;for(const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){c.beginPath();c.moveTo(x+sx*s,y+sy*(s-6));c.lineTo(x+sx*s,y+sy*s);c.lineTo(x+sx*(s-6),y+sy*s);c.stroke();}tag.style.left=B.clamp(x+26,12,w-160)+'px';tag.style.top=B.clamp(y-25,55,h-150)+'px';text('tag-range',(sim.range/100).toFixed(2)+' KM · '+(sim.lock?'LOCKED':'TRACKING'));}
    if(!sim.freeFlight&&sim.contact&&!projection.visible&&!sim.result){const delta=B.delta(sim.player.heading,B.bearing(sim.player,sim.enemy)),side=delta>=0?1:-1,x=side>0?w-22:22;c.strokeStyle='#e59b80';c.beginPath();c.moveTo(x-side*6,h*.46-7);c.lineTo(x,h*.46);c.lineTo(x-side*6,h*.46+7);c.stroke();c.fillStyle='#e59b80';c.font='8px Consolas';c.textAlign=side>0?'right':'left';c.fillText('YORKTOWN '+Math.abs(Math.round(delta))+'°',x-side*13,h*.46+3);c.textAlign='left';}
    if(scene.spatialEnabled&&!sim.freeFlight&&scene.mode!=='cinematic'&&!sim.result){
      c.font='10px Consolas, monospace';c.fillStyle='#a8dce2';
      c.fillText('3D LEVELS / ZERO = ENTERPRISE ALTITUDE',18,190);
      c.fillText('GRID '+(scene.gridStep/100).toFixed(1)+(sim.freeFlight?' KM / K7 REFERENCE':' KM  /  CYAN: YOU  /  CORAL: YORKTOWN'),18,206);
      c.fillStyle='#92bfd6';
      for(const level of scene.levelLabels||[]){const at=scene.project(level);if(at.visible)c.fillText(level.text,at.x*w+6,at.y*h-5);}
      if(sim.contact){
        const p=sim.player,e=sim.enemy,mid=scene.project({x:(p.x+e.x)/2,y:(p.y+e.y)/2,z:(p.z+e.z)/2});
        const dy=(e.y-p.y)/100,label=(sim.range/100).toFixed(2)+' KM / YORKTOWN '+Math.abs(dy).toFixed(2)+' KM '+(dy<0?'BELOW':'ABOVE')+' / '+scene.targetGuideState;
        const x=mid.visible?B.clamp(mid.x*w,18,Math.max(18,w-c.measureText(label).width-18)):18;
        const y=mid.visible?B.clamp(mid.y*h-14,230,h-130):230;
        c.shadowColor='#02060b';c.shadowBlur=5;
        c.fillStyle=scene.targetGuideColor||'#edb69d';c.fillText(label,x,y);c.shadowBlur=0;
      }
    }
    if(!sim.result){
    }
    if(scene.mode==='forward'){c.strokeStyle='#7bd3da66';const x=w/2,y=h/2;c.beginPath();c.arc(x,y,24,0,Math.PI*2);c.moveTo(x-40,y);c.lineTo(x-12,y);c.moveTo(x+12,y);c.lineTo(x+40,y);c.moveTo(x,y-40);c.lineTo(x,y-12);c.moveTo(x,y+12);c.lineTo(x,y+40);c.stroke();}
  }
  function eventSound(event,rate=1){
    if(!audioOn)return;
    if(event.type==='beam')weaponAudio?.playPhaser((event.duration||B.PHASER_DURATION)/Math.max(.4,rate));
    if(event.type==='launch')weaponAudio?.playTorpedo();
    if(event.type==='impact'||event.type==='station-impact')weaponAudio?.playHit();
    if(event.type==='ship-collision'||event.type==='station-collision')weaponAudio?.playBreak();
    if(event.type==='destroyed'&&event.selfDestruct)weaponAudio?.playExplosion();
  }
  function events(){for(const event of sim.events.splice(0)){scene?.event(event);eventSound(event);if(event.scorePoints){showCombatCallout(event.shieldBroken?'SHIELD BREACHED':event.hullDamage>0?'HULL HIT':'DIRECT HIT','+'+event.scorePoints+' POINTS'+(event.chain>1?' / CHAIN '+event.chain:''),event.shieldBroken?'breach':'hit');}if(event.type==='impact'&&event.ship==='Enterprise'){$('hit-flash').style.opacity=.45;setTimeout(()=>$('hit-flash').style.opacity=0,220);}if(event.type==='destroyed'&&!event.selfDestruct)tone(90,1.8,'sawtooth',.07,20);}}
  function updateEngineHum(state=sim,playing=state.running){
    for(const [ship,audio] of [[state.player,engineAudio],[state.enemy,yorktownEngineAudio]]){
      if(!audio)continue;
      const maximum=125*B.clamp(state.output(ship,'engines')/24,.12,1.6)*1.5;
      audio.update({speed:ship.speed,maximum,active:audioOn&&!!playing&&!state.result&&ship.hull>0&&(state.freeFlight||state.maneuvering)});
    }
  }
  function frame(now){
    const dt=Math.min((now-lastFrame)/1000,.06);lastFrame=now;if(now>calloutUntil)$('combat-callout').hidden=true;
    if(replayView?.active){replayView.tick(dt);updateEngineHum(replayView.player.state,!replayView.player.paused&&!replayView.player.ended);requestAnimationFrame(frame);return;}
    if(sim.running){sim.tick(dt,keys);if(held.has('phaser')&&sim.status('phaser')==='READY')sim.fire('phaser');}
    if(sim.running&&bestGuessEnabled&&sim.turn.phase==='review'&&canBestGuessTurn())bestGuessTurn();
    updateEngineHum();events();if(!sim.running&&!sim.result)weaponAudio?.stopAll();
    let sceneDt=sim.running?dt:0;
    if(sim.result){if(!endingStarted){endingStarted=true;endingElapsed=0;}sceneDt=Math.min(dt,Math.max(0,B.DESTRUCTION_DURATION-endingElapsed));endingElapsed+=dt;}
    scene?.update(sceneDt,!sim.running&&!sim.result);hud();radar();
    if(now-lastUI>100){ui();lastUI=now;}requestAnimationFrame(frame);
  }
  ui();requestAnimationFrame(frame);
})();
