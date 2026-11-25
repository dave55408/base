const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

function duel(seed=97){
  const s=new B.Simulation(seed);s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0});
  Object.assign(s.enemy,{x:6000,y:0,z:-900,heading:180});
  s.applyPlanPreset('strong');assert(s.commitOrders());return s;
}

test('engagement personalities vary, stay fixed during combat, and repeat for the same seed',()=>{
  const personalities=new Set();
  for(let i=1;i<=40;i++){
    const seed=Math.imul(i,2654435761)>>>0,a=duel(seed),b=duel(seed);
    assert.equal(a.enemyPersonality,b.enemyPersonality);assert.deepEqual(a.turn.enemyOrders,b.turn.enemyOrders);
    personalities.add(a.enemyPersonality);const original=a.enemyPersonality;
    for(let t=10;t<=50;t+=10){a.time=t;a.thinkEnemy();assert.equal(a.enemyPersonality,original);}
  }
  assert.deepEqual([...personalities].sort(),Object.keys(B.ENEMY_PERSONALITIES).sort());
  const s=duel(),seen=new Set([s.enemyPersonality]);for(let i=0;i<30;i++){s.reset();seen.add(s.enemyPersonality);}
  assert(seen.size>1);
});

test('a manual personality updates tactics without restoring resources or spent attacks',()=>{
  const s=duel();s.turn.enemyOrders[0].status='hit';s.turn.spent.enemy.phaser=1;
  s.enemy.cooldown.phaser=1.2;s.enemy.capacitor=63;s.enemy.torpedoes=19;
  const fired=JSON.stringify(s.turn.enemyOrders[0]);
  for(const personality of Object.keys(B.ENEMY_PERSONALITIES)){
    assert(s.setEnemyPersonality(personality));assert.equal(s.enemyPersonality,personality);
    assert.equal(s.enemy.cooldown.phaser,1.2);assert.equal(s.enemy.capacitor,63);assert.equal(s.enemy.torpedoes,19);
    assert.equal(s.turn.spent.enemy.phaser,1);assert.equal(JSON.stringify(s.turn.enemyOrders[0]),fired);
    assert.equal(s.turn.enemyOrders.length,3);
  }
  const state=JSON.stringify(s.enemyMind),seed=s.seed;
  assert.equal(s.setEnemyPersonality('invalid'),false);assert.equal(s.setEnemyPersonality('random'),false);
  assert.equal(JSON.stringify(s.enemyMind),state);assert.equal(s.seed,seed);
  s.result='victory';assert.equal(s.setEnemyPersonality('aggressive'),false);
});

test('a new engagement picks randomly again instead of retaining a manual override',()=>{
  const a=new B.Simulation(97),b=new B.Simulation(97);
  assert(a.setEnemyPersonality('hunter'));a.seed=b.seed;
  a.reset();b.reset();assert.equal(a.enemyPersonality,b.enemyPersonality);assert.equal(a.seed,b.seed);
});

test('personalities produce different preferred ranges and target habits',()=>{
  const sampled={};
  for(const personality of Object.keys(B.ENEMY_PERSONALITIES)){
    const s=duel(24680);s.enemyPersonality=personality;
    const targets={},styles={},ranges=[];
    for(let i=0;i<600;i++){
      s.time=i*11;s.enemyMind.nextTactic=-1;
      const plan=s.planEnemy();ranges.push(plan[0].range);
      const m=s.enemyMind;targets[m.preferredTarget]=(targets[m.preferredTarget]||0)+1;styles[m.style]=(styles[m.style]||0)+1;
    }
    sampled[personality]={targets,styles,range:ranges.reduce((a,b)=>a+b,0)/ranges.length};
  }
  assert(sampled.cautious.range>sampled.aggressive.range*1.3);
  assert(sampled.aggressive.styles.press>sampled.aggressive.styles.flank);
  assert(sampled.flanker.styles.flank>sampled.flanker.styles.press);
  assert(sampled.cautious.styles.standoff>sampled.cautious.styles.press);
  assert(sampled.hunter.targets.mainEngines>sampled.hunter.targets.hull*3);
});

