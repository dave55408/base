const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

test('the adaptive captain uses a full legal weapon budget and varies equivalent optimal firing ranges',()=>{
  const sim=new B.Simulation(9281),seen=new Set(),before=JSON.stringify([sim.player,sim.enemy]);let attacks=0,flee=0;
  for(let i=0;i<250;i++){
    assert.equal(sim.randomizePlan(),true);assert.equal(sim.planReady(),true);
    const t=sim.turn;seen.add(JSON.stringify(t.draft));
    if(t.draftManeuver==='flee'){
      flee++;assert.deepEqual(t.draftManeuvers,['flee',null,null]);assert.deepEqual(t.draft,[null,null,null]);
    }else{
      attacks++;assert.equal(t.draftManeuvers.length,3);assert(t.draftManeuvers.filter(Boolean).every(key=>B.maneuvers[key]&&key!=='flee'));
      assert.equal(t.draft.filter(shot=>shot.weapon==='phaser').length,2);assert.equal(t.draft.filter(shot=>shot.weapon==='torpedo').length,1);
      t.draft.forEach(shot=>{assert(sim.validStep(shot));assert(shot.maneuvers.every(index=>!!t.draftManeuvers[index]));assert.equal(shot.range%50,0);});
    }
  }
  assert(attacks>100);assert.equal(flee,0,'a healthy ship does not retreat at random');assert(seen.size>1);assert.equal(JSON.stringify([sim.player,sim.enemy]),before,'generating a plan spends no ammunition and changes no ship state');
});

test('random turns commit in planning and review, and cannot replace a live turn or run after combat',()=>{
  const sim=new B.Simulation(318);sim.random=()=>.999;sim.player.hull=20;
  assert(sim.randomizePlan());sim.running=true;assert(sim.commitOrders());assert.equal(sim.turn.phase,'withdraw');assert(sim.turn.orders.every(order=>order.status==='unused'));
  const before=JSON.stringify(sim.turn);assert.equal(sim.randomizePlan(),false);assert.equal(JSON.stringify(sim.turn),before);
  sim.finishPass();sim.player.hull=100;sim.random=()=>.2;assert(sim.randomizePlan());assert(sim.commitOrders());assert.equal(sim.turn.number,2);assert.equal(sim.turn.orders.length,3);
  sim.result='victory';assert.equal(sim.randomizePlan(),false);
  sim.reset();sim.startFreeFlight();assert.equal(sim.randomizePlan(),false);
  sim.reset();sim.turnBased=false;assert.equal(sim.randomizePlan(),false);
});
