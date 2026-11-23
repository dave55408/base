const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

test('practice phaser beam follows the player bow instead of tracking Yorktown',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),c={window:{},Battle:B,console,AbortController};
  vm.createContext(c);for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const scene=Object.create(c.window.BattleScene.prototype),T=scene.T=c.window.AlpineThree;
  scene.sim=new B.Simulation();scene.sim.startFreeFlight();const ship=new T.Group(),model=new T.Group();ship.add(model);ship.userData.model=model;
  scene.ships={Enterprise:ship};
  for(const heading of [0,90,217]){
    scene.sim.player.heading=heading;scene.sim.player.pitch=25;
    const {start,end}=scene.weaponEndpoints('Enterprise','Yorktown'),beam=end.sub(start).normalize(),forward=B.direction(scene.sim.player);
    const emitter=model.worldToLocal(start.clone());assert.equal(emitter.x,0);assert.equal(emitter.y,.265);assert.equal(emitter.z,-1.65);
    assert(Math.abs(beam.x-forward.x)<1e-8);assert(Math.abs(beam.y-forward.y)<1e-8);assert(Math.abs(beam.z-forward.z)<1e-8);
  }
});

test('free flight permits manual movement while both ships remain safe and Yorktown stays near K7',()=>{
  const s=new B.Simulation();s.startFreeFlight();
  const origin={...s.player},enemyOrigin={...s.enemy};let maxPatrolRange=0;
  for(let i=0;i<6000;i++){
    if(i%100===0){assert.equal(s.fire('phaser',s.enemy,s.player),false);assert.equal(s.fire('torpedo',s.enemy,s.player),false);}
    s.tick(.1,i<20?{right:true,more:true}:{});
    assert.equal(s.enemy.y,s.station.y+500);assert.equal(s.enemy.pitch,0);
    assert(Math.abs(Math.hypot(s.enemy.x-s.station.x,s.enemy.z-s.station.z)-1200)<1e-6);
    maxPatrolRange=Math.max(maxPatrolRange,B.distance(s.enemy,s.station));
  }
  assert(B.distance(origin,s.player)>100);assert(B.distance(enemyOrigin,s.enemy)>100);
  assert(maxPatrolRange<1800,`Patrol strayed ${maxPatrolRange} units`);
  assert.equal(s.shots,0);assert.equal(s.projectiles.length,0);assert.equal(s.result,null);
  for(const ship of [s.player,s.enemy]){assert.equal(ship.hull,100);assert.equal(ship.torpedoes,24);assert(Object.values(ship.shields).every(v=>v===100));}
  s.reset();assert.equal(s.freeFlight,false);assert.equal(s.turnBased,true);assert.equal(s.running,false);
});

test('free-flight weapons fire without a target lock and remain harmless with unlimited practice ammunition',()=>{
  const s=new B.Simulation();s.startFreeFlight();
  Object.assign(s.player,{x:50000,y:50000,z:50000,heading:73,pitch:22,capacitor:0,heat:100,torpedoes:0});
  s.player.integrity.weapons=0;
  s.resolveWeaponHit=()=>{throw new Error('practice shots must not resolve hull collisions');};
  const player=JSON.stringify({hull:s.player.hull,shields:s.player.shields}),enemy=JSON.stringify({hull:s.enemy.hull,shields:s.enemy.shields,integrity:s.enemy.integrity});
  assert.equal(s.contact,false);assert.equal(s.status('phaser'),'READY');assert.equal(s.status('torpedo'),'READY');
  assert.equal(s.fire('phaser'),true);assert.equal(s.fire('torpedo'),true);
  assert(s.events.some(event=>event.type==='beam'&&event.practice));assert(s.events.some(event=>event.type==='launch'&&event.practice));
  assert.equal(s.status('phaser'),'RECHARGING');assert.equal(s.fire('torpedo'),false);
  assert.equal(s.player.torpedoes,0);assert.equal(s.player.capacitor,0);
  const torpedo=s.projectiles[0],origin={...torpedo.pos},d=B.direction(s.player);
  assert.equal(torpedo.heading,73);assert.equal(torpedo.pitch,22);
  s.tick(.1);assert(Math.abs(torpedo.pos.x-origin.x-d.x*40)<1e-7);assert(Math.abs(torpedo.pos.y-origin.y-d.y*40)<1e-7);
  // Even K7 intersections are ignored by a practice torpedo.
  Object.assign(torpedo.pos,{x:s.station.x,y:s.station.y,z:s.station.z});
  for(let i=0;i<90;i++)s.tick(.1);
  assert.equal(s.projectiles.length,0);assert.equal(s.fire('phaser'),true);assert.equal(s.fire('torpedo'),true);
  assert.equal(JSON.stringify({hull:s.player.hull,shields:s.player.shields}),player);
  assert.equal(JSON.stringify({hull:s.enemy.hull,shields:s.enemy.shields,integrity:s.enemy.integrity}),enemy);
  assert.equal(s.result,null);assert(!s.events.some(event=>['impact','station-impact','destroyed'].includes(event.type)));
  s.running=false;assert.equal(s.fire('phaser'),false);assert.equal(s.status('torpedo'),'STANDING BY');
});
