/* Register the editable window plan to the finished Third Model's actual skin. */
window.addEnterpriseWindowLayout=(T,model,data)=>{
 const layer=new T.Group();layer.name='reference-window-plan';
 const primary=model.getObjectByName('reference-saucer-assembly'),batches=new Map(),features=[];
 const appearance={strength:{value:1},reflections:{value:1}};
 const forwardFrames=new Set(data.registration?.forwardPortholes?.windowIds||[]);
 const frameReference=data.windows.find(w=>w.id===data.registration?.forwardPortholes?.frameReferenceWindow);
 model.updateWorldMatrix(true,true);
 const targets={engineering:['secondary-hull','port-raised-forward-pennant-pad','starboard-raised-forward-pennant-pad'],neck:['movie-dorsal-connector'],rim:['movie-saucer'],bridge:['upper-saucer-teardrop'],bowl:['movie-underside-bowl'],pylon:['port-engine-strut','starboard-engine-strut']};
 const triangles={};
 for(const [surface,names]of Object.entries(targets)){
  triangles[surface]=[];
  for(const name of names){
   const mesh=model.getObjectByName(name);if(!mesh?.geometry)continue;
   const g=mesh.geometry,p=g.attributes.position,index=g.index,vertices=[];
   for(let i=0;i<p.count;i++)vertices.push(model.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i))));
   for(let i=0;i<(index?index.count:p.count);i+=3){
    const [a,b,c]=[0,1,2].map(k=>vertices[index?index.getX(i+k):i+k]);
    const ab=b.clone().sub(a),ac=c.clone().sub(a),normal=ab.clone().cross(ac);
    if(normal.lengthSq()<1e-20)continue;
    triangles[surface].push({a,ab,ac,normal:normal.normalize(),minY:Math.min(a.y,b.y,c.y),maxY:Math.max(a.y,b.y,c.y),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)});
   }
  }
 }
 const toModel=p=>model.worldToLocal(primary.localToWorld(p));
 // Cast only against the intended structural skin; fittings, opposite hulls,
 // beacons and decorative layers cannot pull a window off its assigned region.
 function project(origin,direction,candidates){
  let nearest=Infinity,hit=null;
  for(const t of candidates){
   if(origin.y<t.minY-1e-7||origin.y>t.maxY+1e-7)continue;
   const h=direction.clone().cross(t.ac),det=t.ab.dot(h);if(Math.abs(det)<1e-12)continue;
   const v=origin.clone().sub(t.a),u=v.dot(h)/det;if(u< -1e-7||u>1+1e-7)continue;
   const q=v.cross(t.ab),w=direction.dot(q)/det;if(w< -1e-7||u+w>1+1e-7)continue;
   const distance=t.ac.dot(q)/det;if(distance<0||distance>=nearest)continue;
   nearest=distance;
   const normal=t.normal.clone();if(normal.dot(direction)>0)normal.multiplyScalar(-1);
   const point=origin.clone().addScaledVector(direction,distance);
   hit={point,normal,meshPoint:point.clone()};
  }
  return hit;
 }
 for(const w of data.windows){
  if(w.category!=='window')continue;
  const [x,y,z]=w.position,side=w.side==='port'?-1:w.side==='starboard'?1:Math.sign(x)||1;
  let theta=Math.atan2(x,z+1.53);
  if(w.surface==='bridge'){
   // The plan uses the uncompressed deck outline. Match the model's flattened
   // X section and elongated aft teardrop before projecting to its mesh.
   const r=Math.hypot(x,z+1.53),aft=z+1.53;
   theta=Math.atan2(x*.72,(aft+(r>0?.14*Math.max(0,aft/r)**4*(r/.192)**1.5:0))*.735);
  }
  let structural=triangles[w.surface];if(!structural)throw Error('Unknown window surface: '+w.surface);
  if(w.surface==='pylon')structural=structural.filter(t=>(t.a.x+t.ab.x/3+t.ac.x/3)*side>0);
  const modelY=['engineering','neck','pylon'].includes(w.surface)?y:toModel(new T.Vector3(0,y,-1.53)).y;
  let station=w.surface==='engineering'?z+.032:z;
  if(w.surface==='neck'){
   // Some draft centers sit exactly on the neck's sloping leading edge.
   // Keep the full opening on its side, clear of the rounded edge blend.
   const t0=Math.max(0,Math.min(1,(y-w.height/2-.11)/.25)),t1=Math.max(0,Math.min(1,(y+w.height/2-.11)/.25));
   const front=-.87-.29*t0+w.width/2+.006,back=-.54-.28*t1-w.width/2-.006;
   station=Math.max(front,Math.min(back,station));
  }
  if(w.surface==='pylon'){
   // The reference positions predate the swept pylons. Keep their heights,
   // fitting each complete opening inside the actual front and rear edges.
   let front=-Infinity,rear=Infinity;
   for(const py of [y-w.height/2,y,y+w.height/2]){
    const zs=[];
    for(const t of structural){
     if(py<t.minY||py>t.maxY)continue;
     const vertices=[t.a,t.a.clone().add(t.ab),t.a.clone().add(t.ac)];
     for(let i=0;i<3;i++){
      const a=vertices[i],b=vertices[(i+1)%3];
      if(Math.abs(b.y-a.y)>1e-12&&py>=Math.min(a.y,b.y)&&py<=Math.max(a.y,b.y))zs.push(a.z+(b.z-a.z)*(py-a.y)/(b.y-a.y));
     }
    }
    if(!zs.length)throw Error('Pylon window outside strut height: '+w.id);
    front=Math.max(front,Math.min(...zs)+w.width/2+.004);
    rear=Math.min(rear,Math.max(...zs)-w.width/2-.004);
   }
   if(front>rear)throw Error('Pylon too narrow for window: '+w.id);
   station=Math.max(front,Math.min(rear,station));
  }
  const lateral=['engineering','neck','pylon'].includes(w.surface);
  const candidates=structural.filter(t=>t.maxY>=modelY-w.height/2-.0001&&t.minY<=modelY+w.height/2+.0001&&(!lateral||t.maxZ>=station-w.width/2-.0001&&t.minZ<=station+w.width/2+.0001));
  function sample(u,v){
   const py=y+(v-.5)*w.height;
   let origin,direction;
   if(lateral){
    origin=new T.Vector3(side*.6,py,station+(u-.5)*w.width);direction=new T.Vector3(-side,0,0);
   }else{
    const radius=w.surface==='rim'?.665:w.surface==='bridge'?Math.hypot(x*.72,(z+1.53)*.735):Math.hypot(x,z+1.53);
    const a=theta+(u-.5)*w.width/Math.max(.06,radius);
    origin=toModel(new T.Vector3(Math.sin(a),py,-1.53+Math.cos(a)));
    direction=new T.Vector3(-Math.sin(a),0,-Math.cos(a));
   }
   const hit=project(origin,direction,candidates);
   if(!hit)throw Error('Window '+w.id+' misses '+w.surface+' at '+u+', '+v);
   return hit;
  }
  const center=sample(.5,.5),key=w.state+':'+(w.color||'');
  let batch=batches.get(key);if(!batch)batches.set(key,batch={positions:[],uv:[],profiles:[],frameScales:[],indices:[],ids:[],state:w.state,color:w.color});
  const frameScale=forwardFrames.has(w.id)&&frameReference?frameReference.height/w.height:1;
  const start=batch.positions.length/3,round=w.shape==='round',cols=round?24:6,rows=3;
  let maxClearance=0;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
   let u=col/cols,v=row/rows;
   if(round){const a=u*Math.PI*2;u=.5+.5*v*Math.cos(a);v=.5+.5*v*Math.sin(a);}
   const hit=sample(u,v),point=hit.point.addScaledVector(hit.normal,.00015);
   maxClearance=Math.max(maxClearance,point.distanceTo(hit.meshPoint));batch.positions.push(...point.toArray());
   batch.uv.push(u,v);batch.profiles.push(round?1:0,w.width/w.height);
   batch.frameScales.push(frameScale);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const a=start+row*(cols+1)+col,b=a+cols+1;batch.indices.push(a,a+1,b,a+1,b+1,b);
  }
  batch.ids.push(w.id);
  features.push({id:w.id,group:w.group,surface:w.surface,side:w.side,state:w.state,shape:w.shape,width:w.width,height:w.height,frameScale,sourcePosition:w.position.slice(),position:center.meshPoint.toArray(),normal:center.normal.toArray(),clearance:maxClearance});
 }
 for(const [key,batch]of batches){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(batch.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(batch.uv,2));g.setAttribute('windowProfile',new T.Float32BufferAttribute(batch.profiles,2));g.setAttribute('windowFrameScale',new T.Float32BufferAttribute(batch.frameScales,1));g.setIndex(batch.indices);g.computeVertexNormals();
  const lit=batch.state==='lit',color=batch.color||(lit?0xffdfb0:0x19201f);
  const material=createEnterpriseWindowMaterial(T,{lit,color,appearance});
  const mesh=new T.Mesh(g,material);mesh.name='window-plan-'+key;mesh.renderOrder=4;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.windowIds=batch.ids;layer.add(mesh);
 }
 layer.userData={source:'assets/windows/enterprise-window-layout_sat.json',revision:data.revision,registered:true,features,windowIds:features.map(w=>w.id),lit:features.filter(w=>w.state==='lit').length,unlit:features.filter(w=>w.state==='unlit').length};
 layer.windowAppearance=appearance;
 model.add(layer);model.userData.windowLayout={...layer.userData,features:undefined};
 model.userData.photoDetails.appearance='model-two-with-json-windows';model.userData.photoDetails.primaryHullLayout='enterprise-window-layout_sat';
 return layer;
};
