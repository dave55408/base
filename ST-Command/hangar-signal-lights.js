/* Self-lit hangar lamps with soft, depth-tested halos on the aft face. */
window.addHangarLandingLights=(T,model,profile,hullMaterial)=>{
 const housingMaterial=hullMaterial.clone();housingMaterial.color.multiplyScalar(.88);
 const lensCanvas=document.createElement('canvas');lensCanvas.width=64;lensCanvas.height=64;const c=lensCanvas.getContext('2d');
 const gradient=c.createLinearGradient(0,0,0,64);gradient.addColorStop(0,'#454545');gradient.addColorStop(.25,'#b0b0b0');gradient.addColorStop(.48,'#ffffff');gradient.addColorStop(.64,'#dadada');gradient.addColorStop(1,'#505050');c.fillStyle=gradient;c.fillRect(0,0,64,64);
 const lensMap=new T.CanvasTexture(lensCanvas);lensMap.colorSpace=T.SRGBColorSpace;
 const roundHousingMaterial=hullMaterial.clone();roundHousingMaterial.color.lerp(new T.Color(0xffffff),.3);
 const disc=(diameter,depth)=>{const g=new T.CylinderGeometry(diameter/2,diameter/2,depth,32);g.rotateX(Math.PI/2);g.scale(1,1/profile.scaleY,1);return g;};
 const specs=[['port-hangar-red-light',0xff5545,.022,.002],['starboard-hangar-red-light',0xff5545,.022,.002],['hangar-green-light',0x65efad,.008,.008],['port-hangar-yellow-light',0xffce72,.0018,.011],['starboard-hangar-yellow-light',0xffce72,.0018,.011]];
 for(const [name,color,w,rawH] of specs){
  const lamp=model.getObjectByName(name),h=rawH/profile.scaleY;if(!lamp)continue;
  const round=name==='hangar-green-light';
  if(round){lamp.geometry.dispose();lamp.geometry=disc(w,.002);}
  addHangarSignalGlow(T,lamp,color,w,round?h*1.4/3:h);
  lamp.material=new T.MeshStandardMaterial({color,map:lensMap,emissive:color,emissiveMap:lensMap,emissiveIntensity:.8,roughness:.24,metalness:.1,toneMapped:false});
  const surround=new T.Mesh(round?disc(w+.0024,.001):new T.BoxGeometry(w+.0012,h+.0012/profile.scaleY,.001),round?roundHousingMaterial:housingMaterial);surround.name=name+'-bezel';surround.position.copy(lamp.position);surround.position.z-=.0008;lamp.parent.add(surround);
  const core=new T.Mesh(round?disc(w*.65,.0001):new T.PlaneGeometry(w*.82,h*.22),new T.MeshBasicMaterial({color:new T.Color(color).lerp(new T.Color(0xffffff),.35),toneMapped:false}));core.name=name+'-lens-core';core.position.copy(lamp.position);core.position.z+=.00105;lamp.parent.add(core);
 }
};
window.addHangarSignalGlow=(T,lamp,color,width,height,depth=.002)=>{
 if(lamp.geometry.type==='SphereGeometry'){
  lamp.material=lamp.material.clone();lamp.material.color.setHex(color);lamp.material.emissive.setHex(color);lamp.material.emissiveIntensity=1.8;
 }else lamp.material=new T.MeshBasicMaterial({color,toneMapped:false});
 if(!addHangarSignalGlow.texture){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  const gradient=c.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.28,'rgba(255,255,255,.65)');gradient.addColorStop(.6,'rgba(255,255,255,.18)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=gradient;c.fillRect(0,0,128,128);addHangarSignalGlow.texture=new T.CanvasTexture(canvas);
 }
 const halo=new T.Mesh(new T.PlaneGeometry(width*1.4,height*3),new T.MeshBasicMaterial({map:addHangarSignalGlow.texture,color,transparent:true,opacity:.12,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
 halo.name=lamp.name+'-glow';halo.position.copy(lamp.position);halo.position.z+=depth/2+.0003;halo.renderOrder=10;lamp.parent.add(halo);
 return lamp;
};

/* A thin tinted glass cover preserves the animated emitter underneath. */
window.applyGlassLightLenses=(T,root)=>{
 const lenses=[];
 root.traverse(mesh=>{
  const mat=mesh.material,name=mesh.name;
  if(!mesh.isMesh||Array.isArray(mat)||!mat?.color||mat.isShaderMaterial||mesh.userData.glassLens)return;
  if(/glow|halo|core|bezel|housing|mount|collar|pool|frame|emitter|glass-cover/.test(name))return;
  if(mat.userData.lightLens||mat.userData.hangarSignalLens||/(?:^|-)(?:light|lamp|beacon|status)(?:-|$)/.test(name))lenses.push(mesh);
 });
 for(const lens of lenses){
  const source=lens.material;
  const glass=new T.MeshPhongMaterial({color:source.color.clone().multiplyScalar(.18),specular:0x8797a3,shininess:110,map:source.map??null,transparent:true,opacity:.30,depthWrite:false,side:source.side,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const hasUV=!!lens.geometry.attributes.uv;
  glass.onBeforeCompile=shader=>{
   if(hasUV){shader.vertexShader='varying vec2 vLensUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvLensUv=uv;');shader.fragmentShader='varying vec2 vLensUv;\n'+shader.fragmentShader;}
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    float lensRim=pow(1.0-clamp(abs(dot(normal,normalize(vViewPosition))),0.0,1.0),3.0);
    diffuseColor.a*=.35+.65*lensRim;
    ${hasUV?'float lensArc=.80-.16*pow(vLensUv.x-.5,2.0);float lensGlint=pow(max(0.0,1.0-abs(vLensUv.y-lensArc)/.045),2.0);outgoingLight+=vec3(.32,.36,.39)*lensGlint;':''}
    #include <opaque_fragment>`);
  };
  glass.customProgramCacheKey=()=>hasUV?'light-glass-uv-v1':'light-glass-v1';
  const cover=new T.Mesh(lens.geometry,glass);cover.name=lens.name+'-glass-cover';cover.scale.setScalar(1.025);cover.renderOrder=lens.renderOrder+1;cover.userData.glassLens=true;
  lens.userData.glassLens=true;lens.add(cover);
 }
 return lenses.length;
};
