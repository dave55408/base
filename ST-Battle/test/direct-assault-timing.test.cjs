const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function setup(){
  const s=new B.Simulation(97,{openingApproach:false});s.running=true;s.applyPlanPreset('aggressive');
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0});Object.assign(s.enemy,{x:6000,y:0,z:-4000,heading:180,pitch:0});
  assert(s.commitOrders());s.fire=()=>false;return s;
}
function advance(s,dt=.1){s.time+=dt;s.player.x+=4;s.advanceTurn(dt);}

test('Direct Assault reserves its firing window while closing and preserves the following maneuver allocation',()=>{
  const s=setup(),duration=s.turn.stageDuration,deadline=s.turn.executionDeadline;
  for(let i=0;i<100;i++)advance(s);
  assert(Math.abs(s.turn.remaining-duration)<1e-7);assert(Math.abs(s.turn.assaultTiming.closing-10)<1e-7);
  assert(Math.abs(s.turn.executionDeadline-deadline-10)<1e-7);assert.equal(s.turn.assaultTiming.started,false);
  Object.assign(s.enemy,{x:s.player.x,y:s.player.y,z:s.player.z-650});advance(s);
  assert.equal(s.turn.assaultTiming.started,true);assert(Math.abs(s.turn.remaining-(duration-.1))<1e-7);
  // Moving out of range again must not restart or replenish the attack window.
  s.enemy.z=s.player.z-5000;const closing=s.turn.assaultTiming.closing;
  for(let i=0;i<151&&s.turn.stageIndex===0;i++)advance(s);
  assert.equal(s.turn.stageIndex,1);assert.equal(s.turn.maneuver,'flank');assert(s.turn.remaining>14.8&&s.turn.remaining<=15.01);
  assert(Math.abs(s.turn.executionDeadline-deadline-closing)<1e-7);
  assert(s.turn.orders.every(shot=>shot.status==='pending'),'shared unfired orders remain eligible for the flank');
});

test('Direct Assault closing allowance is bounded and cannot prevent a later maneuver',()=>{
  const s=setup();
  for(let i=0;i<610&&s.turn.stageIndex===0;i++)advance(s);
  assert.equal(s.turn.stageIndex,1);assert(s.time<46);assert(s.turn.remaining>14.8);
  assert(Math.abs(s.turn.executionDeadline-(B.TURN.execution+B.TURN.directApproach))<1e-6);
});

test('pausing freezes Direct Assault closing, and an already-fired attack starts its window immediately',()=>{
  const s=setup();advance(s);s.running=false;
  const before=JSON.stringify([s.turn.assaultTiming,s.turn.remaining,s.turn.executionDeadline,s.time]);s.tick(.1);
  assert.equal(JSON.stringify([s.turn.assaultTiming,s.turn.remaining,s.turn.executionDeadline,s.time]),before);
  s.running=true;s.turn.orders[0].firedStage=0;s.turn.orders[0].status='hit';
  const remaining=s.turn.remaining,deadline=s.turn.executionDeadline;advance(s);
  assert.equal(s.turn.assaultTiming.started,true);assert(Math.abs(s.turn.remaining-remaining+.1)<1e-7);assert.equal(s.turn.executionDeadline,deadline);
});

test('a far-start Aggressive opening gives Direct Assault a full window after reaching firing range',()=>{
  const s=new B.Simulation(97,{randomStart:true});s.running=true;s.applyPlanPreset('aggressive');assert(s.commitOrders());
  let started=null,firstShot=null;
  for(let i=0;i<1600&&!s.result&&s.turn.stageIndex<1;i++){
    s.tick(.05);
    if(s.turn.assaultTiming?.started&&started===null)started={time:s.time,remaining:s.turn.remaining};
    if(s.shots&&firstShot===null)firstShot=s.time;
  }
  assert(started);assert(started.remaining>=14.9,'closing leaves the full fifteen-second strafing window');
  assert(firstShot!==null);assert(s.turn.orders.filter(shot=>shot.firedStage===0).length>=2);
  assert(s.turn.assaultTiming===null||s.turn.assaultTiming.started);
});
