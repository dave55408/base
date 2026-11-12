/* Two independent model factories; changing appearance never resets flight. */
(()=>{
  const factories={original:()=>createEnterpriseRenderer(),movie:()=>createMovieEnterpriseRenderer(),third:()=>createThirdEnterpriseRenderer()};
  let selected='movie';try{const saved=localStorage.getItem('st-command-enterprise-model');if(Object.hasOwn(factories,saved))selected=saved;}catch{}
  const selector=document.getElementById('enterprise-model');
  const qualitySelector=document.getElementById('texture-quality'),scenes=new Set();
  function release(scene){
    for(const ship of Object.values(scene.enterpriseRenderers||{}))ship?.dispose();
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
    return attachExcursionCamera(ship);
  }
  const api={
    get selected(){return selected;},
    set selected(value){const next=Object.hasOwn(factories,value)?value:'movie';if(next!==selected){scenes.forEach(release);selected=next;}selector.value=selected;try{localStorage.setItem('st-command-enterprise-model',selected);}catch{}},
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
  selector.value=selected;selector.addEventListener('change',()=>{api.selected=selector.value;selector.blur();});
  qualitySelector.value=ShipTextures.quality;
  qualitySelector.addEventListener('change',()=>{
    scenes.forEach(release);ShipTextures.quality=qualitySelector.value;qualitySelector.blur();
  });
  window.EnterpriseModels=api;
})();

