const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const B=require('../engine.js');
const Replay=require('../replay.js');
const root=path.join(__dirname,'..');

// Exercise actual control bindings without requiring a graphics driver.
function interfaceHarness(options={}){
  const elements={},handlers={},timers=new Map();let frame,timerId=0;
  const drawing=new Proxy({}, {get:(obj,key)=>obj[key]??(()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.handlers={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.attrs={};this.value='';this.hidden=false;this.open=false;this.clientWidth=800;this.clientHeight=440;this.firstChild={textContent:''};}
    set innerHTML(html){this.html=html;this.children=[];for(const m of html.matchAll(/<(\w+)[^>]*id="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);elements[m[2]]=e;this.children.push(e);}}
    get innerHTML(){return this.html;}
    set textContent(text){this.text=String(text);}
    get textContent(){return this.text||'';}
    querySelector(tag){return this.children.find(c=>c.tagName===tag.toUpperCase());}
    append(...children){this.children.push(...children);for(const child of children)if(child.id)elements[child.id]=child;}
    prepend(...children){this.children.unshift(...children);}
    getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
    replaceChildren(...children){this.children=children;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    setAttribute(name,value){this.attrs[name]=value;}
    getContext(){return drawing;}
    setPointerCapture(){}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g))elements[m[2]]=new Element(m[1]);
  elements.environment.value='nebula';elements['repair-system'].value='sensors';
  const document={getElementById:id=>elements[id]||null,createElement:tag=>new Element(tag),querySelectorAll:()=>[],addEventListener:(event,fn)=>handlers['document:'+event]=fn,activeElement:null};
  class Scene{constructor(host,sim){this.sim=sim;this.mode='chase';this.recordedEvents=[];}event(event){this.recordedEvents.push(event);}update(dt){this.lastDt=dt;}reset(){}setCamera(mode){this.mode=mode;}project(){return{x:.7,y:.3,visible:true};}}
  const TestBattle={...B,Simulation:class extends B.Simulation{constructor(seed,settings){super(97,{...settings,randomStart:options.randomStart??false});}}};
  const context={Battle:TestBattle,BattleReplay:Replay,BattleScene:Scene,window:{},document,console,performance:{now:()=>0},devicePixelRatio:1,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>handlers[name]=fn,requestAnimationFrame:fn=>frame=fn};
  context.window.addEventListener=context.addEventListener;
  Object.assign(context.window,options.window||{});
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'target-diagram.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'planner.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'replay-view.js'),'utf8'),context);for(const file of ['bridge-dialogue.js','assets/voices/voice-clips.js','bridge-voices.js','bridge-warnings.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);if(options.narration)vm.runInContext(fs.readFileSync(path.join(root,'captain-narration.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
  context.window.battle.turnBased=options.turnBased??false;
  if(options.voiceClips)context.window.BattleVoiceClips=options.voiceClips;
  const key=(key,code='')=>({key,code,preventDefault(){},target:{tagName:'BODY'},repeat:false});
  return {sim:context.window.battle,scene:context.window.battleScene,replay:context.window.battleReplay,elements,handlers,document,runTimers:()=>{const callbacks=[...timers.values()];timers.clear();for(const fn of callbacks)fn();},step:ms=>frame(ms),key};
}


function renderedHarness(players,options={}){
  const manifest={window:{BattleVoiceClips:{}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;if(url==='assets/IntroMusic.mp3')options.introMusicPlayers?.push(this);else players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  return interfaceHarness({...options,voiceClips:manifest.window.BattleVoiceClips,window:{...options.window,Audio,speechSynthesis:{speak(){assert.fail('must not synthesize');}}}});
}

test('Yorktown personality dropdown shows the rolled personality and allows manual selection',()=>{
  const h=interfaceHarness({turnBased:true}),e=h.elements,s=h.sim;
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const selector=html.match(/<select id="yorktown-personality"[^>]*>(.*?)<\/select>/)[1];
  assert(!selector.includes('value="random"'));assert.equal((selector.match(/<option /g)||[]).length,4);
  assert.equal(e['yorktown-personality'].value,s.enemyPersonality);
  for(const choice of ['cautious','hunter','aggressive','flanker']){
    e['yorktown-personality'].onchange({target:{value:choice}});
    assert.equal(s.enemyPersonality,choice);assert.equal(e['yorktown-personality'].value,choice);
  }
  e['quick-battle'].onclick();e['yorktown-personality'].onchange({target:{value:'cautious'}});
  assert.equal(s.enemyPersonality,'cautious');
  e['quick-rematch'].onclick();assert.equal(e['yorktown-personality'].value,s.enemyPersonality);
});

test('Declan welcome yields to one fight opening before normal bridge dialogue without holding battle',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true,narration:true});h.sim.tick=()=>{};
  assert.equal(players[0].url,'assets/Welcome introduction_short_Declan.mp3');
  h.elements['quick-battle'].onclick();assert.equal(players[0].paused,true);assert.equal(h.sim.running,true);
  h.step(60);const opening=players.at(-1);assert.match(opening.url,/Yorktown's closing.*_Declan\.mp3$/);
  assert.equal(h.elements['captain-dialogue'].hidden,false);assert.equal(h.elements['helm-reply'].textContent,'');
  const count=players.length;h.step(3060);assert.equal(players.length,count,'normal dialogue cannot overlap the opening');
  opening.onended();h.step(3120);assert.equal(players.at(-1).url,'assets/Come to port_Declan.mp3');
  players.at(-1).onended();h.runTimers();players.at(-1).onended();
  h.sim.finishPass();h.elements['quick-battle'].onclick();h.step(3180);
  assert.equal(players.filter(audio=>/Yorktown's closing/.test(audio.url)).length,1,'later turns do not repeat the opening');
  h.elements['quick-rematch'].onclick();h.step(3240);
  assert.equal(players.filter(audio=>/Yorktown's closing/.test(audio.url)).length,2,'a new fight gets a new opening');
});

test('welcome narration survives idle UI refreshes and can be replayed explicitly',async()=>{
  const players=[],h=renderedHarness(players,{turnBased:true,narration:true});
  await new Promise(setImmediate);const intro=players[0];assert.equal(intro.paused,undefined);
  for(let i=1;i<=30;i++)h.step(i*120);
  assert.notEqual(intro.paused,true,'standby UI refresh must not stop the welcome narration');
  assert.equal(players.length,1,'refreshes do not create duplicate introductions');
  h.handlers.keydown({...h.key('Enter','Enter'),target:{id:'play-welcome-intro',tagName:'BUTTON'}});
  assert.equal(h.sim.running,false,'keyboard activation of the introduction must not start combat');
  h.elements['play-welcome-intro'].onclick();assert.equal(intro.paused,true);
  assert.equal(players.length,2);assert.equal(players[1].url,'assets/Welcome introduction_short_Declan.mp3');
  await new Promise(setImmediate);h.step(3720);assert.notEqual(players[1].paused,true);
  h.elements['quick-battle'].onclick();assert.equal(players[1].paused,true,'leaving welcome still stops narration');
});

test('welcome IntroMusic plays at sixty percent, survives refresh and voice mute, and stops for combat',async()=>{
  const players=[],introMusicPlayers=[],h=renderedHarness(players,{turnBased:true,narration:true,introMusicPlayers});h.sim.tick=()=>{};
  assert.equal(players[0].url,'assets/Welcome introduction_short_Declan.mp3');
  const music=introMusicPlayers[0];assert.equal(music.url,'assets/IntroMusic.mp3');assert.equal(music.volume,.6);
  await new Promise(setImmediate);h.step(120);h.step(240);assert.notEqual(music.paused,true);
  h.elements['voices-mute'].onclick();h.step(360);assert.notEqual(music.paused,true);
  h.elements['quick-battle'].onclick();assert.equal(music.paused,true);
});

test('ColdOpen continues through welcome refreshes and voice mute, then stops for the fight',async()=>{
  const players=[],h=renderedHarness(players,{turnBased:true,narration:true});h.sim.tick=()=>{};
  await new Promise(setImmediate);players[0].onended();await new Promise(setImmediate);
  const music=players[1];assert.equal(music.url,'assets/ColdOpenHit.mp3');
  for(let i=1;i<=10;i++)h.step(i*120);assert.notEqual(music.paused,true);
  h.elements['voices-mute'].onclick();h.step(1320);assert.notEqual(music.paused,true);
  h.elements['quick-battle'].onclick();assert.equal(music.paused,true);
});

test('Declan farewell follows Helm lost without overlap and suppresses other post-defeat dialogue',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true,narration:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(60);const opening=players.at(-1);
  for(const arc of B.arcs)h.sim.player.shields[arc]=0;h.sim.player.hull=1;
  h.sim.damage(h.sim.player,h.sim.enemy,999,'torpedo','hull');h.step(120);
  assert.equal(opening.paused,true);const lost=players.at(-1);assert.equal(lost.url,'assets/Helm lost!_Erica.mp3');
  const count=players.length;h.step(180);assert.equal(players.length,count);
  lost.onended();h.step(240);assert.equal(players.length,count);h.step(1679);assert.equal(players.length,count,'farewell waits 1.5 seconds after Helm lost ends');
  h.step(1680);const farewell=players.at(-1);
  assert(['assets/I gave my best_Declan.mp3','assets/We gave it our all_Declan.mp3'].includes(farewell.url));
  assert.match(h.elements['helm-order'].textContent,/^(I gave my best|We gave it our all)/);
  assert.equal(h.elements['helm-reply'].textContent,'');
  assert(h.sim.lastReplay.events.some(({event})=>event.type==='bridge-dialogue'&&/^(I gave my best|We gave it our all)/.test(event.order)));
  farewell.onended();h.sim.events.push({type:'warp'},{type:'destroyed',ship:'Yorktown'});h.step(1740);
  assert.equal(players.at(-1),farewell,'other queued or later reports stay silent after the farewell');
});

test('replay also pauses 1.5 seconds between Helm lost and Declan final statement',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true,narration:true});
  h.replay.active=true;h.replay.player={paused:false,ended:false,state:h.sim};h.replay.tick=()=>{};
  h.replay.options.dialogue({order:'',reply:'Helm lost!'});
  h.replay.options.dialogue({order:'I gave my best...',reply:''});
  h.step(100);const lost=players.at(-1);assert.equal(lost.url,'assets/Helm lost!_Erica.mp3');
  const count=players.length;lost.onended();h.step(1599);assert.equal(players.length,count);
  h.step(1600);assert.equal(players.at(-1).url,'assets/I gave my best_Declan.mp3');
});

test('muting voices suppresses welcome and fight narration without queuing an opening for later turns',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true,narration:true});h.sim.tick=()=>{};
  h.elements['voices-mute'].onclick();assert.equal(players[0].paused,true);
  h.elements['quick-battle'].onclick();h.step(60);h.step(3060);
  assert.equal(players.length,1);h.elements['voices-mute'].onclick();h.sim.finishPass();h.elements['quick-battle'].onclick();h.step(3120);
  assert(!players.some(audio=>/Yorktown's closing/.test(audio.url)));
});

test('a long Declan fight opening does not hold weapons after the initial three seconds',async()=>{
  const players=[];
  class AudioContext{constructor(){this.state='running';}resume(){return Promise.resolve();}}
  class WeaponAudio{setEnabled(){}stopAll(){}}
  class FiringVoices{prepare(){assert.fail('opening narration must not gate a shot');}}
  const h=renderedHarness(players,{turnBased:true,narration:true,window:{AudioContext,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:FiringVoices}});
  h.sim.tick=()=>{};h.handlers['document:pointerdown']();await new Promise(setImmediate);
  h.elements['quick-battle'].onclick();h.step(60);h.step(4000);
  assert.match(players.at(-1).url,/Yorktown's closing/);assert.equal(h.sim.beforePlayerFire('phaser',true),true);
});

test('difficult commands use Allison recordings while ordinary orders keep their normal acknowledgments',()=>{
  for(const problem of ['healthy','engines','weapons','sensors','empty-magazine','no-parts']){
    const players=[],h=renderedHarness(players,{turnBased:true}),s=h.sim;s.tick=()=>{};s.running=true;
    if(problem==='no-parts'){s.player.repairBudget=0;s.selectManeuver('flee');}
    else{
      s.applyPlanPreset('strong');
      if(['engines','weapons','sensors'].includes(problem))s.player.integrity[problem]=0;
      if(problem==='empty-magazine'){
        s.player.torpedoes=0;
        for(let i=0;i<3;i++)s.updateStep(i,{weapon:'torpedo',target:'engines',range:650,maneuvers:[0,1,2]});
      }
    }
    assert(s.commitOrders());h.step(60);
    assert.equal(h.elements['helm-reply'].textContent,problem==='healthy'?'Coming to port.':"I'll do what I can...",problem);
    players.at(-1).onended();h.runTimers();
    assert.equal(players.at(-1).url,problem==='healthy'?'assets/Coming to port_Allison.mp3':"assets/I'll do what I can_Allision.mp3",problem);
    assert.equal(players.at(-1).volume,.85);players.at(-1).onended();
    if(problem==='weapons'){
      h.step(120);assert.equal(players.at(-1).url,'assets/Weapons are offline.mp3');players.at(-1).onended();
      s.startStage(1);h.step(180);
      assert.equal(h.elements['helm-reply'].textContent,"I'll try...");
      assert.equal(h.elements['helm-speaker'].textContent,'HELM (Allison)');
      players.at(-1).onended();h.runTimers();assert.equal(players.at(-1).url,"assets/I'll try_Allision.mp3");
      assert(s.turn.orders.every(order=>order.status==='pending'),'a cautious reply does not cancel or execute the orders');
      players.at(-1).onended();s.startStage(2);h.step(240);
      assert.equal(h.elements['helm-reply'].textContent,"That might be hard... I'll try...");
      players.at(-1).onended();h.runTimers();assert.equal(players.at(-1).url,'assets/That might be hard_Allision.mp3');
      players.at(-1).onended();h.runTimers();assert.equal(players.at(-1).url,"assets/I'll try_Allision.mp3");
      const replies=s.replayRecording.record.events.filter(({event})=>event.type==='bridge-dialogue').map(({event})=>event.reply).filter(Boolean);
      assert.deepEqual(Array.from(replies.slice(-2)),['That might be hard...',"I'll try..."],'replays keep both recordings in order');
    }
  }
});

test('Helm labels identify Allison and Erica as recorded responses change',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);
  assert.equal(h.elements['helm-speaker'].textContent,'HELM (Allison)');
  assert.equal(h.elements['helm-speaker'].attrs['data-voice'],'allison');
  players.at(-1).onended();h.runTimers();players.at(-1).onended();
  h.sim.events.push({type:'warp'});h.step(3200);
  assert.equal(h.elements['helm-speaker'].textContent,'HELM (Erica)');
  assert.equal(h.elements['helm-speaker'].attrs['data-voice'],'erica');
  players.at(-1).onended();
  h.sim.events.push({type:'torpedo-missed',from:'Enterprise',target:'Yorktown'});h.step(3260);
  assert.equal(h.elements['helm-speaker'].textContent,'HELM (Allison)');
  assert.equal(h.elements['helm-reply'].textContent,'We missed!');
});

test('Quick Battle offers difficulty, starts a complete plan, and Quick Rematch preserves difficulty',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});assert.equal(e['launch-card'].hidden,false);
  e['difficulty-admiral'].onclick();assert.equal(sim.difficulty,'admiral');assert.equal(e['difficulty-admiral'].attrs['aria-pressed'],'true');
  e['quick-battle'].onclick();assert(sim.running);assert(sim.maneuvering);assert.equal(e['plan-wizard'].open,false);assert.equal(e['launch-card'].hidden,true);assert.deepEqual(Array.from(sim.turn.maneuvers),['port','distance','chase']);
  e['quick-rematch'].onclick();assert.equal(sim.difficulty,'admiral');assert(sim.maneuvering);assert.equal(sim.battleStats.score,0);
});

test('phaser disruption shows a countdown and a successful torpedo combo gets a distinct callout',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});e['quick-battle'].onclick();
  sim.damage(sim.enemy,sim.player,1,'phaser','weapons');sim.damage(sim.enemy,sim.player,1,'phaser','weapons');
  step(180);assert.equal(e['callout-title'].textContent,'SHIELD DISRUPTED');assert.match(e['salvo-state'].textContent,/DISRUPTED [1-6]s/);
  sim.damage(sim.enemy,sim.player,20,'torpedo','weapons',{component:'weapons'});
  step(360);assert.equal(e['callout-title'].textContent,'TORPEDO COMBO');assert.match(e['callout-detail'].textContent,/SYSTEM DAMAGE \+50%/);
  assert(!e['salvo-state'].textContent.includes('DISRUPTED'));
});

test('combat feedback and debrief report real results and save a personal best once',()=>{
  const saved={};const h=interfaceHarness({turnBased:true,window:{localStorage:{getItem:()=>null,setItem:(key,value)=>{saved[key]=value;}}}}),{sim,elements:e,step}=h;
  e['quick-battle'].onclick();sim.shots=1;sim.enemy.shields[B.facing(sim.enemy,sim.player)]=1;sim.damage(sim.enemy,sim.player,10,'phaser','hull');step(60);
  assert.equal(e['combat-callout'].hidden,false);assert.equal(e['callout-title'].textContent,'SHIELD BREACHED');assert(sim.battleStats.score>0);
  for(const sector of B.arcs)sim.enemy.shields[sector]=0;sim.enemy.hull=1;sim.damage(sim.enemy,sim.player,100,'torpedo','hull');
  for(let i=2;i<=270;i++)step(i*60);assert.equal(e.result.hidden,false);assert.equal(e['result-score'].textContent,sim.battleStats.score.toLocaleString());
  const career=JSON.parse(saved['st-battle-career']);assert.equal(career.wins,1);assert.equal(career.played,1);assert.equal(career.best,sim.battleStats.score);
  step(16400);assert.equal(JSON.parse(saved['st-battle-career']).played,1);assert(e['result-grade'].textContent);
});

