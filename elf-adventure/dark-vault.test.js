const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
// Reuse the DOM-free rules harness without registering the older suite.
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={stunPlayer,','globalThis.testApi={briarstoneLight,callForestFriend,createDragon,dragonEscapeDoor,roomTrees,callDarkFriend,updateDarkQuest,darkFriendHolding,darknessRects,slayDragonIfSword,stunPlayer,');
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);
function setup(mode='gold'){
  const loaded=scope.load();loaded.api.initial(mode);loaded.element('hints').hidden=true;
  const s=loaded.api.state();s.mode='playing';s.room='lamplightLanding';s.bat.room='absent';
  s.dragons=s.dragons.filter(d=>d.darkGuardian);
  const elf=s.elves[0];s.elves=[elf];
  Object.assign(elf,{room:'lamplightLanding',x:400,y:250,goal:null,path:[],wait:0,carrying:null,giftTask:null,stolenItems:{},emotionalState:{sentiment:3,passion:1}});
  for(const [id,item] of Object.entries(s.items))if(!['lamp','jewelNight'].includes(id)){item.room='absent';delete item.treasureOwner;}
  return {...loaded,s,elf,d:s.dragons[0]};
}

test('ordinary dragons cannot follow or flee through the Midnight Vault doorway',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,s}=setup(mode);s.elves=[];
    const dragon=api.createDragon(['Yorgle','#e7c859','lamplightLanding',480,610,105]);
    s.dragons.push(dragon);
    api.enter('midnightVault',480,80);
    assert.equal(dragon.follow.length,0);
    const door=api.dragonDoor('lamplightLanding','midnightVault');
    dragon.follow=[door];dragon.escape=door;
    api.updateDragons(.1);
    assert.equal(dragon.room,'lamplightLanding');
    assert.equal(dragon.follow.length,0);assert.equal(dragon.escape,null);
    assert.notEqual(api.dragonEscapeDoor(dragon,{x:480,y:100})?.to,'midnightVault');
    assert.equal(s.dragons.find(d=>d.darkGuardian).room,'midnightVault');
  }
});
test('Duskwood Trail adds a five-tree journey between Sapphire Shore and Lamplight Landing in every mode',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,s}=setup(mode);
    assert.equal(api.neighbor('redTrail',api.dir.down),'duskwoodTrail');
    assert.equal(api.neighbor('duskwoodTrail',api.dir.up),'redTrail');
    assert.equal(api.neighbor('duskwoodTrail',api.dir.down),'lamplightLanding');
    assert.equal(api.neighbor('lamplightLanding',api.dir.up),'duskwoodTrail');
    assert.equal(api.roomTrees('duskwoodTrail').length,5);
    for(let y=0;y<=640;y+=10)assert(!api.blocked('duskwoodTrail',480,y,true),'central route stays open');
    assert.equal(api.neighbor('lamplightLanding',api.dir.down),'midnightVault');
    assert.equal(api.neighbor('midnightVault',api.dir.up),'lamplightLanding');
    assert.equal(s.items.lamp.room,'lamplightLanding');assert.equal(s.items.jewelNight.x,875);assert.equal(s.items.jewelNight.y,560);
    assert.equal(s.dragons[0].color,'#000000');
  }
});
test('Moonwood Trail matches Duskwood Trail scenery and keeps the north-south route clear',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,s,element}=setup(mode);
    assert.deepEqual(api.roomTrees('moonwoodTrail'),api.roomTrees('duskwoodTrail'));
    assert.equal(api.roomTrees('moonwoodTrail').length,5);
    assert.equal(api.wallColor('moonwoodTrail'),api.wallColor('duskwoodTrail'));
    for(let y=0;y<=640;y+=10)assert(!api.blocked('moonwoodTrail',480,y,true),'central path stays open');
    assert.equal(api.neighbor('moonwoodTrail',api.dir.left),'moonwoodTrail');
    assert.equal(api.neighbor('moonwoodTrail',api.dir.right),'moonwoodTrail');
    assert(api.teleportToRoom('moonwoodTrail'));
    assert.equal(s.room,'moonwoodTrail');assert.equal(element('roomName').textContent,'MOONWOOD TRAIL');
    assert(element('map').innerHTML.includes('data-room="moonwoodTrail"'));
  }
});

