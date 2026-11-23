const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
const advance=(s,seconds,keys={})=>{for(let t=0;t<seconds;t+=.05)s.tick(.05,keys);};

test('self-destruct ends the game once, bypasses shields, works in Free Flight, and records an active combat replay',()=>{
  const s=new B.Simulation();assert.equal(s.selfDestruct(),false);
  s.running=true;s.randomizePlan();s.commitOrders();const shields={...s.player.shields},enemyHull=s.enemy.hull;
  assert.equal(s.selfDestruct(),true);assert.equal(s.result,'defeat');assert.equal(s.running,false);assert.equal(s.player.hull,0);assert.deepEqual(s.player.shields,shields);assert.equal(s.enemy.hull,enemyHull);
  assert.equal(s.events.filter(event=>event.type==='destroyed').length,1);assert.equal(s.lastReplay.result,'defeat');assert(s.lastReplay.events.some(item=>item.event.type==='destroyed'&&item.event.ship==='Enterprise'));
  assert.equal(s.selfDestruct(),false);assert.equal(s.events.filter(event=>event.type==='destroyed').length,1);
  s.reset();s.startFreeFlight();s.running=false;assert.equal(s.selfDestruct(),false);s.running=true;assert.equal(s.selfDestruct(),true);assert.equal(s.player.hull,0);
});

test('ship contacts emit one collision cue until the ships separate, and reset clears contact state',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;
  Object.assign(s.player,{x:3000,y:0,z:0,heading:0,speed:15});Object.assign(s.enemy,{x:3050,y:0,z:0,heading:0,speed:15});
  s.tick(.05);assert.equal(s.events.filter(event=>event.type==='ship-collision').length,1);assert.equal(s.shipsTouching,true);
  s.tick(.05);assert.equal(s.events.filter(event=>event.type==='ship-collision').length,1);
  s.enemy.x=s.player.x+400;s.tick(.05);assert.equal(s.shipsTouching,false);
  s.enemy.x=s.player.x+20;s.enemy.y=s.player.y;s.enemy.z=s.player.z;s.tick(.05);
  const collisions=s.events.filter(event=>event.type==='ship-collision');assert.equal(collisions.length,2);assert(Object.values(collisions[0].pos).every(Number.isFinite));
  const k=s.station,from={x:k.x,y:k.y,z:k.z+500};Object.assign(s.player,{x:k.x,y:k.y,z:k.z-500,speed:125});s.moveAroundStation(s.player,from);
  assert(s.events.some(event=>event.type==='station-collision'),'K7 contacts supply a collision cue too');
  s.reset();assert.equal(s.shipsTouching,false);
});

test('power allocation conserves the shared budget, including zeroed banks',()=>{
  const map={engines:24,shields:30,weapons:30,sensors:16};
  for(const [key,value] of [['weapons',95],['engines',100],['sensors',30],['shields',0],['weapons',48]]){
    B.redistribute(map,key,value);assert.ok(Math.abs(Object.values(map).reduce((a,b)=>a+b,0)-100)<1e-8);assert.equal(map[key],value);assert.ok(Object.values(map).every(n=>n>=0&&n<=100));
  }
});
test('the six impact sectors follow ship heading and pitch',()=>{
  const s=new B.Simulation(97,{turnBased:false}).player;Object.assign(s,{x:0,y:0,z:0});
  for(const [arc,pos] of Object.entries({fore:{x:0,y:0,z:-5},aft:{x:0,y:0,z:5},starboard:{x:5,y:0,z:0},port:{x:-5,y:0,z:0},dorsal:{x:0,y:5,z:0},ventral:{x:0,y:-5,z:0}}))assert.equal(B.facing(s,pos),arc);
  s.heading=90;assert.equal(B.facing(s,{x:5,y:0,z:0}),'fore');s.pitch=60;assert.equal(B.facing(s,{x:1,y:5,z:0}),'fore');
});
test('strong shields absorb fire; a breached shield exposes hull and subsystems',()=>{
  const s=new B.Simulation(97,{turnBased:false}),p=s.player,e=s.enemy,arc=B.facing(e,p);s.running=true;
  s.damage(e,p,20,'phaser','sensors');assert.equal(e.hull,100);assert.ok(e.shields[arc]<100);
  e.shields[arc]=0;const reactor=e.reactor;s.damage(e,p,40,'torpedo','sensors');assert.ok(e.hull<100);assert.ok(e.integrity.sensors<100);assert.ok(e.reactor<reactor);
  const output=s.output(e,'sensors');e.reactor=30;assert.ok(s.output(e,'sensors')<output);
});
test('weapons enforce firing arcs, capacitor, sensor operation, heat and ammunition',()=>{
  const s=new B.Simulation(97,{turnBased:false});Object.assign(s.enemy,{x:200,y:80,z:-780});s.running=true;assert.equal(s.status('phaser'),'READY');assert.equal(s.fire('phaser'),true);assert.equal(s.status('phaser'),'RECHARGING');
  s.player.cooldown.phaser=0;s.player.heading=180;assert.equal(s.status('phaser'),'OUTSIDE FIRING ARC');s.player.heading=0;s.player.integrity.sensors=0;assert.equal(s.status('phaser'),'SENSOR LOCK LOST');
  s.player.integrity.sensors=100;s.player.capacitor=0;assert.equal(s.status('phaser'),'LOW CAPACITOR');s.player.capacitor=100;s.player.heat=90;assert.equal(s.status('phaser'),'PHASERS OVERHEATED');s.player.torpedoes=0;assert.equal(s.status('torpedo'),'MAGAZINE EMPTY');
});
test('a launched photon travels before damaging the facing shield',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;Object.assign(s.enemy,{x:200,y:80,z:-780});const before=Object.values(s.enemy.shields).reduce((a,b)=>a+b,0);assert.equal(s.fire('torpedo'),true);assert.equal(s.player.torpedoes,23);assert.equal(s.projectiles.length,1);assert.equal(Object.values(s.enemy.shields).reduce((a,b)=>a+b,0),before);advance(s,3);assert.equal(s.projectiles.length,0);assert.ok(Object.values(s.enemy.shields).some(v=>v<90));
});

