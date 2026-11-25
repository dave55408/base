const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const B=require('../engine.js'),Replay=require('../replay.js');
function sceneHarness(){
  const drawing=new Proxy({}, {get:()=>()=>{}}),c={window:{},Battle:B,console,AbortController,document:{createElement:()=>({getContext:()=>drawing})}};vm.createContext(c);
  for(const p of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);Object.assign(scene,{T,sim:new B.Simulation(),scene:new T.Scene(),effects:[],projectiles:new Map(),texture:()=>({}),burst:()=>{}});
  scene.ships={Enterprise:scene.makeShip('Enterprise','NCC-1701',false),Yorktown:scene.makeShip('Yorktown','NCC-1717',true)};return scene;
}

test('engine loss leaves one hull-wrapped scorch per attachment and rewinding restores the hull',()=>{
  const scene=sceneHarness(),ship=scene.ships.Yorktown,state=scene.sim.enemy;
  for(const side of ['port','starboard']){
    state.detachedNacelles[side]=true;scene.syncNacelles(ship,state);
    const scar=ship.userData.mountScars[side];assert(scar?.parent,'attachment has a visible scorch');
    assert.equal(scar.userData.mountSide,side);assert(ship.userData.scars.includes(scar));
    scene.syncNacelles(ship,state);assert.equal(ship.userData.mountScars[side],scar,'later frames reuse the scorch');
  }
  assert.equal(Object.keys(ship.userData.mountScars).length,2);
  state.detachedNacelles={port:false,starboard:false};scene.syncNacelles(ship,state);
  assert.equal(Object.keys(ship.userData.mountScars).length,0);assert.equal(ship.userData.scars.length,0);
});

test('only penetrating pylon damage severs the corresponding nacelle, once per side',()=>{
  const sim=new B.Simulation(97),p=sim.player,e=sim.enemy,arc=B.facing(e,p),hit={pylonSide:'port',component:'mainEngines',point:{x:-.3,y:.3,z:.06}};
  sim.damage(e,p,1,'phaser','hull',hit);assert.equal(e.detachedNacelles.port,false,'shield absorption protects the pylon');
  e.shields[arc]=0;sim.damage(e,p,10,'phaser','hull',hit);assert(e.detachedNacelles.port);assert.equal(e.detachedNacelles.starboard,false);assert(e.integrity.mainEngines<=50);
  sim.damage(e,p,10,'phaser','hull',hit);assert.equal(sim.events.filter(v=>v.type==='nacelle-detached').length,1,'repeated pylon hits do not spawn another engine');
  sim.damage(e,p,10,'torpedo','hull',{...hit,pylonSide:'starboard'});assert(e.detachedNacelles.starboard);assert.equal(sim.events.filter(v=>v.type==='nacelle-detached').length,2);
  e.integrity.mainEngines=100;const repaired=sim.output(e,'engines');e.detachedNacelles={port:false,starboard:false};assert(sim.output(e,'engines')>repaired,'repairs cannot restore a missing engine');
  sim.reset();assert.equal(sim.enemy.detachedNacelles.port,false);
});

test('actual pylon intersections identify the side and its engine becomes independent drifting debris',()=>{
  for(const side of ['port','starboard']){
    const scene=sceneHarness(),T=scene.T,ship=scene.ships.Yorktown,state=scene.sim.enemy;scene.syncWeaponShip(state);
    const pylon=ship.userData.breakupParts.find(p=>p.userData.pylonSide===side),sign=side==='port'?-1:1,local=pylon.position.clone();
    const start=ship.userData.model.localToWorld(local.clone().add(new T.Vector3(sign*3,0,0))),end=ship.userData.model.localToWorld(local.clone());
    const hit=scene.resolveWeaponHit(scene.sim.player,state,'hull','torpedo',start,end);assert(hit);assert.equal(hit.pylonSide,side);assert.equal(hit.component,'mainEngines');
    state.shields[B.facing(state,scene.sim.player)]=0;scene.sim.damage(state,scene.sim.player,20,'torpedo','hull',hit);
    const event=scene.sim.events.find(e=>e.type==='nacelle-detached');assert(event);scene.event(event);scene.event(event);
    const debris=scene.effects.filter(e=>e.kind==='nacelle-debris');assert.equal(debris.length,1);assert.equal(ship.userData.nacelles[side].visible,false);assert.equal(ship.userData.nacelles[side==='port'?'starboard':'port'].visible,true);
    const support=debris[0].object.children.find(part=>part.userData.pylonSide===side);assert(support,'engine debris carries its pylon');assert(support.visible);assert.equal(pylon.visible,false,'pylon is gone from the surviving ship');
    scene.scene.updateMatrixWorld(true);const expected=pylon.getWorldPosition(new T.Vector3()),actual=support.getWorldPosition(new T.Vector3());assert(actual.distanceTo(expected)<1e-6,'pylon retains its attachment alignment when it breaks free');assert.notEqual(support.geometry,pylon.geometry);
    assert(debris[0].object.visible);assert.equal(debris[0].object.parent,scene.scene);const before=debris[0].object.position.clone();scene.advanceDebris(debris[0],1);assert(debris[0].object.position.distanceTo(before)>5);
    const forward=B.direction(state),separationVelocity=debris[0].velocity.clone().sub(new T.Vector3(forward.x,forward.y,forward.z).multiplyScalar(state.speed));assert(separationVelocity.length()<20,'detached engines drift away gently');
    assert.notEqual(debris[0].object.children[0].geometry,ship.userData.nacelles[side].children[0].geometry,'disposing debris cannot dispose the reusable model');
    const geometry=ship.userData.nacelles[side].children[0].geometry;scene.disposeEffect(debris[0]);assert(geometry.attributes.position.count>0);
  }
});

