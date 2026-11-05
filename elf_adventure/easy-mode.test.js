const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGame(profileChase=false) {
  const sounds=[],drawings=[];
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
      getContext() { return new Proxy({ clearRect() {}, fillRect(...args) {drawings.push({rect:args,color:this.fillStyle});}, fillText(text,...args){drawings.push({text,args});}, drawImage() {}, measureText(){return {width:100};} },{get(target,key){return key in target?target[key]:()=>{};}}); },
      listeners: {}, addEventListener(type, handler) { this.listeners[type]=handler; }, querySelectorAll() {return [];}, contains() { return true; }, focus() {}, setAttribute() {},
      open:false,showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},
      getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; },
      clientWidth: 0, hidden: id === 'hints', textContent: '', innerHTML: ''
    });
    return elements.get(id);
  }
  const context = {
    document: { getElementById: element, querySelectorAll() { return []; }, addEventListener() {},
      body: { classList: { add() {}, toggle() {} } } },
    window: { addEventListener() {} }, Audio: class { constructor(src){this.src=src;this.plays=0;sounds.push(this);} pause() {} play() { this.plays++;return Promise.resolve(); } }, Image: class {},
    requestAnimationFrame() {}, clearTimeout() {}, setTimeout() {}, performance: { now() { return 0; } }, console
  };
  let source = fs.readFileSync(__dirname + '/game.js', 'utf8').replace(
    /\}\)\(\);\s*$/, 'globalThis.testApi={stunPlayer,returnedJewelCount,axeHits,FOREST_GATE,GOLD_CASTLE_ART,castleTransform,sceneFrame,callForestFriend,updateForestGate,updateMagnet,draw,finishElfGiftReaction,enter,initial,visibleExits,neighbor,dir,blocked,dragonDoor,connectedRooms,batNeighbor,updateDragons,updateBat,updateElves,update,updateAxe,updateTreasureRemoval,pickup,movePlayer,itemPosition,wallColor,heldObjectColor,refreshHints,teleportToRoom,grid,hardGrid,state:()=>state};})();'
  );
  const chaseMetrics={shots:0,routes:0,positions:{},staticChecks:0,giftDecisions:0,visibilityChecks:0};
  if(profileChase){
    context.chaseMetrics=chaseMetrics;
    source=source.replace('function elfClearShot(elf,origin=elf){','function elfClearShot(elf,origin=elf){chaseMetrics.shots++;');
    source=source.replace('function findDragonRoute(dragon,player){','function findDragonRoute(dragon,player){chaseMetrics.routes++;');
    source=source.replace('function itemPosition(id){','function itemPosition(id){chaseMetrics.positions[id]=(chaseMetrics.positions[id]||0)+1;');
    source=source.replace('function navigationStaticBlocked(room,x,y){','function navigationStaticBlocked(room,x,y){chaseMetrics.staticChecks++;');
    source=source.replace('function updateElfGift(elf,dt=0){','function updateElfGift(elf,dt=0){chaseMetrics.giftDecisions++;');
    source=source.replace('function clearDragonRoute(room,ax,ay,bx,by,ignoreElf=null){','function clearDragonRoute(room,ax,ay,bx,by,ignoreElf=null){chaseMetrics.visibilityChecks++;');
    source=source.replace('globalThis.testApi={','globalThis.testApi={findDragonRoute,roomNavigation,navigationRooms,');
  }
  vm.runInNewContext(source, context);
  return { api: context.testApi, element, window: context.window, sounds, chaseMetrics,drawings };
}

test('all elves move thirty percent faster at a constant speed in all nine emotional states',()=>{
  const {api}=loadGame();
  for(const home of ['west','blueGate','redTrail'])for(let sentiment=1;sentiment<=3;sentiment++)for(let passion=1;passion<=3;passion++){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];
    for(const item of Object.values(state.items))item.room='absent';
    Object.assign(state.player,{x:800,y:500});
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:state.room,x:300,y:200,wait:0,goal:{x:600,y:200},path:[{x:600,y:200}],attacking:passion===3,attackTimer:1,emotionalState:{sentiment,passion}});
    api.updateElves(.2);assert(Math.abs(elf.x-(300+78.65*1.3*.2))<1e-8,home+' '+sentiment+','+passion);assert.equal(elf.y,200);
    elf.wait=1;api.updateElves(.2);assert(Math.abs(elf.wait-.8)<1e-8,'waiting has no mood multiplier');
  }
});

test('sad elves without Hate roam without collecting axes or attacking the player',()=>{
  for(const home of ['west','blueGate','redTrail']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];
    for(const item of Object.values(state.items))item.room='absent';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:state.room,x:300,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:1,passion:2}});
    Object.assign(state.player,{x:600,y:320});state.items.axe={room:state.room,x:350,y:320};
    for(let step=0;step<300;step++){
      api.updateElves(.05);assert.notEqual(elf.carrying,'axe');assert(!elf.hunting);assert(Object.values(state.axeFlights).every(flight=>!flight));
    }
    assert.equal(state.items.axe.room,'crossroads');assert.equal(state.mode,'playing');
  }
});

test('Hateful elves of every sentiment collect axes and throw stunning attacks',()=>{
  for(const home of ['west','blueGate','redTrail'])for(const sentiment of [1,2,3]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];state.bat.room='absent';
    for(const item of Object.values(state.items))item.room='absent';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:state.room,x:300,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment,passion:3}});
    Object.assign(state.player,{x:600,y:320});state.items.axe={room:state.room,x:350,y:320};
    api.updateElves(.05);assert.equal(elf.carrying,'axe',home+' arms while sentiment is '+sentiment);
    let thrown=false;for(let step=0;step<100&&state.mode==='playing';step++){api.updateElves(.05);thrown||=!!state.axeFlights.axe;api.updateAxe(.05);}
    assert(thrown);assert.equal(state.mode,'playing');assert.equal(state.player.stunTimer,5);assert(state.message.includes('stunned you'));assert.equal(state.axeFlights.axe,null);assert(!state.usedAxes.has('axe'));
  }
});

test('Hate pursuit crosses rooms and stops when Hate ends',()=>{
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];
  for(const item of Object.values(state.items))item.room='absent';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'homeCrossing',x:700,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:2,passion:3}});
  state.items.axe={room:'stone',x:600,y:320};Object.assign(state.player,{x:600,y:320});
  for(let step=0;step<1500&&elf.carrying!=='axe';step++)api.updateElves(.05);
  assert.equal(elf.carrying,'axe');assert.equal(elf.room,'stone');
  for(let step=0;step<1200&&elf.room!=='crossroads';step++)api.updateElves(.05);
  assert.equal(elf.room,'crossroads','armed elf follows the player between rooms');
  elf.emotionalState.passion=2;api.updateElves(.05);assert.equal(elf.attacking,false);assert.equal(elf.carrying,null);assert.equal(state.items.axe.room,'crossroads');
});

test('a stunned Hateful elf waits to recover before collecting an axe',()=>{
  const {api,state,elf}=forestScene();elf.emotionalState.passion=3;elf.stunTimer=.2;
  state.items.axe={room:elf.room,x:elf.x+50,y:elf.y};
  api.updateElves(.1);assert(!elf.carrying);api.updateElves(.11);assert.equal(elf.carrying,'axe');
});

function forestScene(mode='gold'){
  const loaded=loadGame();loaded.api.initial(mode);const state=loaded.api.state();
  loaded.element('hints').hidden=true; // This isolated fixture removes off-screen actors.
  state.mode='playing';state.room='moonwoodShrine';state.dragons=[];state.bat.room='absent';
  for(const [id,item] of Object.entries(state.items))if(id!=='jewelMoon'){item.room='absent';delete item.treasureOwner;}
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'moonwoodShrine',x:400,y:320,goal:null,path:[],wait:0,trusted:true,giftsReceived:2,emotionalState:{sentiment:3,passion:1}});
  Object.assign(state.player,{x:180,y:400});
  return {...loaded,state,elf};
}

test('forest quest replaces the purple elf and cottage and preserves seven accessible jewel starts',()=>{
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();
    assert.equal(state.elves.length,3);assert(!state.elves.some(elf=>elf.home==='blackApproach'));
    assert(!state.items.blackApproachKey);assert(!api.teleportToRoom('blackApproachInside'));
    assert.equal(Object.keys(state.items).filter(id=>id.startsWith('jewel')).length,7);
    assert.equal(state.items.jewelPurple.room,'whiteInside');assert.equal(state.items.jewelMoon.room,'moonwoodShrine');
    for(const id of ['jewelPurple','jewelMoon'])assert(!api.blocked(state.items[id].room,state.items[id].x,state.items[id].y,true));
    assert(api.blocked('moonwoodShrine',615,320));
    assert(!api.blocked('moonwoodShrine',480,525,true),'south route stays clear');
  }
});

test('forest bell requires friendship, returned property, free hands and an available elf',()=>{
  for(const reason of ['neutral','not-loving','hateful','theft','stunned','carrying']){
    const {state,elf,element}=forestScene();
    if(reason==='neutral')elf.emotionalState.sentiment=2;
    if(reason==='not-loving')elf.emotionalState.passion=2;
    if(reason==='hateful')elf.emotionalState.passion=3;
    if(reason==='theft')elf.stolenItems={coin:{penalty:1}};
    if(reason==='stunned')elf.stunTimer=10;
    if(reason==='carrying'){state.held='coin';state.items.coin.room='held';}
    element('dropBtn').onclick();assert.equal(state.forestQuest.helper,null,reason);
    assert.equal(state.forestQuest.open,false);
  }
});

test('a happy elf waits until it Loves the player before answering the forest bell',()=>{
  const {api,state,elf}=forestScene();elf.trusted=false;elf.giftsReceived=0;elf.emotionalState={sentiment:2,passion:2};
  api.finishElfGiftReaction(elf,{id:'coin',feeling:'likes'});
  assert.equal(elf.emotionalState.sentiment,3);assert.equal(elf.trusted,false);assert.equal(elf.giftsReceived,1);
  api.callForestFriend();assert.equal(state.forestQuest.helper,null,'Happy with Neutral sentiment is not enough');
  api.finishElfGiftReaction(elf,{id:'flute',feeling:'likes'});
  assert.equal(elf.emotionalState.passion,1);
  api.callForestFriend();assert.equal(state.forestQuest.helper,elf.home);
  for(let step=0;step<500&&!state.forestQuest.open;step++){api.updateElves(.05);api.updateForestGate(.05);}
  assert(state.forestQuest.open);
});

test('a busy happy elf finishes its gift then answers the original bell call from its cottage',()=>{
  const {api,state,elf}=forestScene();
  Object.assign(elf,{room:'westInside',x:650,y:320,trusted:false,giftsReceived:1,emotionalState:{sentiment:3,passion:2}});
  state.items.coin={room:'westInside',x:245,y:320};
  api.callForestFriend();assert.equal(state.forestQuest.helper,null);assert(state.forestQuest.requested);
  for(let step=0;step<4000&&!state.forestQuest.open;step++){api.updateElves(.05);api.updateForestGate(.05);}
  assert.equal(elf.room,'moonwoodShrine');assert(state.forestQuest.open);assert.equal(elf.giftsReceived,2);
});

test('the bell call waits for a stunned happy elf and cancels when the player leaves',()=>{
  const {api,state,elf}=forestScene();elf.stunTimer=.2;api.callForestFriend();
  assert.equal(state.forestQuest.helper,null);assert(state.forestQuest.requested);
  for(let step=0;step<100&&!state.forestQuest.helper;step++){api.updateElves(.05);api.updateForestGate(.05);}
  assert.equal(state.forestQuest.helper,elf.home);
  state.room='blackApproach';api.updateForestGate(.05);assert.equal(state.forestQuest.requested,false);assert.equal(state.forestQuest.helper,null);
});

test('forest friend walks to the lever and holds the gate while Moonstone is carried out',()=>{
  const {api,state,elf,element}=forestScene();element('dropBtn').onclick();
  assert.equal(state.forestQuest.helper,elf.home);assert.equal(state.forestQuest.open,false);
  for(let step=0;step<500&&!state.forestQuest.open;step++){api.updateElves(.05);api.updateForestGate(.05);}
  assert(state.forestQuest.open);assert(!api.blocked('moonwoodShrine',615,320));
  assert(Math.abs(elf.x-180)<8,'helper stands left of the switch');
  const {x,y}=elf;for(let step=0;step<100;step++){api.updateElves(.05);api.updateForestGate(.05);}
  assert(Math.hypot(elf.x-x,elf.y-y)<8,'friend keeps holding the lever');
  Object.assign(state.player,{x:780,y:320});api.pickup();
  assert.equal(state.held,'jewelMoon');assert(state.forestQuest.released);
  state.player.x=480;api.updateForestGate();assert(state.forestQuest.open);
  state.room='crossroads';api.updateForestGate();assert.equal(state.forestQuest.open,false);assert.equal(state.forestQuest.helper,null);
  assert.equal(state.held,'jewelMoon');
});

test('moon gate stays shut until a happy helper arrives and finishes the roll-up animation',()=>{
  const {api,state,elf}=forestScene();
  Object.assign(state.player,{x:780,y:320});api.updateForestGate(1);
  assert.equal(state.forestQuest.open,false);assert(api.blocked('moonwoodShrine',615,320));
  api.callForestFriend();api.updateForestGate(.8);assert.equal(state.forestQuest.lift,0,'calling alone cannot open the gate');
  Object.assign(elf,{x:180,y:235});api.updateForestGate(.4);
  assert.equal(state.forestQuest.lift,.5);assert.equal(state.forestQuest.open,false);assert(api.blocked('moonwoodShrine',615,320));
  api.updateForestGate(.4);assert.equal(state.forestQuest.lift,1);assert(state.forestQuest.open);assert(!api.blocked('moonwoodShrine',615,320));
  elf.emotionalState.sentiment=2;api.updateForestGate(.4);
  assert.equal(state.forestQuest.open,false);assert.equal(state.forestQuest.lift,.5);assert(api.blocked('moonwoodShrine',615,320));
});

test('the player can operate the left switch but cannot outrun its closing gate',()=>{
  for(const mode of ['gold','easy','random'])for(const rate of [30,60,144]){
    const {api,state,element,window}=forestScene(mode);state.elves=[];
    Object.assign(state.player,{x:220,y:235});
    api.updateForestGate();assert(state.forestQuest.playerHolding);assert(state.forestQuest.switchDown);
    assert.equal(state.forestQuest.lift,0,'handle presses before the gate rolls up');
    assert.equal(api.sceneFrame().mechanismRects.at(-1).y,227,'switch moves immediately on contact');
    for(let frame=0;frame<Math.ceil(rate*1.1);frame++)api.update(1/rate);
    assert(state.forestQuest.open,'player opens the gate by staying at the switch');
    window.joystickInput={x:1,y:85/380};
    let fullyClosedAt=null;
    for(let frame=0;frame<rate*3;frame++){
      api.update(1/rate);
      if(!state.forestQuest.lift&&fullyClosedAt===null)fullyClosedAt=state.player.x;
    }
    assert(fullyClosedAt!==null&&fullyClosedAt<585,'gate finishes closing before the fastest approach reaches it');
    assert(!state.forestQuest.playerHolding);assert(!state.forestQuest.open);
    assert(state.player.x<=585);assert.notEqual(state.held,'jewelMoon');assert(!state.forestQuest.released);
  }
});

test('the left switch releases if the player leaves the room or is stunned',()=>{
  for(const reason of ['leave','stun']){
    const {api,state,element}=forestScene();state.elves=[];
    Object.assign(state.player,{x:220,y:235});element('dropBtn').onclick();api.updateForestGate(.8);
    assert(state.forestQuest.open);
    if(reason==='leave')state.room='blackApproach';
    if(reason==='stun')state.player.stunTimer=1;
    api.updateForestGate(.8);assert(!state.forestQuest.playerHolding);assert(!state.forestQuest.open);assert.equal(state.forestQuest.lift,0);
  }
});

test('running over the switch presses and releases its handle without an action, including while carrying',()=>{
  for(const carried of [null,'coin']){
    const {api,state,window}=forestScene();state.elves=[];
    state.held=carried;if(carried)state.items[carried].room='held';
    Object.assign(state.player,{x:160,y:235});window.joystickInput={x:1,y:0};
    let pressed=false,startedOpening=false;
    for(let frame=0;frame<30;frame++){
      api.update(1/60);
      if(state.forestQuest.switchDown){pressed=true;assert.equal(api.sceneFrame().mechanismRects.at(-1).y,227);}
      startedOpening||=state.forestQuest.lift>0;
    }
    assert(pressed);assert(startedOpening);assert.equal(state.held,carried);
    assert(!state.forestQuest.switchDown);assert(!state.forestQuest.playerHolding);
    assert.equal(api.sceneFrame().mechanismRects.at(-1).y,208,'handle springs back after crossing');
    window.joystickInput={x:0,y:0};api.update(1);assert.equal(state.forestQuest.lift,0);
  }
});

test('forest gate can be crossed on foot to collect Moonstone and carry it back out',()=>{
  const {api,state,elf,window}=forestScene();api.callForestFriend();elf.x=180;elf.y=235;api.updateForestGate(.8);
  Object.assign(state.player,{x:500,y:320});window.joystickInput={x:1,y:0};
  for(let step=0;step<55&&state.player.x<780;step++){api.movePlayer(.02);api.pickup();}
  assert(state.player.x>750);assert.equal(state.held,'jewelMoon');
  window.joystickInput={x:-1,y:0};
  for(let step=0;step<55&&state.player.x>500;step++)api.movePlayer(.02);
  assert(state.player.x<550);assert.equal(state.held,'jewelMoon');
});

