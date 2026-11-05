const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={stunPlayer,','globalThis.testApi={ELF_HOUSE,ELF_HOUSE_LOWER_CUT,castleTransform,elfHouseBlocked,stunPlayer,');
const scope={require,__dirname,console};
vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);
test('cottage lower side cuts start one merlon below the windows and leave recesses walkable',()=>{
  const {api}=scope.load();api.initial('gold');
  const house=api.ELF_HOUSE,cut=api.ELF_HOUSE_LOWER_CUT;
  assert.equal(cut.w,24);
  assert.equal(cut.y,228+24);
  for(const room of ['west','blueGate','redTrail']){
    for(const x of [house.x+12,house.x+house.w-12]){
      assert(!api.elfHouseBlocked(room,x,house.y+cut.y+20,10),'recess is walkable');
      assert(api.elfHouseBlocked(room,x,house.y+cut.y-5,10),'upper wall remains solid');
    }
    for(const x of [house.x+cut.w+10,house.x+house.w-cut.w-10])
      assert(api.elfHouseBlocked(room,x,house.y+cut.y+20,10),'wall beside recess remains solid');
  }
});
