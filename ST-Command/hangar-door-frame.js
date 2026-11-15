/* Reference stern: a broad arch, shallow beveled rim and level threshold. */
window.advanceHangarDoor=(current,target,dt)=>{
 const visible=current*current*(3-2*current),t=Math.min(1,visible/.15);
 const speed=target<current?.40+.60*t*t*(3-2*t):1;
 return current+Math.sign(target-current)*Math.min(Math.abs(target-current),Math.max(0,dt)*speed/2.4);
};
window.hangarDoorProfile=(scaleY=1)=>{
 const floor=-.04645,baseThickness=.024,bellyLocalDepth=-floor+baseThickness/scaleY;
 return {rx:.083,ry:.112,cy:-.043,floor,width:.010,baseThickness,bellyLocalDepth,bellyDepth:bellyLocalDepth*scaleY-.102*(1-scaleY),baseFront:.062,roofFront:.014,canopyFront:.0325,hingeDepth:.008,lampY:.076,lampFront:.029,scaleY};
};
window.createHangarDoorFrameGeometry=(T,{scaleY=1,flatBelly=false,aftHull=null}={})=>{
 const profile=hangarDoorProfile(scaleY),{width,baseThickness,rx,ry,cy,floor}=profile,segments=192,corner=cy-floor;
 const inner=[],outer=[],innerBevel=[],outerBevel=[],hull=[],interior=[];
 const aftSection=[];
 if(aftHull){
  aftHull.updateMatrix();const p=aftHull.geometry.attributes.position,offsetY=.102*(1-scaleY);
  for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i))<1e-7){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(aftHull.matrix);aftSection.push([v.x,(v.y-offsetY)/scaleY]);}
 }
 function hullDistance(dx,dy){
  let nearest=Infinity;
  for(let i=1;i<aftSection.length;i++){
   const [x0,y0]=aftSection[i-1],[x1,y1]=aftSection[i],ex=x1-x0,ey=y1-y0,det=dx*ey-dy*ex;if(Math.abs(det)<1e-12)continue;
   const t=(x0*ey-(y0-.008)*ex)/det,u=(x0*dy-(y0-.008)*dx)/det;
   if(t>0&&u>=-1e-7&&u<=1+1e-7)nearest=Math.min(nearest,t);
  }
  return nearest;
 }
 const inOpening=(x,y)=>y>=floor&&(y>=cy?(x/rx)**2+((y-cy)/ry)**2<=1:Math.abs(x)<=rx-corner+Math.sqrt(Math.max(0,corner**2-(y-cy)**2)));
 function distance(dx,dy,inside){let lo=0,hi=.25;for(let i=0;i<40;i++){const r=(lo+hi)/2;if(inside(dx*r,.008+dy*r))lo=r;else hi=r;}return lo;}
 for(let n=0;n<=segments;n++){
  const angle=n/segments*Math.PI*2,dx=Math.sin(angle),dy=Math.cos(angle),r=distance(dx,dy,inOpening),x=dx*r,y=.008+dy*r;
  let nx,ny;
  if(y>cy+1e-8){nx=x/rx**2;ny=(y-cy)/ry**2;}
  else if(Math.abs(x)>rx-corner+1e-8){nx=Math.sign(x)*(Math.abs(x)-rx+corner);ny=y-cy;}
  else{nx=0;ny=-1;}
  // Keep the arch narrow, with a much deeper structural band below the
  // deck. Both dimensions are measured after the bay's height compression.
  ny/=scaleY;const normal=Math.hypot(nx,ny);nx/=normal;ny/=normal;
  const outerPoint=[x+nx*width,y+ny*(ny<0?baseThickness:width)/scaleY];
  inner.push([x,y]);outer.push(outerPoint);
  innerBevel.push([x+nx*.001,y+ny*.001/scaleY]);outerBevel.push([outerPoint[0]-nx*.001,outerPoint[1]-ny*.001/scaleY]);
  const sampled=hullDistance(dx,dy),body=Number.isFinite(sampled)?sampled:distance(dx,dy,(px,py)=>flatBelly&&py<0?(Math.abs(px)/.102)**8+(-py/profile.bellyLocalDepth)**8<=1:px*px+py*py<=.102**2);
  hull.push([dx*body,.008+dy*body]);
  const old=dy>=0?1/Math.hypot(dx/.083,dy/.071):Math.min(Math.abs(dx)>1e-8?.083/Math.abs(dx):1,.0545/-dy);
  interior.push([dx*old,.008+dy*old]);
 }
 // Seat the entire upright ring behind the dome. The separate solid sill
 // projects aft beneath it without pulling the arch outward at its feet.
 const frontAt=()=>profile.roofFront;
 const edgeAt=p=>frontAt(p)-.0015*Math.max(0,Math.min(1,(p[1]-cy)/.006));
 const cutAt=([,y])=>{
  if(y<=cy)return 0;
  if(y<=.025){const t=(y-cy)/(.025-cy);return .002*t*t*(3-2*t);}
  const t=Math.min(1,(y-.025)/(.102-.025));
  return .002+(profile.canopyFront-.002)*Math.sin(t*Math.PI/2)**3+.0275*Math.sin(t*Math.PI)**2;
 };
 const insetHull=hull.map(([x,y])=>[x*.997,.008+(y-.008)*.997]);
 const doorReturn=inner.map(([x,y])=>[x*1.004,cy+(y-cy)*1.004]);
 // Size the canopy band to half the gap from the roof to the crown lamp.
 // Its underside still returns into the recessed bulkhead.
 const canopyLipWidth=Math.max(.0025,(hull[0][1]-profile.lampY-.0035/scaleY)*scaleY/2);
 const recessBlend=y=>{const t=Math.max(0,Math.min(1,(y-.005)/.025));return t*t*(3-2*t);};
 const lipInner=hull.map(([x,y],n)=>{
  const [ix,iy]=doorReturn[n],span=Math.hypot(x-ix,(y-iy)*scaleY);
  const t=Math.min(.5,canopyLipWidth/Math.max(span,1e-8));
  return [x+(ix-x)*t,y+(iy-y)*t];
 });
 const lipFront=(p,n)=>cutAt(hull[n]);
 const recessedAt=(p,n)=>(lipFront(p,n)-.0006)*(1-recessBlend(hull[n][1]))-.004*recessBlend(hull[n][1]);
 function strips(layers,topology=false){
  const positions=[],indices=[];
  // Separate faces retain a flat front rather than smoothing its normals
  // into the inner and outer returns.
  for(let row=1;row<layers.length;row++){
   const start=positions.length/3;
   for(const [points,z] of [layers[row-1],layers[row]])for(let n=0;n<points.length;n++){const [x,y]=points[n];positions.push(x,y,typeof z==='function'?z(points[n],n):z);}
   for(let n=0;n<segments;n++){const a=start+n,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const normals=geometry.attributes.normal;
  for(let row=0;row<(layers.length-1)*2;row++){const a=row*(segments+1),b=a+segments,n=new T.Vector3().fromBufferAttribute(normals,a).add(new T.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);}
  if(topology)geometry.userData.hullPanelTopology={segments,rows:(layers.length-1)*2,kind:'aft-fairing'};
  return geometry;
 }
 const backAt=p=>frontAt(p)-.006;
 const rim=strips([[outer,edgeAt],[outerBevel,frontAt],[innerBevel,frontAt],[inner,edgeAt],[inner,backAt],[outer,backAt],[outer,edgeAt]]);
 rim.userData.doorFrame={...profile,inner,outer,sideCut:hull.map(cutAt),canopyLipWidth,canopyRecess:-.004,aperture:inner.map(p=>[p[0],p[1],profile.hingeDepth]),front:profile.roofFront};
 // A solid sill reaches the door's bottom edge, closing the dark slit that
 // a thin separate apron would leave beneath the exposed clamshell.
 const r=rx+width,bottom=floor-baseThickness/scaleY,chamfer=.002;
 const section=[[r,cy],[r,bottom+chamfer],[r-chamfer,bottom],[-r+chamfer,bottom],[-r,bottom+chamfer],[-r,cy]],basePositions=[],baseIndices=[],count=section.length;
 for(const z of [-.008,profile.baseFront-.0002])for(const [x,y] of section)basePositions.push(x,y,z);
 for(let i=1;i<count-1;i++)baseIndices.push(0,i+1,i,count,count+i,count+i+1);
 for(let i=0;i<count;i++){const j=(i+1)%count;baseIndices.push(i,j,count+i,j,count+j,count+i);}
 const baseShape=new T.BufferGeometry();baseShape.setAttribute('position',new T.Float32BufferAttribute(basePositions,3));baseShape.setIndex(baseIndices);
 const base=baseShape.toNonIndexed();baseShape.dispose();base.computeVertexNormals();
 return {
  rim,profile,base,
  fairing:strips([[hull,-.0004],[hull,cutAt]],true),
  seal:strips([[insetHull,-.008],[hull,cutAt],[lipInner,lipFront],[lipInner,recessedAt],[doorReturn,recessedAt],[doorReturn,profile.roofFront-.002],[inner,profile.hingeDepth],[inner,-.008],[insetHull,-.008]]),
  throat:strips([[inner,-.008],[interior,-.018]])
 };
};
// Sill-mounted floodlights wash the outer jambs up toward the arch shoulders.
window.createHangarUplights=(T,profile)=>{
 const group=new T.Group();group.name='hangar-arch-uplights';
 const {floor,scaleY}=profile;
 const metal=new T.MeshStandardMaterial({color:0x444e50,roughness:.65,metalness:.45});
 const lensMaterial=new T.MeshStandardMaterial({color:0x88928e,roughness:.3,metalness:.25});
 for(const side of [-1,1]){
  const name=side<0?'port':'starboard',fixture=new T.Group();fixture.name=name+'-hangar-uplight-fixture';
  fixture.position.set(side*.087,floor,.036);fixture.scale.y=1/scaleY;group.add(fixture);
  const foot=new T.Mesh(new T.BoxGeometry(.009,.0015,.010),metal);foot.position.y=.00075;fixture.add(foot);
  const direction=new T.Vector3(-side*.022,.080,-.022).normalize();
  const housing=new T.Mesh(new T.CylinderGeometry(.0035,.0042,.005,20),metal);
  housing.position.set(0,.0035,0);housing.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);fixture.add(housing);
  const lens=new T.Mesh(new T.SphereGeometry(1,20,10),lensMaterial);lens.scale.set(.0029,.0029,.0004);lens.name=name+'-hangar-uplight-lens';
  lens.position.copy(housing.position).addScaledVector(direction,.00255);lens.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),direction);fixture.add(lens);
  const lamp=new T.SpotLight(0xffedcf,0,.17,.30,.65,2);lamp.name=name+'-hangar-arch-uplight';
  lamp.position.set(side*.087,floor+.006/scaleY,.035);
  lamp.target.position.set(side*.062,.034,profile.roofFront-.001);group.add(lamp,lamp.target);
 }
 return group;
};
window.createHangarRoofBeacon=(T,scaleY=1,hullMaterial=null,scaleZ=1)=>{
 const sizeScale=.85,beacon=new T.Group();beacon.name='shuttle-bay-roof-beacon';beacon.position.set(0,.101,.010);beacon.scale.set(sizeScale,sizeScale,sizeScale/scaleZ);
 const metal=new T.MeshStandardMaterial({color:0x6a7770,roughness:.52,metalness:.4});
 const mount=new T.Mesh(new T.CylinderGeometry(.0128,.014,.0032/scaleY,48),metal);mount.name='shuttle-bay-beacon-mount';mount.position.y=.0016/scaleY;beacon.add(mount);
 const collar=new T.Mesh(new T.CylinderGeometry(.0123,.0128,.0007/scaleY,48),new T.MeshStandardMaterial({color:0x4f6055,roughness:.5,metalness:.3}));collar.name='shuttle-bay-beacon-collar';collar.position.y=.00335/scaleY;beacon.add(collar);
 // A full hemisphere rises from the existing collar. Compensate for the hull's
 // vertical scale so the lens retains a circular dome in the finished model.
 const geometry=new T.SphereGeometry(.012,64,32,0,Math.PI*2,0,Math.PI/2);geometry.scale(1,1/scaleY,1);
 const dome=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x69d596,emissive:0x45ba73,emissiveIntensity:.85,roughness:.30,metalness:.04}));dome.name='shuttle-bay-green-light';dome.position.y=.0037/scaleY;beacon.add(dome);
 const light=new T.Light(0x69d596,.000025);light.isPointLight=true;light.type='PointLight';light.distance=.12;light.decay=2;light.name='shuttle-bay-roof-green-emitter';light.position.set(0,.010/scaleY,.003);beacon.add(light);
 beacon.userData.roofBeacon={lensHeight:.012*sizeScale,lensRadius:.012*sizeScale,sizeScale,color:0x69d596};return beacon;
};

