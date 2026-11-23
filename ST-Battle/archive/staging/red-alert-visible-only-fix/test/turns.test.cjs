const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');
const advance=(s,n)=>{for(let i=0;i<Math.ceil(n/.05);i++)s.tick(.05);};
const plan=(target='hull',range=1000)=>[{weapon:'phaser',target,range},{weapon:'phaser',target,range},{weapon:'torpedo',target,range}];
function configure(s,steps=plan()){s.selectManeuver('direct');steps.forEach((shot,i)=>assert.equal(s.updateStep(i,shot),true));}
function duel(steps=plan()){
  const s=new B.Simulation();s.running=true;
  Object.assign(s.player,{x:2000,y:0,z:0,heading:0});Object.assign(s.enemy,{x:2000,y:0,z:-900,heading:180});
  configure(s,steps);assert.equal(s.commitOrders(),true);s.turn.enemyOrders=plan().map(v=>({...v,status:'pending'}));return s;
}
test('incomplete plans never launch; planning freezes motion and recharge, pause freezes its clock',()=>{
  const s=new B.Simulation();s.running=true;s.player.capacitor=50;const before=JSON.stringify(s.player);
  advance(s,31);assert.equal(JSON.stringify(s.player),before);assert.equal(s.time,0);assert.equal(s.turn.phase,'planning');assert.equal(s.commitOrders(),false);
  assert.equal(s.fire('phaser'),false);assert.equal(s.warp(),false);
  s.running=false;const remaining=s.turn.remaining;advance(s,2);assert.equal(s.turn.remaining,remaining);
  configure(s);s.running=true;s.tick(.05);assert.equal(s.turn.phase,'planning');assert.equal(s.commitOrders(),true);assert.equal(s.turn.phase,'approach');
});
test('three valid steps enforce a two-phaser one-torpedo budget, clearing and range limits',()=>{
  const s=new B.Simulation();assert.equal(s.planReady(),false);
  assert.equal(s.updateStep(0,{weapon:'beam',target:'hull',range:1000}),false);
  assert.equal(s.updateStep(0,{weapon:'phaser',target:'bogus',range:1000}),false);
  assert.equal(s.updateStep(0,{weapon:'phaser',target:'bridge',range:NaN}),false);
  assert.equal(s.updateStep(0,{weapon:'phaser',target:'bridge',range:1900}),false);
  assert.equal(s.updateStep(0,{weapon:'torpedo',target:'bridge',range:1900}),true);
  assert.equal(s.updateStep(1,{weapon:'torpedo',target:'hull',range:600}),false);
  assert.equal(s.clearStep(0),true);configure(s);assert.equal(s.planReady(),true);
  assert.equal(s.updateStep(2,{weapon:'phaser',target:'hull',range:800}),false);
  s.running=true;s.commitOrders();assert.equal(s.clearStep(1),false);
});
test('pending steps allow exactly two live revisions; launched torpedoes retain their aim',()=>{
  const s=duel([{weapon:'torpedo',target:'bridge',range:1000},...plan().slice(0,2)]);
  assert.equal(s.fire('phaser'),false);assert.equal(s.fire('torpedo'),true);const missile=s.projectiles[0];
  assert.equal(s.updateStep(0,{weapon:'torpedo',target:'hull',range:900}),false);
  assert.equal(s.updateStep(1,{weapon:'phaser',target:'mainEngines',range:900}),true);
  assert.equal(s.updateStep(2,{weapon:'phaser',target:'sensors',range:700}),true);
  assert.equal(s.turn.revisions,0);assert.equal(missile.targetSystem,'bridge');assert.equal(missile.order.target,'bridge');
  assert.equal(s.updateStep(2,{weapon:'phaser',target:'hull',range:700}),false);
});
test('both ships execute all three shots sequentially, respecting cooldowns and salvo limits',()=>{
  const s=duel();s.tick(.05);assert.equal(s.turn.phase,'attack');assert.equal(s.shots,1);
  assert.equal(s.turn.orders[0].status,'hit');assert.equal(s.turn.orders[1].status,'pending');
  assert.equal(s.fire('torpedo'),false);assert.equal(s.fire('phaser'),false);
  advance(s,5);assert.equal(s.shots,3);
  for(const side of ['player','enemy'])assert.deepEqual(s.turn.spent[side],{phaser:2,torpedo:1});
  assert.equal(s.player.torpedoes,23);assert.equal(s.enemy.torpedoes,23);assert.equal(s.fire('phaser'),false);
  advance(s,8.2);assert(['hit','missed','intercepted'].includes(s.turn.orders[2].status));assert.equal(s.shots,3);
});
test('each shot waits for its own range and target; selected shields, arcs, sensors and K7 gate fire',()=>{
  const s=duel(plan('hull',500));s.turn.enemyOrders=plan('hull',300).map(v=>({...v,status:'pending'}));s.tick(.05);assert.equal(s.shots,0);
  Object.assign(s.turn.orders[0],{target:'shield-aft',range:1500});s.tick(.05);assert.equal(s.shots,0);assert.equal(s.status('phaser'),'SELECTED SHIELD NOT EXPOSED');
  s.turn.orders[0].target='shield-fore';s.player.integrity.sensors=0;s.tick(.05);assert.equal(s.shots,0);
  s.player.integrity.sensors=100;s.turn.offArcSpent.player=true;s.player.heading=180;s.tick(.05);assert.equal(s.shots,0);
  s.player.heading=0;s.tick(.05);assert.equal(s.shots,1);assert.equal(s.turn.orders[1].range,500);
  const k=duel();Object.assign(k.player,{x:k.station.x,y:k.station.y,z:k.station.z+600});Object.assign(k.enemy,{x:k.station.x,y:k.station.y,z:k.station.z-600});
  k.turn.orders[0].range=1500;k.tick(.05);assert.equal(k.shots,0);
});
test('optimal weapon bands give the advertised damage bonus',()=>{
  const a=duel(),b=duel();b.turnBased=false;const arc=B.facing(a.enemy,a.player);
  a.fire('phaser');b.fire('phaser');assert(Math.abs((100-a.enemy.shields[arc])/(100-b.enemy.shields[arc])-1.15)<1e-8);
});
test('missed stages advance within one pass; projectiles resolve before final review',()=>{
  const s=duel(plan('hull',300));s.enemy.integrity.weapons=0;
  s.turn.orders.forEach(v=>v.range=300);s.player.heading=180;
  for(let stage=0;stage<3;stage++){
    assert.equal(s.turn.stageIndex,stage);s.turn.remaining=0;
    if(stage<2)advance(s,1.6);else advance(s,12);
  }
  assert(s.turn.orders.every(v=>v.status==='skipped'));assert.equal(s.turn.number,1);assert.equal(s.turn.phase,'disengage');
  s.turn.remaining=0;s.projectiles.push({id:'pending',from:s.player.name,target:s.enemy.name,pos:{x:5000,y:5000,z:5000},life:7.9,maxLife:8,strength:1,targetSystem:'hull',heading:0,pitch:0});
  s.tick(.05);assert.equal(s.turn.phase,'disengage');advance(s,.2);assert.equal(s.turn.phase,'review');assert.equal(s.projectiles.length,0);
  const before=JSON.stringify(s.player);advance(s,1);assert.equal(JSON.stringify(s.player),before);
  assert.equal(s.commitOrders(),true);assert.equal(s.turn.number,2);assert.equal(s.turn.stageIndex,0);
});
test('bridge and main-engine targets affect performance, can be repaired, and reset',()=>{
  const s=duel(),p=s.player,engine=s.output(p,'engines'),weapons=s.output(p,'weapons');s.random=()=>0;
  for(const key of ['bridge','mainEngines']){
    Object.keys(p.shields).forEach(a=>p.shields[a]=0);s.damage(p,s.enemy,50,'torpedo',key);assert(p.integrity[key]<100);
    s.repair(key);p.lastHit=-100;s.turn.phase='disengage';s.turn.remaining=20;const before=p.integrity[key];s.tick(.1);assert(p.integrity[key]>before);
  }
  p.integrity.bridge=0;assert(s.output(p,'weapons')<weapons);p.integrity.mainEngines=0;assert(s.output(p,'engines')<engine*.5);
  s.reset();assert.equal(s.turn.number,1);assert.equal(s.player.integrity.bridge,100);assert.equal(s.planReady(),false);
});
test('configured automatic passes repeat after Commit without helm input',()=>{
  const s=new B.Simulation();s.running=true;configure(s);let highest=1;
  for(let i=0;i<6000&&!s.result;i++){s.tick(.1);if(!s.maneuvering&&s.turn.remaining<=0)s.commitOrders();highest=Math.max(highest,s.turn.number);}
  assert(highest>2);assert(s.shots>=6);assert(s.enemy.hull<100||s.player.hull<100);assert(Number.isFinite(s.range));
});

