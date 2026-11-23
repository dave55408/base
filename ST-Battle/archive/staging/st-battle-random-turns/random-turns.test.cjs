const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

test('random attack turns always configure three maneuvers, two phasers and one torpedo with legal randomized settings',()=>{
  const sim=new B.Simulation(9281),seen=new Set(),before=JSON.stringify([sim.player,sim.enemy]);let attacks=0,flee=0;
  for(let i=0;i<250;i++){
    assert.equal(sim.randomizePlan(),true);assert.equal(sim.planReady(),true);
    const t=sim.turn;seen.add(JSON.stringify(t.draft));
    if(t.draftManeuver==='flee'){
      flee++;assert.deepEqual(t.draftManeuvers,['flee',null,null]);assert.deepEqual(t.draft,[null,null,null]);
    }else{
      attacks++;assert.equal(t.draftManeuvers.length,3);assert(t.draftManeuvers.every(key=>B.maneuvers[key]&&key!=='flee'));
      assert.equal(t.draft.filter(shot=>shot.weapon==='phaser').length,2);assert.equal(t.draft.filter(shot=>shot.weapon==='torpedo').length,1);
      t.draft.forEach((shot,index)=>{assert(sim.validStep(shot));assert.deepEqual(shot.maneuvers,[index]);assert.equal(shot.range%50,0);});
    }
  }
  assert(attacks>100);assert(flee>0);assert(seen.size>100);assert.equal(JSON.stringify([sim.player,sim.enemy]),before,'generating a plan spends no ammunition and changes no ship state');
});

test('random turns commit in planning and review, and cannot replace a live turn or run after combat',()=>{
  const sim=new B.Simulation(318);sim.random=()=>.999;
  assert(sim.randomizePlan());sim.running=true;assert(sim.commitOrders());assert.equal(sim.turn.phase,'withdraw');assert(sim.turn.orders.every(order=>order.status==='unused'));
  const before=JSON.stringify(sim.turn);assert.equal(sim.randomizePlan(),false);assert.equal(JSON.stringify(sim.turn),before);
  sim.finishPass();sim.random=()=>.2;assert(sim.randomizePlan());assert(sim.commitOrders());assert.equal(sim.turn.number,2);assert.equal(sim.turn.orders.length,3);
  sim.result='victory';assert.equal(sim.randomizePlan(),false);
  sim.reset();sim.startFreeFlight();assert.equal(sim.randomizePlan(),false);
  sim.reset();sim.turnBased=false;assert.equal(sim.randomizePlan(),false);
});
