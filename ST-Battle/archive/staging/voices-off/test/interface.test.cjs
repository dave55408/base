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
  const elements={},handlers={};let frame;
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
  const context={Battle:TestBattle,BattleReplay:Replay,BattleScene:Scene,window:{},document,console,performance:{now:()=>0},devicePixelRatio:1,setTimeout:()=>0,clearTimeout(){},addEventListener:(name,fn)=>handlers[name]=fn,requestAnimationFrame:fn=>frame=fn};
  context.window.addEventListener=context.addEventListener;
  Object.assign(context.window,options.window||{});
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'target-diagram.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'planner.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'replay-view.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
  context.window.battle.turnBased=options.turnBased??false;
  const key=(key,code='')=>({key,code,preventDefault(){},target:{tagName:'BODY'},repeat:false});
  return {sim:context.window.battle,scene:context.window.battleScene,replay:context.window.battleReplay,elements,handlers,document,step:ms=>frame(ms),key};
}

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

test('Wary, Strong, Aggressive and Berserk fill complete editable drafts at the top of the planner',()=>{
  const routes={timid:['distance','hide','flee'],strong:['port','distance','chase'],aggressive:['direct','close','chase'],berserk:['direct','close','ram']};
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.indexOf('id="preset-timid"')<html.indexOf('<nav class="wizard-steps"'));
  for(const style of Object.keys(routes)){
    const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
    const original=JSON.stringify(sim.turn.draft);e['preset-'+style].onclick();
    assert.equal(e['preset-'+style].attrs['aria-pressed'],'true');assert.equal(e['wizard-commit'].disabled,false);assert.equal(e['plan-wizard'].open,true);
    assert.equal(JSON.stringify(sim.turn.draft),original,'a preset changes only the draft editor');
    e['wizard-commit'].onclick();assert.equal(e['plan-wizard'].open,false);assert.deepEqual(Array.from(sim.turn.maneuvers),routes[style]);
    assert.equal(sim.turn.orders.filter(order=>order.weapon==='phaser').length,2);assert.equal(sim.turn.orders.filter(order=>order.weapon==='torpedo').length,1);
    assert(sim.turn.orders.every(order=>order.maneuvers.every(i=>sim.turn.maneuvers[i]!=='flee')));
    e['open-planner'].onclick();for(const key of Object.keys(routes))assert.equal(e['preset-'+key].disabled,true,'presets cannot replace a live turn outside its revision rules');
  }
});

test('preset plans can be customized or cancelled without changing live orders',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();
  const before=JSON.stringify(sim.turn);e['preset-timid'].onclick();e['wizard-cancel'].onclick();assert.equal(JSON.stringify(sim.turn),before);
  e['open-planner'].onclick();e['preset-strong'].onclick();e['plan-step-0'].onclick();e['target-bridge'].onclick();
  assert.equal(e['preset-strong'].attrs['aria-pressed'],'false','custom changes clear the preset highlight');
  assert.equal(e['wizard-commit'].disabled,false);e['wizard-commit'].onclick();assert.equal(sim.turn.orders[0].target,'bridge');
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
  class WeaponAudio{setEnabled(){}stopAll(){}playHit(){cues.push('hit');}playBreak(){cues.push('break');}playExplosion(){cues.push('explosion');}}
  const h=interfaceHarness({window:{AudioContext,BattleWeaponAudio:WeaponAudio}});h.handlers['document:pointerdown']();await Promise.resolve();
  const events=[{type:'impact',ship:'Yorktown'},{type:'ship-collision',ship:'Enterprise'},{type:'station-collision',ship:'Yorktown'},{type:'station-impact'},{type:'destroyed',ship:'Enterprise',selfDestruct:true}];
  h.sim.events=events.slice();h.step(60);assert.deepEqual(cues,['hit','break','break','hit','explosion']);
  for(const event of events)h.replay.options.sound(event,1);assert.deepEqual(cues,['hit','break','break','hit','explosion','hit','break','break','hit','explosion']);
  await h.elements.audio.onclick();h.replay.options.sound(events[4],1);assert.equal(cues.length,10,'mute suppresses replay self-destruct audio');
});

