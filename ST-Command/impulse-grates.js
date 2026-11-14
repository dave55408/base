/* Real openings through the aft impulse face, with bevels and inset metal grilles. */
window.addRecessedImpulseGrates=(T,housing,outline,saucer)=>{
 const faceZ=-.828,centerY=.379,halfW=.031,halfH=.014,depth=.006;
 const group=new T.Group();group.name='recessed-impulse-grates';const emitters=[];
 const original=housing.geometry,p=original.attributes.position,index=original.index,kept=[];
 // Remove the original solid aft cap before rebuilding it around the apertures.
 for(let i=0;i<index.count;i+=3){const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!tri.every(j=>Math.abs(p.getZ(j)-faceZ)<1e-7))kept.push(...tri);}
 original.setIndex(kept);
 const positions=[],indices=[];
 function quad(a,b,c,d){const n=positions.length/3;positions.push(...a,...b,...c,...d);indices.push(n,n+1,n+2,n,n+2,n+3);}
 function extent(y){let right=0;for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];if(Math.abs(a[1]-b[1])<1e-10){if(Math.abs(y-a[1])<1e-9)right=Math.max(right,a[0],b[0]);}else if(y>=Math.min(a[1],b[1])-1e-9&&y<=Math.max(a[1],b[1])+1e-9)right=Math.max(right,a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}return right;}
 const levels=[...new Set([...outline.map(v=>Math.round(v[1]*1e10)/1e10),centerY-halfH,centerY+halfH])].sort((a,b)=>a-b);
 for(let i=1;i<levels.length;i++){
  const y0=levels[i-1],y1=levels[i],r0=extent(y0),r1=extent(y1),cut=(y0+y1)/2>centerY-halfH&&(y0+y1)/2<centerY+halfH;
  if(cut){for(const [l,r] of [[null,-.092],[.092,null]])quad([l??-r0,y0,faceZ],[r??r0,y0,faceZ],[r??r1,y1,faceZ],[l??-r1,y1,faceZ]);}
  else quad([-r0,y0,faceZ],[r0,y0,faceZ],[r1,y1,faceZ],[-r1,y1,faceZ]);
 }
 // Rebuild the center strip around a real circular aperture and shallow bevel.
 const portRadius=.004,portInnerRadius=.0038,portDepth=.0007;
 const portAngles=Array.from({length:96},(_,i)=>i*Math.PI/48);
 for(const x of [-.030,.030])for(const y of [-halfH,halfH])portAngles.push((Math.atan2(y,x)+Math.PI*2)%(Math.PI*2));portAngles.sort((a,b)=>a-b);portAngles.push(Math.PI*2);
 for(let i=1;i<portAngles.length;i++){
  const points=portAngles.slice(i-1,i+1).map(a=>{const x=Math.cos(a),y=Math.sin(a),r=Math.min(.030/Math.max(1e-12,Math.abs(x)),halfH/Math.max(1e-12,Math.abs(y)));return {outer:[x*r,centerY+y*r,faceZ],lip:[x*portRadius,centerY+y*portRadius,faceZ],inner:[x*portInnerRadius,centerY+y*portInnerRadius,faceZ-portDepth]};});
  const [a,b]=points;quad(a.lip,a.outer,b.outer,b.lip);quad(a.inner,a.lip,b.lip,b.inner);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const face=new T.Mesh(geo,housing.material);face.name='impulse-face-with-openings';group.add(face);
 const port=new T.Mesh(new T.CylinderGeometry(portInnerRadius,portInnerRadius,.0002,64),new T.MeshBasicMaterial({color:0x090e14,toneMapped:false,side:T.DoubleSide}));
 port.name='movie-impulse-center-port';port.rotation.x=Math.PI/2;port.position.set(0,centerY,faceZ-portDepth-.0001);group.add(port);
 port.userData.recess={faceZ,depth:portDepth,radius:portRadius};
 const grate=new T.MeshStandardMaterial({color:0x000000,roughness:.90,metalness:.12}),reveal=new T.MeshStandardMaterial({color:0x43494e,roughness:.92,metalness:.12,side:T.DoubleSide});
 const chamberDepth=.060;
 // Subtract the chamber passages from internal skins, keeping all exterior
 // faces outside the shared room volume and preserving UVs/material groups.
 function carvePassages(mesh){
  const old=mesh.geometry,attributes=Object.entries(old.attributes),names=attributes.map(([name])=>name),sizes=attributes.map(([,a])=>a.itemSize),offsets=[];let stride=0;for(const size of sizes){offsets.push(stride);stride+=size;}
  const posOffset=offsets[names.indexOf('position')],output=Object.fromEntries(names.map(n=>[n,[]])),groups=[],idx=old.index,total=idx?idx.count:old.attributes.position.count;
  mesh.updateMatrix();const inverse=mesh.matrix.clone().invert();
  function vertex(j){const data=[];for(const [,a]of attributes)for(let k=0;k<a.itemSize;k++)data.push(a.array[j*a.itemSize+k]);const v=new T.Vector3(data[posOffset],data[posOffset+1],data[posOffset+2]).applyMatrix4(mesh.matrix);data[posOffset]=v.x;data[posOffset+1]=v.y;data[posOffset+2]=v.z;return data;}
  function clip(poly,axis,edge,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[posOffset+axis]-edge)*sign,db=(b[posOffset+axis]-edge)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out;}
  let count=0;for(let i=0;i<total;i+=3){let pieces=[[vertex(idx?idx.getX(i):i),vertex(idx?idx.getX(i+1):i+1),vertex(idx?idx.getX(i+2):i+2)]];
   for(const side of [0]){const x=0,planes=[[1,centerY-.0125,1],[1,centerY+.0125,-1],[0,x-.0905,1],[0,x+.0905,-1],[2,faceZ-chamberDepth-.0006,1],[2,faceZ-depth+.0001,-1]],kept=[];
    for(const poly of pieces){if(planes.some(([axis,edge,sign])=>poly.every(v=>(v[posOffset+axis]-edge)*sign<0))){kept.push(poly);continue;}let inside=poly;for(const [axis,edge,sign]of planes){if(inside.length<3)break;const outside=clip(inside,axis,edge,-sign);if(outside.length>=3)kept.push(outside);inside=clip(inside,axis,edge,sign);}}pieces=kept;
   }
   const material=old.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0,start=count;
   for(const poly of pieces)for(let n=1;n<poly.length-1;n++)for(const v0 of [poly[0],poly[n],poly[n+1]]){const v=v0.slice(),local=new T.Vector3(v[posOffset],v[posOffset+1],v[posOffset+2]).applyMatrix4(inverse);v[posOffset]=local.x;v[posOffset+1]=local.y;v[posOffset+2]=local.z;names.forEach((name,k)=>output[name].push(...v.slice(offsets[k],offsets[k]+sizes[k])));count++;}
   if(count>start){const previous=groups.at(-1);if(previous?.materialIndex===material)previous.count+=count-start;else groups.push({start,count:count-start,materialIndex:material});}
  }
  const geometry=new T.BufferGeometry();names.forEach((name,k)=>geometry.setAttribute(name,new T.Float32BufferAttribute(output[name],sizes[k])));for(const g of groups)geometry.addGroup(g.start,g.count,g.materialIndex);geometry.userData={...old.userData,impulseChamberPassages:true};mesh.geometry=geometry;old.dispose();
 }
 carvePassages(housing);if(saucer)carvePassages(saucer);
 function box(name,x,y,z,w,h,d,mat){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);group.add(mesh);return mesh;}
 const chambers=new T.Group();chambers.name='impulse-interior-room';group.add(chambers);
 const roomGlows=[];
 for(const chamberSide of [-1,1]){
 const room=new T.Group();room.name=(chamberSide<0?'port':'starboard')+'-impulse-room';chambers.add(room);
 const roomCenterX=chamberSide*.061;
 const roomHalfWidth=.0295,roomHalfHeight=halfH-.0015,backZ=faceZ-chamberDepth,roomLength=chamberDepth-depth,roomZ=faceZ-(depth+chamberDepth)/2;
 function roomBox(name,x,y,z,w,h,d,mat){const part=box(name,x,y,z,w,h,d,mat);room.add(part);return part;}
 roomBox('impulse-room-back-wall',roomCenterX,centerY,backZ-.0003,roomHalfWidth*2,roomHalfHeight*2,.0006,null);
 for(const side of [-1,1]){
  roomBox('impulse-room-side-wall',roomCenterX+side*(roomHalfWidth+.0004),centerY,roomZ,.0008,roomHalfHeight*2,roomLength,null);
  roomBox('impulse-room-deck',roomCenterX,centerY+side*(roomHalfHeight+.0004),roomZ,roomHalfWidth*2,.0008,roomLength,null);
 }
 const light=new T.Light(0xc52617,.00000016);light.isPointLight=true;light.type='PointLight';light.distance=.07;light.decay=2;light.position.set(roomCenterX,centerY,backZ+.006);light.name='impulse-room-red-emitter';room.add(light);emitters.push(light);
 const glowTime={value:0},glowPulse={value:1};
 const swirlingRed=new T.ShaderMaterial({side:T.DoubleSide,toneMapped:false,
  uniforms:{uTime:glowTime,uPulse:glowPulse,uOpacity:{value:1},uRoomOrigin:{value:new T.Vector3(roomCenterX,centerY,backZ)},uDeepRed:{value:new T.Color(0x360704)},uHotRed:{value:new T.Color(0xb51b10)}},
  vertexShader:`attribute vec3 roomPosition;varying vec3 vGlowPoint;void main(){vGlowPoint=roomPosition;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform float uTime,uPulse,uOpacity;uniform vec3 uDeepRed,uHotRed,uRoomOrigin;varying vec3 vGlowPoint;
   float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
   float cloudAt(vec2 q,vec2 warp,float t){return .78*noise3(vec3(q*2.3,t))+.22*noise3(vec3(q*4.9-warp,t*.7));}
   void main(){vec3 room=(vGlowPoint-uRoomOrigin)/.025;float t=uTime*.13+room.z*.65;vec2 p=room.xy;
    vec2 warp=vec2(noise3(vec3(p*1.15,t)),noise3(vec3(p*1.15+vec2(4.3,8.1),-t)))-.5;
    float angle=.35*uTime+.85*noise3(vec3(p*.7,t*.5));float c=cos(angle),s=sin(angle);
    vec2 q=mat2(c,-s,s,c)*p+warp*1.4;
    // Blur the animated field itself, so the room keeps a soft cloudlike glow.
    float cloud=.40*cloudAt(q,warp,t)+.15*(cloudAt(q+vec2(.18,0),warp,t)+cloudAt(q-vec2(.18,0),warp,t)+cloudAt(q+vec2(0,.18),warp,t)+cloudAt(q-vec2(0,.18),warp,t));
    float heat=smoothstep(.12,.88,cloud);vec3 emission=mix(uDeepRed,uHotRed,heat)*(.32+.10*cloud)*uPulse;
    gl_FragColor=vec4(emission,uOpacity);
    #include <colorspace_fragment>
   }`});
 function mapRoomSurface(mesh){const p=mesh.geometry.attributes.position,points=[];for(let i=0;i<p.count;i++)points.push(p.getX(i)+mesh.position.x,p.getY(i)+mesh.position.y,p.getZ(i)+mesh.position.z);mesh.geometry.setAttribute('roomPosition',new T.Float32BufferAttribute(points,3));}
 for(const surface of room.children)if(surface.isMesh){surface.material=swirlingRed;mapRoomSurface(surface);}
 // A broad feathered light layer hangs just in front of the back wall.
 const diffuseMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false,
  uniforms:{uPulse:glowPulse,uColor:{value:new T.Color(0xb51b10)}},
  vertexShader:`varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform float uPulse;uniform vec3 uColor;varying vec2 vUV;
   void main(){float y=(vUV.y-.5)*2.0;float left=(vUV.x-.26)/.38,right=(vUV.x-.74)/.38;
    float soft=exp(-y*y*2.8)*(exp(-left*left*2.0)+exp(-right*right*2.0))*.65;
    float edge=smoothstep(0.0,.10,vUV.x)*smoothstep(0.0,.10,1.0-vUV.x)*smoothstep(0.0,.12,vUV.y)*smoothstep(0.0,.12,1.0-vUV.y);
    gl_FragColor=vec4(uColor*.6,soft*edge*.30*uPulse);
    #include <colorspace_fragment>
   }`});
 const diffuseGlow=new T.Mesh(new T.PlaneGeometry(roomHalfWidth*2,roomHalfHeight*2),diffuseMaterial);diffuseGlow.name='impulse-room-diffuse-red-glow';diffuseGlow.position.set(roomCenterX,centerY,backZ+.004);room.add(diffuseGlow);
 // A dark frosted pane softens highlights while revealing the room behind it.
 const frostCanvas=document.createElement('canvas');frostCanvas.width=256;frostCanvas.height=64;
 const fc=frostCanvas.getContext('2d'),pixels=fc.createImageData(256,64);let seed=417;
 for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=96+(seed>>>26);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}fc.putImageData(pixels,0,0);
 const frost=new T.CanvasTexture(frostCanvas);frost.anisotropy=4;
 const translucentMaterial=new T.MeshStandardMaterial({color:0x000000,roughness:.68,metalness:0,bumpMap:frost,bumpScale:.00020,transparent:true,opacity:.80,depthWrite:false,side:T.DoubleSide});

 // Overlap the full outer window opening, not just the narrower room.
 // The housing hides the extra border, sealing the bright bypass around
 // the bevel while preserving the pane's 80 percent opacity and blur.
 const frontWall=new T.Mesh(new T.PlaneGeometry((halfW+.001)*2,(halfH+.001)*2),translucentMaterial);frontWall.name='impulse-room-translucent-front-wall';frontWall.position.set(roomCenterX,centerY,faceZ-.0043);frontWall.renderOrder=2;mapRoomSurface(frontWall);room.add(frontWall);
 // Sample the room through a small Gaussian blur while keeping the metal bars crisp.
 const blurTarget=new T.WebGLRenderTarget(32,32,{type:T.HalfFloatType,depthBuffer:true});
 const blurScene=new T.Scene(),blurSurfaces=room.children.filter(o=>o.isMesh&&o!==frontWall).map(source=>{const proxy=new T.Mesh(source.geometry,source.material);proxy.matrixAutoUpdate=false;blurScene.add(proxy);return {source,proxy};});
 const blurMap={value:blurTarget.texture},blurViewport={value:{x:1,y:1}},blurTexel={value:{x:1,y:1}};
 translucentMaterial.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,{uImpulseBlurMap:blurMap,uImpulseViewport:blurViewport,uImpulseTexel:blurTexel});
  shader.fragmentShader='uniform sampler2D uImpulseBlurMap;uniform vec2 uImpulseViewport,uImpulseTexel;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
   vec2 glassUV=gl_FragCoord.xy/uImpulseViewport,stepUV=uImpulseTexel*.8;
   vec3 softened=texture2D(uImpulseBlurMap,glassUV).rgb*.25;
   softened+=(texture2D(uImpulseBlurMap,glassUV+vec2(stepUV.x,0.0)).rgb+texture2D(uImpulseBlurMap,glassUV-vec2(stepUV.x,0.0)).rgb+texture2D(uImpulseBlurMap,glassUV+vec2(0.0,stepUV.y)).rgb+texture2D(uImpulseBlurMap,glassUV-vec2(0.0,stepUV.y)).rgb)*.125;
   softened+=(texture2D(uImpulseBlurMap,glassUV+stepUV).rgb+texture2D(uImpulseBlurMap,glassUV-stepUV).rgb+texture2D(uImpulseBlurMap,glassUV+vec2(stepUV.x,-stepUV.y)).rgb+texture2D(uImpulseBlurMap,glassUV+vec2(-stepUV.x,stepUV.y)).rgb)*.0625;
   gl_FragColor=vec4(softened*(1.0-opacity)+outgoingLight,1.0);`);
 };
 translucentMaterial.customProgramCacheKey=()=> 'impulse-frosted-wall-gaussian-blur-v1';
 translucentMaterial.addEventListener('dispose',()=>blurTarget.dispose());
 let capturingBlur=false;
 frontWall.onBeforeRender=(renderer,scene,camera)=>{
  if(capturingBlur)return;capturingBlur=true;
  const previous=renderer.getRenderTarget(),width=previous?.width??renderer.domElement.width,height=previous?.height??renderer.domElement.height;
  const scale=Math.min(.5,1024/Math.max(width,height)),w=Math.max(16,Math.round(width*scale)),h=Math.max(16,Math.round(height*scale));
  if(blurTarget.width!==w||blurTarget.height!==h)blurTarget.setSize(w,h);
  blurViewport.value.x=width;blurViewport.value.y=height;blurTexel.value.x=1/w;blurTexel.value.y=1/h;
  const shadowUpdate=renderer.shadowMap.autoUpdate;
  try{for(const {source,proxy}of blurSurfaces)proxy.matrix.copy(source.matrixWorld);renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(blurTarget);renderer.render(blurScene,camera);}
  finally{renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadowUpdate;capturingBlur=false;}
 };
 frontWall.userData.blur={kernel:'gaussian',samples:9,subtle:true};
 const phaseOffset=chamberSide<0?0:1.3,pulsePeriod=chamberSide<0?5:5.2,timeDirection=chamberSide<0?1:-1;
 room.userData={depth:chamberDepth,width:roomHalfWidth*2,pulsingGlow:true,enclosed:true,sharedOutlets:false,shaderCoated:true,phaseOffset,pulsePeriod,timeDirection};
 roomGlows.push({glowTime,glowPulse,light,phaseOffset,pulsePeriod,timeDirection});
 }
 chambers.userData={depth:chamberDepth,sharedOutlets:false,roomCount:2};
 for(const side of [-1,1]){
  const x=side*.061,name=(side<0?'port':'starboard')+'-impulse',innerW=halfW-.0015,innerH=halfH-.0015;
  const outer=[[-halfW,-halfH],[halfW,-halfH],[halfW,halfH],[-halfW,halfH]],inner=[[-innerW,-innerH],[innerW,-innerH],[innerW,innerH],[-innerW,innerH]],bp=[],bi=[];
  for(let i=0;i<4;i++){const j=(i+1)%4,n=bp.length/3;for(const [v,z] of [[outer[i],faceZ],[outer[j],faceZ],[inner[j],faceZ-depth],[inner[i],faceZ-depth]])bp.push(x+v[0],centerY+v[1],z);bi.push(n,n+1,n+2,n,n+2,n+3);}
  const bevelGeo=new T.BufferGeometry();bevelGeo.setAttribute('position',new T.Float32BufferAttribute(bp,3));bevelGeo.setIndex(bi);bevelGeo.computeVertexNormals();const bevel=new T.Mesh(bevelGeo,reveal);bevel.name=name+'-recess-walls';group.add(bevel);
  for(let i=0;i<13;i++)box(name+'-grate-vertical',x-innerW+(i+.5)*innerW*2/13,centerY,faceZ-.0035,.00048,innerH*2,.00065,grate);
  for(let i=0;i<6;i++)box(name+'-grate-horizontal',x,centerY-innerH+(i+.5)*innerH*2/6,faceZ-.0032,innerW*2,.00045,.00065,grate);
 }
 group.userData.recessDepth=depth;
 // Keep a red standby glow through the frosted panes at the bottom of every pulse.
 group.userData.updateGlow=time=>{const seconds=Number.isFinite(time)?time:0;for(const state of roomGlows){const localTime=seconds*state.timeDirection+state.phaseOffset,pulse=.5+.5*Math.sin(localTime*Math.PI*2/state.pulsePeriod);state.glowTime.value=localTime;state.glowPulse.value=.65+.70*pulse;state.light.intensity=.00000010+.00000012*pulse;}};
 group.userData.updateGlow(0);return group;
};
