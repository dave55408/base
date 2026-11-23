const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
test('two ordinary phaser hits collapse a fresh shield sector on either ship',()=>{
  for(const side of ['player','enemy']){
    const s=new B.Simulation(),target=s[side],source=s[side==='player'?'enemy':'player'],arc=B.facing(target,source);
    s.damage(target,source,18,'phaser','weapons');assert(target.shields[arc]>0);
    s.damage(target,source,18,'phaser','weapons');assert.equal(target.shields[arc],0);
    assert(Object.entries(target.shields).filter(([key])=>key!==arc).every(([,value])=>value===100));
  }
});
test('weak shields leak sooner and a shield-breaking hit can damage systems immediately',()=>{
  for(const shield of [35,50]){
    const s=new B.Simulation(),target=s.enemy,arc=B.facing(target,s.player);target.shields[arc]=shield;
    s.damage(target,s.player,20,'phaser','engines',{component:'engines'});
    assert(target.hull<100);assert(target.integrity.engines<100);
    assert(target.reactor<100);if(shield===50)assert.equal(target.shields[arc],0);
  }
});
test('reactor hits cause hull-equivalent output loss plus power-conduit damage',()=>{
  const s=new B.Simulation(),target=s.enemy,arc=B.facing(target,s.player);target.shields[arc]=0;
  s.damage(target,s.player,30,'torpedo','reactor',{component:'reactor'});
  const hullLoss=100-target.hull,reactorLoss=100-target.reactor;
  assert(hullLoss>0);assert(Math.abs(reactorLoss-hullLoss*1.12)<1e-8);
});
test('quiet shield regeneration is slower while remaining responsive to shield allocation',()=>{
  const s=new B.Simulation(97,{turnBased:false});s.running=true;s.aiShot=s.aiTorp=999;
  s.player.shields.fore=0;s.player.lastHit=-100;
  for(let i=0;i<10;i++)s.tick(.1);
  assert(s.player.shields.fore>1.2&&s.player.shields.fore<1.4);
});
