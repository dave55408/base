const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js'),Replay=require('../replay.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function pass(resolveWeaponHit){
  const sim=new B.Simulation();sim.running=true;sim.selectManeuver('direct');
  sim.resolveWeaponHit=resolveWeaponHit;
  Object.assign(sim.player,{x:2000,y:0,z:0,heading:0});Object.assign(sim.enemy,{x:2000,y:0,z:-900,heading:180});sim.enemy.integrity.weapons=0;
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>sim.updateStep(i,{weapon,target:'hull',range:1000}));sim.commitOrders();
  for(let i=0;i<2400&&sim.turn.phase!=='review'&&!sim.result;i++){sim.tick(.05);sim.events.splice(0);}
  return sim;
}
const snapshot=s=>JSON.stringify({player:s.player,enemy:s.enemy,time:s.time,seed:s.seed,turn:s.turn,projectiles:s.projectiles,log:s.log,result:s.result,running:s.running});

function movie(){
  const sim=new B.Simulation(),frame={player:sim.player,enemy:sim.enemy,stageIndex:0,maneuver:'direct',phase:'attack',projectiles:[]};
  const projectile={id:'movie-torpedo',from:'Enterprise',target:'Yorktown',heading:0,pitch:0,pos:{x:0,y:0,z:-500}};
  const record={pass:1,station:sim.station,planet:sim.planet,startTime:0,duration:20,result:null,frames:[{...frame,at:0},{...frame,at:5,projectiles:[projectile]},{...frame,at:9,projectiles:[{...projectile,pos:{x:0,y:0,z:-900}}]},{...frame,at:10},{...frame,at:20}],events:[{at:4,event:{type:'beam',from:'Enterprise',to:'Yorktown',duration:1.4}},{at:5,event:{type:'launch',from:'Enterprise',to:'Yorktown'}},{at:10,event:{type:'impact',ship:'Yorktown',weapon:'torpedo'}}]};
  return {sim,record};
}

test('replay chooses an opening reveal, saucer phaser shot, traveling torpedo, impact and destruction finale',()=>{
  const {sim,record}=movie(),p=new Replay.Player(record,sim);
  assert.equal(p.state.replayShot.kind,'establishing');
  p.screenTime=5;p.sample(4);assert.equal(p.state.replayShot.kind,'phaser');assert.equal(p.state.replayShot.event.from,'Enterprise');
  p.sample(7);assert.equal(p.state.replayShot.kind,'torpedo');assert.equal(p.state.replayShot.projectileId,'movie-torpedo');
  p.sample(10.2);assert.equal(p.state.replayShot.kind,'impact');assert.equal(p.state.replayShot.focus,'Yorktown');
  record.events.push({at:20,event:{type:'destroyed',ship:'Yorktown'}});record.result='victory';
  const end=new Replay.Player(record,sim);end.hold=2.5;end.sample(20);assert.equal(end.state.replayShot.kind,'destruction');assert.equal(end.state.replayShot.destructionElapsed,2.5);
});

test('speed ramps are continuous before and after impacts and playback delivers the impact once',()=>{
  const {sim,record}=movie();record.duration=30;record.events=[record.events[2]];record.frames=record.frames.filter(f=>!f.projectiles.length);
  const p=new Replay.Player(record,sim),rates=[];
  for(let at=7.5;at<=9.7;at+=.1){p.position=at;rates.push(p.rate());}
  assert(rates[0]>5.9);assert(rates.at(-1)<.5);assert(rates.every((rate,i)=>i===0||rate<=rates[i-1]));
  for(let at=6;at<14;at+=.01){p.position=at;const rate=p.rate();p.position=at+.01;assert(Math.abs(p.rate()-rate)<.08,'no speed discontinuity at an action boundary');}
  const playback=new Replay.Player(record,sim),events=[];let previous=playback.playbackRate;
  for(let i=0;i<5000&&!playback.ended;i++){const frame=playback.advance(.016);if(!frame.cut)assert(Math.abs(frame.rate-previous)<.6);previous=frame.rate;events.push(...frame.events);}
  assert.equal(events.filter(event=>event.type==='impact').length,1);assert(playback.ended);
});