test('blocked local storage does not prevent quick play or debrief',()=>{
  const h=interfaceHarness({turnBased:true,window:{localStorage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}}});
  h.elements['quick-battle'].onclick();h.sim.selfDestruct();for(let i=1;i<=270;i++)h.step(i*60);assert.equal(h.elements.result.hidden,false);
});

test('Quick settings fill complete editable drafts at the top of the planner',()=>{
  const routes={timid:['distance','hide','flee'],disabling:['port','close','behind'],strong:['port','distance','chase'],aggressive:['direct','close','chase'],berserk:['direct','close','ram']};
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.indexOf('id="preset-timid"')<html.indexOf('id="preset-disabling"'));assert(html.indexOf('id="preset-disabling"')<html.indexOf('id="preset-strong"'));assert(html.indexOf('id="preset-strong"')<html.indexOf('<nav class="wizard-steps"'));
  for(const style of Object.keys(routes)){
    const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
    const original=JSON.stringify(sim.turn.draft);e['preset-'+style].onclick();
    assert.equal(e['preset-'+style].attrs['aria-pressed'],'true');assert.equal(e['wizard-commit'].disabled,false);assert.equal(e['plan-wizard'].open,true);
    assert.equal(JSON.stringify(sim.turn.draft),original,'a preset changes only the draft editor');
    e['wizard-commit'].onclick();assert.equal(e['plan-wizard'].open,false);assert.deepEqual(Array.from(sim.turn.maneuvers),routes[style]);
    assert.equal(sim.turn.orders.filter(order=>order.weapon==='phaser').length,2);assert.equal(sim.turn.orders.filter(order=>order.weapon==='torpedo').length,1);
    assert(sim.turn.orders.every(order=>order.maneuvers.every(i=>sim.turn.maneuvers[i]!=='flee')));
    e['open-planner'].onclick();for(const key of Object.keys(routes))assert.equal(e['preset-'+key].disabled,false,'quick settings stay available during live plan editing');
  }
});

test('preset plans can be customized or cancelled without changing live orders',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
  const before=JSON.stringify(sim.turn);e['preset-timid'].onclick();e['wizard-cancel'].onclick();assert.equal(JSON.stringify(sim.turn),before);
  e['open-planner'].onclick();e['preset-strong'].onclick();e['plan-step-0'].onclick();e['target-bridge'].onclick();
  assert.equal(e['preset-strong'].attrs['aria-pressed'],'false','custom changes clear the preset highlight');
  assert.equal(e['wizard-commit'].disabled,false);e['wizard-commit'].onclick();assert.equal(sim.turn.orders[0].target,'bridge');
});

test('live quick settings remain transactional and respect the revision budget',()=>{
  for(const style of ['timid','disabling','strong','aggressive','berserk']){
    const {sim,elements:e}=interfaceHarness({turnBased:true});e['quick-battle'].onclick();e['open-planner'].onclick();
    const before=JSON.stringify(sim.turn),budget=sim.turn.revisions;
    e['preset-'+style].onclick();assert.equal(JSON.stringify(sim.turn),before);
    assert.match(e['wizard-error'].textContent,/staged within.*revision budget/);assert.equal(e['wizard-apply'].disabled,false);
    e['wizard-cancel'].onclick();assert.equal(JSON.stringify(sim.turn),before);
    e['open-planner'].onclick();e['preset-'+style].onclick();e['wizard-apply'].onclick();
    assert.equal(e['plan-wizard'].open,false);assert(sim.turn.revisions>=0);assert(sim.turn.revisions<=budget);
    if(style!=='strong')assert.equal(sim.turn.revisions,0,'a different preset uses the two available edits');
    if(!sim.turn.revisions){e['open-planner'].onclick();for(const key of ['timid','disabling','strong','aggressive','berserk'])assert.equal(e['preset-'+key].disabled,true);}
  }
});

test('live quick settings preserve completed maneuvers and fired attacks',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e['quick-battle'].onclick();
  sim.turn.orders[0].status='hit';sim.turn.orders[0].firedAt=sim.time;sim.turn.maneuverStatus[0]='complete';sim.startStage(1);
  const fired=JSON.stringify(sim.turn.orders[0]),first=sim.turn.maneuvers[0];
  e['open-planner'].onclick();e['preset-berserk'].onclick();e['wizard-apply'].onclick();
  assert.equal(e['plan-wizard'].open,false);assert.equal(sim.turn.maneuvers[0],first);assert.equal(JSON.stringify(sim.turn.orders[0]),fired);
  assert.equal(sim.turn.maneuvers[1],'close');assert.equal(sim.turn.revisions,0);
});

test('double-click toggles playfield fullscreen, ignores controls, and Escape exits without pausing',async()=>{
  const h=interfaceHarness(),field=h.elements['battle-screen'];let requests=0,exits=0;
  field.requestFullscreen=async()=>{requests++;h.document.fullscreenElement=field;};
  h.document.exitFullscreen=async()=>{exits++;h.document.fullscreenElement=null;};
  const event={target:{closest:()=>null},preventDefault(){}};
  h.sim.running=true;await field.handlers.dblclick(event);assert.equal(requests,1);assert.equal(h.document.fullscreenElement,field);
  h.handlers.keydown(h.key('Escape'));assert.equal(h.sim.running,true,'Escape is left to the browser while fullscreen');
  await field.handlers.dblclick({...event,target:{closest:()=>({tagName:'BUTTON'})}});assert.equal(exits,0);
  await field.handlers.dblclick(event);assert.equal(exits,1);assert.equal(h.document.fullscreenElement,null);
  field.requestFullscreen=async()=>{throw new Error('denied');};await field.handlers.dblclick(event);assert.match(h.elements.toast.textContent,/Fullscreen could not start/);
});
test('Best Guess toggles on beside Commit and stays available during execution',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert(html.indexOf('id="commit-orders"')<html.indexOf('id="random-turn"'));
  assert(!html.includes('id="random-continue"'));
  assert.match(html, /id="random-turn"[^>]*role="switch"[^>]*aria-checked="false"/);
  assert.match(html,/>Best Guess<\/span>/);assert(!html.includes('Best Guess Continue'));
  const {sim,elements:e}=interfaceHarness({turnBased:true});assert.equal(e['random-turn'].disabled,false);
  e['random-turn'].onclick();assert.equal(sim.running,true);assert.equal(sim.maneuvering,true);assert.equal(e['plan-wizard'].open,false);assert.equal(e['random-turn'].disabled,false);
  assert.equal(e['random-turn'].attrs['aria-checked'],'true');
  assert.equal(sim.captainEnabled,true);
  if(sim.turn.maneuver!=='flee'){
    assert.equal(sim.turn.orders.filter(shot=>shot.weapon==='phaser').length,2);assert.equal(sim.turn.orders.filter(shot=>shot.weapon==='torpedo').length,1);
  }
});

test('Best Guess continues across turns and toggling off finishes only the current turn',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});
  e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'true');assert.equal(sim.maneuvering,true);
  const first=JSON.stringify(sim.turn.draft);sim.finishPass();step(60);
  assert.equal(sim.turn.number,2);assert.equal(sim.maneuvering,true);assert(sim.planReady());assert.equal(sim.captainEnabled,true);
  e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'false');assert.equal(sim.maneuvering,true,'toggling off does not cancel the current turn');
  sim.finishPass();step(120);assert.equal(sim.turn.phase,'review');assert.equal(sim.turn.number,2);
  assert.equal(e['commit-orders'].textContent,'COMMIT NEXT TURN');assert.equal(e['random-turn'].disabled,false);
});

test('random continuation honors pause, dialogs, the end of combat, and reset',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});
  e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'true');
  e.pause.onclick();sim.finishPass();step(60);assert.equal(sim.turn.number,1);assert.equal(sim.running,false);
  e.pause.onclick();e.help.onclick();step(120);assert.equal(sim.turn.number,1,'briefing holds continuation');
  e['close-help'].onclick();step(180);assert.equal(sim.turn.number,2);
  sim.finishPass();e['replay-last-pass'].onclick();step(240);assert.equal(sim.turn.number,2,'replay never commits a live random turn');
  e['replay-close'].onclick();sim.result='victory';sim.running=false;step(360);assert.equal(sim.turn.number,2);assert.equal(e['random-turn'].disabled,true);
  e.rematch.onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'true');
  e['random-turn'].onclick();assert.equal(e['random-turn'].attrs['aria-checked'],'false');
  assert.equal(e['best-guess-state'].textContent,'OFF');
});

test('live play and replays route weapon hits and physical collisions to the new audio cues',async()=>{
  const cues=[];
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}playHit(){cues.push('hit');}playBreak(){cues.push('break');}playEnd(){cues.push('end');}}
  const h=interfaceHarness({window:{AudioContext,BattleWeaponAudio:WeaponAudio}});h.handlers['document:pointerdown']();await Promise.resolve();
  const events=[{type:'impact',ship:'Yorktown'},{type:'ship-collision',ship:'Enterprise'},{type:'station-collision',ship:'Yorktown'},{type:'station-impact'},{type:'destroyed',ship:'Enterprise',selfDestruct:true},{type:'destroyed',ship:'Yorktown'}];
  h.sim.events=events.slice();h.step(60);assert.deepEqual(cues,['hit','break','break','hit','end','end']);
  for(const event of events)h.replay.options.sound(event,1);assert.deepEqual(cues,['hit','break','break','hit','end','end','hit','break','break','hit','end','end']);
  await h.elements.audio.onclick();h.replay.options.sound(events[4],1);assert.equal(cues.length,12,'mute suppresses replay self-destruct audio');
});

test('D self-destructs Enterprise in Free Flight without steering, and ignores repeats and modified shortcuts',()=>{
  const {sim,scene,handlers,key,step,elements:e}=interfaceHarness();e['launch-practice'].onclick();const heading=sim.player.heading;
  const repeated=key('d','KeyD');repeated.repeat=true;handlers.keydown(repeated);assert.equal(sim.result,null);
  const modified=key('d','KeyD');modified.ctrlKey=true;handlers.keydown(modified);assert.equal(sim.result,null);
  e.pause.onclick();handlers.keydown(key('d','KeyD'));assert.equal(sim.result,null);e.pause.onclick();
  handlers.keydown(key('d','KeyD'));assert.equal(sim.result,'defeat');assert.equal(sim.player.hull,0);assert.equal(sim.player.heading,heading);
  step(60);assert(scene.recordedEvents.some(event=>event.type==='destroyed'&&event.ship==='Enterprise'));assert(scene.lastDt>0);assert.equal(e.result.hidden,true);
  handlers.keydown(key('d','KeyD'));assert.equal(scene.recordedEvents.filter(event=>event.type==='destroyed').length,1);
});

test('F toggles fullscreen in every camera without firing, and ignores key repeats',async()=>{
  const h=interfaceHarness(),field=h.elements['battle-screen'];let requests=0,exits=0;
  field.requestFullscreen=async()=>{requests++;h.document.fullscreenElement=field;};
  h.document.exitFullscreen=async()=>{exits++;h.document.fullscreenElement=null;};
  for(const mode of ['chase','tactical','forward','cinematic']){
    h.scene.mode=mode;const shots=h.sim.shots;
    h.handlers.keydown(h.key('f'));await Promise.resolve();assert.equal(h.document.fullscreenElement,field);
    const repeat=h.key('f');repeat.repeat=true;h.handlers.keydown(repeat);assert.equal(h.document.fullscreenElement,field);
    h.handlers.keydown(h.key('f'));await Promise.resolve();assert.equal(h.document.fullscreenElement,null);
    assert.equal(h.sim.shots,shots);
  }
  assert.equal(requests,4);assert.equal(exits,4);
});

test('R fires practice phasers only in Free Flight and release stops held fire',()=>{
  const h=interfaceHarness(),{sim,elements,handlers,key}=h;
  handlers.keydown(key('r'));assert.equal(sim.shots,0);
  elements['launch-practice'].onclick();assert(sim.freeFlight);
  handlers.keydown(key('r'));assert.equal(sim.shots,1);
  handlers.keyup(key('r'));sim.player.cooldown.phaser=0;h.step(60);assert.equal(sim.shots,1);
  assert.equal(elements['phaser-key'].textContent,'R');
});

test('planner accepts three phasers or three torpedoes and shows resource costs',()=>{
 for(const weapon of ['phaser','torpedo']){
 const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
 for(let i=0;i<3;i++){e['plan-step-'+i].onclick();pickWeapon(e,weapon);e['target-hull'].onclick();}
 assert.equal(e['wizard-commit'].disabled,false);assert.match(e['weapon-budget'].textContent,/28% capacitor/);assert.match(e['weapon-budget'].textContent,/24\/24 remaining/);
 assert.equal(e['choose-phaser'].disabled,false);assert.equal(e['choose-torpedo'].disabled,false);
 e['wizard-commit'].onclick();assert(sim.maneuvering);assert(sim.turn.orders.every(order=>order.weapon===weapon));
 }
});

test('intro plays after the first successful commit, stays silent on later turns, and resets for rematches',()=>{
  const intros=[];
  class IntroAudio{constructor(){this.plays=0;intros.push(this);}setEnabled(value){this.enabled=value;}playOnce(){this.plays++;}update(state){this.active=state.active;}reset(){this.resets=(this.resets||0)+1;}}
  const h=interfaceHarness({turnBased:true,window:{Audio:class{},BattleIntroAudio:IntroAudio}}),e=h.elements;
  e['commit-orders'].onclick();assert.equal(intros.length,0,'invalid plans do not consume the intro');
  e['quick-battle'].onclick();assert.equal(intros.length,1);assert.equal(intros[0].plays,1);
  h.sim.finishPass();e['quick-battle'].onclick();assert.equal(intros[0].plays,1,'later turns do not replay it');
  e['quick-rematch'].onclick();assert.equal(intros.length,1);assert.equal(intros[0].plays,2);
  e['launch-practice'].onclick();assert.equal(intros[0].plays,2,'Free Flight does not start the music');assert.equal(intros[0].active,false);
  e['commit-orders'].onclick();assert.equal(intros[0].plays,2);
  e.pause.onclick();assert.equal(intros[0].active,false);e.pause.onclick();assert.equal(intros[0].active,false);h.step(60);assert.equal(intros[0].plays,2);
});

test('battle starts immediately while voices wait three seconds, including rematches',()=>{
  for(const recorded of [false,true]){
    const audio=[],spoken=[],intros=[];
    class Audio{constructor(url){this.url=url;audio.push(this);}play(){return Promise.resolve();}pause(){}}
    class IntroAudio{setEnabled(){}playOnce(){intros.push(true);}update(){}reset(){}}
    const h=interfaceHarness({turnBased:true,voiceClips:recorded?{'captain\nCome to port.':'captain.mp3','helm\nComing to port.':'helm.mp3'}:undefined,window:{Audio,BattleIntroAudio:IntroAudio,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[],speak:line=>spoken.push(line),cancel(){}}}});
    h.elements['quick-battle'].onclick();assert.equal(intros.length,1);
    const positions=JSON.stringify([h.sim.player.x,h.sim.player.y,h.sim.player.z,h.sim.enemy.x,h.sim.enemy.y,h.sim.enemy.z]),remaining=h.sim.turn.remaining;
    h.step(60);assert(h.sim.time>0);assert(h.sim.turn.remaining<remaining);assert.equal(audio.length+spoken.length,0);
    h.step(2999);assert.equal(audio.length+spoken.length,0);h.step(3000);assert.equal(spoken.length,0);assert.equal(audio.length>0,recorded);
    assert.notEqual(JSON.stringify([h.sim.player.x,h.sim.player.y,h.sim.player.z,h.sim.enemy.x,h.sim.enemy.y,h.sim.enemy.z]),positions);
    const count=audio.length+spoken.length;
    h.elements['quick-rematch'].onclick();assert.equal(intros.length,2);h.step(3060);
    assert(h.sim.time>0);assert.equal(audio.length+spoken.length,count);
    h.step(6000);assert.equal(spoken.length,0);assert.equal(audio.length>count,recorded,'rematches delay only recorded voices, not battle');
  }
});

test('a muted first commit does not queue the intro for a later turn',async()=>{
  let plays=0;
  class IntroAudio{setEnabled(){}playOnce(){plays++;}update(){}reset(){}}
  const h=interfaceHarness({turnBased:true,window:{Audio:class{},BattleIntroAudio:IntroAudio}});
  await h.elements.audio.onclick();h.elements['quick-battle'].onclick();assert(h.sim.maneuvering);assert.equal(plays,0);
});

test('actual interface starts, fires, pauses and supports keyboard events without a physical key code',()=>{
  const h=interfaceHarness(),{sim,elements,handlers,key}=h;
  Object.assign(sim.enemy,{x:200,y:80,z:-780});
  elements.start.onclick();assert.equal(sim.running,true);
  elements.phaser.onclick();assert.equal(sim.shots,1);
  handlers.keydown(key('t'));assert.equal(sim.player.torpedoes,23);
  handlers.keydown(key('p'));assert.equal(sim.running,false);
  handlers.keydown(key('p'));assert.equal(sim.running,true);
  handlers.keydown(key('ArrowRight'));h.step(60);handlers.keyup(key('ArrowRight'));assert.ok(sim.player.heading>0);
  sim.target='reactor';sim.player.repair='reactor';handlers.keydown(key('r'));assert.equal(sim.target,'reactor');elements.rematch.onclick();
  assert.equal(sim.target,'hull');assert.equal(elements['repair-system'].value,'sensors');assert.equal(sim.running,true);
});