test('D self-destructs Enterprise in Free Flight without steering, and ignores repeats and modified shortcuts',()=>{
  const {sim,scene,handlers,key,step,elements:e}=interfaceHarness();e['free-flight'].onclick();const heading=sim.player.heading;
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
  elements['free-flight'].onclick();assert(sim.freeFlight);
  handlers.keydown(key('r'));assert.equal(sim.shots,1);
  handlers.keyup(key('r'));sim.player.cooldown.phaser=0;h.step(60);assert.equal(sim.shots,1);
  assert.equal(elements['phaser-key'].textContent,'R');
});

test('planner enforces two phasers and one torpedo and requires all three attacks',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});
  e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  for(let i=0;i<2;i++){
    e['plan-step-'+i].onclick();pickWeapon(e,'phaser');e['target-hull'].onclick();
    assert.equal(e['wizard-commit'].disabled,true);
  }
  e['plan-step-2'].onclick();assert.equal(e['choose-phaser'].disabled,true);
  e['choose-phaser'].onclick();assert.equal(e['choose-phaser'].attrs['aria-pressed'],'false');
  e['target-hull'].onclick();assert.equal(e['wizard-commit'].disabled,false);
  assert.match(e['weapon-budget'].textContent,/2\/2 phasers \/ 1\/1 torpedo/);
  e['plan-step-0'].onclick();assert.equal(e['choose-torpedo'].disabled,true);
  e['choose-torpedo'].onclick();assert.equal(e['choose-phaser'].attrs['aria-pressed'],'true');
  e['wizard-commit'].onclick();assert(sim.maneuvering);
  assert.equal(sim.turn.orders.filter(v=>v.weapon==='phaser').length,2);
  assert.equal(sim.turn.orders.filter(v=>v.weapon==='torpedo').length,1);
});