test('weapon replay cameras include both ships and destruction uses a fixed wreckage view',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.camera=new T.PerspectiveCamera(46,1.8,.5,65000);
  scene.sim=new B.Simulation();scene.ships={};scene.effects=[];
  for(const name of ['Enterprise','Yorktown']){const ship=new T.Group(),model=new T.Group();ship.add(model);ship.userData.model=model;scene.ships[name]=ship;}
  scene.ships.Yorktown.position.set(300,100,-1100);
  const camera=new T.Vector3(),target=new T.Vector3();
  scene.sim.replayShot={kind:'phaser',focus:'Enterprise',event:{to:'Yorktown'},key:'beam',screenAt:4};
  scene.replayCamera(camera,target);assert.deepEqual(Array.from(target.toArray()),[150,50,-550]);assert.equal(scene.replayComposition.twoShips,true);
  scene.sim.projectiles=[{id:'one',pos:{x:100,y:30,z:-600}}];scene.sim.replayShot={kind:'torpedo',focus:'Enterprise',projectileId:'one',key:'one',screenAt:10};
  scene.replayCamera(camera,target);assert.deepEqual(Array.from(target.toArray()),[150,50,-550]);
  scene.sim.projectiles[0].pos.z=-700;scene.sim.replayShot.screenAt=11;scene.replayCamera(camera,target);assert.equal(target.z,-550,'the projectile does not drag the camera away from the ships');
  scene.effects=[{kind:'debris',object:{position:new T.Vector3(200,100,-900)}},{kind:'debris',object:{position:new T.Vector3(400,100,-1100)}}];
  scene.sim.replayShot={kind:'destruction',focus:'Yorktown',key:'end',screenAt:12,destructionElapsed:0};scene.replayCamera(camera,target);const near=camera.distanceTo(target);
  scene.sim.replayShot.destructionElapsed=5;scene.sim.replayShot.screenAt=15;scene.replayCamera(camera,target);
  assert.deepEqual(Array.from(target.toArray()),[300,100,-1000]);assert.equal(camera.distanceTo(target),near,'finale holds the camera instead of pulling back');
});
test('flight recorder captures the entire three-maneuver pass, projectiles, and each combat event once',()=>{
  const s=pass(),r=s.lastReplay;assert(r);assert.equal(s.turn.phase,'review');assert.equal(r.pass,1);assert.deepEqual(r.maneuvers,['direct','direct','direct']);
  assert.equal(r.frames[0].at,0);assert.equal(r.frames.at(-1).at,r.duration);assert(r.duration>3);
  assert.deepEqual([...new Set(r.frames.map(f=>f.stageIndex))],[0,1,2]);
  assert.equal(r.events.filter(v=>v.event.type==='beam'&&v.event.from==='Enterprise').length,2);assert.equal(r.events.filter(v=>v.event.type==='launch').length,1);
  assert(r.events.some(v=>v.event.type==='impact'));assert(r.frames.some(f=>f.projectiles.length));
  for(let i=1;i<r.frames.length;i++)assert(r.frames[i].at>r.frames[i-1].at);
});
test('cinematic playback never changes live battle data or recorded data and delivers events once',()=>{
  const s=pass(),before=snapshot(s),record=JSON.stringify(s.lastReplay),player=new Replay.Player(s.lastReplay,s),events=[];
  for(let i=0;i<10000&&!player.ended;i++){const frame=player.advance(.05);events.push(...frame.events);assert(Number.isFinite(player.state.player.x));}
  const visible=s.lastReplay.events.filter(entry=>player.sequences.some(sequence=>entry.at>=sequence.start&&entry.at<=sequence.end)).map(entry=>entry.event);
  assert(player.ended);assert.deepEqual(events,visible);assert.equal(snapshot(s),before);assert.equal(JSON.stringify(s.lastReplay),record);
  assert.notEqual(player.state.player,s.player);assert.notEqual(player.state.station,s.station);
});

