const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function setup(){
  const s=new B.Simulation();s.random=()=>.5;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0});
  Object.assign(s.enemy,{x:6000,y:0,z:-800,heading:180,pitch:0});return s;
}
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('both ships take identical damage under identical Captain-difficulty conditions',()=>{
  const results=[];
  for(const side of ['player','enemy']){
    const s=setup(),target=s[side],source=side==='player'?s.enemy:s.player;
    target.shields[B.facing(target,source)]=0;s.damage(target,source,38,'torpedo','weapons',{component:'weapons'});
    results.push({hull:target.hull,weapons:target.integrity.weapons,reactor:target.reactor,shield:target.shields[B.facing(target,source)]});
  }
  assert.deepEqual(results[0],results[1]);
});

test('fresh shields still absorb a torpedo while weak and exposed facings punish mistakes',()=>{
  const losses=[];
  for(const shield of [100,20,0]){
    const s=setup();s.enemy.shields.fore=shield;s.damage(s.enemy,s.player,38,'torpedo','hull');losses.push(100-s.enemy.hull);
  }
  assert.equal(losses[0],0);assert(losses[1]>10);assert(losses[2]>losses[1]);assert(losses[2]<25,'one exposed hit remains survivable');
});

test('rotating a breached facing away prevents the same attack from damaging hull',()=>{
  const exposed=setup(),rotated=setup();
  for(const s of [exposed,rotated])s.enemy.shields.fore=0;
  rotated.enemy.heading=90;
  for(const s of [exposed,rotated])s.damage(s.enemy,s.player,38,'torpedo','hull');
  assert(exposed.enemy.hull<80);assert.equal(rotated.enemy.hull,100);
});

test('exposed hull damage increases fifty percent but internal damage only twenty percent',()=>{
  const s=setup();s.enemy.shields.fore=0;
  s.damage(s.enemy,s.player,10,'phaser','hull',{component:'weapons'});
  const previousHullDamage=10*1.15*.65*.18*1.35;
  close(100-s.enemy.hull,previousHullDamage*1.5);
  close(100-s.enemy.integrity.weapons,previousHullDamage*1.2*1.8);
  const partial=setup();partial.enemy.shields.fore=30;
  partial.damage(partial.enemy,partial.player,10,'phaser','hull');
  close(100-partial.enemy.hull,10*(.65+10/80)*.65*.18*1.35*1.15);
});

test('concentrating an equal salvo on one shield is more effective than spreading it over fresh facings',()=>{
  const concentrated=setup(),scattered=setup();
  for(const [i,weapon] of ['phaser','phaser','torpedo'].entries()){
    const amount=weapon==='phaser'?20:38;
    scattered.enemy.heading=180+i*90;
    for(const s of [concentrated,scattered])s.damage(s.enemy,s.player,amount,weapon,'hull');
  }
  assert(concentrated.enemy.hull<80);assert.equal(scattered.enemy.hull,100);
});

test('shield recovery remains useful when power and recharge bias reinforce the threatened facing',()=>{
  function recovered(reinforced){
    const s=new B.Simulation(97,{turnBased:false});s.running=true;s.fire=()=>false;s.player.fullStop=true;
    s.player.shields.fore=0;s.player.lastHit=-100;s.player.repairBudget=0;
    if(reinforced){B.redistribute(s.player.power,'shields',60);B.redistribute(s.player.bias,'fore',55);}
    for(let i=0;i<10;i++)s.tick(.1);return s.player.shields.fore;
  }
  const normal=recovered(false),reinforced=recovered(true);
  assert(normal>.9&&normal<1.2);assert(reinforced>normal*3);
});
