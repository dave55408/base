/* Graphics quality, render diagnostics and event-driven redraws while paused. */
(()=>{
 const presets={full:{scale:1,shadow:2048,lodPixels:0},balanced:{scale:.75,shadow:2048,lodPixels:32},economy:{scale:.5,shadow:1024,lodPixels:48}};
 let quality='balanced',frameLimit=60;
 try{const saved=JSON.parse(localStorage.getItem('st-command-performance')||'{}');if(presets[saved.quality])quality=saved.quality;if(saved.frameLimit===30)frameLimit=30;}catch{}
 let games=[],state,animateUntil=0,wakePending=false,lastFrame=0,reportAt=0;
 const sleeping=new Set(),attached=new WeakSet(),timings=[],intervals=[];
 const stats={fps:0,frameMs:0,renderMs:0,calls:0,triangles:0,frames:0,renders:0};
 const button=document.createElement('button');button.id='performance-open';button.type='button';button.textContent='PERFORMANCE';button.setAttribute('aria-haspopup','dialog');
 document.querySelector('.viewscreen-title-tools').append(button);
 const dialog=document.createElement('dialog');dialog.id='performance-settings';dialog.setAttribute('aria-labelledby','performance-title');
 dialog.innerHTML='<div class="performance-heading"><h2 id="performance-title">Performance</h2><button id="performance-close" type="button" autofocus>Close</button></div><label for="render-quality">Rendering quality</label><select id="render-quality"><option value="full">Full resolution</option><option value="balanced">Balanced · 75% resolution</option><option value="economy">Economy · 50% resolution</option></select><p>Lower resolution improves speed. Nearby ship details stay intact; distant interiors use less detail.</p><label for="frame-limit">Frame rate</label><select id="frame-limit"><option value="60">60 FPS · smoother motion</option><option value="30">30 FPS · lower power use</option></select><label for="performance-textures">Ship textures</label><select id="performance-textures"><option value="low">Low Memory</option><option value="high">High Detail</option></select><p>Low Memory reduces texture memory. Settings apply immediately and are saved.</p><output id="performance-readout" aria-live="off">Measuring…</output><p class="performance-timing-note">Render timing measures CPU work, not complete GPU time. Paused views redraw only when something changes.</p>';
 document.body.append(dialog);
 const introLabel=document.createElement('label');introLabel.className='performance-checkbox';
 const introCheckbox=document.createElement('input');introCheckbox.type='checkbox';introCheckbox.id='performance-intro';
 introLabel.append(introCheckbox,' Show intro screen on startup');
 dialog.querySelector('#performance-readout').before(introLabel);
 const qualitySelect=dialog.querySelector('#render-quality'),fpsSelect=dialog.querySelector('#frame-limit'),textures=dialog.querySelector('#performance-textures'),readout=dialog.querySelector('#performance-readout');
 function persist(){try{localStorage.setItem('st-command-performance',JSON.stringify({quality,frameLimit}));}catch{}}
 function sync(){qualitySelect.value=quality;fpsSelect.value=String(frameLimit);textures.value=window.ShipTextures?.quality||'low';introCheckbox.checked=true;try{introCheckbox.checked=localStorage.getItem('st-command-hide-welcome')!=='true';}catch{}}
 function invalidate(duration=0){
  animateUntil=Math.max(animateUntil,performance.now()+duration);
  if(wakePending)return;wakePending=true;
  queueMicrotask(()=>{wakePending=false;for(const game of [...sleeping]){sleeping.delete(game);if(game.loop.started&&!document.hidden){game.loop.resetDelta();game.loop.wake(true);}}});
 }
 function applyLimit(game){
  // Phaser 3.90 binds the limited step at boot. Keep that path active for
  // both limits; only its interval changes, preserving simulation time.
  game.loop.fpsLimit=frameLimit;game.loop._limitRate=1000/frameLimit;
 }
 function report(){
  if(!dialog.open)return;
  readout.textContent=state?.paused?'Paused · redraw on change':`${stats.fps.toFixed(0)} FPS · ${stats.frameMs.toFixed(1)} ms/frame\n3D render: ${stats.renderMs.toFixed(1)} ms CPU\n${stats.calls.toLocaleString()} draw calls · ${stats.triangles.toLocaleString()} triangles`;
 }
 function attach(ship){
  if(!ship||attached.has(ship.renderer))return ship;attached.add(ship.renderer);
  const T=AlpineThree,renderer=ship.renderer,render=renderer.render,room=ship.model.getObjectByName('reference-bay-interior'),garage=room?.getObjectByName('bay-forward-arched-lift'),sun=ship.scene.getObjectByName('space-key');
  const eye=new T.Vector3(),localEye=new T.Vector3(),worldScale=new T.Vector3(),point=new T.Vector3();let shadowSize=0,launchCullMeshes=null;
  renderer.render=function(scene,camera,...args){
   if(scene!==ship.scene)return render.call(this,scene,camera,...args);
   const preset=presets[quality],restores=[];
   const desiredShadow=Math.min(preset.shadow,renderer.capabilities.maxTextureSize);
   if(sun&&shadowSize!==desiredShadow){
    shadowSize=desiredShadow;sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.needsUpdate=true;
   }
   const setVisible=(object,visible)=>{if(object&&object.visible!==visible){restores.push([object,object.visible]);object.visible=visible;}};
   if(ship.launchRendering){
    // Local bay lighting avoids unshadowed sunlight leaking through the roof.
    setVisible(sun,false);
    // The fixed launch camera sees the bay and its doorway. Exterior fittings
    // cannot contribute here, including to the local bay light's shadow map.
    if(!launchCullMeshes){
     launchCullMeshes=[];ship.model.updateWorldMatrix(true,true);
     ship.model.traverse(object=>{
      if(!object.isMesh||object.isInstancedMesh)return;
      const geometry=object.geometry;geometry.computeBoundingBox();const box=geometry.boundingBox,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
       point.set(x,y,z).applyMatrix4(object.matrixWorld);for(let k=0;k<3;k++){const v=point.getComponent(k);min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}
      }
      if(min[0]>.20||max[0]<-.20||min[1]>.12||max[1]<-.12||max[2]<-.40||min[2]>.18)launchCullMeshes.push(object);
     });
    }
    for(const object of launchCullMeshes)setVisible(object,false);
   }
   ship.launchCulledMeshes=ship.launchRendering?launchCullMeshes.length:0;
   if(room){
    camera.getWorldPosition(eye);room.updateWorldMatrix(true,false);localEye.copy(eye);room.worldToLocal(localEye);
    const rear=garage?.userData.depthFade.front??-.27765,inside=Math.abs(localEye.x)<.115&&localEye.y>-.07&&localEye.y<.09&&localEye.z>rear-.45&&localEye.z<.05;
    const open=ship.model.userData.bayDoorOpen??1;room.getWorldScale(worldScale);point.set(0,0,rear);room.localToWorld(point);
    const bayPixels=.16*worldScale.x*Math.abs(camera.projectionMatrix.elements[5])*renderer.domElement.height/2/(camera.isOrthographicCamera?1:Math.max(.001,eye.distanceTo(point)));
    // Closed hull surfaces conceal the bay; avoid submitting all its meshes
    // and lights. Always retain the room when the camera is inside it.
    setVisible(room,room.visible&&(inside||open>.001&&localEye.z>rear&&(!preset.lodPixels||bayPixels>=12)));
    if(room.visible&&garage){
     const storage=garage.getObjectByName('bay-garage-storage');
     if(storage?.visible)for(const craft of storage.children){
      if(!craft.storageDetail)continue;
      craft.getWorldPosition(point);craft.getWorldScale(worldScale);
      const distance=Math.max(.001,eye.distanceTo(point)),pixels=.12*worldScale.y/craft.scale.y*Math.abs(camera.projectionMatrix.elements[5])*renderer.domElement.height/2/(camera.isOrthographicCamera?1:distance);
      const detailed=!preset.lodPixels||pixels>=preset.lodPixels;
      if(craft.storageLastDetailed!==detailed){
       craft.storageLastDetailed=detailed;
       for(const lamp of storage.children)if(lamp.isSpotLight)lamp.shadow.needsUpdate=true;
      }
      setVisible(craft.storageDetail,detailed);setVisible(craft.storageDistant,!detailed);
     }
    }
   }
   const autoReset=renderer.info.autoReset;if(autoReset)renderer.info.reset();renderer.info.autoReset=false;
   const start=performance.now(),beforeCalls=renderer.info.render.calls,beforeTriangles=renderer.info.render.triangles;
   try{return render.call(this,scene,camera,...args);}
   finally{
    const ms=performance.now()-start;timings.push(ms);if(timings.length>60)timings.shift();
    stats.renderMs=timings.reduce((a,b)=>a+b,0)/timings.length;stats.calls=renderer.info.render.calls-beforeCalls;stats.triangles=renderer.info.render.triangles-beforeTriangles;stats.renders++;
    renderer.info.autoReset=autoReset;for(const [object,visible]of restores)object.visible=visible;
   }
  };
  ship.ready?.then(()=>invalidate(),()=>{});return ship;
 }
 const api={
  get quality(){return quality;},set quality(value){if(!presets[value])return;quality=value;persist();sync();invalidate();},
  get frameLimit(){return frameLimit;},set frameLimit(value){frameLimit=Number(value)===30?30:60;games.forEach(applyLimit);persist();sync();invalidate();},
  get shadowSize(){return presets[quality].shadow;},get stats(){return {...stats};},
  size(w,h){const width=Math.max(1,Math.round(Math.min(1920,w)*presets[quality].scale));return {width,height:Math.max(1,Math.round(h*width/w))};},
  resize(renderer,w,h){const size=this.size(w,h);if(renderer.domElement.width!==size.width||renderer.domElement.height!==size.height)renderer.setSize(size.width,size.height,false);return size;},
  invalidate,attach,
  bindGames(value,simulationState){
   games=value;state=simulationState;
   for(const [index,game]of games.entries()){
    applyLimit(game);
    game.events.on('postrender',()=>{
     const now=performance.now();
     if(index===0){
      stats.frames++;if(lastFrame&&now-lastFrame<1000){intervals.push(now-lastFrame);if(intervals.length>60)intervals.shift();stats.frameMs=intervals.reduce((a,b)=>a+b,0)/intervals.length;stats.fps=1000/stats.frameMs;}lastFrame=now;
      if(now-reportAt>500){reportAt=now;report();}
     }
     if(state.paused&&now>=animateUntil){
      const hatch=index===0?game.scene.getScene('Forward')?.enterpriseRenderer?.model.getObjectByName('aft-bridge-docking-port'):null;
      const hatchMoving=hatch&&Math.abs(hatch.userData.hatchOpen-(window.BridgeHatch?.open?1:0))>.001;
      if(!hatchMoving){game.loop.sleep();sleeping.add(game);report();}
     }
    });
   }
  }
 };
 button.addEventListener('click',()=>{sync();dialog.showModal();report();});dialog.querySelector('#performance-close').addEventListener('click',()=>dialog.close());
 qualitySelect.addEventListener('change',()=>{api.quality=qualitySelect.value;});fpsSelect.addEventListener('change',()=>{api.frameLimit=fpsSelect.value;});
 textures.addEventListener('change',()=>{const original=document.getElementById('texture-quality');original.value=textures.value;original.dispatchEvent(new Event('change'));invalidate();});
 introCheckbox.addEventListener('change',()=>{
  try{if(introCheckbox.checked)localStorage.removeItem('st-command-hide-welcome');else localStorage.setItem('st-command-hide-welcome','true');}catch{}
  const dismiss=document.getElementById('welcome-dismiss');if(dismiss)dismiss.checked=!introCheckbox.checked;
 });
 for(const event of ['input','change','click','pointerdown','pointerup','wheel','keyup'])document.addEventListener(event,()=>invalidate(),{passive:true});
 document.addEventListener('pointermove',event=>{if(event.buttons||document.pointerLockElement)invalidate();},{passive:true});
 document.addEventListener('keydown',event=>invalidate(event.key.toLowerCase()==='h'?1400:0),{passive:true});
 addEventListener('resize',()=>invalidate());document.addEventListener('visibilitychange',()=>{lastFrame=0;intervals.length=0;if(!document.hidden)invalidate();});
 window.SimPerformance=api;sync();
})();
