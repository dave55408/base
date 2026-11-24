const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('Chase and free-flight Cinema keep Enterprise low without changing camera distance or zoom',()=>{
  const root=path.join(__dirname,'..'),c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const mode of ['chase','cinematic'])for(const aspect of [.7,1.8,2.5])for(const freeFlight of [false,true]){
    if(mode==='cinematic'&&!freeFlight)continue;
    const s=Object.create(c.window.BattleScene.prototype);
    Object.assign(s,{T,mode,zoom:1.4,orbit:{x:0,y:0},sim:{player:{heading:0,pitch:0},enemy:{hull:100},range:1600,freeFlight,contact:true},camera:new T.PerspectiveCamera(46,aspect,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
    s.ships.Yorktown.position.set(0,150,-1600);
    const pos=new T.Vector3(),target=new T.Vector3();s.chaseCamera(pos,target);
    s.camera.position.copy(pos);s.camera.lookAt(target);s.camera.updateMatrixWorld();
    const before=s.camera.position.clone();s.frameEnterpriseLow();
    const y=(1-s.ships.Enterprise.position.clone().project(s.camera).y)/2;
    assert(Math.abs(y-.72)<1e-8);assert.equal(s.zoom,1.4);assert(s.camera.position.equals(before));
    s.frameEnterpriseLow();assert(Math.abs((1-s.ships.Enterprise.position.clone().project(s.camera).y)/2-.72)<1e-8,'lens shift does not accumulate');
    s.mode='tactical';s.frameEnterpriseLow();assert.equal(s.camera.projectionMatrix.elements[9],0);
  }
});

test('extra close Chase and free-flight Cinema zoom enlarges Enterprise while retaining low framing and hull clearance',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const mode of ['chase','cinematic'])for(const freeFlight of [false,true]){
    if(mode==='cinematic'&&!freeFlight)continue;
    const s=Object.create(c.window.BattleScene.prototype);
    Object.assign(s,{T,mode,zoom:.5,orbit:{x:0,y:0},sim:{player:{x:0,y:0,z:0,heading:0,pitch:0},enemy:{hull:100},range:1600,freeFlight,contact:false},camera:new T.PerspectiveCamera(46,1.8,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
    const compose=()=>{
      const pos=new T.Vector3(),target=new T.Vector3();s.chaseCamera(pos,target);s.trackFreeFlightCamera(pos,target);
      s.camera.position.copy(pos);s.camera.lookAt(target);s.camera.updateMatrixWorld();s.frameEnterpriseLow();
      const left=new T.Vector3(-20,0,0).project(s.camera),right=new T.Vector3(20,0,0).project(s.camera);
      return Math.abs(right.x-left.x);
    };
    const original=compose();s.zoom=.35;const close=compose();
    assert(close>original*1.3,'extra zoom gives a materially larger ship');
    assert(s.camera.position.length()>=110-1e-8,'camera stays outside the complete hull');
    const y=(1-s.ships.Enterprise.position.clone().project(s.camera).y)/2;
    assert(Math.abs(y-.72)<1e-8,'Enterprise remains low in the screen');
    s.mode='forward';s.frameEnterpriseLow();assert.equal(s.camera.zoom,1,'forward view restores its normal lens');
  }
});

test('Enterprise stays fixed at bottom center when an opponent crosses below it',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{mode:'chase',sim:{contact:true,enemy:{hull:100}},camera:new T.PerspectiveCamera(46,1.8,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
  s.camera.position.set(0,0,300);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();
  s.ships.Yorktown.position.set(0,-100,0);s.frameEnterpriseLow();
  const y=(1-s.ships.Enterprise.position.clone().project(s.camera).y)/2;
  assert(Math.abs(y-.72)<1e-8);assert(Math.abs(s.ships.Enterprise.position.clone().project(s.camera).x)<1e-8);
});

test('gameplay camera eases through turns and zoom while ignoring ship bank',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype),ship=new T.Group();
  Object.assign(s,{mode:'chase',sim:{},camera:new T.PerspectiveCamera(),ships:{Enterprise:ship}});
  const offset=new T.Vector3(0,45,235);s.trackGameplayCamera(offset.clone(),1/60,true);
  ship.rotation.set(0,Math.PI/2,.6,'YXZ');ship.position.set(100,50,-500);
  const rotation=s.levelChaseRotation(),desired=offset.clone().applyQuaternion(rotation).add(ship.position);
  const before=s.camera.position.clone().sub(new T.Vector3(0,0,0));
  s.trackGameplayCamera(desired,1/60);
  assert(s.camera.position.clone().sub(ship.position).distanceTo(before)<15,'turn starts gradually instead of snapping around the ship');
  for(let i=0;i<240;i++)s.trackGameplayCamera(desired,1/60);
  assert(s.camera.position.distanceTo(desired)<.15,'camera settles behind the new heading');
  const level=s.levelChaseRotation();ship.rotation.z=-.6;
  assert(s.levelChaseRotation().angleTo(level)<1e-7,'banking does not move the chase camera');
  const oldDistance=s.camera.position.distanceTo(ship.position),closer=new T.Vector3(0,22,108).applyQuaternion(level).add(ship.position);
  s.trackGameplayCamera(closer,1/60);const nextDistance=s.camera.position.distanceTo(ship.position);
  assert(nextDistance<oldDistance&&nextDistance>oldDistance-10,'zoom distance eases in');
  assert.equal(s.camera.up.y,1);
  s.mode='forward';assert.equal(s.trackGameplayCamera(closer,1/60),false);assert.equal(s.gameplayCameraOffset,null);
});
