const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
const advance=(s,n,keys={})=>{for(let i=0;i<Math.ceil(n/.05);i++)s.tick(.05,keys);};
test('turns reject a third maneuver in selections, assignments and submitted plans',()=>{
  const s=new B.Simulation();s.running=true;
  assert.equal(B.MANEUVER_COUNT,2);assert.equal(s.turn.draftManeuvers.length,2);
  assert(s.selectManeuver('direct',0));assert(s.selectManeuver('above',1));
  const before=JSON.stringify(s.turn);
  assert.equal(s.selectManeuver('port',2),false);assert.equal(s.deleteManeuver(2),false);
  assert.equal(s.updateStep(0,{weapon:'phaser',target:'hull',range:1000,maneuvers:[2]}),false);
  assert.equal(JSON.stringify(s.turn),before);
  for(let i=0;i<B.ATTACK_COUNT;i++)assert(s.updateStep(i,{weapon:'phaser',target:'hull',range:1000,maneuvers:[0,1]}));
  assert(s.planReady());assert.equal(s.planReady(s.turn.draft,['direct','above','port']),false);
  assert(s.commitOrders());
  assert.equal(s.applyRevisions(s.turn.draft,['direct','above','port']),false);
  assert.equal(s.turn.maneuvers.length,2);assert.equal(s.turn.orders.length,3);
});
function setup(key='direct'){
  const s=new B.Simulation();s.running=true;
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:150,z:-1800,heading:180});
  assert(s.selectManeuver(key));if(key!=='flee')['phaser','phaser','torpedo'].forEach((weapon,i)=>assert(s.updateStep(i,{weapon,target:'hull',range:[1100,800,600][i]})));
  assert(s.commitOrders());return s;
}
test('all eleven maneuvers require selection and a committed maneuver stays locked',()=>{
  assert.equal(Object.keys(B.maneuvers).length,11);const s=new B.Simulation();
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:800}));
  assert.equal(s.planReady(),false);assert.equal(s.selectManeuver('unknown'),false);assert.equal(s.selectManeuver('above'),true);assert.equal(s.planReady(),true);
  s.running=true;s.commitOrders();assert.equal(s.selectManeuver('below'),false);assert.equal(s.turn.maneuver,'above');
});

test('skipping a maneuver preserves later attacks and turn resources, including while paused',()=>{
  const s=setup('port');s.turn.maneuvers[1]='direct';s.turn.maneuverStatus[1]='pending';
  s.turn.orders[0].status='hit';s.turn.orders[1].maneuvers=[0];s.turn.orders[2].maneuvers=[0,1];
  const deadline=s.turn.executionDeadline,ammo=s.player.torpedoes,energy=s.player.capacitor;
  s.running=false;assert(s.skipManeuver());
  assert.equal(s.running,false);assert.equal(s.turn.stageIndex,1);assert.equal(s.turn.maneuver,'direct');
  assert.equal(s.turn.orders[0].status,'hit');assert.equal(s.turn.orders[1].status,'skipped');assert.equal(s.turn.orders[2].status,'pending');
  assert.equal(s.turn.maneuverStatus[0],'skipped');assert.equal(s.turn.executionDeadline,deadline);
  assert.equal(s.player.torpedoes,ammo);assert.equal(s.player.capacitor,energy);
  assert(s.skipManeuver());assert.equal(s.turn.phase,'review');assert.equal(s.skipManeuver(),false);
});