test('forest shrine room renders the bell, hedge gate and Moonstone shrine',()=>{
  const {api,state,elf,drawings}=forestScene();api.draw();
  assert(drawings.some(call=>call.rect?.[0]===160&&call.rect?.[1]===362),'bell artwork moves left with its interaction');
  assert(drawings.some(call=>call.rect?.[0]===208&&call.rect?.[1]===224),'switch artwork moves left with its interaction');
  assert(!drawings.some(call=>['FOREST BELL','HOLD','MOONSTONE SHRINE'].includes(call.text)));
  assert(drawings.some(call=>call.color==='#000000'&&call.rect?.[0]===api.FOREST_GATE.x&&call.rect?.[1]===api.FOREST_GATE.y&&Math.abs(call.rect[3]-api.FOREST_GATE.h)<1e-8),'closed portcullis is visible');
  api.callForestFriend();elf.x=180;elf.y=235;api.updateForestGate(.8);drawings.length=0;api.draw();
  assert(drawings.some(call=>call.color==='#000000'&&call.rect?.[0]===api.FOREST_GATE.x&&call.rect?.[1]===api.FOREST_GATE.y&&Math.abs(call.rect[3]-(api.FOREST_GATE.h-api.FOREST_GATE.travel))<1e-8),'gate rolls upward into its clipped frame');assert(state.forestQuest.open);
});

test('shrine gate matches castle dimensions and animation leaves the room background unchanged',()=>{
  const {api,state,drawings}=forestScene();const {sx,sy}=api.castleTransform(),reference=api.GOLD_CASTLE_ART.gate;
  assert.equal(api.FOREST_GATE.w,reference.w*sx);assert.equal(api.FOREST_GATE.h,reference.h*sy);
  assert.equal(api.FOREST_GATE.travel,reference.travel*sy);
  const closed=api.sceneFrame();api.draw();
  assert(drawings.filter(call=>call.color==='#a18c60'&&call.rect).every(call=>call.rect[0]+call.rect[2]<=560),'trail stops before the shrine entrance');
  state.forestQuest.lift=.5;const moving=api.sceneFrame();
  state.forestQuest.lift=1;state.forestQuest.open=true;const open=api.sceneFrame();
  assert.equal(closed.backgroundKey,moving.backgroundKey);assert.equal(closed.backgroundKey,open.backgroundKey);
  assert.notDeepEqual(closed.mechanismRects,moving.mechanismRects);assert.notDeepEqual(moving.mechanismRects,open.mechanismRects);
});

test('Moonwell Vault connects through Moonwood Trail to Moonwood Grove and back in every mode',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,state,window}=forestScene(mode);state.elves=[];
    assert.equal(api.neighbor('blueVault',api.dir.down),'moonwoodTrail');
    assert.equal(api.neighbor('moonwoodTrail',api.dir.up),'blueVault');
    assert.equal(api.neighbor('moonwoodTrail',api.dir.down),'blackApproach');
    assert.equal(api.neighbor('blackApproach',api.dir.up),'moonwoodTrail');
    assert.equal(api.visibleExits('blueVault').right,false);
    assert.equal(api.visibleExits('blackApproach').left,false);
    for(const [from,to,edge,y,dy] of [
      ['blueVault','moonwoodTrail','down',635,1],
      ['moonwoodTrail','blackApproach','down',635,1],
      ['blackApproach','moonwoodTrail','up',5,-1],
      ['moonwoodTrail','blueVault','up',5,-1]
    ]){
      assert(api.visibleExits(from)[edge]);assert(api.dragonDoor(from,to));
      state.room=from;Object.assign(state.player,{x:480,y});
      window.joystickInput={x:0,y:dy};
      for(let step=0;step<30&&state.room===from;step++)api.movePlayer(.02);
      assert.equal(state.room,to);assert(!api.blocked(to,state.player.x,state.player.y));
      window.joystickInput={x:0,y:0};api.update(.4);
    }
    for(let y=10;y<=320;y+=10)assert(!api.blocked('blackApproach',480,y,true),'north trail is clear');
    if(mode!=='random'){
      const vaultRow=api.grid.findIndex(row=>row.includes('blueVault'));
      const vaultColumn=api.grid[vaultRow].indexOf('blueVault');
      assert.equal(api.grid[vaultRow+1][vaultColumn],'moonwoodTrail');
      assert.equal(api.grid[vaultRow+2][vaultColumn],'blackApproach');
    }
    if(mode==='easy'){
      assert.equal(api.neighbor('blackApproach',api.dir.down),'blackApproachSouth');
      assert.equal(api.neighbor('blackApproachSouth',api.dir.up),'blackApproach');
    }
  }
});

test('Moonwood Grove keeps its trees and a clear path to the separate shrine room',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,state,window,drawings}=forestScene(mode);state.room='blackApproach';state.elves=[];
    assert.equal(api.neighbor('blackApproach',api.dir.right),'moonwoodShrine');
    assert.equal(api.neighbor('moonwoodShrine',api.dir.left),'blackApproach');
    for(const edge of ['right','up','down'])assert.equal(api.visibleExits('moonwoodShrine')[edge],false);
    assert(api.dragonDoor('blackApproach','moonwoodShrine'));assert(api.dragonDoor('moonwoodShrine','blackApproach'));
    for(const [x,y] of [[180,155],[700,155],[170,490],[770,535]])assert(api.blocked('blackApproach',x,y,true),'grove trees remain solid');
    for(let x=60;x<=900;x+=20)assert(!api.blocked('blackApproach',x,320,true),'grove path stays open');
    api.draw();assert(!drawings.some(call=>call.text==='MOONWOOD SHRINE →'));
    assert(!drawings.some(call=>call.text==='HOLD'||call.text==='MOONSTONE SHRINE'||call.text==='FOREST BELL'),'quest fixtures are in the next room');
    Object.assign(state.player,{x:950,y:320});window.joystickInput={x:1,y:0};
    for(let step=0;step<30&&state.room==='blackApproach';step++)api.movePlayer(.02);
    assert.equal(state.room,'moonwoodShrine');assert(!api.blocked(state.room,state.player.x,state.player.y));
    window.joystickInput={x:0,y:0};api.update(.4);
    Object.assign(state.player,{x:10,y:320});window.joystickInput={x:-1,y:0};
    for(let step=0;step<30&&state.room==='moonwoodShrine';step++)api.movePlayer(.02);
    assert.equal(state.room,'blackApproach');assert(!api.blocked(state.room,state.player.x,state.player.y));
  }
});

test('forest bell calls a friend from its cottage through the world doors',()=>{
  const {api,state,elf}=forestScene();Object.assign(elf,{room:'westInside',x:480,y:320});
  api.callForestFriend();assert.equal(state.forestQuest.helper,elf.home);
  for(let step=0;step<3500&&!state.forestQuest.open;step++){api.updateElves(.05);api.updateForestGate(.05);}
  assert.equal(elf.room,'moonwoodShrine');assert(state.forestQuest.open);
});

test('forest gate closes when its helper loses happiness or Loves, is stunned, or leaves',()=>{
  for(const reason of ['stunned','upset','not-loving','leaves']){
    const {api,state,elf}=forestScene();api.callForestFriend();elf.x=180;elf.y=235;api.updateForestGate(.8);
    Object.assign(state.player,{x:780,y:320});
    if(reason==='stunned')elf.stunTimer=20;else if(reason==='upset')elf.emotionalState.sentiment=1;else if(reason==='not-loving')elf.emotionalState.passion=2;else elf.room='blackApproach';
    api.updateForestGate(.4);assert.equal(state.forestQuest.open,false);assert.equal(state.forestQuest.lift,.5);
    state.player.x=615;api.updateForestGate(.4);assert(api.blocked('moonwoodShrine',615,320));assert.equal(state.forestQuest.lift,0);
    state.player.x=550;api.updateForestGate();assert.equal(state.forestQuest.open,false);
  }
});

test('forest gate and hedges resist bridges and the sealed Moonstone resists bat and magnet',()=>{
  const {api,state}=forestScene();
  state.placedBridges.bridge={room:'moonwoodShrine',x:615,y:320};
  assert(api.blocked('moonwoodShrine',615,320));assert(api.blocked('moonwoodShrine',750,145));
  state.items.magnet={room:'moonwoodShrine',x:780,y:320};state.items.jewelMoon.x=800;
  api.updateMagnet(1);assert.equal(state.items.jewelMoon.x,800);
  Object.assign(state.bat,{room:'moonwoodShrine',x:800,y:320,vx:0,vy:0,pickupCooldown:0});
  api.updateBat(0);assert.notEqual(state.bat.carrying,'jewelMoon');assert.equal(state.items.jewelMoon.room,'moonwoodShrine');
  Object.assign(state.player,{x:800,y:320});api.pickup();assert.notEqual(state.held,'jewelMoon');
});

test('six returned jewels do not win and the seventh completes the treasury goal',()=>{
  const {api,state,element}=forestScene();state.room='goldInside';state.elves=[];
  const ids=Object.keys(state.items).filter(id=>id.startsWith('jewel'));
  for(const id of ids.filter(id=>id!=='jewelMoon'))state.items[id]={room:'goldInside',x:700,y:400};
  api.update(0);assert.equal(state.mode,'playing');assert.equal(api.returnedJewelCount(),6);
  state.items.jewelMoon={room:'goldInside',x:800,y:400};api.update(0);
  assert.equal(state.mode,'winning');assert.equal(api.returnedJewelCount(),7);
});

function friendshipScene(){
  const loaded=loadGame();loaded.api.initial('gold');const state=loaded.api.state();
  state.mode='playing';state.room='crossroads';state.dragons=[];
  for(const item of Object.values(state.items)){item.room='absent';delete item.treasureOwner;}
  state.bat.room='absent';state.bat.carrying=null;
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:state.room,x:200,y:320,goal:null,path:[],wait:0,carrying:null,trusted:true,giftsReceived:2,emotionalState:{sentiment:3,passion:1}});
  Object.assign(state.player,{x:500,y:320});
  return {...loaded,state,elf};
}

test('friendly retrieval brings a dropped item back without gift credit or repeated fetches',()=>{
  const {api,element,state,elf}=friendshipScene();
  state.held='coin';state.items.coin.room='held';element('dropBtn').onclick();
  state.player.x=800;
  let carried=false;
  for(let step=0;step<600;step++){
    api.updateElves(.05);carried||=elf.carrying==='coin';
    if(carried&&!elf.giftTask)break;
  }
  assert(carried);assert.equal(elf.carrying,null);assert.equal(state.items.coin.room,state.room);
  assert(Math.hypot(state.items.coin.x-state.player.x,state.items.coin.y-state.player.y)<100);
  assert.equal(elf.giftsReceived,2);assert.equal(state.retrievalRequests.coin,undefined);
  api.updateElves(.05);assert(!elf.giftTask?.retrieval);
});

test('friendly retrieval ignores unrequested items and cancels safely when the player leaves',()=>{
  const {api,element,state,elf}=friendshipScene();
  state.items.flower={room:state.room,x:300,y:320};api.updateElves(.05);
  assert(!elf.giftTask?.retrieval);
  elf.goal=null;elf.path=[];elf.x=400;elf.y=320;
  state.held='coin';state.items.coin.room='held';element('dropBtn').onclick();state.player.x=800;
  for(let step=0;step<200&&elf.carrying!=='coin';step++)api.updateElves(.05);
  assert.equal(elf.carrying,'coin');state.room='gold';api.updateElves(.05);
  assert.equal(elf.carrying,null);assert.equal(elf.giftTask,null);assert.equal(state.items.coin.room,'crossroads');
});

test('friendly retrieval requires a happy trusting friend with no outstanding theft',()=>{
  for(const kind of ['sad','neutral','theft']){
    const {api,element,state,elf}=friendshipScene();
    state.held='coin';state.items.coin.room='held';element('dropBtn').onclick();state.player.x=800;
    if(kind==='sad')elf.emotionalState.sentiment=1;
    if(kind==='neutral')elf.emotionalState.passion=2;
    if(kind==='theft')elf.stolenItems={flower:{penalty:1}};
    api.updateElves(.05);assert(!elf.giftTask?.retrieval,kind+' blocks retrieval');
  }
});

test('friendly retrieval abandons an item claimed by the bat without duplicating it',()=>{
  const {api,element,state,elf}=friendshipScene();
  state.held='coin';state.items.coin.room='held';element('dropBtn').onclick();state.player.x=800;
  api.updateElves(.05);assert(elf.giftTask?.retrieval);
  state.items.coin.room='bat';state.bat.carrying='coin';api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(elf.carrying,null);assert.equal(state.items.coin.room,'bat');
});

test('theft memory repairs only the theft penalty and returned property never counts as a gift',()=>{
  for(const returnX of [245,650]){
    const {api,state,elf}=friendshipScene();state.room='westInside';
    state.items.coin={room:'held',x:650,y:320};state.held='coin';state.treasureWatch={coin:'west'};
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,2);assert(elf.stolenItems.coin);
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,2);
    state.held=null;state.items.coin={room:'westInside',x:returnX,y:320};
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,3);assert(!elf.stolenItems.coin);
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,3);
    api.finishElfGiftReaction(elf,{id:'coin',feeling:'likes'});assert.equal(elf.giftsReceived,2);
  }
});

function axeStunScene(){
  const loaded=loadGame();loaded.api.initial('gold');const state=loaded.api.state();
  state.mode='playing';state.room='crossroads';state.dragons=[];state.elves=[];
  state.bat.room='south';state.bat.carrying=null;
  for(const item of Object.values(state.items))item.room='absent';
  Object.assign(state.player,{x:500,y:320});
  return {...loaded,state};
}

test('axe stun lasts five seconds, drops belongings at the player, and freezes movement and pickup',()=>{
  const {api,state,window,element}=axeStunScene();state.held='flower';state.items.flower.room='held';
  state.items.axe={room:state.room,x:440,y:320};
  state.axeFlights.axe={room:state.room,vx:650,vy:0,travelled:0,age:0,thrower:'west'};
  api.updateAxe(.1);assert.equal(state.player.stunTimer,5);assert.equal(state.mode,'playing');
  assert.equal(state.held,null);assert.equal(state.items.flower.room,'crossroads');
  assert.equal(state.items.flower.x,500);assert.equal(state.items.flower.y,320);
  window.joystickInput={x:1,y:0};
  for(let frame=0;frame<49;frame++){api.update(.1);element('dropBtn').onclick();}
  assert.equal(state.player.x,500);assert.equal(state.held,null);assert(state.player.stunTimer>0);
  api.update(.11);assert.equal(state.player.stunTimer,0);assert(state.player.x>500,'movement returns after five seconds');
});

test('stun cursor vibrates subtly without moving its collision position, pauses, and stops on recovery',()=>{
  const {api,state}=axeStunScene();api.stunPlayer('west');
  api.update(.03);const first=api.sceneFrame().entities.find(entity=>entity.id==='player');
  api.update(.03);const second=api.sceneFrame().entities.find(entity=>entity.id==='player');
  assert.notDeepEqual([first.x,first.y],[second.x,second.y]);
  assert(Math.abs(first.x-500)<=1.4&&Math.abs(first.y-320)<=.8);
  assert.equal(state.player.x,500);assert.equal(state.player.y,320);
  state.mode='paused';const timer=state.player.stunTimer;api.update(2);assert.equal(state.player.stunTimer,timer);
  state.mode='playing';api.update(5);
  const recovered=api.sceneFrame().entities.find(entity=>entity.id==='player');
  assert.equal(recovered.x,state.player.x);assert.equal(recovered.y,state.player.y);
});

test('nearby angry elves steal dropped gifts, bridges, axes, and the bat without receiving gift credit',()=>{
  for(const id of ['flower','bridge','axe2','bat']){
    const {api,state}=axeStunScene();
    state.items.westKey.room='westInside';
    const elf={home:'west',room:state.room,x:350,y:320,goal:null,path:[],wait:0,giftsReceived:0,trusted:false,emotionalState:{sentiment:1,passion:3},attacking:true,carrying:'axe'};
    state.elves=[elf];state.items.axe={room:'elf:west',x:0,y:0};state.held=id;
    if(id==='bat')Object.assign(state.bat,{room:state.room,x:535,y:320});else state.items[id].room='held';
    api.stunPlayer('west');assert.equal(elf.giftTask.id,id);assert.equal(state.items.axe.room,'crossroads');
    let stolen=false;
    for(let frame=0;frame<96;frame++){api.update(.05);stolen||=elf.carrying===id;}
    assert(stolen,id+' is stolen while the player is stunned');assert.equal(state.held,null);
    for(let frame=0;frame<4000&&elf.giftTask?.theft;frame++)api.update(.05);
    assert(!elf.giftTask?.theft,id+' reaches the thief cottage');
    assert.equal((id==='bat'?state.bat:state.items[id]).room,'westInside');
    assert.equal(elf.giftsReceived,0);assert.equal(elf.emotionalState.passion,3);
    assert.equal(state.items.bat,undefined,'the bat keeps its separate state');
  }
});

test('the nearest available angry elf claims a drop and distant or friendly elves leave it alone',()=>{
  const {api,state}=axeStunScene();state.held='coin';state.items.coin.room='held';
  const make=(home,x,passion)=>({home,room:state.room,x,y:320,goal:null,path:[],wait:0,emotionalState:{sentiment:2,passion}});
  const far=make('west',250,3),friendly=make('blueGate',480,1),near=make('redTrail',380,3);state.elves=[far,friendly,near];
  api.stunPlayer('west');assert(near.giftTask?.theft);assert(!far.giftTask);assert(!friendly.giftTask);
  const timer=state.player.stunTimer;api.stunPlayer('west');assert.equal(state.player.stunTimer,timer,'repeat hits do not restart stun');
});

test('a returning player-thrown axe also stuns after its launch grace period',()=>{
  const {api,state}=axeStunScene();
  assert.equal(api.axeHits(state.room,500,320,.49,'axe'),false);
  assert.equal(api.axeHits(state.room,500,320,.5,'axe'),true);assert.equal(state.player.stunTimer,5);
});

test('an elf axe stuns the player and leaves the axe recoverable',()=>{
  const {api,state}=friendshipScene();state.room='goldInside';state.elves=[];
  Object.assign(state.player,{x:480,y:320});state.items.axe={room:state.room,x:440,y:320};
  state.axeFlights.axe={room:state.room,vx:650,vy:0,travelled:0,age:0,thrower:'west'};
  api.updateAxe(.1);assert.equal(state.mode,'playing');assert.equal(state.player.stunTimer,5);assert(state.message.includes('stunned you'));
  api.updateAxe(30);assert.notEqual(state.items.axe.room,'absent');assert(!state.usedAxes.has('axe'));
});

