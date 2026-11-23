const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('starfield surrounds the nebula and renders behind its translucent clouds',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','geometry.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const scene=Object.create(c.window.BattleScene.prototype),T=scene.T=c.window.AlpineThree;scene.scene=new T.Scene();scene.makePlanet=()=>new T.Group();scene.makeSpace();
  const stars=scene.stars.geometry.attributes.position.array;assert.equal(stars.length,6000*3);
  for(let i=0;i<stars.length;i+=3){const radius=Math.hypot(stars[i],stars[i+1],stars[i+2]);assert(radius>=45999&&radius<=54001);}
  assert(scene.stars.renderOrder<scene.nebula.renderOrder);assert.equal(scene.nebula.material.transparent,true);assert.equal(scene.nebula.material.depthWrite,false);
  assert(scene.stars.material.size>=100,'stars remain visible at their background distance');
});
