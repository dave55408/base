const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
function setup(routes=['direct',null],assigned=[[0],[0],[0]]){
  const s=new B.Simulation();s.running=true;
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:0,z:-900,heading:180});s.enemy.integrity.weapons=0;s.enemy.repairBudget=0;
  routes.forEach((key,i)=>{if(key)assert(s.selectManeuver(key,i));});
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>assert(s.updateStep(i,{weapon,target:'hull',range:1500,maneuvers:assigned[i]})));
  assert(s.commitOrders());return s;
}
function finish(s){for(let i=0;i<6000&&s.turn.phase!=='review'&&!s.result;i++)s.tick(.05);assert.equal(s.turn.phase,'review');}
test('all three attacks execute in one maneuver exactly once, without replaying that flight',()=>{
  const s=setup();finish(s);assert.deepEqual(s.turn.stageHistory,['direct']);assert.equal(s.shots,3);assert.equal(s.player.torpedoes,23);
  assert.deepEqual(s.turn.spent.player,{phaser:2,torpedo:1});assert(s.turn.orders.every(order=>order.firedStage===0));assert.equal(s.turn.number,1);
});
test('an attack eligible in several maneuvers is consumed only once across the entire pass',()=>{
  const s=setup(['direct','above'],[[0,1],[0,1],[0,1]]);finish(s);
  assert.deepEqual(s.turn.stageHistory,['direct','above']);assert.equal(s.shots,3);assert(s.turn.orders.every(order=>order.firedStage===0));assert.equal(s.player.torpedoes,23);
});
test('unfired attacks can wait for a later checked maneuver instead of being consumed on timeout',()=>{
  const s=setup(['direct','direct'],[[0,1],[0,1],[0,1]]);s.player.integrity.sensors=0;s.turn.remaining=0;s.tick(.05);
  assert.equal(s.turn.stageIndex,1);assert(s.turn.orders.every(order=>order.status==='pending'));assert.equal(s.shots,0);
  s.player.integrity.sensors=100;finish(s);assert.equal(s.shots,3);assert(s.turn.orders.every(order=>order.firedStage===1));
});
test('deleting a maneuver preserves attacks but invalidates orphaned assignments until reassigned',()=>{
  const s=new B.Simulation();s.running=true;s.selectManeuver('direct');
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:1000}));assert(s.planReady());
  assert(s.deleteManeuver(1));assert.equal(s.turn.draft[1].weapon,'phaser');assert.deepEqual(s.turn.draft[1].maneuvers,[]);assert.equal(s.planReady(),false);
  for(const i of [1,2])assert(s.updateStep(i,{...s.turn.draft[i],maneuvers:[0]}));assert(s.planReady());
  assert(s.commitOrders());assert.equal(s.deleteManeuver(0),false);
});
test('a pass can use only slot M2, and attack assignments cannot refer to absent or repair maneuvers',()=>{
  const s=setup([null,'direct'],[[1],[1],[1]]);assert.equal(s.turn.stageIndex,1);finish(s);assert.deepEqual(s.turn.stageHistory,['direct']);assert.equal(s.shots,3);
  const invalid=new B.Simulation();invalid.selectManeuver('direct',0);invalid.selectManeuver('flee',1);
  assert.equal(invalid.updateStep(0,{weapon:'phaser',target:'hull',range:1000,maneuvers:[1]}),false);
  assert.equal(invalid.validStep({weapon:'phaser',target:'hull',range:1000,maneuvers:[]}),false);
  assert.equal(invalid.validStep({weapon:'phaser',target:'hull',range:1000,maneuvers:[0,0]}),false);
});
