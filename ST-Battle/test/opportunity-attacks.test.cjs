const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function setup(){
  const s=new B.Simulation(97);s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:600,heading:0,pitch:0});Object.assign(s.enemy,{x:6000,y:0,z:0,heading:180,pitch:0});
  s.selectManeuver('above',0);s.selectManeuver('direct',1);
  for(const [i,step] of [{weapon:'phaser',target:'hull',range:300,maneuvers:[0]},{weapon:'torpedo',target:'hull',range:700,maneuvers:[1]},{weapon:'phaser',target:'hull',range:900,maneuvers:[0]}].entries())assert(s.updateStep(i,step));
  assert(s.commitOrders());s.time=1;s.turn.orders[2].status='skipped';s.enemy.integrity.weapons=0;s.events=[];return s;
}
test('Enterprise can use an ideal attack assigned to the other maneuver without changing its flight plan',()=>{
  const s=setup(),order=s.turn.orders[1],navigation=s.turn.navigation,routes=JSON.stringify(s.turn.maneuvers),waypoint={...navigation.waypoint};
  assert.equal(s.nextPlannedOrder(),s.turn.orders[0]);assert.equal(s.nextOrder(),order);
  const ammo=s.player.torpedoes,capacitor=s.player.capacitor;
  assert(s.fire('torpedo'));assert.equal(order.status,'in-flight');assert.equal(order.firedStage,0);assert.deepEqual(order.maneuvers,[1]);
  assert.equal(s.turn.stageIndex,0);assert.equal(s.turn.navigation,navigation);assert.deepEqual(navigation.waypoint,waypoint);assert.equal(JSON.stringify(s.turn.maneuvers),routes);
  assert.equal(s.player.torpedoes,ammo-1);assert.equal(s.player.capacitor,capacitor-B.weaponSpecs.torpedo.energy);
  assert.equal(s.events.filter(event=>event.type==='opportunity-attack').length,1);
  s.startStage(1);assert.equal(s.fire('torpedo'),false);assert.equal(s.shots,1,'the borrowed attack is not fired again in its assigned maneuver');
});
test('opportunity shots still require optimal range, forward arc, correct target face and working weapons',()=>{
  for(const reason of ['range','arc','shield','cooldown','energy','sensors','blocked','cover','withdrawal']){
    const s=setup(),order=s.turn.orders[1];
    if(reason==='range')s.player.z=750;
    if(reason==='arc')s.player.heading=180;
    if(reason==='shield')order.target='shield-aft';
    if(reason==='cooldown')s.player.cooldown.torpedo=5;
    if(reason==='energy')s.player.capacitor=0;
    if(reason==='sensors')s.player.integrity.sensors=0;
    if(reason==='blocked')s.stationTrace=()=>({});
    if(reason==='cover'){s.turn.maneuver='hide';s.turn.navigation.stage='hiding';}
    if(reason==='withdrawal'){s.turn.maneuver='flee';s.turn.phase='withdraw';}
    assert.notEqual(s.nextOrder(),order,reason);assert.equal(s.fire('torpedo'),false,reason);
  }
});
test('an ideal ready attack in the current maneuver retains priority',()=>{
  const s=setup();s.turn.orders[0].range=1000;assert.equal(s.nextOrder(),s.turn.orders[0]);
  s.player.cooldown.phaser=10;assert.equal(s.nextOrder(),s.turn.orders[1],'a ready torpedo can use the window while phasers recharge');
});
test('Yorktown can take the same opportunity from an alternate assigned maneuver',()=>{
  const s=setup();s.enemy.integrity.weapons=100;
  s.turn.enemyOrders=[{weapon:'phaser',target:'hull',range:300,maneuvers:[0],status:'pending'},{weapon:'torpedo',target:'hull',range:700,maneuvers:[1],status:'pending'}];
  assert.equal(s.nextOrder(s.enemy),s.turn.enemyOrders[1]);assert(s.fire('torpedo',s.enemy,s.player));
  assert.equal(s.turn.enemyOrders[1].status,'in-flight');assert.equal(s.turn.stageIndex,0);assert.equal(s.turn.maneuver,'above');
  assert(s.events.some(event=>event.type==='opportunity-attack'&&event.ship==='Yorktown'));
});
test('a phaser borrowed from the next maneuver finishes its beam before the current maneuver hands over',()=>{
  const s=setup(),order=s.turn.orders[1];order.weapon='phaser';order.range=1000;
  assert(s.fire('phaser'));s.turn.remaining=0;s.advanceTurn(0);assert.equal(s.turn.stageIndex,0);
  s.time+=B.PHASER_DURATION;s.advanceTurn(0);assert.equal(s.turn.stageIndex,1);assert.equal(order.status,'hit');assert.equal(s.shots,1);
});