test('a photon keeps its launch heading and pitch when its target changes course',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0,pitch:0});Object.assign(s.enemy,{x:2000,y:0,z:-1000,heading:180});s.enemy.integrity.weapons=0;s.enemy.repairBudget=0;
  assert(s.fire('torpedo'));const torpedo=s.projectiles[0],heading=torpedo.heading,pitch=torpedo.pitch,start={...torpedo.pos},d=B.direction(torpedo);
  s.enemy.x+=2000;s.enemy.heading=270;
  for(let i=0;i<90&&s.projectiles.includes(torpedo);i++){
    s.tick(.1);assert.equal(torpedo.heading,heading);assert.equal(torpedo.pitch,pitch);
    const x=torpedo.pos.x-start.x,y=torpedo.pos.y-start.y,z=torpedo.pos.z-start.z;
    assert(Math.hypot(y*d.z-z*d.y,z*d.x-x*d.z,x*d.y-y*d.x)<1e-6,'trajectory stays on its initial ray');
  }
  assert.equal(s.projectiles.length,0);assert.equal(s.enemy.hull,100);assert(Object.values(s.enemy.shields).every(v=>v===100));assert.equal(s.player.torpedoes,23);
});
test('Yorktown pursues and eventually destroys an undefended Enterprise',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;const start=s.range;advance(s,7);assert.ok(s.range<start);for(let i=0;i<10000&&!s.result;i++)s.tick(.1);assert.equal(s.result,'defeat');assert.equal(s.player.hull,0);assert.equal(s.running,false);
});
test('helm preserves signed thrust, brakes before reversing and allows a full stop',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.player.throttle=60;advance(s,1);assert.ok(s.player.speed>0);s.player.throttle=-60;s.tick(.05);assert.ok(s.player.speed>=0);advance(s,2);assert.ok(s.player.speed<0);const heading=s.player.heading;s.tick(.1,{stop:true});assert.equal(s.player.speed,0);assert.equal(s.player.throttle,0);s.tick(.1,{right:true,up:true});assert.ok(s.player.heading>heading);assert.ok(s.player.pitch<0);s.player.pitch=0;s.tick(.1,{down:true});assert.ok(s.player.pitch>0);
});
test('pausing freezes combat and movement, and reset restores both ships',()=>{
  const s=new B.Simulation(97,{turnBased:false}),original=JSON.stringify(s.player);s.tick(.1,{right:true,more:true});assert.equal(JSON.stringify(s.player),original);s.running=true;s.damage(s.enemy,s.player,999,'torpedo','reactor');s.player.torpedoes=0;s.reset();assert.equal(s.result,null);assert.equal(s.player.torpedoes,24);assert.equal(s.enemy.hull,100);assert.equal(s.time,0);assert.equal(s.running,false);
});
test('operating sensors reveal damage; low power loses detail, failure loses lock',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;assert.equal(s.detailed,true);s.player.power.sensors=7;assert.equal(s.contact,true);assert.equal(s.detailed,false);assert.equal(s.scan(),true);assert.equal(s.detailed,true);assert.ok(s.player.capacitor<100);s.player.integrity.sensors=0;assert.equal(s.contact,false);assert.equal(s.detailed,false);assert.equal(s.lock,false);
});
test('repair crews restore a selected damaged system after a quiet interval using finite parts',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.aiShot=999;s.aiTorp=999;s.player.integrity.sensors=15;s.player.lastHit=0;advance(s,5);assert.equal(s.player.integrity.sensors,15);advance(s,3);assert.ok(s.player.integrity.sensors>15);assert.ok(s.player.repairBudget<30);s.player.repairBudget=0;const saved=s.player.integrity.sensors;advance(s,1);assert.equal(s.player.integrity.sensors,saved);
});
test('a completed engagement cannot fire additional weapons or continue time',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;const arc=B.facing(s.enemy,s.player);s.enemy.shields[arc]=0;s.enemy.hull=1;s.damage(s.enemy,s.player,40,'torpedo','hull');assert.equal(s.result,'victory');const t=s.time;s.tick(.1);assert.equal(s.time,t);assert.equal(s.fire('phaser'),false);
});

