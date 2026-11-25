const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');

test('motion QA selects every maneuver uniformly and builds a legal single-maneuver turn',()=>{
  const routes=Object.keys(B.maneuvers);
  for(const [i,route] of routes.entries()){
    const s=new B.Simulation(97);s.running=true;s.random=()=>(i+.5)/routes.length;
    assert(s.randomMotionPlan());assert.deepEqual(s.turn.draftManeuvers,[route,null]);assert(s.planReady());
    assert(s.commitOrders());assert.equal(s.turn.maneuver,route);assert.equal(s.captainEnabled,false);
    if(route==='flee')assert(s.turn.orders.every(order=>order.status==='unused'));
    else assert.equal(s.turn.orders.filter(order=>order.status==='pending').length,3);
  }
});

test('motion QA cannot replace active orders or run during Free Flight or after combat',()=>{
  const s=new B.Simulation(97);s.running=true;assert(s.randomMotionPlan());assert(s.commitOrders());
  const before=JSON.stringify(s.turn);assert.equal(s.randomMotionPlan(),false);assert.equal(JSON.stringify(s.turn),before);
  s.finishPass();s.result='victory';assert.equal(s.randomMotionPlan(),false);
  s.reset();s.startFreeFlight();assert.equal(s.randomMotionPlan(),false);
});
