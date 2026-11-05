const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={','globalThis.testApi={callDarkFriend,assignForestHelper,assignDarkHelper,helpingBellSprite,jewelFlashColor,sprites,')
  .replace('getElementById: element,',`getElementById: element,
    createElement(){const canvas={width:2,height:1};canvas.getContext=()=>({
      drawImage(source){this.source=source;},getImageData(){return {data:new Uint8ClampedArray(this.source.pixelData||[113,83,56,255,113,83,56,255])};},putImageData(pixels){canvas.pixelData=pixels.data;}
    });return canvas;},`);
const scope={require,__dirname,console};
vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('successful calls immediately repeat a two-second cycle every four seconds until arrival',()=>{
  const {api}=scope.load();api.initial('gold');
  const state=api.state(),helper=state.elves[0];
  Object.assign(helper,{stunTimer:0,surpriseTimer:0,stolenItems:{},emotionalState:{sentiment:3,passion:1}});
  api.sprites.forestBell={width:2,height:1};
  const cycle=['#A8A8A8','#C4A000','#D86000','#D01C00','#B00020','#800080','#4010BC','#0034B8','#0068A0','#008060','#008818','#388400','#707400','#A05800','#B84000','#C02040'];
  for(const [room,quest] of [['moonwoodShrine',state.forestQuest],['lamplightLanding',state.darkQuest]]){
    state.room=room;quest.helper=null;quest.returning=false;quest.requested=true;
    helper.forestHolding=false;helper.carrying=null;helper.room='west';
    state.jewelFlashElapsed=10;quest.bellCycleStart=10;
    assert(api.helpingBellSprite(),'accepted pending calls cycle while a friend is busy');
    quest.helper=helper.home;
    for(const start of [10,14,18])for(let i=0;i<cycle.length;i++){
      state.jewelFlashElapsed=start+i*2/cycle.length;
      assert.equal(api.helpingBellSprite().flashColor,cycle[i]);
    }
    for(const time of [12,13,13.9,16,17,17.9]){
      state.jewelFlashElapsed=time;
      assert.equal(api.helpingBellSprite(),null,'bell stays brown between cycles');
    }
    state.jewelFlashElapsed=10.5;helper.stunTimer=1;
    assert.equal(api.helpingBellSprite(),null);helper.stunTimer=0;
    if(room==='moonwoodShrine')helper.forestHolding=true;
    else Object.assign(helper,{room:'midnightVault',carrying:'lamp',x:150,y:130});
    for(const time of [10.5,18,26.5]){
      state.jewelFlashElapsed=time;
      assert.equal(api.helpingBellSprite(),null,'arrival stops this cycle and all later cycles');
    }
    quest.helper=null;quest.requested=false;
    assert.equal(api.helpingBellSprite(),null);
  }
});

test('a three-pixel inward border changes color without expanding the outline or enclosed holes',()=>{
  const {api}=scope.load();api.initial('gold');
  const state=api.state(),helper=state.elves[0];
  Object.assign(helper,{stunTimer:0,surpriseTimer:0,stolenItems:{},forestHolding:false,emotionalState:{sentiment:3,passion:1}});
  const pixelData=new Uint8ClampedArray(13*13*4);
  for(let y=1;y<=11;y++)for(let x=1;x<=11;x++)if(x!==6||y!==6)pixelData.set([113,83,56,255],(y*13+x)*4);
  pixelData.set([255,255,255,255],(2*13+2)*4);
  api.sprites.forestBell={width:13,height:13,pixelData};
  state.room='moonwoodShrine';state.forestQuest.helper=helper.home;state.forestQuest.bellCycleStart=0;state.jewelFlashElapsed=0;
  const sprite=api.helpingBellSprite();
  for(let y=0;y<13;y++)for(let x=0;x<13;x++){
    const i=(y*13+x)*4,edge=x>=1&&x<=11&&y>=1&&y<=11&&(x<=3||x>=9||y<=3||y>=9)&&!(x===2&&y===2);
    assert.deepEqual(Array.from(sprite.pixelData.slice(i,i+4)),edge?[168,168,168,255]:Array.from(pixelData.slice(i,i+4)),`pixel ${x},${y}`);
  }
});

test('ringing either bell immediately assigns a busy friend and starts feedback',()=>{
  for(const forest of [true,false]){
    const {api}=scope.load();api.initial('gold');
    const state=api.state(),helper=state.elves[0];state.elves=[helper];
    Object.assign(helper,{stunTimer:0,surpriseTimer:0,stolenItems:{},giftTask:{id:'coin',feeling:'likes'},carrying:null,room:'west',forestHolding:false,emotionalState:{sentiment:3,passion:1}});
    api.sprites.forestBell={width:2,height:1};
    state.room=forest?'moonwoodShrine':'lamplightLanding';state.held=null;state.bat.carrying=null;
    state.items.lamp={room:'lamplightLanding',x:320,y:365};state.jewelFlashElapsed=7;
    (forest?api.callForestFriend:api.callDarkFriend)();
    const quest=forest?state.forestQuest:state.darkQuest;
    assert.equal(quest.helper,helper.home);assert.equal(quest.bellCycleStart,7);assert(api.helpingBellSprite());
    assert.equal(helper.giftTask,null);assert.equal(helper.bellPausedGift.task.id,'coin');
    helper.emotionalState.sentiment=1;quest.helper=null;
    (forest?api.callForestFriend:api.callDarkFriend)();
    assert.equal(api.helpingBellSprite(),null,'unanswered calls stay brown');
  }
});