/* The small lamp beneath the canopy lip casts steady white light. */
window.addHangarWhiteLamp=(T,lens)=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),g=c.createLinearGradient(0,0,0,128);
 for(const [stop,color]of [[0,'#43515b'],[.18,'#b6c2ca'],[.43,'#edf2f5'],[.68,'#a4b5c0'],[1,'#35434d']])g.addColorStop(stop,color);c.fillStyle=g;c.fillRect(0,0,128,128);c.fillStyle='rgba(255,255,255,.55)';c.fillRect(5,18,118,5);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 lens.material=new T.MeshStandardMaterial({color:0xffffff,map,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.7,roughness:.12,metalness:0});
 const light=new T.Light(0xffffff,.000045);light.isPointLight=true;light.type='PointLight';light.distance=.28;light.decay=2;light.name='hangar-under-lip-white-emitter';light.position.set(0,-.001,.003);lens.add(light);
 // Offset, unshadowed emitters spread a soft wash across the lip and stern.
 for(const side of [-1,1]){const spill=new T.Light(0xffffff,.000018);spill.isPointLight=true;spill.type='PointLight';spill.distance=.28;spill.decay=2;spill.name='hangar-under-lip-white-spill-'+(side<0?'port':'starboard');spill.position.set(side*.006,-.0025,.004);lens.add(spill);}
 lens.userData.diffuseLightWash={range:.28,emitters:3};
 return light;
};
