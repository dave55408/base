const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),B=require('../engine.js'),Replay=require('../replay.js');
function cameraScene(){
  const root=path.join(__dirname,'..'),c={window:{},Battle:B,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,camera:new T.PerspectiveCamera(46,1.8,.5,65000),sim:new B.Simulation(),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()},effects:[]});
  for(const ship of Object.values(s.ships)){const model=new T.Group();ship.add(model);ship.userData.model=model;}
  s.ships.Yorktown.position.set(300,100,-1100);s.burst=()=>{};s.addImpactScar=()=>{};
  return s;
}
function view(s,kind,screenAt,key=kind){
  s.sim.replayShot={kind,focus:'Enterprise',screenAt,key};
  const position=new s.T.Vector3(),target=new s.T.Vector3(),cut=s.replayCamera(position,target);
  s.camera.position.copy(position);return {position,target,cut};
}

test('turn replay uses continuous Cinema coverage around preserved close-up inserts',()=>{
  const s=cameraScene(),T=s.T;s.orbit={x:0,y:0};s.zoom=1;s.mode='cinematic';
  const position=new T.Vector3(),target=new T.Vector3();
  const take=(kind,time,extra={})=>{
    s.sim.replayShot={kind,focus:'Yorktown',key:kind,screenAt:time,at:time,frameDt:.05,...extra};
    s.replayCinemaCamera(position,target,.05);
    if(s.sim.replayShot.cinema)s.camera.position.copy(position);else s.trackReplayCamera(position,target,.05,true);
    s.camera.lookAt(target);s.camera.updateMatrixWorld();s.frameEnterpriseLow(.05);
  };
  take('establishing',0);
  for(let i=1;i<=120;i++)take('duel',i*.05);
  assert(s.sim.replayShot.cinema);assert.equal(s.cinemaTracking.focus,'pair');
  const state=s.cinemaTracking,shuttlePosition=state.position.clone();
  take('component',7,{damageInsert:true,event:{system:'engines'}});
  assert.equal(s.sim.replayShot.cinema,false);assert.equal(s.replayComposition.framing,'close');
  assert.equal(s.sim.replayShot.cameraKind,'component');
  assert(state.position.distanceTo(shuttlePosition)<=state.maxSpeed*.05+1e-7,'the shuttle continues behind the inserted close-up within its current speed limit');
  take('duel',10);
  assert(s.sim.replayShot.cinema);assert.equal(s.cinemaTracking,state,'returning from detail resumes the same camera flight');
  assert(position.distanceTo(state.position)<1e-7);assert.equal(s.camera.zoom,state.lensZoom);
  assert.equal(s.sim.replayShot.cameraFocus,'Enterprise & Yorktown');
  const paused=state.position.clone(),lens=state.lensZoom;
  take('duel',10,{frameDt:0});assert(state.position.distanceTo(paused)<1e-7);assert.equal(state.lensZoom,lens);
  take('destruction',12,{focus:'Yorktown'});
  assert.equal(s.sim.replayShot.cinema,false);assert.equal(s.sim.replayShot.cameraKind,'destruction');
});
test('quiet travel is omitted instead of adding empty tracking beats',()=>{
  const sim=new B.Simulation(),frame={player:sim.player,enemy:sim.enemy,projectiles:[],stageIndex:0,maneuver:'direct',phase:'attack'};
  const record={pass:1,startTime:0,station:sim.station,planet:sim.planet,environment:'space',duration:120,events:[],frames:[{...frame,at:0},{...frame,at:120}]};
  const player=new Replay.Player(record,sim);
  for(let i=0;i<1000&&!player.ended;i++)player.advance(.05);
  assert(player.ended);assert.equal(player.position,4.5);assert(player.screenTime<10,'an uneventful pass only needs its opening');
});

