const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
const weapons=['phaser','phaser','phaser','phaser','phaser','torpedo','torpedo'];
const shot=weapon=>({weapon,target:'hull',range:1000,maneuvers:[0]});
function setup(){const s=new B.Simulation();s.selectManeuver('direct',0);return s;}
test('configuration requires five phasers and two torpedoes and rejects excess weapons and slots',()=>{
  const s=setup();s.running=true;
  for(let i=0;i<6;i++){assert(s.updateStep(i,shot(weapons[i])));assert.equal(s.planReady(),false);assert.equal(s.commitOrders(),false);}
  assert.equal(s.updateStep(6,shot('phaser')),false,'sixth phaser is refused while configuring');
  assert(s.updateStep(6,shot('torpedo')));assert(s.planReady());
  const before=JSON.stringify(s.turn.draft);
  assert.equal(s.updateStep(0,shot('torpedo')),false,'third torpedo is refused');
  assert.equal(s.updateStep(7,shot('phaser')),false,'eighth slot is refused');
  assert.equal(JSON.stringify(s.turn.draft),before);assert(s.commitOrders());
});
test('commit validation rejects incomplete, sparse and directly modified over-budget drafts',()=>{
  const s=setup(),valid=weapons.map(shot);assert(s.planReady(valid));
  assert.equal(s.planReady(valid.slice(0,6)),false);
  const sparse=[...valid];delete sparse[3];assert.equal(s.planReady(sparse),false);
  assert.equal(s.planReady(valid.map((v,i)=>i===6?shot('phaser'):v)),false);
  assert.equal(s.planReady(valid.map((v,i)=>i===0?shot('torpedo'):v)),false);
  s.turn.draft=valid.map((v,i)=>i===6?shot('phaser'):v);s.running=true;assert.equal(s.commitOrders(),false);
});
test('quick plans, Best Guess and Yorktown all receive the full legal allowance',()=>{
  for(const style of ['timid','strong','aggressive','berserk','best-guess']){
    const s=setup();assert(style==='best-guess'?s.bestGuessPlan():s.applyPlanPreset(style));
    assert(s.planReady());assert.equal(s.turn.draft.length,7);
    for(const [weapon,limit] of Object.entries(B.ATTACK_BUDGET))assert.equal(s.turn.draft.filter(v=>v.weapon===weapon).length,limit);
    s.running=true;assert(s.commitOrders());
    for(const [weapon,limit] of Object.entries(B.ATTACK_BUDGET))assert.equal(s.turn.enemyOrders.filter(v=>v.weapon===weapon).length,limit);
  }
});
test('execution rejects extra phasers or torpedoes even if pending orders are injected',()=>{
  for(const side of ['player','enemy'])for(const weapon of ['phaser','torpedo']){
    const s=setup();assert(s.applyPlanPreset('strong'));s.running=true;assert(s.commitOrders());
    const ship=s[side],target=s[side==='player'?'enemy':'player'];
    s.turn.spent[side][weapon]=B.ATTACK_BUDGET[weapon];
    const orders=side==='player'?s.turn.orders:s.turn.enemyOrders;orders.unshift({...shot(weapon),status:'pending'});
    const before={ammo:ship.torpedoes,capacitor:ship.capacitor,shots:s.shots};
    assert.equal(s.status(weapon,ship,target),'TURN WEAPON BUDGET SPENT');assert.equal(s.fire(weapon,ship,target),false);
    assert.deepEqual({ammo:ship.torpedoes,capacitor:ship.capacitor,shots:s.shots},before);
  }
});
