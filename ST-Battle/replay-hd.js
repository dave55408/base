/* Standalone snapshot of ST-Command's Third Model, loaded only for HD replay. */
(()=>{
 let loading,assets;
 const decode=spec=>{const bytes=Uint8Array.from(atob(spec.data),c=>c.charCodeAt(0));const Type={Float32Array,Uint32Array,Uint16Array,Uint8Array,Int16Array,Int32Array}[spec.type];if(!Type)throw Error('Unsupported HD model data.');return new Type(bytes.buffer);};
 async function load(){
  if(assets)return assets;
  if(loading)return loading;
  loading=(async()=>{
   const script=src=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;
    script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(Error('Could not load the ST-Command HD model. Reload ST Battle and try again.'));};document.head.append(script);
   });
   await Promise.all([window.BattleHDModelData?null:script('assets/hd/st-command-model.js'),window.ENTERPRISE_HULL_PANEL_TILE?null:script('assets/hd/hull-panel-tile.js'),window.createMovieHullSurfaceDetail?null:script('assets/hd/hull-surface-detail.js')]);
   const T=window.AlpineThree,data=window.BattleHDModelData;
   if(data?.version!==1)throw Error('Invalid ST-Command HD model.');
   const textures=await Promise.all(data.textures.map(async spec=>{
    let texture;
    if(spec.dynamic)texture=new T.CanvasTexture(document.createElement('canvas'));
    else if(spec.raw)texture=new T.DataTexture(decode(spec.raw),spec.raw.width,spec.raw.height,spec.raw.format,spec.raw.pixelType);
    else{const image=new Image();image.src=spec.image;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);texture=new T.CanvasTexture(canvas);}
    for(const key of ['colorSpace','wrapS','wrapT','flipY','rotation','minFilter','magFilter','generateMipmaps'])if(spec[key]!==undefined)texture[key]=spec[key];texture.needsUpdate=true;
    for(const key of ['repeat','offset','center'])texture[key].fromArray(spec[key]);texture.anisotropy=4;return texture;
   }));
   const geometries=data.geometries.map(spec=>{
    const geometry=new T.BufferGeometry();for(const [key,a]of Object.entries(spec.attributes))geometry.setAttribute(key,new T.BufferAttribute(decode(a),a.itemSize,a.normalized));
    if(spec.index)geometry.setIndex(new T.BufferAttribute(decode(spec.index),1));for(const group of spec.groups)geometry.addGroup(group.start,group.count,group.materialIndex);return geometry;
   });
   const surface=window.createMovieHullSurfaceDetail(T,4);await surface.ready;
   delete data.geometries;delete data.textures;
   assets={data,textures,geometries,surface};delete window.BattleHDModelData;return assets;
  })();
  try{return await loading;}catch(error){loading=null;throw error;}
 }
 function createShip(scene,name,enemy){
  if(!assets)throw Error('Prepare the HD model before replaying.');
  const T=scene.T,{data,textures,geometries}=assets;
  const anisotropy=scene.renderer.capabilities.getMaxAnisotropy();
  for(const texture of [...textures,assets.surface.texture])if(texture.anisotropy!==anisotropy){texture.anisotropy=anisotropy;texture.needsUpdate=true;}
  const scaledShader=source=>source.replaceAll('smoothstep(0.50,3.50,length(vViewPosition))','smoothstep(0.50,3.50,(length(vViewPosition)/57.0))').replaceAll('vHullPatternPosition=(modelMatrix*vec4(transformed,1.0)).xyz;','vHullPatternPosition=(modelMatrix*vec4(transformed,1.0)).xyz/57.0;').replaceAll('*0.00008*hullPanelWeight','*(0.00008*57.0)*hullPanelWeight');
  const uniform=u=>u.texture!==undefined?textures[u.texture]:u.array?(T[u.kind]?new T[u.kind]().fromArray(u.array):u.array):u.value;
  const materials=data.materials.map((spec,index)=>{
   const Material=T[spec.type]||T.MeshStandardMaterial,m=new Material();
   for(const [key,value]of Object.entries(spec))if(!['type','color','emissive','specular','maps','surface','shader'].includes(key)&&key in m)m[key]=value;
   for(const key of ['color','emissive','specular'])if(spec[key]&&m[key])m[key].fromArray(spec[key]);
   if(spec.shader){
    m.vertexShader=spec.shader.vertexShader;m.fragmentShader=spec.shader.fragmentShader;m.defines=spec.shader.defines;
    m.uniforms=Object.fromEntries(Object.entries(spec.shader.uniforms).map(([key,u])=>[key,{value:u.texture!==undefined?textures[u.texture]:u.array?(T[u.kind]?new T[u.kind]().fromArray(u.array):u.array):u.value}]));
   }
   for(const [key,index]of Object.entries(spec.maps))m[key]=textures[index];
   const hull=enemy&&m.color&&!m.transparent&&!m.isMeshBasicMaterial&&!m.isShaderMaterial&&!spec.patch?.uniforms.windowLit&&Math.max(m.color.r,m.color.g,m.color.b)>.05&&Math.max(m.color.r,m.color.g,m.color.b)-Math.min(m.color.r,m.color.g,m.color.b)<.14;
   if(hull){m.color.setHex(0x3b4249);if('roughness'in m)m.roughness=.38;if('metalness'in m)m.metalness=.72;m.userData.hdGunmetalHull=true;}
   if(spec.patch){
    const uniforms=Object.fromEntries(Object.entries(spec.patch.uniforms).map(([key,u])=>[key,{value:uniform(u)}]));
    if(uniforms.uImpulseBlurMap){const target=new T.WebGLRenderTarget(32,32,{type:T.HalfFloatType,depthBuffer:true});uniforms.uImpulseBlurMap.value=target.texture;m.hdBlur={target,uniforms};m.addEventListener('dispose',()=>target.dispose());}
    m.onBeforeCompile=shader=>{shader.vertexShader=scaledShader(spec.patch.vertexShader);shader.fragmentShader=scaledShader(spec.patch.fragmentShader);if(hull)shader.fragmentShader=shader.fragmentShader.replace(/float hullPanelMask=[^;]+;/,'float hullPanelMask=1.0;');Object.assign(shader.uniforms,uniforms);};
    m.customProgramCacheKey=()=> 'st-command-hd-patch-'+index+(hull?'-gunmetal':'-original');m.userData.hdDetailPatch=true;
   }else if(spec.surface){
    assets.surface.apply(m,spec.surface.mode,{...spec.surface,...(hull?{bareMetal:true}:{})});const before=m.onBeforeCompile;
    m.onBeforeCompile=shader=>{before(shader);shader.vertexShader=scaledShader(shader.vertexShader);shader.fragmentShader=scaledShader(shader.fragmentShader);};
   }
   if(hull&&!spec.surface){
    // Continue the saucer's fine metal plating over otherwise plain hull fittings.
    const detail=m.onBeforeCompile,key=m.customProgramCacheKey();assets.surface.apply(m,0,{bareMetal:true,physical:true});const plating=m.onBeforeCompile;
    m.onBeforeCompile=shader=>{detail.call(m,shader);plating.call(m,shader);shader.vertexShader=scaledShader(shader.vertexShader);shader.fragmentShader=scaledShader(shader.fragmentShader);};
    m.customProgramCacheKey=()=>key+'-yorktown-plated';m.userData.hdDetailPatch=true;m.userData.yorktownHullCoating=true;
   }
   // Geometry scales by 57, so bump depths must use the same units.
   if(m.bumpMap)m.bumpScale*=57;
   return m;
  });
  function node(spec){
   const material=Array.isArray(spec.material)?spec.material.map(i=>materials[i]):materials[spec.material];
   const object=spec.geometry===undefined?new T.Group():spec.instances?new T.InstancedMesh(geometries[spec.geometry],material,spec.count):new T.Mesh(geometries[spec.geometry],material);
   if(spec.geometry!==undefined&&[].concat(material).some(m=>m.userData.yorktownHullCoating)&&!object.geometry.attributes.hullSurfaceUv){
    const geometry=object.geometry;
    if(geometry.attributes.uv)geometry.setAttribute('hullSurfaceUv',geometry.attributes.uv.clone());
    else{
     const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[];
     for(let i=0;i<p.count;i++){
      const nx=Math.abs(n?.getX(i)||0),ny=Math.abs(n?.getY(i)||0),nz=Math.abs(n?.getZ(i)||0);
      uv.push((nx>=ny&&nx>=nz?p.getZ(i):p.getX(i))/.085,(ny>=nx&&ny>=nz?p.getZ(i):p.getY(i))/.085);
     }
     geometry.setAttribute('hullSurfaceUv',new T.Float32BufferAttribute(uv,2));
    }
   }
   if(spec.instances){object.instanceMatrix.array.set(decode(spec.instances));object.instanceMatrix.needsUpdate=true;}
   if(spec.instanceColor)object.instanceColor=new T.BufferAttribute(decode(spec.instanceColor),3);
   object.name=spec.name;object.visible=spec.visible;object.renderOrder=spec.renderOrder;
   object.matrix.fromArray(spec.matrix).decompose(object.position,object.quaternion,object.scale);
   for(const child of spec.children)object.add(node(child));return object;
  }
  const root=new T.Group(),model=node(data.model);root.name=name;root.add(model);model.scale.setScalar(57);model.position.z=25;
  model.traverse(pane=>{
   if(!pane.material?.hdBlur)return;const {target,uniforms}=pane.material.hdBlur,room=new T.Scene(),surfaces=pane.parent.children.filter(o=>o.isMesh&&o!==pane).map(source=>{const proxy=new T.Mesh(source.geometry,source.material);proxy.matrixAutoUpdate=false;room.add(proxy);return {source,proxy};});let capturing=false;
   pane.onBeforeRender=(renderer,scene,camera)=>{
    if(capturing)return;capturing=true;const previous=renderer.getRenderTarget(),width=previous?.width??renderer.domElement.width,height=previous?.height??renderer.domElement.height,scale=Math.min(.5,1024/Math.max(width,height)),w=Math.max(16,Math.round(width*scale)),h=Math.max(16,Math.round(height*scale));
    if(target.width!==w||target.height!==h)target.setSize(w,h);Object.assign(uniforms.uImpulseViewport.value,{x:width,y:height});Object.assign(uniforms.uImpulseTexel.value,{x:1/w,y:1/h});
    const shadowUpdate=renderer.shadowMap.autoUpdate;
    try{for(const {source,proxy}of surfaces)proxy.matrix.copy(source.matrixWorld);renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(target);renderer.render(room,camera);}
    finally{renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadowUpdate;capturing=false;}
   };
  });
  const find=name=>model.getObjectByName(name),pylons=[];
  for(const [side,x]of [['port',-.075],['starboard',.075]]){
   const strut=find(side+'-engine-strut'),shoe=find(side+'-engine-pylon-shoe');
   if(strut){
    // The shelf at the top of the pylon belongs to the breakaway assembly too.
    const pylon=new T.Group();pylon.name=side+'-hd-pylon-assembly';model.add(pylon);model.updateWorldMatrix(true,true);
    pylon.attach(strut);if(shoe)pylon.attach(shoe);
    pylon.userData.pylonSide=side;pylon.userData.attachmentPoint={x,y:.05,z:-.05};pylons.push(pylon);
   }
  }
  root.userData={model,hd:true,engineeringHull:find('secondary-hull'),saucer:find('movie-saucer'),nacelles:{port:find('port-movie-nacelle'),starboard:find('starboard-movie-nacelle')},detachedVisuals:new Set(),scars:[],mountScars:{},engineGlows:[],damageGlows:[],breakupParts:[find('reference-saucer-assembly'),find('reference-engineering-assembly'),...pylons,find('port-movie-nacelle'),find('starboard-movie-nacelle')].filter(Boolean)};
  scene.addPhaserEmitters(root);root.userData.trails=scene.makeEngineTrails(model);return root;
 }
 window.BattleReplayHD={load,createShip};
})();
