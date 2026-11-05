const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={','globalThis.testApi={handleKeyDown,');
const scope={require,__dirname,console};
vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('page load stays on the title screen until the start button is clicked',()=>{
  const {api,element}=scope.load();
  assert.equal(api.state().mode,'title');assert.equal(element('overlay').hidden,false);
  assert.equal(api.state().room,'entry');
  assert(api.blocked('entry',480,610),'the former doorway is now a solid wall');
  assert(!api.sceneFrame().entities.some(entity=>entity.id==='item:goldKey'),'no key on the title screen');
  element('game').getBoundingClientRect=()=>({left:0,top:0,width:960,height:640});
  element('hardModeBtn').getBoundingClientRect=()=>({left:460,right:520,top:500,bottom:560});
  api.update(0);api.update(10);
  assert.equal(api.state().mode,'title','overlapping the start button must not start a quest');
  for(const key of ['r','Enter',' '])api.handleKeyDown({key,preventDefault(){}});
  assert.equal(api.state().mode,'title','game shortcuts do not bypass the title screen');
  element('hardModeBtn').onclick();
  assert.equal(api.state().mode,'playing');
});

test('moving the title cursor onto Hard starts the quest',()=>{
  const {api,element}=scope.load();
  element('game').getBoundingClientRect=()=>({left:0,top:0,width:960,height:640});
  element('hardModeBtn').getBoundingClientRect=()=>({left:460,right:520,top:400,bottom:440});
  api.handleKeyDown({key:'ArrowUp',preventDefault(){}});
  api.update(.12);
  assert.equal(api.state().mode,'playing');assert.equal(api.state().room,'gold');
});

test('title uses only the foreground cursor and refreshes it as the player moves',()=>{
  const {api,drawings}=scope.load();
  let frame=api.sceneFrame();
  assert.equal(frame.entities.length,0,'no duplicate Phaser cursor behind the text');
  const before=drawings.at(-1).rect;
  api.state().player.x+=60;api.state().player.y-=40;
  frame=api.sceneFrame();
  assert.equal(drawings.at(-1).rect[0],before[0]+60);
  assert.equal(drawings.at(-1).rect[1],before[1]-40);
  assert.equal(frame.entities.length,0);
});
