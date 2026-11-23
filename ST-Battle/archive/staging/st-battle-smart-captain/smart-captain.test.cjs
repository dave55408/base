const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(){const s=new B.Simulation();Object.assign(s.player,{x:3000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:3000,y:0,z:-900,heading:180});return s;}
function commit(s){assert(s.randomizePlan());s.captainEnabled=true;s.running=true;assert(s.commitOrders());s.updateCaptain();}

test('captain concentrates on a visible breach and launches a finishing torpedo before phasers',()=>{
  const s=duel();for(const arc of B.arcs)s.enemy.shields[arc]=100;s.enemy.shields.fore=0;s.enemy.hull=20;
  assert(s.randomizePlan());assert.equal(s.turn.draftManeuvers[0],'direct');assert.equal(s.turn.draft[0].weapon,'torpedo');assert.equal(s.turn.draft[0].target,'hull');
  assert(s.turn.draft.every(order=>order.attackArc==='fore'));assert(s.planReady());
});

test('captain chooses a vertical approach for a weak vertical shield and avoids blocked direct approaches',()=>{
  const s=duel();s.enemy.shields.ventral=0;assert(s.randomizePlan());assert.equal(s.playerMind.arc,'ventral');assert.equal(s.turn.draftManeuver,'below');
  const k=s.station;Object.assign(s.player,{x:k.x,y:k.y,z:k.z+700,heading:0});Object.assign(s.enemy,{x:k.x,y:k.y,z:k.z-700,heading:180});for(const arc of B.arcs)s.enemy.shields[arc]=100;
  assert(s.randomizePlan());assert.notEqual(s.turn.draftManeuver,'direct');
});

test('captain cannot inspect hidden enemy condition or orders when sensors fail',()=>{
  const a=duel(),b=duel();a.player.integrity.sensors=b.player.integrity.sensors=0;a.player.repairBudget=b.player.repairBudget=0;
  Object.assign(b.enemy,{x:-20000,y:5000,z:10000,heading:75,speed:200});
  for(const s of [a,b]){
    for(const key of ['hull','shields','integrity','reactor'])Object.defineProperty(s.enemy,key,{get(){throw new Error('hidden enemy state: '+key);}});
    Object.defineProperty(s.turn,'enemyOrders',{get(){throw new Error('enemy orders are private');}});
    assert(s.randomizePlan());
  }
  assert.deepEqual(a.turn.draft,b.turn.draft);assert.deepEqual(a.turn.draftManeuvers,b.turn.draftManeuvers);
});

test('captain withdraws to repair critical damage, but does not flee a healthy ship at random',()=>{
  const s=duel();s.player.hull=20;assert(s.randomizePlan());assert.deepEqual(s.turn.draftManeuvers,['flee',null,null]);assert.deepEqual(s.turn.draft,[null,null,null]);
  s.player.hull=100;s.player.integrity.weapons=5;commit(s);assert.equal(s.player.repair,'weapons');assert.equal(Object.values(s.player.power).reduce((a,b)=>a+b,0),100);
  const healthy=duel();healthy.random=()=>.999;assert(healthy.randomizePlan());assert.notEqual(healthy.turn.draftManeuver,'flee');
});

test('captain takes an immediately available finishing shot instead of withdrawing unnecessarily',()=>{
  const s=duel();s.enemy.z=-650;s.enemy.hull=1;s.enemy.shields.fore=0;s.player.hull=15;
  assert(s.randomizePlan());assert.equal(s.turn.draftManeuver,'direct');assert.equal(s.turn.draft[0].weapon,'torpedo');assert.equal(s.turn.draft[0].range,700);
});

test('captain adapts pending shots and shields without granting ammunition, capacitor or extra attacks',()=>{
  const s=duel();commit(s);const order=s.nextOrder(),ammo=s.player.torpedoes,cap=s.player.capacitor;
  assert(order.target.startsWith('shield-'));s.enemy.shields.fore=0;s.enemy.hull=15;s.time+=1;s.updateCaptain();
  assert.equal(order.target,'hull');assert.equal(order.attackArc,'fore');assert.equal(s.player.torpedoes,ammo);assert.equal(s.player.capacitor,cap);assert.equal(s.turn.spent.player.phaser,0);
  assert.equal(Object.values(s.player.bias).reduce((a,b)=>a+b,0).toFixed(6),'100.000000');
  s.player.torpedoes=0;s.time+=1;s.updateCaptain();assert(s.turn.orders.filter(shot=>shot.weapon==='torpedo').every(shot=>shot.status==='skipped'));
});

test('captain reacts to detectable incoming torpedoes and remembers failed approaches',()=>{
  const s=duel();commit(s);s.projectiles.push({id:'incoming',target:s.player.name,pos:{x:s.player.x,y:s.player.y,z:s.player.z-300}});s.time+=1;s.updateCaptain();
  assert.equal(s.playerMind.threatId,'incoming');assert(s.playerMind.evadeUntil>s.time);assert(s.playerMind.evadeAim);
  const route=s.turn.maneuver;s.projectiles=[];s.finishPass();assert.equal(s.playerMind.failedRoutes[route],1);
  s.reset();assert.equal(s.captainEnabled,false);assert.deepEqual(s.playerMind.failedRoutes,{});
});