test('replays preserve recorded emitters and hull contacts without recalculating hits',()=>{
  const hit={emitter:{x:.32,y:.426,z:-1.48},point:{x:.56,y:.53,z:.15},normal:{x:1,y:0,z:0},component:'mainEngines'};
  const sim=pass(()=>hit),player=new Replay.Player(sim.lastReplay,sim),expected=JSON.parse(JSON.stringify(hit)),events=[];
  hit.point.x=100;sim.resolveWeaponHit=()=>{throw Error('Replay must not resolve another hit');};
  for(let i=0;i<10000&&!player.ended;i++)events.push(...player.advance(.05).events);
  assert.deepEqual(events.find(e=>e.type==='beam').hit,expected);assert.deepEqual(events.find(e=>e.type==='impact').hit,expected);
});
test('playback slows near hits, compresses travel, pauses without advancing, and wraps headings smoothly',()=>{
  const s=pass(),player=new Replay.Player(s.lastReplay,s),hit=s.lastReplay.events.find(v=>v.event.type==='impact');
  player.position=hit.at;assert(Math.abs(player.rate()-.4)<1e-8);
  player.position=s.lastReplay.duration*.8;assert(player.rate()>=.4&&player.rate()<=6);
  player.paused=true;const time=player.position,cursor=player.cursor;assert.deepEqual(player.advance(1),{events:[],dt:0});assert.equal(player.position,time);assert.equal(player.cursor,cursor);
  assert.equal(Replay.interpolate({heading:350,x:0},{heading:10,x:10},.5).heading,0);assert.equal(Replay.interpolate({heading:350,x:0},{heading:10,x:10},.5).x,5);
});
test('the last completed pass remains available while the next records; reset clears it',()=>{
  const s=pass(),previous=s.lastReplay;s.commitOrders();assert.equal(s.lastReplay,previous);assert(s.replayRecording);s.tick(.05);assert.equal(s.lastReplay,previous);
  s.reset();assert.equal(s.lastReplay,null);assert.equal(s.replayRecording,null);
});

test('replay presentation smooths rapid helm corrections and bank without changing recorded flight or timing',()=>{
 const sim=new B.Simulation(),frames=[];
 for(let i=0;i<=40;i++){const at=i/10;frames.push({at,player:{...sim.player,x:at*100,heading:((355+at*8+(i%2?-3:3))%360+360)%360,pitch:at*2+(i%2?-2:2),bank:.4},enemy:{...sim.enemy},stageIndex:0,maneuver:'direct',phase:'attack',projectiles:[]});}
 const record={pass:1,startTime:0,duration:4,station:sim.station,planet:sim.planet,events:[],frames},before=JSON.stringify(record),live=JSON.stringify(sim.player),player=new Replay.Player(record,sim,{fullTurn:true});
 player.sample(1.5);const raw=player.state.player,pose=player.state.replayPoses.Enterprise;
 const delta=(a,b)=>Math.abs(((a-b+540)%360)-180);
 assert(delta(pose.heading,7)<delta(raw.heading,7)*.4,'short heading corrections are damped across north');assert(Math.abs(pose.pitch-3)<Math.abs(raw.pitch-3)*.4);
 assert(Math.abs(pose.bank-.22)<1e-8,'replay banking is gentler');assert.equal(raw.x,150);assert.equal(raw.heading,frames[15].player.heading,'recorded state remains available unchanged');
 const expected=JSON.stringify(pose);player.sample(2.3);player.sample(1.5);assert.equal(JSON.stringify(player.state.replayPoses.Enterprise),expected,'seeking produces the same stabilized pose');assert.equal(JSON.stringify(record),before);assert.equal(JSON.stringify(sim.player),live);
});

