/* A contained Y-shaped bridge anteroom, entered through the aft hatch. */
(()=>{
 const api={open:false,toggle(){this.open=!this.open;}};window.BridgeHatch=api;
 window.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()!=='h'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.defaultPrevented)return;
  if(event.target?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])')||document.querySelector('dialog[open]'))return;
  event.preventDefault();api.toggle();
 });
 window.createBridgeHatchRoom=(T,{dome,centerY,portZ=-1.466})=>{
  const room=new T.Group();room.name='bridge-hatch-y-room';const floorY=-.0114,ceilingY=.013,backWallZ=-.006,backWallHalfWidth=.01215;
  // Use the actual dome profile to raise each roof point with a small skin clearance.
  const p=dome.geometry.attributes.position,levels=new Map();
  for(let i=0;i<p.count;i++){const y=Math.round(p.getY(i)*1e7)/1e7,r=Math.hypot(p.getX(i),p.getZ(i));levels.set(y,Math.max(levels.get(y)||0,r));}
  const profile=[...levels].sort((a,b)=>a[0]-b[0]);
  function ceilingAt(x,z){
   const radius=Math.hypot(x-dome.position.x,z+portZ-dome.position.z);let top=-Infinity;
   for(let i=0;i<profile.length;i++){
    const [y,r]=profile[i];if(r>=radius)top=Math.max(top,y);
    if(i){const [a,ra]=profile[i-1];if(ra!==r&&(radius-ra)*(radius-r)<=0)top=Math.max(top,a+(y-a)*(radius-ra)/(r-ra));}
   }
   const domeRoof=top+dome.position.y-centerY-.0007;
   // Only the entry throat may use the existing hatch block instead of the dome.
   const blockRoof=Math.abs(x)<=.0105&&z>=-.0175&&z<=.0175 ? .0105+.0025*Math.min(1,Math.max(0,z/.012)) : -Infinity;
   return Math.min(ceilingY,Math.max(domeRoof,blockRoof));
  }
  // The central back wall holds the picture; two branches continue beside it.
  // Keep just .0004 of straight corridor behind the doors, then flare into the Y.
  const footprint=[[-.0100,.016],[-.0100,.0156],[-.0103,.012],[-.0103,0],[-.0103,-.0035],[-.0245,backWallZ],[-.029,-.045],[-.029,-.062],[-backWallHalfWidth,-.062],[-backWallHalfWidth,backWallZ],[backWallHalfWidth,backWallZ],[backWallHalfWidth,-.062],[.029,-.062],[.029,-.045],[.0245,backWallZ],[.0103,-.0035],[.0103,0],[.0103,.012],[.0100,.0156],[.0100,.016]];
  const finish=color=>new T.MeshStandardMaterial({color,roughness:.9,metalness:.05,side:T.DoubleSide});
  const wall=finish(0x687179),floor=finish(0x454b50),roof=finish(0x242b31),trim=finish(0x752e29);
  const blackWall=new T.MeshBasicMaterial({color:0x000000,side:T.DoubleSide,toneMapped:false});
  trim.polygonOffset=true;trim.polygonOffsetFactor=-1;trim.polygonOffsetUnits=-1;trim.depthWrite=false;
  function mesh(name,points,indices,material){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex(indices);g.computeVertexNormals();const o=new T.Mesh(g,material);o.name=name;room.add(o);return o;}
  const quad=(name,points,material)=>mesh(name,points,[0,1,2,0,2,3],material);
  // The rectangular throat surrounds the entire circular aperture; no inset
  // rectangular reveal is allowed to cover the top, bottom or sides of the hole.
  // Ear clipping preserves the concave notch between the two rear branches.
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);let area=0;
  for(let i=0;i<footprint.length;i++){const a=footprint[i],b=footprint[(i+1)%footprint.length];area+=a[0]*b[1]-b[0]*a[1];}
  const sign=Math.sign(area),remaining=footprint.map((_,i)=>i),triangles=[];
  while(remaining.length>3){let found=false;
   for(let k=0;k<remaining.length;k++){
    const a=remaining[(k+remaining.length-1)%remaining.length],b=remaining[k],d=remaining[(k+1)%remaining.length],v=[footprint[a],footprint[b],footprint[d]];
    if(cross(...v)*sign<=1e-12)continue;
    if(remaining.some(i=>i!==a&&i!==b&&i!==d&&cross(v[0],v[1],footprint[i])*sign>=-1e-12&&cross(v[1],v[2],footprint[i])*sign>=-1e-12&&cross(v[2],v[0],footprint[i])*sign>=-1e-12))continue;
    triangles.push(a,b,d);remaining.splice(k,1);found=true;break;
   }if(!found)throw Error('Bridge room footprint could not be triangulated');
  }triangles.push(...remaining);
  mesh('bridge-room-floor',footprint.map(([x,z])=>[x,floorY,z]),triangles,floor);
  mesh('bridge-room-ceiling',footprint.map(([x,z])=>[x,ceilingAt(x,z),z]),triangles,roof);
  for(let i=0;i<footprint.length-1;i++){
   const [x,z]=footprint[i],[u,v]=footprint[i+1];
   const backPanel=z===backWallZ&&v===backWallZ&&x<0&&u>0;
   quad(backPanel?'bridge-room-back-wall':'bridge-room-wall-'+i,[[x,floorY,z],[u,floorY,v],[u,ceilingAt(u,v),v],[x,ceilingAt(x,z),z]],backPanel?blackWall:wall);
   if(!backPanel)quad('bridge-room-wall-trim-'+i,[[x,floorY+.0005,z],[u,floorY+.0005,v],[u,floorY+.0012,v],[x,floorY+.0012,z]],trim);
  }
  // WebGL may upload the picture before it finishes loading. Allocate its final
  // dimensions now: changing a live 1px texture to a large image leaves it blank.
  const placeholder=document.createElement('canvas');placeholder.width=1384;placeholder.height=1002;
  const pictureContext=placeholder.getContext('2d');pictureContext.fillRect(0,0,1384,1002);
  const pictureMap=new T.CanvasTexture(placeholder);pictureMap.colorSpace=T.SRGBColorSpace;pictureMap.anisotropy=4;
  const pictureWidth=backWallHalfWidth*2,pictureTop=ceilingAt(backWallHalfWidth,backWallZ),pictureHeight=pictureTop-floorY;
  const picture=new T.Mesh(new T.PlaneGeometry(pictureWidth,pictureHeight),new T.MeshBasicMaterial({color:0xffffff,map:pictureMap,toneMapped:false,side:T.DoubleSide}));
  picture.name='bridge-room-back-wall-picture';picture.position.set(0,(pictureTop+floorY)/2,backWallZ+.00006);room.add(picture);
  const image=new Image();room.ready=new Promise((resolve,reject)=>{
   let active=true;const finish=()=>{active=false;image.onload=image.onerror=null;delete pictureMap.userData.cancelLoad;};
   pictureMap.userData.cancelLoad=()=>{if(!active)return;finish();image.src='';resolve();};
   image.onload=()=>{
    if(!active)return;pictureContext.drawImage(image,0,0,1384,1002);
    // Fit the complete photo without stretching; rest its bottom on the floor.
    const imageAspect=image.width/image.height,height=Math.min(pictureHeight,pictureWidth/imageAspect),width=height*imageAspect;
    picture.scale.set(width/pictureWidth,height/pictureHeight,1);
    picture.position.y=floorY+height/2;
    pictureMap.repeat.set(1,1);pictureMap.offset.set(0,0);pictureMap.needsUpdate=true;finish();resolve();
   };
   image.onerror=()=>{finish();reject(Error('The bridge room picture failed to load'));};image.src=window.BRIDGE_ROOM_IMAGE||'assets/reference/bridge-room.png';
  });
  room.userData.layout={footprint,floorY,ceilingY,ceilingHeights:footprint.map(([x,z])=>ceilingAt(x,z)),backWallZ,backWallWidth:pictureWidth,corridorLength:.0004,branches:2,picture:'assets/reference/bridge-room.png'};return room;
 };
 // Remove only the aft entrance from the dome shell, preserving all attributes.
 window.carveBridgeHatch=(T,dome,{centerY})=>{
  dome.updateMatrix();const inverse=dome.matrix.clone().invert(),old=dome.geometry,attributes=Object.entries(old.attributes),offsets=[];let stride=0;
  for(const [,attribute]of attributes){offsets.push(stride);stride+=attribute.itemSize;}
  const pos=attributes.findIndex(([name])=>name==='position'),p0=offsets[pos],output=attributes.map(()=>[]),groups=[],index=old.index,total=index?index.count:old.attributes.position.count;
  // This concealed rectangular throat is wider than the round exterior aperture,
  // so oblique views cannot catch remnants of the curved shell inside the passage.
  const planes=[[0,0,1,-1.446],[0,0,-1,1.4835],[1,0,0,.0104],[-1,0,0,.0104],[0,1,0,centerY+.0145],[0,-1,0,.0185-centerY]];
  const distance=(v,plane)=>plane[3]-plane[0]*v[p0]-plane[1]*v[p0+1]-plane[2]*v[p0+2];
  function clip(poly,plane,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a,plane)*sign,db=distance(b,plane)*sign;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((n,k)=>n+(b[k]-n)*t));}}return out;}
  function vertex(i){const data=[];for(const [,a]of attributes)for(let k=0;k<a.itemSize;k++)data.push(a.array[i*a.itemSize+k]);const v=new T.Vector3(data[p0],data[p0+1],data[p0+2]).applyMatrix4(dome.matrix);data.splice(p0,3,v.x,v.y,v.z);return data;}
  let count=0;
  for(let i=0;i<total;i+=3){const triangle=[0,1,2].map(k=>vertex(index?index.getX(i+k):i+k)),pieces=[];
   if(planes.some(plane=>triangle.every(v=>distance(v,plane)<0)))pieces.push(triangle);
   else{let inside=triangle;for(const plane of planes){if(inside.length<3)break;const outside=clip(inside,plane,-1);if(outside.length>=3)pieces.push(outside);inside=clip(inside,plane,1);}}
   const start=count;
   for(const poly of pieces)for(let n=1;n<poly.length-1;n++)for(const source of [poly[0],poly[n],poly[n+1]]){
    const data=source.slice(),v=new T.Vector3(data[p0],data[p0+1],data[p0+2]).applyMatrix4(inverse);data.splice(p0,3,v.x,v.y,v.z);
    attributes.forEach(([,a],k)=>output[k].push(...data.slice(offsets[k],offsets[k]+a.itemSize)));count++;
   }
   if(count>start){const material=old.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex??0,last=groups.at(-1);if(last?.materialIndex===material)last.count+=count-start;else groups.push({start,count:count-start,materialIndex:material});}
  }
  const geometry=new T.BufferGeometry();attributes.forEach(([name,a],k)=>geometry.setAttribute(name,new T.Float32BufferAttribute(output[k],a.itemSize)));for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.userData={...old.userData,bridgeHatchOpening:true};dome.geometry=geometry;old.dispose();
 };
})();
