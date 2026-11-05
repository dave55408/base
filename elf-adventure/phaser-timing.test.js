const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function scene(){
  const steps=[];
  const context={window:{ElfAdventure:{step(dt){steps.push(dt);},frame(){return {};},tooltip(){}}},Phaser:{Scene:class {},Game:class {},AUTO:0,Scale:{FIT:0,CENTER_BOTH:0}}};
  vm.runInNewContext(fs.readFileSync(__dirname+'/phaser-scene.js','utf8'),context);
  const scene=new context.window.AdventureScene();
  scene.pool=new Map();scene.metrics={steps:0};scene.renderFrame=()=>{};
  return {scene,steps};
}

test('simulation runs sixty fixed updates per second at different display rates',()=>{
  for(const rate of [30,59,60,75,120,144]){
    const {scene:game,steps}=scene();
    for(let frame=0;frame<rate;frame++)game.update(0,1000/rate);
    assert.equal(steps.length,60,'display rate '+rate);
    assert(steps.every(dt=>dt===1/60));
  }
});

test('a delayed frame has bounded catch-up and retains fractional time',()=>{
  const {scene:game,steps}=scene();
  game.update(0,5);assert.equal(steps.length,0);
  game.update(0,1000);assert.equal(steps.length,6,'catch-up limited to 100ms');
  game.update(0,12);assert.equal(steps.length,7,'fractional time carries into the next frame');
});
