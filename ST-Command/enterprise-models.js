/* Third Model is the sole Enterprise model; migrate retired model preferences. */
(()=>{
  const factories={third:()=>createThirdEnterpriseRenderer()};
  let selected='third';try{const saved=localStorage.getItem('st-command-enterprise-model');if(Object.hasOwn(factories,saved))selected=saved;}catch{}
  const qualitySelector=document.getElementById('texture-quality'),scenes=new Set();
  function release(scene){
    for(const ship of Object.values(scene.enterpriseRenderers||{})){if(ship)ship.launchDisposed=true;ship?.dispose();}
    scene.enterpriseRenderers={};scene.enterpriseRenderer=null;scene.orbitActor=null;
  }
  function lightSpaceScene(ship){
    if(!ship)return ship;
    const T=window.AlpineThree;
    // One distant sun above port/aft: top-left in the shuttle's aft approach.
    // Keep it fixed in space as the shuttle flies around the Enterprise.
    for(const light of [...ship.scene.children])if(light.isLight)ship.scene.remove(light);
    const ambient=new T.HemisphereLight(0xcbd8e2,0x101820,.4);
    ambient.name='space-ambient';
    const key=new T.DirectionalLight(0xfff2df,3.3);
    key.name='space-key';key.position.set(-6,8,4);
    const fill=new T.DirectionalLight(0x8faac5,1.0);
    fill.name='space-fill';fill.position.set(4,1,3);
    const lowerFill=new T.DirectionalLight(0xb8c8d6,1.0);
    lowerFill.name='space-lower-fill';lowerFill.position.set(0,-4,-2);
    ship.scene.add(ambient,key,fill,lowerFill);
    return SimPerformance.attach(NightMode.attach(attachExcursionCamera(ship)));
  }
  const api={
    get selected(){return selected;},
    set selected(value){const next=Object.hasOwn(factories,value)?value:'third';if(next!==selected){scenes.forEach(release);selected=next;}try{localStorage.setItem('st-command-enterprise-model',selected);}catch{}},
    async prepareLaunch(scene,w,h){
      const ship=api.rendererFor(scene);if(!ship)return null; // Preserve the 2D fallback when WebGL is unavailable.
      const key=[SimPerformance.quality,ShipTextures.quality,NightMode.enabled,w,h].join('/');
      if(ship.launchWarmKey===key)return ship;
      if(ship.launchWarmup){await ship.launchWarmup;if(ship.launchWarmKey===key)return ship;}
      ship.launchWarmup=(async()=>{
        await ship.ready;if(ship.launchDisposed)throw Error('Launch renderer changed');
        const craft=ship.prepareExcursionShuttle();craft.visible=true;
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),pad=ShuttleBayFlight.padRoot(180);
        const pose={phase:'flight',freeSpace:true,cameraView:'excursion',clock:0,...pad,bank:0,garageDoorOpen:0,bayDoorOpen:1,departureCameraPending:true,departureCameraAnchor:{...pad,heading:180,pitch:0,bank:0}};
        const state={heading:180,pitch:0,time:0,bayDoorOpen:1};
        // Prepare both launch and departure shader variants and upload the real
        // textures/shadows before the flight clock starts. Nothing is displayed.
        if(ship.renderer.compileAsync)await ship.renderer.compileAsync(ship.scene,ship.excursionCamera);
        for(const sample of [pose,{...pose,z:pad.z+.025},{...pose,x:.25,y:.8,z:110.3,departureCameraPending:false},{...pose,cameraView:'cockpit',departureCameraPending:false},pose]){
          await new Promise(requestAnimationFrame);if(ship.launchDisposed)throw Error('Launch renderer changed');ship.draw(ctx,w,h,sample,state);
        }
        // Drain texture uploads and shadow rendering here, rather than letting
        // queued GPU work spill into the first visible liftoff frames.
        ship.renderer.getContext().finish();
        ship.launchWarmKey=key;
      })();
      try{await ship.launchWarmup;return ship;}finally{ship.launchWarmup=null;}
    },
    rendererFor(scene){
      if(!scenes.has(scene)){
        scenes.add(scene);
        scene.events?.once('shutdown',()=>{release(scene);scenes.delete(scene);});
      }
      scene.enterpriseRenderers??={};
      if(!Object.prototype.hasOwnProperty.call(scene.enterpriseRenderers,selected)){
        scene.enterpriseRenderers[selected]=lightSpaceScene(factories[selected]());
      }
      return scene.enterpriseRenderers[selected];
    }
  };
  try{localStorage.setItem('st-command-enterprise-model',selected);}catch{}
  qualitySelector.value=ShipTextures.quality;
  qualitySelector.addEventListener('change',()=>{
    scenes.forEach(release);ShipTextures.quality=qualitySelector.value;qualitySelector.blur();
  });
  window.EnterpriseModels=api;
})();

