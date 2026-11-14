/* Third-model geometry tools. The first two factories keep their own shapes. */
window.EnterpriseThirdGeometry=(()=>{
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),ease=t=>t*t*(3-2*t);
 // Monotone cubic interpolation rounds profile joins without overshooting
 // the measured diameter, tier heights, or the ends of a vertical wall.
 function smoothProfile(points,steps=6){
  const slope=(a,b)=>a*b<=0?0:2*a*b/(a+b),out=[];
  for(let i=0;i<points.length-1;i++)for(let j=0;j<steps;j++){
   const t=j/steps,t2=t*t,t3=t2*t;
   out.push(points[i].map((v,k)=>{
    const d=points[i+1][k]-v,before=i? v-points[i-1][k]:d,after=i+2<points.length?points[i+2][k]-points[i+1][k]:d;
    return (2*t3-3*t2+1)*v+(t3-2*t2+t)*slope(before,d)+(-2*t3+3*t2)*points[i+1][k]+(t3-t2)*slope(d,after);
   }));
  }
  return out.concat([points.at(-1)]);
 }
 function shape(){
  const base=EnterpriseEngineeringShape,original=z=>z< -1.08?-1.08+(z+1.08)*(.07/.11):z;
  return {...base,profile:base.profile.map(([r,z])=>[r,z< -1.08?-1.08+(z+1.08)*(.11/.07):z]),
   radiusAt:z=>base.radiusAt(original(z)),upAt:(z,x)=>base.upAt(original(z),x),downAt:(z,x)=>base.downAt(original(z),x)};
 }
 function geometry(T,positions,indices,uv){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 function neck(T){
  const p=[],idx=[],uv=[],levels=[.103,.11,.12,.14,.18,.24,.30,.34,.355,.363],count=32;
  for(const y of levels){
   const t=clamp((y-.11)/.25),front=-.87-.29*t,back=-.54-.28*t;
   const blend=Math.exp(-((t/.13)**2))+Math.exp(-(((1-t)/.13)**2)),width=.034+.007*blend;
   const center=(front+back)/2,depth=(back-front)/2,r=.005;
   for(let n=0;n<count;n++){
    const corner=Math.floor(n/8),a=corner*Math.PI/2+(n%8)/7*Math.PI/2;
    const [sx,sz]=[[1,1],[-1,1],[-1,-1],[1,-1]][corner];
    const x=sx*(width-r)+Math.cos(a)*r,z=center+sz*(depth-r)+Math.sin(a)*r;
    p.push(x,y,z);uv.push((z+1.16)/.62,t);
   }
  }
  for(let row=0;row<levels.length-1;row++)for(let n=0;n<count;n++){const a=row*count+n,b=row*count+(n+1)%count;idx.push(a,a+count,b,b,a+count,b+count);}
  for(let n=1;n<count-1;n++){idx.push(0,n+1,n);const a=(levels.length-1)*count;idx.push(a,a+n,a+n+1);}
  return geometry(T,p,idx,uv);
 }
 function impulse(T){
  const p=[],idx=[],rings=9,segments=64;
  for(let row=0;row<rings;row++){
   const t=row/(rings-1),s=ease(t),half=.154-(.154-.114)*s,edge=.026*(1-.10*Math.exp(-(((t-1)/.10)**2)));
   for(let n=0;n<segments;n++){
    const a=n/segments*Math.PI*2,x=(Math.cos(a)>=0?half:-half)+edge*Math.cos(a),y=.383-.004*s+edge*Math.sin(a);
    const front=-1.53+Math.sqrt(.674**2-x*x);p.push(x,y,front+(-.828-front)*t);
   }
  }
  for(let row=0;row<rings-1;row++)for(let n=0;n<segments;n++){const a=row*segments+n,b=row*segments+(n+1)%segments;idx.push(a,b,a+segments,b,b+segments,a+segments);}
  // End faces need their own normals rather than inheriting the curved skin.
  for(const [row,reverse]of [[0,false],[rings-1,true]]){
   const cap=p.length/3;p.push(...p.slice(row*segments*3,(row+1)*segments*3));
   for(let n=1;n<segments-1;n++)idx.push(...(reverse?[cap,cap+n+1,cap+n]:[cap,cap+n,cap+n+1]));
  }
  return geometry(T,p,idx);
 }
 function spine(T,sections,deckHeight){
  const p=[],idx=[],profile=smoothProfile(sections,4),count=12;
  for(const [row,[z,w]]of profile.entries()){
   const base=deckHeight(Math.abs(z+1.53)),half=Math.max(.00001,w),height=.011;
   for(let n=0;n<count;n++){
    const a=n/count*Math.PI*2,x=Math.cos(a)*half,rawY=base-.001+Math.sin(a)*height;
    // The exposed aft cap starts above the housing's .4024-high roof.
    const y=row===0?Math.max(.4026,rawY):rawY;
    p.push(x,y,z);
   }
  }
  for(let row=0;row<profile.length-1;row++)for(let n=0;n<count;n++){const a=row*count+n,b=row*count+(n+1)%count;idx.push(a,a+count,b,b,a+count,b+count);}
  for(const [row,reverse]of [[0,true],[profile.length-1,false]]){
   const cap=p.length/3;p.push(...p.slice(row*count*3,(row+1)*count*3));
   for(let n=1;n<count-1;n++)idx.push(...(reverse?[cap,cap+n+1,cap+n]:[cap,cap+n,cap+n+1]));
  }
  return geometry(T,p,idx);
 }
 function edit(T,mesh,warp){
  const p=mesh.geometry.attributes.position;mesh.updateWorldMatrix(true,false);
  for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);mesh.localToWorld(v);warp(v);mesh.worldToLocal(v);p.setXYZ(i,v.x,v.y,v.z);}
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 }
 function bounds(T,object){
  const min=new T.Vector3(Infinity,Infinity,Infinity),max=new T.Vector3(-Infinity,-Infinity,-Infinity);
  object.updateWorldMatrix(true,true);object.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);min.min(v);max.max(v);}
  });return {min,max};
 }
 function finish(T,model){
  model.updateWorldMatrix(true,true);
  // The fairing is generated from the actual aft hull section. Keep that
  // shared seam, door rim and flat apron together: independent point warps
  // twisted the apron's large triangles and separated the surrounding skins.
  for(const side of ['port','starboard']){
   const strut=model.getObjectByName(side+'-engine-strut');
   strut.traverse(o=>{if(o.isMesh)edit(T,o,v=>{
    const local=strut.worldToLocal(v.clone()),nx=Math.abs(local.x)/.020,nz=Math.abs(local.z)/.0535;
    const rounded=Math.min(1,1/Math.max(1e-8,(nx**6+nz**6)**(1/6)));
    local.x*=rounded;local.z*=rounded;
    // Subdivided grille skins follow the same rounded cross section as the
    // pylon. Keep them just above it so depth testing cannot bury the marks.
    if(o.name.startsWith(side+'-strut-top-grille'))local.x+=Math.sign(local.x)*(o.name.endsWith('-frame')?.0001:.0002);
    v.copy(strut.localToWorld(local));
    const t=clamp((v.y-.085)/.370),station=-.293;
    v.z=station+(v.z-station)*(1.06-.15*t)+.012*(1-t)-.008*t;
   });});
   // The outer shoe follows the small shift of the pylon's engine joint.
   edit(T,model.getObjectByName(side+'-engine-pylon-shoe'),v=>{v.z-=.008;});
   const engine=model.getObjectByName(side+'-movie-nacelle');
   engine.traverse(o=>{if(!o.isMesh||!/-engine-fin$/.test(o.name))return;
    const p=o.geometry.attributes.position;let lo=Infinity,hi=-Infinity;
    for(let i=0;i<p.count;i++){lo=Math.min(lo,p.getZ(i));hi=Math.max(hi,p.getZ(i));}
    const center=(lo+hi)/2;for(let i=0;i<p.count;i++)p.setZ(i,center+(p.getZ(i)-center)*(.339/.3783689186));
    p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
   });
   const fin=engine.getObjectByName(side+'-inboard-engine-fin'),pylon=bounds(T,strut),finBox=bounds(T,fin);
   fin.position.z+=((pylon.min.z+pylon.max.z)/2-finBox.min.z)/engine.scale.z;
  }
  // The reflector fills three quarters of the collar, matching the front view.
  const dish=model.getObjectByName('deflector-dish');dish.scale.x*=1.12;dish.scale.z*=1.12;
  for(let i=0;i<3;i++){const ring=model.getObjectByName('deflector-face-ring-'+i);ring.scale.x*=1.12;ring.scale.z*=1.12;}
  model.userData.geometryRevision='third-reference-2';
  model.userData.revisions=['continuous-reference-stern','swept-tapered-pylons','reference-fin-length-and-station','blended-neck','smooth-saucer','rounded-bridge','smooth-bowl','reference-forward-shoulder','larger-reflector','planar-fantail-surround','rounded-impulse-fairing'];
  model.updateWorldMatrix(true,true);
 }
 // Approximate landmarks on the supplied 2560px sheet: 510px saucer,
 // 128px aft fins and 123px inboard handle. The rear rails have short upright
 // ends and a flat crown; their solid webs meet the casing without curled tips.
 // Run after the common enlargement so these final dimensions remain authoritative.
 function fitEngineFittings(T,model){
  model.updateWorldMatrix(true,true);const unit=1.36/510;
  model.traverse(fin=>{
   if(!fin.isMesh||!fin.name.endsWith('-aft-engine-fin'))return;
   const side=fin.name.startsWith('port')?'port':'starboard',tube=model.getObjectByName(side+'-engine-outer-tube'),parent=tube.parent;
   const p=fin.geometry.attributes.position,e=parent.matrixWorld.elements;
   const axialScale=Math.hypot(e[8],e[9],e[10]),angle=fin.userData.referenceDimensions.angle,rx=Math.sin(angle),ry=Math.cos(angle);
   let rear=-Infinity,tip=0,width=0;
   for(let i=0;i<p.count;i++){
    const v=parent.worldToLocal(fin.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));
    const dx=v.x-tube.position.x,dy=v.y-tube.position.y;
    rear=Math.max(rear,v.z);tip=Math.max(tip,dx*rx+dy*ry);width=Math.max(width,2*Math.abs(dx*ry-dy*rx));
   }
   // Move both rails aft six sheet pixels, keeping their measured length.
   rear+=6*unit/axialScale;
   const front=rear-128*unit/axialScale,a=front+.0055,b=rear-.0055,base=.087;
   const rail=createEngineHandleFinGeometry(T,{x:tube.position.x,centerY:tube.position.y,angle,width,tip,frontZ:a,rearZ:b,rootRadius:base,corner:.010});
   const webPositions=[],webIndices=[],steps=96;
   for(let i=0;i<=steps;i++){
    const z=a+(b-a)*i/steps,edge=Math.min(z-a,b-z),round=Math.sqrt(Math.max(0,1-(1-Math.min(1,edge/.010))**2)),top=tip-.021+.010*round;
    for(const [t,r]of [[-.003,base],[.003,base],[.003,top],[-.003,top]])webPositions.push(tube.position.x+rx*r+ry*t,tube.position.y+ry*r-rx*t,z);
    if(i<steps)for(let j=0;j<4;j++){const v=i*4+j,w=i*4+(j+1)%4;webIndices.push(v,w,v+4,w,w+4,v+4);}
   }
   webIndices.push(0,2,1,0,3,2);const end=steps*4;webIndices.push(end,end+1,end+2,end,end+2,end+3);
   const indexedWeb=new T.BufferGeometry();indexedWeb.setAttribute('position',new T.Float32BufferAttribute(webPositions,3));indexedWeb.setIndex(webIndices);const web=indexedWeb.toNonIndexed();indexedWeb.dispose();const wp=web.attributes.position;
   const faces=rail.toNonIndexed(),geometry=new T.BufferGeometry(),positions=new Float32Array((faces.attributes.position.count+wp.count)*3),uv=new Float32Array(positions.length/3*2);
   let n=0;
   for(const source of [faces.attributes.position,wp])for(let i=0;i<source.count;i++,n++){
    const v=new T.Vector3().fromBufferAttribute(source,i),radial=(v.x-tube.position.x)*rx+(v.y-tube.position.y)*ry;
    uv[n*2]=(v.z-rear)/.007;uv[n*2+1]=(radial-base)/.007;
    fin.worldToLocal(parent.localToWorld(v));v.toArray(positions,n*3);
   }
   geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.addGroup(0,faces.attributes.position.count,0);geometry.addGroup(faces.attributes.position.count,wp.count,1);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
   geometry.userData.solidFin={roundedRail:true,rootRadius:base,tip,width};
   fin.geometry.dispose();fin.geometry=geometry;rail.dispose();faces.dispose();web.dispose();
   fin.userData.sheetFitting={length:128*unit,aftShift:6*unit,flatCrown:true};
  });
  // Circumferential seams read as vertical lines in the side elevation.
  const seamPaint=new T.MeshStandardMaterial({color:0x59675f,roughness:.82,metalness:.12});
  for(const side of ['port','starboard']){
   const tube=model.getObjectByName(side+'-engine-outer-tube'),parent=tube.parent,fin=model.getObjectByName(side+'-aft-engine-fin'),p=fin.geometry.attributes.position,e=parent.matrixWorld.elements,scale=Math.hypot(e[8],e[9],e[10]);let rear=-Infinity;
   for(let i=0;i<p.count;i++)rear=Math.max(rear,parent.worldToLocal(fin.localToWorld(new T.Vector3().fromBufferAttribute(p,i))).z);
   const geometry=new T.CylinderGeometry(.08735,.08735,1.2*unit/scale,64,1,true);geometry.rotateX(Math.PI/2);
   const seam=new T.Mesh(geometry,seamPaint);seam.name=side+'-aft-engine-casing-seam';seam.position.set(tube.position.x,tube.position.y,rear+7*unit/scale);seam.userData.sheetSeam={aftOfFin:7*unit};parent.add(seam);
   // Translate the finished fittings to the marked casing station. The panel
   // builder follows this aft fin edge, so its shape and spacing stay intact.
   // Keep the casing seam fixed while moving both rails forward together.
   for(const fitting of parent.children.filter(o=>o.isMesh&&o.name.startsWith(side)&&o.name.endsWith('-aft-engine-fin'))){
    fitting.position.z-=12*unit/scale;
    fitting.userData.sheetFitting.forwardShift=12*unit;
   }
  }
 }
 return {smoothProfile,shape,neck,impulse,spine,finish,fitEngineFittings};
})();