test('dark vault is inert and sealed without light, lamp lights about ninety-eight percent at room center',()=>{
  const {api,s,d}=setup();s.room='midnightVault';Object.assign(s.player,{x:d.x,y:d.y});
  api.updateDragons(2);assert.equal(s.mode,'playing');assert(!d.biting);
  Object.assign(s.player,{x:875,y:560});api.pickup();assert.equal(s.held,null);
  const total=()=>api.darknessRects().reduce((sum,r)=>sum+r.w*r.h,0);
  assert.equal(total(),960*640);
  s.held='lamp';s.items.lamp.room='held';
  Object.assign(s.player,{x:480,y:320});
  const lampOffset=api.itemPosition('lamp');
  s.player.x+=480-lampOffset.x;s.player.y+=320-lampOffset.y;
  assert(Math.abs((1-total()/(960*640))-.98)<.005);
  const before=Math.hypot(d.x-s.player.x,d.y-s.player.y);api.updateDragons(.1);
  assert(Math.hypot(d.x-s.player.x,d.y-s.player.y)<before);api.pickup();assert.equal(s.held,'lamp');
  s.items.sword={room:d.room,x:d.x,y:d.y};assert.equal(api.slayDragonIfSword(d),false);assert(!d.dead);
});

test('chunky vault light follows both the player lamp and an elf lamp',()=>{
  const {api,s,elf}=setup();s.room='midnightVault';
  const dark=(x,y)=>api.darknessRects().some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
  for(const carrier of ['player','elf']){
    s.held=carrier==='player'?'lamp':null;
    elf.carrying=carrier==='elf'?'lamp':null;elf.room=s.room;
    s.items.lamp.room=carrier==='player'?'held':'elf:'+elf.home;
    const mover=carrier==='player'?s.player:elf;
    Object.assign(mover,{x:160,y:160});
    const lamp=api.itemPosition('lamp');assert(!dark(lamp.x,lamp.y));
    assert(dark(800,480),'far corner stays dark with lamp at upper left');
    const before=JSON.stringify(api.darknessRects());
    Object.assign(mover,{x:800,y:480});
    assert(!dark(800,480));assert(dark(160,160));
    assert.notEqual(JSON.stringify(api.darknessRects()),before);
    for(const r of api.darknessRects())for(const value of [r.x,r.y,r.w,r.h])assert.equal(value%16,0);
  }
  s.held=null;elf.carrying=null;s.items.lamp.room='lamplightLanding';
  assert.equal(api.darknessRects().reduce((sum,r)=>sum+r.w*r.h,0),960*640);
});
test('Briarstone lamp enlarges the original light without adding darkness',()=>{
  for(const mode of ['gold','easy','random'])for(const room of ['labyrinthGate','labyrinthVault']){
    const {api,s,elf}=setup(mode);s.room=room;
    assert.equal(api.darknessRects().length,0);
    Object.assign(s.player,{x:480,y:320});
    assert(Math.abs(api.briarstoneLight().w-108*1.15)<1e-9);
    for(const position of [{x:480,y:320},{x:400,y:160},{x:16,y:16}]){
      Object.assign(s.player,position);
      const {rects,...bounds}=api.briarstoneLight();
      assert.deepEqual(Array.from(rects,r=>({...r})),[bounds],'without the lamp, light stays a clean square clipped only by room edges');
    }
    Object.assign(s.player,{x:480,y:320});
    for(const carrier of ['player','elf','ground']){
      s.held=carrier==='player'?'lamp':null;
      elf.carrying=carrier==='elf'?'lamp':null;elf.room=room;
      s.items.lamp={room:carrier==='player'?'held':carrier==='elf'?'elf:'+elf.home:room,x:480,y:320};
      const mover=carrier==='player'?s.player:carrier==='elf'?elf:s.items.lamp;
      Object.assign(mover,{x:480,y:320});
      const offset=api.itemPosition('lamp');mover.x+=480-offset.x;mover.y+=320-offset.y;
      const light=api.briarstoneLight();
      assert.equal(light.w,960);assert.equal(light.h,640);
      const fraction=light.rects.reduce((sum,r)=>sum+r.w*r.h,0)/(960*640);
      assert(fraction>0&&fraction<.98,'gray remains beyond the lamp range and behind walls');
      assert(new Set(light.rects.map(r=>r.w)).size>1,'rim has jagged steps');
      for(const r of light.rects)for(const value of [r.x,r.y,r.w,r.h])assert.equal(value%16,0);
      assert.equal(api.darknessRects().length,0);
      Object.assign(mover,{x:150,y:130});
      assert(api.briarstoneLight().w<light.w,'light follows the lamp');
      assert(!api.briarstoneLight().rects.some(r=>800>=r.x&&800<r.x+r.w&&480>=r.y&&480<r.y+r.h),'far corner remains gray');
    }
    s.held=null;elf.carrying=null;s.items.lamp.room='lamplightLanding';
    assert.equal(api.darknessRects().length,0);
    assert(Math.abs(api.briarstoneLight().w-108*1.15)<1e-9);
    const {rects,...bounds}=api.briarstoneLight();
    assert.deepEqual(Array.from(rects,r=>({...r})),[bounds],'removing the lamp restores the clean square');
    s.items.lamp={room,x:360,y:160};
    const reaches=(x,y)=>api.briarstoneLight().rects.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
    assert(reaches(352,256),'unobstructed floor receives light');
    assert(!reaches(464,160),'wall casts a shadow on the floor behind it');
    s.items.lamp.x=464;
    assert(reaches(464,160),'moving the lamp past the wall lights its other side');
  }
});

