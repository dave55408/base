const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('Chase and Cinema keep Enterprise low without changing camera distance or zoom',()=>{
  const root=path.join(__dirname,'..'),c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const mode of ['chase','cinematic'])for(const aspect of [.7,1.8,2.5])for(const freeFlight of [false,true]){
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

test('Enterprise stays in the lower half even when an opponent crosses below it',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{mode:'chase',sim:{contact:true,enemy:{hull:100}},camera:new T.PerspectiveCamera(46,1.8,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
  s.camera.position.set(0,0,300);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();
  s.ships.Yorktown.position.set(0,-100,0);s.frameEnterpriseLow();
  const y=(1-s.ships.Enterprise.position.clone().project(s.camera).y)/2;
  assert(y>=.6&&y<=.72);
});

test('gameplay camera retains Enterprise POV through turns and translation',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype),ship=new T.Group();
  Object.assign(s,{mode:'chase',sim:{},camera:new T.PerspectiveCamera(),ships:{Enterprise:ship}});
  const offset=new T.Vector3(35,45,235);
  s.trackGameplayCamera(offset.clone(),1/60,true);
  for(const heading of [45,120,180,270]){
    ship.rotation.y=heading*Math.PI/180;ship.position.set(100,50,-500);
    const desired=offset.clone().applyQuaternion(ship.quaternion).add(ship.position);
    s.trackGameplayCamera(desired,1/60);
    const local=s.camera.position.clone().sub(ship.position).applyQuaternion(ship.quaternion.clone().invert());
    assert(local.distanceTo(offset)<1e-8,'camera remains behind Enterprise while it turns');
  }
  s.mode='forward';assert.equal(s.trackGameplayCamera(offset,1/60),false);assert.equal(s.gameplayCameraOffset,null);
});