test('dragon difficulty defaults to current speeds and toggles movement and bite timing immediately', () => {
  const {api,element}=loadGame();
  const toggle=element('dragonDifficultyToggle'),attributes={};
  toggle.setAttribute=(name,value)=>{attributes[name]=value;};
  function setup(){
    api.initial('gold');const state=api.state();
    state.mode='playing';state.room='crossroads';state.held=null;
    Object.assign(state.player,{x:480,y:320});
    const dragon=state.dragons[0];
    Object.assign(dragon,{room:'crossroads',x:300,y:320});state.dragons=[dragon];
    return {state,dragon};
  }
  let {state,dragon}=setup();
  api.updateDragons(.1);
  assert(Math.abs(dragon.x-300-dragon.speed*.1)<1e-8,'Easy keeps original movement');
  toggle.onclick();
  assert.equal(toggle.textContent,'Dragons: Hard');assert.equal(attributes['aria-pressed'],'true');
  dragon.x=300;api.updateDragons(.1);
  assert(Math.abs(dragon.x-300-dragon.speed*.15)<1e-8,'Hard moves 50% faster');
  ({state,dragon}=setup());
  api.updateDragons(.1);
  assert(Math.abs(dragon.x-300-dragon.speed*.15)<1e-8,'selection survives a new quest');
  dragon.x=state.player.x;api.updateDragons(0);
  api.updateDragons(.39);assert.equal(state.mode,'playing');
  api.updateDragons(.02);assert.equal(state.mode,'lost','Hard bites after 0.4 seconds');
  toggle.onclick();assert.equal(toggle.textContent,'Dragons: Easy');assert.equal(attributes['aria-pressed'],'false');
  ({state,dragon}=setup());dragon.x=state.player.x;api.updateDragons(0);
  api.updateDragons(.64);assert.equal(state.mode,'playing');
  api.updateDragons(.02);assert.equal(state.mode,'lost','Easy preserves the 0.65-second bite');
  ({state,dragon}=setup());dragon.x=state.player.x;api.updateDragons(0);
  api.updateDragons(.2);toggle.onclick();api.updateDragons(.28);
  assert.equal(state.mode,'lost','switching to Hard accelerates an active bite');
});

test('mini map houses appear only after visits or while hints are on', () => {
  const {api,element}=loadGame();api.initial('gold');
  const homes=['west','blueGate','redTrail'];
  const cell=home=>element('map').innerHTML.match(new RegExp('<span data-room="'+home+'"[^]*?</span>'))[0];
  for(const home of homes){assert(!cell(home).includes('♜'));assert(cell(home).includes('Unexplored'));}
  api.enter('west',200,320);api.enter('gold',480,320);
  assert(cell('west').includes('♜'),'visited house stays visible');
  assert(!cell('blueGate').includes('♜'),'other houses stay hidden');
  element('map').querySelectorAll=element('mazeMap').querySelectorAll=()=>[];
  element('hints').hidden=false;api.enter('gold',480,320);
  for(const home of homes)assert(cell(home).includes('♜'),'hints reveal every house');
  element('hints').hidden=true;api.enter('gold',480,320);
  assert(cell('west').includes('♜'));assert(!cell('blueGate').includes('♜'));
  api.enter('redTrailInside',480,320);api.enter('gold',480,320);
  assert(cell('redTrail').includes('♜'),'visiting a house interior also reveals it');
});

test('the behavior window freezes play and closing it resumes the existing quest', () => {
  const {api,element,window}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='stone';state.elves=[];state.dragons=[];
  Object.assign(state.player,{x:480,y:320});window.joystickInput={x:1,y:0};
  element('behaviorToggle').onclick({preventDefault(){}});
  assert.equal(element('behaviorDialog').open,true);
  api.update(.05);assert.equal(state.player.x,480);assert.equal(state.mode,'playing');
  element('behaviorClose').onclick();assert.equal(element('behaviorDialog').open,false);
  api.update(.05);assert(state.player.x>480);assert.equal(api.state(),state);
  state.mode='paused';element('behaviorToggle').onclick({preventDefault(){}});
  element('behaviorClose').onclick();assert.equal(state.mode,'paused');
});

test('picking up the flute plays once and another pickup starts a fresh sound', () => {
  const {api,sounds,element}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='goldInside';state.elves=[];state.dragons=[];
  Object.assign(state.player,{x:480,y:320});state.items.flute={room:state.room,x:480,y:320};
  const sound=sounds.find(sound=>sound.src.startsWith('assets/pan-flute-loop.mp3'));
  const pickupSound=sounds.find(sound=>sound.src==='assets/pick-up.mp3');
  const dropSound=sounds.find(sound=>sound.src==='assets/drop.mp3');
  api.pickup();assert.equal(state.held,'flute');assert.equal(sound.plays,1);assert.equal(sound.loop,false);
  assert.equal(pickupSound.plays,0);
  sound.onended();for(let i=0;i<10;i++)api.update(0);assert.equal(sound.plays,1);
  element('dropBtn').onclick();assert.equal(sound.loop,false);
  assert.equal(dropSound.plays,1);
  state.pickupDelay=0;Object.assign(state.player,{x:state.items.flute.x,y:state.items.flute.y});
  api.pickup();assert.equal(sound.plays,2);assert.equal(sound.currentTime,0);
  assert.equal(pickupSound.plays,0);
});

test('flute and flower start in their swapped rooms in every quest mode', () => {
  for(const mode of ['gold','random','easy']){
    const {api}=loadGame();api.initial(mode);const state=api.state();
    assert.equal(state.items.flute.room,mode==='easy'?'labyrinthApproach':'blueGate');
    assert.equal(state.items.flower.room,'west');
    for(const id of ['flute','flower'])assert(!api.blocked(state.items[id].room,state.items[id].x,state.items[id].y,true));
  }
});

test('Mosswood Forest has a walkable north entrance to Western Maze Root Gallery and a south return', () => {
  for(const mode of ['gold','easy','random']){
    const {api,window}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
    assert.equal(api.neighbor('stone',api.dir.up),'mazeML');
    assert.equal(api.neighbor('mazeML',api.dir.down),'stone');
    assert.equal(api.neighbor('mazeBR',api.dir.down),'mazeBR');
    assert(api.visibleExits('stone').up);
    assert(api.dragonDoor('stone','mazeML'));
    assert(api.dragonDoor('mazeML','stone'));
    for(let y=550;y<=650;y+=10)assert.equal(api.blocked('mazeML',480,y),false);
    state.room='stone';Object.assign(state.player,{x:480,y:20});window.joystickInput={x:0,y:-1};
    for(let step=0;step<20&&state.room==='stone';step++)api.movePlayer(.016);
    assert.equal(state.room,'mazeML');assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
    window.joystickInput={x:0,y:0};api.update(.4);Object.assign(state.player,{x:480,y:620});window.joystickInput={x:0,y:1};
    for(let step=0;step<20&&state.room==='mazeML';step++)api.movePlayer(.016);
    assert.equal(state.room,'stone');assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
  }
});

test('the bat traverses Western Maze between its exterior exits without looping at Heartwood north', () => {
  for(const [from,to,y,vy] of [['stone','black',-1,-.6],['black','stone',641,.6]]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.dragons=[];state.elves=[];
    Object.assign(state.bat,{room:from,x:480,y,vx:0,vy,carrying:'coin',mazeDestination:null});state.items.coin.room='bat';
    api.updateBat(0);assert.notEqual(state.bat.room,from);
    for(let step=0;step<1200&&state.bat.room!==to;step++)api.updateBat(.05);
    assert.equal(state.bat.room,to,from+' to '+to);
    const enteredY=state.bat.y;api.updateBat(.05);assert.equal(state.bat.room,to);
    assert(to==='stone'?state.bat.y>enteredY:state.bat.y<enteredY,'bat flies into the exterior instead of back into the maze');
  }
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.dragons=[];
  Object.assign(state.bat,{room:'mazeML',x:480,y:620,vx:0,vy:.6,carrying:'coin',mazeDestination:'mazeML'});state.items.coin.room='bat';
  for(let step=0;step<100&&state.bat.room!=='stone';step++)api.updateBat(.05);
  assert.equal(state.bat.room,'stone','a stale Root Gallery destination recovers to the Mosswood exit');
});

test('every room has a distinct Elf Adventure name in every quest mode', () => {
  const ids=['entry','blackApproachSouth','west','gold','blueGate','homeCrossing','stone','crossroads','blueMaze','blueVault','redTrail','south','blackApproach','westInside','blueGateInside','redTrailInside','greyDungeon','goldInside','mazeTL','mazeTR','mazeML','mazeMR','mazeBR'];
  for(const mode of ['gold','easy','random']){
    const {api,element}=loadGame();api.initial(mode);api.state().mode='playing';const names=new Set();
    for(const id of ids){assert(api.teleportToRoom(id),id);const name=element('roomName').textContent;assert(name);names.add(name);}
    assert.equal(names.size,ids.length);
    assert(names.has('GOLDEN KEEP'));assert(names.has('JEWELKEEP TREASURY'));assert(names.has('EMERALD GLADE'));
    for(const room of ['FERN GALLERY','TWILIGHT CROSSING','ROOT GALLERY','MOONLIT CROSSING','HEARTWOOD CHAMBER'])assert(names.has('WESTERN MAZE · '+room));
    assert(![...names].some(name=>/BLACK CASTLE|GREY DUNGEON/.test(name)));
  }
});

test('mouse hover names ground, carried, and placed objects at the displayed canvas scale', () => {
  const {api,element}=loadGame();api.initial('gold');const state=api.state(),canvas=element('game');state.mode='playing';state.room='crossroads';
  canvas.getBoundingClientRect=()=>({left:100,top:50,width:480,height:320});
  const hover=(x,y)=>canvas.listeners.mousemove({clientX:100+x/2,clientY:50+y/2});
  for(const [id,name] of [['apple','Apple'],['coin','Coin'],['axe','Axe'],['flute','Flute'],['flower','Flower'],['blackKey','Black key'],['jewelPurple','Amethyst jewel']]){
    const item=state.items[id];state.room=item.room;hover(item.x,item.y);assert.equal(canvas.title,name);
  }
  state.room='crossroads';
  state.held='axe5';state.heldSide='right';Object.assign(state.player,{x:100,y:200});hover(135,200);assert.equal(canvas.title,'Axe');
  state.held=null;state.items.axe5={room:'elf:west',x:0,y:0};Object.assign(state.elves[0],{room:'crossroads',x:100,y:200,carrying:'axe5',axeSide:'right'});hover(150,200);assert.equal(canvas.title,'Axe');
  state.placedBridges.bridge2={room:'crossroads',x:100,y:100};hover(160,100);assert.equal(canvas.title,'Bridge');
  hover(900,100);assert.equal(canvas.title,'');
  hover(state.items.apple.x,state.items.apple.y);canvas.listeners.mouseleave();assert.equal(canvas.title,'');
});

test('Western Maze leads north to the black castle and its original interior chain', () => {
  for(const mode of ['gold','easy','random']){
    const {api,window,element}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
    const dungeon=mode==='easy'?'nightfallInside':'blackDungeon';
    assert.equal(api.neighbor('mazeTR',api.dir.up),'black');
    assert.equal(api.neighbor('black',api.dir.down),'mazeTR');
    assert.equal(api.neighbor('blackInside',api.dir.up),dungeon);
    assert.equal(api.neighbor(dungeon,api.dir.down),'blackInside');
    assert.equal(api.neighbor('blackInside',api.dir.down),'black');
    assert.equal(api.state().items.blackKey.room,'labyrinthVault');
    assert.equal(api.visibleExits('black').left,false);assert.equal(api.visibleExits('black').up,false);
    for(const [from,to,y,dy] of [['mazeTR','black',20,-1],['black','mazeTR',620,1],['blackInside',dungeon,20,-1],[dungeon,'blackInside',620,1],['blackInside','black',620,1]]){
      window.joystickInput={x:0,y:0};api.update(.4);state.room=from;Object.assign(state.player,{x:480,y});window.joystickInput={x:0,y:dy};
      for(let step=0;step<20&&state.room===from;step++)api.movePlayer(.016);
      assert.equal(state.room,to,mode+' '+from+' to '+to);assert.equal(api.blocked(to,state.player.x,state.player.y),false);
    }
    assert(element('mazeMap').innerHTML.includes('data-room="black"'));
    for(const room of ['black','blackInside',dungeon])assert(api.teleportToRoom(room),room);
  }
});

test('the black key raises the black castle gate and permits entry', () => {
  const {api,window}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
  state.gateLatched.black=false;state.gateLift.black=0;
  state.room='black';Object.assign(state.player,{x:480,y:505});window.joystickInput={x:0,y:-.2};
  api.update(.02);assert.equal(state.room,'black');assert.equal(state.gates.black,false);
  assert(api.blocked('black',290,180));assert.equal(api.blocked('black',480,170),false);
  state.held='blackKey';state.items.blackKey.room='held';
  for(let step=0;step<100&&state.room==='black';step++)api.update(.016);
  assert.equal(state.room,'blackInside');assert.equal(state.gateLift.black,1);
  assert.equal(state.mode,'playing');
});

test('White Castle connects to Blue Vault and its white key opens access', () => {
  const {api,window,element}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.elves=[];state.dragons=[];
  assert.equal(state.items.sword.room,'westInside');assert.equal(state.items.whiteKey.room,'stone');
  assert.equal(state.items.blackKey.room,'labyrinthVault');
  for(const id of ['sword','whiteKey','blackKey']){
    const item=state.items[id];assert(!api.blocked(item.room,item.x,item.y,true),id+' starts on open floor');
  }
  assert.equal(api.neighbor('labyrinthVault',api.dir.right),'white');
  assert.equal(api.neighbor('white',api.dir.left),'labyrinthVault');
  state.room='labyrinthVault';Object.assign(state.player,{x:955,y:320});window.joystickInput={x:1,y:0};
  for(let i=0;i<30&&state.room==='labyrinthVault';i++)api.movePlayer(.016);
  assert.equal(state.room,'white');
  window.joystickInput={x:0,y:0};api.update(.4);
  Object.assign(state.player,{x:480,y:505});window.joystickInput={x:0,y:-.2};
  api.update(.02);assert.equal(state.room,'white');assert.equal(state.gates.white,false);
  state.held='whiteKey';state.items.whiteKey.room='held';
  for(let i=0;i<100&&state.room==='white';i++)api.update(.016);
  assert.equal(state.room,'whiteInside');assert.equal(state.gateLift.white,1);
  assert(element('map').innerHTML.includes('data-room="white" class="current'));
  state.held=null;window.joystickInput={x:0,y:0};api.update(.4);
  Object.assign(state.player,{x:480,y:620});window.joystickInput={x:0,y:1};
  for(let i=0;i<30&&state.room==='whiteInside';i++)api.movePlayer(.016);
  assert.equal(state.room,'white');
});

test('jewel flashes keep staggered offsets and choose fresh intervals between four and seven-and-a-half seconds', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
  const schedules=Object.values(state.jewelFlashSchedule);
  schedules.forEach((schedule,index)=>assert(Math.abs(schedule.next-(4-index*4/schedules.length))<1e-8));
  api.update(4);
  const previous=new Map();
  for(const schedule of schedules){
    assert(schedule.start!==null);const interval=schedule.next-schedule.start;assert(interval>=4&&interval<=7.5);
    previous.set(schedule,schedule.next);
  }
  api.update(7.5);
  for(const schedule of schedules){
    assert(schedule.start>=previous.get(schedule));const interval=schedule.next-schedule.start;assert(interval>=4&&interval<=7.5);
  }
  const nextTimes=schedules.map(schedule=>schedule.next);state.mode='paused';api.update(20);
  assert.deepEqual(schedules.map(schedule=>schedule.next),nextTimes);
});

test('jewel flash timer advances during play and stops while paused', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.elves=[];state.dragons=[];state.mode='playing';
  assert.equal(state.jewelFlashElapsed,0);api.update(.5);assert.equal(state.jewelFlashElapsed,.5);
  state.mode='paused';api.update(25);assert.equal(state.jewelFlashElapsed,.5);
});

test('all seven returned jewels trigger the existing win animation and final victory screen', () => {
  for(const room of ['goldInside']){
    const {api,element,sounds}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room=room;state.elves=[];state.dragons=[];
    const ids=['jewelRed','jewelPurple','jewel','jewelMoon','jewelNight','jewelTopaz','jewelGreen'];
    for(const [index,id] of ids.slice(0,6).entries())state.items[id]={room:'goldInside',x:620+index*40,y:320};
    api.update(.01);assert.equal(state.mode,'playing');assert.equal(api.returnedJewelCount(),6);
    state.bat.carrying='jewelGreen';state.items.jewelGreen.room='bat';api.update(.01);assert.equal(state.mode,'playing');
    state.bat.carrying=null;state.held='jewelGreen';state.items.jewelGreen.room='held';api.update(.01);
    assert.equal(state.mode,'playing');assert.equal(api.returnedJewelCount(),6);
    Object.assign(state.player,{x:800,y:400});element('dropBtn').onclick();api.update(.01);
    assert.equal(state.mode,'winning');assert.equal(api.returnedJewelCount(),7);
    const win=sounds.find(sound=>sound.src==='assets/win-good.mp3');assert.equal(win.plays,1);
    api.update(.1);assert.equal(win.plays,1);assert(state.winTimer>0);
    win.paused=true;api.update(7);assert.equal(state.mode,'won');assert.equal(element('overlayTitle').textContent,'THE SEVEN JEWELS RETURN');
  }
});

test('jewels outside the castle do not count toward the treasury-only victory', () => {
  const {api,element}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
  const ids=['jewelRed','jewelPurple','jewel','jewelMoon','jewelNight','jewelTopaz','jewelGreen'];
  for(const [index,id] of ids.entries())state.items[id]={room:'gold',x:150+index*90,y:550};
  api.update(.01);assert.equal(state.mode,'playing');assert.equal(api.returnedJewelCount(),0);
  state.room='goldInside';api.update(.01);assert.equal(state.mode,'playing');
  for(const [index,id] of ids.slice(0,6).entries())state.items[id]={room:'goldInside',x:620+index*40,y:320};
  state.held='jewelGreen';state.items.jewelGreen.room='held';state.room='gold';api.update(.01);
  assert.equal(state.mode,'playing');assert.equal(api.returnedJewelCount(),6);
  state.room='goldInside';api.update(.01);assert.equal(state.mode,'playing');
  Object.assign(state.player,{x:800,y:400});element('dropBtn').onclick();api.update(.01);assert.equal(state.mode,'winning');
});