test('replay state preserves missing engines across later scenes and a fresh state restores them',()=>{
  const scene=sceneHarness(),sim=scene.sim;sim.running=true;sim.applyPlanPreset('strong');sim.commitOrders();const recorder=new Replay.Recorder(sim);recorder.capture(sim,true);
  sim.time=1;sim.enemy.detachedNacelles.port=true;sim.events.push({type:'nacelle-detached',ship:'Yorktown',side:'port'});recorder.capture(sim,true);sim.time=5;const record=recorder.finish(sim),player=new Replay.Player(record,sim);
  player.sample(2);scene.syncNacelles(scene.ships.Yorktown,player.state.enemy);assert.equal(scene.ships.Yorktown.userData.nacelles.port.visible,false);assert.equal(scene.ships.Yorktown.userData.breakupParts.find(part=>part.userData.pylonSide==='port').visible,false);
  player.sample(0);scene.syncNacelles(scene.ships.Yorktown,player.state.enemy);assert.equal(scene.ships.Yorktown.userData.nacelles.port.visible,true);assert.equal(scene.ships.Yorktown.userData.breakupParts.find(part=>part.userData.pylonSide==='port').visible,true);
});


test('temporary engine preview aims real Yorktown fire at a pylon and switches sides after the first breakoff',()=>{
  const scene=sceneHarness(),sim=scene.sim=new B.Simulation(97);sim.previewNacelleBreakoff=true;
  sim.resolveWeaponHit=(...args)=>scene.resolveWeaponHit(...args);sim.running=true;sim.applyPlanPreset('strong');assert(sim.commitOrders());
  assert(sim.turn.enemyOrders.every(order=>order.target==='mainEngines'));
  let detached=false,pylonHits=0;
  for(let i=0;i<2400&&!sim.result&&!detached;i++){
    sim.tick(.05);
    for(const event of sim.events){
      if(event.type==='beam'&&event.from==='Yorktown'&&event.hit?.pylonSide)pylonHits++;
      if(event.type==='nacelle-detached'&&event.ship==='Enterprise')detached=true;
    }
    sim.events=[];
    if(sim.turn.phase==='review'){sim.applyPlanPreset('strong');sim.commitOrders();}
  }
  assert(pylonHits>0,'Yorktown actually intersects the pylon');assert(detached,'normal damage rules produce the engine breakoff');assert.equal(sim.previewNacelleBreakoff,true,'preview continues until both engines are gone');const remaining=sim.player.detachedNacelles.port?'starboard':'port';assert.equal(sim.previewAttackArc,remaining);assert(sim.turn.enemyOrders.filter(order=>order.status==='pending').every(order=>order.attackArc===remaining));
});


test('engine hunter fire physically reaches a stationary target warp pylon without the preview',()=>{
  const scene=sceneHarness(),sim=scene.sim=new B.Simulation(97);sim.setEnemyPersonality('hunter');
  Object.assign(sim.player,{x:6000,y:0,z:0,heading:0});Object.assign(sim.enemy,{x:5300,y:0,z:0,heading:90});
  sim.autoHelm=()=>{};sim.player.fullStop=true;sim.player.integrity.weapons=0;
  for(const arc of B.arcs)sim.player.shields[arc]=0;
  sim.resolveWeaponHit=(...args)=>scene.resolveWeaponHit(...args);
  sim.running=true;sim.applyPlanPreset('strong');assert(sim.commitOrders());
  const side=sim.enemyWarpEngineSide();assert.equal(side,'port');
  let hit=false;
  for(let i=0;i<700&&!sim.result&&!sim.player.detachedNacelles[side];i++){
    sim.tick(.05);
    hit ||= sim.events.some(e=>e.type==='impact'&&e.ship==='Enterprise'&&e.hit?.pylonSide===side);
    sim.events=[];
    if(sim.turn.phase==='review'){sim.applyPlanPreset('strong');sim.commitOrders();}
  }
  assert(hit,'normal hunter targeting intersects its selected pylon');
  assert(sim.player.detachedNacelles[side],'normal penetrating damage detaches the targeted engine');
  assert.equal(sim.enemyWarpEngineSide(),'starboard');assert(!sim.previewNacelleBreakoff);
});

