const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function committed(options={}){
  const s=new B.Simulation(97,{openingApproach:true,...options});s.running=true;
  assert(s.applyPlanPreset('strong'));assert(s.commitOrders());return s;
}
test('the mandatory opening closes range for 5 seconds with both plans and weapons held',()=>{
  const s=committed({randomStart:true}),initial=s.range,orders=JSON.stringify(s.turn.orders);
  assert.equal(s.turn.phase,'closing');assert.equal(s.turn.remaining,5);
  assert.equal(s.skipManeuver(),false);assert.equal(s.endPass(),false);assert.equal(s.warp(),false);
  assert.equal(s.fire('phaser',s.player,s.enemy,false),false);assert.equal(s.fire('torpedo',s.enemy,s.player,false),false);
  for(let i=0;i<49;i++)s.tick(.1,{stop:true,more:true,right:true});
  assert.equal(s.turn.phase,'closing');assert(s.range<initial-300,'both ships close toward each other');
  assert.equal(s.turn.stageIndex,-1);assert.equal(JSON.stringify(s.turn.orders),orders);
  assert.deepEqual(s.turn.maneuverStatus,['pending','pending']);assert.equal(s.projectiles.length,0);
  assert.equal(s.player.hull,100);assert.equal(s.enemy.hull,100);
  s.running=false;const time=s.time,remaining=s.turn.remaining;s.tick(.1);assert.equal(s.time,time);assert.equal(s.turn.remaining,remaining);
  s.running=true;s.tick(.1);
  assert(Math.abs(s.time-5)<1e-7);assert.equal(s.turn.stageIndex,0);assert.equal(s.turn.phase,'approach');
  assert.equal(s.turn.maneuver,s.turn.maneuvers[0]);assert.equal(s.turn.remaining,15);
  assert(Math.abs(s.turn.executionDeadline-s.time-30)<1e-7,'the approach does not consume plan execution time');
  assert(s.replayRecording.record.frames.some(f=>f.phase==='closing'));
});
test('both ships smoothly close their elevation gap during the five-second approach',()=>{
  for(const options of [{randomStart:true},{}]){
    const s=committed(options),p=s.player,e=s.enemy,py=p.y,ey=e.y,initial=Math.abs(py-ey);
    assert(initial>=200);let previous=initial;
    for(let i=0;i<50;i++){
      const before=[p.y,e.y];s.tick(.1);const gap=Math.abs(p.y-e.y);
      assert(gap<=previous+1e-7,'the vertical separation decreases');
      assert(Math.abs(p.y-before[0])<5&&Math.abs(e.y-before[1])<5,'vertical translation stays smooth');previous=gap;
    }
    assert(Math.abs(p.y-py)>40&&Math.abs(e.y-ey)>40,'both ships move vertically');
    assert(Math.abs(p.y-e.y)<initial*.5);assert(Math.abs(Math.abs(p.y-e.y)-80)<1e-6);
    assert.equal(s.turn.phase,'approach');assert.equal(p.verticalThrust,0);assert.equal(e.verticalThrust,0);
    assert.equal(s.player.hull,100);assert.equal(s.enemy.hull,100);
  }
});

test('the opening occurs once per battle and resets for a new engagement',()=>{
  const s=committed();for(let i=0;i<50;i++)s.tick(.1);
  assert(s.endPass());assert(s.commitOrders());assert.equal(s.turn.number,2);assert.notEqual(s.turn.phase,'closing');
  s.reset();s.running=true;s.applyPlanPreset('strong');assert(s.commitOrders());assert.equal(s.turn.phase,'closing');
});
test('Free Flight never runs the obligatory combat approach',()=>{
  const s=new B.Simulation(97,{randomStart:true});s.startFreeFlight();s.running=true;s.tick(.1);
  assert(s.freeFlight);assert.notEqual(s.turn.phase,'closing');
});

test('far-start battles hand off to working combat plans and finish the first turn',()=>{
  for(const seed of [12,37,73,97,318]){
    const s=new B.Simulation(seed,{randomStart:true});s.running=true;s.applyPlanPreset('strong');assert(s.commitOrders());
    for(let i=0;i<500&&s.turn.phase!=='review'&&!s.result;i++)s.tick(.1);
    assert.equal(s.turn.phase,'review');
    assert(s.turn.spent.player.phaser+s.turn.spent.player.torpedo+s.turn.spent.enemy.phaser+s.turn.spent.enemy.torpedo>0,'plans exchange fire after the opening');
    assert.equal(s.turn.executionDeadline,35,'five-second entrance followed by thirty seconds of plans');
    assert(s.time>=5&&s.time<=40,'review allows the final weapons effects to resolve');
  }
});
