const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('Tactical uses one faint 5 km grid without stacked decks or range rings',()=>{
 const c={window:{},console,AbortController};vm.createContext(c);for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
 const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);Object.assign(s,{T,scene:new T.Scene(),sim:new c.Battle.Simulation(),mode:'tactical',zoom:1,project:()=>({visible:true})});s.makeSpatialGuides();s.updateSpatialGuides();
 assert.equal(s.gridStep,500);assert(s.spatial.grid.visible);assert.equal(s.spatial.grid.geometry.drawRange.count,44);assert.equal(s.spatial.grid.material.opacity,.10);
 for(const key of ['levels','rings']){assert.equal(s.spatial[key].visible,false);assert.equal(s.spatial[key].geometry.drawRange.count,0);}assert.equal(s.levelLabels.length,0);assert(s.spatial.player.visible);
 s.sim.enemy.z-=5000;s.updateSpatialGuides();assert.equal(s.gridStep,500,'battle range does not shift the Tactical grid spacing');
 s.mode='chase';s.updateSpatialGuides();assert(s.spatial.levels.visible&&s.spatial.rings.visible);assert.equal(s.spatial.grid.geometry.drawRange.count,20);assert.equal(s.spatial.levels.geometry.drawRange.count,24);assert.equal(s.levelLabels.length,2);assert.equal(s.spatial.rings.geometry.drawRange.count,128,'Chase keeps only one range ring');
 s.mode='forward';s.updateSpatialGuides();assert.equal(s.spatial.grid.geometry.drawRange.count,44);assert.equal(s.spatial.rings.geometry.drawRange.count,384,'Forward retains its full guides');
 s.mode='tactical';s.spatialEnabled=false;s.updateSpatialGuides();assert(Object.values(s.spatial).every(line=>!line.visible),'Grid off still hides every guide');
});
test('Tactical reference overview fits nearby complete hulls across viewport sizes and orbit settings',()=>{
  const root=path.join(__dirname,'..'),c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  const T=c.window.AlpineThree;
  for(const aspect of [.5,1,1.8,3])for(const offset of [[500,0,0],[0,400,0],[600,-150,-1200]])for(const orbit of [0,1.5,3])for(const zoom of [1,2.5]){
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


test('Tactical holds its scale as ships move and only changes zoom on user input or reentry',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);for(const p of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',p),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);Object.assign(s,{T,mode:'chase',zoom:1,orbit:{x:0,y:0},camera:new T.PerspectiveCamera(46,1.8,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
  s.ships.Yorktown.position.set(500,0,0);s.setCamera('tactical');const distance=()=>{const position=new T.Vector3(),target=new T.Vector3();s.tacticalCamera(position,target);return position.distanceTo(target);};
  const initial=distance();s.ships.Yorktown.position.set(5000,1500,-8000);assert(Math.abs(distance()-initial)<1e-7,'ship separation cannot automatically zoom out');
  s.ships.Yorktown.position.set(100,0,0);assert(Math.abs(distance()-initial)<1e-7,'closing cannot automatically zoom in');
  s.zoom*=1.2;assert(Math.abs(distance()-initial*1.2)<1e-7,'manual wheel zoom remains available');
  s.ships.Yorktown.position.set(10000,0,-10000);s.setCamera('chase');s.setCamera('tactical');assert(Math.abs(distance()-initial)<1e-7,'reentering Tactical restores the reference scale independently of ship separation');assert.equal(s.camera.zoom,4);s.setCamera('chase');assert.equal(s.camera.zoom,1,'other views retain normal perspective');
});


test('Tactical starts at a fixed 25 km overview and minimizes relative ship-size changes from altitude',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);for(const file of ['vendor/three.js','engine.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);Object.assign(s,{T,mode:'chase',zoom:1,orbit:{x:0,y:0},camera:new T.PerspectiveCamera(46,2.65,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
  s.ships.Enterprise.position.set(-400,500,0);s.ships.Yorktown.position.set(400,-500,0);s.setCamera('tactical');
  const position=new T.Vector3(),target=new T.Vector3();s.tacticalCamera(position,target);s.camera.position.copy(position);s.camera.lookAt(target);s.camera.updateMatrixWorld();
  const span=2*position.distanceTo(target)*Math.tan(s.camera.fov*Math.PI/360)/s.camera.zoom;assert(Math.abs(span-2500)<1e-7,'starting scale matches the reference');
  const size=ship=>{const a=ship.position.clone().project(s.camera),b=ship.position.clone().add(new T.Vector3(80,0,0)).project(s.camera);return Math.hypot(a.x-b.x,a.y-b.y);};
  const near=size(s.ships.Enterprise),far=size(s.ships.Yorktown);assert(Math.max(near,far)/Math.min(near,far)<1.1,'a kilometer of altitude difference changes apparent size by less than 10%');
  assert(Math.abs(308/span-.1232)<1e-8,'K7 main saucer occupies about one eighth of the viewport height');
});
