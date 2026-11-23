const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function setup(){
  const root=path.join(__dirname,'..'),document={fullscreenElement:null};
  const c={window:{},document,console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,camera:new T.PerspectiveCamera(46,2,.5,65000),zoom:1.3,orbit:{x:.4,y:.2},renderer:{setSize(){}},host:{clientWidth:1200,clientHeight:600,getBoundingClientRect(){return {height:this.visibleHeight};},visibleHeight:360}});
  return {s,document};
}
test('fullscreen reveals additional space without changing apparent ship size or framing',()=>{
  const {s,document}=setup();s.resizeViewport();
  const focal=s.host.visibleHeight/(2*Math.tan(s.camera.fov*Math.PI/360));
  document.fullscreenElement={contains:host=>host===s.host};
  Object.assign(s.host,{clientWidth:1920,clientHeight:1080,visibleHeight:1080});s.resizeViewport();
  assert(Math.abs(s.host.visibleHeight/(2*Math.tan(s.camera.fov*Math.PI/360))-focal)<1e-8);
  assert(s.camera.fov>46);assert.equal(s.framingAspect,2);assert.equal(s.framingFov,46);
  assert.equal(s.zoom,1.3);assert.equal(s.orbit.x,.4);
  // Fullscreen window resizing keeps the original pixel scale too.
  Object.assign(s.host,{clientWidth:1600,clientHeight:900,visibleHeight:900});s.resizeViewport();
  assert(Math.abs(900/(2*Math.tan(s.camera.fov*Math.PI/360))-focal)<1e-8);
  document.fullscreenElement=null;Object.assign(s.host,{clientWidth:1200,clientHeight:600,visibleHeight:360});s.resizeViewport();
  assert.equal(s.camera.fov,46);assert.equal(s.camera.aspect,2);assert.equal(s.fullscreenFraming,null);
});