test('tracking shots hold at least seven screen seconds and preserve the viewing side',()=>{
  const s=cameraScene();assert(view(s,'tracking',0).cut);
  for(const time of [1,3,6.9])assert.equal(view(s,'trailing',time).cut,false);
  assert(view(s,'trailing',7).cut);const offset=s.camera.position.clone().sub(s.replayComposition.lastTarget);
  assert(offset.dot(s.replayAxisSide)>0);
});
test('recorded impact queues a reverse shot followed by a tight close-up of its actual hull contact',()=>{
  const s=cameraScene();view(s,'tracking',0);
  s.sim.time=1;s.sim.replayShot.screenAt=1;
  const event={type:'impact',ship:'Yorktown',weapon:'phaser',hullDamage:5,hit:{point:{x:.2,y:.3,z:-.5},normal:{x:0,y:1,z:0}}};
  s.event(event);assert.equal(s.replayReactions.length,1);
  assert.equal(view(s,'tracking',2).cut,false);
  assert(view(s,'tracking',3.5).cut);assert.equal(s.replayComposition.kind,'impact');assert.equal(s.replayComposition.focus,'Yorktown');
  assert.equal(s.replayReactions.length,0);assert.equal(s.replayDetail.event,event);
  assert.equal(view(s,'tracking',6).cut,false);
  const close=view(s,'tracking',7);assert(close.cut);assert.equal(s.replayComposition.kind,'component');
  s.ships.Yorktown.updateMatrixWorld(true);
  const hit=s.ships.Yorktown.userData.model.localToWorld(new s.T.Vector3(.2,.3,-.5));
  assert(close.target.distanceTo(hit)<1e-8);assert(close.position.distanceTo(close.target)<200);
});
test('fly-by holds a fixed camera while the ship travels through the shot',()=>{
  const s=cameraScene(),first=view(s,'flyby',0);
  s.ships.Enterprise.position.x+=100;
  const next=view(s,'flyby',1);
  assert.equal(next.cut,false);const cameraMovement=next.position.x-first.position.x;
  assert.equal(cameraMovement,0,'camera stays put while the ship crosses the frame');assert(next.target.distanceTo(first.target)<1e-8,'look direction stays fixed too');
});

test('close maneuver and weapon views fit both complete hulls on the established side across viewports',()=>{
  for(const aspect of [.6,1,1.8,2.5])for(const range of [250,700,1400])for(const kind of ['establishing','duel','phaser','torpedo','withdrawal']){
    const s=cameraScene(),T=s.T;s.camera.aspect=aspect;s.camera.updateProjectionMatrix();
    s.ships.Yorktown.position.set(range*.3,range*.12,-range);
    const shot=view(s,kind,0);assert.equal(s.replayComposition.twoShips,true);
    assert(shot.position.clone().sub(shot.target).dot(s.replayAxisSide)>0);
    s.camera.lookAt(shot.target);s.camera.updateMatrixWorld();
    const direction=shot.position.clone().sub(shot.target).normalize(),right=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0)).normalize(),up=new T.Vector3().crossVectors(right,direction).normalize();
    for(const ship of Object.values(s.ships))for(const x of [-85,85])for(const y of [-85,85])for(const z of [-85,85]){
      const point=ship.position.clone().addScaledVector(right,x).addScaledVector(up,y).addScaledVector(direction,z).project(s.camera);
      assert(Math.abs(point.x)<.99&&Math.abs(point.y)<.99&&point.z>-1&&point.z<1,`${kind} fits hull bounds at aspect ${aspect}, range ${range}`);
    }
    const held=shot.position.clone().sub(shot.target).normalize();
    s.sim.player.heading=275;s.sim.enemy.heading=90;
    const next=view(s,kind,1);assert.equal(next.cut,false);assert(next.position.clone().sub(next.target).normalize().dot(held)>.999999,'ship heading never orbits the camera');
  }
});

test('the opening starts at the same close two-ship scale as the action',()=>{
  const s=cameraScene(),opening=view(s,'establishing',0),wide=opening.position.distanceTo(opening.target);
  const close=view(s,'duel',5);assert(close.cut);assert(wide<=close.position.distanceTo(close.target)*1.1,'opening no longer pulls back for K7 or the planet');assert(s.replayComposition.twoShips);
});

