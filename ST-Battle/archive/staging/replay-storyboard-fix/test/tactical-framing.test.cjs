const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('Tactical fits both complete hulls through separation, altitude, orbit and zoom changes',()=>{
  const root=path.join(__dirname,'..'),c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.5,1,1.8,3])for(const offset of [[500,0,0],[0,2000,0],[6000,-1500,-12000],[60000,40000,30000]])for(const orbit of [0,1.5,3])for(const zoom of [.5,1,2.5]){
    const s=Object.create(c.window.BattleScene.prototype);
    Object.assign(s,{T,mode:'tactical',zoom,orbit:{x:orbit,y:.6},camera:new T.PerspectiveCamera(46,aspect,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
    s.ships.Yorktown.position.set(...offset);
    const position=new T.Vector3(),target=new T.Vector3();s.tacticalCamera(position,target);
    s.camera.position.copy(position);s.camera.lookAt(target);s.camera.updateProjectionMatrix();s.camera.updateMatrixWorld();
    for(const ship of Object.values(s.ships))for(const delta of [[0,0,0],[100,0,0],[-100,0,0],[0,100,0],[0,-100,0],[0,0,100],[0,0,-100]]){
      const p=ship.position.clone().add(new T.Vector3(...delta)).project(s.camera);
      assert(Math.abs(p.x)<.85&&Math.abs(p.y)<.8&&p.z>-1&&p.z<1,'both hulls remain within safe screen margins');
    }
    assert(position.y>target.y,'camera remains overhead');
  }
});
