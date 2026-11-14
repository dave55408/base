/* Wall fittings based on the supplied hangar interior reference. */
// The room nearest the bay mouth stops behind the existing door return.
window.shuttleBaySideDoorLayout=()=>[-.229,-.151,-.073,-.0333].map((z,n)=>({z,length:n<2?.058:n===2?.032:.028}));
// The gray deck ends halfway from the red boundary to the last jamb.
window.shuttleBayFloorFront=()=>{const last=shuttleBaySideDoorLayout().at(-1);return (hangarDoorProfile().roofFront+last.z+.011*1.18)/2;};
// Leave real cavities in the structural wall behind the fitted doorways.
window.createShuttleBaySideWallGeometry=(T,{y,z,width,height,length})=>{
 // Recess every structural reveal beyond the room surfaces. Coplanar
 // end walls fight the room walls just like caps fight floors/ceilings.
 const clearance=.0003;
 const positions=[],normals=[],uvs=[],bottom=y-height/2,top=y+height/2,front=z+length/2,rear=z-length/2,deck=-.04645-clearance,lintel=-.0205+clearance;
 function slab(a,b,lo,hi){
  if(b<=a||hi<=lo)return;
  const g=new T.BoxGeometry(width,hi-lo,b-a).toNonIndexed();g.translate(0,(lo+hi)/2-y,(a+b)/2-z);
  positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);uvs.push(...g.attributes.uv.array);g.dispose();
 }
 // The raised observation booth occupies the mouth end of the upper wall.
 // Keep its backing below the booth rather than intersecting its end panel.
 const boothRear=-.0433,boothBottom=-.0103;
 slab(rear,Math.min(front,boothRear),lintel,top);
 slab(Math.max(rear,boothRear),front,lintel,Math.min(top,boothBottom));
 slab(rear,front,bottom,Math.min(deck,top));
 let cursor=rear;
 for(const door of shuttleBaySideDoorLayout()){
  const a=Math.max(rear,door.z-door.length/2-clearance),b=Math.min(front,door.z+door.length/2+clearance);
  slab(cursor,a,Math.max(bottom,deck),lintel);cursor=Math.max(cursor,b);
 }
 slab(cursor,front,Math.max(bottom,deck),lintel);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));return g;
};
window.cutShuttleBaySideWall=(T,wall)=>{
 const p=wall.geometry.parameters,geometry=createShuttleBaySideWallGeometry(T,{y:wall.position.y,z:wall.position.z,width:p.width,height:p.height,length:p.depth});wall.geometry.dispose();wall.geometry=geometry;return wall;
};
window.addShuttleBayWalls=(T,room,{rearZ,fitDoorShoulders})=>{
 const walls=new T.Group();walls.name='reference-bay-walls';room.add(walls);
 const paint=(color,emission=.12)=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:emission,roughness:.84,metalness:.08,side:T.DoubleSide});
 // A small ceiling-and-wall environment gives every pane a view-dependent
 // silver reflection without rendering another scene for each window.
 const reflectionCanvas=document.createElement('canvas');reflectionCanvas.width=512;reflectionCanvas.height=256;
 const reflection=reflectionCanvas.getContext('2d');reflection.fillStyle='#383d3e';reflection.fillRect(0,0,512,256);
 const wallReflection=reflection.createLinearGradient(0,100,0,204);wallReflection.addColorStop(0,'#bbc6c8');wallReflection.addColorStop(.35,'#718187');wallReflection.addColorStop(.65,'#a1adb0');wallReflection.addColorStop(1,'#263238');
 reflection.fillStyle=wallReflection;reflection.fillRect(0,100,512,104);
 reflection.fillStyle='#dbe4e4';reflection.fillRect(0,0,512,112);
 reflection.strokeStyle='#263236';reflection.lineWidth=5;
 for(let x=0;x<=512;x+=32){reflection.beginPath();reflection.moveTo(x,0);reflection.lineTo(x,112);reflection.stroke();}
 for(const y of [28,56,84,110]){reflection.beginPath();reflection.moveTo(0,y);reflection.lineTo(512,y);reflection.stroke();}
 // Opposite-wall frames, console panes and deck rails break up the silver
 // reflection so the glass reads as a mirror even from inside the bay.
 for(let x=0;x<512;x+=64){
  reflection.fillStyle='#c4ced0';reflection.fillRect(x,112,3,80);
  reflection.fillStyle='#303f47';reflection.fillRect(x+8,126,46,23);
  reflection.fillStyle='#8a9ca2';reflection.fillRect(x+10,128,42,2);
  reflection.fillStyle='#d3dcda';reflection.fillRect(x+9,157,45,3);
  reflection.fillStyle='#1c292f';reflection.fillRect(x+20,170,24,27);
 }
 reflection.fillStyle='#b4bfc0';reflection.fillRect(0,202,512,3);
 const mirrorEnvironment=new T.CanvasTexture(reflectionCanvas);mirrorEnvironment.colorSpace=T.SRGBColorSpace;
 mirrorEnvironment.mapping=303; // Three.js EquirectangularReflectionMapping.
 const gray=paint(0x989c9d),bezel=paint(0xaaafb0),cabinet=paint(0x929798),tan=paint(0x85867f),lowerTan=paint(0x8a8b83,.09),black=paint(0x161a1c,.025),glass=new T.MeshStandardMaterial({color:0xe2e7e9,metalness:1,roughness:.025,envMap:mirrorEnvironment,envMapIntensity:1.6,side:T.DoubleSide});
 // Fine grain is anchored to the metal geometry, including the custom
 // booth faces without UVs. Fade subpixel grain to avoid distant shimmer.
 function metalGrain(material){
  material.userData.bayMetalGrain=true;
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBayMetalPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBayMetalPosition=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vBayMetalPosition;
    float bayMetalHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
   `).replace('#include <color_fragment>',`#include <color_fragment>
    vec3 bayGrainPosition=vBayMetalPosition*6000.0;
    float bayGrainFootprint=max(length(dFdx(bayGrainPosition)),length(dFdy(bayGrainPosition)));
    float bayGrainVisibility=1.0-smoothstep(0.7,2.0,bayGrainFootprint);
    float bayMetalGrain=(bayMetalHash(floor(bayGrainPosition))-.5)*bayGrainVisibility;
    float bayBrush=(bayMetalHash(floor(vBayMetalPosition*vec3(600.0,9000.0,600.0)))-.5)*bayGrainVisibility;
    diffuseColor.rgb*=1.0+bayMetalGrain*.12+bayBrush*.025;
   `).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+bayMetalGrain*.06,0.0,1.0);');
  };
  material.customProgramCacheKey=()=> 'bay-metal-grain-v1';return material;
 }
 metalGrain(cabinet);metalGrain(bezel);const boothMetal=metalGrain(gray.clone());
 glass.userData.mirroredBayWindow=true;
 const darkGray=paint(0x46494a,.10);
 const glow=color=>new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false});
 const cyan=glow(0x8bc8cc),yellow=glow(0xd7dc68),green=glow(0x81f49b),red=glow(0xe43d36),white=glow(0xdde7df);
 // Match the aft landing lamps' luminous lens, dark bezel and soft halo.
 const lensCanvas=document.createElement('canvas');lensCanvas.width=lensCanvas.height=64;const lensContext=lensCanvas.getContext('2d'),lensGradient=lensContext.createLinearGradient(0,0,0,64);
 for(const [stop,color]of [[0,'#454545'],[.25,'#b0b0b0'],[.48,'#ffffff'],[.64,'#dadada'],[1,'#505050']])lensGradient.addColorStop(stop,color);
 lensContext.fillStyle=lensGradient;lensContext.fillRect(0,0,64,64);const lampLensMap=new T.CanvasTexture(lensCanvas);lampLensMap.colorSpace=T.SRGBColorSpace;
 const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;const haloContext=haloCanvas.getContext('2d'),haloGradient=haloContext.createRadialGradient(64,64,0,64,64,64);
 for(const [stop,color]of [[0,'rgba(255,255,255,.95)'],[.28,'rgba(255,255,255,.65)'],[.6,'rgba(255,255,255,.18)'],[1,'rgba(255,255,255,0)']])haloGradient.addColorStop(stop,color);
 haloContext.fillStyle=haloGradient;haloContext.fillRect(0,0,128,128);const lampHaloMap=new T.CanvasTexture(haloCanvas);
 const lampBezel=new T.MeshStandardMaterial({color:0x283a40,roughness:.6,metalness:.5,side:T.DoubleSide});
 const wallRear=rearZ+.00665,wallFront=-.0183,wallCenter=(wallRear+wallFront)/2,wallLength=wallFront-wallRear,floor=-.04645;
 function mesh(g,m,name){const o=new T.Mesh(g,m);o.name=name;o.receiveShadow=true;walls.add(o);return o;}
 function box(name,x,y,z,w,h,d,m){const o=mesh(new T.BoxGeometry(w,h,d),m,name);o.position.set(x,y,z);return o;}
 function quad(name,points,m){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return mesh(g,m,name);}
 function prism(name,section,z0,z1,m){
  const p=[],indices=[],n=section.length;for(const z of [z0,z1])for(const [x,y] of section)p.push(x,y,z);
  for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);const faces=g.toNonIndexed();g.dispose();faces.computeVertexNormals();return mesh(faces,m,name);
 }
 function panelRing(name,outer,inner,m){for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;quad(name+'-frame-'+i,[outer[i],outer[j],inner[j],inner[i]],m);}}
 for(const side of [-1,1]){
  const prefix=side<0?'port':'starboard',edgeAngle=.315,edgeY=.008+Math.sin(edgeAngle)*.069;
  const ceilingEdge=fitDoorShoulders?Math.min(Math.cos(edgeAngle)*.081,.083*Math.sqrt(1-((edgeY+.043)/.130)**2)-.002):Math.cos(edgeAngle)*.081;
  const ventX=ceilingEdge+.0005;
  // Broad taupe panels sit behind the projecting gray console cabinets.
  // Continue the backing down to the trim so the raised room ends do not
  // expose small gray structural tabs through the gaps between cabinets.
  quad(prefix+'-bay-upper-infill',[[side*.0808,-.01425,wallRear],[side*.0808,-.01425,-.0433],[side*.0808,.0222,-.0433],[side*.0808,.0222,wallRear]],tan);
  // Each fitting returns independently into the hull; leave the gap below
  // the booth open instead of hiding the ends behind a full-height tan cap.
  const fittingBack=.100;
  // Split the lower wall around all four tapered access openings.
  box(prefix+'-bay-lower-wall',side*(.0802+fittingBack)/2,(-.0205-.016)/2,wallCenter,fittingBack-.0802,.0045,wallLength,lowerTan);
  let lowerCursor=wallRear;
  for(const {z} of shuttleBaySideDoorLayout()){
   const a=z-.011,b=z+.011;
   box(prefix+'-bay-lower-wall-pier-'+z,side*.0808,(floor-.0205)/2,(lowerCursor+a)/2,.0012,-.0205-floor,a-lowerCursor,lowerTan);
   for(const direction of [-1,1])quad(prefix+'-bay-door-shoulder-'+z+'-'+direction,[[side*.0808,floor,z+direction*.011],[side*.0808,-.0205,z+direction*.011],[side*.0808,-.0205,z+direction*.0075],[side*.0808,floor,z+direction*.011]],lowerTan);
   lowerCursor=b;
  }
  box(prefix+'-bay-lower-wall-end',side*.0808,(floor-.0205)/2,(lowerCursor+wallFront)/2,.0012,-.0205-floor,wallFront-lowerCursor,lowerTan);
  // Four horizontal slots in each grille module, with visible gray dividers.
  box(prefix+'-bay-vent-rail',side*(ventX+.001),.0252,wallCenter,.004,.0072,wallLength,gray);
  for(let n=0;n<8;n++){
   const z0=wallRear+n*wallLength/8+.0012,z1=wallRear+(n+1)*wallLength/8-.0012;
   for(let row=0;row<4;row++)box(prefix+'-bay-vent-'+n+'-'+row,side*(ventX-.00115),.0228+row*.00135,(z0+z1)/2,.0003,.00065,z1-z0,black);
  }
  const trimEnd=shuttleBaySideDoorLayout().at(-1).z+.0075*1.18;
  box(prefix+'-bay-console-rail',side*(.07195+fittingBack)/2,-.016,(wallRear+trimEnd)/2,fittingBack-.07195,.0035,trimEnd-wallRear,boothMetal);
  const faceTop=.009,frontX=.0723;
  const facePoint=(y,z,depth=.0004)=>[side*(frontX-depth),y,z];
  function faceRect(name,yl,yh,zl,zh,m,depth=.0004){return quad(name,[facePoint(yl,zl,depth),facePoint(yl,zh,depth),facePoint(yh,zh,depth),facePoint(yh,zl,depth)],m);}
  // Build parallel wall faces here, then rake the entire fitted surface
  // inward together below, including the screens, trim and door jambs.
  for(let n=0;n<3;n++){
   const z0=-.262+n*.078,z1=n===2?-.0465:z0+.066;
   // Close the aft end against the bulkhead and carry the room sides into
   // the hull, so raising the rooms cannot expose gaps behind their ends.
   const cabinetStart=n===0?wallRear:z0;
   prism(prefix+'-bay-console-'+n,[[side*frontX,-.017],[side*frontX,faceTop],[side*fittingBack,faceTop],[side*fittingBack,-.017]],cabinetStart,z1,cabinet);
   for(let screen=0;screen<2;screen++){
    const za=z0+.006+screen*.028,zb=za+.025,yl=-.0044,yh=.0065;
    const outer=[facePoint(yl,za,.00055),facePoint(yl,zb,.00055),facePoint(yh,zb,.00055),facePoint(yh,za,.00055)];
    const inner=[facePoint(yl+.0012,za+.0013,.00030),facePoint(yl+.0012,zb-.0013,.00030),facePoint(yh-.0012,zb-.0013,.00030),facePoint(yh-.0012,za+.0013,.00030)];
    panelRing(prefix+'-bay-console-bezel-'+n+'-'+screen,outer,inner,bezel);
    quad(prefix+'-bay-console-screen-'+n+'-'+screen,inner,glass);
   }
   const keys=[cyan,cyan,white,yellow,green,green,cyan,yellow];
   // Keep each window's original indicator span, with two close pairs
   // anchored at its ends and an open space between the pairs.
   const keyOffsets=[0,.0042,.0162,.0204];
   for(let k=0;k<keys.length;k++){const windowIndex=Math.floor(k/4),z=z0+.008+windowIndex*.0272+keyOffsets[k%4];faceRect(prefix+'-bay-key-'+n+'-'+k,-.0085,-.0068,z,z+.0026,keys[k],.0007);}
   // Short vertical channels emphasize the cast cabinet end sections.
   for(let k=0;k<2;k++)box(prefix+'-bay-console-end-grille-'+n+'-'+k,side*(frontX-.0005),-.003,z0+.002+k*.0017,.0004,.013,.0007,darkGray);
  }
  for(const [n,{z}] of shuttleBaySideDoorLayout().entries()){
   // Straight, level lintels and symmetric jambs: narrower at the top.
   const section=[[floor,z-.011],[-.0205,z-.0075],[-.0205,z+.0075],[floor,z+.011]],yc=(floor-.0205)/2;
   const outer=section.map(([y,a])=>[side*.0778,Math.max(floor,yc+(y-yc)*1.15),z+(a-z)*1.18]),inner=section.map(([y,a])=>[side*.0799,y,a]);
   panelRing(prefix+'-bay-side-door-'+n,outer,inner,gray);
   // Solid gray returns connect the projecting rim to the sloped wall.
   // The bottom edge rests on the deck; it needs no overlapping floor face.
   const backOuter=outer.map(([x,y,a])=>[side*.0811,y,a]);
   for(let edge=0;edge<3;edge++){
    // The last jamb's outer return is already part of the solid end wall.
    // A second face here produces a flickering line along the doorway edge.
    if(n===3&&edge===2)continue;
    quad(prefix+'-bay-side-door-'+n+'-return-'+edge,[outer[edge],backOuter[edge],backOuter[edge+1],outer[edge+1]],gray);
   }
   if(n===3){
    // Close the wedge ahead of the frontmost jamb and return its end into
    // the entrance throat, rather than leaving a view behind the fittings.
    const endZ=wallFront+.001;
    const face=[outer[3],outer[2],[side*.0778,outer[2][1],endZ],[side*.0778,floor,endZ]];
    const back=face.map(([x,y,a])=>[side*fittingBack,y,a]),g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([...face,...back].flat(),3));
    g.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,3,7,4,3,4,0]);
    const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();
    mesh(flat,gray,prefix+'-bay-entrance-corner-infill');
   }
   // Meet the jamb corners exactly and stop at the underside of the rail.
   const headerBottom=outer[1][1],headerTop=-.01775;
   box(prefix+'-bay-door-header-'+n,side*.07945,(headerBottom+headerTop)/2,z,.0033,headerTop-headerBottom,outer[2][2]-outer[1][2],gray);
   if(n<3){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#a8aea4';c.fillRect(0,0,384,96);c.fillStyle='#27343b';c.font='bold 42px Arial';c.textAlign='center';c.fillText('ACCESS 0'+(n+1),192,64);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const plate=new T.MeshStandardMaterial({color:0xffffff,map:texture,roughness:.9,side:T.DoubleSide});
    quad(prefix+'-bay-door-nameplate-'+n,[[side*.0792,-.028,z-.032],[side*.0792,-.028,z-.018],[side*.0792,-.0245,z-.018],[side*.0792,-.0245,z-.032]],plate);
   }
   if(n===1)box(prefix+'-bay-wall-utility-box',side*.077,hangarDoorProfile().cy+.003,z-.025,.005,.006,.010,gray);
  }
  // Compact launch booths terminate the console banks beside the bay mouth.
  // Their tapered faces project inward; existing wall and cabinet sizes stay fixed.
  const booth=prefix+'-bay-launch-booth';
  // Seat the solid end in front of the backing wall ends, preventing their
  // edges from cutting through the filled observation-booth side panel.
  prism(booth+'-housing',[[side*.064,-.020],[side*.064,-.011],[side*.072,.014],[side*fittingBack,.014],[side*fittingBack,-.020]],-.043,wallFront+.001,cabinet);
  const boothPoint=(y,z,lift=0)=>[side*(.064+(y+.011)/.025*.008-lift),y,z];
  const boothOuter=[boothPoint(-.010,-.0425,.0003),boothPoint(-.010,-.0193,.0003),boothPoint(.0135,-.023,.0003),boothPoint(.0135,-.0395,.0003)];
  const boothInner=[boothPoint(-.0065,-.039,.0004),boothPoint(-.0065,-.0225,.0004),boothPoint(.0105,-.0255,.0004),boothPoint(.0105,-.037,.0004)];
  panelRing(booth,boothOuter,boothInner,boothMetal);
  quad(booth+'-window',boothInner,glass);
  box(booth+'-sill',side*.0645,-.010,-.0309,.002,.0018,.0232,boothMetal);
  quad(booth+'-status-fascia',[boothPoint(-.010,-.046,.0003),boothPoint(-.010,-.0432,.0003),boothPoint(.014,-.0432,.0003),boothPoint(.014,-.046,.0003)],cabinet);
  for(const [i,color]of [red,white,green,white].entries()){
   const y=.0115-i*.0055;
   const face=[boothPoint(y-.0015,-.0455,.0005),boothPoint(y-.0015,-.0437,.0005),boothPoint(y+.0015,-.0437,.0005),boothPoint(y+.0015,-.0455,.0005)];
   const outer=[boothPoint(y-.0018,-.04575,.0005),boothPoint(y-.0018,-.04345,.0005),boothPoint(y+.0018,-.04345,.0005),boothPoint(y+.0018,-.04575,.0005)];
   const back=outer.map(([x,y,z])=>[x+side*.003,y,z]),g=new T.BufferGeometry();
   g.setAttribute('position',new T.Float32BufferAttribute([...outer,...back].flat(),3));
   g.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);g.computeVertexNormals();
   mesh(g,lampBezel,booth+'-status-'+i+'-bezel');
   const tint=color.color.getHex(),lensMaterial=new T.MeshStandardMaterial({color:tint,map:lampLensMap,emissive:tint,emissiveMap:lampLensMap,emissiveIntensity:.8,roughness:.24,metalness:.1,toneMapped:false,side:T.DoubleSide});
   lensMaterial.userData.hangarSignalLens=true;
   // Interpolate on the fitted booth face so every layer follows its slope.
   const lampPoint=(u,v,lift,points,normal)=>points[0].map((value,axis)=>value+(points[1][axis]-value)*u+(points[3][axis]-value)*v+normal[axis]*lift);
   function lampFace(name,u0,v0,u1,v1,lift,material,points=face,normal=[-side,0,0]){
    const lamp=quad(name,[lampPoint(u0,v0,lift,points,normal),lampPoint(u1,v0,lift,points,normal),lampPoint(u1,v1,lift,points,normal),lampPoint(u0,v1,lift,points,normal)],material);
    lamp.geometry.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));return lamp;
   }
   const coreMaterial=new T.MeshBasicMaterial({color:new T.Color(tint).lerp(new T.Color(0xffffff),.35),toneMapped:false,side:T.DoubleSide});
   const haloMaterial=new T.MeshBasicMaterial({map:lampHaloMap,color:tint,transparent:true,opacity:.12,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,side:T.DoubleSide});
   lampFace(booth+'-status-'+i,0,0,1,1,.00010,lensMaterial);
   lampFace(booth+'-status-'+i+'-lens-core',.09,.39,.91,.61,.00016,coreMaterial);
   const halo=lampFace(booth+'-status-'+i+'-glow',-.2,-1,1.2,2,.00020,haloMaterial);halo.renderOrder=10;
   // Keep an illuminated return on the aft end of each lamp housing,
   // facing the shuttle inside the bay as well as across the booth face.
   const shuttleFace=[boothPoint(y-.0015,-.04575,.0005),boothPoint(y-.0015,-.04575,.0005),boothPoint(y+.0015,-.04575,.0005),boothPoint(y+.0015,-.04575,.0005)].map(([x,y,z],corner)=>[x+side*(corner===0||corner===3?.00035:.00265),y,z]);
   const shuttleNormal=[0,0,-1],shuttleName=booth+'-status-'+i+'-shuttle-facing';
   lampFace(shuttleName,0,0,1,1,.00010,lensMaterial,shuttleFace,shuttleNormal);
   lampFace(shuttleName+'-lens-core',.09,.39,.91,.61,.00016,coreMaterial,shuttleFace,shuttleNormal);
   const shuttleHalo=lampFace(shuttleName+'-glow',-.2,-1,1.2,2,.00020,haloMaterial,shuttleFace,shuttleNormal);shuttleHalo.renderOrder=10;
  }
  for(const [i,color]of [green,yellow,cyan].entries())box(booth+'-lower-indicator-'+i,side*.0638,-.015,-.0225-i*.002,.0004,.0015,.0012,color);
  // Tapered end pillars and vertical grilles.
  const half=createShuttleGarage.doorWidth/2;
  prism(prefix+'-bay-forward-pier',[[side*(half+.004),floor],[side*(half+.016),floor],[side*(half+.016),.018],[side*(half+.007),.036],[side*(half+.002),.036],[side*(half+.004),.018]],rearZ+.00115,rearZ+.00615,gray);
  for(let n=0;n<4;n++)box(prefix+'-bay-forward-pier-grille-'+n,side*(half+.005+n*.0014),.014,rearZ+.0064,.00065,.026,.0004,darkGray);
  const wallRake=.18;
  for(const o of walls.children){
   if(!o.isMesh||!o.name.startsWith(prefix+'-')||/-bay-(vent|forward)/.test(o.name))continue;
   o.updateMatrix();o.geometry.applyMatrix4(o.matrix);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);
   const p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    // Freestanding deck boxes stay square and upright instead of shearing
    // with the sloped wall fittings. Their bottom remains on the floor.
    const rakeY=o.name.endsWith('-bay-wall-utility-box')?floor:p.getY(i);
    p.setX(i,p.getX(i)+side*(.0002-wallRake*(rakeY-floor)));
    // Align the observation-room floors with the front booth floor.
    const observationRoom=(o.name.startsWith(prefix+'-bay-console-')&&!o.name.endsWith('-rail'))||o.name.startsWith(prefix+'-bay-key-');
    if(observationRoom)p.setY(i,p.getY(i)+.007);
    // Lift the complete booth rigidly, preserving its shape and projection.
    if(o.name.startsWith(booth))p.setY(i,p.getY(i)+.010);
   }
   p.needsUpdate=true;o.geometry.computeVertexNormals();
  }
  // The exposed wall end follows the real hull section instead of stopping
  // at the fixed cabinet depth. Keep its curved edge sealed at every height.
  const endZ=wallFront+.001,trimTop=-.01425,endBottom=floor,endRows=24;
  function skinSideX(y,z){
   const scaleY=fitDoorShoulders?.128/.162:1,skinY=y*scaleY+(fitDoorShoulders?.102*(1-scaleY):0);
   if(!fitDoorShoulders){const radius=.102+Math.max(0,Math.min(1,-z/.07))*.003;return Math.sqrt(Math.max(0,radius*radius-skinY*skinY))+.00002;}
   const shape=EnterpriseEngineeringShape;let lo=0,hi=shape.radiusAt(z);
   for(let n=0;n<32;n++){const x=(lo+hi)/2,height=skinY>=0?shape.upAt(z,x):shape.downAt(z,x);if(height>Math.abs(skinY))lo=x;else hi=x;}
   return (lo+hi)/2+.00002;
  }
  const insideX=y=>.0778+.0002-wallRake*(y-floor),endPositions=[],endIndices=[];
  for(let row=0;row<=endRows;row++){const y=endBottom+(trimTop-endBottom)*row/endRows;endPositions.push(side*insideX(y),y,endZ,side*skinSideX(y,endZ),y,endZ);}
  for(let row=0;row<endRows;row++){const a=row*2;endIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const endGeometry=new T.BufferGeometry();endGeometry.setAttribute('position',new T.Float32BufferAttribute(endPositions,3));endGeometry.setIndex(endIndices);endGeometry.computeVertexNormals();mesh(endGeometry,gray,prefix+'-bay-hull-fitted-end-cap');
  const oldTop=(floor-.0205)/2+(-.0205-floor)/2*1.15;
  quad(prefix+'-bay-exposed-wall-end-face',[[side*insideX(oldTop),oldTop,trimEnd],[side*insideX(oldTop),oldTop,endZ],[side*insideX(trimTop),trimTop,endZ],[side*insideX(trimTop),trimTop,trimEnd]],gray);
  quad(prefix+'-bay-exposed-wall-end-top',[[side*insideX(trimTop),trimTop,trimEnd],[side*insideX(trimTop),trimTop,endZ],[side*skinSideX(trimTop,endZ),trimTop,endZ],[side*skinSideX(trimTop,trimEnd),trimTop,trimEnd]],gray);
  // Close the shallow return to the existing roof grille without moving it.
  const wallTop=.081-wallRake*(.0222-floor);
  quad(prefix+'-bay-upper-wall-return',[[side*wallTop,.0222,wallRear],[side*wallTop,.0222,wallFront],[side*(ventX+.0025),.0222,wallFront],[side*(ventX+.0025),.0222,wallRear]],gray);
  // Rooms run lengthwise behind the bay wall; the short halls run outboard.
  // Inward-facing surfaces keep the cavities enclosed from exterior views.
  for(const [n,{z,length}] of shuttleBaySideDoorLayout().entries()){
   const suite=new T.Group();suite.name=prefix+'-bay-side-room-'+n;room.add(suite);
   suite.userData={shortHall:true,roomLength:length,sparseLighting:true};
   const roomMaterial=new T.MeshBasicMaterial({color:0x090e12}),hallMaterial=new T.MeshBasicMaterial({color:0x1d272d});
   function surface(name,points,material){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex(side>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);g.computeVertexNormals();
    const o=new T.Mesh(g,material);o.name=suite.name+'-'+name;suite.add(o);return o;
   }
   const point=(x,y,a)=>[side*x,y,a],near=(y,a)=>point(.0801-.18*(y-floor),y,a),join=.0865,back=.096,top=-.0205;
   const low=z-.011,high=z+.011,topLow=z-.0075,topHigh=z+.0075;
   surface('hall-floor',[near(floor,low),point(join,floor,low),point(join,floor,high),near(floor,high)],hallMaterial);
   surface('hall-ceiling',[near(top,topHigh),point(join,top,topHigh),point(join,top,topLow),near(top,topLow)],hallMaterial);
   surface('hall-aft-wall',[near(floor,low),near(top,topLow),point(join,top,topLow),point(join,floor,low)],hallMaterial);
   surface('hall-forward-wall',[near(floor,high),point(join,floor,high),point(join,top,topHigh),near(top,topHigh)],hallMaterial);
   const a=z-length/2,b=z+length/2;
   surface('floor',[point(join,floor,a),point(back,floor,a),point(back,floor,b),point(join,floor,b)],roomMaterial);
   surface('ceiling',[point(join,top,b),point(back,top,b),point(back,top,a),point(join,top,a)],roomMaterial);
   surface('back-wall',[point(back,floor,a),point(back,top,a),point(back,top,b),point(back,floor,b)],roomMaterial);
   surface('aft-wall',[point(join,floor,a),point(join,top,a),point(back,top,a),point(back,floor,a)],roomMaterial);
   surface('forward-wall',[point(join,floor,b),point(back,floor,b),point(back,top,b),point(join,top,b)],roomMaterial);
   // Dark wall returns seal the room around its narrower hall entrance.
   surface('entry-aft-return',[point(join,floor,a),point(join,floor,low),point(join,top,topLow),point(join,top,a)],roomMaterial);
   surface('entry-forward-return',[point(join,floor,high),point(join,floor,b),point(join,top,b),point(join,top,topHigh)],roomMaterial);
   const lampMaterial=new T.MeshBasicMaterial({color:0x7b8985,toneMapped:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,depthWrite:false});
   surface('hall-light',[point(.082,top-.0001,z-.0018),point(.084,top-.0001,z-.0018),point(.084,top-.0001,z+.0018),point(.082,top-.0001,z+.0018)],lampMaterial);
   // Subtle pools and two low guide marks suggest light without adding
   // sixteen real-time lights to the existing bay lighting system.
   const poolMaterial=new T.MeshBasicMaterial({color:0x34413f,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,depthWrite:false});
   surface('hall-light-pool',[point(.081,floor+.00004,z-.004),point(join+.001,floor+.00004,z-.004),point(join+.001,floor+.00004,z+.004),point(.081,floor+.00004,z+.004)],poolMaterial);
   for(const offset of [-length*.3,length*.3])surface('room-guide-'+offset,[point(back-.00005,floor+.001,z+offset-.001),point(back-.00005,floor+.002,z+offset-.001),point(back-.00005,floor+.002,z+offset+.001),point(back-.00005,floor+.001,z+offset+.001)],poolMaterial);
  }
 }
 walls.userData.style='reference taupe panels, beveled console banks, recessed service doors and louvered grilles';
 return walls;
};