test('rear attack tracks Yorktown stern and holds fire until Enterprise gets behind',()=>{
  const s=setup('behind'),e=s.enemy,p=s.player;
  assert.equal(s.status('phaser'),'POSITIONING BEHIND YORKTOWN');
  for(const heading of [0,90,180,270]){
    e.heading=heading;s.autoHelm(.05);const d=B.direction(e),waypoint=s.turn.navigation.waypoint;
    assert((waypoint.x-e.x)*d.x+(waypoint.y-e.y)*d.y+(waypoint.z-e.z)*d.z<0);
  }
  e.heading=180;e.pitch=0;e.integrity.weapons=0;e.repairBudget=0;
  Object.assign(p,{x:e.x,y:e.y,z:e.z-600,heading:180,pitch:0,turnRate:0});
  s.autoHelm(.05);assert.equal(s.turn.navigation.stage,'attack');assert.equal(s.status('phaser'),'READY');
  assert(s.fire('phaser'));assert.equal(s.shots,1);
  p.z=e.z+600;assert.equal(s.status('phaser'),'MANEUVER COMPLETE');assert.equal(s.fire('phaser'),false);
});
test('automatic helm ignores manual inputs and produces distinct port, starboard, climb and dive paths',()=>{
  const route=key=>{const s=setup(key);advance(s,4);return s;},direct=route('direct'),port=route('port'),starboard=route('starboard'),above=route('above'),below=route('below');
  assert(port.player.x<direct.player.x-30);assert(starboard.player.x>direct.player.x+30);assert(above.player.y>direct.player.y+60);assert(below.player.y<direct.player.y-60);
  const a=setup(),b=setup();advance(a,4);advance(b,4,{left:true,up:true});
  assert.deepEqual(b.player,a.player);
});
test('hide establishes actual K7 occlusion, holds weapons, then starts an assault',()=>{
  const s=setup('hide'),p=s.player;Object.assign(p,s.turn.navigation.waypoint);
  assert(s.stationTrace(s.enemy,p));assert.equal(s.status('phaser'),'K7 COVER MANEUVER');
  s.tick(.05);assert.equal(s.turn.navigation.stage,'hiding');assert.equal(s.shots,0);
  advance(s,6.2);assert.equal(s.turn.navigation.stage,'attack');
});

test('Direct Assault keeps its forward run during predictive avoidance until past Yorktown',()=>{
  const s=setup('direct'),p=s.player,e=s.enemy,n=s.turn.navigation;
  Object.assign(p,{x:6000,y:0,z:600,heading:0,pitch:0,speed:100});Object.assign(e,{x:6000,y:0,z:0,heading:180,pitch:0,speed:100});
  s.turn.orders[0].firedStage=0;s.turn.orders[0].status='hit';let aim;s.steerFlight=(ship,point)=>{aim=point;};
  s.autoHelm(.05);assert(p.collisionAvoidance.assaultPass);assert(aim.z<p.z-1000,'the passing adjustment continues forward');
  const d={...n.flyPast.direction};assert(Math.abs((aim.x-p.x)*d.z-(aim.z-p.z)*d.x)<1e-7,'avoidance holds the strafing line');assert.equal(aim.y,p.y);
  p.x=e.x+260;p.z=300;n.flyPast.elapsed=2;s.autoHelm(.05);assert(!n.flyPastComplete);assert(aim.z<p.z,'do not turn away while still approaching');
  Object.assign(p,{x:e.x+d.x*520,y:e.y+d.y*520,z:e.z+d.z*520});s.autoHelm(.05);assert(n.flyPastComplete);assert.equal(p.collisionAvoidance,null);assert.equal(aim,e,'come about only after clearing the enemy');
});

test('Direct Assault flies a straight offset strafing pass before coming about',()=>{
  const s=setup('direct'),p=s.player,e=s.enemy,n=s.turn.navigation;
  Object.assign(p,{x:6000,y:0,z:1400,heading:0,pitch:0,speed:140});Object.assign(e,{x:6000,y:0,z:0,speed:0});
  s.turn.orders[0].status='hit';s.turn.orders[0].firedStage=0;
  let closest=Infinity,crossed=false,line;
  for(let i=0;i<500&&!n.flyPastComplete;i++){
    s.autoHelm(.05);
    if(n.flyPast){assert(n.flyPast.strafe);line??={...n.flyPast.direction};assert.deepEqual(n.flyPast.direction,line,'hold the established run direction');}
    const v=s.moveFlightVelocity(p,.05);p.x+=v.x*.05;p.y+=v.y*.05;p.z+=v.z*.05;s.time+=.05;
    closest=Math.min(closest,B.distance(p,e));if(p.z<e.z)crossed=true;
    assert.equal(B.shipContact(p,e),null,'the closer strafing run still clears both hulls');
    if(p.z>e.z)assert(!n.flyPastComplete,'do not come about before passing the target');
  }
  assert(crossed);assert(n.flyPastComplete);assert(closest>160,`the strafing line clears the enemy hull (${closest})`);
  assert(closest<240,'the pass runs closer to the enemy center than the previous wide offset');
  assert(s.events.some(event=>event.type==='come-about'));
  Object.assign(p,{x:6000,y:0,z:-1200,heading:180,pitch:0,turnRate:0});p.collisionAvoidance=null;
  s.autoHelm(.05);assert(n.flyPast?.strafe,'line up another run after coming around');
});