test('replay stabilization respects warp cuts and handles a zero-duration recording',()=>{
 const sim=new B.Simulation(),frames=Array.from({length:31},(_,i)=>({at:i/10,player:{...sim.player,x:i<20?0:2000,heading:i<20?0:180},enemy:{...sim.enemy},stageIndex:0,maneuver:'direct',phase:'attack',projectiles:[]}));
 const record={pass:1,startTime:0,duration:3,station:sim.station,planet:sim.planet,events:[{at:2,event:{type:'warp'}}],frames},player=new Replay.Player(record,sim);
 player.sample(1.9);assert.equal(player.state.replayPoses.Enterprise.heading,0);player.sample(2);assert.equal(player.state.replayPoses.Enterprise.heading,180);assert.equal(player.state.player.x,2000);
 const short=new Replay.Player({...record,duration:0,frames:[frames[0]],events:[]},sim);assert(Object.values(short.state.replayPoses.Enterprise).every(Number.isFinite));
});
test('victory or defeat during a pass finalizes a replay including the final destruction',()=>{
  const s=new B.Simulation();s.running=true;s.selectManeuver('direct');['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:1000}));s.commitOrders();
  Object.keys(s.enemy.shields).forEach(a=>s.enemy.shields[a]=0);s.enemy.hull=1;s.damage(s.enemy,s.player,100,'torpedo','hull');
  assert.equal(s.lastReplay.result,'victory');assert.equal(s.lastReplay.frames.at(-1).enemy.hull,0);assert(s.lastReplay.events.some(v=>v.event.type==='destroyed'));assert.equal(s.replayRecording,null);
  assert.equal(s.lastReplay.endHold,Replay.DESTRUCTION_DURATION);
  const player=new Replay.Player(s.lastReplay,s);player.advance(Replay.DESTRUCTION_DURATION-.1);assert.equal(player.ended,false);player.advance(.2);assert.equal(player.ended,true);
});

test('cinematic director produces valid wide, tracking and impact cameras with intentional cuts',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.7,1.8])for(const kind of ['wide','weapons','launch','hero','impact']){
    const scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.camera=new T.PerspectiveCamera(46,aspect,.5,65000);
    scene.sim={player:{x:0,y:0,z:0,heading:0,pitch:0},enemy:{x:300,y:150,z:-1100,heading:170,pitch:10},range:1150,replayShot:{kind,focus:'Yorktown',key:kind,at:4}};
    scene.ships={Enterprise:{position:new T.Vector3(0,0,0)},Yorktown:{position:new T.Vector3(300,150,-1100)}};
    const position=new T.Vector3(),target=new T.Vector3();assert.equal(scene.replayCamera(position,target),true);assert.equal(scene.replayCamera(position,target),false);
    assert([...position.toArray(),...target.toArray()].every(Number.isFinite));assert(position.distanceTo(target)>100);
  }
});

test('consecutive replay cuts keep a consistent viewing side and change framing without forced swings',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.5,1,1.8,2.5]){
    const scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.camera=new T.PerspectiveCamera(46,aspect,.5,65000);
    scene.sim={player:{x:0,y:0,z:0,heading:0,pitch:0},enemy:{x:300,y:150,z:-1100,heading:170,pitch:10},range:1150};
    scene.ships={Enterprise:{position:new T.Vector3(0,0,0)},Yorktown:{position:new T.Vector3(300,150,-1100)}};
    let oldTarget=null;const sizes=[];
    for(let i=0;i<12;i++){
      const oldCamera=scene.camera.position.clone(),oldSize=oldTarget?85/oldCamera.distanceTo(oldTarget):null,oldDirection=scene.replayComposition?.direction.clone();
      scene.ships.Enterprise.position.add(new T.Vector3(23,-7,-55));scene.ships.Yorktown.position.add(new T.Vector3(-17,13,37));
      scene.sim.player.heading=(i*57)%360;scene.sim.enemy.heading=(170+i*41)%360;
      scene.sim.replayShot={kind:i<6?'impact':'launch',focus:i<6?'Yorktown':i%2?'Enterprise':'Yorktown',key:'cut-'+i,at:i*6,screenAt:i*6};
      const position=new T.Vector3(),target=new T.Vector3();assert.equal(scene.replayCamera(position,target),true);
      assert(position.clone().sub(target).dot(scene.replayAxisSide)>0,'each cut stays on the same side of the action axis');
      if(oldTarget){
        assert(oldDirection.dot(scene.replayComposition.direction)>.7,'camera changes framing without flipping to another side');
        const newSize=85/position.distanceTo(target),ratio=newSize/oldSize;assert(ratio>.2&&ratio<5,`bounded framing ratio ${ratio}, aspect ${aspect}`);
      }
      sizes.push(scene.sim.replayShot.framing);scene.camera.position.copy(position);oldTarget=target.clone();
    }
    assert.deepEqual(sizes,Array(12).fill('medium'),'action coverage keeps a tighter scale instead of forcing wide cutaways');
    scene.sim.replayShot={kind:'impact',focus:'Yorktown',key:'too-soon',at:100,screenAt:66.2};
    assert.equal(scene.replayCamera(new T.Vector3(),new T.Vector3()),false);
  }
});

