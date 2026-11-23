const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
function duel(range=900){
  const s=new B.Simulation();s.running=true;s.selectManeuver('direct');
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:0,z:-range,heading:180});
  ['phaser','phaser','torpedo','phaser','phaser','phaser','torpedo'].forEach((weapon,i)=>s.updateStep(i,{weapon,target:'hull',range:1000}));s.commitOrders();return s;
}
test('Yorktown exploits an observed breach with a torpedo first and aims at vulnerable internal systems',()=>{
  const s=duel();s.player.shields.fore=0;s.player.integrity.weapons=35;
  const plan=s.planEnemy();assert.equal(plan[0].weapon,'torpedo');assert.equal(plan[0].target,'weapons');assert.equal(plan[0].attackArc,'fore');
  assert.equal(plan.filter(v=>v.weapon==='phaser').length,5);assert.equal(plan.filter(v=>v.weapon==='torpedo').length,2);
  s.player.hull=20;assert.equal(s.planEnemy()[0].target,'hull');
});
test('captain cannot read the player plan or fire precisely with failed sensors',()=>{
  const s=duel(),first=s.planEnemy();s.turn.draftManeuvers=['hide','above','flee'];s.turn.draft[0].target='reactor';assert.deepEqual(s.planEnemy(),first);
  s.enemy.integrity.sensors=0;s.enemyMind.lastKnown=null;const blind=s.planEnemy();assert(blind.every(v=>v.target==='hull'&&v.attackArc===null));
  s.turn.enemyOrders=blind.map(v=>({...v,status:'pending'}));assert.equal(s.status('phaser',s.enemy,s.player),'SENSOR LOCK LOST');assert.equal(s.fire('phaser',s.enemy,s.player),false);
});
test('lost sensor contact uses a last-known track instead of hidden player movement',()=>{
  const s=duel();s.rememberEnemyContact();s.enemy.integrity.sensors=0;s.time=2;const tracked=s.enemyTrack();
  s.player.x+=4000;s.player.y+=900;assert.deepEqual(s.enemyTrack(),tracked);assert.notEqual(s.enemyTrack().x,s.player.x);
});
test('captain shifts power from pursuit to attack and reinforces the threatened shield within shared budgets',()=>{
  const s=duel(1800),original={...s.player.power};s.thinkEnemy();assert.equal(s.enemy.tactic,'PURSUING');const cruise=s.enemy.power.engines;
  s.enemy.z=-600;s.time=1;s.thinkEnemy();assert.equal(s.enemy.tactic,'ATTACKING');assert(s.enemy.power.engines<cruise);assert(s.enemy.power.weapons>30);
  s.enemy.shields.fore=10;s.time=2;s.thinkEnemy();assert.equal(s.enemy.tactic,'DEFENSIVE');assert.equal(s.enemy.bias.fore,55);
  assert(Math.abs(Object.values(s.enemy.power).reduce((a,b)=>a+b,0)-100)<1e-8);assert(Math.abs(Object.values(s.enemy.bias).reduce((a,b)=>a+b,0)-100)<1e-8);assert.deepEqual(s.player.power,original);
});
test('captain reacts to visible incoming torpedoes and prioritizes restoring a failed sensor lock',()=>{
  const s=duel(),e=s.enemy;s.projectiles.push({id:'incoming',from:s.player.name,target:e.name,pos:{x:e.x,y:e.y,z:e.z+200}});
  s.thinkEnemy();assert(s.enemyMind.evadeUntil>s.time);assert(s.enemyMind.evadeAim);assert.equal(e.tactic,'DEFENSIVE');assert.equal(e.torpedoes,24);
  e.integrity.sensors=0;s.enemyMind.evadeUntil=0;s.enemyMind.threatId=null;s.time=1;s.thinkEnemy();assert.equal(e.repair,'sensors');assert.equal(s.enemyMind.evadeUntil,0);
});
test('live target updates exploit new breaches without adding shots or resetting cooldowns',()=>{
  const s=duel();s.turn.enemyOrders[0].status='hit';s.turn.spent.enemy.phaser=1;s.enemy.cooldown.phaser=1.2;s.enemy.capacitor=63;
  s.player.shields.fore=0;s.player.hull=20;s.thinkEnemy();assert.equal(s.nextOrder(s.enemy).target,'hull');assert.equal(s.nextOrder(s.enemy).attackArc,'fore');
  assert.equal(s.enemy.cooldown.phaser,1.2);assert.equal(s.enemy.capacitor,63);assert.equal(s.turn.spent.enemy.phaser,1);assert.equal(s.turn.enemyOrders.length,7);
});
test('a retreating captain can repair using finite parts and re-engage after stabilizing',()=>{
  const s=duel();s.player.integrity.weapons=0;s.player.repairBudget=0;s.enemy.hull=24;
  for(let i=0;i<430&&!s.result;i++)s.tick(.1);
  assert(s.enemy.hull>=35);assert(s.enemy.repairBudget<30);assert(s.enemy.repairBudget>=0);assert.equal(s.enemyRetreating,false);
  assert(s.turn.spent.enemy.phaser<=5&&s.turn.spent.enemy.torpedo<=2);
});

test('Yorktown retreats for at most ten seconds and returns on a different maneuver after each retreat',()=>{
  const s=duel();s.player.integrity.weapons=0;s.player.repairBudget=0;s.enemy.hull=24;s.enemy.repairBudget=0;
  for(let i=0;i<95;i++)s.tick(.1);
  assert.equal(s.enemyRetreating,true);assert.equal(s.enemyMind.returnManeuver,undefined);
  const time=s.time;s.running=false;for(let i=0;i<200;i++)s.tick(.1);assert.equal(s.time,time,'pause does not consume the retreat timer');s.running=true;
  for(let i=0;i<10;i++)s.tick(.1);
  assert.equal(s.enemyRetreating,false);const first=s.enemyMind.returnManeuver;assert(['port','starboard','above','below','behind'].includes(first));
  const due=s.enemyMind.reengageUntil;
  for(let i=0;i<100;i++)s.tick(.1);assert.equal(s.enemyRetreating,false,'critical hull cannot immediately restart its retreat');
  while(s.time<due+10.5&&!s.result)s.tick(.1);
  assert.equal(s.enemyRetreating,false);assert.notEqual(s.enemyMind.returnManeuver,first);
  assert(s.turn.spent.enemy.phaser<=5&&s.turn.spent.enemy.torpedo<=2,'returning preserves the existing weapon budget');
  s.reset();assert.equal(s.enemyMind.returnManeuver,undefined);assert.equal(s.enemyMind.runAwaySince,undefined);
});

test('Yorktown also turns back after ten seconds of pulling away with an exhausted plan',()=>{
  const s=duel();s.player.integrity.weapons=0;s.player.repairBudget=0;
  for(const order of s.turn.enemyOrders)order.status='hit';
  Object.assign(s.turn.spent.enemy,{phaser:2,torpedo:1});
  for(let i=0;i<110;i++)s.tick(.1);
  assert.equal(s.enemyRetreating,false);assert(s.enemyMind.returnManeuver);assert(s.enemyMind.reengageUntil>s.time);
  assert.equal(s.nextOrder(s.enemy),undefined);assert.deepEqual(s.turn.spent.enemy,{phaser:2,torpedo:1});
});
