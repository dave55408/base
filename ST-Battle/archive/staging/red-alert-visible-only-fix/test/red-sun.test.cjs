const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('distant red sun stays in a fixed sky direction and supplies matching directional light',()=>{
  const root=path.join(__dirname,'..'),c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,scene:new T.Scene(),camera:new T.PerspectiveCamera(46,1.8,.5,65000),warmLight:new T.DirectionalLight()});
  s.makeRedSun();assert.equal(s.redSun.children.length,2);
  for(const position of [[0,0,0],[3000,500,-8000],[50000,20000,-60000]]){
    s.camera.position.set(...position);s.camera.lookAt(s.camera.position.clone().add(new T.Vector3(0,0,-1)));s.updateRedSun();
    const offset=s.redSun.position.clone().sub(s.camera.position);
    assert(Math.abs(offset.length()-50000)<1e-8);assert(offset.normalize().distanceTo(s.redSunDirection)<1e-8);
    const lighting=s.warmLight.position.clone().sub(s.warmLight.target.position).normalize();
    assert(lighting.distanceTo(s.redSunDirection)<1e-8);
  }
  assert(s.warmLight.color.r>s.warmLight.color.g*2);
  assert.equal(s.redSun.children[0].material.depthWrite,false);
  assert.equal(s.redSunHalo.material.blending,T.AdditiveBlending);
});
