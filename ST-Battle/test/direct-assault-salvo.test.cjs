const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(range=600){
  const s=new B.Simulation(97);s.running=true;s.applyPlanPreset('aggressive');
  Object.assign(s.player,{x:6000,y:0,z:range,heading:0,pitch:0,speed:100});
  Object.assign(s.enemy,{x:6000,y:0,z:0,heading:180,pitch:0,speed:0});s.enemy.integrity.weapons=0;
  assert(s.commitOrders());return s;
}

test('Direct Assault sometimes takes the opposite side and commits to that side through the run',()=>{
  const sides=new Set();
  for(const turn of [1,2,3]){
    const s=duel(1100);s.turn.number=turn;s.autoHelm(.05);
    const pass=s.turn.navigation.flyPast;assert(pass?.strafe);sides.add(pass.side);
    const side=pass.side,direction={...pass.direction};
    for(let i=0;i<20;i++)s.autoHelm(.05);
    assert.equal(s.turn.navigation.flyPast,pass);assert.equal(pass.side,side);
    assert.deepEqual(pass.direction,direction,'the crossing axis remains fixed during the committed pass');
  }
  assert.deepEqual([...sides].sort(),['port','starboard']);
});
test('Direct Assault keeps the second phaser ahead of an opportunistic torpedo and lands the shield combo',()=>{
  const s=duel();assert(s.fire('phaser'));const arc=B.facing(s.enemy,s.player),ammo=s.player.torpedoes;
  assert.equal(s.nextOrder(),s.turn.orders[1]);assert.equal(s.fire('torpedo'),false);assert.equal(s.player.torpedoes,ammo);
  s.time=1.7;s.player.cooldown.phaser=0;s.player.capacitor=100;assert(s.fire('phaser'));
  assert.equal(s.enemy.phaserCombo.hits,2);assert.equal(s.enemy.phaserCombo.arc,arc);assert.equal(s.nextOrder(),s.turn.orders[2]);
  assert(s.fire('torpedo'));assert.equal(s.player.torpedoes,ammo-1);
  s.autoHelm=()=>{};s.steerFlight=()=>{};s.moveFlightVelocity=()=>({x:0,y:0,z:0});
  for(let i=0;i<40&&!s.events.some(e=>e.type==='impact'&&e.weapon==='torpedo'&&e.ship==='Yorktown');i++)s.tick(.05);
  const impact=s.events.find(e=>e.type==='impact'&&e.weapon==='torpedo'&&e.ship==='Yorktown');
  assert(impact?.combo);assert.equal(impact.arc,arc);assert.equal(s.shots,3);assert.equal(s.turn.spent.player.phaser,2);assert.equal(s.turn.spent.player.torpedo,1);
});
test('Direct Assault briefly holds the next phaser for the same facing and the torpedo for an active disruption',()=>{
  const s=duel();assert(s.fire('phaser'));s.player.cooldown.phaser=0;s.player.capacitor=100;s.enemy.heading=90;s.time=.5;
  assert.equal(s.status('phaser'),'TRACKING THE SAME SHIELD');s.time=3.1;assert.equal(s.status('phaser'),'READY','do not hold forever for an unavailable facing');
  s.enemy.heading=180;assert(s.fire('phaser'));s.player.capacitor=100;s.enemy.heading=90;
  assert.equal(s.status('torpedo'),'ALIGNING FOR SHIELD OPENING');s.time=s.enemy.phaserCombo.until+.1;assert.equal(s.status('torpedo'),'READY','an expired opening returns to ordinary firing');
});
test('the firing pass slows smoothly, then accelerates once the salvo is spent',()=>{
  const s=duel(1000),p=s.player,maximum=125*s.flightMobility(p)*1.5;
  s.autoHelm(.05);assert(p.flightTargetSpeed<maximum*.8&&p.flightTargetSpeed>maximum*.6);assert(p.speed>95&&p.speed<105,'speed changes retain inertia');
  const manual=s.desiredFlightSpeed(p,s.enemy,s.enemy,{mode:'attack',firingPass:true,speedOverride:1});assert.equal(manual.speed,maximum);
  for(const order of s.turn.orders)order.status='hit';s.autoHelm(.05);assert.equal(p.flightTargetSpeed,maximum);
});
test('inbound tracking corrections are small and stop before the close flypast',()=>{
  const s=duel(1100),p=s.player,e=s.enemy;s.autoHelm(.05);const pass=s.turn.navigation.flyPast,original={...pass.direction};
  const angle=(a,b)=>Math.acos(B.clamp(a.x*b.x+a.y*b.y+a.z*b.z,-1,1));
  e.x+=80;let previous=original;
  for(let i=0;i<40;i++){s.autoHelm(.05);const course=pass.trackingDirection;assert(course);assert(angle(original,course)<=6.01*Math.PI/180);assert(angle(previous,course)<=3.01*Math.PI/180*.05);previous={...course};e.x+=2;}
  assert(angle(original,previous)>.01);assert.deepEqual(pass.direction,original,'keep the original crossing axis');
  Object.assign(p,{x:e.x+original.x*100,y:e.y+original.y*100,z:e.z+original.z*100});const frozen={...pass.trackingDirection};s.autoHelm(.05);
  assert.deepEqual(pass.trackingDirection,frozen);assert(!s.turn.navigation.flyPastComplete);
  Object.assign(p,{x:e.x+original.x*550,y:e.y+original.y*550,z:e.z+original.z*550});s.autoHelm(.05);assert(s.turn.navigation.flyPastComplete);
});
test('custom firing ranges and torpedo-first finishing plans remain explicit choices',()=>{
  const s=duel();s.turn.orders[0].range=400;assert.equal(s.status('phaser'),'CLOSE TO ORDERED RANGE');
  s.turn.orders=[s.turn.orders[2],s.turn.orders[0],s.turn.orders[1]];assert.equal(s.nextOrder().weapon,'torpedo');
});
test('the controlled Direct Assault clears crossing traffic before handing off to the flank',()=>{
  for(const seed of [5,24]){
    const s=new B.Simulation(seed,{randomStart:true});s.running=true;s.applyPlanPreset('aggressive');assert(s.commitOrders());
    for(let i=0;i<1600&&!s.result&&s.turn.stageIndex<1;i++)s.tick(.05);
    assert.equal(s.turn.stageIndex,1);assert.equal(s.turn.maneuver,'flank');
    assert(!s.events.some(event=>event.type==='ship-collision'),'the strafing leg remains clear');
  }
});