test('destruction shows the end screen as soon as wreckage stops moving',()=>{
  const {sim,scene,elements:e,step}=interfaceHarness();
  for(const arc of B.arcs)sim.enemy.shields[arc]=0;sim.enemy.hull=1;sim.damage(sim.enemy,sim.player,999,'torpedo','hull');
  const battleTime=sim.time;
  for(let i=1;i<=20;i++)step(i*60);
  assert.equal(e.result.hidden,true);assert(scene.lastDt>0);assert(scene.recordedEvents.some(event=>event.type==='destroyed'));
  for(let i=21;i<=80;i++)step(i*60);
  assert(scene.lastDt>0,'wreckage continues drifting through the fifth second');
  assert.equal(e.result.hidden,true);
  for(let i=81;i<=85;i++)step(i*60);
  assert.equal(scene.lastDt,0,'the end screen appears without an extra frozen hold');
  assert.equal(e.result.hidden,false);assert.match(e['result-title'].textContent,/Yorktown neutralized/);assert.equal(sim.time,battleTime);
  e.rematch.onclick();assert.equal(e.result.hidden,true);
});

function pickWeapon(elements,weapon){if(elements['choose-'+weapon].attrs['aria-pressed']!=='true')elements['choose-'+weapon].onclick();}

function buildWizardPlan(elements,routes=['direct','direct','direct']){
  routes.forEach(key=>elements['maneuver-'+key].onclick());
  elements['done-maneuvers'].onclick();
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>{
    if(routes.every(key=>key==='flee'))return;
    elements['plan-step-'+i].onclick();if(elements['choose-'+weapon].attrs['aria-pressed']!=='true')elements['choose-'+weapon].onclick();elements['target-'+['shield-fore','bridge','mainEngines'][i]].onclick();
    elements['attack-range'].oninput({target:{value:String([1100,800,600][i])}});elements['save-plan-step'].onclick();
  });
}

test('Free Flight enables manual controls without a planner and Engage returns to combat',()=>{
  const {sim,elements:e,handlers,key,step}=interfaceHarness({turnBased:true});
  e['launch-practice'].onclick();assert.equal(sim.freeFlight,true);assert.equal(sim.turnBased,false);assert.equal(sim.running,true);
  assert.equal(e['plan-wizard'].open,false);assert.equal(e.start.hidden,false);assert.equal(e['pass-panel'].hidden,true);
  assert.equal(e.phaser.disabled,false);assert.equal(e.torpedo.disabled,false);assert.equal(e.heading.disabled,false);
  e.pause.onclick();e.pause.onclick();assert.equal(sim.freeFlight,true);assert.equal(sim.running,true);
  handlers.keydown(key('ArrowRight'));step(60);handlers.keyup(key('ArrowRight'));assert(sim.player.heading>0);
  assert.equal(e['target-tag'].hidden,true);
  e.start.onclick();assert.equal(sim.freeFlight,false);assert.equal(sim.turnBased,true);assert.equal(e['plan-wizard'].open,true);
});

test('the game randomizes both starting locations again for a new engagement',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true,randomStart:true}),before=[sim.player.x,sim.player.z,sim.enemy.x,sim.enemy.z];
  e.rematch.onclick();assert.notDeepEqual([sim.player.x,sim.player.z,sim.enemy.x,sim.enemy.z],before);
  assert.equal(e['plan-wizard'].open,true);assert(sim.contact);
});

test('Yorktown engineering, shield matrix and weapons track telemetry and clear when sensors fail',()=>{
  const {sim,elements:e,step}=interfaceHarness();
  Object.assign(sim.enemy,{reactor:72,capacitor:64,heat:31,torpedoes:17});sim.enemy.shields.port=19;sim.enemy.bias.port=40;
  step(120);
  assert.equal(e['yt-reactor'].textContent,'72 / 100 GW');assert.equal(e['yt-capacitor'].textContent,'64%');assert.equal(e['yt-heat'].textContent,'31%');
  assert.equal(e['yt-torpedoes'].textContent,'17 / 24');assert.equal(e['yorktown-svg-port'].textContent,'19%');assert.equal(e['yt-shield-port'].textContent,'40%');assert.equal(e['yt-shield-status'].textContent,'BREACH RISK');
  sim.player.integrity.sensors=0;step(240);
  for(const id of ['yt-reactor','yt-capacitor','yt-heat','yt-torpedoes','yt-phasers','yt-power-engines','yt-shield-port'])assert.equal(e[id].textContent,'UNKNOWN',id);
  assert.equal(e['yorktown-svg-port'].textContent,'--');assert.equal(e['yt-capacitor-bar'].style.width,'0%');
});

test('Yorktown stats remain visible beyond combat range and without sensor power until sensors are damaged',()=>{
  const {sim,elements:e,step}=interfaceHarness();sim.enemy.x=10000;sim.enemy.hull=63;sim.player.power.sensors=0;
  step(120);assert.equal(sim.contact,false);assert.equal(sim.detailed,false);
  assert.equal(e['yorktown-damage-hull'].textContent,'63%');assert.equal(e['yt-reactor'].textContent,'100 / 100 GW');
  assert.equal(e['sensor-state'].textContent,'TRACKING');assert.notEqual(e['target-range'].textContent,'—.— KM');
  sim.player.integrity.sensors=99;step(240);assert.equal(e['yorktown-damage-hull'].textContent,'UNKNOWN');assert.equal(e['yt-reactor'].textContent,'UNKNOWN');assert.equal(e['sensor-state'].textContent,'SENSORS DAMAGED');
  sim.player.integrity.sensors=100;step(360);assert.equal(e['yorktown-damage-hull'].textContent,'63%');assert.equal(e['yt-reactor'].textContent,'100 / 100 GW');
});

test('the tactical radar is below HUD range and Yorktown panels occupy a separate rail',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const hud=html.slice(html.indexOf('id="attack-hud"'),html.indexOf('id="pass-panel"'));
  assert(hud.indexOf('id="radar"')>hud.indexOf('id="distance-meter"'));
  const rail=html.slice(html.indexOf('class="yorktown-rail"'),html.indexOf('<section class="console panel helm"'));
  for(const label of ['Yorktown engineering','Yorktown shield matrix','Yorktown weapons'])assert(rail.includes(label));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'unique IDs for both ships');
});

test('large maneuver toggles default to separate maneuvers and retain multiple eligible routes',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();buildWizardPlan(e);
  for(let i=0;i<3;i++){
    e['plan-step-'+i].onclick();
    assert.deepEqual([0,1,2].map(m=>e['attack-maneuver-'+m].attrs['aria-pressed']==='true'),[0,1,2].map(m=>m===i));
  }
  e['plan-step-0'].onclick();e['attack-maneuver-1'].onclick();e['save-plan-step'].onclick();
  e['wizard-commit'].onclick();assert.deepEqual(sim.turn.orders[0].maneuvers,[0,1]);
});

test('Done accepts a single maneuver with all three attacks assigned to it',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
  assert.equal(e['done-maneuvers'].disabled,true);e['maneuver-direct'].onclick();
  assert.equal(e['done-maneuvers'].disabled,false);assert.equal(e['done-maneuvers'].hidden,false);
  e['done-maneuvers'].onclick();
  assert.equal(e['shot-choice'].hidden,false);
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>{
    e['plan-step-'+i].onclick();assert.equal(e['attack-maneuver-0'].attrs['aria-pressed'],'true');assert.equal(e['attack-maneuver-1'].disabled,true);
    pickWeapon(e,weapon);e['target-hull'].onclick();e['save-plan-step'].onclick();
  });
  assert.equal(e['wizard-commit'].disabled,false);e['wizard-commit'].onclick();
  assert.deepEqual(sim.turn.maneuvers,['direct',null,null]);assert.deepEqual(Array.from(sim.turn.orders,s=>s.maneuvers),[[0],[0],[0]]);
  assert.equal(e['live-plan'].children.length,1);
});

test('maneuver clicks append in order, including repeated routes, until Done',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
  for(const key of ['port','port','above'])e['maneuver-'+key].onclick();
  assert.equal(e['maneuver-choice'].hidden,false);assert.equal(e['maneuver-direct'].disabled,true);
  e['maneuver-direct'].onclick(); // Even an extra programmatic click cannot overwrite a full plan.
  assert.match(e['route-label-0'].textContent,/port/i);assert.match(e['route-label-1'].textContent,/port/i);assert.match(e['route-label-2'].textContent,/above/i);
  e['route-delete-1'].onclick();e['maneuver-below'].onclick();e['done-maneuvers'].onclick();
  assert.equal(e['shot-choice'].hidden,false);assert.deepEqual(sim.turn.draftManeuvers,[null,null,null]);
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>{
    e['plan-step-'+i].onclick();pickWeapon(e,weapon);e['target-hull'].onclick();e['save-plan-step'].onclick();
  });
  e['wizard-commit'].onclick();assert.deepEqual(sim.turn.maneuvers,['port','below','above']);
});

test('Commit enables with all three attacks on one maneuver, including an unsaved final attack',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  for(let i=0;i<2;i++){pickWeapon(e,'phaser');e['target-hull'].onclick();e['save-plan-step'].onclick();}
  assert.equal(e['wizard-commit'].disabled,true);pickWeapon(e,'torpedo');assert.equal(e['wizard-commit'].disabled,true);
  e['target-hull'].onclick();assert.equal(e['wizard-commit'].disabled,false);
  assert.equal(e['attack-maneuver-0'].attrs['aria-pressed'],'true');assert.equal(e['attack-maneuver-1'].hidden,true);assert.equal(e['attack-maneuver-2'].hidden,true);
  e['wizard-commit'].onclick();assert.equal(sim.turn.phase,'approach');assert.deepEqual(Array.from(sim.turn.orders,o=>o.maneuvers),[[0],[0],[0]]);
});

test('completing weapon, target, maneuvers and range advances automatically and enables final Commit',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  pickWeapon(e,'phaser');e['attack-range'].onchange({target:{value:'900'}});
  assert.equal(e['plan-step-0'].attrs['aria-current'],'step');e['target-hull'].onclick();assert.equal(e['plan-step-1'].attrs['aria-current'],'step');
  pickWeapon(e,'phaser');e['target-bridge'].onclick();
  for(const value of ['850','800','750'])e['attack-range'].oninput({target:{value}});
  assert.equal(e['plan-step-1'].attrs['aria-current'],'step','slider dragging does not switch stages');
  e['attack-range'].onchange({target:{value:'750'}});assert.equal(e['plan-step-2'].attrs['aria-current'],'step');
  assert.equal(e['choose-torpedo'].disabled,false);pickWeapon(e,'torpedo');
  e['target-mainEngines'].onclick();e['attack-range'].onchange({target:{value:'600'}});
  assert.equal(e['wizard-commit'].disabled,false);assert.equal(e['plan-step-2'].attrs['aria-current'],'step');
  e['plan-step-0'].onclick();e['target-sensors'].onclick();assert.equal(e['plan-step-0'].attrs['aria-current'],'step','editing a completed attack stays on that attack');
  e['wizard-commit'].onclick();assert.deepEqual(Array.from(sim.turn.orders,order=>order.range),[900,750,600]);assert.equal(sim.turn.orders[0].target,'sensors');
});

test('selecting a torpedo leaves both weapons available for remaining attacks',()=>{
  const {elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  assert.equal(e['choose-phaser'].attrs['aria-pressed'],'false');assert.equal(e['choose-torpedo'].attrs['aria-pressed'],'false');
  e['choose-torpedo'].onclick();e['target-hull'].onclick();e['attack-range'].onchange({target:{value:'700'}});
  for(const target of ['bridge','engines']){
    assert.equal(e['choose-phaser'].disabled,false);assert.equal(e['choose-torpedo'].disabled,false);pickWeapon(e,'phaser');
    e['target-'+target].onclick();e['attack-range'].onchange({target:{value:'900'}});
  }
  assert.equal(e['wizard-commit'].disabled,false);
});

test('three configured orders enable Commit and deselection reopens a stage',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>{
    e['plan-step-'+i].onclick();pickWeapon(e,weapon);e['target-hull'].onclick();
  });
  assert.equal(e['wizard-commit'].disabled,false);assert.equal(e['choose-phaser'].disabled,false);assert.equal(e['save-plan-step'].disabled,true);
  assert.equal(e['plan-step-0'].attrs['data-budget-full'],'true');
  assert.deepEqual(sim.turn.draft,[null,null,null],'selections remain local until Commit');
  e['choose-torpedo'].onclick();assert.equal(e['wizard-commit'].disabled,true);assert.equal(e['choose-torpedo'].disabled,false);
  assert.equal(e['plan-step-0'].attrs['data-budget-full'],'false');
  e['choose-torpedo'].onclick();assert.equal(e['wizard-commit'].disabled,false);
  e['plan-step-1'].onclick();e['clear-plan-step'].onclick();assert.equal(e['wizard-commit'].disabled,true);assert.equal(e['choose-phaser'].disabled,false);
  pickWeapon(e,'phaser');e['target-bridge'].onclick();assert.equal(e['wizard-commit'].disabled,false);
  e['wizard-commit'].onclick();assert.equal(sim.turn.orders.filter(o=>o.weapon==='phaser').length,2);assert.equal(sim.turn.orders.filter(o=>o.weapon==='torpedo').length,1);
});

test('deleting a maneuver requires reassignment and remains transactional',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();buildWizardPlan(e);
  e['route-delete-1'].onclick();assert.equal(e['route-delete-1'].hidden,true);assert.equal(e['wizard-commit'].disabled,true);
  assert.deepEqual(sim.turn.draftManeuvers,[null,null,null]);
  e['done-maneuvers'].onclick();e['plan-step-1'].onclick();assert.equal(e['attack-maneuver-1'].attrs['aria-pressed'],'false');
  e['attack-maneuver-0'].onclick();e['save-plan-step'].onclick();
  assert.equal(e['wizard-commit'].disabled,false);e['wizard-commit'].onclick();
  assert.deepEqual(sim.turn.maneuvers,['direct',null,'direct']);assert.deepEqual(sim.turn.orders[1].maneuvers,[0]);
  e['open-planner'].onclick();assert.equal(e['route-delete-0'].disabled,true);e['wizard-cancel'].onclick();
});

test('wizard commits three maneuvers in one pass and applies pending edits explicitly',()=>{
  const h=interfaceHarness({turnBased:true}),{sim,elements}=h;
  elements.start.onclick();assert.equal(elements['plan-wizard'].open,true);assert.equal(sim.running,false);
  assert.equal(elements['wizard-commit'].disabled,true);
  buildWizardPlan(elements,['direct','above','starboard']);
  assert.equal(sim.planReady(),false);assert.equal(elements['wizard-commit'].disabled,false);
  elements['wizard-commit'].onclick();assert.equal(sim.turn.phase,'approach');assert.equal(sim.running,true);assert.equal(elements['plan-wizard'].open,false);
  assert.deepEqual(sim.turn.maneuvers,['direct','above','starboard']);assert.equal(elements['live-plan'].children.length,3);
  assert.match(elements['live-plan'].children[1].children[0].textContent,/Bridge/);
  elements['open-planner'].onclick();elements['plan-step-1'].onclick();elements['target-reactor'].onclick();elements['save-plan-step'].onclick();
  assert.equal(sim.turn.orders[1].target,'bridge');assert.equal(sim.turn.revisions,2);
  elements['wizard-apply'].onclick();assert.equal(sim.turn.orders[1].target,'reactor');assert.equal(sim.turn.revisions,1);assert.equal(elements['plan-wizard'].open,false);
});

test('Cancel, Escape and the close button discard staged edits without spending revisions',()=>{
  const {sim,elements}=interfaceHarness({turnBased:true});elements.start.onclick();buildWizardPlan(elements);elements['wizard-commit'].onclick();
  const draft=JSON.stringify(sim.turn.draft),orders=JSON.stringify(sim.turn.orders);
  for(const dismiss of [()=>elements['wizard-cancel'].onclick(),()=>elements['plan-wizard'].handlers.cancel({preventDefault(){}}),()=>elements['close-planner'].onclick()]){
    elements['open-planner'].onclick();elements['plan-step-1'].onclick();elements['target-reactor'].onclick();elements['save-plan-step'].onclick();dismiss();
    assert.equal(elements['plan-wizard'].open,false);assert.equal(JSON.stringify(sim.turn.draft),draft);assert.equal(JSON.stringify(sim.turn.orders),orders);assert.equal(sim.turn.revisions,2);assert.equal(sim.running,true);
  }
});

test('Cancel during initial planning discards route and shot edits and restores the decision clock',()=>{
  const {sim,elements}=interfaceHarness({turnBased:true});elements.start.onclick();buildWizardPlan(elements,['port','above','direct']);
  elements['wizard-cancel'].onclick();assert.deepEqual(sim.turn.draftManeuvers,[null,null,null]);assert.deepEqual(sim.turn.draft,[null,null,null]);assert.equal(sim.running,true);
});

test('three flee stages need no shots and Commit starts the first stage only',()=>{
  const {sim,elements}=interfaceHarness({turnBased:true});elements.start.onclick();
  for(let i=0;i<3;i++){elements['route-stage-'+i].onclick();elements['maneuver-flee'].onclick();}
  assert.equal(elements['wizard-commit'].disabled,false);assert.equal(sim.planReady(),false);
  elements['wizard-commit'].onclick();assert.equal(sim.turn.phase,'withdraw');assert.equal(sim.turn.stageIndex,0);assert.equal(sim.shots,0);
  assert.equal(elements['live-plan'].children.length,3);assert.equal(elements['helm-turn-state'].textContent,'AUTO HELM');
});

test('editing a paused pass supports Apply without resuming it',()=>{
  const {sim,elements}=interfaceHarness({turnBased:true});elements.start.onclick();buildWizardPlan(elements);elements['wizard-commit'].onclick();
  sim.running=false;elements['open-planner'].onclick();elements['plan-step-1'].onclick();elements['target-reactor'].onclick();elements['save-plan-step'].onclick();
  elements['wizard-apply'].onclick();assert.equal(sim.turn.orders[1].target,'reactor');assert.equal(sim.running,false);assert.equal(sim.turn.revisions,1);
});