test('tactical choices change only on a decision interval and preserve spent shots and cooldowns',()=>{
  const s=duel(),orders=s.turn.enemyOrders,first=s.planEnemy(),seed=s.seed;
  assert.deepEqual(s.planEnemy(),first);assert.equal(s.seed,seed,'rendering or inspecting a plan must not reroll it');
  orders[0].status='hit';s.turn.spent.enemy.phaser=1;s.enemy.cooldown.phaser=1.2;s.enemy.capacitor=63;
  const spent={...orders[0]},styles=new Set(),plans=new Set();
  for(let i=0;i<40;i++){
    s.time=i*11;s.thinkEnemy();styles.add(s.enemyMind.style);
    plans.add(JSON.stringify(orders.slice(1).map(order=>[order.target,order.range,order.attackArc])));
    assert.deepEqual(orders[0],spent);assert.equal(s.turn.spent.enemy.phaser,1);
    assert.equal(s.enemy.cooldown.phaser,1.2);assert.equal(s.enemy.capacitor,63);assert.equal(orders.length,3);
    for(const order of orders){assert(s.validStep(order));assert(order.range<=B.weaponSpecs[order.weapon].maxRange);}
    assert(Math.abs(Object.values(s.enemy.power).reduce((a,b)=>a+b,0)-100)<1e-8);
  }
  assert(styles.size>1);assert(plans.size>1);
});

test('random flanking selects only comparably strong shield approaches',()=>{
  const s=duel();s.enemyMind.style='flank';
  Object.assign(s.player.shields,{fore:100,port:0,starboard:100,aft:100,dorsal:100,ventral:100});
  for(const roll of [0,.25,.5,.99]){s.enemyMind.arcRoll=roll;assert.equal(s.enemyAttackArc(),'port');}
});

test('random targeting respects sensors and still exploits severe damage and critical hull',()=>{
  const s=duel();s.enemyPersonality='aggressive';s.enemyMind.preferredTarget='engines';
  s.player.integrity.weapons=20;s.player.shields.fore=0;
  assert.equal(s.planEnemy()[0].target,'weapons');
  s.player.hull=20;assert.equal(s.planEnemy()[0].target,'hull');
  s.enemy.integrity.sensors=0;s.time=20;
  assert(s.planEnemy().every(order=>order.target==='hull'&&order.attackArc===null));
});

test('engine hunter holds one warp engine through shield changes and switches only after detachment',()=>{
  const s=duel();s.setEnemyPersonality('hunter');
  Object.assign(s.player.shields,{port:40,starboard:80});s.enemyMind.warpEngineSide=null;
  assert.equal(s.enemyWarpEngineSide(),'port');
  assert(s.planEnemy().every(o=>o.attackArc==='port'&&o.target===(o.weapon==='phaser'?'shield-port':'mainEngines')));
  Object.assign(s.player.shields,{port:100,starboard:0});s.player.integrity.weapons=10;s.player.hull=30;
  s.time+=12;s.thinkEnemy();assert.equal(s.enemyWarpEngineSide(),'port');assert.equal(s.enemyInternalTarget(),'mainEngines');
  for(const arc of B.arcs)s.player.shields[arc]=0;
  s.turn.enemyOrders[0].status='hit';s.turn.spent.enemy.phaser=1;s.enemy.cooldown.phaser=1.2;
  const spent={...s.turn.enemyOrders[0]};
  const hit=side=>({pylonSide:side,component:'mainEngines',point:{x:0,y:0,z:0}});
  s.damage(s.player,s.enemy,1,'phaser','mainEngines',hit('port'));
  assert.equal(s.enemyWarpEngineSide(),'starboard');
  assert(s.turn.enemyOrders.slice(1).every(o=>o.attackArc==='starboard'&&o.target==='mainEngines'));
  assert.deepEqual(s.turn.enemyOrders[0],spent);assert.equal(s.turn.spent.enemy.phaser,1);assert.equal(s.enemy.cooldown.phaser,1.2);
  s.damage(s.player,s.enemy,1,'phaser','mainEngines',hit('starboard'));
  assert.equal(s.enemyWarpEngineSide(),null);assert.notEqual(s.enemyInternalTarget(),'mainEngines');
  s.player.hull=100;s.player.integrity.mainEngines=50;s.player.integrity.weapons=100;s.enemyMind.preferredTarget='mainEngines';
  assert.notEqual(s.enemyInternalTarget(),'mainEngines','missing nacelles cannot become a weak-system target after repairs');
});

test('engine hunter requires detailed sensor contact for precise warp targeting',()=>{
  const s=duel();s.setEnemyPersonality('hunter');const side=s.enemyWarpEngineSide();assert(side);
  s.enemy.integrity.sensors=0;
  assert.equal(s.enemyWarpEngineSide(),null);
  assert(s.planEnemy().every(o=>o.target==='hull'&&o.attackArc===null));
  assert.equal(s.enemyMind.warpEngineSide,side,'sensor loss preserves the last observed focus');
  s.enemy.integrity.sensors=100;assert.equal(s.enemyWarpEngineSide(),side);
  s.setEnemyPersonality('aggressive');assert.equal(s.enemyWarpEngineSide(),null);
});