test('a bell summons a happy trusting friend who fetches and holds the lamp, distracting Umbra',()=>{
  const {api,s,elf,d}=setup();api.callDarkFriend();assert.equal(s.darkQuest.helper,elf.home);
  for(let i=0;i<2500&&!api.darkFriendHolding();i++){
    if(elf.carrying==='lamp')s.room='midnightVault';
    api.updateDarkQuest(.05);api.updateElves(.05);api.updateDragons(.05);
  }
  assert(api.darkFriendHolding(),JSON.stringify({room:elf.room,x:elf.x,y:elf.y,goal:elf.goal,carrying:elf.carrying}));
  assert(Math.hypot(elf.x-150,elf.y-130)<12,'helper holds the lamp in the original upper-left position');
  for(let i=0;i<200&&!d.distracted;i++)api.updateDragons(.05);
  assert(d.distracted);assert.equal(s.mode,'playing');
  Object.assign(s.player,{x:875,y:560});api.pickup();assert.equal(s.held,'jewelNight');assert(s.darkQuest.released);
  elf.emotionalState.passion=2;api.updateDarkQuest();assert.equal(elf.carrying,null);assert.equal(s.items.lamp.room,'midnightVault');assert.equal(s.darkQuest.helper,null);
});
test('lamp bell redirects an existing fetch task into vault help, before or after lamp pickup',()=>{
  for(const carrying of [false,true]){
    const {api,s,elf}=setup();
    const request={...s.items.lamp};
    elf.giftTask={id:'lamp',retrieval:true,request};
    s.retrievalRequests={lamp:request};
    if(carrying){elf.carrying='lamp';s.items.lamp.room='elf:'+elf.home;}
    api.callDarkFriend();
    assert.equal(s.darkQuest.helper,elf.home);
    assert.equal(elf.giftTask,null);assert(!s.retrievalRequests.lamp);
    for(let i=0;i<2500&&!api.darkFriendHolding();i++){
      if(elf.carrying==='lamp')s.room='midnightVault';
      api.updateDarkQuest(.05);api.updateElves(.05);
    }
    assert(api.darkFriendHolding(),'elf takes the lamp into the vault instead of returning it to the player');
    assert.equal(s.held,null);
  }
});

