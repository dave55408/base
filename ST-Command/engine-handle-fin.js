/* Rounded inboard rail with two casing attachments and a genuinely open center. */
window.createEngineHandleFinGeometry=(T,{x,centerY,angle,width=.0155,tip=.113,frontZ=.314,rearZ=.663,rootRadius=.0815,corner=.018})=>{
 const thickness=.0055,top=tip-thickness,low=top-corner,path=[];
 path.push([frontZ,rootRadius],[frontZ,low]);
 for(let i=1;i<=16;i++){const a=Math.PI-i*Math.PI/32;path.push([frontZ+corner+Math.cos(a)*corner,low+Math.sin(a)*corner]);}
 for(let i=1;i<=8;i++)path.push([frontZ+corner+(rearZ-frontZ-2*corner)*i/8,top]);
 for(let i=1;i<=16;i++){const a=Math.PI/2-i*Math.PI/32;path.push([rearZ-corner+Math.cos(a)*corner,low+Math.sin(a)*corner]);}
 path.push([rearZ,rootRadius]);
 const positions=[],uv=[],indices=[],segments=20,rx=Math.sin(angle),ry=Math.cos(angle);
 for(let i=0;i<path.length;i++){
  const [z,r]=path[i],before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],dz=after[0]-before[0],dr=after[1]-before[1],length=Math.hypot(dz,dr);
  for(let j=0;j<=segments;j++){
   const a=j*Math.PI*2/segments,across=Math.sin(a)*width/2,radial=r+Math.cos(a)*thickness*dz/length,station=z-Math.cos(a)*thickness*dr/length;
   positions.push(x+rx*radial+ry*across,centerY+ry*radial-rx*across,station);uv.push(j/segments,i/(path.length-1));
  }
 }
 for(let i=0;i<path.length-1;i++)for(let j=0;j<segments;j++){const a=i*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
 // The ends close inside the casing rather than bridging across the cutout.
 for(const row of [0,path.length-1]){const start=row*(segments+1);for(let j=1;j<segments-1;j++)indices.push(...(row===0?[start,start+j+1,start+j]:[start,start+j,start+j+1]));}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.userData.openHandle={frontZ,rearZ,rootRadius,innerRadius:top-thickness,tip,width};return geometry;
};