test('jewels elsewhere inside the golden castle do not count until placed in treasures', () => {
  const {api,element}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='goldInside';state.elves=[];state.dragons=[];state.bat.room='south';
  const ids=['jewelRed','jewelPurple','jewel','jewelMoon','jewelNight','jewelTopaz','jewelGreen'];
  for(const [index,id] of ids.entries())state.items[id]={room:'goldInside',x:150+index*40,y:320};
  api.update(.01);assert.equal(api.returnedJewelCount(),0);assert.equal(state.mode,'playing');
  for(const [index,id] of ids.slice(0,6).entries())Object.assign(state.items[id],{x:620+index*40,y:320});
  for(const [x,y] of [[564,320],[866,320],[700,134],[700,486]]){
    Object.assign(state.items.jewelGreen,{x,y});api.update(.01);
    assert.equal(api.returnedJewelCount(),6);assert.equal(state.mode,'playing');
  }
  Object.assign(state.items.jewelGreen,{x:700,y:400});api.update(.01);
  assert.equal(api.returnedJewelCount(),7);assert.equal(state.mode,'winning');
});

test('jewel hints cross off only jewels currently stored in Golden Keep treasures',()=>{
  const {api,element}=loadGame();api.initial('gold');const state=api.state();
  for(const id of ['jewelRed','jewelPurple','jewel','jewelMoon','jewelNight','jewelTopaz','jewelGreen']){
    const heading={},row={classList:{toggle(name,value){assert.equal(name,'collected');this.collected=value;}},querySelector(){return heading;}};
    element('hint'+id[0].toUpperCase()+id.slice(1)).closest=()=>row;
    for(const position of [{room:'held',x:700,y:320},{room:'bat',x:700,y:320},{room:'gold',x:700,y:320},{room:'goldInside',x:564,y:320},{room:'goldInside',x:700,y:134}]){
      state.items[id]=position;api.refreshHints();assert.equal(row.classList.collected,false);
    }
    state.items[id]={room:'goldInside',x:700,y:320};api.refreshHints();assert.equal(row.classList.collected,true);
    assert.equal(heading.title,'Stored in Golden Keep treasures');
    state.items[id].room='held';api.refreshHints();assert.equal(row.classList.collected,false,'removing a stored jewel restores its hint');
  }
});

test('the chalice is absent in every quest mode', () => {
  const {api,element}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);assert.equal(api.state().items.chalice,undefined);
    api.refreshHints();assert(!element('map').innerHTML.includes('Chalice'));
  }
});

test('four apples and four coins start around the kingdom and copies share gift preferences', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const apples=Object.keys(state.items).filter(id=>/^apple[234]?$/.test(id)),coins=Object.keys(state.items).filter(id=>/^coin[234]?$/.test(id));
  assert.equal(apples.length,4);assert.equal(coins.length,4);
  assert.equal(new Set([...apples,...coins].map(id=>state.items[id].room)).size,8);
  for(const id of ['apple2','apple3','apple4','coin2','coin3','coin4']){
    api.initial('gold');const current=api.state();current.room='gold';const elf=current.elves[0];current.elves=[elf];
    Object.assign(elf,{room:'westInside',x:305,y:320,wait:0,goal:null,path:[]});
    current.items[id]={room:elf.room,x:245,y:320};api.updateElves(.05);
    assert.equal(elf.carrying,id);assert.equal(elf.emotionalState.sentiment,id.startsWith('apple')?1:2);assert.equal(elf.giftsReceived,0);
    for(let step=0;step<3000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);assert.equal(elf.emotionalState.sentiment,id.startsWith('apple')?1:3);assert.equal(elf.giftsReceived,id.startsWith('apple')?0:1);
  }
});

test('the extra apple and coin start on open floor in Western Maze and can be picked up', () => {
  for(const mode of ['gold','easy','random'])for(const id of ['apple4','coin4']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    state.elves=[];state.dragons=[];const item=state.items[id];assert.equal(item.room,id==='apple4'?'mazeBR':'mazeML');
    assert(!api.blocked(item.room,item.x,item.y,true));
    state.room=item.room;Object.assign(state.player,{x:item.x,y:item.y});api.pickup();assert.equal(state.held,id);
  }
});

test('weapons start inside Golden Keep and the original eight gifts start on open floor across the kingdom', () => {
  const {api}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state();
    assert.equal(state.items.sword.room,'westInside');assert.equal(state.items.axe.room,'goldInside');
    const gifts=['apple','apple2','apple3','coin','coin2','coin3','flower','flute'];
    assert.equal(new Set(gifts.map(id=>state.items[id].room)).size,8);
    for(const id of ['sword','axe',...gifts]){
      const item=state.items[id];assert(!api.blocked(item.room,item.x,item.y,true),mode+' '+id+' on open floor');
      if(gifts.includes(id))assert(api.grid.flat().includes(item.room),id+' in a kingdom room');
    }
  }
});

test('the Wyrmwood bridge starts beside the lower-left tree and can be picked up', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    state.elves=[];state.dragons=[];const tree=state.trees[2],bridge=state.items.bridge;
    assert.equal(bridge.room,'south');assert.equal(bridge.x,tree.x+150);assert.equal(bridge.y,Math.min(485,tree.y));
    for(const dx of [-81,81])for(const dy of [-72,72])assert(!api.blocked('south',bridge.x+dx,bridge.y+dy,true),'bridge clears trees and walls');
    state.room='south';Object.assign(state.player,{x:bridge.x-75,y:bridge.y+72});
    assert(!api.blocked(state.room,state.player.x,state.player.y,true));api.pickup();assert.equal(state.held,'bridge');
  }
});

test('the white key starts one hundred pixels above its former position on open floor', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    const key=state.items.whiteKey;assert.equal(key.room,'stone');assert.equal(key.x,475);assert.equal(key.y,455);
    assert(!api.blocked(key.room,key.x,key.y,true));state.room=key.room;Object.assign(state.player,{x:key.x,y:key.y});
    api.pickup();assert.equal(state.held,'whiteKey');
  }
});

test('loose objects start near walls on open floor with clear doorways', () => {
  const {api}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state();
    for(const [id,item] of Object.entries(state.items)){
      if(item.room==='absent'||item.room==='placed'||item.room==='unplaced'||item.treasureOwner||item.room==='goldInside'||id==='goldKey'||id==='whiteKey'||id==='bridge')continue;
      assert(Math.min(item.x,960-item.x,item.y,640-item.y)<=(id.startsWith('bridge')?155:85),mode+' '+id+' is near a wall');
      assert(!api.blocked(item.room,item.x,item.y,true),id+' is on open floor');
      for(const room of api.connectedRooms(item.room)){
        const door=api.dragonDoor(item.room,room);
        if(door)assert(Math.hypot(item.x-door.exit.x,item.y-door.exit.y)>110,id+' leaves the doorway clear');
      }
    }
    assert.equal(state.items.sword.x,715);assert.equal(state.items.axe.x,180);
    assert.equal(state.items.jewelRed.treasureOwner,'west');
  }
});

test('Inherited smaller quest fixture has the requested objects and dragons', () => {
  const { api, element } = loadGame();
  api.initial('easy');api.state().mode='playing';
  const state = api.state();
  assert.equal(state.questMode, 'easy');
  assert.equal(state.mode, 'playing');
  assert.equal(state.room, 'gold');
  const expected = { goldKey: 'gold', sword: 'westInside', bridge: 'south', magnet: 'blackApproachSouth' };
  for (const [id, room] of Object.entries(expected)) {
    assert.equal(state.items[id].room, room);
    assert.equal(api.blocked(room, state.items[id].x, state.items[id].y), false, id);
  }
  assert.equal(state.dragons.length, 4);
  assert.equal(api.grid[0][1], null);
  assert.equal(state.items.goldKey.x, 210);
  assert.equal(state.items.goldKey.y, 285);
  assert(!api.blocked('gold',state.items.goldKey.x,state.items.goldKey.y,true));
  assert.equal(state.dragons.find(d=>d.name==='Yorgle').room,'west');
  assert.equal(state.dragons.find(d=>d.name==='Grundle').room,'south');
  assert.equal(state.dragons.find(d=>d.name==='Rhindle').room,'whiteInside');
  assert.equal(state.bat.room,'south');
  assert(!state.dragons.some(d => d.name === 'Vesper'));
  assert.equal(state.dragons.length, 4);
  assert.doesNotThrow(() => api.refreshHints());
});

test('elf houses have solid walls, open gates, and interiors with working return exits', () => {
  const { api, window }=loadGame();
  for(const home of ['west','blueGate','redTrail']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room=home;
    const inverted=false,outsideY=y=>y;
    assert.equal(api.wallColor(home),api.wallColor(home+'Inside'));
    for(const [x,y] of [[320,300],[650,300],[488,200],[440,420],[537,420],[488,365]])assert(api.blocked(home,x,outsideY(y)),`${home} wall at ${x},${outsideY(y)}`);
    assert(!api.blocked(home,488,outsideY(450)),`${home} open gate`);
    state.player.x=488.5;state.player.y=outsideY(515);window.joystickInput={x:0,y:inverted?1:-1};
    for(let i=0;i<60&&state.room===home;i++)api.update(.016);
    assert.equal(state.room,home+'Inside');
    assert(!api.blocked(state.room,state.player.x,state.player.y));
    assert.equal(api.visibleExits(state.room).down,true);
    assert.equal(api.visibleExits(state.room).up,false);
    window.joystickInput={x:0,y:1};
    for(let i=0;i<100&&state.room!==home;i++)api.update(.016);
    assert.equal(state.room,home);
    assert(!api.blocked(home,state.player.x,state.player.y));
    assert.equal(state.player.x,488.5);
  }
  assert.equal(api.wallColor('westInside'),'#8B1515');
});

test('players bounce off every resident elf from all four directions', () => {
  const { api, window }=loadGame();
  for(const home of ['west','blueGate','redTrail'])for(const [x,y,dx,dy] of [[727,445,1,0],[813,445,-1,0],[770,402,0,1],[770,488,0,-1]]){
    api.initial('gold');const state=api.state();state.mode='playing';state.room=home;
    Object.assign(state.player,{x,y});window.joystickInput={x:dx,y:dy};
    api.movePlayer(.016);
    assert.equal(state.player.x,x);assert.equal(state.player.y,y);
    assert.equal(state.player.bounce.time,0);
    assert.equal(state.player.bounce.x,dx?-dx:0);assert.equal(state.player.bounce.y,dy?-dy:0);
    assert(api.blocked(home,770,445));
    window.joystickInput={x:-dx,y:-dy};api.movePlayer(.016);
    assert(state.player.x!==x||state.player.y!==y);
  }
});

test('elves pass through each other while remaining solid to the player', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const [first,second]=state.elves;state.elves=[first,second];
  Object.assign(first,{room:'westInside',x:300,y:320,wait:0,goal:{x:650,y:320},path:[{x:650,y:320}]});
  Object.assign(second,{room:'westInside',x:400,y:320,wait:0,goal:{x:200,y:320},path:[{x:200,y:320}]});
  assert(!api.blocked('westInside',second.x,second.y,first.home));
  assert(api.blocked('westInside',second.x,second.y));
  for(let step=0;step<50;step++)api.updateElves(.05);
  assert(first.x>second.x,'elves cross paths');assert.equal(first.y,320);assert.equal(second.y,320);
  assert(api.blocked(first.room,first.x,first.y));assert(api.blocked(second.room,second.x,second.y));
});

test('idle elves leave house interiors rather than selecting indoor wandering destinations', () => {
  for(const home of ['west','blueGate','redTrail']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:650,y:320,wait:0,goal:null,path:[]});
    api.updateElves(.05);assert.equal(elf.goal.door.to,home,'idle elf aims for the exit');
    for(let step=0;step<400&&elf.room===home+'Inside';step++)api.updateElves(.05);
    assert.equal(elf.room,home);assert(!elf.giftTask);
  }
});

test('roaming elves move, use connected doors, and remain solid away from home', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();
  state.items.apple2.room='absent';
  const elf=state.elves.find(elf=>elf.home==='west');
  Object.assign(elf,{room:'homeCrossing',x:800,y:320,wait:0,goal:{x:925,y:320,door:api.dragonDoor('homeCrossing','stone')},path:[{x:925,y:320}]});
  api.updateElves(.1);assert(elf.x>800&&elf.room==='homeCrossing');
  for(let step=0;step<100&&elf.room==='homeCrossing';step++)api.updateElves(.05);
  assert.equal(elf.room,'stone');assert.equal(elf.home,'west');
  assert(api.blocked('stone',elf.x,elf.y));assert(!api.blocked('stone',elf.x,elf.y,elf.home));
  Object.assign(elf,{room:'west',x:725,y:250,wait:0,goal:{x:400,y:250},path:[{x:400,y:250}]});
  for(let step=0;step<30;step++)api.updateElves(.016);
  assert(!api.blocked(elf.room,elf.x,elf.y,elf.home));assert(elf.x>=711);
  assert(state.elves.every(elf=>elf.room!=='south'));
});

test('elves clear doorways immediately after crossing or finding a blocked entrance', () => {
  for(const [from,to] of [['homeCrossing','stone'],['westInside','west'],['west','westInside']]){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    state.items.apple2.room='absent';
    const elf=state.elves[0];state.elves=[elf];const door=api.dragonDoor(from,to);
    Object.assign(elf,{room:from,...door.exit,goal:{...door.exit,door},path:[],wait:0});
    api.updateElves(.05);assert.equal(elf.room,to);assert.equal(elf.wait,0);assert(elf.goal.clearDoorway);
    for(let step=0;step<100&&elf.goal?.clearDoorway;step++)api.updateElves(.05);
    assert(!elf.goal?.clearDoorway,'elf walks away from doorway before pausing');
    assert(Math.hypot(elf.x-door.entry.x,elf.y-door.entry.y)>95);
  }
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='stone';
  state.items.apple2.room='absent';
  Object.assign(state.player,{x:35,y:320});const elf=state.elves[0];state.elves=[elf];
  const door=api.dragonDoor('homeCrossing','stone');
  Object.assign(elf,{room:'homeCrossing',...door.exit,goal:{...door.exit,door},path:[],wait:0});
  api.updateElves(.05);assert.equal(elf.room,'homeCrossing');assert.equal(elf.wait,0);assert(elf.goal.clearDoorway);
  const x=elf.x;api.updateElves(.1);assert(elf.x<x,'elf steps aside from blocked entrance');
});

test('elves recover from tight wall-corner approaches in Blue Maze and Blue Vault', () => {
  for(const [home,room,x,y,goal] of [
    ['blueGate','blueMaze',577.3285839999294,420.61071533332745,{x:332.35046503599733,y:403.7123700603843}],
    ['redTrail','blueVault',578.1232442477652,420.0004819725076,{x:480,y:585}]
  ]){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room,x,y,wait:0,goal,path:[{x:570,y:420},goal]});
    let moved=false;
    for(let step=0;step<120;step++){
      api.updateElves(.05);assert(!api.blocked(elf.room,elf.x,elf.y,elf.home),'elf stays out of walls');
      if(Math.hypot(elf.x-x,elf.y-y)>35)moved=true;
    }
    assert(moved,`${home} gets around the wall corner in ${room}`);
  }
});

test('elves ignore loose gifts while roaming even when a liked object is close or moves', () => {
  for(const home of ['west','blueGate','redTrail']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    const goal={x:600,y:320};Object.assign(elf,{room:'stone',x:480,y:320,wait:0,goal,path:[goal]});
    for(const id of ['apple','coin','flower','flute'])state.items[id]={room:'stone',x:480,y:370};
    api.updateElves(.05);assert.equal(elf.goal,goal);assert(!elf.giftTask);assert(!elf.carrying);
    state.items.apple.x=elf.x;state.items.apple.y=elf.y+60;
    api.updateElves(.05);assert(!elf.giftTask);assert(!elf.carrying);
    for(const id of ['apple','coin','flower','flute'])assert.equal(state.items[id].room,'stone');
  }
});


test('elves arrange liked gifts in separate treasure boxes', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];const boxes=new Set();
  for(const id of ['coin','flower','flute']){
    Object.assign(elf,{room:'westInside',x:305,y:320,goal:null,path:[],wait:0});
    state.items[id]={room:'westInside',x:245,y:320};api.updateElves(.05);
    for(let step=0;step<2000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);const item=state.items[id];
    assert.equal(item.room,'westInside');assert([625,715,805].includes(item.x));assert([265,340].includes(item.y));
    boxes.add(item.x+','+item.y);
  }
  assert.equal(boxes.size,3,'gifts occupy distinct boxes');
  assert.equal(state.items.jewelRed.x,800);assert.equal(state.items.jewelRed.y,415);
});

test('elves tidy moved treasures without counting another gift or changing their emotions', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:'westInside',x:650,y:300,goal:null,path:[],wait:0});
  state.items.coin={room:'westInside',x:700,y:300,treasureOwner:'west',elfAssessment:{home:'west',x:650,y:265}};
  const emotions={...elf.emotionalState},count=elf.giftsReceived;api.updateElves(.05);assert(elf.giftTask.tidy);
  for(let step=0;step<2000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(state.items.coin.x,650);assert.equal(state.items.coin.y,265);
  assert.equal(state.items.coin.treasureOwner,'west');assert.equal(elf.giftsReceived,count);assert.deepEqual({...elf.emotionalState},emotions);
});

test('extra liked gifts are assessed but only one of each kind is kept in treasures', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:'westInside',x:305,y:320,wait:0,goal:null,path:[]});
  state.items.coin={room:'westInside',x:650,y:300,treasureOwner:'west',elfAssessment:{home:'west',x:650,y:300}};
  state.items.coin2={room:'westInside',x:245,y:320};api.updateElves(.05);
  assert.equal(elf.carrying,'coin2');assert(elf.giftTask.excess);assert.equal(elf.giftsReceived,0);
  for(let step=0;step<3000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(elf.giftsReceived,1);assert.equal(state.items.coin.room,'westInside');assert.equal(state.items.coin2.room,'crossroads');
});

