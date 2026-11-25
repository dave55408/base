const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
test('quick plans have distinct tactical routes and a full legal weapon allowance without spending resources',()=>{
  const sim=new B.Simulation(),before=JSON.stringify([sim.player,sim.enemy]),plans={};
  for(const style of ['timid','disabling','strong','aggressive','berserk']){
    assert(sim.applyPlanPreset(style));assert(sim.planReady());
    const t=sim.turn;assert.equal(t.draftManeuvers.length,2);assert.equal(t.draft.filter(shot=>shot.weapon==='phaser').length,2);assert.equal(t.draft.filter(shot=>shot.weapon==='torpedo').length,1);
    const eligible=['timid','berserk'].includes(style)?[0]:[0,1];
    for(const shot of t.draft){assert(sim.validStep(shot));assert.deepEqual(shot.maneuvers,eligible,'attacks use only the offensive stages of the two-maneuver strategy');}
    plans[style]=JSON.parse(JSON.stringify(t));
  }
  assert.deepEqual(plans.timid.draftManeuvers,['distance','flee']);assert(plans.timid.draft.every(shot=>shot.range>=1200));
  assert.deepEqual(plans.disabling.draftManeuvers,['flank','behind']);
  assert.deepEqual(plans.disabling.draft.map(shot=>[shot.weapon,shot.target]),[['phaser','weapons'],['phaser','weapons'],['torpedo','engines']]);
  assert.deepEqual(plans.strong.draftManeuvers,['flank','distance']);assert(plans.strong.draft.every(shot=>shot.range>=1000));
  assert.deepEqual(plans.aggressive.draftManeuvers,['direct','flank']);assert.equal(plans.aggressive.draft[2].target,'reactor');assert.deepEqual(plans.aggressive.draft.map(shot=>shot.range),[1000,900,700]);
  assert.deepEqual(plans.berserk.draftManeuvers,['direct','ram']);assert(plans.berserk.draft.every(shot=>shot.range<=500));assert(plans.berserk.draft.every(shot=>shot.maneuvers.every(i=>i<2)),'all attacks precede the ram');
  assert.equal(JSON.stringify([sim.player,sim.enemy]),before);
  const draft=JSON.stringify(sim.turn);assert.equal(sim.applyPlanPreset('unknown'),false);assert.equal(JSON.stringify(sim.turn),draft);
  sim.running=true;assert(sim.commitOrders());assert.equal(sim.applyPlanPreset('timid'),false);
  sim.reset();sim.startFreeFlight();assert.equal(sim.applyPlanPreset('strong'),false);
});