test('the replay director identifies withdrawals and never fast-forwards turning ships',()=>{
  const sim=new B.Simulation(),frame={player:sim.player,enemy:sim.enemy,projectiles:[],stageIndex:1,maneuver:'flee',phase:'withdraw'};
  const record={pass:1,startTime:0,station:sim.station,planet:sim.planet,environment:'space',duration:120,events:[],frames:[{...frame,at:0},{...frame,at:120}]};
  const player=new Replay.Player(record,sim);assert.equal(player.state.replayShot.kind,'establishing');
  player.screenTime=8;player.sample(30);assert.equal(player.state.replayShot.kind,'withdrawal');assert.equal(player.state.replayShot.focus,'Enterprise');
  for(const f of record.frames){f.enemyRetreating=true;f.maneuver='direct';f.phase='attack';f.enemy={...f.enemy,turnRate:45};}
  player.sample(30);assert.equal(player.state.replayShot.focus,'Yorktown');player.playbackRate=6;
  assert(player.advance(.1).rate<=.65,'fast travel speed is clamped immediately when the ship turns');
});


test('highlights skip empty intervals but keep torpedo launch through impact and aftermath',()=>{
  const sim=new B.Simulation(),frames=[];
  const projectile={id:'long-flight',from:'Enterprise',target:'Yorktown',pos:{x:0,y:0,z:-500}};
  for(let at=0;at<=100;at+=.5)frames.push({at,player:{...sim.player},enemy:{...sim.enemy},projectiles:at>=20&&at<35?[projectile]:[],stageIndex:0,maneuver:'direct',phase:'attack'});
  const events=[{at:20,event:{type:'launch',from:'Enterprise',to:'Yorktown'}},{at:35,event:{type:'impact',ship:'Yorktown',weapon:'torpedo',hullDamage:20}},{at:70,event:{type:'beam',from:'Yorktown',to:'Enterprise'}},{at:71,event:{type:'impact',ship:'Enterprise',weapon:'phaser',hullDamage:8}}];
  const record={pass:1,startTime:0,station:sim.station,planet:sim.planet,environment:'space',duration:100,frames,events},before=JSON.stringify(record);
  const p=new Replay.Player(record,sim),scene=p.sequences.find(s=>s.start<=20&&s.end>=35);
  assert(scene&&scene.end>=37.5,'the complete torpedo flight and reaction are retained');
  assert(p.sequences.reduce((sum,s)=>sum+s.end-s.start,0)<35,'most empty travel is removed');
  const seen=[],positions=[];let cuts=0;
  for(let i=0;i<10000&&!p.ended;i++){const update=p.advance(.05);seen.push(...update.events);positions.push(p.position);if(update.cut){cuts++;assert(update.dt<.5,'a timeline jump is not simulated as a giant effect step');}}
  assert(p.ended);assert(cuts>=2,'travel gaps and quiet aftermath can both be edited');assert.equal(seen.length,events.length);
  assert(!positions.some(at=>at>42&&at<65),'quiet gap is cut, not fast-forwarded');
  assert.equal(JSON.stringify(record),before,'the complete original recording remains untouched');
});

test('only the strongest separated exchanges survive the highlight edit',()=>{
  const sim=new B.Simulation(),frame={player:sim.player,enemy:sim.enemy,projectiles:[],stageIndex:0,maneuver:'direct',phase:'attack'};
  const record={duration:110,frames:[{...frame,at:0},{...frame,at:110}],events:Array.from({length:7},(_,i)=>({at:10+i*14,event:{type:'impact',ship:'Yorktown',hullDamage:i*5,weapon:'phaser'}}))};
  const scenes=Replay.highlights(record);
  assert.equal(scenes.length,6,'opening plus five strong exchanges');
  assert(!scenes.some(s=>s.start<=10&&s.end>=10),'weak shield hit is omitted');
  assert(scenes.some(s=>s.start<=94&&s.end>=94),'heaviest damage is retained');
});