test('elves stop for loose objects and reroute around them without affecting player pickup', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();
  const elf=state.elves[1];for(const other of state.elves)other.wait=1000;
  Object.assign(elf,{room:'westInside',x:300,y:320,wait:0,goal:{x:650,y:320},path:[{x:650,y:320}]});
  for(const item of Object.values(state.items))if(item.room==='westInside')item.room='absent';
  state.items.apple={room:'westInside',x:480,y:320,elfAssessment:{home:'west',x:480,y:320}};
  assert(api.blocked('westInside',480,320,elf.home));
  assert(!api.blocked('westInside',480,320,true));
  let wentAround=false,reached=false;
  for(let step=0;step<260;step++){
    api.updateElves(.05);
    assert(!(Math.abs(elf.x-480)<45&&Math.abs(elf.y-320)<45));
    if(Math.abs(elf.y-320)>45)wentAround=true;
    if(elf.x>630){reached=true;break;}
  }
  assert(wentAround);assert(reached);assert.equal(state.items.apple.x,480);
  Object.assign(elf,{x:300,y:200});
  state.placedBridges.bridge={room:'westInside',x:650,y:400,vertical:true};
  assert(api.blocked('westInside',590,400,elf.home));
  assert(!api.blocked('westInside',650,520,elf.home));
});

test('Galenor gift routes avoid local treasure without resolving objects in other rooms',()=>{
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  state.room='blueGateInside';state.held=null;state.bat.carrying=null;
  const elf=state.elves.find(elf=>elf.home==='blueGate');state.elves=[elf];
  Object.assign(elf,{room:state.room,x:350,y:320,carrying:null});
  state.items.apple={room:state.room,x:480,y:320};
  state.items.magnet={room:'crossroads',x:500,y:300};
  chaseMetrics.positions={};
  const path=api.findDragonRoute(elf,{x:780,y:265});
  assert(path.length,'Galenor can reach the gift storage area');
  assert(path.some(point=>Math.abs(point.y-320)>45),'route goes around the apple');
  assert.equal(chaseMetrics.positions.magnet||0,0,'remote objects are excluded before resolving carrier positions');
  assert(chaseMetrics.positions.apple>0,'local gifts still block the route');
  state.held='magnet';state.items.magnet.room='held';state.heldSide='right';
  Object.assign(state.player,{x:445,y:400});
  assert(api.blocked(state.room,480,400,elf.home),'player-carried objects still block elves');
  state.held=null;state.bat.carrying='magnet';state.items.magnet.room='bat';
  Object.assign(state.bat,{room:state.room,x:480,y:400});
  assert(api.blocked(state.room,480,439,elf.home),'bat-carried objects still block elves');
});

test('room navigation reuses static searches while moved gifts remain live obstacles',()=>{
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  for(const item of Object.values(state.items))item.room='absent';
  state.placedBridges={};state.held=null;state.bat.carrying=null;
  const elf={home:'blueGate',room:'blueGateInside',x:300,y:320};
  const target={x:700,y:320};
  const first=api.findDragonRoute(elf,target),checks=chaseMetrics.staticChecks;
  assert(first.length);const navigation=api.roomNavigation(elf.room);
  const second=api.findDragonRoute(elf,target);
  assert.deepEqual(second,first);
  assert(chaseMetrics.staticChecks-checks<checks/4,'warm searches reuse static grid nodes and links');
  state.items.apple={room:elf.room,x:480,y:320};
  const around=api.findDragonRoute(elf,target);
  assert(around.length);assert.notDeepEqual(around,first,'new gift changes the route immediately');
  assert.equal(api.roomNavigation(elf.room),navigation,'loose gifts do not rebuild static terrain');
  for(const point of around)assert(!api.blocked(elf.room,point.x,point.y,elf.home));
  state.items.apple.room='absent';
  assert.deepEqual(api.findDragonRoute(elf,target),first,'removing the gift restores the route');
});

test('navigation invalidates for gates, bridges, trees, and new quests',()=>{
  const {api}=loadGame(true);api.initial('gold');let state=api.state();
  const closed=api.roomNavigation('gold');state.gateLift.gold=1;
  assert.notEqual(api.roomNavigation('gold'),closed,'castle gate changes invalidate geometry');
  const forest=api.roomNavigation('moonwoodShrine');state.forestQuest.open=true;
  assert.notEqual(api.roomNavigation('moonwoodShrine'),forest,'forest gate changes invalidate geometry');
  const woods=api.roomNavigation('south');state.trees[0].x+=30;
  assert.notEqual(api.roomNavigation('south'),woods,'tree changes invalidate geometry');
  state.placedBridges={};
  const actor={room:'labyrinthApproach',x:480,y:180},target={x:480,y:470};
  assert.equal(api.findDragonRoute(actor,target).length,0,'barrier has no route without a bridge');
  const barrier=api.roomNavigation(actor.room);
  state.placedBridges.bridge={room:actor.room,x:480,y:322.5,vertical:true};
  assert(api.findDragonRoute(actor,target).length,'placing a bridge opens a route');
  assert.notEqual(api.roomNavigation(actor.room),barrier);
  delete state.placedBridges.bridge;
  assert.equal(api.findDragonRoute(actor,target).length,0,'removing the bridge closes the route');
  api.initial('gold');assert.equal(api.navigationRooms.size,0,'new quest discards previous navigation');
});

test('elf gift decisions run a few times per second while movement continues every frame',()=>{
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  state.room='gold';state.dragons=[];
  const elf=state.elves.find(elf=>elf.home==='blueGate');state.elves=[elf];
  Object.assign(elf,{room:'blueGateInside',x:800,y:500,wait:0,goal:null,path:[]});
  state.items.apple={room:elf.room,x:245,y:250};
  let movingFrames=0;
  for(let frame=0;frame<60;frame++){
    const {x,y}=elf;api.updateElves(1/60);
    if(elf.x!==x||elf.y!==y)movingFrames++;
  }
  assert(chaseMetrics.giftDecisions>=5&&chaseMetrics.giftDecisions<=10,'decisions are independent of display frames');
  assert(movingFrames>50,'movement continues between decisions');
  const decisions=chaseMetrics.giftDecisions;
  const previousGoal={...elf.goal};
  state.items.apple.x+=100;api.updateElves(1/60);
  assert(chaseMetrics.giftDecisions>decisions,'moving a gift wakes the decision immediately');
  assert.notDeepEqual(elf.goal,previousGoal,'the route follows the moved gift');
});

test('dragon movement continues between visibility decisions and reacts to a changed target',()=>{
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  state.mode='playing';state.room='crossroads';state.elves=[];
  const dragon=state.dragons[0];state.dragons=[dragon];
  Object.assign(dragon,{room:state.room,x:200,y:320});Object.assign(state.player,{x:800,y:320});
  let movingFrames=0;
  for(let frame=0;frame<60;frame++){const x=dragon.x;api.updateDragons(1/60);if(dragon.x!==x)movingFrames++;}
  assert.equal(movingFrames,60);assert(chaseMetrics.visibilityChecks<=8,'visibility is checked at decision frequency');
  const checks=chaseMetrics.visibilityChecks;state.player.y=200;api.updateDragons(1/60);
  assert(chaseMetrics.visibilityChecks>checks,'target movement triggers an immediate decision');
});

test('axe hits freeze elves for a 0.5-second surprise followed by fifteen seconds knocked out', () => {
  for(const id of ['axe','axe2']){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='westInside';
    const elf=state.elves[0];state.elves=[elf];
    Object.assign(elf,{room:state.room,x:480,y:320,wait:0,goal:{x:650,y:320},path:[{x:650,y:320}]});
    elf.emotionalState={sentiment:3,passion:3};
    Object.assign(state.player,{x:300,y:500});
    state.items[id]={room:state.room,x:350,y:320};
    state.axeFlights[id]={room:state.room,vx:650,vy:0,age:0,travelled:0};
    api.updateAxe(.4);assert.equal(state.axeFlights[id],null);
    assert.equal(elf.surpriseTimer,.5);assert.equal(elf.stunTimer,15);
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,3);
    for(const dt of [.25,.25,10,4.9]){
      api.updateElves(dt);assert.equal(elf.x,480);assert.equal(elf.y,320);assert.equal(elf.room,'westInside');
    }
    assert.equal(elf.surpriseTimer,0);assert(Math.abs(elf.stunTimer-.1)<1e-8);
    api.updateElves(.1);assert.equal(elf.stunTimer,0);
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,3);
  }
});

test('every axe stuns a dragon for two seconds without killing it, then movement resumes', () => {
  for(const id of ['axe','axe2','axe3','axe4','axe5','axe6']){
    const {api}=loadGame();api.initial('gold');const state=api.state();
    state.mode='playing';state.room='westInside';state.elves=[];
    Object.assign(state.player,{x:700,y:320});
    const dragon=state.dragons[0];state.dragons=[dragon];
    Object.assign(dragon,{room:state.room,x:480,y:320,speed:100});
    state.items[id]={room:state.room,x:350,y:320};
    state.axeFlights[id]={room:state.room,vx:650,vy:0,age:0,travelled:0};
    api.updateAxe(.4);assert.equal(state.axeFlights[id],null);
    assert.equal(dragon.axePauseTimer,2);assert.equal(dragon.dead,false);
    for(const dt of [.2,.8,.5,.5]){api.updateDragons(dt);assert.equal(dragon.x,480);assert.equal(dragon.y,320);assert.equal(dragon.dead,false);}
    assert.equal(dragon.axePauseTimer,0);
    api.updateDragons(.1);assert(dragon.x>480);
  }
});

test('an axe pause freezes a dragon bite and preserves time remaining after recovery', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='westInside';state.elves=[];
  Object.assign(state.player,{x:480,y:335});
  const dragon=state.dragons[0];state.dragons=[dragon];
  Object.assign(dragon,{room:state.room,x:480,y:320,biting:true,biteTimer:.3,axePauseTimer:2});
  api.updateDragons(1.9);assert.equal(dragon.biteTimer,.3);assert.equal(state.mode,'playing');
  api.updateDragons(.2);assert(Math.abs(dragon.biteTimer-.2)<1e-8);assert.equal(state.mode,'playing');assert.equal(dragon.dead,false);
});

test('players can steal carried items only while an elf is knocked out', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='westInside';state.mode='playing';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:state.room,x:480,y:320,carrying:'apple',giftTask:{id:'apple',feeling:'likes'}});
  state.items.apple={room:'elf:west',x:245,y:320};Object.assign(state.player,{x:480,y:385});
  api.pickup();assert.equal(state.held,null);assert.equal(elf.carrying,'apple');
  elf.surpriseTimer=.5;elf.stunTimer=30;
  api.pickup();assert.equal(state.held,null);
  api.updateElves(.5);api.pickup();assert.equal(state.held,'apple');assert.equal(state.items.apple.room,'held');
  assert.equal(elf.carrying,null);assert.equal(elf.giftTask,null);
  assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
  api.updateElves(29.9);assert.equal(elf.x,480);assert.equal(elf.y,320);assert.equal(state.held,'apple');
});

test('elf pickup and drop sounds are thirty percent of player volume', () => {
  const {api,element,sounds}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='crossroads';
  const elf=state.elves[0];state.elves=[elf];Object.assign(elf,{room:'westInside',x:305,y:320,wait:0,goal:null,path:[]});
  state.items.apple={room:'westInside',x:245,y:320};api.updateElves(.05);
  const pickup=sounds.find(sound=>sound.src==='assets/pick-up.mp3'),drop=sounds.find(sound=>sound.src==='assets/drop.mp3');
  assert.equal(pickup.volume,.3);
  Object.assign(state.player,{x:state.items.coin.x,y:state.items.coin.y});api.pickup();assert.equal(state.held,'coin');assert.equal(pickup.volume,1);
  element('dropBtn').onclick();assert.equal(drop.volume,1);
  for(let step=0;step<1000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(drop.volume,.3);
});

test('happy elves pause for one second before sharing their jewel', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'westInside',x:730,y:415,wait:0,goal:null,path:[],emotionalState:{sentiment:3,passion:1}});
  api.updateElves(.1);assert(elf.giftTask.offering);assert(!elf.carrying);assert.equal(elf.x,730);assert.equal(elf.y,415);
  api.updateElves(.89);assert(!elf.carrying);assert.equal(elf.x,730);assert.equal(elf.y,415);
  api.updateElves(.01);assert.equal(elf.carrying,'jewelRed');assert.equal(elf.giftTask.sharePause,0);
});

test('elves leave neutral gifts in place without changing emotions or trust', () => {
  for(const home of ['west','blueGate','redTrail']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0,carrying:null});
    state.items.sword={room:elf.room,x:245,y:320};
    const emotions={...elf.emotionalState};
    api.updateElves(.05);assert.equal(elf.carrying,null);
    for(let step=0;step<2000&&elf.giftTask;step++)api.updateElves(.05);
    const item=state.items.sword;
    assert.equal(elf.giftTask,null);assert.equal(item.room,home+'Inside');
    assert.equal(item.x,245);assert.equal(item.y,320);
    assert(!item.treasureOwner);assert.equal(elf.giftsReceived,0);assert.equal(elf.trusted,false);
    assert.deepEqual({...elf.emotionalState},emotions);
    Object.assign(elf,{x:305,y:320,goal:null,path:[],wait:0});
    state.items.magnet={room:home+'Inside',x:450,y:320};api.updateElves(.05);
    assert.equal(state.items.magnet.x,450);assert.equal(state.items.magnet.y,320);
    assert.equal(elf.carrying,null,'neutral items already outside the gift area stay in place');
  }
});

test('neutral and disliked gifts never advance the two-liked-gift trust threshold', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  for(const elf of state.elves){
    for(const feeling of ['hates',null,'hates',null]){
      api.finishElfGiftReaction(elf,{id:'apple',feeling});
      assert.equal(elf.giftsReceived,0);assert.equal(elf.trusted,false);
      assert.equal(elf.emotionalState.passion,2);
    }
    const liked={id:'flower',feeling:'likes'};
    api.finishElfGiftReaction(elf,liked);api.finishElfGiftReaction(elf,liked);
    assert.equal(elf.giftsReceived,1,'the same reaction counts only once');
    for(const feeling of ['hates',null])api.finishElfGiftReaction(elf,{id:'apple',feeling});
    assert.equal(elf.giftsReceived,1);assert.equal(elf.trusted,false);
    api.finishElfGiftReaction(elf,{id:'coin',feeling:'likes'});
    assert.equal(elf.giftsReceived,2);assert.equal(elf.trusted,true);assert.equal(elf.emotionalState.passion,1);
  }
});

test('two liked gifts make each elf Passive, earn trust, and trigger a jewel offering', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewel:'redTrail',jewelGreen:'blueGate'})){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0});
    assert.equal(elf.giftsReceived,0);assert.equal(elf.trusted,false);
    const first=home==='west'?'coin':'apple';
    state.items[first]={room:elf.room,x:245,y:320};api.updateElves(.05);
    assert.equal(elf.giftsReceived,0);assert.equal(elf.trusted,false);
    assert.equal(elf.emotionalState.passion,2);
    for(let step=0;step<1000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(state.items[id].x,805);assert.equal(state.items[id].y,425);assert.equal(elf.giftsReceived,1);
    state.items[home==='blueGate'||home==='west'?'flower':'coin']={room:home+'Inside',x:245,y:320};
    for(let step=0;step<2000&&!(state.items[id].x<=395);step++)api.updateElves(.05);
    const jewel=state.items[id];assert(jewel.x>=95&&jewel.x<=395);assert.equal(jewel.room,home+'Inside');
    assert.equal(elf.giftsReceived,2);assert.equal(elf.trusted,true);assert.equal(elf.emotionalState.passion,1);
  }
});

test('each elf leaving Trust carries its shared jewel back into the protected corner', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewel:'redTrail',jewelGreen:'blueGate'})){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0,trusted:true,giftsReceived:2,emotionalState:{sentiment:2,passion:1}});
    state.items[id]={room:elf.room,x:245,y:320,elfAssessment:{home,x:245,y:320}};
    api.updateElves(.01);elf.emotionalState.passion=2;
    for(let step=0;step<2000&&!(state.items[id].x>=750&&state.items[id].room===elf.room);step++)api.updateElves(.05);
    const jewel=state.items[id];assert.equal(jewel.room,home+'Inside');
    assert(jewel.x>=750&&jewel.x<=850&&jewel.y>=365&&jewel.y<=465);
    assert.equal(elf.carrying,null);assert.equal(elf.giftsReceived,2);assert.equal(elf.emotionalState.passion,2);
    assert(api.blocked(jewel.room,jewel.x,jewel.y),'returned jewel is protected');
    for(let step=0;step<20;step++)api.updateElves(.05);
    assert.equal(state.items[id].x,jewel.x,'past trust does not immediately trigger another offering');
  }
});

test('an elf leaving Trust waits for recovery and does not reclaim carried jewels', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:'westInside',x:305,y:320,goal:null,path:[],wait:0,trusted:true,emotionalState:{sentiment:2,passion:1}});
  state.items.jewelRed={room:'held',x:245,y:320};state.held='jewelRed';
  api.updateElves(.01);elf.emotionalState.passion=2;api.updateElves(.05);
  assert.equal(state.items.jewelRed.room,'held');assert.notEqual(elf.carrying,'jewelRed');
  state.held=null;state.items.jewelRed={room:'westInside',x:245,y:320,elfAssessment:{home:'west',x:245,y:320}};
  elf.stunTimer=1;const x=elf.x;api.updateElves(.5);
  assert.equal(elf.x,x);assert.equal(state.items.jewelRed.x,245);
  for(let step=0;step<2000&&state.items.jewelRed.x<750;step++)api.updateElves(.05);
  assert(state.items.jewelRed.x>=750);assert.equal(state.items.jewelRed.room,'westInside');
});

test('jewel protection blocks the cursor and allows escape if it returns around the player', () => {
  const { api,window }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';
  const elf=state.elves[0];Object.assign(state.player,{x:745,y:425});window.joystickInput={x:1,y:0};
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    assert(api.blocked(state.room,805+dx*50,425+dy*50,true),'equal protection in every direction');
    assert(!api.blocked(state.room,805+dx*52,425+dy*52,true),'outside the circular protection');
  }
  for(let step=0;step<10;step++)api.movePlayer(.01);
  assert(state.player.x<=754,'cursor stops at glow');assert(api.blocked(state.room,805,425,true));
  elf.stunTimer=30;
  assert(!api.blocked(state.room,805,425,true));
  for(let step=0;step<20;step++)api.movePlayer(.01);
  assert(state.player.x>780,'cursor can enter while owner is unconscious');
  elf.stunTimer=0;
  for(let step=0;step<30;step++)api.movePlayer(.01);
  assert(state.player.x>=845,'cursor can escape a reactivated field');
});

