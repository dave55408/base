/* Deep shuttle storage with an overhead sectional door and receding shadows. */
window.createGarageBulkheadGeometry=(T,outline,front,back)=>{
 const half=createShuttleGarage.doorWidth/2,bottom=-.0465,top=bottom+.090*.90,positions=[],indices=[];
 function clip(poly,axis,value,greater){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],inside=p=>greater?p[axis]>=value:p[axis]<=value,aa=inside(a),bb=inside(b);if(aa)out.push(a);if(aa!==bb){const t=(value-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
 const center=clip(clip(outline,0,-half,true),0,half,false);
 for(const poly of [clip(outline,0,-half,false),clip(outline,0,half,true),clip(center,1,top,true),clip(center,1,bottom,false)]){
  if(poly.length<3)continue;const start=positions.length/3,n=poly.length;for(const z of [front,back])for(const [x,y] of poly)positions.push(x,y,z);
  for(let i=1;i<n-1;i++)indices.push(start,start+i,start+i+1,start+n,start+n+i+1,start+n+i);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(start+i,start+j,start+n+i,start+j,start+n+j,start+n+i);}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
};
window.createShuttleGarage=(T,{rearZ,storageScaleY=1,storageScaleZ=1})=>{
 const garage=new T.Group();garage.name='bay-forward-arched-lift';
 const shell=new T.Group();shell.name='bay-garage-shell';garage.add(shell);
 const storage=new T.Group();storage.name='bay-garage-storage';garage.add(storage);
 const door=new T.Group();door.name='bay-garage-door';garage.add(door);
 const storedScale=.162/3/3.20*.90,storedInset=.080,extraRearRoom=.100;
 const requiredDepth=storedInset+createClassFShuttle.aftExtent*storedScale*storageScaleZ+extraRearRoom,depth=Math.max(.340,requiredDepth);
 const garageInverse={value:garage.matrixWorld.clone()},garageWorld=garage.matrixWorld.clone(),shadedMaterials=new WeakSet();
 const depthUniforms={garageInverse,garageFront:{value:rearZ},garageDepth:{value:depth}};
 function depthShade(mat){
  if(shadedMaterials.has(mat))return mat;shadedMaterials.add(mat);
  const previous=mat.onBeforeCompile,cacheKey=mat.customProgramCacheKey();
  mat.onBeforeCompile=function(shader,renderer){
   previous.call(this,shader,renderer);Object.assign(shader.uniforms,depthUniforms);
   shader.vertexShader='uniform mat4 garageInverse; varying float vGarageZ;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvGarageZ=(garageInverse*modelMatrix*vec4(transformed,1.0)).z;');
   shader.fragmentShader='uniform float garageFront; uniform float garageDepth; varying float vGarageZ;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>','float garageDistance=clamp((garageFront-vGarageZ)/garageDepth,0.0,1.0);\ngl_FragColor.rgb*=mix(1.0,0.025,smoothstep(0.04,0.94,garageDistance));\n#include <tonemapping_fragment>');
  };
  mat.customProgramCacheKey=()=>cacheKey+'-garage-depth-fade-v1';mat.userData.storageDepthFade=true;mat.needsUpdate=true;return mat;
 }
 garage.userData.depthFade={front:rearZ,depth,near:1,far:.025};
 garage.userData.extraRearClearance=depth-storedInset-createClassFShuttle.aftExtent*storedScale*storageScaleZ;
 const paint=color=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.24,roughness:.8,metalness:.1,side:T.DoubleSide});
 const gray=paint(0x69777f),dark=paint(0x25333c),metal=paint(0x8c969b),floor=paint(0x46535b);
 const doorPaint=paint(0x242c33),doorAlternate=paint(0x2c353d);
 doorPaint.emissiveIntensity=doorAlternate.emissiveIntensity=.04;
 const shadowRoof=paint(0x10171e),shadowBack=paint(0x26313a),shadowPlatform=paint(0x323c45);
 shadowRoof.emissiveIntensity=shadowBack.emissiveIntensity=shadowPlatform.emissiveIntensity=.02;
 const light=color=>new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false}),white=light(0x3b4b58),yellow=light(0xd6b956);
 function box(parent,name,x,y,z,w,h,d,material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),depthShade(material));o.name=name;o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=!material.isMeshBasicMaterial;parent.add(o);return o;}
 const deckY=-.0465,ceilingY=.0435,roomHeight=ceilingY-deckY,height=roomHeight*.90,headerY=deckY+height;
 const doorWidth=createShuttleGarage.doorWidth,roomWidth=doorWidth*1.35,wallThickness=.003,platformWidth=roomWidth-wallThickness*2,columnSpacing=.072;
 box(shell,'garage-floor',0,deckY-.002,rearZ-depth/2,roomWidth,.004,depth,floor);
 box(shell,'garage-roof',0,ceilingY+.002,rearZ-depth/2,roomWidth,.004,depth,shadowRoof);
 box(shell,'garage-back-wall',0,(deckY+ceilingY)/2,rearZ-depth,roomWidth,roomHeight,wallThickness,shadowBack);
 for(const side of [-1,1]){
  box(shell,'garage-side-wall-'+side,side*(roomWidth-wallThickness)/2,(deckY+ceilingY)/2,rearZ-depth/2,wallThickness,roomHeight,depth,dark);
  box(garage,'garage-door-jamb-'+side,side*(doorWidth/2+.002),(deckY+headerY)/2,rearZ+.0002,.004,height+.006,.004,metal);
  box(shell,'garage-overhead-light-'+side,side*(roomWidth/2-.016),ceilingY-.001,rearZ-depth/2,.003,.001,depth-.020,white);
 }
 box(garage,'garage-door-header',0,headerY+.0025,rearZ,doorWidth+.008,.009,.006,metal);
 const spotlights=[];
 for(const [i,spec] of [
  {position:[-.050,ceilingY-.005,rearZ-.025],target:[-.032,.016,rearZ-.055],angle:.50,power:.24},
  {position:[.050,ceilingY-.005,rearZ-.025],target:[.032,.016,rearZ-.055],angle:.50,power:.24},
  {position:[0,-.0075,rearZ-.015],target:[0,-.029,rearZ-.060],angle:.90,power:.22}
 ].entries()){
  const lamp=new T.SpotLight(0xffedcf,0,.14,spec.angle,.5,2);lamp.name='garage-spotlight-'+(i+1);lamp.position.set(...spec.position);lamp.target.position.set(...spec.target);lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.0025;lamp.shadow.bias=-.00015;lamp.shadow.normalBias=.0006;lamp.shadow.radius=2;lamp.shadow.intensity=.85;lamp.userData.power=spec.power;
  lamp.shadow.autoUpdate=false;lamp.shadow.needsUpdate=true;
  storage.add(lamp,lamp.target);spotlights.push(lamp);
  const direction=new T.Vector3(...spec.target).sub(lamp.position).normalize(),housing=new T.Mesh(new T.CylinderGeometry(.0036,.0042,.006,16),depthShade(paint(0x273039)));
  housing.name='garage-spotlight-housing-'+(i+1);housing.position.copy(lamp.position).addScaledVector(direction,-.0035);housing.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),direction);storage.add(housing);
  const lens=new T.Mesh(new T.SphereGeometry(1,16,8),depthShade(light(0xffe7bd)));lens.name='garage-spotlight-lens-'+(i+1);lens.scale.set(.0029,.0006,.0029);lens.position.copy(lamp.position);lens.quaternion.copy(housing.quaternion);storage.add(lens);
 }
 // Sectional panels travel up the jambs and bend onto the garage roof track.
 const panels=[];for(let n=0;n<12;n++){const panel=box(door,'garage-door-panel-'+n,0,0,0,doorWidth,height/12,.001,n%2?doorAlternate:doorPaint);panels.push(panel);}
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
  for(let row=0;row<2;row++){
   const y=deckY+row*.045;
   const upperMaterials=new Map();
   if(row)box(storage,'garage-upper-platform',0,y-.002,rearZ-depth/2,platformWidth,.004,depth-.005,shadowPlatform);
   box(storage,'garage-platform-front-'+row,0,y-.001,rearZ-.004,platformWidth,.002,.002,yellow);
   for(let col=0;col<2;col++){
    const craft=template.clone(true),scale=storedScale;craft.name='stored-type-f-shuttle-'+(row*2+col+1);craft.scale.set(scale,scale*storageScaleY,scale*storageScaleZ);craft.position.set((col-.5)*columnSpacing,y,rearZ-storedInset);craft.userData.storageSlot={row,column:col};
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
  for(const x of [-platformWidth/2+.00125,0,platformWidth/2-.00125])box(storage,'garage-platform-support-'+x,x,deckY+.0225,rearZ-depth+.015,.0025,.045,.005,dark);
 }
 garage.setOpen=value=>{
  garage.updateWorldMatrix(true,false);const moved=!garageWorld.equals(garage.matrixWorld);garageWorld.copy(garage.matrixWorld);garageInverse.value.copy(garage.matrixWorld).invert();
  const open=Math.max(0,Math.min(1,value)),eased=open*open*(3-2*open),radius=.008,vertical=roomHeight-radius,arc=radius*Math.PI/2;
  for(const lamp of spotlights){lamp.visible=open>.001;lamp.intensity=lamp.userData.power*eased;if(moved||garage.userData.open!==open)lamp.shadow.needsUpdate=true;}
  for(let n=0;n<panels.length;n++){
   const panel=panels[n],travel=(n+.5)*height/panels.length+eased*(roomHeight+.015);let y,z,angle;
   if(travel<=vertical){y=deckY+travel;z=rearZ-.001;angle=0;}
   else if(travel<vertical+arc){angle=(travel-vertical)/radius;y=ceilingY-radius+radius*Math.sin(angle);z=rearZ-.001-radius*(1-Math.cos(angle));}
   else{angle=Math.PI/2;y=ceilingY;z=rearZ-.001-radius-(travel-vertical-arc);}
   panel.position.set(0,y,z);panel.rotation.x=-angle;
  }
  if(open>0)stock();storage.visible=open>0;garage.userData.open=open;door.userData.open=open;
 };
 garage.setOpen(0);return garage;
};
createShuttleGarage.doorWidth=.132;
