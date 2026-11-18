/* Aft bridge hatch fitted to the original attached block. */
window.createBridgeDockingPort=(T,{centerY,hull,dome})=>{
 const port=new T.Group();port.name='aft-bridge-docking-port';port.position.set(0,centerY,-1.466);
 const faceZ=.0175,doorZ=.0165,raisedZ=.0191,outer=.00966,opening=.00791,doorRadius=.00787,overlap=.00008;
 const metal=(color,roughness=.58)=>new T.MeshStandardMaterial({color,roughness,metalness:.35});
 // Smooth, unpatterned hatch faces retain their silver color and lettering.
 const door=new T.MeshStandardMaterial({color:0x969f9c,roughness:.42,metalness:.78}),rim=new T.MeshStandardMaterial({color:0xa6aaa3,roughness:.34,metalness:.75}),lightHousing=metal(0x858e85,.74),bolt=new T.MeshStandardMaterial({color:hull.color,roughness:.8,metalness:.1});
 // Angular black lettering is painted directly on the silver, with no white decal.
 const label=document.createElement('canvas');label.width=2048;label.height=160;const lc=label.getContext('2d');
 const glyphs={
  U:[[[0,0],[0,.85],[.15,1],[.57,1],[.72,.85],[.72,0]]],
  S:[[[.72,.13],[.59,0],[.13,0],[0,.13],[0,.40],[.13,.50],[.59,.50],[.72,.60],[.72,.87],[.59,1],[.13,1],[0,.87]]],
  E:[[[.72,0],[0,0],[0,1],[.72,1]],[[0,.50],[.62,.50]]],
  N:[[[0,1],[0,0],[.72,1],[.72,0]]],
  T:[[[0,0],[.72,0]],[[.36,0],[.36,1]]],
  R:[[[0,1],[0,0],[.59,0],[.72,.13],[.72,.37],[.59,.50],[0,.50]],[[.36,.50],[.72,1]]],
  P:[[[0,1],[0,0],[.59,0],[.72,.13],[.72,.37],[.59,.50],[0,.50]]],
  I:[[[.07,0],[.07,1]]]
 };
 lc.save();lc.translate(12,16);lc.scale(120,120);lc.strokeStyle=lc.fillStyle='#000000';lc.lineWidth=.14;lc.lineJoin='bevel';lc.lineCap='butt';let cursor=0;
 for(const letter of 'U.S.S. ENTERPRISE'){
  if(letter===' '){cursor+=.42;continue;}
  if(letter==='.'){lc.fillRect(cursor,.86,.14,.14);cursor+=.30;continue;}
  for(const path of glyphs[letter]){lc.beginPath();path.forEach(([x,y],i)=>i?lc.lineTo(cursor+x,y):lc.moveTo(cursor+x,y));lc.stroke();}
  cursor+=(letter==='I'?.14:.72)+.20;
 }
 lc.restore();
 const pixels=lc.getImageData(0,0,label.width,label.height).data;let left=label.width,right=0,top=label.height,bottom=0;
 for(let y=0;y<label.height;y++)for(let x=0;x<label.width;x++)if(pixels[(y*label.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const paintCanvas=document.createElement('canvas');paintCanvas.width=paintCanvas.height=1024;const paintContext=paintCanvas.getContext('2d');paintContext.fillStyle='#ffffff';paintContext.fillRect(0,0,1024,1024);
 const labelWidth=1024*.6,labelHeight=labelWidth*(bottom-top+1)/(right-left+1);
 paintContext.drawImage(label,left,top,right-left+1,bottom-top+1,(1024-labelWidth)/2,1024*.45-labelHeight/2,labelWidth,labelHeight);
 const paintMap=new T.CanvasTexture(paintCanvas);paintMap.colorSpace=T.SRGBColorSpace;paintMap.anisotropy=8;
 door.map=paintMap;door.userData.smoothSurface=true;
 door.userData.hatchLettering={text:'U.S.S. ENTERPRISE',widthFraction:.6,heightFromBottom:.55,ink:0x000000};
 // A soft sky-and-hull reflection gives the silver a visible metallic response.
 const reflectionCanvas=document.createElement('canvas');reflectionCanvas.width=128;reflectionCanvas.height=64;
 const reflection=reflectionCanvas.getContext('2d'),gradient=reflection.createLinearGradient(0,0,0,64);
 for(const [stop,color]of [[0,'#33414c'],[.35,'#77858b'],[.49,'#d1d7d5'],[.57,'#929d9d'],[1,'#566368']])gradient.addColorStop(stop,color);
 reflection.fillStyle=gradient;reflection.fillRect(0,0,128,64);const reflectionMap=new T.CanvasTexture(reflectionCanvas);reflectionMap.colorSpace=T.SRGBColorSpace;reflectionMap.mapping=303;
 for(const material of [door,rim]){material.envMap=reflectionMap;material.envMapIntensity=1.1;material.userData.externalReflection=true;}
 // Match the silver hatch with a subtly darker panel directly behind it.
 const surround=door.clone();surround.color.multiplyScalar(.88);surround.map=null;surround.side=T.DoubleSide;
 door.side=rim.side=T.DoubleSide;
 delete surround.userData.hatchLettering;
 const add=(geometry,material,name,x=0,y=0,z=0)=>{const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);port.add(mesh);return mesh;};
 const box=(name,x,y,z,w,h,d,mat)=>add(new T.BoxGeometry(w,h,d),mat,name,x,y,z);
 const geometry=(positions,indices)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;};
 // Keep the original side planes; the two ends lead through the actual passage.
 const blockGeometry=new T.BoxGeometry(.021,.031,.035),blockIndices=Array.from(blockGeometry.index.array),kept=[];
 for(const group of blockGeometry.groups)if(group.materialIndex<4)kept.push(...blockIndices.slice(group.start,group.start+group.count));
 blockGeometry.setIndex(kept);blockGeometry.clearGroups();
 const block=add(blockGeometry,surround,'docking-port-surround');
 const angles=Array.from({length:96},(_,i)=>i*Math.PI/48);
 for(const x of [-.0105,.0105])for(const y of [-.0155,.0155])angles.push((Math.atan2(y,x)+Math.PI*2)%(Math.PI*2));angles.sort((a,b)=>a-b);angles.push(Math.PI*2);
 const framePositions=[],frameIndices=[];
 for(const a of angles){const c=Math.cos(a),s=Math.sin(a),r=Math.min(.0105/Math.max(1e-12,Math.abs(c)),.0155/Math.max(1e-12,Math.abs(s)));framePositions.push(c*opening,s*opening,faceZ,c*r,s*r,faceZ);}
 for(let i=0;i<angles.length-1;i++){const j=i*2;frameIndices.push(j,j+1,j+3,j,j+3,j+2);}
 add(geometry(framePositions,frameIndices),surround,'docking-block-aft-face');
 // Close the back of the hatch wall around its aperture, so the corridor sees
 // a finished gray bulkhead rather than the reverse of an exterior-only face.
 const innerFrame=[],innerIndices=[],frameCount=framePositions.length/3,bulkheadThickness=.0003;
 for(const z of [doorZ-.0004,doorZ-.0004+bulkheadThickness])for(let i=0;i<frameCount;i++)innerFrame.push(framePositions[i*3],framePositions[i*3+1],z);
 for(let i=0;i<frameIndices.length;i+=3){const [a,b,c]=frameIndices.slice(i,i+3);innerIndices.push(a,c,b,a+frameCount,b+frameCount,c+frameCount);}
 // The continuous recess wall closes the aperture edge. A second cylindrical
 // face here would overlap it and flicker along the rim at close range.
 for(let i=0;i<angles.length-1;i++){const a=i*2+1,b=(i+1)*2+1;innerIndices.push(a,b,b+frameCount,a,b+frameCount,a+frameCount);}
 const insideFace=add(geometry(innerFrame,innerIndices),new T.MeshStandardMaterial({color:0x303236,roughness:1,metalness:0,side:T.DoubleSide}),'docking-block-interior-face');insideFace.userData.wallThickness=bulkheadThickness;
 function ring(name,inner,outerRadius,z,mat){
  const p=[],indices=[];for(const a of angles)for(const r of [inner,outerRadius])p.push(Math.cos(a)*r,Math.sin(a)*r,z);
  for(let i=0;i<angles.length-1;i++){const j=i*2;indices.push(j,j+1,j+3,j,j+3,j+2);}return add(geometry(p,indices),mat,name);
 }
 function wall(name,r,z0,z1,mat,inward=false){
  const p=[],indices=[];for(const a of angles)for(const z of [z0,z1])p.push(Math.cos(a)*r,Math.sin(a)*r,z);
  for(let i=0;i<angles.length-1;i++){const j=i*2;indices.push(...(inward?[j,j+1,j+3,j,j+3,j+2]:[j,j+3,j+1,j,j+2,j+3]));}return add(geometry(p,indices),mat,name);
 }
 // Silver jambs open into the room; there is no solid backing behind the doors.
 wall('docking-raised-circle-edge',outer,faceZ,raisedZ,rim);
 wall('docking-recess-inner-wall',opening,doorZ-.0004,raisedZ,rim,true);
 // Match the red paint on the two saucer spine stripes.
 const circlePaint=new T.MeshStandardMaterial({color:0x9e3029,roughness:.74,metalness:.12,side:T.DoubleSide});
 ring('docking-port-metal-rim',opening,outer,raisedZ,circlePaint);
 // Extend the meeting edges across the center, with the left leaf in front.
 // A shallow lap and depth bias prevent a dark gap or coplanar flicker.
 const leaves=[],slide={value:0};
 // The doors slide into concealed pockets. Mask their hidden portions to the
 // circular aperture instead of allowing geometry to protrude beyond the block.
 door.onBeforeCompile=shader=>{
  shader.uniforms.hatchSlide=slide;
  shader.vertexShader='uniform float hatchSlide;attribute float hatchSide;varying vec2 vHatchDoorPoint;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHatchDoorPoint=position.xy+vec2(hatchSide*hatchSlide,0.0);');
  shader.fragmentShader='varying vec2 vHatchDoorPoint;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(dot(vHatchDoorPoint,vHatchDoorPoint)>${opening*opening})discard;`);
 };
 door.customProgramCacheKey=()=> 'bridge-hatch-overlapping-pocket-mask-v2';
 for(const side of [-1,1]){
  const start=side>0?-Math.PI/2:Math.PI/2,outline=[],p=[],indices=[];
  for(let i=0;i<=48;i++){const a=start+i*Math.PI/48;outline.push([i===0||i===48?-side*overlap:Math.cos(a)*doorRadius,Math.sin(a)*doorRadius]);}
  const frontZ=doorZ-(side>0?.000004:0),n=outline.length;for(const z of [frontZ,frontZ-.00035])for(const [x,y] of outline)p.push(x,y,z);
  for(let i=1;i<n-1;i++){indices.push(0,i,i+1,n,n+i+1,n+i);}
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j);}
  const leafMaterial=side<0?door.clone():door;
  if(side<0){leafMaterial.onBeforeCompile=door.onBeforeCompile;leafMaterial.customProgramCacheKey=door.customProgramCacheKey;leafMaterial.polygonOffset=true;leafMaterial.polygonOffsetFactor=-1;leafMaterial.polygonOffsetUnits=-1;}
  const leaf=add(geometry(p,indices).toNonIndexed(),leafMaterial,'docking-hatch-'+(side<0?'left':'right'));leaf.geometry.computeVertexNormals();
  leaf.geometry.setAttribute('hatchSide',new T.Float32BufferAttribute(new Float32Array(leaf.geometry.attributes.position.count).fill(side),1));
  leaves.push({leaf,side});
  const lp=leaf.geometry.attributes.position,uv=[];for(let i=0;i<lp.count;i++)uv.push(.5+lp.getX(i)/(doorRadius*2),.5+lp.getY(i)/(doorRadius*2));leaf.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 }
 const lightRadius=(opening+outer)/2;
 for(const side of [-1,1]){
  const lightColor=side<0?0xff5144:0x69e991;
  box('docking-side-light-bezel',side*lightRadius,0,raisedZ+.00004,.000874,.001932,.00023,lightHousing);
  const lens=box('docking-side-light',side*lightRadius,0,raisedZ+.00020,.00046,.001242,.000083,new T.MeshStandardMaterial({color:lightColor,emissive:lightColor,emissiveIntensity:1.3,roughness:.22,metalness:.05,toneMapped:false}));
  lens.userData.steadyGlow=true;
  const lensMaterial=lens.material;addHangarSignalGlow(T,lens,lightColor,.00065,.0011,.00003);lens.material.dispose();lens.material=lensMaterial;
  // The compact Three bundle exposes the base light; this is an unshadowed point emitter.
  const light=new T.Light(lightColor,.0000015);light.isPointLight=true;light.type='PointLight';light.distance=.006;light.decay=2;light.name='docking-side-light-emitter';light.position.set(side*lightRadius,0,raisedZ+.00065);port.add(light);
 }
 const exteriorDoorLights=port.children.filter(object=>['docking-side-light','docking-side-light-glow','docking-side-light-emitter'].includes(object.name));
 // Shallow painted heads match the panel rivets rather than dark spherical bolts.
 for(let i=0;i<12;i++){
  const a=(i+.5)*Math.PI/6,head=add(new T.SphereGeometry(.000166,16,8),bolt,'docking-rim-fastener',Math.cos(a)*.008625,Math.sin(a)*.008625,raisedZ+.000014);
  head.scale.z=.24;
 }
 // A continuous entrance leads into the circular room inside the bridge dome.
 const interior=createBridgeHatchRoom(T,{dome,centerY,portZ:port.position.z,doorZ:doorZ-.0004});port.add(interior);
 // Only the portion outside the room belongs to the exterior airlock housing.
 // Its old forward edge protruded inside as two free-standing plated slabs.
 const layout=interior.userData.circularRoom,blockParameters=block.geometry.parameters,bp=block.geometry.attributes.position;
 for(let i=0;i<bp.count;i++){const join=layout.centerZ+Math.sqrt(Math.max(0,layout.radius**2-bp.getX(i)**2))+.00002;if(bp.getZ(i)<join)bp.setZ(i,join);}
 bp.needsUpdate=true;block.geometry.computeBoundingBox();block.geometry.computeBoundingSphere();
 // The block's old bottom plate crossed the deeper stairs. Keep its outer
 // housing intact while removing only the concealed floor inside the passage.
 carveBridgeHatch(T,block,{centerY,cutPlanes:[[1,0,0,layout.entranceWidth/2+.0001],[-1,0,0,layout.entranceWidth/2+.0001],[0,0,-1,-layout.entranceZ+.0005],[0,0,1,layout.entranceZ+layout.corridorLength+.0005],[0,-1,0,centerY-layout.floorY+.001],[0,1,0,.0105]],tag:'bridgeCorridorStairOpening'});
 block.geometry.parameters=blockParameters;
 block.userData.trimmedAtBridgeWall=true;
 port.ready=interior.ready;
 port.updateBridgeView=(mission,state)=>{if(interiorView)interior.updateBridgeView(mission,state);};
 let open=0,innerOpen=0,sequenceWait=0,lastTime,interiorView=false,lastTarget,outerFirst=true;
 port.setInteriorView=active=>{
  interiorView=!!active;interior.visible=open>0||interiorView;
  for(const object of exteriorDoorLights)object.visible=!interiorView;
 };
 port.isInteriorPoint=point=>{
  port.updateWorldMatrix(true,false);const p=port.worldToLocal(point.clone()),layout=interior.userData.circularRoom,pit=interior.getObjectByName('bridge-room-sunken-room').userData.sunkenRoom,roof=interior.getObjectByName('bridge-room-ceiling').userData.domeCeiling;
  const inRoom=Math.hypot(p.x,p.z-layout.centerZ)<=layout.radius+.001&&p.y>=pit.floorY-centerY-.001&&p.y<=roof.apexY-centerY+.001;
  const inCorridor=Math.abs(p.x)<=.0106&&p.z>=layout.entranceZ-.001&&p.z<=raisedZ+.001&&p.y>=layout.floorY-centerY-.001&&p.y<=.0105;
  return inRoom||inCorridor;
 };
 port.setHatchOpen=(value,syncInner=true)=>{
  open=Math.max(0,Math.min(1,value));const eased=open*open*(3-2*open);slide.value=(opening+.0001)*eased*.90;
  for(const {leaf,side}of leaves)leaf.position.x=side*slide.value;
  port.userData.hatchOpen=open;
  if(syncInner){innerOpen=open;interior.setInnerDoorOpen(innerOpen);port.userData.innerDoorOpen=innerOpen;}
  interior.visible=open>0||interiorView;
 };
 port.updateHatch=(time=performance.now()/1000)=>{
  interior.updateBridgeIndicators(time);
  if(!Number.isFinite(time))return;const dt=lastTime===undefined?0:Math.max(0,Math.min(.1,time-lastTime));lastTime=time;
  const target=BridgeHatch.open?1:0;
  if(target!==lastTarget){sequenceWait=0;outerFirst=target?!interiorView:interiorView;lastTarget=target;}
  // Finish the first door, wait two full seconds, then move the second.
  // Open the near door first; close the far door first. Keep that order for
  // the whole sequence, even if the viewer moves through the doorway.
  const first=outerFirst?open:innerOpen;
  const firstTravel=Math.abs(target-first)*1.2;
  sequenceWait=firstTravel<=dt?sequenceWait+Math.max(0,dt-firstTravel):0;
  const secondDt=Math.min(dt,Math.max(0,sequenceWait-2));
  const advance=(value,elapsed)=>value+Math.sign(target-value)*Math.min(Math.abs(target-value),elapsed/1.2);
  innerOpen=advance(innerOpen,outerFirst?secondDt:dt);
  port.setHatchOpen(advance(open,outerFirst?dt:secondDt),false);
  interior.setInnerDoorOpen(innerOpen);
  port.userData.innerDoorOpen=innerOpen;
 };
 port.setHatchOpen(0);
 port.userData.dockingPort={floorY:centerY-.0155,width:.021,height:.031,depth:.035,faceZ,doorZ,raisedZ,facing:'aft',usesExistingApproach:true,interiorRoom:true};
 return port;
};