test('knocked-out elves lose jewel protection until they recover', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewel:'redTrail',jewelGreen:'blueGate'})){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room=home+'Inside';
    const elf=state.elves.find(elf=>elf.home===home);
    Object.assign(state.player,{x:730,y:415});assert(!api.blocked(state.room,730,415,true));
    api.pickup();assert.equal(state.held,null,'awake elf protects jewel');
    elf.stunTimer=30;elf.surpriseTimer=.5;api.pickup();assert.equal(state.held,null,'surprise phase still protects jewel');
    elf.surpriseTimer=0;elf.stunTimer=0;api.pickup();assert.equal(state.held,null,'recovery restores protection');
    elf.stunTimer=30;api.pickup();assert.equal(state.held,id,'jewel can be reached from outside the corner while unconscious');
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2,'penalty waits until treasure leaves area');
    state.player.x=500;api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
  }
});

test('jewels have mental protection without corner walls until happy passive elves offer them as gifts', () => {
  for(const [id,home] of Object.entries({jewelRed:'west',jewel:'redTrail',jewelGreen:'blueGate'})){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room=home+'Inside';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    assert(!api.blocked(state.room,755,415,true));assert(api.blocked(state.room,800,370,true));
    assert(!api.blocked(state.room,845,415,true));assert(api.blocked(state.room,800,460,true));
    Object.assign(state.player,{x:800,y:415});api.pickup();assert.equal(state.held,null,'protected jewel cannot be grabbed even at its center');
    state.room='gold';Object.assign(elf,{room:home+'Inside',x:650,y:320,wait:0,goal:null,path:[],emotionalState:{sentiment:3,passion:1}});
    let carried=false,delivered=false;
    for(let step=0;step<1000;step++){
      api.updateElves(.05);api.updateTreasureRemoval();
      if(elf.carrying===id)carried=true;
      if(carried&&!elf.giftTask){delivered=true;break;}
    }
    assert(carried);assert(delivered);const item=state.items[id];
    assert.equal(item.room,home+'Inside');assert(item.x>=95&&item.x<=395&&item.y>=135&&item.y<=485);
    assert.equal(elf.emotionalState.sentiment,3);assert.equal(elf.emotionalState.passion,1);
    state.room=item.room;Object.assign(state.player,{x:item.x,y:item.y});state.pickupDelay=0;
    api.pickup();assert.equal(state.held,id,'offered jewel is available to the player');
    assert.equal(elf.emotionalState.sentiment,3);assert.equal(elf.emotionalState.passion,1);
  }
});

test('each elf starts with their matching jewel in their treasure area', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();
  for(const [id,home] of Object.entries({jewelRed:'west',jewel:'redTrail',jewelGreen:'blueGate'})){
    const item=state.items[id];assert.equal(item.room,home+'Inside');assert.equal(item.treasureOwner,home);
    assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);assert(api.blocked(item.room,item.x,item.y));
    const elf=state.elves.find(elf=>elf.home===home);api.updateElves(.1);
    assert(!elf.giftTask,'starting treasure is already assessed');assert.equal(elf.emotionalState.sentiment,2);
  }
  assert.equal(state.items.jewelOrange,undefined);assert.equal(state.items.jewelGold,undefined);
});

test('removed jewels and Vesper stay absent in every quest mode', () => {
  const {api}=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state(),secondRoom=mode==='easy'?'nightfallInside':'blackDungeon';
    assert.equal(state.items.jewelOrange,undefined);
    assert.equal(state.items.jewelGold,undefined);
    assert(!state.dragons.some(dragon=>dragon.name==='Vesper'));
    assert.equal(api.neighbor(secondRoom,api.dir.down),'blackInside');
  }
});

test('treasures count as taken only when moved outside their treasure area', () => {
  for(const home of ['west','blueGate','redTrail']){
    const { api }=loadGame();api.initial('gold');const state=api.state();
    state.mode='playing';state.room=home+'Inside';
    const elf=state.elves.find(elf=>elf.home===home),others=state.elves.filter(other=>other!==elf);
    Object.assign(state.player,{x:715,y:320});
    state.items.apple={room:state.room,x:715,y:320,treasureOwner:home};
    api.pickup();assert.equal(state.held,'apple');
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
    state.player.x=680;api.updateTreasureRemoval();
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
    state.player.x=500;api.updateTreasureRemoval();
    assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
    assert(others.every(other=>other.emotionalState.sentiment===2&&other.emotionalState.passion===2));
    api.pickup();assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
    state.held=null;state.pickupDelay=0;state.player.x=715;state.items.coin={room:state.room,x:715,y:320};
    api.pickup();assert.equal(state.held,'coin');assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
    elf.emotionalState={sentiment:2,passion:2};state.held=null;state.pickupDelay=0;
    state.items.coin.room=state.room;
    Object.assign(state.player,{x:245,y:320});state.items.flower={room:state.room,x:245,y:320};
    api.pickup();assert.equal(state.held,'flower');assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
  }
});

test('one stolen possession preserves Trust, Neutral, and Hate sentiments', () => {
  for(const passion of [1,2,3]){
    const {api}=loadGame();api.initial('gold');const state=api.state(),elf=state.elves[0];
    elf.emotionalState={sentiment:3,passion};state.room='westInside';Object.assign(state.player,{x:500,y:320});
    state.held='apple';state.items.apple={room:'held',x:500,y:320,treasureOwner:'west'};
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,passion);
    assert(!state.message.includes('gained'));api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,2);
  }
});

test('two outstanding stolen possessions from one elf cause Hate',()=>{
  for(const passion of [1,2]){
    const {api}=loadGame();api.initial('gold');const s=api.state(),elf=s.elves[0],other=s.elves[1];
    elf.emotionalState={sentiment:3,passion};elf.trusted=passion===1;
    for(const id of ['coin','flute']){
      s.held=id;s.items[id]={room:'held',x:500,y:320,treasureOwner:elf.home};
      api.updateTreasureRemoval();
    }
    assert.equal(elf.emotionalState.passion,3);assert.equal(elf.emotionalState.sentiment,1);
    assert.equal(elf.trusted,false);assert.equal(other.emotionalState.passion,2);
    s.room=elf.room;
    assert(api.sceneFrame().labels.find(label=>label.id===elf.home).text.includes('Stolen items: 2'));
    assert(s.message.includes('now hates you'));
    api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,1);
    s.held=null;s.items.flute={room:elf.home+'Inside',x:245,y:320};api.updateTreasureRemoval();
    assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,3);
    assert(api.sceneFrame().labels.find(label=>label.id===elf.home).text.includes('Stolen items: 1'));
  }
});

test('dropping a treasure inside its area is harmless, but leaving the room with it counts', () => {
  const { api,element }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';
  state.items.jewelRed={room:state.room,x:715,y:320,treasureOwner:'west'};
  const elf=state.elves[0];Object.assign(state.player,{x:715,y:320});
  api.pickup();assert.equal(state.held,'jewelRed');
  element('dropBtn').onclick();api.updateTreasureRemoval();
  assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);
  const item=state.items.jewelRed;state.player.x=item.x;state.player.y=item.y;state.pickupDelay=0;
  api.pickup();assert.equal(state.held,'jewelRed');state.room='crossroads';api.updateTreasureRemoval();
  assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
  api.updateTreasureRemoval();assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.emotionalState.passion,2);
});

test('elf emotions start neutral and gift sentiment stays within one to three', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  state.items.jewelRed.room='absent';
  for(const elf of state.elves){assert.equal(elf.emotionalState.sentiment,2);assert.equal(elf.emotionalState.passion,2);}
  const elf=state.elves[0];state.elves=[elf];
  for(const [id,expected] of [['flower',3],['coin',3],['apple',2],['apple',1],['apple',1],['jewel',1],['flower',1]]){
    Object.assign(elf,{room:'westInside',x:305,y:320,goal:null,path:[],wait:0});
    state.items[id]={room:'westInside',x:245,y:320};
    const previous={...elf.emotionalState};api.updateElves(.05);
    if(id==='apple')assert.equal(elf.emotionalState.sentiment,expected,'hated gift changes emotions on pickup');
    else assert.deepEqual({...elf.emotionalState},previous,'emotions stay unchanged while carrying '+id);
    for(let step=0;step<4000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);assert.equal(elf.emotionalState.sentiment,expected,'gift counts only once');assert.equal(elf.emotionalState.passion,elf.giftsReceived>=2?1:2);
  }
});

test('every elf reacts to a hated gift on pickup and does not react again when discarding it', () => {
  for(const [home,id] of Object.entries({west:'apple',blueGate:'coin',redTrail:'flower'})){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:305,y:320,goal:null,path:[],wait:0});
    state.items[id]={room:elf.room,x:245,y:320};api.updateElves(.05);
    assert.equal(elf.carrying,id);assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.giftsReceived,0);
    assert.equal(elf.giftTask.reactionApplied,true);
    for(let step=0;step<4000&&elf.giftTask;step++)api.updateElves(.05);
    assert.equal(elf.giftTask,null);assert.equal(elf.emotionalState.sentiment,1);assert.equal(elf.giftsReceived,0);
    assert.equal(elf.emotionalState.passion,2);
  }
});

test('elves carry liked gifts to treasures and hated gifts to the nearest room outside their home', () => {
  const preferences={west:{apple:false,coin:true,flower:true,flute:true},blueGate:{apple:true,coin:false,flower:true,flute:true},redTrail:{apple:true,coin:true,flower:false,flute:true}};
  for(const [home,gifts] of Object.entries(preferences))for(const [id,liked] of Object.entries(gifts)){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves.find(elf=>elf.home===home);state.elves=[elf];
    Object.assign(elf,{room:home+'Inside',x:350,y:320,wait:0,goal:null,path:[]});
    state.items[id]={room:home+'Inside',x:245,y:320};
    let carried=false,delivered=false;
    for(let step=0;step<4000;step++){
      api.updateElves(.05);
      if(elf.carrying===id)carried=true;
      if((carried||liked===null)&&!elf.giftTask){delivered=true;break;}
    }
    assert.equal(carried,liked!==null,`${home} only carries liked or hated gifts`);assert(delivered,`${home} assesses ${id}`);
    const discardRoom=['west','redTrail'].includes(home)?'homeCrossing':'blueVault';
    const item=state.items[id];assert.equal(item.room,liked!==false?home+'Inside':discardRoom);
    if(liked===false)assert(!api.blocked(item.room,item.x,item.y,true),'discarded gift is on accessible floor');
    if(liked===null){assert.equal(item.x,245);assert.equal(item.y,320);assert.equal(elf.emotionalState.sentiment,2);}
    if(liked)assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);
    assert(elf.carrying==null);
  }
});

test('elves begin gift deliveries even when the player overlaps them', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();state.room='westInside';
  const elf=state.elves[0];state.elves=[elf];
  Object.assign(elf,{room:state.room,x:480,y:320,goal:null,path:[],wait:0});
  Object.assign(state.player,{x:480,y:320});state.items.apple={room:state.room,x:245,y:320};
  for(let i=0;i<30;i++)api.updateElves(1/60);
  assert(chaseMetrics.routes<=8,'blocked gift does not trigger four searches every frame');
  assert(elf.goal,'overlapping player does not block delivery');
  assert(elf.x<480,'elf moves toward the gift');
  assert(!elf.giftTask.retryTimer,'delivery does not wait for player contact to clear');
});

test('roaming elves return for gifts and resume deliveries after being stunned', () => {
  const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
  const elf=state.elves.find(elf=>elf.home==='west');state.elves=[elf];
  Object.assign(elf,{room:'stone',x:480,y:320,wait:0,goal:null,path:[]});
  state.items.apple={room:'westInside',x:245,y:320};
  for(let step=0;step<4000&&!elf.carrying;step++)api.updateElves(.05);
  assert.equal(elf.carrying,'apple');assert.equal(elf.room,'westInside');
  const {x,y}=elf;elf.stunTimer=30;
  api.updateElves(29);assert.equal(elf.x,x);assert.equal(elf.y,y);assert.equal(elf.carrying,'apple');
  api.updateElves(1);
  for(let step=0;step<1000&&elf.giftTask;step++)api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(state.items.apple.room,'homeCrossing');
  state.items.flute={room:'westInside',x:245,y:320};api.updateElves(.05);
  assert.equal(elf.giftTask.id,'flute');
  state.items.flute.room='held';state.held='flute';api.updateElves(.05);
  assert.equal(elf.giftTask,null);assert.equal(state.held,'flute');assert.equal(state.items.flute.room,'held');
});

test('elves return home to assess gifts anywhere inside, then leave assessed treasures alone', () => {
  for(const [id,x,y] of [['apple',480,430],['flute',720,320],['jewel',480,250]]){
    const { api }=loadGame();api.initial('gold');const state=api.state();state.room='gold';
    const elf=state.elves[0];state.elves=[elf];
    Object.assign(elf,{room:'stone',x:480,y:320,wait:100,goal:{x:800,y:320},path:[{x:800,y:320}]});
    state.items[id]={room:'westInside',x,y};api.updateElves(.05);
    assert.equal(elf.giftTask.id,id);assert(elf.wait<1,'gift overrides roaming wait');
    let finished=false;
    for(let step=0;step<5000;step++){
      api.updateElves(.05);
      if(!elf.giftTask){finished=true;break;}
    }
    assert(finished,`${id} assessment finishes`);
    const item=state.items[id];
    assert.equal(item.room,id==='apple'?'homeCrossing':'westInside');
    if(id==='flute')assert(item.x>=565&&item.x<=865&&item.y>=135&&item.y<=485);
    if(id==='jewel'){assert.equal(item.x,x);assert.equal(item.y,y);}
    const position={x:item.x,y:item.y};
    for(let step=0;step<20;step++)api.updateElves(.05);
    assert.notEqual(elf.giftTask?.id,id);assert.equal(item.x,position.x);assert.equal(item.y,position.y);
  }
});

test('dragons ignore elves outside the player room', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='gold';
  const elf=state.elves[0],dragon=state.dragons.find(d=>d.name==='Grundle');state.elves=[elf];state.dragons=[dragon];
  Object.assign(elf,{room:'westInside',x:330,y:320});
  Object.assign(dragon,{room:elf.room,x:300,y:320,follow:[],escape:null,stalker:false});
  const emotions={...elf.emotionalState},stun=elf.stunTimer;
  for(let step=0;step<20;step++)api.updateDragons(.1);
  assert.equal(dragon.x,300);assert.equal(dragon.y,320);
assert.equal(elf.stunTimer,stun);assert.deepEqual({...elf.emotionalState},emotions);
});

test('dragons pursue the player through elves without attacking or changing them', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  state.mode='playing';state.room='crossroads';Object.assign(state.player,{x:700,y:320});
  const elf=state.elves[0],dragon=state.dragons[0];state.elves=[elf];state.dragons=[dragon];
  Object.assign(elf,{room:state.room,x:350,y:320});
  Object.assign(dragon,{room:state.room,x:300,y:320,speed:100,follow:[],escape:null,stalker:false});
  const emotions={...elf.emotionalState},stun=elf.stunTimer;
  assert(api.blocked(state.room,elf.x,elf.y),'elf still blocks the player');
  for(let step=0;step<30;step++)api.updateDragons(.05);
  assert(dragon.x>elf.x+60,'dragon crosses the elf position');
  assert.equal(dragon.y,320,'dragon does not detour around the elf');
assert.equal(elf.stunTimer,stun);assert.deepEqual({...elf.emotionalState},emotions);
  assert.equal(state.mode,'playing');
});

test('elves keep moving through player contact from every direction', () => {
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const { api }=loadGame();api.initial('gold');const state=api.state();
    state.room='westInside';Object.assign(state.player,{x:480,y:320});
    const elf=state.elves[0];for(const other of state.elves)other.wait=1000;
    const goal={x:480+dx*150,y:320+dy*150};
    Object.assign(elf,{room:state.room,x:480-dx*150,y:320-dy*150,wait:0,goal,path:[goal]});
    let crossedPlayer=false,reached=false;
    for(let step=0;step<240;step++){
      api.updateElves(.05);
      if(Math.hypot(elf.x-480,elf.y-320)<10)crossedPlayer=true;
      assert(Math.abs(dx?(elf.y-320):(elf.x-480))<.001,'player contact does not divert the elf');
      if(Math.hypot(elf.x-goal.x,elf.y-goal.y)<10){reached=true;break;}
    }
    assert(crossedPlayer,'elf passes through player contact');assert(reached,'elf continues to its original destination');
    assert.equal(state.player.x,480);assert.equal(state.player.y,320);
  }
});

test('door arrivals avoid elves and overlapping players can escape without passing through them', () => {
  const { api, window }=loadGame();
  for(const [room,x,y] of [['stone',35,320],['westInside',480,525],['west',488.5,515],['mazeTR',480,30]]){
    api.initial('gold');const state=api.state();state.mode='playing';
    Object.assign(state.elves[0],{room,x,y});api.enter(room,x,y);
    const p=state.player;assert(!api.blocked(room,p.x,p.y),`${room} safe arrival`);
    assert(Math.hypot(p.x-x,p.y-y)>43);
  }
  api.initial('gold');const state=api.state();state.mode='playing';state.room='west';
  const elf=state.elves[0];state.player.x=elf.x+10;state.player.y=elf.y;
  window.joystickInput={x:-1,y:0};api.movePlayer(.016);assert.equal(state.player.x,elf.x+10);
  window.joystickInput={x:1,y:0};for(let i=0;i<12;i++)api.movePlayer(.016);
  assert(state.player.x>elf.x+60);assert(!api.blocked('west',state.player.x,state.player.y));
  Object.assign(elf,{room:'homeCrossing',x:925,y:320,wait:0,goal:{x:925,y:320,door:api.dragonDoor('homeCrossing','stone')},path:[]});
  state.room='stone';state.player.x=35;state.player.y=320;api.updateElves(.016);
  assert.equal(elf.room,'stone','player cannot block an elf from entering the room');
});

