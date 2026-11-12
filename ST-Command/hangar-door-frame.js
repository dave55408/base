/* Reference stern: a broad arch, shallow beveled rim and level threshold. */
window.hangarDoorProfile=(scaleY=1)=>{
 const floor=-.04645,baseThickness=.024,bellyLocalDepth=-floor+baseThickness/scaleY;
 return {rx:.083,ry:.112,cy:-.043,floor,width:.010,baseThickness,bellyLocalDepth,bellyDepth:bellyLocalDepth*scaleY-.102*(1-scaleY),baseFront:.062,roofFront:.014,canopyFront:.0325,hingeDepth:.018,lampY:.076,lampFront:.029,scaleY};
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
 rim.userData.doorFrame={...profile,inner,outer,sideCut:hull.map(cutAt),aperture:inner.map(p=>[p[0],p[1],profile.hingeDepth]),front:profile.roofFront};
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
  seal:strips([[insetHull,-.008],[hull,cutAt],[doorReturn,profile.roofFront-.002],[inner,profile.hingeDepth],[inner,-.008],[insetHull,-.008]]),
  throat:strips([[inner,-.008],[interior,-.018]])
 };
};
window.createHangarRoofBeacon=(T,scaleY=1,hullMaterial=null)=>{
 const beacon=new T.Group();beacon.name='shuttle-bay-roof-beacon';beacon.position.set(0,.101,.010);
 const mount=new T.Mesh(new T.CylinderGeometry(.013,.013,.0025/scaleY,32),hullMaterial??new T.MeshStandardMaterial({color:0x6f7e7b,roughness:.7,metalness:.15}));mount.name='shuttle-bay-beacon-mount';mount.position.y=.00125/scaleY;mount.scale.z=.85;beacon.add(mount);
 const dome=new T.Mesh(new T.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:0xa7c4a4,emissive:0x7bb98a,emissiveIntensity:.55,roughness:.28,metalness:.12}));dome.name='shuttle-bay-green-light';dome.position.y=.0025/scaleY;dome.scale.set(.012,.007/scaleY,.010);beacon.add(dome);return beacon;
};