test('live maneuver and attack edits apply together without resetting the turn or resuming a paused game',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();buildWizardPlan(e);e['wizard-commit'].onclick();sim.running=false;
  const remaining=sim.turn.remaining,enemy=JSON.stringify(sim.turn.enemyOrders),position={x:sim.player.x,y:sim.player.y,z:sim.player.z};
  e['open-planner'].onclick();assert.equal(e['maneuver-choice'].hidden,false);assert.equal(e['shot-choice'].hidden,true);
  e['route-stage-0'].onclick();assert.equal(e['maneuver-behind'].disabled,false);e['maneuver-behind'].onclick();
  assert.equal(sim.turn.maneuver,'direct');assert.match(e['route-label-0'].textContent,/behind/);
  e['plan-step-1'].onclick();e['target-reactor'].onclick();e['save-plan-step'].onclick();e['wizard-apply'].onclick();
  assert.equal(e['plan-wizard'].open,false);assert.equal(sim.turn.maneuver,'behind');assert.equal(sim.turn.orders[1].target,'reactor');assert.equal(sim.turn.revisions,0);
  assert.equal(sim.turn.remaining,remaining);assert.equal(sim.running,false);assert.equal(JSON.stringify(sim.turn.enemyOrders),enemy);
  assert.deepEqual({x:sim.player.x,y:sim.player.y,z:sim.player.z},position);assert.equal(sim.player.torpedoes,24);
});

test('future maneuver edits cancel cleanly and selected maneuvers can be replaced before Commit',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();buildWizardPlan(e);
  e['route-stage-1'].onclick();e['maneuver-below'].onclick();e['wizard-commit'].onclick();assert.equal(sim.turn.maneuvers[1],'below');sim.running=false;
  e['open-planner'].onclick();e['route-stage-2'].onclick();e['maneuver-port'].onclick();e['wizard-cancel'].onclick();assert.equal(sim.turn.maneuvers[2],'direct');assert.equal(sim.turn.revisions,2);
  e['open-planner'].onclick();e['route-stage-2'].onclick();e['maneuver-starboard'].onclick();e['wizard-apply'].onclick();
  assert.equal(sim.turn.maneuvers[2],'starboard');assert.equal(sim.turn.maneuver,'direct');assert.equal(sim.turn.revisions,1);
});

test('Apply rejects a staged action that fired while the plan editor remained open',()=>{
  const {sim,elements}=interfaceHarness({turnBased:true});Object.assign(sim.enemy,{x:200,y:80,z:-780});elements.start.onclick();buildWizardPlan(elements);elements['wizard-commit'].onclick();
  elements['open-planner'].onclick();elements['plan-step-1'].onclick();elements['target-reactor'].onclick();elements['save-plan-step'].onclick();
  for(let i=0;i<1000&&sim.turn.orders[1].status==='pending';i++)sim.tick(.05);
  assert.notEqual(sim.turn.orders[1].status,'pending');elements['wizard-apply'].onclick();
  assert.equal(elements['plan-wizard'].open,true);assert.match(elements['wizard-error'].textContent,/advanced|fired/);assert.equal(sim.turn.orders[1].target,'bridge');assert.equal(sim.turn.revisions,2);
  elements['wizard-cancel'].onclick();assert.equal(elements['plan-wizard'].open,false);
});

test('replay controls pause the battle, restart playback, and restore the live state on exit',()=>{
  const h=interfaceHarness({turnBased:true}),{sim,replay,elements}=h;assert.equal(elements['replay-last-pass'].disabled,true);
  elements.start.onclick();buildWizardPlan(elements);elements['wizard-commit'].onclick();sim.enemy.integrity.weapons=0;
  for(let i=0;i<5000&&sim.turn.phase!=='review'&&!sim.result;i++)sim.tick(.1);
  assert(sim.lastReplay);h.step(120);assert.equal(elements['replay-last-pass'].disabled,false);
  const before=JSON.stringify({player:sim.player,enemy:sim.enemy,turn:sim.turn,seed:sim.seed,time:sim.time,log:sim.log});
  const running=sim.running;elements['replay-last-pass'].onclick();assert.equal(replay.active,true);assert.equal(sim.running,false);
  h.step(240);h.step(360);assert(replay.player.position>0);
  elements['replay-play'].onclick();const at=replay.player.position;h.step(480);assert.equal(replay.player.position,at);
  elements['replay-restart'].onclick();assert.equal(replay.player.position,0);assert.equal(replay.player.paused,false);
  elements['replay-close'].onclick();assert.equal(replay.active,false);assert.equal(sim.running,running);
  assert.equal(JSON.stringify({player:sim.player,enemy:sim.enemy,turn:sim.turn,seed:sim.seed,time:sim.time,log:sim.log}),before);
});

test('replay controls fade during playback and return with pointer, keyboard, pause and completion',()=>{
  const {sim,replay,elements:e}=interfaceHarness({turnBased:true});
  e['random-turn'].onclick();sim.tick(.1);sim.finishPass();sim.lastReplay.duration=100;
  // Keep a later action in the highlight edit while testing playback controls.
  sim.lastReplay.events.push({at:80,event:{type:'beam',from:'Enterprise',to:'Yorktown',duration:1.4}});
  sim.lastReplay.frames.push({...sim.lastReplay.frames.at(-1),at:100});
  e['replay-last-pass'].onclick();replay.tick(3);assert.equal(e['replay-dialog'].attrs['data-controls-hidden'],'true');
  e['replay-dialog'].handlers.pointermove();assert.equal(e['replay-dialog'].attrs['data-controls-hidden'],'false');
  replay.tick(3);assert.equal(e['replay-dialog'].attrs['data-controls-hidden'],'true');
  e['replay-dialog'].handlers.keydown();replay.tick(4);assert.equal(e['replay-dialog'].attrs['data-controls-hidden'],'false','keyboard navigation keeps controls visible');
  e['replay-dialog'].handlers.pointermove();e['replay-play'].onclick();replay.tick(3);assert.equal(e['replay-dialog'].attrs['data-controls-hidden'],'false');
  replay.player.ended=true;replay.renderUI();assert.equal(e['replay-dialog'].attrs['data-controls-hidden'],'false');
});

test('Yorktown station panels display each damage readout once and hide lost telemetry',()=>{
  const h=interfaceHarness(),{sim,elements}=h;sim.enemy.hull=43;sim.enemy.reactor=65;sim.enemy.shields.fore=7;sim.enemy.integrity.bridge=20;
  h.step(120);assert.equal(elements['yorktown-damage-hull'].textContent,'43%');assert.equal(elements['yt-reactor'].textContent,'65 / 100 GW');assert.equal(elements['yorktown-system-bridge'].textContent,'20%');
  assert.equal(elements['yorktown-svg-fore'].textContent,'7%');assert.equal(elements['yt-reactor-bar'].style.width,'65%');
  for(const arc of B.arcs)assert(elements['yorktown-svg-'+arc]);
  sim.player.integrity.sensors=0;h.step(240);assert.equal(elements['yorktown-damage-hull'].textContent,'UNKNOWN');assert.equal(elements['yt-reactor'].textContent,'UNKNOWN');assert.equal(elements['yorktown-system-bridge'].textContent,'--');assert.equal(elements['yorktown-svg-fore'].textContent,'--');assert.equal(elements['sensor-state'].textContent,'SENSORS DAMAGED');
});

test('live End pass returns to the main screen and planning can be opened for the next pass',()=>{
  const {sim,elements}=interfaceHarness({turnBased:true});assert.equal(elements['end-pass'].disabled,true);
  elements.start.onclick();buildWizardPlan(elements);elements['wizard-commit'].onclick();assert.equal(elements['end-pass'].disabled,false);
  sim.player.hull=64;const ammo=sim.player.torpedoes;elements['end-pass'].onclick();
  assert.equal(sim.turn.phase,'review');assert.equal(sim.turn.endedEarly,true);assert.equal(elements['plan-wizard'].open,false);assert.equal(elements['end-pass'].disabled,true);
  assert.equal(sim.player.hull,64);assert.equal(sim.player.torpedoes,ammo);assert.equal(sim.lastReplay.endedEarly,true);
  elements['open-planner'].onclick();assert.equal(elements['plan-wizard'].open,true);buildWizardPlan(elements);
  elements['wizard-commit'].onclick();assert.equal(sim.turn.number,2);assert.equal(sim.turn.stageIndex,0);assert.equal(elements['plan-wizard'].open,false);assert.equal(elements['end-pass'].disabled,false);
});

test('Yorktown status shows executing its plan, waits for impacts, then shows End pass',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});assert.equal(e['yorktown-plan-state'].textContent,'PLANNING');
  e.start.onclick();buildWizardPlan(e);e['wizard-commit'].onclick();assert.equal(e['yorktown-plan-state'].textContent,'EXECUTING PLAN');
  sim.running=false;for(const order of sim.turn.enemyOrders)order.status='hit';
  sim.projectiles.push({from:sim.enemy.name});step(120);assert.equal(e['yorktown-plan-state'].textContent,'EXECUTING PLAN');
  sim.projectiles=[];step(240);assert.equal(e['yorktown-plan-state'].textContent,'END TURN');
  e['end-pass'].onclick();assert.equal(e['yorktown-plan-state'].textContent,'END TURN');
  sim.player.integrity.sensors=90;step(360);assert.equal(e['yorktown-plan-state'].textContent,'UNKNOWN');
});

test('Automatic Helm displays actual Enterprise speed in meters per second and astern direction',()=>{
  const h=interfaceHarness({turnBased:true});assert.equal(h.elements['auto-flight-speed'].textContent,'150 M/S');
  h.sim.player.speed=32.5;h.step(120);assert.equal(h.elements['auto-flight-speed'].textContent,'325 M/S');
  h.sim.player.speed=-18;h.step(240);assert.equal(h.elements['auto-flight-speed'].textContent,'180 M/S ASTERN');
  assert.equal(h.elements['enterprise-speed'].value,'-180');assert.equal(h.elements['enterprise-speed-value'].textContent,'180 M/S ASTERN');assert.equal(h.elements['enterprise-speed'].disabled,true);
  h.elements['launch-practice'].onclick();assert.equal(h.elements['enterprise-speed'].disabled,false);
  h.elements['enterprise-speed'].handlers.input({target:{value:'750'}});assert.equal(h.sim.player.throttle,40);
});

test('W and S temporarily override automatic speed through the actual keyboard bindings',()=>{
  const {sim,elements:e,handlers,key,step}=interfaceHarness({turnBased:true});e.start.onclick();buildWizardPlan(e);e['wizard-commit'].onclick();
  handlers.keydown(key('w'));step(120);assert.equal(sim.player.speedOverride,1);
  handlers.keyup(key('w'));step(240);assert.equal(sim.player.speedOverride,0);
  handlers.keydown(key('s'));step(360);assert.equal(sim.player.speedOverride,-1);
  handlers.keyup(key('s'));step(480);assert.equal(sim.player.speedOverride,0);assert.equal(sim.turn.maneuver,'direct');
});

test('all ship-scene constructors exist in the local renderer bundle',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root,'vendor/three.js'),'utf8'),c);
  vm.runInContext(fs.readFileSync(path.join(root,'geometry.js'),'utf8'),c);
  const T=c.window.AlpineThree,scene=fs.readFileSync(path.join(root,'scene.js'),'utf8');
  for(const match of scene.matchAll(/new T\.(\w+)/g))assert.equal(typeof T[match[1]],'function',match[1]);
  const lathe=new T.LatheGeometry([new T.Vector2(0,0),new T.Vector2(1,0),new T.Vector2(.9,.2),new T.Vector2(0,.2)],32);
  assert.ok(lathe.index.count>0);assert.ok([...lathe.attributes.normal.array].every(Number.isFinite));
});

test('attack HUD guides shortest turns and nose direction, and hides lost contacts',()=>{
  const h=interfaceHarness(),{sim,elements}=h;
  sim.player.heading=350;sim.player.pitch=0;sim.enemy.x=100;sim.enemy.y=100;sim.enemy.z=-850;
  h.step(120);assert.match(elements['attack-turn'].textContent,/RIGHT/);assert.equal(elements['attack-directions'].attrs['data-turn'],'right');assert.match(elements['attack-pitch'].textContent,/NOSE UP/);assert.equal(elements['attack-pitch-arrow'].textContent,'\u2191');
  sim.player.heading=10;sim.enemy.x=-100;sim.enemy.y=-100;
  h.step(240);assert.match(elements['attack-turn'].textContent,/LEFT/);assert.equal(elements['attack-directions'].attrs['data-turn'],'left');assert.match(elements['attack-pitch'].textContent,/NOSE DOWN/);assert.equal(elements['attack-pitch-arrow'].textContent,'\u2193');
  sim.player.heading=0;sim.enemy.x=0;sim.enemy.y=0;
  h.step(360);assert.match(elements['attack-turn'].textContent,/HEADING ALIGNED/);assert.match(elements['attack-pitch'].textContent,/PITCH ALIGNED/);assert.match(elements['attack-solution'].textContent,/PHASER ARC/);
  sim.enemy.z=-1750;h.step(480);assert.match(elements['attack-solution'].textContent,/CLOSE DISTANCE/);
  sim.player.integrity.sensors=0;h.step(600);assert.equal(elements['attack-turn'].textContent,'CONTACT LOST');assert.equal(elements['attack-pitch'].textContent,'');
});

test('fixed shield diagram shows live strength and warnings for all six sectors',()=>{
  const h=interfaceHarness();
  Object.assign(h.sim.player.shields,{fore:100,aft:75,port:50,starboard:24,dorsal:0,ventral:42});
  h.step(120);
  for(const arc of B.arcs)assert.equal(h.elements['svg-'+arc].textContent,Math.round(h.sim.player.shields[arc])+'%');
  assert.equal(h.elements['arc-dorsal'].style.stroke,'var(--red)');
  assert.equal(h.elements['arc-ventral'].style.stroke,'var(--amber)');
  assert.equal(h.elements['arc-fore'].style.stroke,'var(--cyan)');
});

test('HUD reports the 20 km cutoff and recovers tracking inside it',()=>{
  const h=interfaceHarness(),{sim,elements}=h;
  sim.player.x=0;sim.player.y=0;sim.player.z=0;sim.enemy.x=0;sim.enemy.y=0;sim.enemy.z=-2000;
  h.step(120);assert.equal(sim.contact,false);assert.equal(elements['attack-turn'].textContent,'YORKTOWN OUT OF RANGE');assert.equal(elements['sensor-state'].textContent,'TRACKING');
  sim.enemy.z=-1999;h.step(240);assert.equal(sim.contact,true);assert.equal(elements['attack-turn'].textContent,'HEADING ALIGNED');
});

test('spatial guides omit the targeting line and ships use their swapped phaser colors',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  s.T=T;s.scene=new T.Scene();s.sim=new c.Battle.Simulation();s.effects=[];s.mode='tactical';s.host={clientHeight:440};s.camera=new T.PerspectiveCamera(46,1,.5,65000);s.camera.position.set(0,100,400);s.project=()=>({visible:true});s.glowMap=()=>null;
  s.ships={Enterprise:new T.Group(),Yorktown:new T.Group()};s.ships.Yorktown.position.set(200,80,-780);
  for(const ship of Object.values(s.ships)){ship.userData.model=new T.Group();ship.add(ship.userData.model);}
  s.makeSpatialGuides();s.updateSpatialGuides();assert.equal(s.spatial.link,undefined);
  s.event({type:'beam',from:'Enterprise',to:'Yorktown'});s.updateSpatialGuides();assert.equal(s.spatial.link,undefined);
  const beam=s.effects.find(fx=>fx.kind==='beam');assert.equal(beam.max,1.4);assert.equal(beam.object.children.length,3);assert.equal(s.effects.filter(fx=>fx.kind==='flash').length,2);
  assert.equal(beam.object.children[0].material.color.getHex(),0x103cff);assert.equal(s.effects.find(fx=>fx.kind==='flash').object.material.color.getHex(),0x2864ff);
  beam.life=beam.max;s.updateSpatialGuides();assert.equal(s.spatial.link,undefined);
  s.event({type:'beam',from:'Yorktown',to:'Enterprise'});assert.equal(s.effects.filter(fx=>fx.kind==='beam').at(-1).object.children[0].material.color.getHex(),0xff4d24);assert.equal(s.effects.filter(fx=>fx.kind==='flash').at(-1).object.material.color.getHex(),0xffa660);
});

test('Enterprise critical hull shows a red alert below 25 percent and clears for a new engagement',()=>{
  const h=interfaceHarness(),{sim,elements}=h;
  sim.player.hull=25;h.step(120);assert.equal(elements['hull-warning'].hidden,true);
  sim.player.hull=24;h.step(240);assert.equal(elements['hull-warning'].hidden,false);assert.equal(elements['alert-label'].textContent,'RED ALERT');assert.match(elements['hull-warning-detail'].textContent,/24% HULL/);
  sim.enemyRetreating=true;h.step(360);assert.match(elements['attack-title'].textContent,/YORKTOWN RETREATING/);
  sim.result='defeat';sim.player.hull=0;h.step(480);assert.equal(elements['hull-warning'].hidden,true);
  elements.rematch.onclick();assert.equal(elements['hull-warning'].hidden,true);assert.equal(elements['alert-label'].textContent,'ENGAGED');assert.equal(sim.enemyRetreating,false);
});

test('warp button spends its charge, reports out of range, and resets for a rematch',()=>{
  const h=interfaceHarness(),{sim,elements}=h;assert.equal(elements.warp.disabled,true);
  elements.start.onclick();assert.equal(elements.warp.disabled,false);
  sim.player.heading=180;elements.warp.onclick();assert.equal(sim.warpUsed,true);assert.equal(elements.warp.disabled,true);assert.equal(elements.warp.textContent,'WARP CHARGE SPENT');assert.equal(elements['attack-turn'].textContent,'YORKTOWN OUT OF RANGE');
  const z=sim.player.z;elements.warp.onclick();assert.equal(sim.player.z,z);
  elements.rematch.onclick();assert.equal(sim.warpUsed,false);assert.equal(elements.warp.disabled,false);
});