test('Black lines block movement in Elf Crossing and Blue Vault only', () => {
  const { api }=loadGame();api.initial('gold');
  for(const [room,x] of [['homeCrossing',80],['blueVault',880]]){
    for(const y of [80,320,560]){
      assert(api.blocked(room,x,y,true),`${room} solid line`);
      assert(api.blocked(room,x-18,y,true),`${room} left edge collision`);
      assert(api.blocked(room,x+18,y,true),`${room} right edge collision`);
      assert(!api.blocked(room,x+35*(room==='homeCrossing'?1:-1),y,true),`${room} clear beside line`);
    }
  }
  assert(!api.blocked('crossroads',80,320,true));
  assert(!api.blocked('stone',880,320,true));
});

test('Stone Passage trees and Elf Crossing walls leave central travel routes open', () => {
  const { api }=loadGame();api.initial('gold');
  for(const room of ['stone','homeCrossing']){
    for(let x=110;x<=890;x+=20)assert(!api.blocked(room,x,320),`${room} east-west path inside the boundary line`);
    for(let y=70;y<=570;y+=20)assert(!api.blocked(room,480,y),`${room} center path`);
  }
  for(const [x,y] of [[220,160],[740,160],[220,480],[740,480]])assert(api.blocked('stone',x,y));
  assert(api.blocked('homeCrossing',250,159));assert(api.blocked('homeCrossing',710,484));
  for(const [cx,y] of [[250,85],[250,320],[710,320],[710,555]]){
    for(let x=cx-60;x<=cx+60;x+=10)assert(!api.blocked('homeCrossing',x,y),`clear route around wall at ${x},${y}`);
  }
});

test('map double-clicks teleport to walkable ground in fields, houses, and mazes', () => {
  const { api, element }=loadGame();api.initial('gold');api.state().mode='playing';
  for(const room of [...api.grid.flat().filter(Boolean),'mazeTL','mazeTR','mazeML','mazeMR','mazeBR']){
    const map=element(room.startsWith('maze')?'mazeMap':'map'),cell={dataset:{room}};
    assert(map.innerHTML.includes(`data-room="${room}"`));
    map.listeners.dblclick({target:{closest(){return cell;}},preventDefault(){}});
    const state=api.state(),p=state.player;
    assert.equal(state.room,room);
    assert(!api.blocked(room,p.x,p.y));
    for(const [dx,dy] of [[6,0],[-6,0],[0,6],[0,-6]])assert(!api.blocked(room,p.x+dx,p.y+dy));
    assert(state.dragons.every(d=>d.room!==room||Math.hypot(p.x-d.x,p.y-d.y)>=90));
  }
  const state=api.state(),before=state.room;
  element('map').listeners.dblclick({target:{closest(){return null;}},preventDefault(){throw new Error('empty map cell');}});
  assert.equal(state.room,before);
  assert.equal(api.teleportToRoom('missingRoom'),false);
  state.mode='paused';state.held='goldKey';
  assert.equal(api.teleportToRoom('west'),true);
  assert.equal(state.mode,'playing');assert.equal(state.held,'goldKey');
  assert.equal(element('overlay').hidden,true);
});

test('mini-map castle travel lands below the doorway for open and closed gates',()=>{
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.dragons=[];
  const {x,y,sx,sy}=api.castleTransform();
  const door={x:x+347*sx,y:y+598*sy,w:161*sx,h:161*sy};
  for(const room of ['gold','black','white'])for(const lift of [0,1]){
    state.gates[room]=!!lift;state.gateLift[room]=lift;
    assert(api.teleportToRoom(room));
    assert.equal(state.player.x,door.x+door.w/2,'centered below the door');
    assert(state.player.y-21.06/2>door.y+door.h,'entire cursor is below the door');
    assert(!api.blocked(room,state.player.x,state.player.y));
  }
});

test('the action button drops a stationary axe and throws along movement including diagonals', () => {
  const { api, element, window }=loadGame();
  for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1]]){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';state.player.x=480;state.player.y=320;state.held='axe';
    window.joystickInput={x:dx,y:dy};element('dropBtn').onclick();
    assert.equal(state.held,null);assert.equal(state.items.axe.room,'westInside');
    if(!dx&&!dy){assert.equal(state.axeFlights.axe,null);continue;}
    assert(state.axeFlights.axe);api.updateAxe(.05);
    const length=Math.hypot(dx,dy);assert(Math.abs(state.items.axe.x-(480+dx/length*32.5))<.01);assert(Math.abs(state.items.axe.y-(285+dy/length*32.5))<.01);
    for(let i=0;i<200&&state.axeFlights.axe;i++)api.updateAxe(.016);
    assert.equal(state.axeFlights.axe,null);assert(!api.blocked(state.items.axe.room,state.items.axe.x,state.items.axe.y));
    state.room=state.items.axe.room;state.player.x=state.items.axe.x-100;state.player.y=state.items.axe.y;state.pickupDelay=0;window.joystickInput={x:0,y:0};api.updateAxe(1.01);state.player.x=state.items.axe.x;api.pickup();assert.equal(state.held,null);assert.equal(state.items.axe.room,'absent');
  }
});

test('axes launch from their current held offset without jumping to the cursor center', () => {
  const { api, element, window }=loadGame();
  for(const side of ['up','down','left','right'])for(const id of ['axe','axe2']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='westInside';state.player.x=480;state.player.y=320;state.held=id;state.heldSide=side;
    const direction=api.dir[side],start={x:480+direction.x*35,y:320+direction.y*35};
    window.joystickInput={x:1,y:0};element('dropBtn').onclick();
    assert.equal(state.items[id].x,start.x);assert.equal(state.items[id].y,start.y);
    api.updateAxe(.05);assert(Math.abs(state.items[id].x-start.x-32.5)<.01);assert.equal(state.items[id].y,start.y);
  }
});

test('axes start in Golden Keep, Western Maze, and Mosswood Forest with none in elf houses', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();
    const axes=Object.entries(state.items).filter(([id,item])=>/^axe/.test(id)&&item.room!=='absent');
    assert.equal(axes.length,3);
    for(const [id,room] of [['axe','goldInside'],['axe2','mazeML'],['axe3','stone']]){
      const item=state.items[id];assert.equal(item.room,room);assert(!item.treasureOwner);
      assert(!api.blocked(room,item.x,item.y,true),id+' starts on open ground');
    }
    assert(!axes.some(([,item])=>['westInside','blueGateInside','redTrailInside'].includes(item.room)));
  }
});

test('the Golden Keep and kingdom axes can fly independently', () => {
  const { api, element, window }=loadGame();api.initial('gold');const state=api.state();state.mode='playing';
  assert.equal(state.items.axe.room,'goldInside');
  assert.equal(state.items.axe3.room,'stone');
  assert.equal(state.items.axe4.room,'absent');
  assert.equal(Object.entries(state.items).filter(([id,item])=>/^axe/.test(id)&&item.room==='goldInside').length,1);
  state.items.axe2={room:'westInside',x:625,y:265};
  state.room='westInside';state.player.x=state.items.axe2.x;state.player.y=state.items.axe2.y;api.pickup();assert.equal(state.held,'axe2');
  api.teleportToRoom('westInside');state.player.x=480;state.player.y=420;window.joystickInput={x:-1,y:0};element('dropBtn').onclick();
  assert(state.axeFlights.axe2);assert.equal(state.axeFlights.axe,null);
  state.player.x=480;state.player.y=320;state.held='axe';window.joystickInput={x:1,y:0};element('dropBtn').onclick();api.updateAxe(.1);
  assert(state.axeFlights.axe&&state.axeFlights.axe2);
  assert(state.items.axe.x>480);assert(state.items.axe2.x<480);
  assert.equal(state.items.axe.room,'westInside');assert.equal(state.items.axe2.room,'westInside');
});

test('thrown axes remain where they land and can be picked up and thrown again', () => {
  const {api,element,window}=loadGame();
  for(const id of ['axe','axe2','axe5']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room='goldInside';
    state.elves=[];state.dragons=[];Object.assign(state.player,{x:480,y:320});
    state.held=id;state.items[id].room='held';window.joystickInput={x:1,y:0};element('dropBtn').onclick();
    for(let i=0;i<200&&state.axeFlights[id];i++)api.updateAxe(.016);
    assert.equal(state.axeFlights[id],null);assert(!state.usedAxes.has(id));assert.equal(state.axeFades[id],undefined);
    const landed={...state.items[id]};api.updateAxe(30);assert.deepEqual({...state.items[id]},landed);
    const axe=state.items[id];state.room=axe.room;Object.assign(state.player,{x:axe.x,y:axe.y});
    state.pickupDelay=0;window.joystickInput={x:0,y:0};api.pickup();assert.equal(state.held,id);
    Object.assign(state.player,{x:480,y:320});window.joystickInput={x:-1,y:0};element('dropBtn').onclick();assert(state.axeFlights[id]);
    for(let i=0;i<200&&state.axeFlights[id];i++)api.updateAxe(.016);
    api.updateAxe(30);assert(!state.usedAxes.has(id));assert.notEqual(state.items[id].room,'absent');
  }
});

test('persistent axes do not play the disappearance sound', () => {
  const {api,element,window,sounds}=loadGame();api.initial('gold');const state=api.state();
  window.location={protocol:'file:'};
  window.AudioContext=class{constructor(){throw new Error('Local-file audio must bypass Web Audio');}};
  state.mode='playing';state.room='goldInside';state.elves=[];state.dragons=[];
  Object.assign(state.player,{x:480,y:320});state.held='axe';state.items.axe.room='held';
  const sound=sounds.find(sound=>sound.src==='assets/gaster-disapear.mp3');assert(sound);
  window.joystickInput={x:1,y:0};element('dropBtn').onclick();assert.equal(sound.plays,0);
  for(let i=0;i<200&&state.axeFlights.axe;i++)api.updateAxe(.016);
  assert.equal(sound.plays,0);
  api.updateAxe(.39);assert.equal(sound.plays,0);assert.notEqual(state.items.axe.room,'absent');
  api.updateAxe(.02);assert.equal(sound.plays,0);
  api.updateAxe(30);assert.equal(sound.plays,0);assert.notEqual(state.items.axe.room,'absent');
});

test('putting down an unused axe does not consume it', () => {
  const {api,element,window}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';
  state.room='goldInside';Object.assign(state.player,{x:480,y:320});state.held='axe';state.items.axe.room='held';
  window.joystickInput={x:0,y:0};element('dropBtn').onclick();api.updateAxe(1);
  assert(!state.usedAxes.has('axe'));assert.equal(state.items.axe.room,'goldInside');
});

test('an axe remains after a stunning hit', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();state.mode='playing';state.room='goldInside';
  state.elves=[];state.dragons=[];Object.assign(state.player,{x:480,y:320});
  state.items.axe={room:state.room,x:440,y:320};
  state.axeFlights.axe={room:state.room,vx:650,vy:0,travelled:0,age:0,thrower:'west'};
  api.updateAxe(.1);assert.equal(state.mode,'playing');assert.equal(state.player.stunTimer,5);assert(!state.usedAxes.has('axe'));
  api.updateAxe(30);assert.equal(state.axeFades.axe,undefined);assert.notEqual(state.items.axe.room,'absent');
});

test('the thrown axe passes through the thrower for half a second, then collides normally', () => {
  const { api, element, window }=loadGame();api.initial('gold');
  const state=api.state();state.mode='playing';state.room='westInside';state.player.x=480;state.player.y=320;state.held='axe';window.joystickInput={x:1,y:0};
  state.items.jewelRed.room='absent';
  element('dropBtn').onclick();api.updateAxe(.1);
  state.player.x=600;api.updateAxe(.1);
  assert(state.axeFlights.axe);assert(state.items.axe.x>600);
  state.player.x=810;api.updateAxe(.29);assert(state.axeFlights.axe);
  assert(Math.abs(state.axeFlights.axe.age-.49)<.001);
  api.updateAxe(.03);assert.equal(state.axeFlights.axe,null);
  assert(Math.abs(state.items.axe.x-state.player.x)<36);
});

test('thrown axes land on objects and characters without damaging them, and cross open exits', () => {
  const { api, element, window }=loadGame();
  for(const target of ['item','dragon','bat','elf']){
    api.initial('gold');const state=api.state();state.mode='playing';state.room=target==='elf'?'west':'westInside';state.player.x=target==='elf'?770:480;state.player.y=target==='elf'?530:320;state.held='axe';
    if(target==='item')state.items.apple={room:state.room,x:650,y:320};
    if(target==='dragon')Object.assign(state.dragons[0],{room:state.room,x:650,y:320});
    if(target==='bat')Object.assign(state.bat,{room:state.room,x:650,y:320});
    window.joystickInput=target==='elf'?{x:0,y:-1}:{x:1,y:0};element('mobileDropBtn').onclick();api.updateAxe(1);
    assert.equal(state.axeFlights.axe,null);assert.equal(state.items.axe.room,state.room);
    if(target==='elf')assert(state.items.axe.y>445);else assert(state.items.axe.x>480&&state.items.axe.x<650);
    assert(state.dragons.every(d=>!d.dead));
  }
  api.initial('gold');const state=api.state();state.mode='playing';state.room='stone';state.player.x=880;state.player.y=280;state.held='axe';state.heldSide='right';window.joystickInput={x:1,y:0};
  element('dropBtn').onclick();api.updateAxe(.2);assert.equal(state.items.axe.room,'crossroads');assert(state.axeFlights.axe);
});

test('the reference castle has solid towers, an open upper notch, and a working raised gate', () => {
  const {api}=loadGame();api.initial('gold');const state=api.state();
  assert(api.blocked('gold',350,170,true));assert(api.blocked('gold',620,170,true));
  assert(!api.blocked('gold',488,170,true),'upper center matches the reference opening');
  assert(api.blocked('gold',488,300,true),'center of castle remains solid');
  assert(api.blocked('gold',480,440,true),'closed lattice blocks entrance');
  state.gates.gold=true;state.gateLift.gold=1;
  assert(!api.blocked('gold',480,440,true),'raised gate leaves doorway open');
});

test('Golden Castle side doors are closed and its gold key is accessible', () => {
  const { api }=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state(),exits=api.visibleExits('gold');
    assert.equal(exits.left,false);assert.equal(exits.right,false);
    assert.equal(state.items.goldKey.room,'gold');
    assert(!api.blocked('gold',state.items.goldKey.x,state.items.goldKey.y));
    for(const d of [api.dir.left,api.dir.right]){
      assert.equal(api.neighbor('gold',d),'gold');
      assert.equal(api.batNeighbor('gold',d),'gold');
    }
  }
  api.initial('gold');
  assert.equal(api.neighbor('west',api.dir.right),'west');
  assert.equal(api.neighbor('blueGate',api.dir.left),'blueGate');
  assert.equal(api.neighbor('gold',api.dir.down),'crossroads');
  const seen=new Set(['gold']),queue=['gold'];
  for(let i=0;i<queue.length;i++)for(const room of api.connectedRooms(queue[i]))if(!seen.has(room)){seen.add(room);queue.push(room);}
  for(const room of api.grid.flat().filter(room=>room&&room!=='south'))assert(seen.has(room));
  assert.equal(api.state().items.chalice,undefined);
});

test('Southern Wilds north door connects to The Crossroads while other doors stay closed', () => {
  const { api,window }=loadGame();api.initial('gold');
  assert.equal(api.neighbor('south',api.dir.up),'crossroads');assert.equal(api.neighbor('crossroads',api.dir.down),'south');
  assert.equal(api.batNeighbor('south',api.dir.up),'crossroads');
  for(const direction of [api.dir.left,api.dir.right,api.dir.down])assert.equal(api.neighbor('south',direction),'south');
  for(const [x,y] of [[5,320],[955,320],[480,635]])assert(api.blocked('south',x,y));
  assert(!api.blocked('south',480,5));
  for(const [from,y,dy,to] of [['south',5,-1,'crossroads'],['crossroads',635,1,'south']]){
    api.initial('gold');
    const state=api.state();state.mode='playing';state.room=from;state.dragons=[];Object.assign(state.player,{x:480,y});
    window.joystickInput={x:0,y:dy};api.movePlayer(.1);assert.equal(state.room,to);
  }
});

test('all dragons stay still off screen without a chase or escape route', () => {
  for(const mode of ['gold','easy','random']){
    const {api,chaseMetrics}=loadGame(true);api.initial(mode);const state=api.state();state.mode='playing';state.room='goldInside';
    const starts=state.dragons.map(d=>({room:d.room,x:d.x,y:d.y}));const searches=chaseMetrics.routes;
    for(let frame=0;frame<180;frame++)api.updateDragons(1/60);
    assert.deepEqual(state.dragons.map(d=>({room:d.room,x:d.x,y:d.y})),starts);
    assert.equal(chaseMetrics.routes,searches,'idle off-screen dragons do not search for routes');
  }
});

test('every dragon uses the same basic pursuit when the player shares its room', () => {
  for(const name of ['Yorgle','Grundle','Rhindle']){
    const {api}=loadGame();api.initial('gold');const state=api.state();state.room='crossroads';state.mode='playing';state.elves=[];
    const dragon=state.dragons.find(d=>d.name===name);state.dragons=[dragon];
    Object.assign(dragon,{room:state.room,x:300,y:320});Object.assign(state.player,{x:600,y:320});
    api.updateDragons(.1);assert(Math.abs(dragon.x-(300+dragon.speed*.1))<1e-8,name+' chases at its normal speed');
  }
});

test('Rhindle follows out of White Castle', () => {
  for(const mode of ['gold','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';
    const red=state.dragons.find(d=>d.name==='Rhindle');state.dragons=[red];state.elves=[];
    state.room='whiteInside';state.gates.white=true;state.gateLift.white=1;
    api.enter('white',480,530);
    for(let step=0;step<400&&red.room==='whiteInside';step++)api.updateDragons(.05);
    assert.equal(red.room,'white');assert.equal(state.items.jewelPurple.room,'whiteInside');
  }
});

test('dragons reuse obstacle routes and replan when the chase target moves', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  const red=state.dragons.find(d=>d.name==='Rhindle');state.dragons=[red];state.elves=[];
  state.mode='playing';state.room='white';state.held='jewelPurple';state.items.jewelPurple.room='held';
  Object.assign(red,{room:'white',x:150,y:150});Object.assign(state.player,{x:730,y:320});
  for(let frame=0;frame<180;frame++)api.updateDragons(1/60);
  assert(chaseMetrics.routes>0&&chaseMetrics.routes<=3,'a stationary target reuses its route');
  assert(Math.hypot(red.x-150,red.y-150)>150,'route reuse still advances the dragon around obstacles');
  const searches=chaseMetrics.routes;Object.assign(state.player,{x:150,y:500});
  for(let frame=0;frame<30;frame++)api.updateDragons(1/60);
  assert(chaseMetrics.routes>searches,'moving the target behind an obstacle triggers a new route');
});

