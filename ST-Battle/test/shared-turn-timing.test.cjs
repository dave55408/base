const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function plan(count,route='direct'){
  const sim=new B.Simulation(97);sim.running=true;for(let i=0;i<count;i++)sim.selectManeuver(route,i);
  if(route!=='flee')for(let i=0;i<3;i++)sim.updateStep(i,{weapon:i===2?'torpedo':'phaser',target:'hull',range:1000,maneuvers:Array.from({length:count},(_,j)=>j)});
  assert(sim.commitOrders());sim.fire=()=>false;return sim;
}

test('one, two and three maneuvers execute within the same shared turn window',()=>{
  const durations=[];
  for(const count of [1,2,3]){
    const sim=plan(count),starts=[{at:sim.time,remaining:sim.turn.remaining}],visited=new Set([0]);assert.equal(sim.turn.remaining,B.TURN.execution/count);
    for(let i=0;i<1000&&sim.turn.phase!=='review';i++){
      sim.time+=.05;sim.player.x+=2;sim.advanceTurn(.05);
      if(!visited.has(sim.turn.stageIndex)){visited.add(sim.turn.stageIndex);starts.push({at:sim.time,remaining:sim.turn.remaining});}
    }
    assert.equal(sim.turn.phase,'review');assert.equal(visited.size,count);assert.equal(sim.turn.stageHistory.length,count);
    assert(starts.every(stage=>Math.abs(stage.remaining-B.TURN.execution/count)<.11),'each maneuver receives its share of the common budget');durations.push(sim.time);
  }
  assert(Math.max(...durations)-Math.min(...durations)<.2,'maneuver count does not multiply turn duration');
});

test('repair maneuvers share the same execution budget instead of adding thirty seconds each',()=>{
  for(const count of [1,2,3]){const sim=plan(count,'flee');assert.equal(sim.turn.remaining,B.TURN.execution/count);assert.equal(sim.turn.executionDeadline,B.TURN.execution);}
});

test('finishing scheduled attacks early does not prematurely end a normally progressing maneuver',()=>{
  const sim=plan(1);for(const order of sim.turn.orders){order.status='hit';order.firedAt=0;order.firedStage=0;}
  for(let i=0;i<100;i++){sim.time+=.05;sim.player.x+=2;sim.advanceTurn(.05);}
  assert(['approach','attack'].includes(sim.turn.phase));assert(sim.turn.remaining>24);assert.equal(sim.turn.stageIndex,0);
});