test('range bar shrinks with separation and shares target colors',()=>{
  const h=interfaceHarness(),{sim,elements}=h;
  Object.assign(sim.player,{x:0,y:0,z:0,heading:0,pitch:0});Object.assign(sim.enemy,{x:0,y:0,z:-1000});
  h.step(120);assert.equal(elements['distance-fill'].style.width,'50%');assert.equal(elements['distance-value'].textContent,'10.0 KM');assert.equal(elements['distance-hud'].style.color,'#79f0a3');
  sim.enemy.z=-500;h.step(240);assert.equal(elements['distance-fill'].style.width,'25%');
  sim.player.heading=180;h.step(360);assert.equal(elements['distance-hud'].style.color,'#ffad45');
  sim.enemy.z=-2100;h.step(480);assert.equal(elements['distance-fill'].style.width,'100%');assert.equal(elements['distance-value'].textContent,'OUT OF RANGE');
  sim.enemy.z=-500;sim.player.integrity.sensors=0;h.step(600);assert.equal(elements['distance-hud'].hidden,true);
});

test('engine trails grow with speed, reverse direction, and vanish at stop',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);const root=path.join(__dirname,'..');
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const s=Object.create(c.window.BattleScene.prototype);s.T=c.window.AlpineThree;s.clock=0;
  const trails=s.makeEngineTrails(new s.T.Group()),ship={userData:{trails}};
  const zs=()=>Array.from(trails.geometry.attributes.position.array).filter((_,i)=>i%3===2);
  s.updateEngineTrails(ship,{speed:40,hull:100});const slow=Math.max(...zs());
  s.updateEngineTrails(ship,{speed:200,hull:100});const forward=Math.max(...zs())-.79;assert(Math.max(...zs())>slow);assert(trails.visible);
  s.updateEngineTrails(ship,{speed:-200,hull:100});assert(zs().every(z=>z<-.87));assert(Math.abs((-.87-Math.min(...zs()))-forward)<1e-5);
  assert(trails.geometry.attributes.position.array.every(Number.isFinite));
  s.updateEngineTrails(ship,{speed:0,hull:100});assert.equal(trails.visible,false);
  s.updateEngineTrails(ship,{speed:100,hull:0});assert.equal(trails.visible,false);
  s.sim={turnBased:true,turn:{phase:'review'}};
  s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,false);
  s.sim.turn.phase='planning';s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,false);
  s.sim.turn.phase='approach';s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,true);
  s.setCamera('cinematic');s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,false);
  s.setCamera('chase');s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,true);
  s.engineTrailsEnabled=false;s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,false);
  s.engineTrailsEnabled=true;s.sim.running=false;s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,false);
  s.sim.running=true;s.sim.freeFlight=true;s.updateEngineTrails(ship,{speed:100,hull:100});assert.equal(trails.visible,false);
});

test('lower opening chase view keeps Yorktown visible above Enterprise across viewport shapes',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.7,1,1.8,2.5]){
    const scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.sim=new B.Simulation();scene.mode='chase';scene.orbit={x:0,y:0};scene.zoom=1;scene.camera=new T.PerspectiveCamera(46,aspect,.5,65000);
    scene.ships={Enterprise:new T.Group(),Yorktown:new T.Group()};
    for(const [name,state] of [['Enterprise',scene.sim.player],['Yorktown',scene.sim.enemy]])scene.ships[name].position.set(state.x,state.y,state.z);
    const position=new T.Vector3(),target=new T.Vector3();scene.chaseCamera(position,target);scene.frameCloseEngagement(position,target);
    scene.camera.position.copy(position);scene.camera.lookAt(target);scene.camera.updateMatrixWorld();
    const enterprise=scene.project(scene.sim.player),yorktown=scene.project(scene.sim.enemy);
    assert(yorktown.visible,`Yorktown not visible at aspect ${aspect}`);assert(yorktown.y>.3);assert(yorktown.y<enterprise.y);assert(enterprise.y>.5);
    assert(position.y-scene.sim.player.y<95*Math.max(1,1.4/aspect));
  }
});

test('close Chase camera stays anchored on Enterprise without changing sides',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);const root=path.join(__dirname,'..');
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.5,1,2.4])for(const separation of [[900,0,0],[0,500,0],[0,0,-900],[-300,-400,500]]){
    const s=Object.create(c.window.BattleScene.prototype);s.T=T;s.mode='chase';s.zoom=1;s.orbit={x:0,y:0};s.camera=new T.PerspectiveCamera(46,aspect,.5,65000);
    s.ships={Enterprise:new T.Group(),Yorktown:new T.Group()};s.ships.Yorktown.position.set(...separation);
    s.sim={contact:true,range:Math.hypot(...separation),player:{hull:100},enemy:{hull:100}};
    const camera=new T.Vector3(170,110,240),direction=camera.clone().normalize(),target=new T.Vector3();assert(s.frameCloseEngagement(camera,target));assert(target.distanceTo(s.ships.Enterprise.position)<1e-8);assert(camera.clone().sub(target).normalize().distanceTo(direction)<1e-8);
    s.camera.position.copy(camera);s.camera.lookAt(target);s.camera.updateMatrixWorld();
    for(const ship of Object.values(s.ships))for(const axis of ['x','y','z'])for(const sign of [-1,1]){
      const point=ship.position.clone();point[axis]+=95*sign;point.project(s.camera);
      assert(Math.abs(point.x)<.98);assert(Math.abs(point.y)<.95);assert(point.z<1&&point.z>-1);
    }
    const fittedDistance=camera.distanceTo(target);s.zoom=.7;camera.copy(direction).multiplyScalar(300);assert(s.frameCloseEngagement(camera,target));assert(camera.distanceTo(target)<fittedDistance*.71);
    s.sim.range=1200;assert(s.frameCloseEngagement(camera,target));s.sim.range=1400;assert.equal(s.frameCloseEngagement(camera,target),false);
    s.sim.range=500;s.mode='forward';assert.equal(s.frameCloseEngagement(camera,target),false);
  }
});

test('Free Flight chase camera follows behind Enterprise through turns and climbs',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);
  Object.assign(scene,{T,camera:{aspect:1.8},sim:{freeFlight:true,player:{x:0,y:0,z:0}},mode:'chase',zoom:1,orbit:{x:0,y:0}});
  const position=new T.Vector3(100,50,200),target=new T.Vector3(0,0,-500);
  assert.equal(scene.trackFreeFlightCamera(position,target),true);
  for(const heading of [0,90,180,270])for(const pitch of [-30,0,30]){
    Object.assign(scene.sim.player,{x:50,y:20,z:-100,heading,pitch});scene.trackFreeFlightCamera(position,target);
    const p=scene.sim.player,d=B.direction(p),forward=new T.Vector3(d.x,d.y,d.z),anchor=new T.Vector3(p.x,p.y,p.z);
    assert(position.clone().sub(anchor).dot(forward)<-230,'camera remains behind the ship');
    assert(target.clone().sub(anchor).dot(forward)>70,'camera looks ahead along the ship heading');
    const side=new T.Vector3(Math.cos(heading*Math.PI/180),0,Math.sin(heading*Math.PI/180));assert(Math.abs(position.clone().sub(anchor).dot(side))<1e-6);
  }
  scene.sim.freeFlight=false;assert.equal(scene.trackFreeFlightCamera(position,target),false);assert.equal(scene.freeFlightCamera,null);
});

test('randomized starting positions keep Yorktown visible in the opening chase camera',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.7,1.8,2.5])for(let seed=0;seed<40;seed++){
    const scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.sim=new B.Simulation(seed,{randomStart:true});scene.mode='chase';scene.orbit={x:0,y:0};scene.zoom=1;scene.camera=new T.PerspectiveCamera(46,aspect,.5,65000);
    scene.ships={Enterprise:new T.Group(),Yorktown:new T.Group()};
    for(const [name,state] of [['Enterprise',scene.sim.player],['Yorktown',scene.sim.enemy]]){
      scene.ships[name].position.set(state.x,state.y,state.z);scene.ships[name].rotation.set(state.pitch*Math.PI/180,-state.heading*Math.PI/180,0,'YXZ');
    }
    const position=new T.Vector3(),target=new T.Vector3();scene.chaseCamera(position,target);scene.frameCloseEngagement(position,target);
    scene.camera.position.copy(position);scene.camera.lookAt(target);scene.camera.updateMatrixWorld();
    assert(scene.project(scene.sim.enemy).visible,`Yorktown visible for seed ${seed}, aspect ${aspect}`);
  }
});

test('Slow Ahead maintains impulse while Space stops Enterprise',()=>{
  const h=interfaceHarness(),{sim,elements,handlers,key}=h;elements.start.onclick();sim.player.speed=100;sim.player.throttle=80;
  elements.stop.onclick();assert.equal(sim.player.speed,B.MIN_IMPULSE_SPEED);assert.equal(sim.player.throttle,0);assert.equal(elements['drive-state'].textContent,'SLOW AHEAD');
  sim.player.throttle=-80;sim.player.speed=-80;handlers.keydown(key(' '));h.step(120);handlers.keyup(key(' '));assert.equal(sim.player.speed,0);assert.equal(elements['drive-state'].textContent,'ALL STOP');
});

test('Level explicitly resets pitch and bank',()=>{
  const h=interfaceHarness();h.sim.player.pitch=32;h.sim.player.bank=.2;h.sim.player.turnRate=20;h.elements.level.onclick();assert.equal(h.sim.player.pitch,0);assert.equal(h.sim.player.bank,0);assert.equal(h.sim.player.turnRate,0);
});

test('Audio toggle enables weapon cues without starting a synthesized continuous oscillator',async()=>{
  const oscillators=[],gains=[];
  const parameter=()=>({value:0,setTargetAtTime(value){this.target=value;},setValueAtTime(){},exponentialRampToValueAtTime(){}});
  class AudioContext{constructor(){this.state='suspended';this.currentTime=0;this.destination={};}async resume(){this.state='running';}createOscillator(){const o={frequency:parameter(),connect(node){return node;},start(){},stop(){}};oscillators.push(o);return o;}createGain(){const g={gain:parameter(),connect(){}};gains.push(g);return g;}}
  class WeaponAudio{setEnabled(value){this.enabled=value;}}
  const h=interfaceHarness({window:{AudioContext,BattleWeaponAudio:WeaponAudio}});
  assert.equal(h.elements['audio-label'].textContent,'Audio on');await h.elements.audio.onclick();assert.equal(h.elements['audio-label'].textContent,'Audio off');assert.equal(oscillators.length,0);
  await h.elements.audio.onclick();assert.equal(h.elements['audio-label'].textContent,'Audio on');assert.equal(h.elements.audio.attrs['aria-pressed'],'true');assert.equal(oscillators.length,1);assert.equal(oscillators[0].type,'sine');
  await h.elements.audio.onclick();assert.equal(h.elements['audio-label'].textContent,'Audio off');assert.equal(oscillators.length,1);
});

test('red alert waits for visible red-alert text instead of just an active battle',async()=>{
  const alarms=[];
  class AudioContext{constructor(){this.state='running';}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}}
  class AlertAudio{constructor(){alarms.push(this);}setEnabled(){}update(state){this.active=state.active;}stop(){this.active=false;}}
  const h=interfaceHarness({turnBased:true,window:{AudioContext,Audio:class{},BattleWeaponAudio:WeaponAudio,BattleAlertAudio:AlertAudio}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.elements['quick-battle'].onclick();
  h.elements['alert-label'].textContent='STAND BY';h.elements['hull-warning'].hidden=true;
  h.step(60);assert.equal(alarms[0].active,false);
  h.elements['alert-label'].textContent='RED ALERT';h.step(80);assert.equal(alarms[0].active,true);
  h.elements['alert-label'].getClientRects=()=>[];h.step(100);assert.equal(alarms[0].active,false,'hidden text cannot trigger the sound');
});

test('red alert follows combat and critical alerts, and stops for pause, Free Flight, mute and blur',async()=>{
  const alarms=[];
  class AudioContext{constructor(){this.state='running';}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}}
  class AlertAudio{constructor(){alarms.push(this);}setEnabled(value){this.enabled=value;}update(state){this.active=state.active;}stop(){this.active=false;}}
  const h=interfaceHarness({turnBased:true,window:{AudioContext,Audio:class{},BattleWeaponAudio:WeaponAudio,BattleAlertAudio:AlertAudio}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.step(60);assert.equal(alarms.length,1);assert.equal(alarms[0].active,false);
  h.elements['quick-battle'].onclick();assert.equal(h.elements['alert-label'].textContent,'ENGAGED');assert.equal(alarms[0].active,false);
  h.sim.player.hull=24;h.step(180);assert.equal(h.elements['alert-label'].textContent,'RED ALERT');assert.equal(alarms[0].active,true);
  h.elements.pause.onclick();assert.equal(alarms[0].active,false);
  h.elements.pause.onclick();assert.equal(alarms[0].active,true);
  h.sim.finishPass();h.step(200);
  assert.equal(h.sim.turn.phase,'review');assert.equal(h.sim.running,true);
  assert.equal(h.elements['alert-label'].textContent,'RED ALERT');assert.equal(alarms[0].active,false,'review silences the alarm while the warning remains visible');
  h.sim.setPhase('planning');h.step(220);assert.equal(alarms[0].active,false,'planning stays silent');
  h.sim.setPhase('approach');h.step(240);assert.equal(alarms[0].active,true,'executing the next turn restores the visible alert sound');
  h.elements['launch-practice'].onclick();assert.equal(h.sim.freeFlight,true);assert.equal(alarms[0].active,false);
  h.elements['quick-rematch'].onclick();assert.equal(alarms[0].active,false);
  h.sim.player.hull=24;h.step(300);assert.equal(alarms[0].active,true);
  await h.elements.audio.onclick();assert.equal(alarms[0].enabled,false);
  h.handlers.blur();assert.equal(alarms[0].active,false);
});

test('manual shots launch when captain commands start and mute cancels an unspoken shot',async()=>{
  const players=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}playPhaser(){}playTorpedo(){}playBreak(){}playHit(){}}
  const voices={window:{Audio}};vm.createContext(voices);
  vm.runInContext(fs.readFileSync(path.join(root,'firing-voices.js'),'utf8'),voices);
  const h=interfaceHarness({window:{AudioContext,Audio,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:voices.window.BattleFiringVoices}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.sim.running=true;Object.assign(h.sim.enemy,{x:0,y:0,z:-450});h.sim.events=[];
  Object.assign(h.sim.station,{x:1e6,y:1e6,z:1e6,parts:[]});
  h.elements.phaser.onclick();
  assert.equal(h.sim.shots,0);assert.equal(players[0].url,'assets/Fire phasers.mp3');
  h.step(60);assert.equal(h.sim.shots,1);assert.equal(players.length,1);
  players[0].onended();h.step(120);assert.equal(h.sim.shots,1);
  h.step(1250);
  h.elements.torpedo.onclick();assert.equal(players.at(-1).url,'assets/Fire torpedo.mp3');
  const pending=players.at(-1);
  await h.elements.audio.onclick();assert.equal(pending.paused,true);h.step(1310);
  assert.equal(h.sim.shots,1,'muting cancels the delayed manual shot');
});

test('Enterprise engine audio follows flight, pause, blur, mute and destruction',async()=>{
  const updates=[],enabled=[];let stops=0;
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}}
  class EngineAudio{setEnabled(value){enabled.push(value);}update(value){updates.push(value);}stop(){stops++;}}
  const h=interfaceHarness({window:{AudioContext,Audio:class{},BattleWeaponAudio:WeaponAudio,BattleEngineAudio:EngineAudio}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.step(60);assert.equal(updates.at(-1).active,false);
  h.elements['launch-practice'].onclick();h.step(120);assert.equal(updates.at(-1).active,true);assert(updates.at(-1).maximum>0);
  h.elements.pause.onclick();h.step(180);assert.equal(updates.at(-1).active,false);
  h.elements.pause.onclick();h.step(240);assert.equal(updates.at(-1).active,true);
  h.handlers.blur();assert(stops>0);h.step(300);assert.equal(updates.at(-1).active,false);
  await h.elements.audio.onclick();assert.equal(enabled.at(-1),false);
  h.elements.pause.onclick();h.sim.selfDestruct();h.step(360);assert.equal(updates.at(-1).active,false);
});

test('Enterprise and Yorktown engine loops follow their own speeds and share mute and pause',async()=>{
  const loops=[];
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}}
  class EngineAudio{constructor(){loops.push(this);}setEnabled(value){this.enabled=value;}update(value){this.state=value;}stop(){this.stopped=true;}}
  const h=interfaceHarness({window:{AudioContext,Audio:class{},BattleWeaponAudio:WeaponAudio,BattleEngineAudio:EngineAudio}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();assert.equal(loops.length,2);
  h.elements['launch-practice'].onclick();h.sim.player.speed=-90;h.step(60);
  assert.equal(loops[0].state.speed,h.sim.player.speed);assert.equal(loops[1].state.speed,h.sim.enemy.speed);
  assert.notEqual(loops[0].state.speed,loops[1].state.speed);assert(loops.every(loop=>loop.state.active));
  h.elements.pause.onclick();h.step(120);assert(loops.every(loop=>!loop.state.active));
  await h.elements.audio.onclick();assert(loops.every(loop=>loop.enabled===false));
  h.handlers.blur();assert(loops.every(loop=>loop.stopped));
});

test('blocked audio stays visibly off instead of claiming playback started',async()=>{
  class AudioContext{constructor(){this.currentTime=0;this.destination={};}async resume(){throw new Error('blocked');}createOscillator(){return {frequency:{},connect(node){return node;},start(){}};}createGain(){return {gain:{setTargetAtTime(){}},connect(){}};}}
  const h=interfaceHarness({window:{AudioContext}});h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();assert.equal(h.elements['audio-label'].textContent,'Audio off');assert.match(h.elements.toast.textContent,/Audio could not start/);
});

test('audio defaults on and unlocks once on first interaction; mute stays off',async()=>{
  let contexts=0,resumes=0,enabled=0;
  class AudioContext{constructor(){contexts++;this.state='suspended';}async resume(){resumes++;this.state='running';}}
  class WeaponAudio{setEnabled(value){if(value)enabled++;}stopAll(){}}
  const h=interfaceHarness({window:{AudioContext,BattleWeaponAudio:WeaponAudio}});
  assert.equal(h.elements['audio-label'].textContent,'Audio on');assert.equal(h.elements.audio.attrs['aria-pressed'],'true');assert.equal(contexts,0);
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();assert.equal(contexts,1);assert.equal(resumes,1);assert.equal(enabled,1);
  h.handlers['document:pointerdown']();assert.equal(resumes,1);
  await h.elements.audio.onclick();h.handlers['document:pointerdown']();assert.equal(h.elements['audio-label'].textContent,'Audio off');assert.equal(resumes,1);
});

 test('Plan Attack opens the planner from the start screen and waits for a committed plan',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});
  assert.equal(e['launch-card'].hidden,false);
  assert.equal(e['plan-attack'].disabled,false);
  e['difficulty-admiral'].onclick();e['plan-attack'].onclick();
  assert.equal(e['plan-wizard'].open,true);
  assert.equal(e['launch-card'].hidden,true);
  assert.equal(sim.maneuvering,false);assert.equal(sim.turn.orders,null);
  const time=sim.time;step(60);assert.equal(sim.time,time);
  assert.equal(sim.difficulty,'admiral');
  e['preset-strong'].onclick();e['wizard-commit'].onclick();
  assert.equal(e['plan-wizard'].open,false);assert.equal(sim.maneuvering,true);
 });

