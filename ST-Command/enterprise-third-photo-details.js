/* Visible photo features in model units. Hidden hull side uses symmetry. */
window.applyThirdPhotoDetails=(T,model,maps,options)=>{
 const group=new T.Group();group.name='third-photo-details';model.add(group);
 const records=[],batches=new Map(),shape=EnterpriseThirdGeometry.shape(),primary=model.getObjectByName('reference-saucer-assembly');
 const mat=(color,lit=false)=>new T.MeshStandardMaterial({color,emissive:lit?color:0x000000,emissiveIntensity:lit?1.7:0,roughness:lit?.38:.72,metalness:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const materials={warm:mat(0xffdfb0,true),green:mat(0x76efac,true),red:mat(0xff3548,true),dim:mat(0xd49a75,true),dark:mat(0x19201f),paint:mat(0xa52c3d)};
 function mapped(map){return new T.MeshStandardMaterial({color:0xffffff,map,transparent:true,depthWrite:false,roughness:.65,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});}
 materials.pennant=mapped(maps.pennant);materials.portPennant=mapped(maps.portPennant);materials.serial=mapped(maps.hullStencils);
 function patch(id,sample,key,{round=false,cols=8,rows=4,uv=(u,v)=>[u,1-v],...data}={}){
  // Current appearance uses Model Two's paint and no small window meshes.
  // Top pylon panels are supplied by the base renderer, without extra slots.
  if(['engineering','neck','bridge','rim','bowl','pylon','pennant'].includes(data.region))return;
  if(round){cols=24;rows=3;}
  let batch=batches.get(key);if(!batch)batches.set(key,batch={positions:[],uv:[],indices:[]});const start=batch.positions.length/3;
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
   const u=col/cols,v=row/rows;
   const [a,b]=round?[.5+.5*v*Math.cos(u*Math.PI*2),.5+.5*v*Math.sin(u*Math.PI*2)]:[u,v];
   batch.positions.push(...sample(a,b));batch.uv.push(...uv(a,b));
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const a=start+row*(cols+1)+col,b=a+cols+1;batch.indices.push(a,a+1,b,a+1,b+1,b);}
  records.push({id,material:key,lit:['warm','green','red','dim'].includes(key),round,...data});
 }
 function hull(side,y,z,lift=.0005){
  const level=(z+.032)/.85,r=shape.radiusAt(level),extent=y>=0?shape.upAt(level,0):shape.downAt(level,0);
  let x=r*Math.sqrt(Math.max(0,1-(y/extent)**2));
  if(options&&level>=options.padStart&&level<=options.padEnd&&Math.abs(y+.022)<=.030)x=Math.max(x,options.padFace(y+.022,level,side*Math.PI/2));
  return [side*(x+lift),y,z+.032];
 }
 function primaryPoint(x,y,z){primary.updateWorldMatrix(true,false);model.updateWorldMatrix(true,false);const p=new T.Vector3(x,y,z);primary.localToWorld(p);model.worldToLocal(p);return p.toArray();}
 function radius(profile,y){for(let i=1;i<profile.length;i++){const [a,ya]=profile[i-1],[b,yb]=profile[i];if(yb!==ya&&y>=Math.min(ya,yb)&&y<=Math.max(ya,yb))return a+(b-a)*(y-ya)/(yb-ya);}return profile.at(-1)[0];}
 // [station Z, height Y, shape, state/color, width, height]. The staggered
 // foreground group comes from photos 4/6; the aft group from photos 1/2.
 const hullWindows=[
  [-.087,.068,'round','warm',.005,.005],[-.140,.038,'round','warm',.005,.005],[-.185,.038,'round','warm',.005,.005],
  [-.068,.003,'rect','green',.020,.009],[-.115,.003,'rect','warm',.020,.009],[-.155,.003,'round','warm',.005,.005],
  [-.125,-.070,'round','warm',.006,.006],[-.200,-.080,'round','dim',.006,.004],
  ...[-.280,-.320,-.370,-.414,-.460,-.505].map((z,i)=>[z,-.064+(i%2)*.001,'rect','dark',i===2?.018:.013,.0055]),
  [-.478,.031,'rect','dark',.017,.007],
  [-.518,.032,'rect','warm',.020,.0075],[-.552,.031,'rect','warm',.019,.007],[-.590,.033,'rect','warm',.019,.0075],[-.629,.032,'rect','warm',.020,.008],
  [-.545,.065,'rect','warm',.021,.007],[-.666,.092,'rect','warm',.021,.007],[-.746,.110,'rect','warm',.021,.007],[-.744,.060,'rect','warm',.022,.008],
  [-.711,.092,'round','warm',.005,.005],[-.819,.092,'round','warm',.005,.005],[-.846,.092,'round','warm',.005,.005],[-.873,.130,'round','warm',.004,.004],
  [-.558,-.064,'rect','warm',.018,.007],
  [-.624,-.090,'rect','warm',.021,.008],[-.676,-.090,'round','warm',.005,.005],[-.690,-.128,'rect','warm',.019,.006]
 ];
 for(const side of [-1,1]){
  const name=side>0?'starboard':'port';
  hullWindows.forEach(([z,y,form,color,w,h],i)=>{
   if(i===6)patch(name+'-aft-port-rim',(u,v)=>hull(side,y+(.5-v)*.010,z+(u-.5)*.010),'dark',{round:true,region:'engineering',side});
   patch(name+'-hull-window-'+i,(u,v)=>hull(side,y+(.5-v)*h,z+(u-.5)*w),color,{round:form==='round',region:'engineering',side,z,y,width:w,height:h});
  });
  patch(name+'-photo-pennant',(u,v)=>hull(side,-.026+(.5-v)*.068,side>0?-.240-u*.780:-1.020+u*.780,.0007),side>0?'pennant':'portPennant',{cols:80,rows:12,region:'pennant',side,aft:-.240,front:-1.020});
  const stencils=[['1837',-.085,-.050],['1384',-.290,-.047],['705',-.580,-.116],['102',-.965,-.116]];
  stencils.forEach(([label,z,y],i)=>patch(name+'-stencil-'+label,(u,v)=>hull(side,y+(.5-v)*.019,z+(u-.5)*.022,.00065),'serial',{region:'stencil',side,label,uv:(u,v)=>[(i+(side>0?u:1-u))/4,1-v]}));
  // Normalized against the neck's slanted edges, excluding glass reflections.
  // Each tuple: height fraction, fore/aft fraction, shape, state, width, height.
  const neckWindows=[
   [.80,.26,'rect','dark',.012,.006],[.78,.54,'round','warm',.0045,.0045],[.79,.76,'rect','dark',.012,.006],
   [.65,.20,'rect','warm',.014,.007],[.67,.43,'round','warm',.0045,.0045],[.66,.60,'round','warm',.0045,.0045],
   ...[.28,.40,.52,.64,.76,.87].map((u,i)=>[.53,u,'rect',i===0?'dark':'warm',.016,.0065]),
   [.38,.19,'round','warm',.005,.005],[.36,.39,'rect','warm',.015,.007],[.37,.66,'rect','warm',.013,.006],
   [.24,.27,'round','warm',.0045,.0045],[.24,.52,'rect','dark',.013,.006],[.24,.69,'rect','warm',.014,.007],
   [.13,.43,'rect','dark',.012,.0055],[.13,.58,'rect','warm',.013,.006]
  ];
  function neckPoint(u,v,wide,high,t,along){
   const y=.11+t*.25+(.5-v)*high,ty=Math.max(0,Math.min(1,(y-.11)/.25));
   const front=-.87-.29*ty,back=-.54-.28*ty,z=back+(front-back)*along+(u-.5)*wide;
   // Match the actual loft rings, rather than an approximate flat decal plane.
   const levels=[.103,.11,.12,.14,.18,.24,.30,.34,.355,.363];let width=.034;
   for(let i=1;i<levels.length;i++)if(y>=levels[i-1]&&y<=levels[i]){
    const at=h=>{const a=Math.max(0,Math.min(1,(h-.11)/.25));return .034+.007*(Math.exp(-((a/.13)**2))+Math.exp(-(((1-a)/.13)**2)));};
    width=at(levels[i-1])+(at(levels[i])-at(levels[i-1]))*(y-levels[i-1])/(levels[i]-levels[i-1]);break;
   }
   return [side*(width+.0004),y,z];
  }
  neckWindows.forEach(([t,along,form,color,w,h],i)=>patch(name+'-neck-window-'+i,(u,v)=>neckPoint(u,v,w,h,t,along),color,{round:form==='round',region:'neck',side,heightFraction:t,alongFraction:along}));
  const strut=model.getObjectByName(name+'-engine-strut'),length=strut.geometry.parameters.height;
  for(const [i,fraction]of [.18,.26].entries())patch(name+'-pylon-slot-'+i,(u,v)=>{
   const local=new T.Vector3(side*.020,(fraction-.5)*length+(.5-v)*.0045,(u-.5)*.018);
   const nx=Math.abs(local.x)/.020,nz=Math.abs(local.z)/.0535,rounded=Math.min(1,1/(nx**6+nz**6)**(1/6));
   local.x=local.x*rounded+side*.00035;local.z*=rounded;strut.localToWorld(local);
   const t=Math.max(0,Math.min(1,(local.y-.085)/.370));local.z=-.293+(local.z+.293)*(1.06-.15*t)+.012*(1-t)-.008*t;
   model.worldToLocal(local);return local.toArray();
  },'dark',{region:'pylon',side,station:fraction});
 }
 const deckProfile=EnterpriseThirdGeometry.smoothProfile([[.192,0],[.191,.0134],[.186,.0279],[.177,.0436],[.162,.0525],[.135,.057],[0,.057]]);
 function deck(theta,y){const r=radius(deckProfile,y)+.00035,x=Math.sin(theta)*r,z=Math.cos(theta)*r;return primaryPoint(x*.72,.456+y*1.05,-1.53+(z+.14*Math.max(0,z/r)**4*(r/.192)**1.5)*.735);}
 const deckFeatures=[...[-.34,-.11,.11,.34].map(a=>[Math.PI+a,.037,'rect',.015,.0045])];
 // Keep the established forward row; the flanks use the shared photo pattern.
 deckFeatures.forEach(([a,y,form,w,h],i)=>patch('bridge-deck-window-'+i,(u,v)=>deck(a+(u-.5)*w/.135,y+(.5-v)*h+.00025),'warm',{round:form==='round',region:'bridge'}));
 function rim(theta,y){const r=.650+(.680-.650)*(y+.022)/.044+.00045;return primaryPoint(Math.sin(theta)*r,.380+y,-1.53+Math.cos(theta)*r);}
 // Single replacement layout from the latest side view. No earlier forward
 // or lateral window clusters are retained on the saucer rim or lower bowl.
 const primaryRim=[
  [-.12,.004,'rect','warm',.017,.006],[-.04,.004,'rect','warm',.019,.006],
  [.04,.004,'rect','warm',.021,.006],[.12,.004,'rect','warm',.021,.006],
  [-.18,-.006,'round','warm',.0045,.0045],[.22,-.004,'round','warm',.0045,.0045],
  [-.07,-.009,'round','warm',.0045,.0045],
  [-.26,.003,'rect','dark',.013,.005],[.30,.003,'rect','dark',.013,.005]
 ];
 for(const side of [-1,1])primaryRim.forEach(([offset,y,form,color,w,h],i)=>{
  const angle=Math.PI+side*(Math.PI/2+.10+offset*2);
  patch('upper-dome-side-'+side+'-'+i,(u,v)=>deck(angle+(u-.5)*w*.65/.135,.030+y+(.5-v)*h*.85+.00025),color,{round:form==='round',region:'bridge',side,layout:'saucer-pattern',angle,level:.030+y});
 });
 for(const side of [-1,1])primaryRim.forEach(([offset,y,form,color,w,h],i)=>{
  const angle=Math.PI+side*(Math.PI/2+.26+offset);
  patch('primary-rim-'+side+'-'+i,(u,v)=>rim(angle+(u-.5)*w/.666,y+(.5-v)*h),color,{round:form==='round',region:'rim',side,layout:'replacement-1',angle,level:y});
 });
 const bowlProfile=EnterpriseThirdGeometry.smoothProfile([[0,-.095],[.065,-.095],[.125,-.089],[.17,-.073],[.22,-.043],[.275,-.010],[.29,0]]);
 function bowl(theta,y){const r=radius(bowlProfile,y)+.00045;return primaryPoint(Math.sin(theta)*r,.353+y,-1.53+Math.cos(theta)*r);}
 const primaryBowl=[
  ...[-.14,-.02,.10,.22].map(a=>[a,-.014,'rect','warm']),[-.27,-.014,'rect','dark'],
  [-.18,-.036,'round','warm'],[-.04,-.039,'rect','dark'],
  [.10,-.044,'rect','warm'],[.22,-.044,'rect','warm'],
  [-.09,-.065,'rect','warm'],[.04,-.065,'rect','warm'],
  [.17,-.067,'rect','dark'],[.32,-.061,'round','warm']
 ];
 for(const side of [-1,1])primaryBowl.forEach(([offset,y,form,color],i)=>{
  const angle=Math.PI+side*(Math.PI/2+.24+offset),w=form==='round'?.0045:.011,h=form==='round'?.0045:.004;
  patch('primary-bowl-'+side+'-'+i,(u,v)=>bowl(angle+(u-.5)*w/radius(bowlProfile,y),y+(.5-v)*h),color,{round:form==='round',region:'bowl',side,layout:'replacement-1',level:y,angle});
 });
 function roof(x,z){const level=(z+.032)/.85;return [x,shape.upAt(level,x)+.00045,z+.032];}
 for(const side of [-1,1])patch('engineering-spine-red-line-'+side,(u,v)=>roof(side*.008+(u-.5)*.0008,-.12-v*.51),'paint',{region:'spine'});
 for(const z of [-.12,-.63])patch('engineering-spine-red-end-'+z,(u,v)=>roof((u-.5)*.016,z+(v-.5)*.0008),'paint',{region:'spine'});
 for(const z of [-.101,-.131])patch('engineering-roof-green-'+z,(u,v)=>roof((u-.5)*.003,z+(v-.5)*.003),'green',{round:true,region:'roof'});
 function post(name,x,y,z,color,r=.002,height=.004){
  const mesh=new T.Mesh(new T.SphereGeometry(r,16,12),materials[color]);mesh.scale.y=height/(2*r);mesh.position.set(x,y,z);mesh.name=name;group.add(mesh);records.push({id:name,region:'beacon',lit:true,material:color});
 }
 post('engineering-roof-red-beacon',0,shape.upAt((-.116+.032)/.85,0)+.003,-.116+.032,'red');
 const bridgePost=new T.Vector3(0,.534,-1.590);primary.localToWorld(bridgePost);model.worldToLocal(bridgePost);post('bridge-front-red-beacon',...bridgePost.toArray(),'red',.0018,.004);
 const lowerPost=new T.Vector3(0,.220,-1.530);primary.localToWorld(lowerPost);model.worldToLocal(lowerPost);post('lower-sensor-red-beacon',...lowerPost.toArray(),'red',.0015,.003);
 for(const side of ['port','starboard']){
  const vertical=model.getObjectByName(side+'-hangar-yellow-light'),horizontal=model.getObjectByName(side+'-hangar-red-light');
  vertical.material=materials.red;vertical.name=side+'-hangar-red-vertical-light';horizontal.material=materials.red;
 }
 model.getObjectByName('hangar-upper-yellow-light').material=materials.warm;
 const beacon=model.getObjectByName('shuttle-bay-green-light');beacon.material=beacon.material.clone();beacon.material.color.setHex(0x35a97c);beacon.material.emissive.setHex(0x168c50);beacon.material.emissiveIntensity=.65;
 for(const [key,batch]of batches){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(batch.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(batch.uv,2));geometry.setIndex(batch.indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,materials[key]);mesh.name='photo-'+key+'-details';mesh.renderOrder=3;mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
 }
 group.userData={reference:maps.markingReference,revision:2,hiddenSide:'mirrored approximation',placement:'Estimated from structural landmarks through display glass',features:records};
 model.userData.photoDetails={revision:2,primaryHullLayout:'no-small-windows',appearance:'model-two-without-windows',featureCount:records.length,lit:records.filter(r=>r.lit).length,unlit:records.filter(r=>r.material==='dark').length};
 return group;
};