test('intro plays after the first successful commit, stays silent on later turns, and resets for rematches',()=>{
  const intros=[];
  class IntroAudio{constructor(){this.plays=0;intros.push(this);}setEnabled(value){this.enabled=value;}playOnce(){this.plays++;}update(state){this.active=state.active;}reset(){this.resets=(this.resets||0)+1;}}
  const h=interfaceHarness({turnBased:true,window:{Audio:class{},BattleIntroAudio:IntroAudio}}),e=h.elements;
  e['commit-orders'].onclick();assert.equal(intros.length,0,'invalid plans do not consume the intro');
  e['quick-battle'].onclick();assert.equal(intros.length,1);assert.equal(intros[0].plays,1);
  h.sim.finishPass();e['quick-battle'].onclick();assert.equal(intros[0].plays,1,'later turns do not replay it');
  e['quick-rematch'].onclick();assert.equal(intros.length,1);assert.equal(intros[0].plays,2);
  e['free-flight'].onclick();assert.equal(intros[0].plays,3,'Free Flight starts the intro once');assert.equal(intros[0].active,true);
  e['commit-orders'].onclick();assert.equal(intros[0].plays,3);
  e.pause.onclick();assert.equal(intros[0].active,false);e.pause.onclick();assert.equal(intros[0].active,true);h.step(60);assert.equal(intros[0].plays,3);
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

test('destruction animates first, pauses for ten seconds, then shows the end screen',()=>{
  const {sim,scene,elements:e,step}=interfaceHarness();
  for(const arc of B.arcs)sim.enemy.shields[arc]=0;sim.enemy.hull=1;sim.damage(sim.enemy,sim.player,999,'torpedo','hull');
  const battleTime=sim.time;
  for(let i=1;i<=20;i++)step(i*60);
  assert.equal(e.result.hidden,true);assert(scene.lastDt>0);assert(scene.recordedEvents.some(event=>event.type==='destroyed'));
  for(let i=21;i<=80;i++)step(i*60);
  assert(scene.lastDt>0,'wreckage continues drifting through the fifth second');
  for(let i=81;i<=245;i++)step(i*60);
  assert.equal(e.result.hidden,true);assert.equal(scene.lastDt,0,'wreckage is held still before the result screen');
  for(let i=246;i<=260;i++)step(i*60);
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
  e['free-flight'].onclick();assert.equal(sim.freeFlight,true);assert.equal(sim.turnBased,false);assert.equal(sim.running,true);
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
  assert.equal(e['choose-torpedo'].attrs['aria-pressed'],'true','two phasers leave only torpedo, selected automatically');
  e['target-mainEngines'].onclick();e['attack-range'].onchange({target:{value:'600'}});
  assert.equal(e['wizard-commit'].disabled,false);assert.equal(e['plan-step-2'].attrs['aria-current'],'step');
  e['plan-step-0'].onclick();e['target-sensors'].onclick();assert.equal(e['plan-step-0'].attrs['aria-current'],'step','editing a completed attack stays on that attack');
  e['wizard-commit'].onclick();assert.deepEqual(Array.from(sim.turn.orders,order=>order.range),[900,750,600]);assert.equal(sim.turn.orders[0].target,'sensors');
});

test('selecting the torpedo first automatically selects phasers for the remaining attacks',()=>{
  const {elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  assert.equal(e['choose-phaser'].attrs['aria-pressed'],'false');assert.equal(e['choose-torpedo'].attrs['aria-pressed'],'false');
  e['choose-torpedo'].onclick();e['target-hull'].onclick();e['attack-range'].onchange({target:{value:'700'}});
  for(const target of ['bridge','engines']){
    assert.equal(e['choose-phaser'].attrs['aria-pressed'],'true');assert.equal(e['choose-torpedo'].disabled,true);
    e['target-'+target].onclick();e['attack-range'].onchange({target:{value:'900'}});
  }
  assert.equal(e['wizard-commit'].disabled,false);
});

test('a full attack budget enables Commit immediately and deselection restores an available stage',()=>{
  const {sim,elements:e}=interfaceHarness({turnBased:true});e.start.onclick();e['maneuver-direct'].onclick();e['done-maneuvers'].onclick();
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>{
    e['plan-step-'+i].onclick();pickWeapon(e,weapon);e['target-hull'].onclick();
  });
  assert.equal(e['wizard-commit'].disabled,false);assert.equal(e['choose-phaser'].disabled,true);assert.equal(e['save-plan-step'].disabled,true);
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
  h.elements['free-flight'].onclick();assert.equal(h.elements['enterprise-speed'].disabled,false);
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

test('Slow Ahead button and Space keep Enterprise moving',()=>{
  const h=interfaceHarness(),{sim,elements,handlers,key}=h;elements.start.onclick();sim.player.speed=100;sim.player.throttle=80;
  elements.stop.onclick();assert.equal(sim.player.speed,B.MIN_IMPULSE_SPEED);assert.equal(sim.player.throttle,0);assert.equal(elements['drive-state'].textContent,'SLOW AHEAD');
  sim.player.throttle=-80;sim.player.speed=-80;handlers.keydown(key(' '));h.step(120);handlers.keyup(key(' '));assert.equal(sim.player.speed,B.MIN_IMPULSE_SPEED);
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
  h.elements['free-flight'].onclick();assert.equal(h.sim.freeFlight,true);assert.equal(alarms[0].active,false);
  h.elements['quick-rematch'].onclick();assert.equal(alarms[0].active,false);
  h.sim.player.hull=24;h.step(300);assert.equal(alarms[0].active,true);
  await h.elements.audio.onclick();assert.equal(alarms[0].enabled,false);
  h.handlers.blur();assert.equal(alarms[0].active,false);
});

test('Enterprise engine audio follows flight, pause, blur, mute and destruction',async()=>{
  const updates=[],enabled=[];let stops=0;
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}}
  class WeaponAudio{setEnabled(){}stopAll(){}}
  class EngineAudio{setEnabled(value){enabled.push(value);}update(value){updates.push(value);}stop(){stops++;}}
  const h=interfaceHarness({window:{AudioContext,Audio:class{},BattleWeaponAudio:WeaponAudio,BattleEngineAudio:EngineAudio}});
  h.handlers['document:pointerdown']();await Promise.resolve();await Promise.resolve();
  h.step(60);assert.equal(updates.at(-1).active,false);
  h.elements['free-flight'].onclick();h.step(120);assert.equal(updates.at(-1).active,true);assert(updates.at(-1).maximum>0);
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
  h.elements['free-flight'].onclick();h.sim.player.speed=-90;h.step(60);
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
  for(const style of ['timid','strong','aggressive','berserk'])assert.equal(e['preset-'+style].attrs['aria-pressed'],'false');
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
  assert.equal(e['yorktown-strategy-tactic'].textContent,'Evasive maneuver');
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
  for(const style of ['timid','strong','aggressive','berserk']){
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


test('helm conversations follow maneuvers, prioritize damage, and clear on reset',()=>{
  const h=interfaceHarness({turnBased:true}),e=h.elements;
  assert.equal(e['helm-reply'].textContent,'');
  e['quick-battle'].onclick();h.step(60);
  assert.equal(e['helm-dialogue'].hidden,false);
  assert.match(e['helm-order'].textContent,/CAPTAIN.*port/);
  assert.match(e['helm-reply'].textContent,/Coming to port/);
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:5});h.step(120);
  assert.match(e['helm-reply'].textContent,/Hull hit/);assert.equal(e['helm-order'].textContent,'');
  h.sim.finishPass();h.step(180);
  assert.match(e['helm-reply'].textContent,/Hull hit/,'routine report does not interrupt an urgent warning');
  for(let i=4;i<110;i++)h.step(i*60);
  assert.match(e['helm-reply'].textContent,/Awaiting orders/);
  e['quick-rematch'].onclick();h.step(6700);
  assert.match(e['helm-reply'].textContent,/Coming to port/,'new engagement clears old dialogue and cooldowns');
});

test('free flight helm acknowledges manual control and repeated warnings are spaced out',()=>{
  const h=interfaceHarness(),e=h.elements;
  e['free-flight'].onclick();h.step(60);assert.match(e['helm-reply'].textContent,/Manual control/);
  h.sim.message('HELM','Cloud-top clearance reached.');h.step(120);
  assert.match(e['helm-reply'].textContent,/Cloud-top/);
  h.sim.message('HELM','Cloud-top clearance reached.');h.step(180);
  for(let i=4;i<115;i++)h.step(i*60);
  assert.equal(e['helm-dialogue'].hidden,true,'the same warning is not queued repeatedly');
});


test('bridge captions remain visible with voices disabled, including after toggling audio',async()=>{
  const spoken=[];
  class AudioContext{constructor(){this.state='running';this.currentTime=0;}async resume(){}createOscillator(){return {type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(node){return node;},start(){},stop(){}};}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(node){return node;}};}}
  class WeaponAudio{setEnabled(){}stopAll(){}playHit(){}}
  const h=interfaceHarness({turnBased:true,window:{AudioContext,BattleWeaponAudio:WeaponAudio,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:{getVoices:()=>[],speak:line=>spoken.push(line),cancel(){}}}});
  h.elements['quick-battle'].onclick();h.step(60);
  assert.equal(h.elements['helm-dialogue'].hidden,false);assert.match(h.elements['helm-reply'].textContent,/Coming to port/);
  assert.equal(spoken.length,0);
  await h.elements.audio.onclick();await h.elements.audio.onclick();
  h.sim.events.push({type:'impact',ship:'Enterprise',hullDamage:5});h.step(120);
  assert.match(h.elements['helm-reply'].textContent,/Hull hit/);assert.equal(spoken.length,0);
});