test('Yorktown retargets the remaining engine immediately and ends the preview only after both are lost',()=>{
  const sim=new B.Simulation(97);sim.previewNacelleBreakoff=true;sim.running=true;sim.applyPlanPreset('strong');sim.commitOrders();
  const first=sim.previewAttackArc,second=first==='port'?'starboard':'port';for(const arc of B.arcs)sim.player.shields[arc]=0;
  const hit=side=>({pylonSide:side,component:'mainEngines',point:{x:side==='port'?-.3:.3,y:.3,z:0}});
  sim.damage(sim.player,sim.enemy,10,'phaser','mainEngines',hit(first));assert.equal(sim.previewNacelleBreakoff,true);assert.equal(sim.previewAttackArc,second);
  assert(sim.planEnemy().every(order=>order.target==='mainEngines'&&order.attackArc===second));
  sim.damage(sim.player,sim.enemy,10,'phaser','mainEngines',hit(second));assert.equal(sim.previewNacelleBreakoff,false);assert(sim.player.detachedNacelles.port&&sim.player.detachedNacelles.starboard);
});


test('either ship loses most of its available speed after one or both nacelles are detached',()=>{
  for(const name of ['player','enemy'])for(const power of [24,60]){
    const sim=new B.Simulation(97),ship=sim[name],target=sim[name==='player'?'enemy':'player'];ship.power.engines=power;
    Object.assign(ship,{x:3000,y:1000,z:0,heading:0,pitch:0});Object.assign(target,{x:3000,y:1000,z:-5000});
    const aim={x:ship.x,y:ship.y,z:ship.z-10000},top=()=>sim.desiredFlightSpeed(ship,target,aim,{mode:'ram',turnRate:42}).maximum;
    const intact=top();ship.detachedNacelles.port=true;assert(Math.abs(top()/intact-.45)<1e-8,'one lost engine leaves 45% of normal top speed');
    ship.detachedNacelles.starboard=true;assert(Math.abs(top()/intact-.12)<1e-8,'both lost engines leave only 12%');
    ship.integrity.mainEngines=100;assert(Math.abs(top()/intact-.12)<1e-8,'repairs cannot bypass detached-engine limits');
    ship.speed=intact;ship.flightAcceleration=0;for(let i=0;i<400;i++)sim.adjustFlightSpeed(ship,target,aim,{mode:'ram',turnRate:42},.05);
    assert(ship.speed<=Math.max(B.MIN_IMPULSE_SPEED,intact*.12)+.05,'actual velocity decelerates to the reduced limit');
  }
});

test('collision components follow a 81 percent inset of the rendered hull at its actual pitch and bank',()=>{
  const scene=sceneHarness(),sim=scene.sim,T=scene.T;
  Object.assign(sim.player,{x:6000,y:200,z:-400,heading:123,pitch:31,bank:.43});
  const ship=scene.syncWeaponShip(sim.player),shapes=B.shipCollisionShapes(sim.player);
  let checked=0;
  for(const part of ship.userData.breakupParts)part.traverse(mesh=>{
    const positions=mesh.geometry?.attributes?.position;if(!positions)return;
    for(let i=0;i<positions.count;i+=13){
      const point=mesh.localToWorld(new T.Vector3(positions.getX(i),positions.getY(i),positions.getZ(i)));
      point.sub(ship.position).multiplyScalar(.81).add(ship.position);
      assert(shapes.some(shape=>shape.axes.every((axis,j)=>Math.abs((point.x-shape.center.x)*axis.x+(point.y-shape.center.y)*axis.y+(point.z-shape.center.z)*axis.z)<=shape.half[j]+.5)),`uncovered ${part.name||'hull'} vertex ${i}`);
      checked++;
    }
  });
  assert(checked>500,'samples the actual visible component surfaces');
});

test('manual forward and reverse thrust honor engine loss after braking',()=>{
  for(const sign of [-1,1]){
    const sim=new B.Simulation(97,{turnBased:false});sim.running=true;sim.stationTrace=()=>null;sim.moveAroundPlanet=()=>{};
    Object.assign(sim.player,{x:5000,y:1000,z:0,heading:0,throttle:100*sign,speed:187.5*sign});Object.assign(sim.enemy,{x:-5000,y:1000,z:0});sim.enemy.integrity.weapons=0;
    sim.player.detachedNacelles={port:true,starboard:true};
    for(let i=0;i<400;i++)sim.tick(.05);
    assert(Math.abs(sim.player.speed)<=22.6,'manual thrust cannot exceed the 12% speed limit');assert.equal(Math.sign(sim.player.speed),sign);
  }
});