test('a selected exchange holds its view through firing, flight and damage until it resolves',()=>{
  const s=cameraScene(),T=s.T;
  const take=(kind,time,key)=>{
    s.sim.replayShot={kind,focus:'Enterprise',key,sequenceKey:key,sequenceEnd:30,screenAt:time};
    const position=new T.Vector3(),target=new T.Vector3(),cut=s.replayCamera(position,target);s.camera.position.copy(position);return cut;
  };
  assert(take('phaser',0,'exchange-1'));const direction=s.replayComposition.direction.clone();
  for(const [kind,time] of [['torpedo',6],['impact',12],['duel',18]]){
    assert.equal(take(kind,time,'exchange-1'),false,'no timer or hit interrupts the exchange');
    assert(s.replayComposition.direction.dot(direction)>.999999);
  }
  assert(take('withdrawal',20,'exchange-2'),'the next selected sequence can begin a new composition');
});


test('nontracking replay shots lock both camera position and look target until the next cut',()=>{
  for(const kind of ['establishing','duel','phaser','torpedo','impact','withdrawal','destruction','flyby']){
    const s=cameraScene(),first=view(s,kind,0);
    s.ships.Enterprise.position.add(new s.T.Vector3(900,300,200));s.ships.Yorktown.position.add(new s.T.Vector3(-500,-100,-300));
    s.sim.projectiles=[{id:'torpedo',pos:{x:250,y:30,z:-500}}];
    const second=view(s,kind,2);
    assert.equal(second.cut,false);assert(second.position.distanceTo(first.position)<1e-8,kind+' camera position is fixed');assert(second.target.distanceTo(first.target)<1e-8,kind+' has no pan');
    const target=second.target.clone();s.trackReplayCamera(second.position,target,1/60);
    assert(s.camera.position.distanceTo(first.position)<1e-8,'camera smoothing cannot drift a static shot');
    s.keepReplayScreenDirection(s.camera.position,target);assert(s.camera.position.distanceTo(first.position)<1e-8,'framing correction cannot follow the ships');
  }
});

test('explicit ship tracking still follows its subject without orbiting',()=>{
  const s=cameraScene(),first=view(s,'tracking',0),direction=first.position.clone().sub(first.target).normalize();
  s.ships.Enterprise.position.x+=100;s.ships.Yorktown.position.x+=100;
  const second=view(s,'tracking',2);assert.equal(second.cut,false);assert(second.target.x>first.target.x+90);assert(second.position.x>first.position.x+90);
  assert(second.position.clone().sub(second.target).normalize().dot(direction)>.999999,'tracking holds its viewing angle');
});


test('fixed replay shots zoom in for close action and out for separation without moving the camera',()=>{
  const s=cameraScene(),T=s.T,first=view(s,'duel',0),initial=s.camera.zoom;
  const midpoint=s.ships.Enterprise.position.clone().lerp(s.ships.Yorktown.position,.5);
  s.ships.Enterprise.position.copy(midpoint).add(new T.Vector3(-65,0,0));s.ships.Yorktown.position.copy(midpoint).add(new T.Vector3(65,0,0));
  view(s,'duel',1);assert(s.camera.zoom>initial&&s.camera.zoom-initial<.1,'zoom tightens smoothly');
  for(let i=0;i<300;i++)view(s,'duel',2);const tight=s.camera.zoom;assert(tight>initial*1.1,'close action gets a tighter frame');
  const right=new T.Vector3().crossVectors(first.target.clone().sub(first.position).normalize(),new T.Vector3(0,1,0)).normalize();
  s.ships.Enterprise.position.copy(midpoint).addScaledVector(right,-1000);s.ships.Yorktown.position.copy(midpoint).addScaledVector(right,1000);
  const widened=view(s,'duel',3);assert(s.camera.zoom<tight,'departing subjects widen the lens');assert(widened.position.distanceTo(first.position)<1e-8);assert(widened.target.distanceTo(first.target)<1e-8);
  for(let i=0;i<300;i++)view(s,'duel',4);assert(s.camera.zoom<tight*.7,'wide action receives a wider frame');
  s.camera.lookAt(first.target);s.camera.updateMatrixWorld();for(const ship of Object.values(s.ships)){
    const projected=ship.position.clone().project(s.camera);assert(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9,'both subjects stay framed after zooming out');
  }
  const paused=s.camera.zoom;s.sim.replayShot.frameDt=0;s.ships.Enterprise.position.copy(midpoint);s.zoomReplayAction(first.position,first.target);assert.equal(s.camera.zoom,paused,'pause freezes the lens');
});


