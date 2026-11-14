/* Local gray paint shapes between the forward couplings and pylon attachments. */
window.addEngineCouplingPatches=(T,model,{inboard=false,surfaceDetail=null}={})=>{
 model.updateWorldMatrix(true,true);
 for(const side of [-1,1]){
  const prefix=side<0?'port':'starboard',tube=model.getObjectByName(prefix+'-engine-outer-tube'),shoe=model.getObjectByName(prefix+'-engine-pylon-shoe');if(!tube||!shoe)continue;
  const parent=tube.parent,x=tube.position.x,cy=tube.position.y,radius=.087,paintSide=inboard?-side:side;
  const topFront=inboard?-.026:-.0435,topRear=inboard?-.055:-.066,bottom=-.087,maxTop=Math.max(topFront,topRear);
  function axialBounds(mesh){const p=mesh.geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){const v=parent.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i)));min=Math.min(min,v.z);max=Math.max(max,v.z);}return {min,max};}
  const coupling=model.getObjectByName(prefix+(inboard?'-inboard-forward-engine-clamp':'-outboard-forward-engine-clamp')),firstRing=model.getObjectByName(prefix+'-forward-clamp-vent-0'),body=axialBounds(tube),attachment=axialBounds(shoe),shapeFront=coupling?axialBounds(coupling).max-.012:body.min+.12,front=firstRing?axialBounds(firstRing).max:body.min+.065,rear=attachment.max-.018;
  const rows=[bottom,maxTop];for(let i=0;i<64;i++){const y=radius*Math.sin(i*Math.PI/32);if(y>bottom&&y<maxTop)rows.push(y);}rows.sort((a,b)=>a-b);
  const levels=rows.filter((y,i)=>i===0||Math.abs(y-rows[i-1])>1e-8),positions=[],uv=[],indices=[];
  function casingX(dy){const a=Math.asin(dy/radius),step=Math.PI/32,mid=(Math.floor(a/step)+.5)*step;return radius*Math.cos(step/2)/Math.cos(a-mid)*Math.cos(a);}
  function top(u){u=(front+u*(rear-front)-shapeFront)/(rear-shapeFront);if(inboard){const t=Math.max(0,Math.min(1,(u-.43)/.15)),blend=t*t*(3-2*t);return topFront+(topRear-topFront)*blend;}const t=Math.max(0,Math.min(1,(u-.42)/.34)),blend=t*t*(3-2*t);return topFront+(topRear-topFront)*blend;}
  if(inboard){
   const ys=[...levels];for(let i=1;i<64;i++)ys.push(bottom+(maxTop-bottom)*i/64);ys.sort((a,b)=>a-b);
   const scan=ys.filter((dy,i)=>i===0||Math.abs(dy-ys[i-1])>1e-8),columns=80;
   function leading(){return front;}
   function clip(poly){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=top((a[0]-front)/(rear-front))-a[1],db=top((b[0]-front)/(rear-front))-b[1];if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
   for(let row=0;row<scan.length-1;row++)for(let col=0;col<columns;col++){
    const y0=scan[row],y1=scan[row+1],z00=leading(y0)+(rear-leading(y0))*col/columns,z01=leading(y0)+(rear-leading(y0))*(col+1)/columns,z10=leading(y1)+(rear-leading(y1))*col/columns,z11=leading(y1)+(rear-leading(y1))*(col+1)/columns;
    const poly=clip([[z00,y0],[z01,y0],[z11,y1],[z10,y1]]);if(poly.length<3)continue;const start=positions.length/3;
    for(const [z,dy]of poly){positions.push(x+paintSide*casingX(dy),cy+dy,z);uv.push((z-front)/(rear-front),(dy-bottom)/(topFront-bottom));}
    for(let i=1;i<poly.length-1;i++)indices.push(...(paintSide>0?[start,start+i+1,start+i]:[start,start+i,start+i+1]));
   }
  }
  if(!inboard){
   // The marked outline lies on the lower outboard quadrant, with a coupling
   // notch and a swept leading corner as it wraps toward the tube underside.
   positions.length=uv.length=indices.length=0;
   const ys=[bottom,topFront,-.055001,-.054999,-.066001,-.065999];
   for(let i=1;i<64;i++)ys.push(bottom+(topFront-bottom)*i/64);
   for(const dy of levels)ys.push(dy);ys.sort((a,b)=>a-b);
   const scan=ys.filter((dy,i)=>i===0||Math.abs(dy-ys[i-1])>1e-8),columns=80;
   function leading(){return front;}
   function trailing(dy){if(dy<=topRear)return rear;let lo=0,hi=1;for(let i=0;i<24;i++){const u=(lo+hi)/2;if(top(u)>=dy)lo=u;else hi=u;}return front+(rear-front)*(lo+hi)/2;}
   for(const dy of scan){const start=leading(dy),end=trailing(dy);for(let col=0;col<=columns;col++){const u=col/columns;positions.push(x+paintSide*casingX(dy),cy+dy,start+(end-start)*u);uv.push(u,(dy-bottom)/(topFront-bottom));}}
   for(let row=0;row<scan.length-1;row++)for(let col=0;col<columns;col++){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(...(paintSide>0?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);const normals=[];for(let i=0;i<positions.length;i+=3){const dx=positions[i]-x,dy=positions[i+1]-cy,r=Math.hypot(dx,dy);normals.push(dx/r,dy/r,0);}geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  // Keep the curved paint shapes subtle against the surrounding gray-green tube.
  const paint=new T.MeshStandardMaterial({color:inboard?0xa0ab9f:0x98a393,roughness:.76,metalness:.12,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,depthWrite:false});
  // This is a separate painted skin, so it needs its own plating shader.
  // Reuse the casing UVs so plate rows continue through the colored panel.
  const platingUV=geometry.attributes.uv;
  for(let i=0;i<positions.length/3;i++){const dx=positions[i*3]-x,dy=positions[i*3+1]-cy,angle=(Math.atan2(dx,-dy)+Math.PI*2)%(Math.PI*2);platingUV.setXY(i,angle/(Math.PI*2),(positions[i*3+2]-body.min)/(body.max-body.min));}
  geometry.userData.hullSurfaceMapping={kind:'cylinder-z',centerX:x,centerY:cy};
  if(surfaceDetail)surfaceDetail.apply(paint,3,{paintUnderlay:'coupling-panel'});
  const patch=new T.Mesh(geometry,paint);patch.name=prefix+(inboard?'-inboard':'-outboard')+'-coupling-gray-patch';patch.userData[inboard?'inboardPatch':'outboardPatch']={front,rear,pylonZ:(attachment.min+attachment.max)/2,topFront,topRear,bottom,pylonAftZ:attachment.max,lowerQuadrant:true,connectedUnderneath:true,profileDip:inboard?topRear:null,firstRingZ:front,startsAtFirstRing:true,shapeFront,aftInset:.018,connectorRise:inboard?-.003:0};parent.add(patch);
 }
};
