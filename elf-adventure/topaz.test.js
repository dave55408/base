const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0];
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('Topaz and one tree start in the upper black castle dungeon in every quest mode',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,element}=scope.load();api.initial(mode);
    const s=api.state(),topaz=s.items.jewelTopaz;
    const dungeon=mode==='easy'?'nightfallInside':'blackDungeon';
    assert.equal(topaz.room,dungeon);assert.equal(topaz.treasureOwner,undefined);
    assert.equal(topaz.x,772);assert.equal(topaz.y,495);
    assert.equal(s.items.blackKey.room,dungeon);
    assert.equal(s.items.blackKey.x,820);assert.equal(s.items.blackKey.y,530);
    assert(!api.blocked(dungeon,820,530,true),'black key corner stays accessible');
    assert(api.blocked(dungeon,300,220,true),'moved tree blocks its trunk in the upper-left');
    assert(!api.blocked(dungeon,340,320,true),'old tree location stays clear');
    for(const x of [340,620])assert(api.blocked('blackInside',x,320,true),'hall trees block their trunks');
    assert(!api.blocked('blackInside',480,320,true),'central hall route stays clear');
    assert.equal(api.blocked(topaz.room,topaz.x,topaz.y,true),false);
    s.mode='playing';s.room=dungeon;s.held=null;s.pickupDelay=0;
    Object.assign(s.player,{x:topaz.x,y:topaz.y});
    assert.equal(api.sceneFrame().rings.length,0,'Topaz has no protection barrier');
    api.pickup();assert.equal(s.held,'jewelTopaz');assert.equal(element('itemName').textContent,'Topaz');
  }
});

test('all seven jewels including Topaz are required to win',()=>{
  const {api,element}=scope.load();api.initial('gold');
  const s=api.state();s.mode='playing';s.room='goldInside';s.dragons=[];s.elves=[];s.bat.room='absent';
  const ids=Object.keys(s.items).filter(id=>id.startsWith('jewel'));assert.equal(ids.length,7);
  for(const id of ids.filter(id=>id!=='jewelTopaz'))s.items[id]={room:'goldInside',x:700,y:400};
  api.update(0);assert.equal(s.mode,'playing');assert.equal(api.returnedJewelCount(),6);
  s.items.jewelTopaz={room:'goldInside',x:800,y:400};api.update(0);
  assert.equal(s.mode,'winning');assert.equal(api.returnedJewelCount(),7);
});