test('Direct Assault retains emergency avoidance when the hulls are already dangerously close',()=>{
  const s=setup('direct'),p=s.player,e=s.enemy;
  Object.assign(p,{x:6000,y:0,z:100,heading:0,pitch:0,speed:100});Object.assign(e,{x:6000,y:0,z:0,heading:180,pitch:0,speed:100});
  s.avoidShipCollision(p,e,e);assert(p.collisionAvoidance);assert(!p.collisionAvoidance.assaultPass);
});

test('Direct Assault comes about on the shortest side after clearing the enemy',()=>{
  for(const side of [-1,1]){
    const s=setup('direct'),p=s.player,e=s.enemy,n=s.turn.navigation;
    Object.assign(p,{x:6000,y:0,z:-240,heading:side>0?10:350,pitch:0,turnRate:0,yawAcceleration:0,speed:15,sweepTurnSide:-side});
    Object.assign(e,{x:6000,y:0,z:0,speed:0});
    n.flyPast={direction:{x:0,y:0,z:-1},elapsed:1.2};
    s.autoHelm(.05);
    assert.equal(n.flyPastComplete,true);assert.equal(n.flyPast,null);
    assert.equal(Math.sign(p.turnRate),side,'the shorter return turn wins over a previous sweep');
    assert.equal(p.sweepTurnSide,0);assert.equal(p.speedIntent,'TURNING FOR ATTACK');
    assert(s.events.some(event=>event.type==='come-about'&&event.maneuver==='direct'));
  }
});

test('direct assaults and attacks from above and below fly past before re-engaging Yorktown',()=>{
  for(const route of ['direct','above','below']){
    const s=setup(route),p=s.player,e=s.enemy,n=s.turn.navigation,side=route==='above'?1:route==='below'?-1:0;
    Object.assign(p,{x:6000,y:side*400,z:600,heading:0,pitch:-side*30});Object.assign(e,{x:6000,y:0,z:0});n.stage='attack';
    s.turn.orders[0].firedStage=s.turn.stageIndex;s.turn.orders[0].status='hit';
    let aim;s.steerFlight=(ship,point)=>{aim=point;};
    s.autoHelm(.05);const d={...n.flyPast.direction};
    if(side)assert(d.y*side<0,'the attack crosses the enemy altitude');else assert.equal(d.y,0,'a level direct assault holds its attack altitude');
    Object.assign(p,{x:e.x+d.x*200,y:e.y+d.y*200,z:e.z+d.z*200});
    for(let i=0;i<25;i++){s.autoHelm(.05);assert(n.flyPast);assert((aim.z-p.z)*d.z>0,'hold the outbound direction until clear');}
    const clearance=route==='direct'?520:240;
    Object.assign(p,{x:e.x+d.x*clearance,y:e.y+d.y*clearance,z:e.z+d.z*clearance});s.autoHelm(.05);
    assert.equal(n.flyPastComplete,true);assert.equal(aim.x,e.x);assert.equal(aim.z,e.z,'turn back toward Yorktown after flying clear');
    assert((aim.y-p.y)*side>=0,'the return aims toward the enemy altitude or stays level for a small thruster adjustment');
    assert.equal(s.events.filter(event=>event.type==='come-about').length,1);
    s.autoHelm(.05);assert.equal(s.events.filter(event=>event.type==='come-about').length,1,'the captain receives one turn-back cue per attack pass');
  }
});

test('cover destinations use solid K7 geometry across enemy bearings and elevations',()=>{
  const s=setup('hide'),k=s.station;
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12;Object.assign(s.enemy,{x:k.x+Math.sin(a)*1800,y:k.y+(i%3-1)*400,z:k.z+Math.cos(a)*1800});
    const point=s.coverPosition();
    assert(s.stationTrace(s.enemy,point),'solid station geometry screens the destination');
    assert.equal(s.stationTrace(point,point,90),null,'the destination leaves room for Enterprise');
  }
});