test('Reset clears the complete planner draft and permits a fresh plan without changing live orders',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e['plan-attack'].onclick();
  const original=JSON.stringify(sim.turn);
  e['preset-aggressive'].onclick();assert.equal(e['wizard-commit'].disabled,false);
  e['target-bridge'].onclick();e['attack-range'].oninput({target:{value:'700'}});
  e['wizard-reset'].onclick();
  assert.equal(e['plan-wizard'].open,true);assert.equal(e['wizard-commit'].disabled,true);
  assert.equal(e['done-maneuvers'].disabled,true);assert.equal(e['attack-range'].value,1000);
  for(const style of ['timid','disabling','strong','aggressive','berserk'])assert.equal(e['preset-'+style].attrs['aria-pressed'],'false');
  for(const key of Object.keys(B.maneuvers))assert.equal(e['maneuver-'+key].attrs['aria-pressed'],'false');
  for(const target of Object.keys(B.targets))assert.equal(e['target-'+target].attrs['aria-pressed'],'false');
  for(const weapon of ['phaser','torpedo'])assert.equal(e['choose-'+weapon].attrs['aria-pressed'],'false');
  for(let i=0;i<3;i++){assert.equal(e['route-label-'+i].textContent,'Choose maneuver');assert.equal(e['plan-step-'+i].disabled,true);}
  assert.equal(JSON.stringify(sim.turn),original);
  e['wizard-reset'].onclick();e['preset-strong'].onclick();e['wizard-commit'].onclick();
  assert(sim.maneuvering);e['open-planner'].onclick();assert.equal(e['wizard-reset'].disabled,true);
  const live=JSON.stringify(sim.turn);e['wizard-reset'].onclick();assert.equal(JSON.stringify(sim.turn),live);
});

test('Reset clears partial maneuver choices and Cancel preserves the original plan',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e['plan-attack'].onclick();
  const original=JSON.stringify(sim.turn);e['maneuver-port'].onclick();e['wizard-reset'].onclick();
  assert.equal(e['done-maneuvers'].disabled,true);assert.equal(e['wizard-error'].textContent,'');
  e['wizard-cancel'].onclick();assert.equal(JSON.stringify(sim.turn),original);
});

 test('Keep your distance can be selected, committed, and reset in the attack planner',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e['plan-attack'].onclick();
  e['maneuver-distance'].onclick();assert.equal(e['route-label-0'].textContent,'Keep your distance');
  e['wizard-reset'].onclick();assert.equal(e['maneuver-distance'].attrs['aria-pressed'],'false');
  e['preset-strong'].onclick();e['maneuver-step'].onclick();e['route-stage-0'].onclick();e['maneuver-distance'].onclick();
  e['wizard-commit'].onclick();assert.equal(sim.turn.maneuver,'distance');assert.equal(sim.maneuvering,true);
 });

test('Ram, Close battle and Chase can each be selected, reset and committed from the planner',()=>{
  for(const key of ['ram','close','chase']){
    const {sim,elements:e}=interfaceHarness({turnBased:true});e['plan-attack'].onclick();
    e['maneuver-'+key].onclick();assert.equal(e['route-label-0'].textContent,B.maneuvers[key].name);
    e['wizard-reset'].onclick();assert.equal(e['maneuver-'+key].attrs['aria-pressed'],'false');
    e['preset-strong'].onclick();e['maneuver-step'].onclick();e['route-stage-0'].onclick();e['maneuver-'+key].onclick();
    e['wizard-commit'].onclick();assert.equal(sim.turn.maneuver,key);assert(sim.maneuvering);
  }
});


test('Yorktown strategy toggles and follows the actual attack plan through execution and reset',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});
  assert.equal(e['yorktown-strategy-details'].hidden,true);
  e['toggle-yorktown-strategy'].onclick();
  assert.equal(e['yorktown-strategy-details'].hidden,false);
  assert.equal(e['toggle-yorktown-strategy'].attrs['aria-expanded'],'true');
  assert.equal(e['toggle-yorktown-strategy'].textContent,'Hide Strategy');
  assert.match(e['yorktown-strategy-orders'].children[0].textContent,/after Commit/);
  e['quick-battle'].onclick();
  const orders=sim.turn.enemyOrders;
  assert.equal(e['yorktown-strategy-orders'].children.length,1);
  assert.match(e['yorktown-strategy-orders'].children[0].children[1].textContent,/NEXT/);
  sim.running=false;orders[0].status='fired';orders[1].target='engines';orders[1].range=1250;
  sim.enemyMind.evadeUntil=sim.time+10;step(150);
  assert.equal(e['yorktown-strategy-tactic'].textContent,'Evasive maneuver');assert.equal(e['yorktown-personality'].value,sim.enemyPersonality);
  assert.equal(e['yorktown-strategy-orders'].children.length,1);
  assert.match(e['yorktown-strategy-orders'].children[0].children[1].textContent,/12.5 km \/ NEXT/);
  assert(e['yorktown-strategy-orders'].children[0].children[0].textContent.includes(B.targets.engines));
  e['toggle-yorktown-strategy'].onclick();
  assert.equal(e['yorktown-strategy-details'].hidden,true);
  assert.equal(e['toggle-yorktown-strategy'].textContent,'Show Strategy');
  e['toggle-yorktown-strategy'].onclick();e.rematch.onclick();
  assert.match(e['yorktown-strategy-orders'].children[0].textContent,/after Commit/);
});


test('Yorktown shows the current attack out of the actual plan total',()=>{
  const {sim,elements:e,step}=interfaceHarness({turnBased:true});
  assert.equal(e['yorktown-plan-progress'].hidden,true);
  e['quick-battle'].onclick();sim.running=false;
  assert.equal(e['yorktown-plan-progress'].hidden,false);
  assert.equal(e['yorktown-plan-progress'].textContent,'ATTACK 1 OF 3');
  sim.turn.enemyOrders[0].status='fired';step(150);
  assert.equal(e['yorktown-plan-progress'].textContent,'ATTACK 2 OF 3');
  sim.turn.enemyOrders[1].status='fired';step(300);
  assert.equal(e['yorktown-plan-progress'].textContent,'ATTACK 3 OF 3');
  sim.turn.enemyOrders[2].status='fired';step(450);
  assert.equal(e['yorktown-plan-progress'].textContent,'ATTACK 3 OF 3');
  e.rematch.onclick();assert.equal(e['yorktown-plan-progress'].hidden,true);
});


test('Every quick setting returns to maneuver review even when selected from an attack page',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
  for(const style of ['timid','disabling','strong','aggressive','berserk']){
    e['preset-strong'].onclick();e['plan-step-1'].onclick();
    assert.equal(e['plan-wizard'].attrs['data-view'],'attacks');
    e['preset-'+style].onclick();
    assert.equal(e['plan-wizard'].attrs['data-view'],'maneuvers');
    assert.equal(e['maneuver-choice'].hidden,false);assert.equal(e['shot-choice'].hidden,true);
    assert.equal(e['preset-'+style].attrs['aria-pressed'],'true');
    assert.equal(e['wizard-commit'].disabled,false);
    assert.equal(sim.turn.orders,null,'preset remains staged for review');
  }
});


test('Number pad Enter restores default camera and Enterprise orientation without restarting flight',()=>{
  const {sim,scene,handlers,key,elements:e}=interfaceHarness();
  sim.running=false;Object.assign(sim.player,{heading:170,pitch:45,bank:.5,turnRate:8,pitchRate:6,speed:80});scene.mode='tactical';
  const position=[sim.player.x,sim.player.y,sim.player.z];
  handlers.keydown(key('Enter','NumpadEnter'));
  assert.equal(scene.mode,'chase');
  for(const field of ['heading','pitch','bank','turnRate','pitchRate'])assert.equal(sim.player[field],0);
  assert.deepEqual([sim.player.x,sim.player.y,sim.player.z],position);assert.equal(sim.player.speed,80);assert.equal(sim.running,false);
  sim.player.heading=90;handlers.keydown({...key('Enter','NumpadEnter'),ctrlKey:true});assert.equal(sim.player.heading,90);
  e['plan-wizard'].open=true;handlers.keydown(key('Enter','NumpadEnter'));assert.equal(sim.player.heading,90);e['plan-wizard'].open=false;
  handlers.keydown({...key('Enter'),location:3});assert.equal(sim.player.heading,0);
  handlers.keydown(key('Enter','Enter'));assert.equal(sim.running,true,'main Enter still starts the simulation');
});


test('helm conversations follow event order and clear on reset',()=>{
  const h=interfaceHarness({turnBased:true}),e=h.elements;
  assert.equal(e['helm-reply'].textContent,'');
  e['quick-battle'].onclick();h.step(60);
  assert.equal(e['helm-dialogue'].hidden,false);
  assert.match(e['helm-order'].textContent,/port/);assert.equal(e['captain-dialogue'].hidden,false);
  assert.match(e['helm-reply'].textContent,/Coming to port/);
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:5});h.step(120);
  assert.match(e['helm-reply'].textContent,/Hull hit/);assert.equal(e['helm-order'].textContent,'');assert.equal(e['captain-dialogue'].hidden,true);
  h.sim.finishPass();h.step(180);
  assert.match(e['helm-reply'].textContent,/Awaiting orders/,'without audio, the next completed event can display immediately');
  for(let i=4;i<110;i++)h.step(i*60);
  assert.match(e['helm-reply'].textContent,/Awaiting orders/);
  e['quick-rematch'].onclick();h.step(6700);
  assert.match(e['helm-reply'].textContent,/Coming to port/,'new engagement clears old dialogue and cooldowns');
});

test('incoming torpedo alerts disappear with the projectile and cannot play late from the dialogue queue',()=>{
  for(const queued of [false,true]){
    const h=interfaceHarness();h.elements.start.onclick();h.sim.aiShot=Infinity;h.sim.aiTorp=Infinity;
    Object.assign(h.sim.player,{x:10000,y:0,z:0});Object.assign(h.sim.enemy,{x:10000,y:0,z:-1500});
    h.sim.projectiles.push({id:'incoming-test',from:'Yorktown',target:'Enterprise',pos:{x:10000,y:0,z:-1000},life:0,maxLife:8,strength:1,heading:180,pitch:0});
    if(queued)h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:1});
    h.sim.events.push({type:'launch',from:'Yorktown',to:'Enterprise'});
    h.step(60);
    assert.equal(h.elements['helm-reply'].textContent,queued?'Hull hit!':'Torpedo incoming!');
    h.sim.projectiles=[];h.step(120);
    if(!queued)assert.equal(h.elements['helm-dialogue'].hidden,true,'a resolved torpedo no longer shows as incoming');
    for(let i=3;i<115;i++){
      h.step(i*60);
      assert(h.elements['helm-dialogue'].hidden||h.elements['helm-reply'].textContent!=='Torpedo incoming!','an expired queued alert never appears later');
    }
  }
});

test('incoming warnings require a nearby closing trajectory, sensors, and an unobstructed path',()=>{
  for(const mode of ['incoming','passed','wide','distant','blind','blocked','practice','no-projectile']){
    const h=interfaceHarness({turnBased:true});h.sim.tick=()=>{};
    Object.assign(h.sim.player,{x:6000,y:0,z:0,heading:0,pitch:0,speed:0});
    Object.assign(h.sim.enemy,{x:6000,y:0,z:-1800});
    h.elements['quick-battle'].onclick();h.step(3060);
    const shot={id:mode,from:'Yorktown',target:'Enterprise',pos:{x:6000,y:0,z:-900},heading:180,pitch:0,life:0,maxLife:8};
    if(mode==='passed')shot.heading=0;
    if(mode==='wide')shot.pos.x+=500;
    if(mode==='distant')shot.pos.z=-1700;
    if(mode==='blind')h.sim.player.integrity.sensors=0;
    if(mode==='blocked')h.sim.stationTrace=()=>({t:.5});
    if(mode==='practice')shot.practice=true;
    if(mode!=='no-projectile')h.sim.projectiles.push(shot);
    h.sim.events.push({type:'launch',from:'Yorktown',to:'Enterprise'});h.step(3120);
    assert.equal(h.elements['helm-reply'].textContent==='Torpedo incoming!',mode==='incoming',mode);
    if(mode==='distant'){
      shot.pos.z=-900;h.step(3180);
      assert.equal(h.elements['helm-reply'].textContent,'Torpedo incoming!','a far launch is announced only when it becomes a nearby threat');
    }
  }
});

test('a torpedo that turns away while queued is silent and a cleared active warning stops playing',()=>{
  for(const queued of [true,false]){
    const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
    Object.assign(h.sim.player,{x:6000,y:0,z:0,heading:0,pitch:0,speed:0});
    h.elements['quick-battle'].onclick();h.step(3060);
    if(!queued){players.at(-1).onended();h.runTimers();players.at(-1).onended();}
    const shot={id:'turn-away',from:'Yorktown',target:'Enterprise',pos:{x:6000,y:0,z:-900},heading:180,pitch:0,life:0,maxLife:8};
    h.sim.projectiles.push(shot);h.step(3120);
    const alert=players.find(audio=>audio.url.includes('Torpedo incoming'));
    assert.equal(!!alert,!queued);
    shot.heading=0;h.step(3180);
    if(queued){
      players.at(-1).onended();h.runTimers();players.at(-1).onended();h.step(3240);
      assert(!players.some(audio=>audio.url.includes('Torpedo incoming')));
    }else assert.equal(alert.paused,true);
  }
});

test('Hull hit ignores shield-only, enemy and practice impacts and expires behind a long conversation',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:5});h.step(3120);
  h.step(6200);players.at(-1).onended();h.runTimers();players.at(-1).onended();h.step(6260);
  assert(!players.some(audio=>audio.url.includes('Hull hit')),'expired hull damage must not be narrated later');
  const before=players.length;
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:0},{type:'impact',ship:'Yorktown',hullDamage:5},{type:'impact',ship:'Enterprise',hullDamage:5,practice:true});h.step(6320);
  assert.equal(players.length,before);
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:5});h.step(6380);
  assert.equal(players.at(-1).url,'assets/Hull hit!_Erica.mp3','a fresh confirmed hit still plays');
});

test('free flight helm acknowledges manual control and repeated warnings are spaced out',()=>{
  const h=interfaceHarness(),e=h.elements;
  e['launch-practice'].onclick();h.step(60);assert.match(e['helm-reply'].textContent,/Manual control/);
  h.sim.message('HELM','Cloud-top clearance reached.');h.step(120);
  assert.match(e['helm-reply'].textContent,/Cloud-top/);
  h.sim.message('HELM','Cloud-top clearance reached.');h.step(180);
  for(let i=4;i<115;i++)h.step(i*60);
  assert.equal(e['helm-dialogue'].hidden,true,'the same warning is not queued repeatedly');
});


test('Free Flight keeps helm replies but skips all captain commands and weapon lead-ins',async()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};let commands=0;
  vm.createContext(manifest);vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){}}
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}playPhaser(){}playTorpedo(){}}
  class FiringVoices{prepare(){commands++;return false;}stop(){}}
  const h=interfaceHarness({voiceClips:manifest.window.BattleVoiceClips,window:{Audio,AudioContext,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:FiringVoices}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.elements['launch-practice'].onclick();h.step(60);
  assert.equal(players[0].url,'assets/Manual control. Standing by_Erica.mp3');assert.equal(h.elements['helm-order'].textContent,'');
  h.elements.phaser.onclick();h.elements.torpedo.onclick();
  assert.equal(h.sim.shots,2);assert.equal(commands,0);assert.equal(players.length,1);
});