test('cautious captains retreat earlier while critical Enterprise damage still takes priority',()=>{
  for(const [personality,retreat] of [['aggressive',false],['cautious',true]]){
    const s=duel();s.enemyPersonality=personality;s.enemy.hull=30;s.fire=()=>false;s.tick(.05);
    assert.equal(s.enemyRetreating,retreat);
  }
  const s=duel();s.enemyPersonality='cautious';s.enemy.hull=30;s.player.hull=20;s.fire=()=>false;s.tick(.05);
  assert.equal(s.enemyRetreating,false);assert.equal(s.enemy.tactic,'PRESSING ATTACK');
});

test('weapon damage rolls stay within ten percent, vary across seeds, and reproduce',()=>{
  const rolls=new Set();
  for(let i=1;i<=160;i++)for(const side of ['player','enemy']){
    const seed=Math.imul(i,2654435761)>>>0,a=new B.Simulation(seed),b=new B.Simulation(seed);
    for(const s of [a,b]){
      const target=s[side],source=side==='player'?s.enemy:s.player;
      s.damage(target,source,10,'phaser','hull');
      const impact=s.events.findLast(event=>event.type==='impact');
      assert(impact.damageRoll>=.9&&impact.damageRoll<=1.1);assert(impact.amount>=9&&impact.amount<=11);
      rolls.add(impact.damageRoll);
    }
    assert.deepEqual(a.player,b.player);assert.deepEqual(a.enemy,b.enemy);
  }
  assert(rolls.size>100);
});

test('breach failures are occasional, bounded, recover automatically, and cannot chain immediately',()=>{
  const s=duel(),e=s.enemy,arc=B.facing(e,s.player);s.random=()=>0;e.shields[arc]=0;
  s.damage(e,s.player,2,'torpedo','weapons',{component:'weapons'});
  const failure=s.events.find(event=>event.type==='system-failure');assert(failure);assert.equal(failure.system,'weapons');
  assert.equal(s.output(e,'weapons'),0);assert.equal(s.status('phaser',e,s.player),'WEAPONS OFFLINE');
  s.running=false;const pausedAt=s.time;s.tick(.1);assert.equal(s.time,pausedAt);assert.equal(s.output(e,'weapons'),0);s.running=true;
  s.damage(e,s.player,2,'torpedo','weapons',{component:'weapons'});
  assert.equal(s.events.filter(event=>event.type==='system-failure').length,1);
  s.time=failure.until-.05;s.fire=()=>false;s.tick(.1);
  assert(s.output(e,'weapons')>0);assert(s.events.some(event=>event.type==='system-restored'&&event.system==='weapons'));
  assert(s.replayRecording.record.events.some(({event})=>event.type==='system-failure'));
  s.reset();assert.equal(s.enemy.systemFailures,undefined);
  let failures=0;
  for(let i=1;i<=600;i++){
    const sim=new B.Simulation(Math.imul(i,2654435761)>>>0),target=sim.enemy;
    target.shields[B.facing(target,sim.player)]=0;sim.damage(target,sim.player,2,'torpedo','weapons',{component:'weapons'});
    failures+=Number(sim.events.some(event=>event.type==='system-failure'));
  }
  assert(failures>40&&failures<110,`expected occasional failures; saw ${failures}/600`);
});

test('intact shields and free flight do not cause random subsystem failures',()=>{
  const s=new B.Simulation();s.random=()=>0;
  s.damage(s.enemy,s.player,1,'phaser','hull');assert(!s.events.some(event=>event.type==='system-failure'));
  s.startFreeFlight();const before=JSON.stringify(s.enemy),seed=s.seed;
  s.damage(s.enemy,s.player,100,'torpedo','weapons');assert.equal(JSON.stringify(s.enemy),before);assert.equal(s.seed,seed);
});

test('all four personalities can fight complete openings within normal salvo budgets',()=>{
  for(const personality of Object.keys(B.ENEMY_PERSONALITIES)){
    let shots=0;
    for(let i=1;i<=8;i++){
      const s=new B.Simulation(Math.imul(i,2654435761)>>>0,{randomStart:true,openingApproach:false});
      s.enemyPersonality=personality;s.running=true;s.applyPlanPreset('strong');assert(s.commitOrders());
      for(let t=0;t<350&&!s.result&&s.turn.phase!=='review';t++)s.tick(.1);
      for(const side of ['player','enemy']){
        assert(s.turn.spent[side].phaser<=2&&s.turn.spent[side].torpedo<=1);
        const ship=s[side];assert(Number.isFinite(ship.x+ship.y+ship.z+ship.hull));
      }
      shots+=s.turn.spent.enemy.phaser+s.turn.spent.enemy.torpedo;
    }
    assert(shots>=12,`${personality} must engage rather than endlessly reposition`);
  }
});
