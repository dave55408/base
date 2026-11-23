const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
function duel(){
  const s=new B.Simulation();s.running=true;s.selectManeuver('direct');
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:0,z:-900,heading:180});
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:1000}));assert(s.commitOrders());return s;
}
test('changing a live maneuver preserves consumed shots, ammunition, phase time and damage baseline',()=>{
  const s=duel();assert(s.fire('phaser'));const order=s.turn.orders[0],baseline=s.turn.baseline;
  s.turn.remaining=24;const enemy=JSON.stringify(s.turn.enemyOrders);
  assert(s.applyRevisions(s.turn.draft,['behind','direct','direct']));
  assert.equal(s.turn.maneuver,'behind');assert.equal(s.turn.navigation.stage,'position');assert.equal(s.turn.orders[0],order);
  assert.equal(s.turn.orders[0].status,'hit');assert.equal(s.turn.spent.player.phaser,1);assert.equal(s.turn.remaining,24);assert.equal(s.turn.baseline,baseline);
  assert.equal(JSON.stringify(s.turn.enemyOrders),enemy);assert.equal(s.turn.revisions,1);
});
test('an edit to a completed maneuver rejects the entire transaction',()=>{
  const s=duel();s.turn.maneuverStatus[0]='complete';s.startStage(1);
  const plan=s.turn.draft.map(order=>({...order}));plan[1].target='reactor';const before=JSON.stringify(s.turn);
  assert.equal(s.canReviseManeuver(0),false);assert.equal(s.applyRevisions(plan,['above','direct','direct']),false);assert.equal(JSON.stringify(s.turn),before);
  assert(s.applyRevisions(s.turn.draft,['direct','direct','behind']));assert.equal(s.turn.maneuver,'direct');
});
test('changing a repair maneuver restores normal power and keeps the remaining time',()=>{
  const s=new B.Simulation();s.running=true;s.selectManeuver('flee');const power={...s.player.power};assert(s.commitOrders());s.turn.remaining=12;
  assert(s.applyRevisions(s.turn.draft,['behind','flee','flee']));assert.deepEqual(s.player.power,power);assert.equal(s.turn.remaining,12);
  assert.equal(s.turn.phase,'approach');assert(s.turn.orders.every(order=>order.status==='unused'));assert.equal(s.turn.spent.player.phaser,0);
});