test('neutral or unhappy elves do not answer, and bell request survives the doorway',()=>{
  const {api,s,elf}=setup();elf.emotionalState.passion=2;api.callDarkFriend();assert.equal(s.darkQuest.helper,null);
  elf.emotionalState={sentiment:2,passion:1};api.updateDarkQuest(1);assert.equal(s.darkQuest.helper,null);
  elf.emotionalState.sentiment=3;api.updateDarkQuest(1);assert.equal(s.darkQuest.helper,elf.home);
  s.room='midnightVault';api.updateDarkQuest();assert(s.darkQuest.requested);
  s.room='redTrail';api.updateDarkQuest();assert(!s.darkQuest.requested);assert.equal(s.darkQuest.helper,null);
});
test('a friend can travel from Sapphire Shore and the lamp cannot be taken from the player',()=>{
  const {api,s,elf}=setup();elf.room='redTrail';elf.x=480;elf.y=500;api.callDarkFriend();
  s.held='lamp';s.items.lamp.room='held';
  for(let i=0;i<20;i++)api.updateElves(.05);
  assert.equal(elf.carrying,null);assert.equal(s.held,'lamp');
  s.held=null;s.items.lamp={room:'lamplightLanding',x:320,y:365};
  for(let i=0;i<4000&&!api.darkFriendHolding();i++){
    if(elf.carrying==='lamp')s.room='midnightVault';
    api.updateDarkQuest(.05);api.updateElves(.05);api.updateDragons(.05);
  }
  assert(api.darkFriendHolding());assert.equal(s.mode,'playing');
});
test('sealed Nightstone resists the magnet and bat, which cannot carry Umbra away',()=>{
  const {api,s,d}=setup();s.room='midnightVault';
  s.items.lamp.room='midnightVault';s.items.magnet={room:s.room,x:850,y:560};
  api.updateMagnet(1);assert.equal(s.items.jewelNight.x,875);
  Object.assign(s.bat,{room:s.room,x:875,y:560,pickupCooldown:0,carrying:null,carryingDragon:null});
  api.updateBat(0);assert.notEqual(s.bat.carrying,'jewelNight');
  Object.assign(s.bat,{x:d.x,y:d.y,pickupCooldown:0,carrying:null});api.updateBat(0);
  assert.notEqual(s.bat.carryingDragon,d.name);assert.equal(d.room,'midnightVault');
});
test('leaving Midnight Vault returns Umbra to guard duty even while the friend holds the lamp',()=>{
  const {api,s,elf,d}=setup();s.room='midnightVault';
  s.darkQuest.helper=elf.home;s.darkQuest.requested=true;s.darkQuest.noticed=true;
  Object.assign(elf,{room:s.room,x:150,y:130,carrying:'lamp',darkHolding:true});s.items.lamp.room='elf:'+elf.home;
  Object.assign(d,{x:270,y:225,distracted:true,biting:true,axePauseTimer:2});
  api.enter('lamplightLanding',480,550);
  assert.equal(d.x,720);assert.equal(d.y,420);assert(!d.distracted);assert(!d.biting);assert.equal(d.axePauseTimer,0);assert.equal(d.follow.length,0);
  assert(!s.darkQuest.noticed);
  for(let i=0;i<100;i++)api.updateDragons(.05);
  assert.equal(d.x,720);assert.equal(d.y,420);assert(!d.distracted);
  api.enter('midnightVault',480,85);api.updateDragons(.1);
  assert(d.x<720,'on reentry the friend can draw Umbra away from the stone again');
});
test('Nightstone corner blocks walking in darkness and opens when a lamp lights the vault',()=>{
  const {api,s,window}=setup();s.room='midnightVault';Object.assign(s.player,{x:700,y:520});
  assert.equal(api.wallColor(s.room),'#333333');
  assert(api.blocked(s.room,815,520));assert(api.blocked(s.room,815,463.2));
  const rules=window.ElfAdventure,darkKey=rules.geometryKey();
  assert(rules.geometry().some(r=>r.x===775.2&&r.y===477.2));
  window.joystickInput={x:1,y:0};for(let i=0;i<60;i++)api.movePlayer(.05);
  assert(s.player.x<=760.2,'cannot walk blindly into the lower-right corner');
  s.placedBridges.bridge={room:s.room,x:790,y:520,vertical:false};
  assert(api.blocked(s.room,815,520),'bridge cannot bypass the dark corner');
  s.held='lamp';s.items.lamp.room='held';
  assert(!api.blocked(s.room,815,520));assert.notEqual(rules.geometryKey(),darkKey);
  assert(!rules.geometry().some(r=>r.x===775.2&&r.y===477.2));
  for(let i=0;i<10;i++)api.movePlayer(.05);
  assert(s.player.x>775.2,'the lit corner becomes walkable');
  s.held=null;s.items.lamp.room='lamplightLanding';
  assert(api.blocked(s.room,815,520),'barrier returns when the lamp leaves');
});
test('hard Umbra follows through its bite and eats a player running past in the light',()=>{
  const {api,s,d,element,window}=setup();s.room='midnightVault';s.held='lamp';s.items.lamp.room='held';
  element('dragonDifficultyToggle').onclick();
  Object.assign(s.player,{x:500,y:320});Object.assign(d,{x:470,y:320});
  window.joystickInput={x:1,y:0};
  for(let i=0;i<30&&s.mode==='playing';i++){api.movePlayer(1/60);api.updateDragons(1/60);}
  assert.equal(s.mode,'lost');assert.equal(s.swallowedBy,'Umbra');
});
test('hard difficulty speeds up Umbra bite timing as well as movement',()=>{
  for(const hard of [false,true]){
    const {api,s,d,element}=setup();s.room='midnightVault';s.held='lamp';s.items.lamp.room='held';
    Object.assign(s.player,{x:500,y:320});Object.assign(d,{x:500,y:320});
    if(hard)element('dragonDifficultyToggle').onclick();
    for(let i=0;i<11;i++)api.updateDragons(1/60);
    assert.equal(s.mode,hard?'lost':'playing');
    if(!hard){for(let i=0;i<6;i++)api.updateDragons(1/60);assert.equal(s.mode,'lost');}
  }
});
test('helper walks out with the lamp after the player leaves Midnight Vault',()=>{
  for(const continueNorth of [false,true]){
    const {api,s,elf,d}=setup();s.room='midnightVault';
    Object.assign(s.darkQuest,{helper:elf.home,requested:true});
    Object.assign(elf,{room:s.room,x:150,y:130,carrying:'lamp',darkHolding:true});
    s.items.lamp.room='elf:'+elf.home;
    api.enter('lamplightLanding',480,550);
    assert(s.darkQuest.returning);assert(!elf.darkHolding);
    if(continueNorth)api.enter('redTrail',480,550);
    for(let i=0;i<2000&&s.darkQuest.helper;i++){
      api.updateDarkQuest(.05);api.updateElves(.05);api.updateDragons(.05);
    }
    assert.equal(elf.room,'lamplightLanding');assert.equal(elf.carrying,null);
    assert.equal(s.items.lamp.room,'lamplightLanding');assert.equal(s.darkQuest.helper,null);
    assert(Math.hypot(elf.x-s.items.lamp.x,elf.y-s.items.lamp.y)>51,'helper sets the lamp down outside its own collision area');
    assert(!s.darkQuest.returning);assert(!s.darkQuest.requested);
    assert.equal(d.x,720);assert.equal(d.y,420);
    s.room='lamplightLanding';api.callDarkFriend();assert.equal(s.darkQuest.helper,elf.home,'friend can help again');
  }
});
test('Belthir can step away if a loose lamp overlaps him, but cannot walk into it',()=>{
  const {api,s,elf}=setup();elf.home='redTrail';
  Object.assign(elf,{x:320,y:365,goal:{x:320,y:200},path:[{x:320,y:200}],wait:0});
  api.updateElves(.3);assert(elf.y<340,'an overlapping lamp must not trap Belthir');
  Object.assign(elf,{x:320,y:200});
  assert(api.blocked(elf.room,320,350,elf.home),'elves still avoid walking into loose lamps');
});
test('waiting gifts defer to bell help and still interrupt ordinary retrieval',()=>{
  for(const job of ['forest','lamp','retrieval']){
    const {api,s,elf}=setup();
    s.gates[elf.home]=true;s.gateLift[elf.home]=1;
    if(job==='forest'){
      s.room=elf.room='moonwoodShrine';Object.assign(elf,{x:220,y:235,forestHolding:true});
      s.forestQuest.helper=elf.home;s.forestQuest.requested=true;
    }else if(job==='lamp'){
      s.room=elf.room='midnightVault';Object.assign(elf,{x:150,y:130,carrying:'lamp',darkHolding:true});
      s.items.lamp.room='elf:'+elf.home;s.darkQuest.helper=elf.home;s.darkQuest.requested=true;
    }else{
      elf.carrying='flute';s.items.flute.room='elf:'+elf.home;elf.giftTask={id:'flute',retrieval:true};
    }
    s.items.coin={room:elf.home+'Inside',x:245,y:320};api.updateElves(.05);
    if(job!=='retrieval'){
      assert.equal(elf.giftTask,null);
      assert.equal(job==='forest'?s.forestQuest.helper:s.darkQuest.helper,elf.home);
      if(job==='lamp')assert.equal(elf.carrying,'lamp');
      continue;
    }
    assert.equal(elf.giftTask?.id,'coin',job);assert(elf.goal?.door,'helper should head home');
    assert(!elf.darkHolding);assert(!elf.forestHolding);
    assert.notEqual(s.darkQuest.helper,elf.home);assert.notEqual(s.forestQuest.helper,elf.home);
    if(job==='lamp')assert.equal(s.items.lamp.room,'midnightVault');
    if(job==='retrieval')assert.equal(s.items.flute.room,'lamplightLanding');
  }
});

