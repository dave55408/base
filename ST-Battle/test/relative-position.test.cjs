const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function setup(route='direct',assigned=[0,1]){
  const s=new B.Simulation();s.running=true;s.selectManeuver(route,0);s.selectManeuver('above',1);
  for(const [i,weapon] of ['phaser','phaser','torpedo'].entries())assert(s.updateStep(i,{weapon,target:'hull',range:1000,maneuvers:assigned}));
  assert(s.commitOrders());s.fire=()=>false;return s;
}
function advance(s,seconds,move=()=>{}){
  for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.125){move();s.time+=.125;s.advanceTurn(.125);}
}
test('matching motion advances after more than three seconds in every maneuver, including Chase and Close battle',()=>{
  for(const route of Object.keys(B.maneuvers)){
    const s=setup(route==='flee'?'direct':route);if(route==='flee'){s.turn.maneuver='flee';s.turn.maneuvers[0]='flee';s.initNavigation();}
    const move=()=>{s.player.x+=10;s.enemy.x+=10;};
    advance(s,3,move);assert.equal(s.turn.stageIndex,0,route);
    advance(s,.125,move);assert.equal(s.turn.stageIndex,1,route);assert.equal(s.turn.navigation.relativeStillTime,0);
  }
});
test('small relative jitter is tolerated while a significant change on any axis resets the timer',()=>{
  for(const axis of ['x','y','z']){
    const s=setup();let direction=1;
    advance(s,2,()=>{s.player[axis]+=direction;direction*=-1;});assert.equal(s.turn.stageIndex,0);
    s.player[axis]+=30;advance(s,2);assert.equal(s.turn.stageIndex,0,axis);
    advance(s,1.25);assert.equal(s.turn.stageIndex,1,axis);
  }
});
test('unfired attacks remain available for later assigned maneuvers and orphaned attacks are skipped',()=>{
  const later=setup();advance(later,3.125);assert(later.turn.orders.every(order=>order.status==='pending'));
  const orphaned=setup('direct',[0]);advance(orphaned,3.125);assert(orphaned.turn.orders.every(order=>order.status==='skipped'));
});
test('an existing phaser burst finishes before advancing and paused simulation does not consume the timer',()=>{
  const s=setup();advance(s,2.5);s.turn.orders[0].status='hit';s.turn.orders[0].firedStage=0;s.turn.orders[0].firedAt=s.time;
  advance(s,.625);assert.equal(s.turn.stageIndex,0);advance(s,1);assert.equal(s.turn.stageIndex,1);
  const paused=setup();advance(paused,2);paused.running=false;for(let i=0;i<100;i++)paused.tick(.1);
  assert.equal(paused.turn.navigation.relativeStillTime,2);
});
test('holding relative position on the final maneuver ends it without waiting out enemy cleanup',()=>{
  const s=setup('chase',[0]);s.turn.maneuvers[1]=null;
  advance(s,3.125);assert.equal(s.turn.phase,'review');
});

test('aborted maneuvers emit one explicit event for stalled progress, timeout, and captain cancellation',()=>{
  const stalled=setup();advance(stalled,3.125);
  assert.equal(stalled.events.filter(e=>e.type==='action-aborted'&&e.reason==='no-relative-progress').length,1);
  assert.equal(stalled.events.find(e=>e.type==='action-aborted').nextStage,1);
  const timeout=setup();timeout.turn.assaultTiming={closing:0,started:true};timeout.turn.remaining=.01;advance(timeout,.125,()=>{timeout.player.x+=30;});
  assert.equal(timeout.events.filter(e=>e.type==='action-aborted'&&e.reason==='timeout').length,1);
  assert.equal(timeout.endPass(),true);assert.equal(timeout.endPass(),false);
  assert.equal(timeout.events.filter(e=>e.type==='action-aborted'&&e.reason==='captain-ended-pass').length,1);
  const completed=setup('ram');completed.turn.navigation.rammed=true;completed.advanceTurn(0);
  assert.equal(completed.events.filter(e=>e.type==='action-aborted').length,0,'a successful ram is not an abort');
});
