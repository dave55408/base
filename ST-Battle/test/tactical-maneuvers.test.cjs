const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(route){
  const s=new B.Simulation(97);s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0,speed:150});
  Object.assign(s.enemy,{x:6000,y:0,z:-900,heading:180,pitch:0,speed:150});
  s.selectManeuver(route,0);
  ['phaser','phaser','torpedo'].forEach((weapon,i)=>assert(s.updateStep(i,{weapon,target:'hull',range:300,maneuvers:[0]})));
  assert(s.commitOrders());return s;
}
test('Ram requires a solid collision and damages both ships once, regardless of shields',()=>{
  const s=duel('ram');s.enemy.z=-90;s.player.integrity.weapons=s.enemy.integrity.weapons=0;
  s.tick(.05);
  assert(s.turn.navigation.rammed);assert(s.player.hull<55);assert(s.enemy.hull<55);
  assert(s.events.some(e=>e.type==='ship-collision'));
  assert.equal(s.events.filter(e=>e.weapon==='ram').length,2);
  assert(s.player.integrity.bridge<100);assert(s.enemy.reactor<100);
  const hull=[s.player.hull,s.enemy.hull];assert.equal(s.ramImpact(300),false);
  assert.deepEqual([s.player.hull,s.enemy.hull],hull);
  assert.equal(s.shots,0);assert.equal(s.hits,0);assert(s.battleStats.score>0);
});
test('Ram misses, glancing contacts, and ordinary collisions do not get heavy damage',()=>{
  const miss=duel('ram');miss.player.integrity.weapons=miss.enemy.integrity.weapons=0;miss.tick(.05);
  assert.equal(miss.player.hull,100);assert.equal(miss.enemy.hull,100);
  const glance=duel('ram');glance.enemy.z=-80;glance.enemy.heading=0;glance.enemy.speed=glance.player.speed=15;
  glance.player.integrity.weapons=glance.enemy.integrity.weapons=0;glance.tick(.05);
  assert(!glance.turn.navigation.rammed);assert.equal(glance.player.hull,100);assert.equal(glance.enemy.hull,100);
  const normal=duel('direct');assert.equal(normal.ramImpact(300),false);
});
test('A mutual lethal ram destroys both ships and records a defeat with both damage states',()=>{
  const s=duel('ram');s.player.hull=s.enemy.hull=20;s.enemy.z=-90;
  s.player.integrity.weapons=s.enemy.integrity.weapons=0;s.tick(.05);
  assert.equal(s.player.hull,0);assert.equal(s.enemy.hull,0);assert.equal(s.result,'defeat');assert.equal(s.running,false);
  assert.equal(s.events.filter(e=>e.type==='destroyed').length,2);
  assert.equal(s.lastReplay.result,'defeat');
  const frame=s.lastReplay.frames.at(-1);assert.equal(frame.player.hull,0);assert.equal(frame.enemy.hull,0);
});
test('Ram keeps closing after firing and aims ahead of a moving Yorktown',()=>{
  const s=duel('ram');for(const order of s.turn.orders){order.status='hit';order.firedStage=0;order.firedAt=-20;}
  s.time=20;s.turn.navigation.elapsed=20;s.advanceTurn(.05);assert.equal(s.turn.stageCompletedAt,null);
  s.enemy.heading=90;let aim;s.steerFlight=(ship,point)=>{aim=point;};s.autoHelm(.05);
  assert(aim.x>s.enemy.x);assert.equal(s.turn.navigation.stage,'attack');
  assert(s.desiredFlightSpeed(s.player,s.enemy,s.enemy,{mode:'ram'}).speed>100);
});
test('Close battle follows a changing Yorktown course and matches its speed alongside',()=>{
  const s=duel('close');s.enemy.heading=s.player.heading=90;s.enemy.speed=70;
  Object.assign(s.player,{x:s.enemy.x-200,y:0,z:s.enemy.z+220});
  let aim;s.steerFlight=(ship,point)=>{aim=point;};s.autoHelm(.05);
  assert(s.turn.navigation.matchingCourse);assert(aim.x>s.player.x);
  assert(Math.abs(s.player.flightTargetSpeed-70)<1);assert.match(s.player.speedIntent,/MATCHING YORKTOWN/);
  s.enemy.heading=0;s.autoHelm(.05);assert(aim.z<s.player.z);
  assert.equal(s.turn.navigation.stage,'attack');
});
test('Chase pursues after its attacks are spent and finishes without a withdrawal phase',()=>{
  const s=duel('chase');for(const order of s.turn.orders){order.status='hit';order.firedStage=0;order.firedAt=-20;}
  for(const order of s.turn.enemyOrders)order.status='skipped';
  s.time=20;s.turn.navigation.elapsed=20;s.advanceTurn(.05);
  assert.equal(s.turn.stageCompletedAt,null);assert.notEqual(s.turn.phase,'disengage');
  let aim;s.steerFlight=(ship,point)=>{aim=point;};s.autoHelm(.05);
  assert(!s.turn.navigation.retiring);assert(aim.z<s.player.z);
  s.turn.remaining=.01;s.advanceTurn(.05);assert.equal(s.turn.phase,'review');
  assert(!s.events.some(e=>e.type==='phase'&&e.phase==='disengage'));
});
test('Chase can hand over to a following maneuver and End pass remains available',()=>{
  const s=duel('chase');s.turn.maneuvers[1]='distance';s.turn.remaining=.01;
  for(const order of s.turn.orders)order.status='skipped';s.advanceTurn(.05);
  assert.equal(s.turn.maneuver,'distance');assert.equal(s.turn.stageIndex,1);
  const c=duel('chase');assert(c.endPass());assert.equal(c.turn.phase,'review');
});

