/* Inboard service recess, registered to the finished forward handle position. */
window.addEngineInboardPanels=(T,model,{handleLength=null,rearPanelWidth=null,surfaceDetail=null}={})=>{
 const impulsePaint=model.getObjectByName('movie-impulse-housing')?.material;
 const metal=color=>new T.MeshStandardMaterial({color,roughness:impulsePaint?.roughness??.92,metalness:impulsePaint?.metalness??.12});
 const assemblyPaint=metal(impulsePaint?.color.getHex()??0x5a6065);assemblyPaint.side=T.DoubleSide;
 const edgePaint=metal(0x6c7379),boltPaint=metal(0x80888f),insetEdgePaint=metal(0x43494e);
 const barPaint=assemblyPaint.clone();barPaint.color.setHex(0x747d84);
 // Painted hatch with hull plating at half the usual panel size.
 const housingMetal=assemblyPaint.clone();housingMetal.roughness=.92;housingMetal.metalness=.12;
 if(surfaceDetail)surfaceDetail.apply(housingMetal,0,{physical:true,paintUnderlay:'hatch',tileScale:2});
 // Subtract the rectangular chamber opening while preserving surface attributes
 // and material groups on the surrounding nacelle skin.
 function cutOpening(mesh,planes){
  mesh.updateMatrix();const old=mesh.geometry,attributes=Object.entries(old.attributes),output=Object.fromEntries(attributes.map(([name])=>[name,[]])),groups=[];
  const count=old.index?old.index.count:old.attributes.position.count;
  const vertex=i=>{const id=old.index?old.index.getX(i):i,data={};for(const [name,a]of attributes)data[name]=Array.from(a.array.slice(id*a.itemSize,(id+1)*a.itemSize));return data;};
  const distance=(v,plane)=>{const p=new T.Vector3(...v.position).applyMatrix4(mesh.matrix);return p.x*plane[0]+p.y*plane[1]+p.z*plane[2]+plane[3];};
  const mix=(a,b,t)=>Object.fromEntries(attributes.map(([name])=>[name,a[name].map((value,i)=>value+(b[name][i]-value)*t)]));
  function split(poly,plane){const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a,plane),db=distance(b,plane);(da>=0?inside:outside).push(a);if((da>=0)!==(db>=0)){const v=mix(a,b,da/(da-db));inside.push(v);outside.push(v);}}return {inside,outside};}
  function emit(poly,materialIndex){const start=output.position.length/3;for(let i=1;i<poly.length-1;i++)for(const v of [poly[0],poly[i],poly[i+1]])for(const [name]of attributes)output[name].push(...v[name]);const added=output.position.length/3-start;if(!added)return;const last=groups.at(-1);if(last&&last.materialIndex===materialIndex)last.count+=added;else groups.push({start,count:added,materialIndex});}
  for(const group of old.groups.length?old.groups:[{start:0,count,materialIndex:0}])for(let i=group.start;i<group.start+group.count;i+=3){let poly=[vertex(i),vertex(i+1),vertex(i+2)];for(const plane of planes){const pieces=split(poly,plane);emit(pieces.outside,group.materialIndex);poly=pieces.inside;if(poly.length<3)break;}}
  const geometry=new T.BufferGeometry();for(const [name,a]of attributes)geometry.setAttribute(name,new T.Float32BufferAttribute(output[name],a.itemSize));for(const g of groups)geometry.addGroup(g.start,g.count,g.materialIndex);geometry.userData={...old.userData,inboardChamberOpening:true};mesh.geometry=geometry;old.dispose();
 }
 const impulseVertical=model.getObjectByName('port-impulse-grate-vertical'),impulseHorizontal=model.getObjectByName('port-impulse-grate-horizontal');
 const grilleMaterial=impulseVertical?.material??new T.MeshStandardMaterial({color:0x000000,roughness:.90,metalness:.12});
 for(const side of [-1,1]){
  const prefix=side<0?'port':'starboard',handle=model.getObjectByName(prefix+'-inboard-engine-fin'),tube=model.getObjectByName(prefix+'-engine-outer-tube');if(!handle||!tube)continue;
  handle.material=barPaint;
  model.updateWorldMatrix(true,true);const parent=tube.parent,p=handle.geometry.attributes.position,tp=tube.geometry.attributes.position;let bodyFront=Infinity,bodyRear=-Infinity,front=Infinity,rear=-Infinity;
  for(let i=0;i<tp.count;i++){const v=parent.worldToLocal(tube.localToWorld(new T.Vector3().fromBufferAttribute(tp,i)));bodyFront=Math.min(bodyFront,v.z);bodyRear=Math.max(bodyRear,v.z);}
  const bodyLength=bodyRear-bodyFront;
  for(let i=0;i<p.count;i++){const v=parent.worldToLocal(handle.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));front=Math.min(front,v.z);rear=Math.max(rear,v.z);}
  const pylon=model.getObjectByName(prefix+'-engine-strut'),pylonZ=parent.worldToLocal(pylon.getWorldPosition(new T.Vector3())).z;
  const e=parent.matrixWorld.elements;
  const worldScaleZ=Math.hypot(e[8],e[9],e[10]);
  const targetFront=pylonZ+.0085,targetRear=targetFront+(handleLength===null?bodyLength*.242:handleLength/worldScaleZ);
  for(let i=0;i<p.count;i++){const v=parent.worldToLocal(handle.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));v.z=targetFront+(v.z-front)/(rear-front)*(targetRear-targetFront);v.x=tube.position.x+(v.x-tube.position.x)*1.1+side*.087*.1;v.y=tube.position.y+(v.y-tube.position.y)*1.1;const angle=(v.y-tube.position.y)/.0874,radial=(v.x-tube.position.x)*-side;v.x=tube.position.x-side*radial*Math.cos(angle);v.y=tube.position.y+radial*Math.sin(angle);handle.worldToLocal(parent.localToWorld(v));p.setXYZ(i,v.x,v.y,v.z);}
  p.needsUpdate=true;handle.geometry.computeVertexNormals();handle.geometry.boundingBox=null;handle.geometry.boundingSphere=null;front=targetFront;rear=targetRear;
  const x=tube.position.x,y=tube.position.y,inboard=-side,group=new T.Group();group.name=prefix+'-inboard-service-panel';parent.add(group);
  const start=pylonZ,end=bodyFront+bodyLength*.80,halfH=.040,face=.0874,rim=edgePaint,well=housingMetal,bracket=boltPaint;
  // Both rear rectangles share the inboard vent's dimensions and axial station.
  let rearVentFront=bodyFront+bodyLength*.825,finRear=-Infinity;
  model.traverse(o=>{if(!o.isMesh||!o.name.startsWith(prefix)||!o.name.endsWith('-aft-engine-fin'))return;const fp=o.geometry.attributes.position;for(let i=0;i<fp.count;i++){const v=parent.worldToLocal(o.localToWorld(new T.Vector3().fromBufferAttribute(fp,i)));finRear=Math.max(finRear,v.z);}});
  const rearVentEnd=Number.isFinite(finRear)?finRear:bodyFront+bodyLength*.945;
  if(rearPanelWidth!==null)rearVentFront=rearVentEnd-rearPanelWidth/worldScaleZ;
  const cowling=model.getObjectByName(prefix+'-rear-exhaust-hood'),cowlingPaint=Array.isArray(cowling?.material)?cowling.material[0]:cowling?.material;
  const rearVentSpec={x,centerY:y,radius:.087,z:(rearVentFront+rearVentEnd)/2,axialWidth:rearVentEnd-rearVentFront,solidPanel:rearPanelWidth!==null,surfaceMaterial:cowlingPaint};
  const rearVent=createAftEngineVent(T,{...rearVentSpec,side:inboard,namePrefix:prefix+'-inboard'});rearVent.userData.aftEngineVent.inboard=true;parent.add(rearVent);
  const outerRearVent=createAftEngineVent(T,{...rearVentSpec,side,namePrefix:prefix});parent.add(outerRearVent);
  function add(geometry,material,name){const o=new T.Mesh(geometry,material);o.name=prefix+name;group.add(o);return o;}
  function box(name,r,dy,z,w,h,d,mat){const o=add(new T.BoxGeometry(w,h,d),mat,name);o.position.set(x+inboard*r,y+dy,z);return o;}
  function outline(inset){
   const points=[],a=start+inset,b=end-inset,h=halfH-inset,frontRadius=.016-inset,backRadius=.010-inset;
   for(const [z,dy,angle,radius]of [[a+frontRadius,-h+frontRadius,Math.PI,frontRadius],[b-backRadius,-h+backRadius,-Math.PI/2,backRadius],[b-backRadius,h-backRadius,0,backRadius],[a+frontRadius,h-frontRadius,Math.PI/2,frontRadius]])for(let i=0;i<=12;i++){const t=angle+i*Math.PI/24;points.push([z+Math.cos(t)*radius,dy+Math.sin(t)*radius]);}
   return points;
  }
  const outer=outline(0),inner=outline(.0045),positions=[],indices=[];
  for(let i=0;i<outer.length;i++)for(const [r,v]of [[face+.0015,outer[i]],[face,inner[i]]])positions.push(x+inboard*r,y+v[1],v[0]);
  for(let i=0;i<outer.length;i++){const a=i*2,b=((i+1)%outer.length)*2;indices.push(a,b,a+1,a+1,b,b+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();rim.side=T.DoubleSide;add(g,rim,'-inboard-recess-border');
  const floorPositions=[x+inboard*face,y,(start+end)/2],floorIndices=[];for(const [z,dy]of inner)floorPositions.push(x+inboard*face,y+dy,z);for(let i=0;i<inner.length;i++)floorIndices.push(0,i+1,(i+1)%inner.length+1);
  const floorGeometry=new T.BufferGeometry();floorGeometry.setAttribute('position',new T.Float32BufferAttribute(floorPositions,3));floorGeometry.setIndex(floorIndices);floorGeometry.computeVertexNormals();well.side=T.DoubleSide;add(floorGeometry,well,'-dark-inboard-channel');
  floorGeometry.userData.hullSurfaceMapping={kind:'cylinder-z',centerX:x,centerY:y};
  // Retain the former grille station for panel dimension metadata.
  const grilleStart=pylonZ+.025+bodyLength*.242+.012;
  // The framed mesh chamber begins aft of the bar, following the casing curve.
  const insertFront=rear+.012,insertRear=end-.025,insertHeight=.050,insertBorder=.005;
  const insertLength=insertRear-insertFront,insertCenter=(insertFront+insertRear)/2;
  const meshRadius=face-.006,insertRimRadius=meshRadius-.0002,insertRimDepth=.0012;
  const insertRimMaterial=insetEdgePaint;
  const roomHeight=insertHeight-2*insertBorder,roomLength=insertLength-2*insertBorder,roomDepth=.174/5,roomBack=meshRadius-roomDepth;
  // Engine room: five matte sides, open toward the mesh.
  // Match the assembly's darkest mesh color with diffuse-only room surfaces.
  const roomPaint=new T.MeshLambertMaterial({color:grilleMaterial.color}),roomWall=roomPaint.clone(),roomFloor=roomPaint.clone(),gridMargin=.003;
  // Keep the grille size fixed and clear the tube skin beyond its frame,
  // including the top and bottom edges when viewed at an angle.
  const cutoutClearance=.004,openingHeight=insertHeight+2*cutoutClearance;
  const openingFront=insertFront-cutoutClearance,openingRear=insertRear+cutoutClearance;
  // One continuous surround joins the curved opening to the recessed frame.
  // Shared contour edges avoid overlapping box faces and hairline seams.
  const frameRadius=insertRimRadius+insertRimDepth/2;
  const mouthHalfHeight=openingHeight/2-.0003,mouthFront=openingFront+.0003,mouthRear=openingRear-.0003;
  function contour(halfHeight,front,rear,radius){
   const corners=[[-halfHeight,front],[halfHeight,front],[halfHeight,rear],[-halfHeight,rear]],points=[];
   for(let edge=0;edge<4;edge++)for(let n=0;n<32;n++){const a=corners[edge],b=corners[(edge+1)%4],t=n/32,dy=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,r=radius===null?Math.sqrt(face*face-dy*dy)+.0001:radius;points.push([x+inboard*r,y+dy,z]);}return points;
  }
  // End the return exactly at the room mouth. Extending it into the room
  // overlaps the floor and walls with coplanar faces that flicker from below.
  const frameContours=[contour(mouthHalfHeight,mouthFront,mouthRear,null),contour(mouthHalfHeight,mouthFront,mouthRear,frameRadius),contour(insertHeight/2,insertFront,insertRear,frameRadius),contour(roomHeight/2,insertFront+insertBorder,insertRear-insertBorder,frameRadius),contour(roomHeight/2,insertFront+insertBorder,insertRear-insertBorder,meshRadius)];
  const framePositions=[],frameIndices=[],frameGroups=[];
  for(let band=0;band<frameContours.length-1;band++){const start=frameIndices.length,a=frameContours[band],b=frameContours[band+1];for(let n=0;n<a.length;n++){const next=(n+1)%a.length,base=framePositions.length/3;framePositions.push(...a[n],...a[next],...b[n],...b[next]);frameIndices.push(base,base+1,base+2,base+1,base+3,base+2);}frameGroups.push({start,count:frameIndices.length-start,materialIndex:band<2?0:1});}
  const frameGeometry=new T.BufferGeometry();frameGeometry.setAttribute('position',new T.Float32BufferAttribute(framePositions,3));frameGeometry.setIndex(frameIndices);frameGeometry.computeVertexNormals();for(const g of frameGroups)frameGeometry.addGroup(g.start,g.count,g.materialIndex);
  const frame=add(frameGeometry,[housingMetal,insertRimMaterial],'-inboard-raised-insert-frame');frame.material[1].side=T.DoubleSide;frame.userData.continuousSurround=true;
  const engineRoom=new T.Group();engineRoom.name=prefix+'-engine-room';engineRoom.userData={label:'Engine room',depth:roomDepth};group.add(engineRoom);
  // A quarter-circle cove joins the back wall to the floor, ceiling and sides.
  // Matching spherical corner patches keep the four curved transitions continuous.
  const coveRadius=Math.min(roomHeight*.18,roomDepth*.25,roomLength*.1),coveSteps=16,cornerSteps=8;
  const backWall=box('-inboard-insert-room-back',roomBack-.00015,0,insertCenter,.0003,roomHeight-2*coveRadius,roomLength-2*coveRadius,roomPaint);backWall.receiveShadow=true;
  engineRoom.add(backWall);engineRoom.userData.coveRadius=coveRadius;
  const cornerCenters=[[1,1],[-1,1],[-1,-1],[1,-1]];
  for(const [wallIndex,name]of ['upper','front','lower','rear'].entries()){
    const section=[];
    for(const [corner,start,end]of [[wallIndex,Math.PI/4,Math.PI/2],[(wallIndex+1)%4,0,Math.PI/4]]){
      const [sz,sy]=cornerCenters[corner];
      for(let i=0;i<=cornerSteps;i++)section.push({cy:sy*(roomHeight/2-coveRadius),cz:sz*(roomLength/2-coveRadius),angle:corner*Math.PI/2+start+(end-start)*i/cornerSteps});
    }
    const positions=[],normals=[],uv=[],indices=[],columns=section.length;
    for(let row=0;row<=coveSteps+1;row++){
      const angle=Math.min(row,coveSteps)/coveSteps*Math.PI/2,depth=row>coveSteps?roomDepth:coveRadius*(1-Math.cos(angle)),radius=coveRadius*Math.sin(angle);
      for(const point of section){const sn=Math.sin(point.angle),cs=Math.cos(point.angle);positions.push(inboard*depth,point.cy+radius*sn,point.cz+radius*cs);normals.push(inboard*Math.cos(angle),-Math.sin(angle)*sn,-Math.sin(angle)*cs);uv.push(0,0);}
    }
    for(let row=0;row<=coveSteps;row++)for(let col=0;col<columns-1;col++){const a=row*columns+col,b=a+columns;if(inboard>0)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
    const wall=add(geometry,name==='lower'?roomFloor:roomWall,'-inboard-insert-room-'+name+'-wall');wall.position.set(x+inboard*roomBack,y,insertCenter);wall.receiveShadow=true;wall.userData.backWallCove={radius:coveRadius,steps:coveSteps,sphericalCorners:true};engineRoom.add(wall);
  }
  const grid=new T.Group();grid.name=prefix+'-inboard-gold-grid';group.add(grid);
  const gridRadius=meshRadius-roomDepth*.2,gridLength=roomLength;
  const gridBottom=y-roomHeight/2,gridTop=y+roomHeight/2,gridHeight=gridTop-gridBottom,gridY=(gridTop+gridBottom)/2;
  // Coarser solid diamond bars reduce subpixel shimmer. Match the surround's
  // paint and use a matte finish rather than bright, flickering highlights.
  const barWidth=.0011,barDepth=.0012,barPitch=.008,layerGap=.00008,endClearance=.0003;
  const gratePaint=new T.MeshStandardMaterial({color:housingMetal.color,roughness:.95,metalness:.05});
  function diagonalBars(slope,layer,name){
   const positions=[],halfY=gridHeight/2-endClearance,halfZ=gridLength/2-endClearance,extent=halfY+halfZ;
   let count=0;
   function clip(poly,bound,positive){
    const result=[],distance=p=>(p[0]-slope*p[1]-bound)*(positive?1:-1);
    for(let i=0;i<poly.length;i++){
     const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);
     if(da>=0)result.push(a);
     if((da>=0)!==(db>=0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    return result;
   }
   const vertex=(p,front)=>[x+inboard*(gridRadius+layer+(front?1:-1)*barDepth/2),gridY+p[0],insertCenter+p[1]];
   function triangle(a,b,c){positions.push(...a,...(inboard>0?b:c),...(inboard>0?c:b));}
   const pitch=barPitch*Math.SQRT2,halfWidth=barWidth/Math.SQRT2;
   for(let n=-Math.ceil(extent/pitch);n<=Math.ceil(extent/pitch);n++){
    let poly=[[-halfY,-halfZ],[halfY,-halfZ],[halfY,halfZ],[-halfY,halfZ]];
    poly=clip(clip(poly,n*pitch-halfWidth,true),n*pitch+halfWidth,false);if(poly.length<3)continue;count++;
    for(let i=1;i<poly.length-1;i++){
     triangle(vertex(poly[0],true),vertex(poly[i],true),vertex(poly[i+1],true));
     triangle(vertex(poly[0],false),vertex(poly[i+1],false),vertex(poly[i],false));
    }
    for(let i=0;i<poly.length;i++){
     const a=poly[i],b=poly[(i+1)%poly.length];
     triangle(vertex(a,false),vertex(b,false),vertex(b,true));triangle(vertex(a,false),vertex(b,true),vertex(a,true));
    }
   }
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
   const bars=new T.Mesh(geometry,gratePaint);bars.name=prefix+name;bars.userData={angleDegrees:slope*45,barCount:count,layerOffset:layer};grid.add(bars);return count;
  }
  const positiveBars=diagonalBars(1,(barDepth+layerGap)/2,'-engine-room-grate-positive');
  const negativeBars=diagonalBars(-1,-(barDepth+layerGap)/2,'-engine-room-grate-negative');
  grid.userData={roundBars:false,impulseMesh:false,diagonalGrate:true,angleDegrees:45,positiveBars,negativeBars,setbackFraction:.2,radius:gridRadius,top:gridTop,bottom:gridBottom,barWidth,barDepth,barPitch,layerGap,endClearance,sealedRodEnds:true,paintMatchesSurround:true};
  // A matte off-white back wall replaces the luminous panel and wall glow.
  // The cool tint retains the surrounding area's soft gray-white appearance.
  roomPaint.color.setHex(0xc6cbd0);roomPaint.emissive.setHex(0x000000);roomPaint.emissiveIntensity=0;
  roomWall.copy(roomPaint);
  roomFloor.copy(roomPaint);
  backWall.userData.paintedWhiteWall=true;
  engineRoom.userData.glow={enabled:false,diffuseWallBounce:false,featheredCorners:false};

  // The bracket's underside sits at the casing radius, without a stand-off.
  box('-inboard-handle-end-plate',.0894,0,front-.004,.0048,.0348,.036,bracket);
  // Keep the recessed chamber, grid and frame planar. The surrounding service
  // panel and bolt plate retain their fit around the casing.
  for(const mesh of group.children){
   if(!mesh.isMesh||mesh.isInstancedMesh)continue;
   if(mesh.name.includes('-inboard-insert-room-')||mesh.name.includes('-inboard-raised-insert-'))continue;
   mesh.updateMatrix();const old=mesh.geometry,source=old.index?old.toNonIndexed():old.clone();source.applyMatrix4(mesh.matrix);
   const pos=source.attributes.position,norm=source.attributes.normal,uv=source.attributes.uv,vertices=[],normals=[],texcoords=[];
   function vertex(i){return {p:[pos.getX(i),pos.getY(i),pos.getZ(i)],n:[norm.getX(i),norm.getY(i),norm.getZ(i)],uv:uv?[uv.getX(i),uv.getY(i)]:null};}
   function midpoint(a,b){return {p:a.p.map((v,i)=>(v+b.p[i])/2),n:a.n.map((v,i)=>(v+b.n[i])/2),uv:a.uv?a.uv.map((v,i)=>(v+b.uv[i])/2):null};}
   function triangle(a,b,c){
    const v=[a,b,c],spans=v.map((v,i)=>Math.abs(v.p[1]-[b,c,a][i].p[1])),edge=spans.indexOf(Math.max(...spans));
    if(spans[edge]>.0025){const next=(edge+1)%3,last=(edge+2)%3,m=midpoint(v[edge],v[next]);triangle(v[edge],m,v[last]);triangle(m,v[next],v[last]);return;}
    for(const v of [a,b,c]){const r=(v.p[0]-x)*inboard,angle=(v.p[1]-y)/face,cs=Math.cos(angle),sn=Math.sin(angle),nx=v.n[0],ny=v.n[1]*face/r;
     vertices.push(x+inboard*r*cs,y+r*sn,v.p[2]);const n=new T.Vector3(cs*nx-inboard*sn*ny,inboard*sn*nx+cs*ny,v.n[2]).normalize();normals.push(n.x,n.y,n.z);if(v.uv)texcoords.push(...v.uv);
    }
   }
   for(let i=0;i<pos.count;i+=3)triangle(vertex(i),vertex(i+1),vertex(i+2));
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));if(uv)geometry.setAttribute('uv',new T.Float32BufferAttribute(texcoords,2));
   geometry.userData={...old.userData};mesh.geometry=geometry;mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);old.dispose();source.dispose();
  }
  const openingPlanes=[[inboard,0,0,-inboard*x-.045],[0,1,0,-y+openingHeight/2-.0003],[0,-1,0,y+openingHeight/2-.0003],[0,0,1,-openingFront-.0003],[0,0,-1,openingRear-.0003]];
  cutOpening(tube,openingPlanes);cutOpening(group.getObjectByName(prefix+'-dark-inboard-channel'),openingPlanes);
  const innerHousing=model.getObjectByName(prefix+'-dome-inner-housing');
  if(innerHousing)cutOpening(innerHousing,openingPlanes);
  group.userData.inboardPanel={front,rear,start,end,bodyFront,bodyRear,height:halfH*2,pylonZ,handleScale:1.1,referenceHandleLength:handleLength,frontOverhang:start-front,roundedFront:true,frontRadius:.016,curvedAroundTube:true,wrapRadius:face,grilleStart,bracketScale:1.2,grilleCells:0};
  group.userData.inboardPanel.raisedInsert={front:insertFront,rear:insertRear,height:insertHeight,border:insertBorder,floorRadius:meshRadius,rimRadius:insertRimRadius+insertRimDepth/2,roomBackRadius:roomBack,roomDepth,gridMargin,openingHeight,openingFront,openingRear,planar:true,recessed:true};
 }
};
