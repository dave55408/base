const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
const shot=weapon=>({weapon,target:'hull',range:1500,maneuvers:[0]});
function setup(weapons=['phaser','phaser','torpedo']){
 const s=new B.Simulation();s.running=true;s.selectManeuver('direct',0);
 Object.assign(s.player,{x:3000,y:0,z:0,heading:0,pitch:0});Object.assign(s.enemy,{x:3000,y:0,z:-900,heading:180,pitch:0});
 weapons.forEach((w,i)=>assert(s.updateStep(i,shot(w))));return s;
}
test('three scheduled orders accept any weapon mix and reject incomplete or sparse plans',()=>{
 for(const weapons of [['phaser','phaser','phaser'],['torpedo','torpedo','torpedo'],['torpedo','phaser','torpedo']]){
 const s=setup(weapons);assert(s.planReady());assert(!s.planReady(s.turn.draft.slice(0,2)));
 const sparse=[...s.turn.draft];delete sparse[1];assert(!s.planReady(sparse));assert(!s.updateStep(3,shot('phaser')));assert(s.commitOrders());
 }
});
test('presets and enemy retain three scheduled shots',()=>{
 for(const style of ['timid','strong','aggressive','berserk','best-guess']){
 const s=setup();assert(style==='best-guess'?s.bestGuessPlan():s.applyPlanPreset(style));assert(s.planReady());assert(s.commitOrders());
 assert.equal(s.turn.orders.length,3);assert.equal(s.turn.enemyOrders.length,3);
 }
});
test('manual shots bypass scheduled type and spent counters without consuming scheduled orders',()=>{
 const s=setup(['torpedo','phaser','phaser']);assert(s.commitOrders());const before=JSON.stringify(s.turn.orders);
 s.turn.spent.player={phaser:12,torpedo:8};
 assert(s.fire('phaser',s.player,s.enemy,false));assert.equal(s.player.capacitor,72);assert.equal(JSON.stringify(s.turn.orders),before);
 assert(s.fire('torpedo',s.player,s.enemy,false));assert.equal(s.player.torpedoes,23);assert.equal(JSON.stringify(s.turn.orders),before);
 assert.deepEqual(s.turn.spent.player,{phaser:13,torpedo:9});
});
test('phasers cost 28 energy and manual fire respects heat, recharge and planning holds',()=>{
 const s=setup();assert.equal(s.fire('phaser',s.player,s.enemy,false),false);assert(s.commitOrders());
 s.player.capacitor=27;assert.equal(s.status('phaser',s.player,s.enemy,false),'LOW CAPACITOR');
 s.player.capacitor=28;assert(s.fire('phaser',s.player,s.enemy,false));assert.equal(s.player.capacitor,0);
 assert.equal(s.status('phaser',s.player,s.enemy,false),'RECHARGING');s.player.cooldown.phaser=0;s.player.capacitor=100;s.player.heat=90;
 assert.equal(s.status('phaser',s.player,s.enemy,false),'PHASERS OVERHEATED');
});
test('torpedo supply is finite, persists across turns and resets for a new battle',()=>{
 const s=setup();assert(s.commitOrders());
 for(let i=0;i<24;i++){s.player.cooldown.torpedo=0;s.player.capacitor=100;assert(s.fire('torpedo',s.player,s.enemy,false));}
 s.player.cooldown.torpedo=0;s.player.capacitor=100;
 assert.equal(s.status('torpedo',s.player,s.enemy,false),'MAGAZINE EMPTY');assert(!s.fire('torpedo',s.player,s.enemy,false));assert.equal(s.player.torpedoes,0);
 assert(s.endPass());assert.equal(s.player.torpedoes,0);assert(s.commitOrders());assert.equal(s.player.torpedoes,0);
 s.reset();assert.equal(s.player.torpedoes,24);
});