test('a lull inside a merged scene cuts ahead to the next action instead of lingering',()=>{
  const sim=new B.Simulation(),frames=[];
  for(let at=0;at<=30;at+=.1)frames.push({at,player:{...sim.player,turnRate:0},enemy:{...sim.enemy,turnRate:0},projectiles:[],stageIndex:0,maneuver:'flee',phase:at<9?'withdraw':'attack'});
  const record={pass:1,startTime:0,station:sim.station,planet:sim.planet,duration:30,frames,events:[{at:10,event:{type:'beam',from:'Enterprise',to:'Yorktown',duration:1.4}},{at:11,event:{type:'impact',ship:'Yorktown',hullDamage:10}}]};
  const p=new Replay.Player(record,sim),seen=[];let jumped=false;
  for(let i=0;i<3000&&!p.ended;i++){
    const before=p.position,update=p.advance(.05);seen.push(...update.events);
    if(update.cut&&before>=4.5&&before<8&&p.position>8.5){jumped=true;assert(update.dt<.5,'the skipped lull does not advance visual effects');}
  }
  assert(jumped,'boring withdrawal tail cuts forward to the next shot');assert.equal(seen.length,2,'firing and damage are preserved');
});

test('an unresolved torpedo prevents boredom cuts even during a long flight',()=>{
  const sim=new B.Simulation(),projectile={id:'pending',from:'Enterprise',target:'Yorktown',pos:{x:0,y:0,z:0}},frames=[];
  for(let at=0;at<=40;at+=.5)frames.push({at,player:sim.player,enemy:sim.enemy,projectiles:at>=6&&at<25?[projectile]:[],stageIndex:0,maneuver:'direct',phase:'attack'});
  const record={pass:1,startTime:0,station:sim.station,planet:sim.planet,duration:40,frames,events:[{at:6,event:{type:'launch',from:'Enterprise'}},{at:25,event:{type:'impact',ship:'Yorktown',hullDamage:10}}]};
  const p=new Replay.Player(record,sim);let impact=false;
  for(let i=0;i<4000&&!p.ended;i++){
    const before=p.position,update=p.advance(.05);
    if(before>=6&&before<25)assert.equal(update.cut,false,'flight stays on screen until the torpedo resolves');
    if(update.events.some(e=>e.type==='impact'))impact=true;
  }
  assert(impact);
});


test('dialogue holds a selected scene until speech finishes and skipped scenes do not deliver their voices',()=>{
  const sim=new B.Simulation(),base={player:sim.player,enemy:sim.enemy,projectiles:[],stageIndex:0,maneuver:'direct',phase:'attack'};
  const record={pass:1,startTime:0,duration:30,station:sim.station,planet:sim.planet,frames:[{...base,at:0},{...base,at:30}],events:[{at:10,event:{type:'bridge-dialogue',reply:'Skip this.'}},{at:24,event:{type:'beam',from:'Enterprise',to:'Yorktown'}},{at:24,event:{type:'bridge-dialogue',order:'Fire phasers',clip:'assets/Fire phasers.mp3'}}]};
  const p=new Replay.Player(record,sim);p.position=p.sequences[0].end;p.dialogueBusy=true;p.advance(.1);assert.equal(p.sequenceIndex,0,'a scene cannot cut over unfinished dialogue');
  p.dialogueBusy=false;const events=[];
  for(let i=0;i<5000&&!p.ended;i++)events.push(...p.advance(.05).events);
  assert(!events.some(e=>e.reply==='Skip this.'));assert(events.some(e=>e.order==='Fire phasers'));
});