test('both bells take priority over carried gifts and pending cottage reviews',()=>{
  for(const bell of ['forest','lamp']){
    const {api,s,elf}=setup();
    s.room=elf.room=bell==='forest'?'moonwoodShrine':'lamplightLanding';
    s.items.flute={room:'elf:'+elf.home,x:0,y:0};
    elf.carrying='flute';elf.giftTask={id:'flute',feeling:'likes'};
    s.items.coin={room:elf.home+'Inside',x:245,y:320};
    if(bell==='forest')api.callForestFriend();else api.callDarkFriend();
    const quest=bell==='forest'?s.forestQuest:s.darkQuest;
    assert.equal(quest.helper,elf.home);assert.equal(elf.giftTask,null);
    assert.equal(elf.carrying,null);assert.equal(s.items.flute.room,s.room);
    assert.equal(elf.bellPausedGift.task.id,'flute');
    for(let i=0;i<2500;i++){
      if(bell==='lamp'){
        if(elf.carrying==='lamp')s.room='midnightVault';
        api.updateDarkQuest(.05);
      }
      api.updateElves(.05);
      if(bell==='forest'?elf.forestHolding:api.darkFriendHolding())break;
    }
    assert(bell==='forest'?elf.forestHolding:api.darkFriendHolding());
    assert.equal(elf.giftTask,null,'pending cottage gift must not interrupt bell help');
    // Cancel the help and let the interrupted gift task resume.
    quest.helper=null;quest.requested=false;
    if(elf.carrying==='lamp'){s.items.lamp={...api.itemPosition('lamp')};elf.carrying=null;}
    api.updateElves(.05);
    assert.equal(elf.giftTask?.id,'flute');assert(!elf.bellPausedGift);
  }
});
test('Umbra wanders gently while watching the lamp without losing the distraction',()=>{
  const {api,s,elf,d}=setup();s.room='midnightVault';
  Object.assign(elf,{room:s.room,x:150,y:130,carrying:'lamp'});s.items.lamp.room='elf:'+elf.home;
  Object.assign(s.darkQuest,{helper:elf.home,requested:true});
  const lamp=api.itemPosition('lamp'),center={x:lamp.x+115,y:lamp.y+30};Object.assign(d,center);Object.assign(s.player,center);
  let minX=d.x,maxX=d.x,minY=d.y,maxY=d.y;
  for(let i=0;i<600;i++){
    api.updateDragons(1/60);assert(d.distracted);assert(!d.biting);assert.equal(s.mode,'playing');
    minX=Math.min(minX,d.x);maxX=Math.max(maxX,d.x);minY=Math.min(minY,d.y);maxY=Math.max(maxY,d.y);
    assert(Math.hypot(d.x-center.x,d.y-center.y)<15,'watching motion stays close to the lamp');
  }
  assert(maxX-minX>15);assert(maxY-minY>10);
  const x=d.x,y=d.y;d.axePauseTimer=2;api.updateDragons(.5);assert.equal(d.x,x);assert.equal(d.y,y);
  d.axePauseTimer=0;Object.assign(s.player,{x:s.items.jewelNight.x,y:s.items.jewelNight.y});api.pickup();assert.equal(s.held,'jewelNight');
});
test('lamp-bound Umbra snaps at his mouth, lets the player escape, and stays distracted',()=>{
  const {api,s,elf,d}=setup();s.room='midnightVault';
  Object.assign(elf,{room:s.room,x:150,y:130,carrying:'lamp'});s.items.lamp.room='elf:'+elf.home;
  Object.assign(s.darkQuest,{helper:elf.home,requested:true});
  const lamp=api.itemPosition('lamp');Object.assign(d,{x:lamp.x+115,y:lamp.y+30});
  Object.assign(s.player,{x:d.x+30,y:d.y});api.updateDragons(1/60);
  assert(d.distracted);assert(!d.biting,'passing behind Umbra is safe');
  Object.assign(s.player,{x:d.x-20,y:d.y-26});api.updateDragons(1/60);
  assert(d.distracted);assert(d.biting);assert.equal(s.mode,'playing');
  Object.assign(s.player,{x:875,y:560});api.updateDragons(1/60);
  assert(d.distracted);assert(!d.biting);assert.equal(s.mode,'playing');
  const before={x:d.x,y:d.y};
  for(let i=0;i<30&&s.mode==='playing';i++){
    Object.assign(s.player,{x:d.x-20,y:d.y-26});api.updateDragons(1/60);
  }
  assert.equal(s.mode,'lost');assert.equal(s.swallowedBy,'Umbra');
  assert(Math.hypot(d.x-before.x,d.y-before.y)<15,'snap does not turn into a chase');
});

test('the lamp picks up at its edges and stays clear of the player on every carrying side',()=>{
  for(const [side,dx,dy] of [['up',0,45],['down',0,-45],['left',27,0],['right',-27,0]]){
    const {api,s,window}=setup();s.items.lamp={room:s.room,x:480,y:320};
    Object.assign(s.player,{x:480+dx,y:320+dy});api.pickup();
    assert.equal(s.held,'lamp');assert.equal(s.heldSide,side);
    const lamp=api.itemPosition('lamp'),half=side==='up'||side==='down'?35.1:17.55;
    assert(Math.hypot(lamp.x-s.player.x,lamp.y-s.player.y)>=half+10.53+4,'held lamp must not overlap the cursor');
    window.ElfAdventure.action();assert.equal(s.held,null);
    assert(Math.hypot(s.items.lamp.x-s.player.x,s.items.lamp.y-s.player.y)>=half+10.53+4,'drop keeps the lamp clear too');
  }
});