test('20 km limits tracking and new torpedo launches in both environments',()=>{
  for(const environment of ['nebula','space']){
    const s=new B.Simulation(97,{turnBased:false});s.environment=environment;s.running=true;
    Object.assign(s.player,{x:0,y:0,z:0,heading:0,pitch:0});Object.assign(s.enemy,{x:0,y:0,z:-2000});
    assert.equal(s.contact,false);assert.equal(s.status('torpedo'),'OUT OF RANGE');
    s.enemy.z=-1999;assert.equal(s.contact,true);assert.equal(s.status('torpedo'),'READY');
    assert.equal(s.status('phaser'),'OUT OF RANGE');s.enemy.z=-1500;assert.equal(s.status('phaser'),'READY');
  }
});

test('badly damaged Yorktown breaks off, flees in 3D, and respects engine damage',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.enemy.hull=25;s.tick(.05);assert.equal(s.enemyRetreating,false);
  s.enemy.hull=24;s.tick(.05);assert.equal(s.enemyRetreating,true);
  assert.equal(Object.values(s.enemy.power).reduce((a,b)=>a+b,0),100);assert.equal(s.enemy.repair,'engines');
  const before=s.range;advance(s,8);assert.ok(s.range>before+100);assert.ok(s.enemy.y>s.player.y);assert.equal(s.shots,0);
  assert.equal(s.log.filter(l=>l.text.includes('attempting to retreat')).length,1);
  const fast=s.enemy.speed;s.enemy.integrity.engines=0;s.enemy.repairBudget=0;s.tick(.05);assert.ok(s.enemy.speed<fast);
  advance(s,3);assert.equal(s.enemyRetreating,false);assert(s.enemyMind.returnManeuver);assert(s.enemyMind.reengageUntil>s.time);
  s.reset();assert.equal(s.enemyRetreating,false);assert.equal(s.enemy.power.engines,24);
});

test('emergency warp jumps exactly 30 km along attitude once per engagement',()=>{
  for(const [heading,pitch] of [[0,0],[90,30],[350,-45]]){
    const s=new B.Simulation(97,{turnBased:false});assert.equal(s.warp(),false);assert.equal(s.warpUsed,false);
    s.running=true;Object.assign(s.player,{heading,pitch,throttle:40,speed:35});
    const from={...s.player},enemy={x:s.enemy.x,y:s.enemy.y,z:s.enemy.z},d=B.direction(s.player);
    assert.equal(s.warp(),true);assert.ok(Math.abs(B.distance(from,s.player)-3000)<1e-8);
    for(const axis of ['x','y','z'])assert.ok(Math.abs(s.player[axis]-from[axis]-d[axis]*3000)<1e-8);
    assert.equal(s.player.heading,heading);assert.equal(s.player.pitch,pitch);assert.equal(s.player.speed,35);assert.equal(s.player.throttle,40);
    assert.deepEqual({x:s.enemy.x,y:s.enemy.y,z:s.enemy.z},enemy);
    const destination={x:s.player.x,y:s.player.y,z:s.player.z};assert.equal(s.warp(),false);assert.deepEqual({x:s.player.x,y:s.player.y,z:s.player.z},destination);
    s.reset();assert.equal(s.warpUsed,false);s.running=true;s.result='victory';assert.equal(s.warp(),false);
  }
});