test('close action uses visible hull geometry to fill the frame more tightly',()=>{
  const s=cameraScene(),T=s.T;s.ships.Yorktown.position.set(120,10,-40);
  for(const ship of Object.values(s.ships))ship.userData.model.add(new T.Mesh(new T.BoxGeometry(90,22,135),new T.MeshBasicMaterial()));
  const shot=view(s,'duel',0);s.camera.lookAt(shot.target);s.camera.updateMatrixWorld();
  const points=Object.values(s.ships).flatMap(ship=>s.replayHullPoints(ship)).map(point=>point.project(s.camera));
  assert(s.camera.zoom>1.5,'the close encounter gets a meaningful zoom-in');
  assert(points.every(point=>Math.abs(point.x)<.96&&Math.abs(point.y)<.94),'complete visible hulls remain inside the frame');
  assert(points.some(point=>Math.abs(point.x)>.8||Math.abs(point.y)>.8),'ships fill the close action frame');
  const held=shot.position.clone();s.ships.Yorktown.position.x+=10;const next=view(s,'duel',1);assert(next.position.distanceTo(held)<1e-8,'tightening the lens does not orbit a fixed shot');
});

test('recorded hull damage schedules a close-up before impact, including inside a held sequence',()=>{
  const sim=new B.Simulation(),frame={player:sim.player,enemy:sim.enemy,projectiles:[],stageIndex:0,maneuver:'close',phase:'attack'},hit={point:{x:.2,y:.3,z:-1},normal:{x:0,y:1,z:0}};
  const record={pass:1,startTime:0,duration:15,station:sim.station,planet:sim.planet,frames:[{...frame,at:0},{...frame,at:15}],events:[{at:8,event:{type:'impact',ship:'Yorktown',hullDamage:5,weapon:'phaser',hit}}]};
  const player=new Replay.Player(record,sim);player.screenTime=6;player.sample(7.9);const shot=player.state.replayShot;
  assert.equal(shot.kind,'component');assert.equal(shot.damageInsert,true);assert.equal(shot.focus,'Yorktown');assert.deepEqual(shot.event.hit,hit);assert.notEqual(shot.key,shot.sequenceKey,'damage inserts can cut inside a continuous exchange');
  player.screenTime=10;player.sample(10);assert.equal(player.state.replayShot.kind,'component','the burn remains visible for its aftermath');
  player.screenTime=12;player.sample(12);assert.notEqual(player.state.replayShot.kind,'component','director returns to the wider action after the damage view');
  record.events[0].event.hullDamage=0;const absorbed=new Replay.Player(record,sim);absorbed.screenTime=6;absorbed.sample(7.9);assert.notEqual(absorbed.state.replayShot.kind,'component','absorbed shield hits do not invent hull damage');
});

test('damage close-ups face the actual top, underside and far-side burn as a ship banks and moves',()=>{
 for(const normal of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]){
  const s=cameraScene(),T=s.T,ship=s.ships.Yorktown,model=ship.userData.model,position=new T.Vector3(),target=new T.Vector3();
  ship.rotation.set(.25,.7,.6);const hit={point:{x:.2,y:.3,z:-.5},normal:{x:normal[0],y:normal[1],z:normal[2]}};
  s.sim.replayShot={kind:'component',focus:'Yorktown',key:'burn',screenAt:7,damageInsert:true,event:{hullDamage:10,hit}};
  assert(s.replayCamera(position,target));assert(s.replayComposition.damageLocalDirection);
  for(const step of [0,1]){
   if(step){ship.position.add(new T.Vector3(60,35,-80));ship.rotation.y+=.9;s.sim.replayShot.screenAt+=.3;s.replayCamera(position,target);}
   const outward=new T.Vector3(...normal).transformDirection(model.matrixWorld),contact=model.localToWorld(new T.Vector3(.2,.3,-.5));
   assert(target.distanceTo(contact)<1e-7);assert(position.clone().sub(target).normalize().dot(outward)>.9,'camera stays on the visible side of the damaged surface');
   s.trackReplayCamera(position,target,1/60);assert(s.camera.position.distanceTo(position)<1e-8,'tracking does not lag behind the scar');
   const before=position.clone();s.keepReplayScreenDirection(position,target);assert(position.distanceTo(before)<1e-8,'screen-side rules cannot hide a far-side burn');
  }
 }
});

