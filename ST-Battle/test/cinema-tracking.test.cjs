const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(aspect=1.8){
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,mode:'cinematic',zoom:1,orbit:{x:0,y:0},sim:{enemy:{hull:100}},camera:new T.PerspectiveCamera(46,aspect,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
  s.camera.position.set(0,45,235);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();
  s.ships.Yorktown.position.set(0,150,-1600);
  const frame=(dt=1/60,snap=false)=>{
    const position=new T.Vector3(),target=new T.Vector3();s.cinemaCamera(position,target,dt,snap);
    s.camera.position.copy(position);s.camera.lookAt(target);s.camera.updateMatrixWorld();s.frameEnterpriseLow(dt,snap);
  };
  return {s,T,frame};
}
test('Cinema frames both ships across aspect ratios and engagement geometry without pinning Enterprise',()=>{
  for(const aspect of [.7,1.8,2.5]){
    const {s,frame}=fixture(aspect);
    for(const point of [[0,150,-1600],[100,700,-400],[-2000,-500,300],[50,0,-80]]){
      s.ships.Yorktown.position.set(...point);frame(0,true);
      for(const ship of Object.values(s.ships)){
        const p=ship.position.clone().project(s.camera);
        assert(Math.abs(p.x)<.8&&Math.abs(p.y)<.78&&Math.abs(p.z)<1,'both ships have space around them');
      }
      assert.equal(s.camera.projectionMatrix.elements[9],0,'Cinema uses the engagement composition');
      assert.equal(s.camera.zoom,1);
    }
  }
});
test('Cinema holds its viewing side through heading reversals, banking and ship crossings',()=>{
  const {s,frame}=fixture();frame(0,true);
  const direction=s.cinemaTracking.offset.clone().normalize();
  s.ships.Enterprise.rotation.set(.7,Math.PI,1.3);s.ships.Yorktown.position.set(0,-200,1600);
  for(let i=0;i<300;i++)frame();
  assert(s.cinemaTracking.offset.clone().normalize().angleTo(direction)<1e-6,'ships do not drag the camera around their changing axis');
  assert.equal(s.camera.up.y,1);
});
test('Cinema eases entry, orbit and zoom, caps turn speed after a stall, and freezes with zero delta',()=>{
  const {s,frame}=fixture(),before=s.camera.quaternion.clone();frame();
  assert(before.angleTo(s.camera.quaternion)<.08,'entry does not snap the gaze to the midpoint');
  for(let i=0;i<600;i++)frame();
  const old=s.cinemaTracking.offset.clone();s.orbit.x=Math.PI;s.zoom=2;
  frame(3);
  assert(old.clone().normalize().angleTo(s.cinemaTracking.offset.clone().normalize())<=Math.PI/100+1e-6,'a long frame cannot whip the camera around');
  assert(s.cinemaTracking.offset.length()<old.length()*1.15,'zoom eases instead of jumping');
  const position=s.camera.position.clone(),rotation=s.camera.quaternion.clone();frame(0);
  assert(s.camera.position.distanceTo(position)<1e-7);assert(rotation.angleTo(s.camera.quaternion)<1e-7);
  s.setCamera('chase');assert.equal(s.cinemaTracking,null);
});