test('applying edits is atomic when one edited action fires before Apply',()=>{
  const s=duel(),plan=s.turn.draft.map(v=>({...v}));plan[1].target='bridge';plan[2].target='reactor';
  advance(s,2.1);assert.notEqual(s.turn.orders[1].status,'pending');
  assert.equal(s.applyRevisions(plan),false);assert.equal(s.turn.orders[2].target,'hull');assert.equal(s.turn.revisions,2);
});

test('End pass immediately returns to planning, cancels projectiles and preserves damage and spent ammo',()=>{
  const s=duel();for(let i=0;i<200&&!s.projectiles.length;i++)s.tick(.05);
  assert(s.projectiles.length);const missiles=[...s.projectiles],player=JSON.stringify(s.player),enemy=JSON.stringify(s.enemy),time=s.time,spent=JSON.stringify(s.turn.spent);
  assert.equal(s.endPass(),true);assert.equal(s.turn.phase,'review');assert.equal(s.maneuvering,false);assert.equal(s.projectiles.length,0);
  assert.equal(JSON.stringify(s.player),player);assert.equal(JSON.stringify(s.enemy),enemy);assert.equal(s.time,time);assert.equal(JSON.stringify(s.turn.spent),spent);
  assert(missiles.every(m=>m.order.status==='cancelled'));assert.equal(s.lastReplay.endedEarly,true);assert.equal(s.lastReplay.frames.at(-1).phase,'review');
  advance(s,1);assert.equal(JSON.stringify(s.player),player);assert.equal(s.time,time);assert.equal(s.endPass(),false);
  assert.equal(s.commitOrders(),true);assert.equal(s.turn.number,2);assert.equal(s.turn.stageIndex,0);assert.equal(s.turn.endedEarly,false);
});

test('End pass works while paused during repairs, restores normal power, and cannot override a result',()=>{
  const s=new B.Simulation();assert.equal(s.endPass(),false);s.running=true;s.selectManeuver('flee');const power={...s.player.power},parts=s.player.repairBudget;
  s.commitOrders();s.running=false;assert.equal(s.endPass(),true);assert.equal(s.running,false);assert.deepEqual(s.player.power,power);assert.equal(s.player.repairBudget,parts);
  const replay=s.lastReplay;s.result='victory';assert.equal(s.endPass(),false);assert.equal(s.lastReplay,replay);assert.equal(s.result,'victory');
});
