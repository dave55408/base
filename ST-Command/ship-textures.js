/* Load fixed-size baked canvases; reference processing runs only in the builder. */
(()=>{
 let quality='low';try{quality=localStorage.getItem('st-command-texture-quality')==='high'?'high':'low';}catch{}
 const cache=new Map(),bundles=new Map();
 function fileBundle(key){
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');bundles.set(key,resolve);
   script.src='assets/textures/ships/'+key+'/bundle.js';
   script.onload=()=>{script.remove();if(bundles.has(key)){bundles.delete(key);reject(Error('Invalid ship texture bundle: '+key));}};
   script.onerror=()=>{script.remove();bundles.delete(key);reject(Error('Ship texture bundle failed to load: '+key));};document.head.append(script);
  });
 }
 window.ShipTextures={
  receiveBundle(key,images){const resolve=bundles.get(key);bundles.delete(key);resolve?.(images);},
  get quality(){return quality;},
  set quality(value){quality=value==='high'?'high':'low';try{localStorage.setItem('st-command-texture-quality',quality);}catch{}},
  load(T,model){
   const key=model+'/'+quality;if(cache.has(key))return cache.get(key);
   const spec=SHIP_TEXTURE_MANIFEST[model],maps={...spec.metadata},loads=[];
   // Local file canvases cannot upload file-origin PNGs to WebGL. Load a baked
   // data-URL bundle on demand there, then release its strings after decoding.
   const source=location.protocol==='file:'?fileBundle(key):Promise.resolve(null);
   for(const [name,variants]of Object.entries(spec.textures)){
    const {width,height,url}=variants[quality],canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    if(name.endsWith('Glow')){ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);}
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;maps[name]=texture;
    loads.push(new Promise((resolve,reject)=>{
     const image=new Image();let active=true;
     const finish=()=>{active=false;image.onload=image.onerror=null;delete texture.userData.cancelLoad;};
     texture.userData.cancelLoad=()=>{if(!active)return;finish();image.src='';resolve();};
     image.onload=()=>{if(!active)return;ctx.drawImage(image,0,0,width,height);texture.needsUpdate=true;finish();resolve();};
     image.onerror=()=>{finish();reject(Error('Ship texture failed to load: '+url));};
     source.then(images=>{if(active)image.src=images?images[name]:url;}).catch(error=>{if(active){finish();reject(error);}});
    }));
   }
   maps.ready=Promise.all(loads).then(()=>undefined);maps.ready.catch(error=>console.error(error));
   cache.set(key,maps);return maps;
  },
  forget(maps){for(const [key,value]of cache)if(value===maps)cache.delete(key);}
 };
})();

/* Reference counts protect textures shared by previews and active renderers. */
(()=>{
 const owners=new Map();
 window.trackEnterpriseResources=(ship,maps)=>{
  const resources=new Set();
  const add=value=>{if(value?.dispose)resources.add(value);};
  Object.values(maps).forEach(add);
  const surface=window.enterpriseHullSurfaceDetail;
  if(['movie','third'].includes(ship.model.userData.variant))add(surface?.texture);
  const collect=()=>ship.scene.traverse(object=>{
   add(object.geometry);if(object.shadow)add(object.shadow);
   for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material){add(material);Object.values(material).forEach(value=>{if(value?.isTexture)add(value);});}
  });
  collect();for(const resource of resources)owners.set(resource,(owners.get(resource)||0)+1);
  let disposed=false;
  ship.dispose=()=>{
   if(disposed)return;disposed=true;
   // The excursion shuttle can be created after the first resource scan.
   const existing=new Set(resources);collect();for(const resource of resources)if(!existing.has(resource))owners.set(resource,(owners.get(resource)||0)+1);
   for(const resource of resources){
    const count=owners.get(resource)-1;if(count){owners.set(resource,count);continue;}owners.delete(resource);
    if(resource.isTexture)resource.userData.cancelLoad?.();
    resource.dispose();
    if(resource.isTexture&&resource.image instanceof HTMLCanvasElement)resource.image.width=resource.image.height=1;
   }
   if(!Object.values(maps).some(value=>value?.isTexture&&owners.has(value))){
    ShipTextures.forget(maps);
    if(window.enterpriseMovieMaps===maps)delete window.enterpriseMovieMaps;
    if(window.enterpriseMarkingMaps===maps)delete window.enterpriseMarkingMaps;
    if(window.enterpriseThirdMaps===maps)delete window.enterpriseThirdMaps;
   }
   if(surface&&!owners.has(surface.texture)&&window.enterpriseHullSurfaceDetail===surface)delete window.enterpriseHullSurfaceDetail;
   const signal=window.addHangarSignalGlow?.texture;if(signal&&!owners.has(signal))delete window.addHangarSignalGlow.texture;
   ship.scene.clear();ship.renderer.dispose();ship.renderer.forceContextLoss();ship.renderer.domElement.width=ship.renderer.domElement.height=1;
   resources.clear();
  };
  return ship;
 };
})();
