const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
function duel(route='direct'){
  const s=new B.Simulation(97);s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0,speed:150});
  Object.assign(s.enemy,{x:6000,y:0,z:-1200,heading:180,pitch:0,speed:150});
  s.selectManeuver(route);
  ['phaser','phaser','torpedo','phaser','phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:300,maneuvers:[0]}));
  assert(s.commitOrders());s.fire=()=>false;return s;
}
test('head-on prediction diverts both ships to opposite sides and brakes before contact',()=>{
  const s=duel(),p=s.player,e=s.enemy;
  const pa=s.avoidShipCollision(p,e,e),ea=s.avoidShipCollision(e,p,p);
  assert(pa.x>p.x);assert(ea.x<e.x);
  assert(s.desiredFlightSpeed(p,e,pa,{speedOverride:1}).speed<=55);
  for(let i=0;i<400;i++)s.tick(.05);
  assert(!s.events.some(event=>event.type==='ship-collision'));
});
test('crossing and overtaking paths trigger prediction',()=>{
  const s=duel(),p=s.player,e=s.enemy;
  Object.assign(e,{x:6600,z:-600,heading:270});
  s.avoidShipCollision(p,e,e);assert(p.collisionAvoidance);
  p.collisionAvoidance=null;Object.assign(e,{x:6000,z:-500,heading:0,speed:30});
  s.avoidShipCollision(p,e,e);assert(p.collisionAvoidance);
});
test('safe parallel courses and separating ships retain their aim',()=>{
  const s=duel(),p=s.player,e=s.enemy;
  Object.assign(e,{heading:0,speed:150});
  assert.equal(s.avoidShipCollision(p,e,e),e);assert.equal(p.collisionAvoidance,null);
  p.heading=180;e.heading=0;
  assert.equal(s.avoidShipCollision(p,e,e),e);
});
test('avoidance holds its passing side briefly then releases when clear',()=>{
  const s=duel(),p=s.player,e=s.enemy;
  s.avoidShipCollision(p,e,e);const side=p.collisionAvoidance.x;
  e.x+=2000;s.time+=.5;s.avoidShipCollision(p,e,e);
  assert.equal(p.collisionAvoidance.x,side);
  s.time+=2;assert.equal(s.avoidShipCollision(p,e,e),e);
});
test('intentional Ram exempts both ships, but completed Ram restores avoidance',()=>{
  const s=duel('ram'),p=s.player,e=s.enemy;
  assert.equal(s.avoidShipCollision(p,e,e),e);
  assert.equal(s.avoidShipCollision(e,p,p),p);
  s.turn.navigation.rammed=true;s.avoidShipCollision(p,e,e);assert(p.collisionAvoidance);
});
test('crossing and overtaking approaches stay clear during forty seconds of actual flight',()=>{
  for(const [x,z,heading,speed] of [[6600,-600,270,150],[6000,-500,0,30]]){
    const s=duel();Object.assign(s.enemy,{x,z,heading,speed});
    for(let i=0;i<800;i++)s.tick(.05);
    assert(!s.events.some(event=>event.type==='ship-collision'));
  }
});
