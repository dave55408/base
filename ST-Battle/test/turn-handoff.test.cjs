const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(){
  const s=new B.Simulation(97);s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0});
  Object.assign(s.enemy,{x:6000,y:0,z:-900,heading:180,pitch:0});
  s.selectManeuver('direct',0);
  for(const [i,weapon] of ['phaser','phaser','torpedo'].entries())assert(s.updateStep(i,{weapon,target:'hull',range:1000,maneuvers:[0]}));
  assert(s.commitOrders());return s;
}
test('subsequent commits hold scheduled and manual fire for half a simulation second on both ships',()=>{
  const s=duel();assert(s.endPass());assert(s.commitOrders());
  s.turn.enemyOrders=s.turn.draft.map(order=>({...order,status:'pending'}));
  const committedAt=s.time;
  for(const elapsed of [0,.25,.499]){
    s.time=committedAt+elapsed;
    for(const [shooter,target] of [[s.player,s.enemy],[s.enemy,s.player]])for(const scheduled of [true,false]){
      assert.equal(s.status('phaser',shooter,target,scheduled),'COMMITTING ORDERS / WEAPONS HOLD');
      assert.equal(s.fire('phaser',shooter,target,scheduled),false);
    }
  }
  s.running=false;for(let i=0;i<20;i++)s.tick(.1);assert.equal(s.time,committedAt+.499);
  s.running=true;s.time=committedAt+.5;
  assert(s.fire('phaser'));assert(s.fire('phaser',s.enemy,s.player));
  assert(s.endPass());assert(s.commitOrders());
  assert.equal(s.turn.weaponsReadyAt,s.time+.5,'each later commit starts a fresh hold');
});
test('ships coast on their current course while the final torpedo resolves',()=>{
  const s=duel();
  for(const order of [...s.turn.orders,...s.turn.enemyOrders])order.status='skipped';
  s.turn.remaining=0;
  s.projectiles.push({id:'finishing',from:s.player.name,target:s.enemy.name,pos:{x:9000,y:9000,z:9000},life:0,maxLife:8,strength:1,targetSystem:'hull',heading:0,pitch:0});
  const heading=[s.player.heading,s.enemy.heading],pitch=[s.player.pitch,s.enemy.pitch];
  for(let i=0;i<10;i++)s.tick(.05);
  assert.notEqual(s.turn.phase,'review');
  assert.deepEqual([s.player.heading,s.enemy.heading],heading);
  assert.deepEqual([s.player.pitch,s.enemy.pitch],pitch);
  s.projectiles=[];const position=[s.player.x,s.player.z,s.enemy.x,s.enemy.z];s.tick(.05);
  assert.equal(s.turn.phase,'review');
  assert.deepEqual([s.player.x,s.player.z,s.enemy.x,s.enemy.z],position,'review begins without a final steering or movement frame');
});

test('review waits for Yorktown beams to finish without an exit turn or extra shots',()=>{
  const s=duel();
  for(const order of [...s.turn.orders,...s.turn.enemyOrders])order.status='skipped';
  Object.assign(s.turn.enemyOrders[0],{weapon:'phaser',status:'hit',firedAt:0});
  s.time=.4;s.turn.remaining=0;
  const heading=[s.player.heading,s.enemy.heading];
  s.tick(.1);assert.notEqual(s.turn.phase,'review');
  assert.equal(s.fire('phaser',s.player,s.enemy,false),false);
  for(let i=0;i<20&&s.turn.phase!=='review';i++)s.tick(.1);
  assert.equal(s.turn.phase,'review');assert(s.time>=B.PHASER_DURATION-1e-8);
  assert.deepEqual([s.player.heading,s.enemy.heading],heading);
});
