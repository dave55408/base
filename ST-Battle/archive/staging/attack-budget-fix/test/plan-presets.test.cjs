const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
test('quick plans have distinct tactical routes and a full legal weapon allowance without spending resources',()=>{
  const sim=new B.Simulation(),before=JSON.stringify([sim.player,sim.enemy]),plans={};
  for(const style of ['timid','strong','aggressive','berserk']){
    assert(sim.applyPlanPreset(style));assert(sim.planReady());
    const t=sim.turn;assert.equal(t.draftManeuvers.length,3);assert.equal(t.draft.filter(shot=>shot.weapon==='phaser').length,5);assert.equal(t.draft.filter(shot=>shot.weapon==='torpedo').length,2);
    for(const shot of t.draft){assert(sim.validStep(shot));assert(shot.maneuvers.every(i=>t.draftManeuvers[i]!=='flee'));}
    plans[style]=JSON.parse(JSON.stringify(t));
  }
  assert.deepEqual(plans.timid.draftManeuvers,['distance','hide','flee']);assert(plans.timid.draft.every(shot=>shot.range>=1200));
  assert.deepEqual(plans.strong.draftManeuvers,['port','distance','chase']);assert(plans.strong.draft.every(shot=>shot.range>=1000));
  assert.deepEqual(plans.aggressive.draftManeuvers,['direct','close','chase']);assert.equal(plans.aggressive.draft[2].target,'reactor');assert.equal(plans.aggressive.draft[2].range,650);
  assert.deepEqual(plans.berserk.draftManeuvers,['direct','close','ram']);assert(plans.berserk.draft.every(shot=>shot.range<=500));assert(plans.berserk.draft.every(shot=>shot.maneuvers.every(i=>i<2)),'all attacks precede the ram');
  assert.equal(JSON.stringify([sim.player,sim.enemy]),before);
  const draft=JSON.stringify(sim.turn);assert.equal(sim.applyPlanPreset('unknown'),false);assert.equal(JSON.stringify(sim.turn),draft);
  sim.running=true;assert(sim.commitOrders());assert.equal(sim.applyPlanPreset('timid'),false);
  sim.reset();sim.startFreeFlight();assert.equal(sim.applyPlanPreset('strong'),false);
});