test('dragons throttle retries for unreachable targets and recover when the target becomes reachable', () => {
  const {api,chaseMetrics}=loadGame(true);api.initial('gold');const state=api.state();
  const red=state.dragons.find(d=>d.name==='Rhindle');state.dragons=[red];state.elves=[];
  state.mode='playing';state.room='whiteInside';state.held='jewelPurple';state.items.jewelPurple.room='held';
  Object.assign(red,{x:480,y:400});Object.assign(state.player,{x:10,y:10});
  for(let frame=0;frame<180;frame++)api.updateDragons(1/60);
  assert(chaseMetrics.routes<=4,'failed routes are retried at most once every 0.75 seconds');
  Object.assign(state.player,{x:480,y:200});const initialY=red.y;
  for(let frame=0;frame<30;frame++)api.updateDragons(1/60);
  assert(red.y<initialY,'the dragon resumes pursuit when a direct path opens');
});

test('the bat and green dragon start in Southern Wilds, and the bat can leave through its north door', () => {
  const { api }=loadGame();
  for(const mode of ['gold','easy','random']){
    api.initial(mode);const state=api.state();state.mode='playing';
    assert.equal(state.bat.room,'south');
    assert.equal(state.dragons.length,4);
    assert.equal(state.dragons.find(d=>d.name==='Grundle').room,'south');
    for(const dragon of state.dragons)assert(!api.blocked(dragon.room,dragon.x,dragon.y));
    api.updateDragons(120);
    for(const [x,y,vx,vy] of [[-1,320,-1,0],[961,320,1,0],[480,-1,0,-1],[480,641,0,1]]){
      Object.assign(state.bat,{room:'south',x,y,vx,vy});api.updateBat(0);assert.equal(state.bat.room,y<0?'crossroads':'south');
    }
    assert.equal(state.dragons.find(d=>d.name==='Grundle').room,'south');
    assert.equal(state.dragons.find(d=>d.name==='Rhindle').room,'whiteInside');
  }
});

test('dead dragons block movement from all sides while allowing the player to escape overlap', () => {
  const { api, window }=loadGame();
  for(const [x,y,dx,dy] of [[440,320,1,0],[520,320,-1,0],[480,250,0,1],[480,390,0,-1]]){
    api.initial('easy');const state=api.state();state.mode='playing';state.room='crossroads';
    state.player.x=x;state.player.y=y;
    const dragon=state.dragons[0];Object.assign(dragon,{room:'crossroads',x:480,y:320,dead:true,enteringFromBelow:false});
    window.joystickInput={x:dx,y:dy};api.movePlayer(.05);
    assert.equal(state.player.x,x);assert.equal(state.player.y,y);
    dragon.dead=false;api.movePlayer(.05);
    assert(dx?state.player.x!==x:state.player.y!==y);
  }
  api.initial('easy');const state=api.state();state.mode='playing';state.room='crossroads';
  Object.assign(state.dragons[0],{room:'crossroads',x:480,y:320,dead:true,enteringFromBelow:false});
  state.player.x=490;state.player.y=320;window.joystickInput={x:1,y:0};api.movePlayer(.05);
  assert(state.player.x>490);
  state.dragons[0].room='west';state.player.x=440;api.movePlayer(.05);assert(state.player.x>440);
});

test('Easy exits follow the requested map and close absent connections', () => {
  const { api } = loadGame();
  api.initial('easy');
  const expected = {
    gold: { down: 'crossroads' },
    crossroads: { up: 'gold', down:'south', left: 'west', right: 'blueVault' },
    west: { right: 'crossroads' },
    blueVault: {left:'crossroads',down:'moonwoodTrail'},
    moonwoodTrail: {up:'blueVault',down:'blackApproach'},
    blackApproach: { up: 'moonwoodTrail', right:'moonwoodShrine', down:'blackApproachSouth' },
    moonwoodShrine: {left:'blackApproach'},
    blackApproachSouth: { up: 'blackApproach', down: 'greyDungeon' }, greyDungeon: { up: 'blackApproachSouth' }
  };
  for (const [room, exits] of Object.entries(expected)) {
    for (const [edge, direction] of Object.entries(api.dir)) {
      assert.equal(api.visibleExits(room)[edge], !!exits[edge], room + ' ' + edge);
      assert.equal(api.neighbor(room, direction), exits[edge] || room);
      if (exits[edge]) assert(api.dragonDoor(room, exits[edge]), room + ' route');
    }
  }
  for (const room of ['goldInside']) {
    assert.equal(api.visibleExits(room).up, false);
    assert.equal(api.visibleExits(room).down, true);
    assert.equal(api.blocked(room, 480, 20), true);
  }
  assert.equal(api.dragonDoor('blackInside', 'greyDungeon'), null);


  assert.equal(api.wallColor('greyDungeon'), '#8C58B8');
  assert.equal(api.dragonDoor('mazeTR','greyDungeon'),null);
  assert.equal(api.dragonDoor('greyDungeon','mazeTR'),null);
  assert.equal(api.batNeighbor('gold', api.dir.left), 'gold');
  assert(!api.connectedRooms('mazeTR').includes('greyDungeon'));
  api.initial('gold');
  assert.equal(JSON.stringify(api.grid), JSON.stringify(api.hardGrid));

  assert.equal(api.state().items.chalice,undefined);
});


test('the full center opening connects Witchlight Crossing and Starless Sanctum', () => {
  const { api, window } = loadGame();
  for (const [from, to, y, dy] of [['mazeMR', 'mazeBR', 620, 1], ['mazeBR', 'mazeMR', 20, -1]]) {
    for (const x of [396, 420, 444, 480, 516, 540, 564]) {
      api.initial('easy');
      const state = api.state();
      state.mode = 'playing';
      state.room = from;
      state.player.x = x;
      state.player.y = y;
      state.dragons = [];
      window.joystickInput = { x: 0, y: dy };
      for (let step = 0; step < 12 && state.room === from; step++) api.movePlayer(.016);
      assert.equal(state.room, to, `${from} crossing at x=${x}`);
      assert.equal(api.blocked(to, state.player.x, state.player.y), false);
    }
  }
});

test('Winding Wood south leads through the copied Blue Labyrinth Gate and Blue Vault', () => {
  for(const mode of ['gold','easy','random']){
    const {api,window,element}=loadGame();api.initial(mode);const state=api.state();state.mode='playing';state.elves=[];state.dragons=[];
    for(const [from,to,y,dy] of [['blueMaze','labyrinthApproach',620,1],['labyrinthApproach','blueMaze',20,-1],['labyrinthApproach','labyrinthGate',620,1],['labyrinthGate','labyrinthApproach',20,-1],['labyrinthGate','labyrinthVault',620,1],['labyrinthVault','labyrinthGate',20,-1]]){
      window.joystickInput={x:0,y:0};api.update(.4);state.room=from;Object.assign(state.player,{x:480,y});window.joystickInput={x:0,y:dy};
      assert(api.dragonDoor(from,to));assert.equal(api.neighbor(from,dy>0?api.dir.down:api.dir.up),to);
      for(let step=0;step<20&&state.room===from;step++)api.movePlayer(.016);
      assert.equal(state.room,to,mode+' '+from+' to '+to);assert(!api.blocked(to,state.player.x,state.player.y));
    }
    for(const room of ['labyrinthGate','labyrinthVault']){
      assert(api.blocked(room,210,150));assert.equal(api.visibleExits(room).left,false);assert.equal(api.visibleExits(room).right,room==='labyrinthVault');
      assert(element('map').innerHTML.includes('data-room="'+room+'"'));assert(api.teleportToRoom(room));
    }
    assert.equal(api.visibleExits('labyrinthVault').down,false);
    assert.deepEqual(JSON.parse(JSON.stringify(api.visibleExits('labyrinthApproach'))),{left:false,right:false,up:true,down:true});
    assert(api.blocked('labyrinthApproach',20,320));assert(api.blocked('labyrinthApproach',940,320));
    for(const x of [100,210,480,750,860])for(const y of [100,540])assert(!api.blocked('labyrinthApproach',x,y),'approaches to the obstacle remain open');
    for(const x of [60,210,480,750,900])assert(api.blocked('labyrinthApproach',x,320),'obstacle spans the room');
    assert(api.blocked('labyrinthApproach',240,220));assert(api.blocked('labyrinthApproach',720,420));
    assert(element('map').innerHTML.includes('data-room="labyrinthApproach"'));
  }
});

test('Rootbound Vault remains disconnected from Winding Wood', () => {
  const {api}=loadGame();api.initial('gold');
  assert.equal(api.neighbor('blueMaze',api.dir.down),'labyrinthApproach');
  assert.equal(api.visibleExits('blueMaze').down,true);
  assert.equal(api.blocked('blueMaze',480,620),false);
  assert.equal(api.neighbor('greyDungeon',api.dir.up),'greyDungeon');
  assert(api.blocked('greyDungeon',480,20));
  assert.equal(api.dragonDoor('blueMaze','greyDungeon'),null);
  assert.equal(api.dragonDoor('greyDungeon','blueMaze'),null);
});

test('Western Maze is blocked from Rootbound Vault in both directions', () => {
  const { api, window }=loadGame();
  for(const [from,y,dy,to] of [['mazeTR',5,-1,'greyDungeon'],['greyDungeon',635,1,'mazeTR']]){
    api.initial('easy');
    const state=api.state();state.mode='playing';state.room=from;state.player.x=480;state.player.y=y;
    window.joystickInput={x:0,y:dy};api.movePlayer(.1);
    assert.equal(state.room,from==='mazeTR'?'black':from);
    if(from==='greyDungeon')assert.equal(api.blocked(from,480,y),true);
    assert(!api.connectedRooms(from).includes(to));
  }
});

test('Ruby Grove doors match the centered eighty percent crossing doors and Moonwood west stays closed', () => {
  const { api, window }=loadGame();
  for(const [room,x,dx] of [['west',955,1]]){
    for(const y of [80,100,540,560]){
      api.initial('easy');
      const state=api.state();state.mode='playing';state.room=room;state.player.x=x;state.player.y=y;
      assert.equal(api.blocked(room,x,y),false);
      window.joystickInput={x:dx,y:0};api.movePlayer(.1);
      assert.equal(state.room,'crossroads');
      assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
    }
    api.initial('easy');
    for(const y of [0,64,78,562,576,640])assert.equal(api.blocked(room,x,y),true);
  }
  assert.equal(api.wallColor('blackApproach'),'#1E3221');
  assert.equal(api.wallColor('moonwoodShrine'),'#1E3221');
  for(const y of [80,100,320,540,560])assert(api.blocked('blackApproach',5,y));
  api.initial('gold');
  assert.equal(api.blocked('west',955,100),true);
  assert.equal(api.blocked('blackApproach',5,540),true);
});

test('Wayfarer Crossing has green walls and centered side doors spanning eighty percent of its height', () => {
  const { api, window } = loadGame();
  for(const [x,dx,destination] of [[5,-1,'west'],[955,1,'blueVault']]){
    for(const y of [80,100,540,560]){
      api.initial('easy');
      const state=api.state();state.mode='playing';state.room='crossroads';
      state.player.x=x;state.player.y=y;
      assert.equal(api.wallColor('crossroads'),'#74B474');
      assert.equal(api.blocked('crossroads',x,y),false);
      window.joystickInput={x:dx,y:0};
      api.movePlayer(.1);
      assert.equal(state.room,destination);
      assert.equal(api.blocked(state.room,state.player.x,state.player.y),false);
    }
    api.initial('easy');
    for(const y of [0,64,78,562,576,640])assert.equal(api.blocked('crossroads',x,y),true);
  }
  api.initial('gold');
  assert.equal(api.blocked('crossroads',5,100),true);
  assert.notEqual(api.wallColor('crossroads'),'#74B474');
});

test('each elf starts with an axe and home key in separate treasure boxes in every mode', () => {
  for(const mode of ['gold','entry','easy','random']){
    const {api}=loadGame();api.initial(mode);const state=api.state();
    for(const [home,axe] of Object.entries({west:'axe4',blueGate:'axe5',redTrail:'axe6'})){
      for(const [id,y] of [[axe,340],[home+'Key',265]]){
        const item=state.items[id];
        assert.equal(item.room,home+'Inside');assert.equal(item.x,625);assert.equal(item.y,y);
        assert.equal(item.treasureOwner,home);
        assert.equal(item.elfAssessment.home,home,'stored axes are already assessed possessions');
      }
    }
    assert.equal(state.items.axe.room,'goldInside');assert.equal(state.items.axe2.room,'mazeML');assert.equal(state.items.axe3.room,'absent');
  }
});

test('waiting cottage gifts send every roaming elf home immediately for review',()=>{
  for(const home of ['west','blueGate','redTrail']){
    const {api,element}=loadGame();api.initial('gold');element('hints').hidden=true;
    const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];state.bat.room='absent';
    for(const item of Object.values(state.items))item.room='absent';
    const elf=state.elves.find(e=>e.home===home);state.elves=[elf];
    Object.assign(elf,{room:'crossroads',x:480,y:320,goal:{x:520,y:320,clearDoorway:true},path:[{x:520,y:320}],wait:4,carrying:null,giftTask:null,giftsReceived:0,emotionalState:{sentiment:2,passion:2}});
    state.gates[home]=true;state.gateLift[home]=1;
    const id=home==='blueGate'?'flower':'coin';state.items[id]={room:home+'Inside',x:245,y:320};
    api.updateElves(.05);assert.equal(elf.giftTask?.id,id);assert(elf.wait<=0);
    for(let i=0;i<3000&&elf.giftsReceived===0;i++)api.updateElves(.05);
    assert.equal(elf.giftsReceived,1,home+' must return home and assess its gift');
    assert.equal(elf.room,home+'Inside');assert.equal(elf.emotionalState.sentiment,3);
  }
});

test('owners can return to review gifts when the player has taken their key and closed the cottage gate',()=>{
  for(const home of ['west','blueGate','redTrail']){
    const {api,element}=loadGame();api.initial('gold');element('hints').hidden=true;
    const state=api.state();state.mode='playing';state.room='lamplightLanding';state.dragons=[];state.bat.room='absent';
    for(const item of Object.values(state.items))item.room='absent';
    const elf=state.elves.find(e=>e.home===home);state.elves=[elf];
    Object.assign(elf,{room:home==='redTrail'?'lamplightLanding':'crossroads',x:480,y:530,goal:null,path:[],wait:0,carrying:null,giftTask:null,giftsReceived:0,emotionalState:{sentiment:2,passion:2}});
    state.gates[home]=false;state.gateLift[home]=0;
    state.held=home+'Key';state.items[state.held].room='held';
    const id=home==='blueGate'?'flower':'coin';state.items[id]={room:home+'Inside',x:245,y:320};
    for(let i=0;i<3000&&elf.giftsReceived===0;i++)api.updateElves(.05);
    assert.equal(elf.giftsReceived,1,home+' should use its own locked front door');
    assert.equal(elf.room,home+'Inside');assert.equal(state.gates[home],false);
    const door=api.dragonDoor(home,home+'Inside');
    assert(api.blocked(home,door.exit.x,door.exit.y,true),'closed gate still blocks the player');
  }
});

test('Sad Hateful elves fetch their cottage axe and hunt the player across rooms',()=>{
  for(const [home,id] of Object.entries({west:'axe4',blueGate:'axe5',redTrail:'axe6'})){
    const {api,element}=loadGame();api.initial('gold');element('hints').hidden=true;
    const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];state.bat.room='absent';
    const axe={...state.items[id]};for(const item of Object.values(state.items))item.room='absent';state.items[id]=axe;
    const elf=state.elves.find(e=>e.home===home);state.elves=[elf];
    Object.assign(elf,{room:home,x:770,y:500,goal:null,path:[],wait:0,carrying:'lamp',giftTask:null,emotionalState:{sentiment:1,passion:3}});
    state.items.lamp.room='elf:'+home;state.gates[home]=false;state.gateLift[home]=0;Object.assign(state.player,{x:600,y:320});
    let thrown=false;
    for(let i=0;i<2000&&!thrown;i++){
      api.updateElves(.05);thrown=Object.values(state.axeFlights).some(f=>f?.thrower===home);
    }
    assert(thrown,home+' must find its axe and attack');assert.equal(elf.room,'crossroads');
    assert.equal(state.items.lamp.room,home,'previously carried item is safely dropped');
    for(let i=0;i<100&&!state.player.stunTimer;i++)api.updateAxe(.01);
    assert.equal(state.mode,'playing');assert.equal(state.player.stunTimer,5,'axe hits remain stunning');
  }
});

test('elves hold their axes while the player is stunned and resume throwing after recovery',()=>{
  for(const home of ['west','blueGate','redTrail']){
    const {api,element}=loadGame();api.initial('gold');element('hints').hidden=true;
    const state=api.state();state.mode='playing';state.room='crossroads';state.dragons=[];state.bat.room='absent';
    for(const item of Object.values(state.items))item.room='absent';
    const elf=state.elves.find(e=>e.home===home);state.elves=[elf];
    Object.assign(elf,{room:state.room,x:300,y:320,wait:0,goal:null,path:[],carrying:'axe',giftTask:null,attackTimer:0,emotionalState:{sentiment:1,passion:3}});
    state.items.axe.room='elf:'+home;Object.assign(state.player,{x:600,y:320,stunTimer:5});
    for(let i=0;i<100;i++)api.updateElves(.05);
    assert.equal(elf.carrying,'axe');assert(!state.axeFlights.axe,home+' must not throw at a stunned player');
    state.player.stunTimer=0;Object.assign(elf,{x:300,y:320,goal:null,path:[],attackTimer:0});
    for(let i=0;i<10&&!state.axeFlights.axe;i++)api.updateElves(.05);
    assert.equal(state.axeFlights.axe?.thrower,home,'throwing resumes when the stun ends');
  }
});

