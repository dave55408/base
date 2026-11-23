const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),Battle=require('../engine.js');
async function modelScene(){
 const context={window:{},AbortController,console,atob,Uint8Array,Uint16Array,Uint32Array,Float32Array,Int16Array,Int32Array,Battle,Image:class{constructor(){this.width=this.height=16;}async decode(){}},document:{createElement:()=>({getContext:()=>({drawImage(){}})})}};vm.createContext(context);
 for(const file of ['vendor/three.js','scene.js','assets/hd/st-command-model.js','replay-hd.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 context.window.ENTERPRISE_HULL_PANEL_TILE=true;context.window.createMovieHullSurfaceDetail=()=>({ready:Promise.resolve(),texture:{anisotropy:4},apply(){}});
 await context.window.BattleReplayHD.load();const T=context.window.AlpineThree,scene=Object.create(context.window.BattleScene.prototype);
 Object.assign(scene,{T,sim:new Battle.Simulation(),scene:new T.Scene(),effects:[],projectiles:new Map(),renderer:{capabilities:{getMaxAnisotropy:()=>16}},burst(){},scarNacelleMount(){}});
 scene.ships={Enterprise:context.window.BattleReplayHD.createShip(scene,'Enterprise',false),Yorktown:context.window.BattleReplayHD.createShip(scene,'Yorktown',true)};scene.scene.add(...Object.values(scene.ships));return scene;
}
test('both HD pylon shelves follow their engines into debris and restore without shifting on rewind',async()=>{
 const scene=await modelScene(),T=scene.T,ship=scene.ships.Yorktown,model=ship.userData.model;
 ship.position.set(60,-40,200);ship.rotation.set(.2,.4,.1);ship.updateMatrixWorld(true);
 for(const side of ['port','starboard']){
  const shoe=model.getObjectByName(side+'-engine-pylon-shoe'),pylon=ship.userData.breakupParts.find(p=>p.userData.pylonSide===side);
  assert.equal(shoe.parent,pylon,'shelf shares the pylon attachment');
  scene.detachNacelle('Yorktown',side);const debris=scene.effects.find(e=>e.kind==='nacelle-debris'&&e.side===side),detachedShoe=debris.object.getObjectByName(shoe.name);
  assert(detachedShoe,'shelf is included in the engine debris');assert.equal(pylon.visible,false);debris.object.updateMatrixWorld(true);
  assert(detachedShoe.getWorldPosition(new T.Vector3()).distanceTo(shoe.getWorldPosition(new T.Vector3()))<1e-6,'cloning preserves shelf placement');
  scene.sim.enemy.detachedNacelles[side]=false;scene.syncNacelles(ship,scene.sim.enemy);assert(pylon.visible);assert(shoe.visible);
 }
 const hull=[].concat(ship.userData.saucer.material).find(m=>m.map);assert.equal(hull.map.anisotropy,16,'uses maximum hardware texture filtering');
});

test('HD import preserves composed hull and window shaders, including on detached material clones',async()=>{
 const scene=await modelScene();let plated=0,windows=0;
 scene.ships.Enterprise.traverse(mesh=>{for(const material of [].concat(mesh.material||[])){
  if(!material.userData.hdDetailPatch)continue;const shader={uniforms:{}};material.onBeforeCompile(shader);
  if(shader.uniforms.hullPanelTile){plated++;assert(shader.vertexShader.includes('.xyz/57.0;'));assert(shader.fragmentShader.includes('(length(vViewPosition)/57.0)'));assert(shader.fragmentShader.includes('(0.00008*57.0)'));}
  if(shader.fragmentShader.includes('windowRectEdge'))windows++;
  if(shader.fragmentShader.includes('bladeDepth='))assert(shader.fragmentShader.includes('vBladeDistanceRange.y,length(vViewPosition))'),'rotor depth fade keeps consistent coordinate units');
  const clone=scene.cloneHullMaterial(material);assert.equal(clone.onBeforeCompile,material.onBeforeCompile);assert.equal(clone.customProgramCacheKey(),material.customProgramCacheKey());
 }});
 assert(plated>20,'fine hull plating is preserved');assert(windows>0,'window recess and glass shaders are preserved');
});

test('HD aft phasers mount just above the actual rear engineering hull and update legacy replay origins',async()=>{
 const scene=await modelScene(),T=scene.T,ship=scene.ships.Yorktown,model=ship.userData.model,emitter=scene.phaserEmitter({aft:true,ship});
 assert.equal(emitter.x,0);assert(emitter.z>-.3&&emitter.z<0,'HD emitter is on the aft lower hull instead of beyond the stern');assert(emitter.y>0&&emitter.y<.25);
 ship.updateMatrixWorld(true);const top=model.localToWorld(emitter.clone().add(new T.Vector3(0,.1,0))),below=model.localToWorld(emitter.clone().add(new T.Vector3(0,-.05,0))),surface=scene.traceHull(ship,top,below,{camera:true});assert(surface);
 assert(Math.abs(model.worldToLocal(surface.point.clone()).y+.002-emitter.y)<1e-5);
 const beam=scene.weaponEndpoints('Yorktown','Enterprise',{emitter:{x:0,y:.265,z:.8},point:{x:0,y:0,z:0}});
 assert(beam.start.distanceTo(model.localToWorld(emitter.clone()))<1e-7,'older recordings use the new mount on the HD geometry');
});

test('HD Yorktown extends its saucer plating onto plain hull fittings without coating windows or lamps',async()=>{
 const scene=await modelScene();let added=0;
 scene.ships.Yorktown.traverse(mesh=>{for(const material of [].concat(mesh.material||[])){
  if(material.userData.yorktownHullCoating){added++;assert(material.userData.hdGunmetalHull);assert(mesh.geometry.attributes.hullSurfaceUv);assert(!material.transparent);assert(!material.isMeshBasicMaterial);assert.equal(material.color.getHex(),0x3b4249);}
 }});assert(added>10);
 scene.ships.Enterprise.traverse(mesh=>{for(const material of [].concat(mesh.material||[]))assert(!material.userData.yorktownHullCoating);});
});