test('Chase holds a 12 km following distance after attacks and slows when too close',()=>{
  const s=duel('chase'),p=s.player,e=s.enemy;
  for(const order of s.turn.orders)order.status='hit';
  Object.assign(e,{heading:0,speed:60,z:-1200});Object.assign(p,{heading:0,speed:60});
  s.autoHelm(.05);assert.equal(s.player.flightTargetSpeed,60);
  assert.equal(B.distance(s.turn.navigation.waypoint,e),1200);
  const aim={x:e.x,y:e.y,z:e.z};
  e.z=-800;assert(s.desiredFlightSpeed(p,e,aim,{mode:'pursuit'}).speed<60);
  e.z=-1800;assert(s.desiredFlightSpeed(p,e,e,{mode:'pursuit'}).speed>60);
  e.z=-1200;p.z=0;p.speed=60;p.flightAcceleration=0;
  for(let i=0;i<200;i++){
    e.z-=3;s.autoHelm(.05);const d=B.direction(p);p.x+=d.x*p.speed*.05;p.z+=d.z*p.speed*.05;
  }
  assert(B.distance(p,e)>1100&&B.distance(p,e)<1300);
  assert.match(p.speedIntent,/PURSUING AT DISTANCE/);assert(!s.turn.navigation.retiring);
});

test('Yorktown fires phasers and torpedoes aft while Enterprise retains forward arcs',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;
  Object.assign(s.enemy,{x:6000,y:0,z:0,heading:0,pitch:0});Object.assign(s.player,{x:6000,y:0,z:800,heading:180,pitch:0});
  assert.equal(s.status('phaser',s.enemy,s.player),'READY');assert(s.fire('phaser',s.enemy,s.player));
  assert.equal(s.status('phaser',s.enemy,s.player),'RECHARGING');
  assert.equal(s.status('phaser'),'OUTSIDE FIRING ARC');
  assert(s.fire('torpedo',s.enemy,s.player));const torpedo=s.projectiles.at(-1);
  assert(torpedo.pos.z>s.enemy.z);assert(Math.abs(B.delta(torpedo.heading,180))<1);
  assert.equal(s.enemy.torpedoes,23);
  s.enemy.cooldown.phaser=0;s.player.x=6800;s.player.z=0;
  assert.equal(s.status('phaser',s.enemy,s.player),'OUTSIDE FIRING ARC');
  s.player.x=6000;s.player.z=800;s.enemy.integrity.weapons=0;
  assert.equal(s.status('phaser',s.enemy,s.player),'WEAPONS OFFLINE');
});

test('Yorktown uses its existing salvo budget to fire aft while retreating',()=>{
  const s=duel('chase');Object.assign(s.enemy,{z:-800,heading:0});s.enemyRetreating=true;s.player.integrity.weapons=0;
  s.turn.enemyOrders=['phaser','phaser','torpedo'].map(weapon=>({weapon,target:'hull',range:1500,status:'pending'}));
  for(let i=0;i<3;i++){s.enemy.cooldown.phaser=s.enemy.cooldown.torpedo=0;s.enemy.capacitor=100;s.advanceTurn(.05);}
  assert.deepEqual(s.turn.spent.enemy,{phaser:1,torpedo:0});
  assert.equal(s.turn.offArcSpent.enemy,true);
  assert.equal(s.status('phaser',s.enemy,s.player),'OUTSIDE FIRING ARC');
  s.enemyRetreating=false;s.enemy.heading=180;
  for(let i=0;i<2;i++){s.enemy.cooldown.phaser=s.enemy.cooldown.torpedo=0;s.enemy.capacitor=100;s.advanceTurn(.05);}
  assert.deepEqual(s.turn.spent.enemy,{phaser:2,torpedo:1});
  s.enemy.cooldown.phaser=0;s.enemy.capacitor=100;assert.equal(s.fire('phaser',s.enemy,s.player),false);
});

