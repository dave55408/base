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