test('dialogue mute stops voices while keeping weapons and ambience enabled, and unmute restores speech',async()=>{
  const players=[],loops=[],changes=[],manifest={window:{BattleVoiceClips:{}}};let shots=0;
  vm.createContext(manifest);vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(value){changes.push(value);}stopAll(){}playPhaser(){shots++;}}
  class Loop{constructor(){loops.push(this);}setEnabled(value){this.enabled=value;}update(){}stop(){}}
  const firing={window:{Audio}};vm.createContext(firing);vm.runInContext(fs.readFileSync(path.join(root,'firing-voices.js'),'utf8'),firing);
  const h=interfaceHarness({voiceClips:manifest.window.BattleVoiceClips,window:{AudioContext,Audio,BattleWeaponAudio:WeaponAudio,BattleEngineAudio:Loop,BattleViewscreenAudio:Loop,BattleFiringVoices:firing.window.BattleFiringVoices}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.elements['launch-practice'].onclick();h.step(60);assert(players.length>0);
  const playing=players.at(-1),before=players.length,changesBefore=changes.length;
  h.elements['voices-mute'].onclick();assert.equal(playing.paused,true);
  assert.equal(h.elements['voices-mute'].attrs['aria-pressed'],'true');assert.equal(h.elements['voices-mute'].attrs['aria-label'],'Unmute voices');
  assert.equal(h.elements['audio-label'].textContent,'Audio on');assert(loops.every(loop=>loop.enabled));assert.equal(changes.length,changesBefore);
  h.elements.phaser.onclick();h.step(120);assert.equal(h.sim.shots,1);assert.equal(shots,1);assert.equal(players.length,before,'muted fire commands do not delay shots or play clips');
  h.elements['voices-mute'].onclick();assert.equal(h.elements['voices-mute'].attrs['aria-pressed'],'false');
  h.sim.events.push({type:'warp'});h.step(180);assert.equal(players.at(-1).url,'assets/Warp complete_Erica.mp3');
});

test('voice mute stops recorded speech and releases a pending firing command without losing the manual shot',async()=>{
  const players=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}playPhaser(){}playHit(){}playBreak(){}}
  const firing={window:{Audio}};vm.createContext(firing);vm.runInContext(fs.readFileSync(path.join(root,'firing-voices.js'),'utf8'),firing);
  const h=renderedHarness(players,{window:{AudioContext,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:firing.window.BattleFiringVoices}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.elements['launch-practice'].onclick();h.step(60);assert(players.length>0);
  const active=players.at(-1);h.elements['voices-mute'].onclick();assert(active.paused);
  h.sim.freeFlight=false;Object.assign(h.sim.enemy,{x:h.sim.player.x,y:h.sim.player.y,z:h.sim.player.z-600});
  Object.assign(h.sim.station,{x:1e6,y:1e6,z:1e6,parts:[]});
  h.elements['voices-mute'].onclick();h.elements.phaser.onclick();assert.equal(h.sim.shots,0);
  h.step(120);
  const clip=players.at(-1),late=clip.onended;h.elements['voices-mute'].onclick();assert.equal(clip.paused,true);
  late();h.step(180);assert.equal(h.sim.shots,1,'voice mute allows the pending shot to proceed silently');
});

test('skipping maneuvers announces continuation and finishes without an automatic breakaway',()=>{
  for(const reason of ['stall','timeout']){
    const h=interfaceHarness({turnBased:true});h.sim.tick=()=>{};h.elements['quick-battle'].onclick();h.step(60);h.sim.fire=()=>false;
    if(reason==='stall')h.sim.turn.navigation.relativeStalled=true;else h.sim.turn.remaining=0;
    h.sim.advanceTurn(0);assert.equal(h.sim.turn.stageIndex,1);h.step(120);
    assert.equal(h.elements['helm-reply'].textContent,reason==='stall'?'No relative movement. Next maneuver.':'Course updated.');
    h.step(180);h.sim.turn.maneuvers[2]='ram';h.sim.startStage(2);h.step(240);
    h.sim.turn.remaining=0;h.sim.enemyRetreating=true;h.sim.advanceTurn(0);h.sim.time+=.5;h.sim.advanceTurn(.5);assert.equal(h.sim.turn.phase,'review');h.step(300);
    assert.equal(h.elements['helm-reply'].textContent,'Maneuvers complete. Awaiting orders.');
  }
});

test('queued breakaway audio is discarded after the next turn begins',()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};vm.createContext(manifest);
  vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){}}
  const h=interfaceHarness({turnBased:true,voiceClips:manifest.window.BattleVoiceClips,window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);h.sim.endPass();h.step(3120);
  h.elements['quick-battle'].onclick();h.step(3180);
  players[0].onended();h.runTimers();players[1].onended();h.step(3240);
  assert(!players.some(audio=>/Breaking away/.test(audio.url)),'an old breakaway order cannot play over a new maneuver');
});

test('ending an action queues Erica Breaking away after the current exchange',()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};vm.createContext(manifest);
  vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  const h=interfaceHarness({turnBased:true,voiceClips:manifest.window.BattleVoiceClips,window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);h.elements['end-pass'].onclick();h.step(3120);
  assert.equal(players.length,1,'the abort announcement does not interrupt the captain');
  players[0].onended();h.runTimers();players[1].onended();h.step(3180);
  assert.equal(players.at(-1).url,'assets/Breaking away_Erica.mp3');assert.equal(h.elements['helm-reply'].textContent,'Breaking away.');
  assert(players.every(audio=>!audio.paused));
});

test('bursts of dialogue finish in event order without timeouts, interruption, or dropping repeated lines',()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};vm.createContext(manifest);
  vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  const h=interfaceHarness({turnBased:true,voiceClips:manifest.window.BattleVoiceClips,window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);
  h.sim.events.push({type:'message',station:'HELM',text:'Updated flight maneuvers applied.'},{type:'impact',ship:'Enterprise',hullDamage:1},{type:'warp'},{type:'message',station:'HELM',text:'Cloud-top clearance reached. Deflecting to keep Enterprise above the atmosphere.'},{type:'impact',ship:'Enterprise',hullDamage:1});
  h.step(23000);assert.equal(players.length,1);assert.notEqual(players[0].paused,true,'even long-running dialogue is not cut short');
  players[0].onended();h.runTimers();assert.equal(players[1].url,'assets/Coming to port_Allison.mp3');
  h.step(23060);assert.equal(players.length,2,'the helm reply also finishes before queued events');
  players[1].onended();let now=23120;
  for(const expected of ['assets/Course updated_Erica.mp3','assets/Hull hit!_Erica.mp3','assets/Warp complete_Erica.mp3','assets/Cloud tops. Correcting altitude_Erica.mp3','assets/Hull hit!_Erica.mp3']){
    h.step(now);now+=60;assert.equal(players.at(-1).url,expected);assert(players.every(audio=>!audio.paused));players.at(-1).onended();
  }
  assert.equal(players.length,7,'all five queued events survive a long backlog, including repeated hits');
});

test('opening voice silence never delays shots or narrates old firing orders later',async()=>{
  const players=[],started=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){started.push(this.url);return Promise.resolve();}pause(){this.paused=true;}}
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}playPhaser(){}playTorpedo(){}playHit(){}}
  const firing={window:{Audio}};vm.createContext(firing);vm.runInContext(fs.readFileSync(path.join(root,'firing-voices.js'),'utf8'),firing);
  const h=interfaceHarness({turnBased:true,voiceClips:{'captain\nCome to port.':'captain.mp3','helm\nComing to port.':'helm.mp3'},window:{Audio,AudioContext,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:firing.window.BattleFiringVoices}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(60);h.sim.turnBased=false;
  Object.assign(h.sim.player,{x:10000,y:0,z:0,heading:0});Object.assign(h.sim.enemy,{x:10000,y:0,z:-600});
  h.elements.phaser.onclick();h.elements.torpedo.onclick();assert.equal(h.sim.shots,2);
  h.step(2999);assert.deepEqual(started,[]);
  h.step(3000);assert.deepEqual(started,['captain.mp3']);
  players.find(audio=>audio.url==='captain.mp3').onended();h.runTimers();players.find(audio=>audio.url==='helm.mp3').onended();
  h.step(3060);h.step(3120);assert.deepEqual(started,['captain.mp3','helm.mp3']);
  assert.equal(h.sim.shots,2,'opening shots are not repeated or announced after they already happened');
});

test('firing commands share the voice queue and rapid manual requests each retain their shot',async()=>{
  const players=[],started=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){started.push(this.url);return Promise.resolve();}pause(){this.paused=true;}}
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}playPhaser(){}playTorpedo(){}playHit(){}}
  const firing={window:{Audio}};vm.createContext(firing);vm.runInContext(fs.readFileSync(path.join(root,'firing-voices.js'),'utf8'),firing);
  const h=interfaceHarness({turnBased:true,voiceClips:{'captain\nCome to port.':'captain.mp3','helm\nComing to port.':'helm.mp3'},window:{Audio,AudioContext,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:firing.window.BattleFiringVoices}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);h.sim.turnBased=false;
  Object.assign(h.sim.player,{x:10000,y:0,z:0,heading:0});Object.assign(h.sim.enemy,{x:10000,y:0,z:-600});
  h.elements.phaser.onclick();h.elements.torpedo.onclick();h.step(3120);
  assert.deepEqual(started,['captain.mp3']);assert.equal(h.sim.shots,0);
  players[0].onended();h.runTimers();players.find(audio=>audio.url==='helm.mp3').onended();h.step(3180);
  assert.equal(started.at(-1),'assets/Fire phasers.mp3');assert.equal(h.sim.shots,1);
  players.find(audio=>audio.url==='assets/Fire phasers.mp3').onended();h.step(3240);assert.equal(h.sim.shots,2);
  assert.equal(h.sim.player.torpedoes,23);assert(h.sim.projectiles.some(shot=>shot.from==='Enterprise'&&shot.target==='Yorktown'),'the spoken torpedo command has a live launched projectile');
  h.step(3300);assert.equal(started.at(-1),'assets/Fire torpedo.mp3');
  players.find(audio=>audio.url==='assets/Fire torpedo.mp3').onended();h.step(3360);assert.equal(h.sim.shots,2);
  assert.deepEqual(started,['captain.mp3','helm.mp3','assets/Fire phasers.mp3','assets/Fire torpedo.mp3']);assert(players.every(audio=>!audio.paused));
});

test('expired firing opportunities cannot produce spoken torpedo orders or block later valid requests',async()=>{
  for(const mode of ['manual-range','scheduled-ended']){
    const players=[],started=[];
    class Audio{constructor(url){this.url=url;players.push(this);}play(){started.push(this.url);return Promise.resolve();}pause(){}}
    class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
    class WeaponAudio{setEnabled(){}stopAll(){}playPhaser(){}playTorpedo(){}playHit(){}}
    const firing={window:{Audio}};vm.createContext(firing);vm.runInContext(fs.readFileSync(path.join(root,'firing-voices.js'),'utf8'),firing);
    const h=interfaceHarness({turnBased:true,voiceClips:{'captain\nCome to port.':'captain.mp3','helm\nComing to port.':'helm.mp3'},window:{Audio,AudioContext,BattleWeaponAudio:WeaponAudio,BattleFiringVoices:firing.window.BattleFiringVoices}});
    h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();h.sim.tick=()=>{};
    h.elements['quick-battle'].onclick();h.step(3060);
    Object.assign(h.sim.player,{x:10000,y:0,z:0,heading:0});Object.assign(h.sim.enemy,{x:10000,y:0,z:-600});
    if(mode==='manual-range'){
      h.sim.turnBased=false;h.elements.torpedo.onclick();h.sim.enemy.z=-5000;
    }else{
      h.sim.turn.navigation.stage='attack';h.sim.turn.orders[0].weapon=h.sim.turn.draft[0].weapon='torpedo';
      assert.equal(h.sim.fire('torpedo',h.sim.player,h.sim.enemy,true),false);assert.equal(h.sim.endPass(),true);
    }
    h.step(3120);players[0].onended();h.runTimers();players.find(audio=>audio.url==='helm.mp3').onended();h.step(3180);
    assert.deepEqual(started,['captain.mp3','helm.mp3']);assert.equal(h.sim.shots,0);assert.equal(h.sim.player.torpedoes,24);
    if(mode==='manual-range'){
      h.sim.enemy.z=-600;h.elements.torpedo.onclick();h.step(3240);
      assert.equal(h.sim.shots,1);assert.equal(started.at(-1),'assets/Fire torpedo.mp3');assert.equal(h.sim.projectiles.length,1);
    }
  }
});

test('engine-loss reports wait half a second then play over a captain command and outrank queued chatter',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);const captain=players.at(-1);
  assert.match(captain.url,/_Declan\.mp3$/);
  h.sim.events.push({type:'warp'},{type:'impact',ship:'Enterprise',hullDamage:1},{type:'nacelle-detached',ship:'Enterprise',side:'port'});
  h.step(3120);assert.equal(players.at(-1),captain);
  h.step(3619);assert.equal(players.at(-1),captain,'alert waits the full half second');
  h.step(3620);const alert=players.at(-1);
  assert.equal(alert.url,"assets/We've lost the port engine!_Allision.mp3");
  assert.notEqual(captain.paused,true,'the urgent report can speak over the command');
  assert.equal(h.elements['helm-reply'].textContent,"We've lost the port engine!");
  assert.equal(h.elements['helm-speaker'].textContent,'HELM (Allison)');
  h.sim.events.push({type:'nacelle-detached',ship:'Enterprise',side:'starboard'});h.step(3680);h.step(4180);
  assert.equal(players.at(-1),alert,'the second engine alert waits for the first');
  alert.onended();h.step(4240);
  assert.equal(players.at(-1).url,"assets/We've lost the starboard engine!_Allision.mp3");
  assert.equal(h.elements['helm-reply'].textContent,"We've lost the starboard engine!");
  const record=h.sim.replayRecording.record.events.filter(e=>e.event.type==='bridge-dialogue'&&/lost the .* engine/.test(e.event.reply));
  assert.equal(record.length,2,'each urgent report is recorded when it plays');
});

test('engine-loss alerts bypass opening silence and stop with voice mute or Enterprise destruction',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(60);assert.equal(players.length,0);
  h.sim.events.push({type:'nacelle-detached',ship:'Enterprise',side:'port'});h.step(120);assert.equal(players.length,0);h.step(619);assert.equal(players.length,0);h.step(620);
  const port=players.at(-1);assert.equal(port.url,"assets/We've lost the port engine!_Allision.mp3");
  h.elements['voices-mute'].onclick();assert.equal(port.paused,true);
  const count=players.length;h.sim.events.push({type:'nacelle-detached',ship:'Enterprise',side:'starboard'});h.step(680);
  assert.equal(players.length,count);h.elements['voices-mute'].onclick();h.step(740);
  assert.equal(players.length,count,'muted alerts are not spoken late');
  h.sim.events.push({type:'nacelle-detached',ship:'Enterprise',side:'starboard'});h.step(800);h.step(1300);
  const starboard=players.at(-1);assert.equal(starboard.url,"assets/We've lost the starboard engine!_Allision.mp3");
  h.sim.events.push({type:'destroyed',ship:'Enterprise'});h.sim.result='defeat';h.step(1360);
  assert.equal(starboard.paused,true);assert.equal(players.at(-1).url,'assets/Helm lost!_Erica.mp3');
});

test('replay engine-loss reports overlap recorded dialogue and remain muted when replay pauses',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.replay.active=true;h.replay.player={paused:false,ended:false,state:{player:h.sim.player,enemy:h.sim.enemy}};h.replay.tick=()=>{};
  h.replay.options.dialogue({order:'Come to port.',reply:'',speaker:'captain'});h.step(60);
  const captain=players.at(-1);assert.equal(captain.url,'assets/Come to port_Declan.mp3');
  h.replay.options.dialogue({order:'',reply:"We've lost the port engine!",speaker:'allison'});h.step(120);
  const alert=players.at(-1);assert.equal(alert.url,"assets/We've lost the port engine!_Allision.mp3");
  assert.notEqual(captain.paused,true);
  h.replay.player.paused=true;h.step(180);assert.equal(alert.paused,true);
});

test('Enterprise destruction immediately plays Helm lost and silences every other voice until a new game',()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};vm.createContext(manifest);
  vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  const h=interfaceHarness({turnBased:true,voiceClips:manifest.window.BattleVoiceClips,window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);const interrupted=players[0],stale=interrupted.onended;
  h.sim.events.push({type:'warp'},{type:'message',station:'HELM',text:'Updated flight maneuvers applied.'});h.step(3120);
  for(const arc of B.arcs)h.sim.player.shields[arc]=0;h.sim.player.hull=1;h.sim.damage(h.sim.player,h.sim.enemy,999,'torpedo','hull');h.step(3180);
  assert.equal(interrupted.paused,true);assert.equal(players.length,2);assert.equal(players[1].url,'assets/Helm lost!_Erica.mp3');
  assert.equal(h.elements['helm-reply'].textContent,'Helm lost!');
  stale();h.runTimers();players[1].onended();
  h.sim.events.push({type:'warp'},{type:'phase',phase:'review'},{type:'destroyed',ship:'Yorktown'},{type:'impact',ship:'Enterprise',hullDamage:1});
  h.step(3240);h.runTimers();assert.equal(players.length,2,'no queued or later voice follows Helm lost');
  h.elements['quick-rematch'].onclick();h.step(6240);assert.equal(players.at(-1).url,'assets/Come to port_Declan.mp3');
});

test('fatal damage during the opening voice delay still announces Helm lost immediately',()=>{
  const players=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){}}
  const h=interfaceHarness({turnBased:true,voiceClips:{'helm\nHelm lost!':'assets/Helm lost!_Erica.mp3'},window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(60);assert.equal(players.length,0);
  for(const arc of B.arcs)h.sim.player.shields[arc]=0;h.sim.player.hull=1;h.sim.damage(h.sim.player,h.sim.enemy,999,'torpedo','hull');h.step(120);
  assert.equal(players.length,1);assert.equal(players[0].url,'assets/Helm lost!_Erica.mp3');
});