test('circling ships and accelerated replay travel cannot spin the camera around the action',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.camera=new T.PerspectiveCamera(46,1.8,.5,65000);
  scene.sim={player:{heading:0},enemy:{heading:180}};
  scene.ships={Enterprise:{position:new T.Vector3()},Yorktown:{position:new T.Vector3()}};
  let axis=null,heldDirection=null;
  for(let i=0;i<500;i++){
    const angle=i*.025;
    scene.ships.Enterprise.position.set(i*2,30*Math.sin(angle),-i);
    scene.ships.Yorktown.position.copy(scene.ships.Enterprise.position).add(new T.Vector3(Math.sin(angle)*700,120,Math.cos(angle)*700));
    scene.sim.player.heading=i*7%360;scene.sim.enemy.heading=i*11%360;
    scene.sim.replayShot={kind:['wide','impact','launch','hero'][Math.floor(i/40)%4],focus:i%80<40?'Enterprise':'Yorktown',key:'shot-'+Math.floor(i/40),at:i*.1,screenAt:i*.1};
    const position=new T.Vector3(),target=new T.Vector3(),cut=scene.replayCamera(position,target);
    if(!axis)axis=scene.replayAxisSide.clone();assert(scene.replayAxisSide.distanceTo(axis)<1e-8,'viewing side stays fixed as the ships circle');
    const view=position.clone().sub(target).normalize();
    if(!cut)assert(view.dot(heldDirection)>.999999,'a held shot does not orbit around its subject');
    heldDirection=view.clone();
    assert([...position.toArray(),...target.toArray()].every(Number.isFinite));
    if(cut)scene.camera.position.copy(position);else scene.camera.position.lerp(position,.12);
    scene.camera.position.add(new T.Vector3(Math.sin(i)*2,Math.cos(i)*2,0));
    scene.keepReplayScreenDirection(scene.camera.position,target);
    scene.camera.lookAt(target);scene.camera.updateMatrixWorld();
    const enterprise=scene.ships.Enterprise.position.clone().project(scene.camera),yorktown=scene.ships.Yorktown.position.clone().project(scene.camera);
    assert(enterprise.z<1&&enterprise.z>-1&&yorktown.z<1&&yorktown.z>-1,`both ships stay in front of the camera at frame ${i}`);
    assert(Number.isFinite(enterprise.x)&&Number.isFinite(yorktown.x));
  }
});

test('replay tracking eases the camera and look target together without overshooting or rotating',()=>{
  const c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;scene.camera=new T.PerspectiveCamera();
  const offset=new T.Vector3(500,100,0),target=new T.Vector3();scene.trackReplayCamera(offset,target,0,true);
  for(let i=0;i<60;i++){
    const desired=new T.Vector3((i+1)*100,0,0),look=desired.clone();scene.trackReplayCamera(desired.clone().add(offset),look,1/60);
    assert(look.x<desired.x,'camera does not snap to a fast-forwarded subject');
    assert(scene.camera.position.clone().sub(look).distanceTo(offset)<1e-8,'position and look-at move together, preserving orientation');
  }
  const before=scene.camera.position.clone(),look=new T.Vector3(50000,0,0);scene.trackReplayCamera(look.clone().add(offset),look,0);assert(scene.camera.position.equals(before),'pause freezes camera motion');
});