test('damage camera shifts around an opaque fitting instead of looking through it',()=>{
 const s=cameraScene(),T=s.T,ship=s.ships.Yorktown,model=ship.userData.model;ship.position.set(0,0,0);
 const surface=new T.Mesh(new T.BoxGeometry(2,2,.1),new T.MeshStandardMaterial());surface.position.z=-.05;model.add(surface);
 const fitting=new T.Mesh(new T.BoxGeometry(.7,.7,.3),new T.MeshStandardMaterial());fitting.position.set(.75,0,3);model.add(fitting);
 const direction=s.replayDamageDirection(ship,{point:{x:0,y:0,z:0},normal:{x:0,y:0,z:1}},new T.Vector3(1,0,0),10);
 const contact=s.traceHull(ship,direction.clone().multiplyScalar(10),new T.Vector3(),{camera:true});assert(contact.point.length()<.01,'selected view sees the damage surface first');assert(direction.z>.99);
});

test('even a locked damage close-up drifts gently across the frame and remains stable when paused',()=>{
 const s=cameraScene(),T=s.T,position=new T.Vector3(),target=new T.Vector3();
 s.sim.replayShot={kind:'component',focus:'Yorktown',key:'burn',screenAt:7,event:{hit:{point:{x:.2,y:.3,z:-.5},normal:{x:0,y:1,z:0}},hullDamage:5}};
 s.replayCamera(position,target);s.trackReplayCamera(position,target,1/60,true);s.camera.lookAt(target);s.camera.updateMatrixWorld();
 const cameraBefore=s.camera.position.clone();s.sim.replayShot.screenAt=9;s.camera.updateProjectionMatrix();s.applyReplayDrift();const first=target.clone().project(s.camera);
 assert(Math.abs(first.x)>.01&&Math.abs(first.x)<.04,'close-up has a small lateral drift');assert(Math.abs(first.y)<.01);assert(s.camera.position.equals(cameraBefore),'the pan does not orbit away from the damaged face');
 s.camera.updateProjectionMatrix();s.applyReplayDrift();assert(target.clone().project(s.camera).distanceTo(first)<1e-9,'paused replay holds its screen position');
 s.sim.replayShot=null;s.camera.updateProjectionMatrix();s.applyReplayDrift();assert(Math.abs(target.clone().project(s.camera).x)<1e-8,'live framing has no replay drift');
});

test('damage inserts track the exact hull contact and return to the action without reversing screen side',()=>{
  const s=cameraScene(),T=s.T,position=new T.Vector3(),target=new T.Vector3(),event={hit:{point:{x:.2,y:.3,z:-.5},normal:{x:0,y:1,z:0}},hullDamage:5};
  const take=shot=>{s.sim.replayShot={sequenceKey:'exchange',focus:'Yorktown',...shot};const cut=s.replayCamera(position,target);s.camera.position.copy(position);return cut;};
  assert(take({kind:'duel',key:'exchange',screenAt:5}));
  assert(take({kind:'component',key:'damage',screenAt:7,damageInsert:true,event}));assert.equal(s.replayComposition.kind,'component');
  s.ships.Yorktown.updateMatrixWorld(true);const contact=s.ships.Yorktown.userData.model.localToWorld(new T.Vector3(.2,.3,-.5));assert(target.distanceTo(contact)<1e-8);assert(position.distanceTo(target)<150);
  assert(position.clone().sub(target).dot(s.replayAxisSide)>0,'close-up respects the established 180-degree side');
  assert.equal(take({kind:'duel',key:'exchange',screenAt:8}),false,'close-up gets time to register');
  assert(take({kind:'duel',key:'exchange',screenAt:10}));assert.equal(s.replayComposition.twoShips,true);assert(position.clone().sub(target).dot(s.replayAxisSide)>0);
});