test('above and below attacks translate vertically for small altitude changes while the hull stays level',()=>{
  for(const route of ['above','below']){
    const s=setup(route),p=s.player,e=s.enemy,side=route==='above'?1:-1;
    Object.assign(p,{x:6000,y:0,z:1000,heading:0,pitch:0,pitchRate:0,speed:100});
    Object.assign(e,{x:6000,y:side*100,z:-1000,heading:0});s.turn.navigation.stage='attack';
    s.fire=()=>false;
    for(let i=0;i<20;i++)s.tick(.05);
    assert(p.y*side>5,'vertical thrusters change altitude independently of forward pitch');
    assert(Math.abs(p.pitch)<1e-8,'small height changes do not require pitching the hull');
    assert(p.verticalThrust*side>0);assert(Math.abs(p.verticalThrust)<=45*s.flightMobility(p)+1e-8);
    const y=p.y;s.stopEnterprise();s.tick(.05);assert.equal(p.y,y,'All Stop also stops vertical translation');
  }
});

test('seeking K7 cover does not abandon the maneuver after five seconds',()=>{
  const s=setup('hide');s.turn.navigation.elapsed=6;s.autoHelm(.05);
  assert.equal(s.turn.navigation.stage,'position');assert.equal(s.status('phaser'),'K7 COVER MANEUVER');
  assert(!s.events.some(event=>event.text?.includes('Cover route timed out')));
});

test('the cover approach flies around K7 and reaches actual occlusion within its turn',()=>{
  const s=setup('hide'),p=s.player;
  Object.assign(p,{x:-430,y:86,z:-1200,heading:0,pitch:0,turnRate:0,pitchRate:0,speed:B.MIN_IMPULSE_SPEED});
  Object.assign(s.enemy,{x:-430,y:86,z:-2300,speed:0});s.initNavigation();s.fire=()=>false;s.events=[];
  assert(s.turn.navigation.coverPath.length>1,'an obstructed approach gets a route around the station');
  let previous=p;
  for(const point of s.turn.navigation.coverPath){assert.equal(s.stationTrace(previous,point,90),null);previous=point;}
  for(let i=0;i<600&&s.turn.navigation.stage==='position'&&s.turn.phase!=='review';i++){
    s.autoHelm(.05);const d=B.direction(p),before={...p};
    for(const axis of ['x','y','z'])p[axis]+=d[axis]*p.speed*.05;
    s.moveAroundStation(p,before);s.time+=.05;s.advanceTurn(.05);
  }
  assert.equal(s.turn.navigation.stage,'hiding');assert(s.time>5&&s.time<30);
  assert(s.stationTrace(s.enemy,p));assert.equal(s.stationTrace(p,p,45),null);
  assert(!s.events.some(event=>event.type==='station-collision'),'the cover route avoids impact');
  assert(s.events.some(event=>event.text==='K7 cover established. Holding six seconds before the assault.'));
});
test('flee needs no shots, permits enemy attacks, and repairs use finite parts before power is restored',()=>{
  const s=new B.Simulation();s.running=true;s.selectManeuver('flee');assert(s.planReady());
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0,hull:50});Object.assign(s.enemy,{x:2000,y:0,z:-900,heading:180});
  const power={...s.player.power};assert(s.commitOrders());assert.equal(s.turn.phase,'withdraw');assert.equal(s.turn.orders.length,3);
  s.tick(.05);assert.equal(s.turn.spent.enemy.phaser,1);assert.equal(s.shots,0);
  s.enemy.integrity.weapons=0;s.projectiles=[];s.player.lastHit=-100;const parts=s.player.repairBudget;
  advance(s,91);assert.equal(s.turn.phase,'review');assert(s.player.hull>50);assert(s.player.repairBudget<parts);assert(s.player.repairBudget>=0);assert.deepEqual(s.player.power,power);
  assert.equal(s.player.torpedoes,24);
});
test('all flight plans resolve a pass without manual steering and leave ships clear of K7',()=>{
  for(const key of Object.keys(B.maneuvers)){
    const s=setup(key);for(let i=0;i<5000&&s.turn.phase!=='review'&&!s.result;i++)s.tick(.1);
    assert(s.result||s.turn.phase==='review',key);assert.equal(s.stationTrace(s.player,s.player,44),null,key);assert(Number.isFinite(s.player.heading)&&Number.isFinite(s.player.pitch),key);
  }
});