test('Yorktown turns and pursues Enterprise after its warp jump',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.player.heading=180;s.warp();const range=s.range;assert.equal(s.contact,false);
  advance(s,15);assert.ok(s.range<range);assert.ok(B.angle(s.enemy,s.player)<5);assert.equal(s.enemyRetreating,false);
});

test('Yorktown starts about 18 km away, tracked but beyond phaser range',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;
  assert(s.range>1750&&s.range<1850);assert.equal(s.contact,true);assert.equal(s.status('phaser'),'OUT OF RANGE');assert.equal(s.status('torpedo'),'READY');
});

test('ships never drop below minimum impulse at zero thrust, reversal, or engine failure',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.player.integrity.engines=0;s.enemy.integrity.engines=0;s.enemy.integrity.weapons=0;
  for(const throttle of [0,-1,0,1,-100,100]){
    s.player.throttle=throttle;
    for(let i=0;i<30;i++){
      const previous={...s.player};s.tick(.05);
      assert(Math.abs(s.player.speed)>=B.MIN_IMPULSE_SPEED);assert(s.enemy.speed>=B.MIN_IMPULSE_SPEED);assert(B.distance(previous,s.player)>0);
    }
  }
  s.slowAhead();assert.equal(s.player.speed,B.MIN_IMPULSE_SPEED);assert.equal(s.player.throttle,0);
  s.running=false;const previous={...s.player};s.tick(.1);assert.equal(B.distance(previous,s.player),0);
});

test('Enterprise holds bank and pitch when steering is released',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;
  advance(s,.5,{right:true,down:true});const bank=s.player.bank,pitch=s.player.pitch;assert(bank<0);assert(pitch>0);
  advance(s,2);assert.equal(s.player.bank,bank);assert.equal(s.player.pitch,pitch);
});

test('Enterprise holds turn rate on release and opposite steering brakes the turn',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;advance(s,.25,{right:true});
  const rate=s.player.turnRate,bank=s.player.bank,heading=s.player.heading,time=s.time;assert(rate>0);
  advance(s,.5);assert.equal(s.player.turnRate,rate);assert.equal(s.player.bank,bank);assert(Math.abs(B.delta(heading,s.player.heading)-rate*(s.time-time))<.01);
  s.tick(.05,{left:true});assert(s.player.turnRate<rate);advance(s,.5,{left:true});assert(s.player.turnRate<0);
  s.reset();assert.equal(s.player.turnRate,0);
});

test('longer phaser burst still applies one damage hit at the current shield balance',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;Object.assign(s.enemy,{x:0,y:0,z:-850});
  assert(s.fire('phaser'));assert.equal(s.events.find(e=>e.type==='beam').duration,1.4);
  const shield=s.enemy.shields[B.facing(s.enemy,s.player)];assert(Math.abs(shield-42.88)<1e-8);
  const impactCount=()=>s.events.filter(e=>e.type==='impact'&&e.ship==='Yorktown').length;
  assert.equal(impactCount(),1);advance(s,1.4);assert.equal(impactCount(),1);assert.equal(s.hits,1);
});


test('torpedo misses emit one confirmed outcome for expiry or K7 interception, but not practice shots',()=>{
  for(const reason of ['expired','blocked','practice']){
    const s=new B.Simulation(97,{turnBased:false});s.running=true;Object.assign(s.player,{x:2000,y:0,z:0});Object.assign(s.enemy,{x:2000,y:0,z:-900});s.enemy.integrity.weapons=0;
    s.stationTrace=(from,to,padding)=>reason==='blocked'&&padding===2?{pos:{...to},normal:{x:0,y:1,z:0}}:null;
    s.projectiles.push({id:'miss-test',from:'Enterprise',target:'Yorktown',pos:{x:2000,y:500,z:0},heading:90,pitch:0,life:7.99,maxLife:8,strength:1,targetSystem:'hull',practice:reason==='practice'});
    s.tick(.05);s.tick(.05);const misses=s.events.filter(e=>e.type==='torpedo-missed');
    assert.equal(misses.length,reason==='practice'?0:1);
    if(misses.length){assert.equal(misses[0].reason,reason);assert.equal(misses[0].from,'Enterprise');assert.equal(misses[0].target,'Yorktown');assert.equal(misses[0].projectileId,'miss-test');}
  }
});
