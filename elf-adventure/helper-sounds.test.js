const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={','globalThis.testApi={prepareDarkHelper,updateDarkQuest,');
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('an elf dropping the lamp plays the let-go sound once on return or cancellation',()=>{
  for(const reason of ['return','cancel']){
    const {api,sounds}=scope.load();api.initial('gold');const s=api.state(),elf=s.elves[0];
    s.mode='playing';s.room='lamplightLanding';s.held=null;s.bat.carrying=null;
    Object.assign(elf,{room:s.room,x:320,y:365,carrying:'lamp',stunTimer:0,surpriseTimer:0,stolenItems:{},emotionalState:{sentiment:3,passion:1}});
    s.items.lamp={room:'elf:'+elf.home,x:320,y:365};
    Object.assign(s.darkQuest,{helper:elf.home,returning:reason==='return',requested:false});
    const drop=sounds.find(sound=>sound.src==='assets/drop.mp3'),before=drop.plays;
    const update=()=>reason==='return'?api.prepareDarkHelper(elf):api.updateDarkQuest(.1);
    update();assert.equal(elf.carrying,null);assert.equal(s.items.lamp.room,elf.room);
    assert.equal(drop.plays,before+1);
    assert.equal(drop.volume,.5,'the elf lamp drop is half as loud as the player drop');
    update();assert.equal(drop.plays,before+1,'the sound does not repeat after the drop');
  }
});

test('a helper picking up the lamp plays the pickup sound once',()=>{
  const {api,sounds}=scope.load();api.initial('gold');const s=api.state(),elf=s.elves[0];
  s.mode='playing';s.room='lamplightLanding';s.held=null;s.bat.carrying=null;
  Object.assign(elf,{room:s.room,x:320,y:365,carrying:null,wait:0,stolenItems:{},emotionalState:{sentiment:3,passion:1}});
  s.items.lamp={room:s.room,x:320,y:365};s.darkQuest.helper=elf.home;
  const pickup=sounds.find(sound=>sound.src==='assets/pick-up.mp3'),before=pickup.plays;
  api.prepareDarkHelper(elf);assert.equal(elf.carrying,'lamp');assert.equal(pickup.plays,before+1);
  assert.equal(pickup.volume,.5,'the elf lamp pickup is half as loud as the player pickup');
  api.prepareDarkHelper(elf);assert.equal(pickup.plays,before+1,'carrying the lamp does not repeat the sound');
});

test('a helper pressing the forest switch plays once per press',()=>{
  const {api,sounds}=scope.load();api.initial('gold');const s=api.state(),elf=s.elves[0];
  s.mode='playing';s.room='moonwoodShrine';Object.assign(s.player,{x:480,y:500});
  Object.assign(elf,{room:s.room,x:180,y:235,stunTimer:0,surpriseTimer:0,stolenItems:{},emotionalState:{sentiment:3,passion:1}});
  s.forestQuest.helper=elf.home;
  const pickup=sounds.find(sound=>sound.src==='assets/pick-up.mp3'),before=pickup.plays;
  api.updateForestGate(.1);assert(s.forestQuest.switchDown);assert.equal(pickup.plays,before+1);
  for(let n=0;n<20;n++)api.updateForestGate(.1);
  assert.equal(pickup.plays,before+1,'holding the switch does not repeat the sound');
  elf.x=300;api.updateForestGate(.1);elf.x=180;api.updateForestGate(.1);
  assert.equal(pickup.plays,before+2,'pressing again plays a new sound');
});
