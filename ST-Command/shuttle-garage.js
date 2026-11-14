/* Deep shuttle storage with an overhead sectional door and receding shadows. */
window.createGarageBulkheadGeometry=(T,outline,front,back)=>{
 // The frame lines the opening; keep the bulkhead reveals behind it rather
 // than placing two surfaces on the same plane along the jambs and sill.
 const clearance=.0003,half=createShuttleGarage.doorWidth/2+clearance,bottom=-.0465-clearance,top=-.0465+.090*.90+clearance,positions=[],indices=[];
 function clip(poly,axis,value,greater){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],inside=p=>greater?p[axis]>=value:p[axis]<=value,aa=inside(a),bb=inside(b);if(aa)out.push(a);if(aa!==bb){const t=(value-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
 const center=clip(clip(outline,0,-half,true),0,half,false);
 for(const poly of [clip(outline,0,-half,false),clip(outline,0,half,true),clip(center,1,top,true),clip(center,1,bottom,false)]){
  if(poly.length<3)continue;const start=positions.length/3,n=poly.length;for(const z of [front,back])for(const [x,y] of poly)positions.push(x,y,z);
  for(let i=1;i<n-1;i++)indices.push(start,start+i,start+i+1,start+n,start+n+i+1,start+n+i);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(start+i,start+j,start+n+i,start+j,start+n+j,start+n+i);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
};
window.createShuttleGarage=(T,{rearZ,bayDeckRear=-.272,storageScaleY=1,storageScaleZ=1})=>{
 const garage=new T.Group();garage.name='bay-forward-arched-lift';
 const shell=new T.Group();shell.name='bay-garage-shell';garage.add(shell);
 const storage=new T.Group();storage.name='bay-garage-storage';garage.add(storage);
 const door=new T.Group();door.name='bay-garage-door';garage.add(door);
 const storedScale=.162/3/3.20*.90,storedInset=.108,extraRearRoom=.100;
 const requiredDepth=storedInset+createClassFShuttle.aftExtent*storedScale*storageScaleZ+extraRearRoom,depth=Math.max(.340,requiredDepth);
 const garageInverse={value:garage.matrixWorld.clone()},garageWorld=garage.matrixWorld.clone(),shadedMaterials=new WeakSet();
 const depthUniforms={garageInverse,garageFront:{value:rearZ},garageDepth:{value:depth}};
 function depthShade(mat){
  if(shadedMaterials.has(mat))return mat;shadedMaterials.add(mat);
  const previous=mat.onBeforeCompile,cacheKey=mat.customProgramCacheKey();
  mat.onBeforeCompile=function(shader,renderer){
   previous.call(this,shader,renderer);Object.assign(shader.uniforms,depthUniforms);
   shader.vertexShader='uniform mat4 garageInverse; varying vec2 vGarageYZ;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvGarageYZ=(garageInverse*modelMatrix*vec4(transformed,1.0)).yz;');
   shader.fragmentShader='uniform float garageFront; uniform float garageDepth; varying vec2 vGarageYZ;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>','float garageRearDistance=garageFront-vGarageYZ.y;\nfloat garageDistance=clamp(garageRearDistance/garageDepth,0.0,1.0);\ngl_FragColor.rgb*=mix(0.65,0.012,smoothstep(0.0,0.82,garageDistance));\nfloat upperRearShadow=smoothstep(-0.003,0.010,vGarageYZ.x)*smoothstep(0.10,0.24,garageRearDistance);\ngl_FragColor.rgb*=mix(1.0,0.12,upperRearShadow);\n#include <tonemapping_fragment>');
  };
  mat.customProgramCacheKey=()=>cacheKey+'-garage-depth-fade-v3';mat.userData.storageDepthFade=true;mat.needsUpdate=true;return mat;
 }
 garage.userData.depthFade={front:rearZ,depth,near:.65,far:.012};
 garage.userData.extraRearClearance=depth-storedInset-createClassFShuttle.aftExtent*storedScale*storageScaleZ;
 const paint=color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.08,roughness:.8,metalness:.1,side:T.DoubleSide});
 const gray=paint(0x69777f),dark=paint(0x172129),metal=paint(0x8c969b),floor=paint(0x2b353e);
 const doorPaint=paint(0x42484a),doorAlternate=paint(0x3b4143);
 const doorSideWall=paint(0x929da1);
 doorPaint.emissiveIntensity=doorAlternate.emissiveIntensity=.04;
 const shadowRoof=paint(0x10171e),shadowBack=paint(0x26313a),shadowPlatform=paint(0x323c45);
 shadowRoof.emissiveIntensity=shadowBack.emissiveIntensity=shadowPlatform.emissiveIntensity=.02;
 const light=color=>new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false}),white=light(0x3b4b58);
 function box(parent,name,x,y,z,w,h,d,material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),depthShade(material));o.name=name;o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=!material.isMeshBasicMaterial;parent.add(o);return o;}
 const deckY=-.0465,ceilingY=.0435,roomHeight=ceilingY-deckY,height=.090*.90,headerY=deckY+height,rowSpacing=.045;
 const thresholdY=hangarDoorProfile().cy+.00003,doorHeight=headerY-thresholdY;
 const doorWidth=createShuttleGarage.doorWidth,roomWidth=.208,roofWidth=.196,wallThickness=.003,platformWidth=roomWidth-wallThickness*2,columnSpacing=.066;
 garage.userData.capacity=6;garage.userData.rackLayout={rows:2,columns:3,rowSpacing,columnSpacing,inset:storedInset};
 box(shell,'garage-floor',0,deckY-.002,rearZ-depth/2,roomWidth,.004,depth,floor);
 // Meet the bay deck at one edge; coplanar overlap here causes flicker
 // around the closed door's bottom seam.
 const thresholdBack=rearZ-.006;
 box(shell,'garage-threshold',0,thresholdY-.00175,(thresholdBack+bayDeckRear)/2,doorWidth,.0035,bayDeckRear-thresholdBack,floor);
 box(shell,'garage-roof',0,ceilingY+.002,rearZ-depth/2,roofWidth,.004,depth,shadowRoof);
 // Chamfer the upper corners instead of pushing a rectangular room through
 // the curved hull. The entrance frame keeps its existing silhouette.
 const section=[[-roomWidth/2,deckY],[roomWidth/2,deckY],[roomWidth/2,.0225],[roofWidth/2,ceilingY+.004],[-roofWidth/2,ceilingY+.004],[-roomWidth/2,.0225]];
 function prism(parent,name,outline,z0,z1,material,cap){
  const p=[],indices=[],n=outline.length;for(const z of [z0,z1])for(const [x,y]of outline)p.push(x,y,z);
  if(cap){for(let i=0;i<cap.length;i+=3)indices.push(cap[i],cap[i+2],cap[i+1],n+cap[i],n+cap[i+1],n+cap[i+2]);}
  else for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
  const o=new T.Mesh(g,depthShade(material));o.name=name;o.receiveShadow=true;o.castShadow=true;parent.add(o);return o;
 }
 prism(shell,'garage-back-wall',section,rearZ-depth+wallThickness/2,rearZ-depth-wallThickness/2,shadowBack);
 for(const side of [-1,1]){
  const outline=[[roomWidth/2,deckY],[roomWidth/2,.0225],[roofWidth/2,ceilingY+.004],[roofWidth/2-wallThickness,ceilingY],[roomWidth/2-wallThickness,.0225],[roomWidth/2-wallThickness,deckY]].map(([x,y])=>[side*x,y]);
  prism(shell,'garage-side-wall-'+side,outline,rearZ,rearZ-depth,dark,[0,1,4,0,4,5,1,2,3,1,3,4]);
  // Cover the bulkhead's full depth and overlap the side pier slightly so
  // their inner/outer faces cannot fight at the edge of the frame.
  box(garage,'garage-door-jamb-'+side,side*(doorWidth/2+.0023),(deckY+headerY)/2,rearZ-.0058,.0046,height+.006,.016,metal);
  // Short wall returns fill the space beside the jambs, outside the opening.
  const returnHeight=height*.80;
  box(garage,'garage-door-side-wall-'+side,side*(doorWidth/2+.009),deckY+returnHeight/2,rearZ+.001,.010,returnHeight,.003,doorSideWall);
  box(shell,'garage-overhead-light-'+side,side*(roofWidth/2-.012),ceilingY-.001,rearZ-depth/2,.003,.001,depth-.020,white);
 }
 box(garage,'garage-door-header',0,headerY+.0025,rearZ,doorWidth+.008,.009,.006,metal);
 const spotlights=[];
 for(const [i,spec] of [
  ...[-1,0,1].map(column=>({position:[column*.078,ceilingY-.005,rearZ-storedInset+.080],target:[column*columnSpacing,.016,rearZ-storedInset+.030],angle:.50,power:.24,role:'top'})),
  ...[-1,1].map(side=>({position:[side*.078,deckY+rowSpacing-.006,rearZ-storedInset+.080],target:[side*columnSpacing/2,deckY+.001,rearZ-storedInset+.025],angle:.50,power:.10,role:'bottom-spot'})),
  {position:[0,deckY+rowSpacing-.006,rearZ-storedInset+.080],target:[0,-.030,rearZ-storedInset+.030],angle:.50,power:.10,role:'bottom-center'}
 ].entries()){
  // Center the housing on its ceiling plane so about half is recessed.
  // Solve the lens height with the original aim point held fixed.
  const mountY=spec.role==='top'?ceilingY:deckY+rowSpacing-.0018,lampPosition=new T.Vector3(...spec.position),targetPosition=new T.Vector3(...spec.target);
  for(let pass=0;pass<5;pass++){const aim=targetPosition.clone().sub(lampPosition).normalize();lampPosition.y=mountY+aim.y*.0035;}
  const lamp=new T.SpotLight(0xffedcf,0,.14,spec.angle,.5,2);lamp.name='garage-spotlight-'+(i+1);lamp.position.copy(lampPosition);lamp.target.position.copy(targetPosition);lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.0025;lamp.shadow.bias=-.00015;lamp.shadow.normalBias=.0006;lamp.shadow.radius=2;lamp.shadow.intensity=.85;lamp.userData.power=spec.power;
  lamp.userData.role=spec.role;lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=true;
  storage.add(lamp,lamp.target);spotlights.push(lamp);
  const direction=targetPosition.clone().sub(lamp.position).normalize(),housing=new T.Mesh(new T.CylinderGeometry(.0036,.0042,.006,16),depthShade(paint(0x273039)));
  housing.name='garage-spotlight-housing-'+(i+1);housing.position.copy(lamp.position).addScaledVector(direction,-.0035);housing.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),direction);storage.add(housing);
  // Keep the buried back inside the ceiling slab rather than letting a
  // lower fixture poke through the upper level's thin walking surface.
  housing.updateMatrix();const housingInverse=housing.matrix.clone().invert(),housingVertices=housing.geometry.attributes.position,backLimit=(spec.role==='top'?ceilingY+.004:deckY+rowSpacing)-.0001;
  for(let vertex=0;vertex<housingVertices.count;vertex++){
   const p=new T.Vector3().fromBufferAttribute(housingVertices,vertex).applyMatrix4(housing.matrix);
   if(p.y>backLimit){p.y=backLimit;p.applyMatrix4(housingInverse);housingVertices.setXYZ(vertex,p.x,p.y,p.z);}
  }
  housingVertices.needsUpdate=true;housing.geometry.computeVertexNormals();
  const lens=new T.Mesh(new T.SphereGeometry(1,16,8),depthShade(light(0xffe7bd)));lens.name='garage-spotlight-lens-'+(i+1);lens.scale.set(.0029,.0006,.0029);lens.position.copy(lamp.position);lens.quaternion.copy(housing.quaternion);storage.add(lens);
 }
 // Sectional panels travel up the jambs and bend onto the garage roof track.
 const panels=[];for(let n=0;n<12;n++){const panel=box(door,'garage-door-panel-'+n,0,0,0,doorWidth,doorHeight/12,.001,n%2?doorAlternate:doorPaint);panels.push(panel);}
 let stocked=false;
 function stock(){
  if(stocked)return;stocked=true;
  const template=createClassFShuttle(T);
  // Stored craft keep their engines off; spotlights pick out their hulls.
  // Clone each shared material once so the flying shuttle keeps its own finish.
  const storedMaterials=new Map();
  template.traverse(o=>{
   if(!o.isMesh)return;
   const shade=original=>{
    if(storedMaterials.has(original))return storedMaterials.get(original);
    const mat=original.clone();
    if(mat.color)mat.color.multiplyScalar(.26);
    if(mat.emissive)mat.emissiveIntensity=0;
    if(mat.isMeshBasicMaterial&&mat.transparent)mat.opacity*=.25;
    depthShade(mat);storedMaterials.set(original,mat);return mat;
   };
   o.material=Array.isArray(o.material)?o.material.map(shade):shade(o.material);
   o.castShadow=(Array.isArray(o.material)?o.material:[o.material]).some(mat=>!mat.transparent||mat.opacity>=.9);o.receiveShadow=true;
   if(o.name==='class-f-rear-window-glow')o.visible=false;
  });
  // At a distance a few solid shapes replace each craft's small fittings.
  // The detailed model remains available for close garage views.
  const distantTemplate=new T.Group(),distantPaint=template.getObjectByName('class-f-body-panel-0').material;distantTemplate.scale.y=template.userData.heightScale;
  function distantPart(geometry,material,x,y,z){const part=new T.Mesh(geometry,material);part.position.set(x,y,z);part.castShadow=part.receiveShadow=true;distantTemplate.add(part);return part;}
  const bodyPositions=[[-1.10,.70,3.40],[1.10,.70,3.40],[-.96,2.10,2.10],[.96,2.10,2.10],[-1.10,.70,-3.40],[1.10,.70,-3.40],[-.96,2.26,-3.10],[.96,2.26,-3.10]];
  const bodyGeometry=new T.BufferGeometry();bodyGeometry.setAttribute('position',new T.Float32BufferAttribute(bodyPositions.flat(),3));bodyGeometry.setIndex([0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3]);bodyGeometry.computeVertexNormals();
  distantPart(bodyGeometry,distantPaint,0,0,0);
  const distantGlass=depthShade(new T.MeshStandardMaterial({color:0x080e18,roughness:.8}));
  for(const x of [-.59,0,.59]){const glass=distantPart(new T.PlaneGeometry(.49,.48),distantGlass,x,1.56,2.603);glass.rotation.x=-Math.atan(1.30/1.40);}
  for(const side of [-1,1]){
   distantPart(new T.BoxGeometry(.58,.14,3.8),distantPaint,side*1.29,.52,-.20);
   const engine=distantPart(new T.CylinderGeometry(.20,.20,4.5,8),distantPaint,side*1.35,.40,-.30);engine.rotation.x=Math.PI/2;
  }
  // Equal red/black diagonal bands retain their angle on the deck surface.
  function warningPaint(width,height){
   const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=Math.max(32,Math.round(2048*height/width));
   const ctx=canvas.getContext('2d'),unit=canvas.width/width,period=.006*unit,black=period/2,slant=height*unit*.65;
   ctx.fillStyle='#ff0000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000000';
   for(let x=-period-slant;x<canvas.width+period;x+=period){ctx.beginPath();ctx.moveTo(x+slant,0);ctx.lineTo(x+slant+black,0);ctx.lineTo(x+black,canvas.height);ctx.lineTo(x,canvas.height);ctx.closePath();ctx.fill();}
   const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
   return depthShade(new T.MeshBasicMaterial({map,side:T.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2}));
  }
  for(let row=0;row<2;row++){
   const y=deckY+row*rowSpacing,platformFront=rearZ-.060;
   const upperMaterials=new Map();
   if(row)box(storage,'garage-upper-platform',0,y-.0009,(platformFront-.002+rearZ-depth)/2,platformWidth,.0018,depth-.062,shadowPlatform);
   if(row)box(storage,'garage-platform-front-'+row,0,y-.00175,platformFront-.001,platformWidth,.0035,.002,shadowPlatform);
   // Keep warning paint on top of each level, along its front edge.
   const safetyLine=new T.Group();safetyLine.name='garage-safety-line-'+row;storage.add(safetyLine);
   const edge=row?platformFront:rearZ+.010,top=row?y:thresholdY,width=row?platformWidth:doorWidth,band=.0035;
   const marking=new T.Mesh(new T.PlaneGeometry(width,band),warningPaint(width,band));marking.name=safetyLine.name+'-red-black-stripes';
   marking.rotation.x=-Math.PI/2;marking.position.set(0,top+.00004,edge-band/2);safetyLine.add(marking);
   for(let col=0;col<3;col++){
    const craft=template.clone(true),scale=storedScale;craft.name='stored-type-f-shuttle-'+(row*3+col+1);craft.scale.set(scale,scale*storageScaleY,scale*storageScaleZ);craft.position.set((col-1)*columnSpacing,y,rearZ-storedInset);craft.userData.storageSlot={row,column:col};
    const detailed=new T.Group();detailed.name='stored-shuttle-detail';for(const child of [...craft.children])detailed.add(child);craft.add(detailed);
    const distant=distantTemplate.clone(true);distant.name='stored-shuttle-distant';distant.visible=false;craft.add(distant);craft.storageDetail=detailed;craft.storageDistant=distant;
    // The upper rack recedes farther into shadow beneath the unlit roof.
    if(row)craft.traverse(o=>{
     if(!o.isMesh)return;
     const shade=original=>{
      if(!upperMaterials.has(original)){const mat=original.clone();if(mat.color)mat.color.multiplyScalar(.45);depthShade(mat);upperMaterials.set(original,mat);}
      return upperMaterials.get(original);
     };
     o.material=Array.isArray(o.material)?o.material.map(shade):shade(o.material);
    });
    storage.add(craft);window.enterpriseHullSurfaceDetail?.prepare(craft);
   }
  }
  for(const x of [-platformWidth/2+.00125,0,platformWidth/2-.00125])box(storage,'garage-platform-support-'+x,x,deckY+rowSpacing/2,rearZ-depth+.015,.0025,rowSpacing,.005,dark);
 }
 garage.setOpen=value=>{
  garage.updateWorldMatrix(true,false);const moved=!garageWorld.equals(garage.matrixWorld);garageWorld.copy(garage.matrixWorld);garageInverse.value.copy(garage.matrixWorld).invert();
  const open=Math.max(0,Math.min(1,value)),eased=open*open*(3-2*open),radius=.008,vertical=ceilingY-thresholdY-radius,arc=radius*Math.PI/2;
  for(const lamp of spotlights){lamp.visible=open>.001;lamp.intensity=lamp.userData.power*eased;if(moved||garage.userData.open!==open)lamp.shadow.needsUpdate=true;}
  for(let n=0;n<panels.length;n++){
   const panel=panels[n],travel=(n+.5)*doorHeight/panels.length+eased*(roomHeight+.015);let y,z,angle;
   if(travel<=vertical){y=thresholdY+travel;z=rearZ-.001;angle=0;}
   else if(travel<vertical+arc){angle=(travel-vertical)/radius;y=ceilingY-radius+radius*Math.sin(angle);z=rearZ-.001-radius*(1-Math.cos(angle));}
   else{angle=Math.PI/2;y=ceilingY;z=rearZ-.001-radius-(travel-vertical-arc);}
   panel.position.set(0,y,z);panel.rotation.x=-angle;
  }
  if(open>0)stock();storage.visible=open>0;garage.userData.open=open;door.userData.open=open;
 };
 garage.setOpen(0);return garage;
};
createShuttleGarage.doorWidth=.132;
