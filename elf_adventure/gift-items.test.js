const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={','globalThis.testApi={syncFluteSound,elfGiftTargetRoom,elfGiftPreference,');
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('three liked plants spawn in distinct walkable rooms and flutes retain their starts',()=>{
  for(const mode of ['gold','easy','random']){
    const {api}=scope.load();api.initial(mode);const s=api.state();
    const plants=['flower','flower2','flower3'].map(id=>s.items[id]);
    assert(plants.every(item=>item.room!=='midnightVault'),'flowers start outside Midnight Vault');
    assert(plants.every(item=>item.room!=='lamplightLanding'),'flowers start outside Lamplight Landing');
    assert.equal(new Set(plants.map(item=>item.room)).size,3);
    for(const item of plants)assert(!api.blocked(item.room,item.x,item.y));
    for(const home of ['west','blueGate','redTrail'])for(const id of ['flower','flower2','flower3'])assert.equal(api.elfGiftPreference(home,id),'likes');
    assert.equal(s.items.flute.room,'homeCrossing');
    assert(!api.blocked('homeCrossing',s.items.flute.x,s.items.flute.y,true));
    assert.equal(s.items.flute2.room,'south');
    assert(!api.blocked('south',s.items.flute2.x,s.items.flute2.y,true));
    assert.equal(api.elfGiftPreference('redTrail','flute2'),'hates');
    for(const home of ['west','blueGate'])assert.equal(api.elfGiftPreference(home,'flute2'),'likes');
    assert.equal(api.elfGiftPreference('redTrail','flute'),'hates');
    for(const id of ['apple','coin'])assert.equal(api.elfGiftPreference('redTrail',id),'likes');
    for(const home of ['west','blueGate'])assert.equal(api.elfGiftPreference(home,'flute'),'likes');
  }
});

test('Belthir lowers Mood when collecting the hated flute without awarding gift credit',()=>{
  const {api}=scope.load();api.initial('gold');const s=api.state();
  const elf=s.elves.find(e=>e.home==='redTrail');s.elves=[elf];s.dragons=[];s.bat.room='absent';
  s.mode='playing';s.room='redTrailInside';s.player.x=480;s.player.y=550;
  for(const item of Object.values(s.items))item.room='absent';
  Object.assign(elf,{room:s.room,x:245,y:320,wait:0,goal:null,path:[],carrying:null,giftTask:null});
  s.items.flute={room:s.room,x:245,y:320};
  for(let i=0;i<100&&elf.emotionalState.sentiment===2;i++)api.updateElves(.05);
  assert.equal(elf.emotionalState.sentiment,1);
  assert.equal(elf.giftsReceived,0);
});

test('Belthir loops either flute until discarding it in Willow Crossing',()=>{
  for(const id of ['flute','flute2']){
    const {api,sounds}=scope.load();api.initial('gold');const s=api.state();s.mode='playing';
    const elf=s.elves.find(e=>e.home==='redTrail');
    Object.assign(elf,{carrying:id,giftTask:{id,feeling:'hates'}});
    const sound=sounds.find(sound=>sound.src.startsWith('assets/pan-flute-loop.mp3'));
    assert.equal(api.elfGiftTargetRoom(elf,elf.giftTask),'homeCrossing');
    api.syncFluteSound();assert.equal(sound.loop,true);assert.equal(sound.plays,1);
    api.syncFluteSound();assert.equal(sound.plays,1);
    s.mode='paused';api.syncFluteSound();
    s.mode='playing';api.syncFluteSound();assert.equal(sound.plays,2);
    elf.carrying=null;elf.giftTask=null;s.items[id]={room:'homeCrossing',x:340,y:320};
    api.syncFluteSound();assert.equal(sound.loop,false);assert.equal(sound.currentTime,0);
  }
});
