const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function setup(route='direct',next=null){
  const s=new B.Simulation();s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0});Object.assign(s.enemy,{x:6000,y:0,z:-800,heading:180,pitch:0});
  s.selectManeuver(route,0);if(next)s.selectManeuver(next,1);
  if(route!=='flee')for(const [i,weapon] of ['phaser','phaser','torpedo'].entries())assert(s.updateStep(i,{weapon,target:'weapons',range:1000,maneuvers:next?[0,1]:[0]}));
  assert(s.commitOrders());return s;
}
function disrupt(s){s.damage(s.enemy,s.player,1,'phaser','weapons');s.time=1;s.damage(s.enemy,s.player,1,'phaser','weapons');}
test('a single maneuver shares its turn allocation across approach and firing',()=>{
  const s=setup();assert.equal(s.turn.remaining,B.TURN.execution);s.time=8;s.turn.remaining=4;
  assert(s.fire('phaser'));assert.equal(s.turn.phase,'attack');assert.equal(s.turn.remaining,4,'firing must not grant another twelve seconds');
  const repair=setup('flee');assert.equal(repair.turn.remaining,B.TURN.execution);
});
test('a timed-out offensive maneuver hands off promptly and retains eligible attacks',()=>{
  const s=setup('port','direct');s.fire=()=>false;s.time=12;s.turn.remaining=.05;s.advanceTurn(.1);
  assert.equal(s.turn.stageIndex,1);assert.equal(s.turn.remaining,B.TURN.execution-12);assert(s.turn.orders.every(order=>order.status==='pending'));
});
test('positioning cannot consume the entire short attack window',()=>{
  const s=setup('port');s.autoHelm(4.6);assert.equal(s.turn.navigation.stage,'attack');
});
test('two phasers on the same shield open a six-second torpedo opportunity',()=>{
  const s=setup();disrupt(s);const combo=s.enemy.phaserCombo;
  assert.equal(combo.hits,2);assert.equal(combo.until,s.time+6);assert.equal(combo.arc,B.facing(s.enemy,s.player));
  const event=s.events.find(event=>event.type==='shield-disrupted');assert(event);assert.equal(event.duration,6);
  s.damage(s.enemy,s.player,20,'torpedo','weapons',{component:'weapons'});
  assert(s.enemy.shields[combo.arc]>40,'a disrupted shield can leak even before it collapses');
  assert(s.enemy.hull<100);assert(s.events.filter(event=>event.type==='impact').at(-1).combo);
});
test('combo torpedoes inflict fifty percent more system damage without adding hull damage to a breached shield',()=>{
  const a=setup(),b=setup();disrupt(a);a.time=b.time=2;
  const arc=B.facing(a.enemy,a.player);a.enemy.shields[arc]=b.enemy.shields[arc]=0;
  a.enemy.hull=b.enemy.hull=100;a.enemy.integrity.weapons=b.enemy.integrity.weapons=100;
  for(const s of [a,b])s.damage(s.enemy,s.player,20,'torpedo','weapons',{component:'weapons'});
  assert(Math.abs((100-a.enemy.integrity.weapons)/(100-b.enemy.integrity.weapons)-1.5)<1e-8);
  assert.equal(a.enemy.hull,b.enemy.hull);assert.equal(a.enemy.phaserCombo.used,true);
  assert(Math.abs((100-a.enemy.reactor)/(100-b.enemy.reactor)-1.5)<1e-8);
});
test('the combo expires, requires the same shield, and cannot be consumed twice',()=>{
  const expired=setup();disrupt(expired);expired.time=expired.enemy.phaserCombo.until+.01;
  expired.damage(expired.enemy,expired.player,20,'torpedo','hull');assert.equal(expired.events.filter(e=>e.type==='impact').at(-1).combo,false);
  const wrong=setup();disrupt(wrong);wrong.player.x=wrong.enemy.x+800;wrong.player.z=wrong.enemy.z;
  wrong.damage(wrong.enemy,wrong.player,20,'torpedo','hull');assert.equal(wrong.events.filter(e=>e.type==='impact').at(-1).combo,false);
  const used=setup();disrupt(used);used.damage(used.enemy,used.player,20,'torpedo','hull');used.damage(used.enemy,used.player,20,'torpedo','hull');
  assert.equal(used.events.filter(e=>e.combo).length,1);
});
test('phasers on different shield sectors do not combine and new turns clear the opening',()=>{
  const s=setup();s.damage(s.enemy,s.player,1,'phaser','hull');s.player.x=s.enemy.x+800;s.player.z=s.enemy.z;
  s.damage(s.enemy,s.player,1,'phaser','hull');assert.equal(s.enemy.phaserCombo.hits,1);assert(!s.events.some(e=>e.type==='shield-disrupted'));
  const fresh=setup();disrupt(fresh);fresh.finishPass();assert(fresh.commitOrders());assert.equal(fresh.enemy.phaserCombo,null);assert.equal(fresh.player.phaserCombo,null);
});
test('Yorktown can execute the same combo and quick plans keep attacks eligible across short offensive maneuvers',()=>{
  const s=setup();s.damage(s.player,s.enemy,1,'phaser','weapons');s.damage(s.player,s.enemy,1,'phaser','weapons');
  assert.equal(s.player.phaserCombo.hits,2);s.damage(s.player,s.enemy,20,'torpedo','weapons',{component:'weapons'});
  assert(s.events.filter(e=>e.type==='impact').at(-1).combo);
  for(const style of ['timid','strong','aggressive','berserk']){
    const plan=new B.Simulation();assert(plan.applyPlanPreset(style));
    for(const order of plan.turn.draft){assert(order.maneuvers.length>=2);assert(order.maneuvers.every(i=>!['flee','ram'].includes(plan.turn.draftManeuvers[i])));}
  }
});