test('damage warnings play the selected Erica recording through the real dialogue player and obey mute',async()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};vm.createContext(manifest);
  vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  const h=interfaceHarness({turnBased:true,voiceClips:manifest.window.BattleVoiceClips,window:{Audio}});
  h.elements['quick-battle'].onclick();h.step(3060);
  h.sim.player.integrity.sensors=0;h.step(3120);
  assert.equal(players.length,1,'damage cannot interrupt the captain');
  players[0].onended();h.runTimers();players[1].onended();h.step(3180);
  assert.equal(players.at(-1).url,'assets/Sensors are offline.mp3');
  assert.equal(h.elements['helm-reply'].textContent,'Sensors are offline');
  await h.elements.audio.onclick();assert.equal(players.at(-1).paused,true);
  const count=players.length;h.sim.player.integrity.weapons=0;h.step(3240);
  assert.equal(players.length,count,'muted system failures never start an audio clip');
});

test('captain and helm recordings play by default, respect mute, and resume for new dialogue',async()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);
  assert.equal(h.elements['helm-dialogue'].hidden,false);assert.match(players.at(-1).url,/_Declan.mp3$/);
  players.at(-1).onended();h.runTimers();assert.match(players.at(-1).url,/_Allison.mp3$/);
  const active=players.at(-1),before=players.length;h.elements['voices-mute'].onclick();assert(active.paused);
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:5});h.step(3120);assert.equal(players.length,before);
  h.elements['voices-mute'].onclick();h.sim.events.push({type:'destroyed',ship:'Yorktown'});h.step(3180);
  assert.equal(players.at(-1).url,'assets/Yorktown disabled_Erica.mp3');
});

 test('Engineering displays reserve percentage, accessible meter, low warning and paused flow',()=>{
 const h=interfaceHarness(),{sim,elements:e}=h;sim.player.energyReserve=12.3;sim.running=false;h.step(3240);
 assert.equal(e['energy-reserve-value'].textContent,'12.3%');assert.equal(e['energy-reserve-meter'].attrs['aria-valuenow'],'12.3');assert.equal(e['energy-reserve-bar'].style.width,'12.3%');
 assert.match(e['energy-reserve-status'].textContent,/CRITICAL/);assert.equal(e['energy-reserve-rate'].textContent,'0.0% / s');
 sim.player.energyReserve=70;sim.running=true;h.step(3480);assert.match(e['energy-reserve-status'].textContent,/RECHARGING/);assert.match(e['energy-reserve-rate'].textContent,/^\+/);
 });


test('fight music is silent in live gameplay and enabled during replay playback only',()=>{
  const updates=[];
  class IntroAudio{setEnabled(){}playOnce(){}reset(){}update(state){updates.push(state);}}
  const h=interfaceHarness({turnBased:true,window:{Audio:class{},BattleIntroAudio:IntroAudio}}),{sim,elements:e,replay}=h;
  e['random-turn'].onclick();h.step(120);assert.equal(updates.at(-1).musicActive,false);assert.equal(updates.at(-1).active,true,'opening cue remains enabled');
  sim.tick(.1);sim.finishPass();sim.running=false;h.step(240);assert.equal(updates.at(-1).musicActive,false);assert.equal(updates.at(-1).fadeMusic,false);
  e['replay-last-pass'].onclick();h.step(360);assert.equal(updates.at(-1).musicActive,true);assert.equal(updates.at(-1).replay,true);assert.equal(updates.at(-1).active,false,'opening cue stays paused in replay');
  e['replay-play'].onclick();h.step(480);assert.equal(replay.player.paused,true);assert.equal(updates.at(-1).musicActive,false);
  e['replay-close'].onclick();h.step(600);assert.equal(updates.at(-1).musicActive,false,'returning to review leaves music quiet');
});


test('consecutive recorded bridge phrases are skipped and can return after another phrase',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);players.at(-1).onended();h.runTimers();players.at(-1).onended();
  h.sim.events.push({type:'warp'},{type:'warp'},{type:'impact',ship:'Enterprise',hullDamage:1},{type:'warp'});
  h.step(3200);assert.equal(players.length,3);players.at(-1).onended();
  h.step(3260);assert.equal(players.length,3);
  h.step(3320);assert.equal(players.length,4);players.at(-1).onended();
  h.step(3380);assert.equal(players.length,5);
});


test('Allison reports confirmed torpedo hits on Yorktown, not launches, misses, phasers or practice shots',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);players.at(-1).onended();h.runTimers();players.at(-1).onended();const before=players.length;
  h.sim.events.push({type:'launch',from:'Enterprise',practice:true},{type:'impact',ship:'Yorktown',weapon:'phaser',amount:20,hullDamage:0},{type:'impact',ship:'Yorktown',weapon:'torpedo',amount:0,hullDamage:0},{type:'impact',ship:'Yorktown',weapon:'torpedo',amount:20,hullDamage:0,practice:true},{type:'impact',ship:'Enterprise',weapon:'torpedo',amount:20,hullDamage:0});
  h.step(3200);assert.equal(players.length,before);
  h.sim.events.push({type:'impact',ship:'Yorktown',weapon:'torpedo',amount:20,hullDamage:0});h.step(3260);
  assert.equal(players.at(-1).url,'assets/Direct hit to Yorktown!_Allision.mp3');assert.equal(players.at(-1).volume,.85);players.at(-1).onended();
  h.sim.events.push({type:'impact',ship:'Yorktown',weapon:'torpedo',amount:20,hullDamage:10});h.step(3320);
  assert.equal(players.length,before+2);assert.equal(players.at(-1).url,'assets/Direct Hit!_Allision.mp3');players.at(-1).onended();
  h.sim.events.push({type:'impact',ship:'Yorktown',weapon:'torpedo',amount:20,hullDamage:0});h.step(3380);
  assert.equal(players.length,before+3);assert.equal(players.at(-1).url,'assets/Direct hit to Yorktown!_Allision.mp3');
});


test('Enterprise destruction requests music fade in gameplay and in the recorded replay state',()=>{
  const updates=[];class IntroAudio{setEnabled(){}playOnce(){}reset(){}update(state){updates.push(state);}}
  const h=interfaceHarness({turnBased:true,window:{Audio:class{},BattleIntroAudio:IntroAudio}});h.elements['quick-battle'].onclick();h.sim.tick=()=>{};h.step(120);
  h.sim.player.hull=0;h.sim.result='defeat';h.step(240);assert.equal(updates.at(-1).fadeOut,true);assert.equal(updates.at(-1).musicActive,false);
  h.sim.player.hull=100;h.sim.result=null;h.sim.lastReplay={frames:[{}]};
  h.replay.active=true;h.replay.player={paused:false,ended:false,state:{player:{...h.sim.player,hull:0},enemy:h.sim.enemy}};h.replay.tick=()=>{};h.step(360);
  assert.equal(updates.at(-1).fadeOut,true,'replay uses recorded Enterprise destruction, not the live hull');assert.equal(updates.at(-1).musicActive,false);
});


test('Yorktown leaving and returning to range plays the new Allison recordings',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  Object.assign(h.sim.player,{x:2000,y:0,z:0});Object.assign(h.sim.enemy,{x:2000,y:0,z:-1800});
  h.elements['quick-battle'].onclick();h.step(3060);players.at(-1).onended();h.runTimers();players.at(-1).onended();
  h.sim.enemy.z=-1950;h.step(3200);assert.equal(players.at(-1).url,"assets/They're out of range_Allision.mp3");assert.equal(players.at(-1).volume,.85);players.at(-1).onended();
  h.sim.enemy.z=-1800;h.step(3260);assert.equal(players.at(-1).url,"assets/They're back in range_Allision.mp3");
});


test('Allison says We missed only for Enterprise torpedo misses, with no consecutive repeat',()=>{
  const players=[],h=renderedHarness(players,{turnBased:true});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);players.at(-1).onended();h.runTimers();players.at(-1).onended();const before=players.length;
  h.sim.events.push({type:'torpedo-missed',from:'Yorktown',target:'Enterprise'},{type:'torpedo-missed',from:'Enterprise',target:'Yorktown',practice:true});h.step(3200);assert.equal(players.length,before);
  h.sim.events.push({type:'torpedo-missed',from:'Enterprise',target:'Yorktown'});h.step(3260);assert.equal(players.at(-1).url,'assets/We missed!_Allision.mp3');players.at(-1).onended();
  h.sim.events.push({type:'torpedo-missed',from:'Enterprise',target:'Yorktown'});h.step(3320);assert.equal(players.length,before+1);
});


test('recorded captain commands and helm responses play sequentially in replay without issuing live orders',()=>{
  const players=[];
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}}
  const h=interfaceHarness({turnBased:true,voiceClips:{'captain\nCome to port.':'captain.mp3','helm\nComing to port.':'helm.mp3'},window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);players.at(-1).onended();h.runTimers();players.at(-1).onended();
  h.sim.finishPass();const record=h.sim.lastReplay,dialogue=record.events.filter(e=>e.event.type==='bridge-dialogue');
  assert.equal(dialogue.length,2);assert.equal(dialogue[0].event.order,'Come to port.');assert.equal(dialogue[1].event.reply,'Coming to port.');
  const snapshot=JSON.stringify(record),shots=h.sim.shots,before=players.length;
  h.elements['replay-last-pass'].onclick();h.step(3200);assert.equal(players.length,before+1);assert.equal(players.at(-1).url,'captain.mp3');
  h.step(3260);assert.equal(players.length,before+1,'replay voices do not overlap');players.at(-1).onended();
  h.step(3400);assert.equal(players.length,before+1,'helm retains its reply pause');h.step(4000);assert.equal(players.length,before+2);assert.equal(players.at(-1).url,'helm.mp3');players.at(-1).onended();
  assert.equal(h.sim.shots,shots,'replayed commands cannot fire live weapons');assert.equal(JSON.stringify(record),snapshot,'replay speech does not write new dialogue into the recording');
  h.elements['replay-restart'].onclick();h.step(4100);assert.equal(players.at(-1).url,'captain.mp3','restart resets phrase history');
});


test('Hide HUD messages starts checked and Yorktown uses its normal tactical targeting',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/<input id="hide-hud-messages" type="checkbox" checked>/);
  const h=interfaceHarness({turnBased:true});assert.equal(h.sim.previewNacelleBreakoff,false);h.elements['quick-battle'].onclick();assert(h.sim.turn.enemyOrders.some(order=>order.target!=='mainEngines'));assert(h.sim.enemyPersonalityProfile.name);
});


test('Allison uses rendered updates for direct hits and each Enterprise engine-loss report',()=>{
  const players=[],manifest={window:{BattleVoiceClips:{}}};vm.createContext(manifest);vm.runInContext(fs.readFileSync(path.join(root,'assets/voices/voice-overrides.js'),'utf8'),manifest);
  class Audio{constructor(url){this.url=url;players.push(this);}play(){return Promise.resolve();}pause(){}}
  const h=interfaceHarness({turnBased:true,voiceClips:manifest.window.BattleVoiceClips,window:{Audio}});h.sim.tick=()=>{};
  h.elements['quick-battle'].onclick();h.step(3060);players.at(-1).onended();h.runTimers();players.at(-1).onended();let now=3200;
  for(const [event,file] of [[{type:'impact',ship:'Yorktown',weapon:'torpedo',amount:10,hullDamage:0},'Direct hit to Yorktown!_Allision.mp3'],[{type:'nacelle-detached',ship:'Enterprise',side:'port'},"We've lost the port engine!_Allision.mp3"],[{type:'nacelle-detached',ship:'Enterprise',side:'starboard'},"We've lost the starboard engine!_Allision.mp3"]]){
    h.sim.events.push(event);h.step(now);if(event.type==='nacelle-detached'){now+=500;h.step(now);}now+=60;const audio=players.at(-1);assert.equal(audio.url,'assets/'+file);assert.equal(audio.volume,.85);assert(fs.statSync(path.join(root,audio.url)).size>1000);audio.onended();
  }
  const count=players.length;h.sim.events.push({type:'nacelle-detached',ship:'Yorktown',side:'port'});h.step(now);assert.equal(players.length,count,'enemy engine loss does not announce our engine loss');
});


test('Turn panel highlights and centers each newly active maneuver without taking over manual scrolling',()=>{
  const h=interfaceHarness({turnBased:true});h.sim.tick=()=>{};h.elements['quick-battle'].onclick();
  const panel=h.elements['pass-panel'],prototype=Object.getPrototypeOf(h.elements['live-plan'].children[0]);
  Object.defineProperties(prototype,{offsetTop:{get(){return this.attrs['aria-current']==='step'?600:0;}},offsetHeight:{get(){return 80;}}});panel.clientHeight=200;
  h.sim.turn.stageIndex=1;h.step(180);assert.equal(h.elements['live-plan'].children[1].attrs['aria-current'],'step');assert.equal(panel.scrollTop,540,'active row is centered inside the panel');
  panel.scrollTop=17;h.step(360);assert.equal(panel.scrollTop,17,'ordinary refreshes preserve manual scrolling');
  h.sim.turn.stageIndex=2;h.step(540);assert.equal(h.elements['live-plan'].children[2].attrs['aria-current'],'step');assert.equal(panel.scrollTop,540,'next maneuver comes into view');
});


test('hull-hit score messages identify Yorktown so they cannot be mistaken for Enterprise damage',()=>{
  const h=interfaceHarness({turnBased:true});h.elements['quick-battle'].onclick();h.sim.tick=()=>{};
  for(const arc of B.arcs)h.sim.enemy.shields[arc]=0;h.sim.damage(h.sim.enemy,h.sim.player,10,'phaser','hull');h.step(180);
  assert.equal(h.elements['callout-title'].textContent,'HULL HIT');assert.match(h.elements['callout-detail'].textContent,/^YORKTOWN \/ /);assert.equal(h.sim.player.hull,100);
});


test('replay finale requests a music fade even when Enterprise survives, and completion stays silent',()=>{
  const updates=[];class IntroAudio{setEnabled(){}playOnce(){}reset(){}update(state){updates.push(state);}}
  const h=interfaceHarness({turnBased:true,window:{Audio:class{},BattleIntroAudio:IntroAudio}});h.elements['quick-battle'].onclick();h.sim.tick(.1);h.sim.finishPass();h.sim.running=false;
  h.elements['replay-last-pass'].onclick();const player=h.replay.player;player.sequenceIndex=player.sequences.length-1;player.position=player.sequences.at(-1).end;player.hold=.1;
  h.step(180);assert(player.state.player.hull>0);assert.equal(updates.at(-1).fadeOut,true);assert.equal(updates.at(-1).musicActive,false,'music fades as the final scene resolves');
  player.ended=true;h.step(360);assert.equal(updates.at(-1).fadeOut,true);assert.equal(updates.at(-1).musicActive,false,'the replay complete screen cannot restart music');
});


test('shared attacks appear only once across the maneuver preview and live turn list',()=>{
  const h=interfaceHarness({turnBased:true}),e=h.elements;h.sim.tick=()=>{};e.start.onclick();e['preset-strong'].onclick();
  const titles=id=>e[id].children.map(row=>row.children[0]?.textContent||'').join(' ');
  assert.equal((titles('wizard-review').match(/Phaser/g)||[]).length,2);assert.equal((titles('wizard-review').match(/Torpedo/g)||[]).length,1,'shared eligibility does not repeat scheduled shots in each maneuver');
  e['wizard-commit'].onclick();assert.equal(h.sim.turn.orders.length,3);
  assert.equal((titles('live-plan').match(/Phaser/g)||[]).length,2);assert.equal((titles('live-plan').match(/Torpedo/g)||[]).length,1);
  h.sim.turn.orders[0].status='hit';h.sim.turn.orders[0].firedStage=0;h.sim.turn.stageIndex=1;h.step(180);
  assert.equal((titles('live-plan').match(/Attack 1:/g)||[]).length,1);assert.equal((titles('live-plan').match(/Attack 2:/g)||[]).length,1);assert.equal((titles('live-plan').match(/Attack 3:/g)||[]).length,1);
  assert.match(e['live-plan'].children[0].children[0].textContent,/Attack 1:/);assert.match(e['live-plan'].children[1].children[0].textContent,/Attack 2:/,'pending attacks follow the current eligible maneuver');
});


test('Show Strategy reveals all Yorktown stats despite damaged Enterprise sensors without restoring combat sensors',()=>{
  const h=interfaceHarness(),{sim,elements:e}=h;sim.player.integrity.sensors=0;Object.assign(sim.enemy,{hull:43,reactor:65,torpedoes:13,capacitor:41,heat:55});sim.enemy.integrity.bridge=20;sim.enemy.shields.fore=7;h.step(120);
  assert.equal(e['yorktown-damage-hull'].textContent,'UNKNOWN');assert.equal(sim.yorktownTelemetry,false);
  e['toggle-yorktown-strategy'].onclick();assert.equal(e['yorktown-damage-hull'].textContent,'43%');assert.equal(e['yt-reactor'].textContent,'65 / 100 GW');assert.equal(e['yorktown-system-bridge'].textContent,'20%');assert.equal(e['yorktown-svg-fore'].textContent,'7%');assert.equal(e['yt-torpedoes'].textContent,'13 / 24');assert.equal(e['yt-capacitor'].textContent,'41%');assert.equal(e['yt-heat'].textContent,'55%');assert.match(e['yt-power-engines'].textContent,/GW/);
  assert.equal(e['sensor-note'].textContent,'Strategy view / full Yorktown stats');assert.equal(e['sensor-state'].textContent,'SENSORS DAMAGED');assert.equal(sim.player.integrity.sensors,0);assert.equal(sim.contact,false);assert.equal(sim.lock,false);
  e['toggle-yorktown-strategy'].onclick();assert.equal(e['yorktown-damage-hull'].textContent,'UNKNOWN');assert.equal(e['yt-torpedoes'].textContent,'UNKNOWN');
});
