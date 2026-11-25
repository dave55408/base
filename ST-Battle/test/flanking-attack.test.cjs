const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function plan(side,heading=0){
  const s=new B.Simulation(97);s.running=true;
  Object.assign(s.enemy,{x:6000,y:0,z:0,heading:0});Object.assign(s.player,{x:6000+side*1200,y:0,z:900,heading,pitch:0});
  s.selectManeuver('flank',0);for(let i=0;i<3;i++)s.updateStep(i,{weapon:'phaser',target:'hull',range:1000,maneuvers:[0]});
  assert(s.commitOrders());return s;
}
test('one listed flanking maneuver replaces both curving choices and is used by presets',()=>{
  const keys=Object.keys(B.maneuvers);assert.equal(keys.length,11);assert(keys.includes('flank'));assert(!keys.includes('port'));assert(!keys.includes('starboard'));
  for(const preset of ['strong','disabling']){const s=new B.Simulation(97);assert(s.applyPlanPreset(preset));assert.equal(s.turn.draftManeuvers[0],'flank');assert(s.planReady());}
});
test('flanking picks Yorktowns nearer side but commands Enterprise relative to its own heading',()=>{
  for(const side of [-1,1])for(const heading of [0,90,180,270]){
    const s=plan(side,heading),n=s.turn.navigation;
    assert.equal(n.flankSide,side<0?'port':'starboard');
    const angle=B.delta(s.player.heading,B.bearing(s.player,n.waypoint));
    assert.equal(n.flankTurn,Math.abs(angle)<3?'direct':angle<0?'port':'starboard');
    if(heading===0)assert.equal(n.flankTurn,side<0?'starboard':'port','the order describes Enterprise turning inward toward the nearer flank');
    const chosen=n.flankSide,waypoint={...n.waypoint};s.enemy.x+=side*3000;s.autoHelm(.05);
    assert.equal(n.flankSide,chosen);assert.deepEqual(n.waypoint,waypoint,'the committed approach does not flip sides as Yorktown moves');
  }
});
