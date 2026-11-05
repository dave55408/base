const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0];
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);
function setup(){
  const {api}=scope.load();api.initial('gold');const s=api.state();
  s.mode='playing';s.elves=[];s.bat.room='absent';s.bat.carryingDragon=null;
  const d=s.dragons.find(d=>d.name==='Vesper');s.dragons=[d];
  return {api,s,d,key:s.items.whiteKey};
}
test('Vesper chases out of the Hollow, then returns to the white key while the player stays away',()=>{
  const {api,s,d,key}=setup();s.room='stone';
  Object.assign(s.player,{x:480,y:320});
  Object.assign(d,{x:794.4,y:55,follow:[{to:'stone',exit:{x:794.4,y:55},entry:{x:794.4,y:585}}]});
  api.updateDragons(.02);assert.equal(d.room,'stone','follows the player out');
  for(let n=0;n<305;n++)api.updateDragons(.02);
  assert(d.returningToKey,'returns after a brief pursuit');
  for(let n=0;n<6000&&!(d.room==='mosswoodHollow'&&!d.returningToKey);n++)api.updateDragons(.02);
  assert.equal(d.room,'mosswoodHollow');assert.equal(d.follow.length,0);
  assert(Math.hypot(d.x-(key.x+24),d.y-(key.y-26))<=8,'returns to the guard post');
});
test('Vesper attacks nearby and chases a distant player within the Hollow',()=>{
  const {api,s,d}=setup();s.room=d.room;
  Object.assign(s.player,{x:d.x-20,y:d.y});api.updateDragons(.02);
  assert(d.biting,'nearby intruder triggers a bite');
  Object.assign(s.player,{x:790,y:60});api.updateDragons(.02);
  assert(!d.biting);assert.equal(d.navigationGoal.x,s.player.x);assert.equal(d.navigationGoal.y,s.player.y);
});
test('taking the white key restores normal pursuit',()=>{
  const {api,s,d}=setup();s.room=d.room;s.items.whiteKey.room='held';s.held='whiteKey';
  Object.assign(s.player,{x:790,y:60});
  api.teleportToRoom('stone');assert(d.follow.length>0);
  api.updateDragons(.02);assert(d.follow.length>0,'Vesper keeps pursuing once the key is taken');
});
test('removing the key during a return cancels the return',()=>{
  const {api,s,d}=setup();s.room=d.room;d.returningToKey=true;d.keyPursuitTime=6;
  s.items.whiteKey.room='bat';s.bat.carrying='whiteKey';s.bat.room='stone';
  Object.assign(s.player,{x:790,y:60});api.updateDragons(.02);
  assert.equal(d.returningToKey,false);assert.equal(d.keyPursuitTime,0);
  assert.equal(d.navigationGoal.x,s.player.x);
});
