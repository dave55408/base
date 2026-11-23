const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

function setup(route='direct',assignments=[0,1]){
  const s=new B.Simulation();s.running=true;
  s.selectManeuver(route,0);s.selectManeuver('above',1);
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:800,maneuvers:assignments}));
  assert(s.commitOrders());s.fire=()=>false;
  return s;
}
function advance(s,seconds,move=()=>{}){
  for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.125){
    move();s.time+=.125;s.advanceTurn(.125);
  }
}

test('matching velocity advances only after four seconds and retains later assigned attacks',()=>{
  const s=setup();
  const move=()=>{s.player.x+=10;s.enemy.x+=10;};
  advance(s,4,move);assert.equal(s.turn.stageIndex,0);
  advance(s,.125,move);assert.equal(s.turn.stageIndex,1);
  assert(s.turn.orders.every(order=>order.status==='pending'));
  assert.equal(s.turn.navigation.relativeStillTime,0);
});

test('relative movement in any axis resets the four second interval',()=>{
  for(const axis of ['x','y','z']){
    const s=setup();advance(s,3);s.player[axis]+=6;
    advance(s,3);assert.equal(s.turn.stageIndex,0,axis);
    advance(s,1.25);assert.equal(s.turn.stageIndex,1,axis);
  }
});

test('changing bearing at constant range counts as relative movement',()=>{
  const s=setup();advance(s,3);
  const dx=s.player.x-s.enemy.x,dz=s.player.z-s.enemy.z;
  s.player.x=s.enemy.x-dz;s.player.z=s.enemy.z+dx;
  advance(s,3);assert.equal(s.turn.stageIndex,0);
});

test('chase and close battle remain active with a fixed relative position',()=>{
  for(const route of ['chase','close']){
    const s=setup(route);advance(s,6);assert.equal(s.turn.stageIndex,0,route);
  }
});

test('attacks assigned only to a stalled maneuver are skipped',()=>{
  const s=setup('direct',[0]);advance(s,4.125);
  assert.equal(s.turn.stageIndex,1);
  assert(s.turn.orders.every(order=>order.status==='skipped'));
});