test('Close battle lets both ships fire phasers and torpedoes aft and broadside',()=>{
  for(const heading of [90,180])for(const weapon of ['phaser','torpedo'])for(const side of ['player','enemy']){
    const s=duel('close'),shooter=s[side],target=side==='player'?s.enemy:s.player;
    Object.assign(shooter,{x:6000,y:0,z:0,heading,pitch:0});Object.assign(target,{x:6000,y:0,z:-250});
    const orders=side==='player'?s.turn.orders:s.turn.enemyOrders;
    for(const order of orders){order.status='skipped';delete order.attackArc;}
    Object.assign(orders[0],{weapon,target:'hull',range:1500,status:'pending',maneuvers:[0]});
    assert.equal(s.status(weapon,shooter,target),'READY');assert(s.fire(weapon,shooter,target));
    assert.equal(s.turn.spent[side][weapon],1);
    if(weapon==='torpedo'){
      const torpedo=s.projectiles.at(-1);assert(torpedo.pos.z<shooter.z);
      assert(Math.abs(B.delta(torpedo.heading,0))<1);
    }
  }
});

test('Close battle keeps normal resource and range rules, and all-angle fire ends with the maneuver',()=>{
  const s=duel('close');s.player.heading=90;s.enemy.z=-250;
  s.player.capacitor=0;assert.equal(s.status('phaser'),'LOW CAPACITOR');
  s.player.capacitor=100;s.player.cooldown.phaser=2;assert.equal(s.status('phaser'),'RECHARGING');
  s.player.cooldown.phaser=0;s.enemy.z=-1800;assert.equal(s.status('phaser'),'CLOSE TO ORDERED RANGE');
  s.enemy.z=-250;s.turn.maneuver='direct';assert.equal(s.status('phaser'),'READY');
  s.turn.offArcSpent.player=true;assert.equal(s.status('phaser'),'OUTSIDE FIRING ARC');
  s.turn.maneuver='close';s.turn.phase='review';assert.equal(s.closeBattleFire(),false);
  s.turn.phase='approach';s.freeFlight=true;assert.equal(s.closeBattleFire(),false);
});

test('Each ship gets exactly one aft or broadside attack per turn outside Close battle',()=>{
  for(const route of ['direct','port','starboard','above','below','behind','hide','distance','ram','chase']){
    const s=duel(route);s.turn.navigation.stage='attack';
    Object.assign(s.player,{heading:180});Object.assign(s.enemy,{z:-250,heading:0});
    for(const orders of [s.turn.orders,s.turn.enemyOrders])for(const order of orders){order.range=1500;order.target='hull';delete order.attackArc;}
    for(const [side,shooter,target] of [['player',s.player,s.enemy],['enemy',s.enemy,s.player]]){
      assert.equal(s.status('phaser',shooter,target),'READY',route);
      assert.equal(s.status('phaser',shooter,target),'READY','checking status never consumes the allowance');
      assert(s.fire('phaser',shooter,target));assert.equal(s.turn.offArcSpent[side],true);
      shooter.cooldown.phaser=0;shooter.capacitor=100;
      assert.equal(s.status('phaser',shooter,target),'OUTSIDE FIRING ARC',route);
    }
  }
});

test('Forward fire does not consume the shared allowance; phasers and torpedoes share it',()=>{
  const s=duel('direct');s.enemy.z=-250;
  assert(s.fire('phaser'));assert.equal(s.turn.offArcSpent.player,false);
  s.player.heading=180;s.player.cooldown.phaser=0;assert(s.fire('phaser'));
  assert.equal(s.turn.offArcSpent.player,true);assert.equal(s.status('torpedo'),'OUTSIDE FIRING ARC');
  s.player.heading=0;assert(s.fire('torpedo'));assert.equal(s.player.torpedoes,23);
  const t=duel('direct');t.enemy.z=-250;t.player.heading=90;
  t.turn.orders[0].weapon='torpedo';t.turn.orders[2].weapon='phaser';
  assert(t.fire('torpedo'));assert(t.projectiles[0].pos.z<t.player.z);
  assert.equal(t.status('phaser'),'OUTSIDE FIRING ARC');
});

test('Failed shots preserve the allowance and live maneuver edits cannot replenish it',()=>{
  const s=duel('direct');s.enemy.z=-250;s.player.heading=180;s.player.capacitor=0;
  assert.equal(s.fire('phaser'),false);assert.equal(s.turn.offArcSpent.player,false);
  s.player.capacitor=100;assert(s.fire('phaser'));
  assert(s.applyRevisions(s.turn.draft,['above',null,null]));assert.equal(s.turn.offArcSpent.player,true);
  s.startStage(0);assert.equal(s.turn.offArcSpent.player,true);
  s.finishPass();assert(s.applyPlanPreset('strong'));assert(s.commitOrders());
  assert.deepEqual(s.turn.offArcSpent,{player:false,enemy:false});
});

test('Close battle neither consumes nor replenishes the one-attack allowance',()=>{
  const s=duel('close');s.enemy.z=-250;s.player.heading=180;
  assert(s.fire('phaser'));s.player.cooldown.phaser=0;assert(s.fire('phaser'));
  assert.equal(s.turn.offArcSpent.player,false);
  s.turn.maneuver='direct';assert(s.fire('torpedo'));assert.equal(s.turn.offArcSpent.player,true);
  s.turn.maneuver='close';assert(s.inFiringArc('phaser',s.player,s.enemy));
  s.turn.maneuver='direct';assert(!s.inFiringArc('phaser',s.player,s.enemy));
});
