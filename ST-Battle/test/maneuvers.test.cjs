const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
const advance=(s,n,keys={})=>{for(let i=0;i<Math.ceil(n/.05);i++)s.tick(.05,keys);};
function setup(key='direct'){
  const s=new B.Simulation();s.running=true;
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:150,z:-1800,heading:180});
  assert(s.selectManeuver(key));if(key!=='flee')['phaser','phaser','torpedo'].forEach((weapon,i)=>assert(s.updateStep(i,{weapon,target:'hull',range:[1100,800,600][i]})));
  assert(s.commitOrders());return s;
}
test('all twelve maneuvers require selection and a committed maneuver stays locked',()=>{
  assert.equal(Object.keys(B.maneuvers).length,12);const s=new B.Simulation();
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:800}));
  assert.equal(s.planReady(),false);assert.equal(s.selectManeuver('unknown'),false);assert.equal(s.selectManeuver('above'),true);assert.equal(s.planReady(),true);
  s.running=true;s.commitOrders();assert.equal(s.selectManeuver('below'),false);assert.equal(s.turn.maneuver,'above');
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

test('three different maneuvers execute in order under one pass with a single final review',()=>{
  const s=new B.Simulation();s.running=true;s.enemy.integrity.weapons=0;
  const routes=['port','above','direct'];routes.forEach((key,i)=>s.selectManeuver(key,i));
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:[1100,800,600][i]}));
  assert(s.commitOrders());const baseline=s.turn.baseline,visited=new Set();let reviews=0,previous=s.turn.phase;
  for(let i=0;i<5000&&s.turn.phase!=='review'&&!s.result;i++){
    visited.add(s.turn.stageIndex);s.tick(.1);assert.equal(s.turn.number,1);assert.equal(s.turn.baseline,baseline);
    if(s.turn.phase==='review'&&previous!=='review')reviews++;previous=s.turn.phase;
  }
  assert.deepEqual([...visited],[0,1,2]);assert.deepEqual(s.turn.stageHistory,routes);assert.equal(s.turn.phase,'review');assert.equal(reviews,1);
  assert(s.shots<=3);assert(s.player.torpedoes>=23);
});

test('a repair maneuver between attacks returns normal power before the third maneuver',()=>{
  const s=new B.Simulation();s.running=true;s.enemy.integrity.weapons=0;s.player.hull=40;
  ['direct','flee','above'].forEach((key,i)=>s.selectManeuver(key,i));
  s.updateStep(0,{weapon:'phaser',target:'hull',range:1500});s.updateStep(1,{weapon:'phaser',target:'hull',range:1500,maneuvers:[2]});s.updateStep(2,{weapon:'torpedo',target:'hull',range:1500});
  const power={...s.player.power};assert(s.commitOrders());
  for(let i=0;i<1600&&s.turn.stageIndex<1;i++)s.tick(.1);
  assert.equal(s.turn.stageIndex,1);assert.equal(s.turn.phase,'withdraw');assert.notDeepEqual(s.player.power,power);const hull=s.player.hull;
  for(let i=0;i<320&&s.turn.stageIndex<2;i++)s.tick(.1);
  assert.equal(s.turn.stageIndex,2);assert.equal(s.turn.number,1);assert.equal(s.turn.maneuverStatus[1],'repaired');assert(s.player.hull>hull);assert.deepEqual(s.player.power,power);
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