/* Aft fins use the rounded rail silhouette with a solid web down to the casing. */
window.createSolidEngineFinGeometry=(T,{x,centerY,angle,width=.0165,tip=.109,frontZ=.435,rearZ=.680})=>{
 const rail=createEngineHandleFinGeometry(T,{x,centerY,angle,width,tip,frontZ,rearZ});
 const railWidth=width; width=.0048;
 const positions=[],uv=[],indices=[],rx=Math.sin(angle),ry=Math.cos(angle),base=.0815,rows=160,arcSegments=20,ringSize=arcSegments+4,endLength=.035;
 for(let row=1;row<rows;row++){
  const z=frontZ+(rearZ-frontZ)*row/rows,edge=Math.min(z-frontZ,rearZ-z),round=edge<endLength?Math.sqrt(Math.max(0,1-(1-edge/endLength)**2)):1;
  const half=width/2*round,top=base+(tip-.0045-base)*round,crownBase=top-.0055*round,section=[[-half,base]];
  for(let n=0;n<=arcSegments;n++){const a=Math.PI-n*Math.PI/arcSegments;section.push([Math.cos(a)*half,crownBase+Math.sin(a)*.0055*round]);}
  section.push([half,base],[0,base]);
  for(const [across,r] of section){positions.push(x+rx*r+ry*across,centerY+ry*r-rx*across,z);uv.push((across/width)+.5,row/rows);}
 }
 for(let row=0;row<rows-2;row++)for(let n=0;n<ringSize;n++){const a=row*ringSize+n,b=row*ringSize+(n+1)%ringSize,c=a+ringSize,d=b+ringSize;indices.push(a,c,b,b,c,d);}
 for(const [z,row,reverse] of [[frontZ,0,true],[rearZ,rows-2,false]]){
  const pole=positions.length/3;positions.push(x+rx*base,centerY+ry*base,z);uv.push(.5,reverse?0:1);
  for(let n=0;n<ringSize;n++){const a=row*ringSize+n,b=row*ringSize+(n+1)%ringSize;indices.push(...(reverse?[pole,a,b]:[pole,b,a]));}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 // A narrow solid web meets the underside of the rounded rail. The shoulders
 // remain visible, giving the bar shape without an opening through its middle.
 const web=geometry,railFaces=rail,combined=new T.BufferGeometry();
 for(const attribute of ['position','normal','uv']){const a=railFaces.attributes[attribute],b=web.attributes[attribute],data=new Float32Array(a.array.length+b.array.length);data.set(a.array);data.set(b.array,a.array.length);combined.setAttribute(attribute,new T.Float32BufferAttribute(data,a.itemSize));}
 const mergedIndices=Array.from(rail.index.array),offset=rail.attributes.position.count;for(const i of web.index.array)mergedIndices.push(i+offset);combined.setIndex(mergedIndices);
 combined.addGroup(0,rail.index.count,0);combined.addGroup(rail.index.count,web.index.count,1);
 geometry.dispose();rail.dispose();
 combined.userData.solidFin={frontZ,rearZ,width:railWidth,webWidth:width,tip,rootRadius:base,roundedRail:true};return combined;
};

/* Enlarge the aft fittings about their casing attachment and fixed aft station. */
window.resizeAftEngineFins=(T,model,factor=1.8)=>{
 model.updateWorldMatrix(true,true);
 const gray=new T.MeshStandardMaterial({color:0x9ca69c,roughness:.55,metalness:.32}),fins=[];
 // A filled square mesh covers only the inset web; the rounded rail stays smooth.
 // Color and shallow relief keep the grid visible over its opaque backing.
 const reliefTile=document.createElement('canvas');reliefTile.width=reliefTile.height=128;
 const rc=reliefTile.getContext('2d');rc.fillStyle='#000000';rc.fillRect(0,0,128,128);rc.fillStyle='#ffffff';
 for(const edge of [0,122]){rc.fillRect(edge,0,6,128);rc.fillRect(0,edge,128,6);}
 const relief=new T.CanvasTexture(reliefTile);relief.wrapS=relief.wrapT=T.MirroredRepeatWrapping;relief.anisotropy=4;
 const gridTile=document.createElement('canvas');gridTile.width=gridTile.height=128;const gc=gridTile.getContext('2d');gc.fillStyle='#ffffff';gc.fillRect(0,0,128,128);gc.fillStyle='#d4dad4';
 for(const edge of [0,122]){gc.fillRect(edge,0,6,128);gc.fillRect(0,edge,128,6);}
 const gridMap=new T.CanvasTexture(gridTile);gridMap.colorSpace=T.SRGBColorSpace;gridMap.wrapS=gridMap.wrapT=T.MirroredRepeatWrapping;gridMap.anisotropy=4;
 for(const texture of [gridMap,relief]){texture.center.set(.5,.5);texture.rotation=0;}
 const inset=gray.clone();inset.map=gridMap;inset.bumpMap=relief;inset.bumpScale=.00055;
 model.traverse(o=>{if(o.isMesh&&o.name.endsWith('-aft-engine-fin'))fins.push(o);});
 for(const fin of fins){
  const prefix=fin.name.startsWith('port')?'port':'starboard',tube=model.getObjectByName(prefix+'-engine-outer-tube'),parent=tube.parent,p=fin.geometry.attributes.position,{angle}=fin.userData.referenceDimensions,rx=Math.sin(angle),ry=Math.cos(angle),vertices=[];
  let front=Infinity,rear=-Infinity,projection=0;
  for(let i=0;i<p.count;i++){const v=parent.worldToLocal(fin.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));vertices.push(v);front=Math.min(front,v.z);rear=Math.max(rear,v.z);projection=Math.max(projection,(v.x-tube.position.x)*rx+(v.y-tube.position.y)*ry-.087);}
  for(let i=0;i<vertices.length;i++){
   const v=vertices[i],dx=v.x-tube.position.x,dy=v.y-tube.position.y,radial=.087+(dx*rx+dy*ry-.087)*factor,tangent=(dx*ry-dy*rx)*factor;
   v.set(tube.position.x+rx*radial+ry*tangent,tube.position.y+ry*radial-rx*tangent,rear+(v.z-rear)*factor);
   fin.worldToLocal(parent.localToWorld(v));p.setXYZ(i,v.x,v.y,v.z);
  }
  const uv=fin.geometry.attributes.uv;
  for(let i=0;i<p.count;i++){const v=parent.worldToLocal(fin.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));const radial=(v.x-tube.position.x)*rx+(v.y-tube.position.y)*ry;uv.setXY(i,(v.z-rear)/.007,(radial-.087)/.007);}
  uv.needsUpdate=true;p.needsUpdate=true;fin.geometry.computeVertexNormals();fin.geometry.boundingSphere=null;fin.geometry.boundingBox=null;fin.material=[gray,inset];
  fin.userData.referenceDimensions.width*=factor;
  fin.userData.enlargedAftFin={factor,previousLength:rear-front,length:(rear-front)*factor,rearZ:rear,previousProjection:projection,projection:projection*factor,impulseStyleGrate:true,solidBacking:true};
 }
};