test('two different maneuvers execute in order under one pass with a single final review',()=>{
  const s=new B.Simulation();s.running=true;s.enemy.integrity.weapons=0;
  const routes=['port','above'];routes.forEach((key,i)=>s.selectManeuver(key,i));
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:[1100,800,600][i]}));
  assert(s.commitOrders());const baseline=s.turn.baseline,visited=new Set();let reviews=0,previous=s.turn.phase;
  for(let i=0;i<5000&&s.turn.phase!=='review'&&!s.result;i++){
    visited.add(s.turn.stageIndex);s.tick(.1);assert.equal(s.turn.number,1);assert.equal(s.turn.baseline,baseline);
    if(s.turn.phase==='review'&&previous!=='review')reviews++;previous=s.turn.phase;
  }
  assert.deepEqual([...visited],[0,1]);assert.deepEqual(s.turn.stageHistory,routes);assert.equal(s.turn.phase,'review');assert.equal(reviews,1);
  assert(s.shots<=3);assert(s.player.torpedoes>=23);
});

test('a repair maneuver restores normal power before the second maneuver',()=>{
  const s=new B.Simulation();s.running=true;s.enemy.integrity.weapons=0;s.player.hull=40;
  ['flee','above'].forEach((key,i)=>s.selectManeuver(key,i));
  s.updateStep(0,{weapon:'phaser',target:'hull',range:1500,maneuvers:[1]});s.updateStep(1,{weapon:'phaser',target:'hull',range:1500,maneuvers:[1]});s.updateStep(2,{weapon:'torpedo',target:'hull',range:1500,maneuvers:[1]});
  const power={...s.player.power},hull=s.player.hull;assert(s.commitOrders());
  assert.equal(s.turn.phase,'withdraw');assert.notDeepEqual(s.player.power,power);
  for(let i=0;i<400&&s.turn.stageIndex<1;i++)s.tick(.1);
  assert.equal(s.turn.stageIndex,1);assert.equal(s.turn.number,1);assert.equal(s.turn.maneuverStatus[0],'repaired');assert(s.player.hull>hull);assert.deepEqual(s.player.power,power);
});

 test('keep your distance retreats when crowded and returns to a firing solution at range',()=>{
  const s=setup('distance'),p=s.player,e=s.enemy;
  Object.assign(p,{x:5000,y:0,z:0,heading:0,pitch:0});Object.assign(e,{x:5000,y:0,z:-400,speed:0});
  let aim;s.steerFlight=(ship,target)=>{aim=target;};
  s.autoHelm(.05);assert.equal(s.turn.navigation.openingRange,true);assert(aim.z>p.z);assert.match(p.speedIntent,/ESCAPE RANGE|TURNING FOR WITHDRAWAL/);
  e.z=-1200;s.autoHelm(.05);assert.equal(s.turn.navigation.openingRange,false);assert.equal(aim,e);assert.match(p.speedIntent,/KEEPING DISTANCE/);
  e.z=-1050;assert.equal(s.status('phaser'),'READY');assert(s.fire('phaser'));
 });
 test('keep your distance aims for the selected range instead of closing to optimal damage range',()=>{
  const s=setup('distance'),p=s.player,e=s.enemy;
  Object.assign(p,{x:5000,y:0,z:0,heading:0,pitch:0});Object.assign(e,{x:5000,y:0,z:-1300,speed:0});
  const order={weapon:'phaser',range:1400},normal=s.desiredFlightSpeed(p,e,e,{order}),distant=s.desiredFlightSpeed(p,e,e,{mode:'distance',order});
  assert(distant.speed<normal.speed);assert.match(distant.reason,/KEEPING DISTANCE/);
 });
