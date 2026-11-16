/* Bridge hatch controls, circular dome room and matching shell opening. */
(()=>{
 const offlineImages=new Map();
 function imageSource(name='bridge-front-wall',key='BRIDGE_FRONT_WALL_IMAGE'){
  if(location.protocol!=='file:')return Promise.resolve('assets/reference/'+name+'.png');
  // File-origin images decode successfully but cannot supply WebGL pixels.
  // A local script provides the same PNG as a data URL for offline launches.
  if(!offlineImages.has(name))offlineImages.set(name,new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='assets/reference/'+name+'-image.js';
   script.onload=()=>{const source=window[key];delete window[key];script.remove();source?resolve(source):reject(new Error('Missing offline bridge image: '+name));};
   script.onerror=()=>{script.remove();reject(new Error('Could not load the offline bridge image: '+name));};document.head.append(script);
  }));
  return offlineImages.get(name);
 }
 window.createBridgeHatchRoom=(T,{dome,centerY,portZ,doorZ})=>{
  const room=new T.Group();room.name='bridge-circular-room';
  const bridgeScale=.9,radius=.055*bridgeScale,baseWallHeight=.0178*bridgeScale,corridorFloorY=-.0083;
  const sinkOffset=baseWallHeight*1.2*.1;
  const wallHeightScale=1.9008*.95,ceilingY=corridorFloorY+baseWallHeight-sinkOffset,floorY=ceilingY-baseWallHeight*wallHeightScale,halfEntrance=.0084,corridorCeilingY=.0095;
  // Keep the circular room's aft entrance at its existing station. Moving the
  // smaller room aft preserves the hatch corridor's length and width.
  const entranceZ=dome.position.z-portZ+Math.sqrt(.055**2-halfEntrance**2);
  const centerZ=entranceZ-Math.sqrt(radius**2-halfEntrance**2);
  const gap=Math.asin(halfEntrance/radius),outline=[];
  // One continuous footprint joins the circular room to the existing aft hatch.
  // Leaving this arc open gives the doorway a clear sightline into the room.
  for(let i=0;i<=128;i++){
   const a=gap+i*(Math.PI*2-2*gap)/128;outline.push([Math.sin(a)*radius,centerZ+Math.cos(a)*radius]);
  }
  outline.push([-halfEntrance,doorZ],[halfEntrance,doorZ]);
  const red=new T.MeshStandardMaterial({color:0x8f2425,roughness:1,metalness:0,side:T.DoubleSide});
  red.userData.matteRedInterior=true;
  function surface(name,positions,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,red);m.name=name;room.add(m);return m;}
  const deckMaterial=new T.MeshStandardMaterial({color:0x080808,roughness:1,metalness:0,side:T.DoubleSide});
  const lowerDiameterRatio=.5632,lowerRadius=radius*lowerDiameterRatio,depth=baseWallHeight*.25,lowerFloor=floorY-depth;
  // Pair the circular boundary with the sunken opening. Close the ring at
  // the corridor mouth; a separate solid staircase connects it to the hatch.
  const deckPositions=[],deckIndices=[];
  for(let i=0;i<=128;i++){const [x,z]=outline[i],d=Math.hypot(x,z-centerZ);deckPositions.push(x,floorY,z,x/d*lowerRadius,floorY,centerZ+(z-centerZ)/d*lowerRadius);}
  for(let i=0;i<=128;i++){const j=i*2,k=((i+1)%129)*2;deckIndices.push(j,k,k+1,j,k+1,j+1);}
  const upperDeckMaterial=new T.MeshBasicMaterial({color:0x0c0a09,side:T.DoubleSide,toneMapped:false});
  surface('bridge-room-floor',deckPositions,deckIndices).material=upperDeckMaterial;
  const sunken=new T.Group();sunken.name='bridge-room-sunken-room';room.add(sunken);
  const lowerPositions=[0,lowerFloor,centerZ],lowerIndices=[];
  for(let i=0;i<=128;i++){const angle=i*Math.PI/64;lowerPositions.push(Math.sin(angle)*lowerRadius,lowerFloor,centerZ+Math.cos(angle)*lowerRadius);if(i<128)lowerIndices.push(0,i+2,i+1);}
  const lowerDeck=surface('bridge-room-sunken-floor',lowerPositions,lowerIndices);lowerDeck.material=deckMaterial;sunken.add(lowerDeck);
  const stairWidth=.012*bridgeScale*.8,stairGap=Math.asin(stairWidth/2/lowerRadius),wallPositions=[],wallIndices=[];
  const stairways=[{clock:6,angle:0},{clock:2,angle:Math.PI*2/3},{clock:10,angle:Math.PI*4/3}];
  for(let section=0;section<stairways.length;section++){
   const start=stairways[section].angle+stairGap,end=(stairways[section+1]?.angle??Math.PI*2)-stairGap,base=wallPositions.length/3;
   for(let i=0;i<=48;i++){const angle=start+(end-start)*i/48,x=Math.sin(angle)*lowerRadius,z=centerZ+Math.cos(angle)*lowerRadius;wallPositions.push(x,lowerFloor,z,x,floorY,z);if(i<48){const j=base+i*2;wallIndices.push(j,j+2,j+3,j,j+3,j+1);}}
  }
  const lowerWall=surface('bridge-room-sunken-wall',wallPositions,wallIndices);lowerWall.material=deckMaterial;sunken.add(lowerWall);
  const railing=new T.Group();railing.name='bridge-upper-level-railing';room.add(railing);
  const railHeight=.0082225,postBaseRadius=lowerRadius+.0007,railRadius=postBaseRadius-.001;
  const railWidth=.0016,railThickness=.00055,railY=floorY+railHeight,railGap=Math.asin((stairWidth/2+.0024)/railRadius),postEndSetback=.0018;
  const railPaint=new T.MeshStandardMaterial({color:0x751b17,emissive:0x751b17,emissiveIntensity:.10,roughness:.75,metalness:0,flatShading:true});
  const postPaint=new T.MeshStandardMaterial({color:0x050505,roughness:.9,metalness:0});
  for(let section=0;section<stairways.length;section++){
   const start=stairways[section].angle+railGap,end=(stairways[section+1]?.angle??Math.PI*2)-railGap,positions=[],indices=[],postCount=section===1?6:5,segments=postCount+1;
   const inset=postEndSetback/railRadius,postAngles=Array.from({length:postCount},(_,i)=>start+inset+(end-start-2*inset)*i/(postCount-1)),handleAngles=[start,...postAngles,end];
   for(let i=0;i<=segments;i++){
    const angle=handleAngles[i],faceAngle=i===0?(angle+handleAngles[1])/2:i===segments?(handleAngles[i-1]+angle)/2:(handleAngles[i-1]+2*angle+handleAngles[i+1])/4;
    // End faces are perpendicular to their straight span, with flat square caps.
    for(const [offset,y]of [[-railWidth/2,railY-railThickness/2],[railWidth/2,railY-railThickness/2],[railWidth/2,railY+railThickness/2],[-railWidth/2,railY+railThickness/2]])positions.push(Math.sin(angle)*railRadius+Math.sin(faceAngle)*offset,y,centerZ+Math.cos(angle)*railRadius+Math.cos(faceAngle)*offset);
    if(i<segments)for(let face=0;face<4;face++){const a=i*4+face,b=i*4+(face+1)%4;indices.push(a,b,b+4,a,b+4,a+4);}
   }
   indices.push(0,2,1,0,3,2);const last=segments*4;indices.push(last,last+1,last+2,last,last+2,last+3);
   for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const handle=new T.Mesh(geometry,railPaint);handle.name='bridge-red-handrail-'+section;railing.add(handle);
   for(let i=0;i<postCount;i++){
    const angle=postAngles[i],base=new T.Vector3(Math.sin(angle)*postBaseRadius,floorY,centerZ+Math.cos(angle)*postBaseRadius),top=new T.Vector3(Math.sin(angle)*railRadius,railY-railThickness/2,centerZ+Math.cos(angle)*railRadius),direction=top.clone().sub(base);
    const post=new T.Mesh(new T.BoxGeometry(.00045,direction.length(),railWidth*.7),postPaint);post.name='bridge-rail-post-'+section+'-'+i;
    post.position.copy(base).add(top).multiplyScalar(.5);post.rotation.set(-Math.atan2(postBaseRadius-railRadius,direction.y),angle,0,'YXZ');railing.add(post);
   }
  }
  railing.userData={height:railHeight,baseRadius:postBaseRadius,topRadius:railRadius,stairGaps:stairways.map(s=>s.clock),posts:16,straightSpans:19,postEndSetback,handleWidth:railWidth,handleThickness:railThickness};
  const stairStart=Math.sqrt(lowerRadius*lowerRadius-(stairWidth/2)**2),run=.020*bridgeScale*.8,stepCount=4;
  const stairMaterial=deckMaterial.clone();stairMaterial.flatShading=true;
  // The landing slightly overlaps the curved deck; depth bias avoids flicker.
  stairMaterial.polygonOffset=true;stairMaterial.polygonOffsetFactor=-1;stairMaterial.polygonOffsetUnits=-1;
  function makeSolidStair(name,profile,width){
   const positions=[],indices=[],n=profile.length;
   for(const x of [-width/2,width/2])for(const [z,y]of profile)positions.push(x,y,z);
   for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
   for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+j,i,n+j,n+i);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const mesh=new T.Mesh(geometry,stairMaterial);mesh.name=name;room.add(mesh);return mesh;
  }
  for(const {clock,angle}of stairways){
   const tread=run*.8/(stepCount-1),base=lowerFloor-.00005,landingBack=lowerRadius+.0001,front=stairStart-(stepCount-1)*tread;
   // A complete stepped cross-section, extruded across the stair width. The
   // side faces, risers, underside and landing are all part of one closed mesh.
   const profile=[[landingBack,base],[front,base],[front,floorY-depth*(stepCount-1)/stepCount]];
   for(let i=stepCount-2;i>=0;i--){profile.push([stairStart-i*tread,floorY-depth*(i+1)/stepCount]);profile.push([stairStart-i*tread,floorY-depth*i/stepCount]);}
   profile.push([landingBack,floorY]);
   const step=makeSolidStair('bridge-room-sunken-stair-'+clock,profile,stairWidth);step.rotation.y=angle;step.position.z=centerZ;
   step.userData.stairway={clock,treads:stepCount-1,riserHeight:depth/stepCount,treadDepth:tread,firstTreadZ:stairStart-tread/2,landingBack,closedSolid:true};sunken.add(step);
  }
  const corridorDrop=corridorFloorY-floorY,corridorRiser=depth/stepCount,corridorTreads=Math.max(1,Math.floor(corridorDrop/corridorRiser)),landing=.003,stairBack=doorZ-landing,corridorTread=(stairBack-entranceZ)/corridorTreads;
  const corridorProfile=[[doorZ,floorY-.00005],[entranceZ,floorY-.00005],[entranceZ,floorY]];
  for(let i=corridorTreads-1;i>=0;i--){const z=stairBack-i*corridorTread;corridorProfile.push([z,floorY+corridorRiser*(corridorTreads-i-1)],[z,floorY+corridorRiser*(corridorTreads-i)]);}
  corridorProfile.push([doorZ,corridorFloorY]);
  const entryStairs=makeSolidStair('bridge-corridor-entry-stairs',corridorProfile,halfEntrance*2);
  entryStairs.userData.stairway={treads:corridorTreads,riserHeight:corridorRiser,treadDepth:corridorTread,landing,landingStart:stairBack,thresholdRise:corridorDrop-corridorRiser*corridorTreads,thresholdY:corridorFloorY+centerY,bridgeFloorY:floorY+centerY,drop:corridorDrop,closedSolid:true};
  sunken.userData.sunkenRoom={radius:lowerRadius,centerZ:portZ+centerZ,diameterRatio:lowerDiameterRatio,height:depth,heightRatio:depth/(ceilingY-floorY),floorY:lowerFloor+centerY,upperFloorY:floorY+centerY,steps:stepCount-1,stairways:stairways.map(s=>s.clock),twelveOClock:'fore',connected:true};
  // A shallow eight-panel dome fits below the exterior sensor cap. The radial
  // joints sit just inside its surface so they read clearly from the bridge.
  const ceiling=new T.Group();ceiling.name='bridge-room-ceiling';room.add(ceiling);
  const rise=.0029*bridgeScale*1.375,seamMaterial=new T.MeshStandardMaterial({color:0x391719,roughness:1,metalness:0,side:T.DoubleSide});
  const ceilingCanvas=document.createElement('canvas');ceilingCanvas.width=393;ceilingCanvas.height=433;
  const ceilingContext=ceilingCanvas.getContext('2d');ceilingContext.fillStyle='#302b29';ceilingContext.fillRect(0,0,393,433);
  const ceilingTexture=new T.CanvasTexture(ceilingCanvas);ceilingTexture.colorSpace=T.SRGBColorSpace;ceilingTexture.anisotropy=8;
  const ceilingPaint=new T.MeshStandardMaterial({color:0xffffff,map:ceilingTexture,emissive:0xffffff,emissiveMap:ceilingTexture,emissiveIntensity:.4,roughness:1,metalness:0,side:T.DoubleSide});
  const ceilingReady=new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{ceilingContext.drawImage(image,0,0,393,433);ceilingTexture.needsUpdate=true;ceilingPaint.userData.artworkLoaded=true;resolve();};
   image.onerror=()=>reject(new Error('Could not load the bridge ceiling artwork.'));
   imageSource('bridge-ceiling-panel','BRIDGE_CEILING_PANEL_IMAGE').then(source=>{image.src=source;}).catch(reject);
  });
  const domeRadiusRatio=.84,ledgeBottomY=ceilingY-.0006,domeSpringY=ceilingY+.0002;
  const ledgePositions=[],ledgeIndices=[],ledgeSegments=128;
  for(let i=0;i<=ledgeSegments;i++){
   const angle=i*Math.PI*2/ledgeSegments;
   for(const [r,y]of [[radius*domeRadiusRatio,ledgeBottomY],[radius,ledgeBottomY],[radius,domeSpringY],[radius*domeRadiusRatio,domeSpringY]])ledgePositions.push(Math.sin(angle)*r,y,centerZ+Math.cos(angle)*r);
   if(i<ledgeSegments)for(let face=0;face<4;face++){const a=i*4+face,b=i*4+(face+1)%4;ledgeIndices.push(a,b+4,b,a,a+4,b+4);}
  }
  const ledgeGeometry=new T.BufferGeometry();ledgeGeometry.setAttribute('position',new T.Float32BufferAttribute(ledgePositions,3));ledgeGeometry.setIndex(ledgeIndices);ledgeGeometry.computeVertexNormals();
  const ledge=new T.Mesh(ledgeGeometry,new T.MeshStandardMaterial({color:0x1d222f,roughness:.9,metalness:0}));ledge.name='bridge-ceiling-light-ledge';ceiling.add(ledge);
  ledge.userData={innerRadius:radius*domeRadiusRatio,outerRadius:radius,bottomY:ledgeBottomY,topY:domeSpringY};
  function ceilingPatch(name,start,end,material,offset=0,inner=.1,outer=domeRadiusRatio,flat=false){
   const positions=[],indices=[],uv=[],radialSteps=20,angularSteps=name.includes('seam')?1:name.includes('cap')?128:24;
   for(let r=0;r<=radialSteps;r++)for(let a=0;a<=angularSteps;a++){
    const t=inner+(outer-inner)*r/radialSteps,angle=start+(end-start)*a/angularSteps;
    positions.push(Math.sin(angle)*radius*t,domeSpringY+rise*(1-(flat ? .1/domeRadiusRatio : t/domeRadiusRatio)**2)+offset,centerZ+Math.cos(angle)*radius*t);
    uv.push(a/angularSteps,1-r/radialSteps);
   }
   for(let r=0;r<radialSteps;r++)for(let a=0;a<angularSteps;a++){
    const i=r*(angularSteps+1)+a,j=i+angularSteps+1;indices.push(i,j,j+1,i,j+1,i+1);
   }
   const mesh=surface(name,positions,indices);mesh.geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));mesh.material=material;ceiling.add(mesh);return mesh;
  }
  for(let section=0;section<8;section++){
   const angle=section*Math.PI/4;
   ceilingPatch('bridge-room-ceiling-section-'+(section+1),angle,angle+Math.PI/4,ceilingPaint);
   ceilingPatch('bridge-room-ceiling-seam-'+(section+1),angle-.0025,angle+.0025,seamMaterial,-.000025);
  }
  const capRadius=radius*.1,diffuserRadius=capRadius*Math.sqrt(.7)*.8,capY=domeSpringY+rise*(1-(.1/domeRadiusRatio)**2),diffuserHeight=.00096;
  const domeMountPaint=new T.MeshStandardMaterial({color:0x1d222f,roughness:.9,metalness:0,side:T.DoubleSide});
  ceilingPatch('bridge-dome-light-mount',0,Math.PI*2,domeMountPaint,0,0,.1,true);
  const diffuserCanvas=document.createElement('canvas');diffuserCanvas.width=diffuserCanvas.height=128;
  const diffuserContext=diffuserCanvas.getContext('2d'),diffuserGradient=diffuserContext.createRadialGradient(64,64,4,64,64,64);
  for(const [stop,color]of [[0,'#ffffff'],[.82,'#f5f8ff'],[1,'#c5ddff']])diffuserGradient.addColorStop(stop,color);
  diffuserContext.fillStyle=diffuserGradient;diffuserContext.fillRect(0,0,128,128);
  const diffuserMap=new T.CanvasTexture(diffuserCanvas);diffuserMap.colorSpace=T.SRGBColorSpace;
  const capPaint=new T.MeshStandardMaterial({color:0xffffff,map:diffuserMap,emissive:0xffffff,emissiveMap:diffuserMap,emissiveIntensity:.56,roughness:.85,metalness:0,side:T.DoubleSide});capPaint.userData.frostedDiffuser=true;
  const capGeometry=new T.SphereGeometry(1,48,24,0,Math.PI*2,Math.PI/2,Math.PI/2);capGeometry.scale(diffuserRadius,diffuserHeight,diffuserRadius);capGeometry.translate(0,capY,centerZ);
  const cap=new T.Mesh(capGeometry,capPaint);cap.name='bridge-room-ceiling-center-cap';ceiling.add(cap);
  const capPositions=capGeometry.attributes.position,capUV=capGeometry.attributes.uv;
  for(let i=0;i<capPositions.count;i++)capUV.setXY(i,.5+capPositions.getX(i)/(diffuserRadius*2),.5-(capPositions.getZ(i)-centerZ)/(diffuserRadius*2));
  cap.userData.domeLight={diffuse:true,radius:diffuserRadius,mountRadius:capRadius,areaRatio:.7*.8*.8,height:diffuserHeight};
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;
  const haloContext=haloCanvas.getContext('2d'),haloGradient=haloContext.createRadialGradient(64,64,0,64,64,64);
  for(const [stop,color]of [[0,'rgba(80,145,255,0)'],[.70,'rgba(80,145,255,0)'],[.77,'rgba(105,170,255,.45)'],[.87,'rgba(70,135,255,.18)'],[1,'rgba(60,120,255,0)']])haloGradient.addColorStop(stop,color);
  haloContext.fillStyle=haloGradient;haloContext.fillRect(0,0,128,128);
  const haloMap=new T.CanvasTexture(haloCanvas);haloMap.colorSpace=T.SRGBColorSpace;
  const halo=new T.Mesh(new T.PlaneGeometry(diffuserRadius*2.6,diffuserRadius*2.6),new T.MeshBasicMaterial({map:haloMap,transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}));
  halo.name='bridge-dome-light-blue-halo';halo.rotation.x=Math.PI/2;halo.position.set(0,capY-.00003,centerZ);ceiling.add(halo);
  ceilingPatch('bridge-room-ceiling-cap-rim',0,Math.PI*2,seamMaterial,-.000025,.099,.101,true);
  const throatStart=centerZ+Math.sqrt(radius*radius-halfEntrance*halfEntrance);
  const throat=surface('bridge-room-entrance-ceiling',[-halfEntrance,ceilingY,throatStart,halfEntrance,ceilingY,throatStart,halfEntrance,corridorCeilingY,doorZ,-halfEntrance,corridorCeilingY,doorZ],[0,1,2,0,2,3]);
  throat.material=red;ceiling.add(throat);
  // Red center-split turbolift door at the bridge end of the corridor.
  const innerDoor=new T.Group();innerDoor.name='bridge-corridor-inner-door';room.add(innerDoor);
  const doorWidth=.0144,doorHeight=ceilingY-floorY-.0008,innerZ=throatStart-.0004;
  const framePaint=new T.MeshStandardMaterial({color:0x969395,roughness:.9,metalness:0});
  const doorReflectionCanvas=document.createElement('canvas');doorReflectionCanvas.width=128;doorReflectionCanvas.height=64;
  const reflectionContext=doorReflectionCanvas.getContext('2d'),doorReflectionGradient=reflectionContext.createLinearGradient(0,0,0,64);
  for(const [stop,color]of [[0,'#17151a'],[.35,'#544c4d'],[.46,'#e6dfd5'],[.53,'#77716d'],[1,'#17151a']])doorReflectionGradient.addColorStop(stop,color);
  reflectionContext.fillStyle=doorReflectionGradient;reflectionContext.fillRect(0,0,128,64);
  const doorReflection=new T.CanvasTexture(doorReflectionCanvas);doorReflection.colorSpace=T.SRGBColorSpace;doorReflection.mapping=303;
  const doorPaint=new T.MeshStandardMaterial({color:0xbc2723,roughness:.14,metalness:.08,envMap:doorReflection,envMapIntensity:.65});
  const innerSlide={value:0};
  doorPaint.onBeforeCompile=shader=>{
   shader.uniforms.innerDoorSlide=innerSlide;
   shader.vertexShader='uniform float innerDoorSlide;attribute float innerDoorSide;varying float vInnerDoorX;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvInnerDoorX=position.x+innerDoorSide*innerDoorSlide;');
   shader.fragmentShader='varying float vInnerDoorX;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(abs(vInnerDoorX)>${doorWidth/2})discard;`);
  };
  doorPaint.customProgramCacheKey=()=> 'bridge-inner-door-pocket-mask-v1';
  // Keep the bridge-facing surfaces dark even when corridor or dome lights spill here.
  const bridgeDoorPaint=new T.MeshBasicMaterial({color:0x080808,toneMapped:false});
  bridgeDoorPaint.onBeforeCompile=doorPaint.onBeforeCompile;bridgeDoorPaint.customProgramCacheKey=doorPaint.customProgramCacheKey;
  const bridgeFramePaint=new T.MeshBasicMaterial({color:0x080808,toneMapped:false});
  // Box face 5 points fore (-Z), into the bridge; face 4 faces the corridor.
  const doorFaces=[bridgeDoorPaint,bridgeDoorPaint,bridgeDoorPaint,bridgeDoorPaint,doorPaint,bridgeDoorPaint];
  const frameFaces=[bridgeFramePaint,bridgeFramePaint,bridgeFramePaint,bridgeFramePaint,framePaint,bridgeFramePaint];
  const innerBox=(name,x,y,w,h,d,mat,z=innerZ)=>{
   const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.name=name;mesh.position.set(x,y,z);innerDoor.add(mesh);return mesh;
  };
  const doorCenterY=floorY+doorHeight/2,innerLeaves=[];
  for(const side of [-1,1]){
   innerBox('bridge-inner-door-jamb-'+side,side*(doorWidth/2+(halfEntrance-doorWidth/2)/2),floorY+(ceilingY-floorY)/2,halfEntrance-doorWidth/2,ceilingY-floorY,.0012,frameFaces);
   const leaf=innerBox('bridge-inner-door-'+(side<0?'left':'right'),0,doorCenterY,doorWidth/2-.000025,doorHeight,.00045,doorFaces);
   leaf.geometry.translate(side*doorWidth/4,0,0);
   leaf.geometry.setAttribute('innerDoorSide',new T.Float32BufferAttribute(new Float32Array(leaf.geometry.attributes.position.count).fill(side),1));innerLeaves.push({leaf,side});
  }
  innerBox('bridge-inner-door-header',0,ceilingY-.0004,doorWidth,.0008,.0012,frameFaces);
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=64;
  const signContext=signCanvas.getContext('2d');signContext.fillStyle='#101113';signContext.fillRect(0,0,512,64);signContext.fillStyle='#eee8dd';signContext.font='32px sans-serif';signContext.textAlign='center';signContext.textBaseline='middle';signContext.fillText('Bridge',256,32);
  const signMap=new T.CanvasTexture(signCanvas);signMap.colorSpace=T.SRGBColorSpace;
  innerBox('bridge-inner-door-sign',0,ceilingY-.00042,.0038,.00048,.00008,new T.MeshBasicMaterial({map:signMap}),innerZ+.00065);
  room.setInnerDoorOpen=value=>{
   const open=Math.max(0,Math.min(1,value)),eased=open*open*(3-2*open);innerSlide.value=doorWidth/2*eased;
   for(const {leaf,side}of innerLeaves){leaf.position.x=side*innerSlide.value;leaf.visible=open<1;}
   innerDoor.userData.open=open;
  };
  room.setInnerDoorOpen(0);
  ceiling.userData.domeCeiling={sections:8,radius,rise,riseScale:1.375,domeRadius:radius*domeRadiusRatio,centerCapRadius:radius*.1,centerCapDiameterRatio:.1,artwork:'assets/reference/bridge-ceiling-panel.png',springY:domeSpringY+centerY,apexY:domeSpringY+centerY+rise*(1-(.1/domeRadiusRatio)**2)};
  const p=[],indices=[];
  // The circular skin stops at the corridor. Its two straight side walls are
  // closed solids below, rather than exposed single sheets.
  for(let i=0;i<outline.length;i++){const [x,z]=outline[i];p.push(x,i<=128?floorY:corridorFloorY,z,x,i<=128?ceilingY:corridorCeilingY,z);}
  for(let i=0;i<128;i++){
   const a=i*2,b=((i+1)%outline.length)*2;indices.push(a,b,b+1,a,b+1,a+1);
  }
  const entranceWalls=surface('bridge-room-curved-wall-and-entrance',p,indices);
  entranceWalls.material=new T.MeshStandardMaterial({color:0x080808,roughness:1,metalness:0,side:T.DoubleSide});
  for(const side of [-1,1]){
   const positions=[],thickness=.0006;
   for(const x of [side*halfEntrance,side*(halfEntrance+thickness)])positions.push(x,floorY,entranceZ,x,ceilingY,entranceZ,x,corridorCeilingY,doorZ,x,floorY,doorZ);
   const mesh=surface('bridge-corridor-'+(side<0?'port':'starboard')+'-wall',positions,[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
   mesh.material=entranceWalls.material;mesh.userData.wallThickness=thickness;
  }
  // Fit the artwork to wall height, preserving its aspect ratio horizontally.
  // Show one copy with the large viewscreen aligned directly fore (-Z).
  const placeholder=document.createElement('canvas');placeholder.width=placeholder.height=1;
  const panorama=new T.CanvasTexture(placeholder);panorama.colorSpace=T.SRGBColorSpace;panorama.anisotropy=8;
  const viewCanvas=document.createElement('canvas');viewCanvas.width=768;viewCanvas.height=432;
  const viewContext=viewCanvas.getContext('2d'),viewTexture=new T.CanvasTexture(viewCanvas);viewTexture.colorSpace=T.SRGBColorSpace;
  const viewMaskCanvas=document.createElement('canvas');viewMaskCanvas.width=viewMaskCanvas.height=1;
  const viewMask=new T.CanvasTexture(viewMaskCanvas),viewBounds={value:new Float32Array([0,0,1,1])},viewReady={value:0};
  let lastViewPose;
  room.updateBridgeView=(mission={},state={})=>{
   const carrier=mission.freeSpace?mission.carrier:null,nav=carrier||state;
   const origin={x:nav.x||0,y:nav.y||0,z:nav.z||0},heading=nav.heading||0,pitch=nav.pitch||0,roll=nav.roll||0;
   const key=[origin.x,origin.y,origin.z,heading,pitch,roll].join('/');if(key===lastViewPose)return;
   lastViewPose=key;viewContext.fillStyle='#000000';viewContext.fillRect(0,0,viewCanvas.width,viewCanvas.height);
   SpaceStarfield.draw(viewContext,viewCanvas.width,viewCanvas.height,{...SpaceStarfield.pose(origin,heading,pitch,roll),soft:true});viewTexture.needsUpdate=true;
  };
  room.updateBridgeView();
  const wallPaint=new T.MeshStandardMaterial({color:0xffffff,map:panorama,emissive:0xffffff,emissiveMap:panorama,emissiveIntensity:.45,roughness:1,metalness:0,side:T.DoubleSide});
  // Keep custom shader textures visible to the ship's resource disposer.
  wallPaint.bridgeViewTexture=viewTexture;wallPaint.bridgeViewMask=viewMask;
  const indicatorTime={value:0},indicatorPixels=[4638,4655,4672,4707,4724,4741,4758,4775,4792,4827,4844,4861];
  // Animate the existing 3 / 6 / 3 lenses in the panorama; leave the wall art static.
  const indicatorShader=indicatorPixels.map((x,i)=>`{
   vec2 delta=(vMapUv-vec2(${(x/9800).toFixed(9)},0.3515))/vec2(${(5.3/9800).toFixed(9)},0.0032);
   float edge=max(abs(delta.x),abs(delta.y));
   float phase=indicatorHead-${i}.0;
   float age=phase+indicatorProgress;
   float brightness=indicatorActive*(phase<0.0?0.0:phase<0.5?1.0:phase<2.5?0.7*exp(-0.7*(age-1.0))*(1.0-smoothstep(2.5,3.0,age)):0.0);
   vec3 tint=phase<0.5?vec3(1.0,0.94,0.76):vec3(1.0,0.56,0.16);
   float lens=(1.0-smoothstep(0.72,1.05,edge))*brightness;
   indicatorColor+=tint*lens;indicatorMask=max(indicatorMask,lens);
   indicatorGlow+=tint*exp(-dot(delta,delta)*0.45)*brightness*0.10;
  }`).join('\n');
  // Outside the single image, reveal the plain wall instead of smearing edge pixels.
  wallPaint.onBeforeCompile=shader=>{
   shader.uniforms.bridgeIndicatorTime=indicatorTime;
   shader.uniforms.bridgeViewTexture={value:viewTexture};shader.uniforms.bridgeViewMask={value:viewMask};shader.uniforms.bridgeViewBounds=viewBounds;shader.uniforms.bridgeViewReady=viewReady;
   shader.fragmentShader='uniform float bridgeIndicatorTime;uniform sampler2D bridgeViewTexture;uniform sampler2D bridgeViewMask;uniform vec4 bridgeViewBounds;uniform float bridgeViewReady;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`if(vMapUv.x < 0.0 || vMapUv.x > 1.0) discard;
    #include <map_fragment>
    float indicatorCycleTime=mod(bridgeIndicatorTime,2.75);
    float indicatorActive=1.0-step(1.75,indicatorCycleTime);
    float indicatorHead=floor(indicatorCycleTime*8.0);
    float indicatorProgress=fract(indicatorCycleTime*8.0);
    float indicatorMask=0.0;vec3 indicatorColor=vec3(0.0),indicatorGlow=vec3(0.0);
    ${indicatorShader}
    diffuseColor.rgb=mix(diffuseColor.rgb,indicatorColor,indicatorMask);
    vec2 bridgeViewUv=(vMapUv-bridgeViewBounds.xy)/(bridgeViewBounds.zw-bridgeViewBounds.xy);
    float bridgeViewInside=step(0.0,bridgeViewUv.x)*step(0.0,bridgeViewUv.y)*step(bridgeViewUv.x,1.0)*step(bridgeViewUv.y,1.0);
    float bridgeViewAlpha=texture2D(bridgeViewMask,clamp(bridgeViewUv,0.0,1.0)).a*bridgeViewInside*bridgeViewReady;
    vec3 bridgeViewColor=texture2D(bridgeViewTexture,clamp(bridgeViewUv,0.0,1.0)).rgb;
    // Full-white star cores with soft coverage against genuinely black space.
    float bridgeStarLevel=max(bridgeViewColor.r,max(bridgeViewColor.g,bridgeViewColor.b));
    bridgeViewColor=vec3(smoothstep(0.0,0.02,bridgeStarLevel));
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=mix(totalEmissiveRadiance,indicatorColor*1.5,indicatorMask)+indicatorGlow;diffuseColor.rgb*=1.0-bridgeViewAlpha;totalEmissiveRadiance=mix(totalEmissiveRadiance,bridgeViewColor,bridgeViewAlpha);');
   // Display whites stay at maximum brightness independently of scene exposure.
   shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>','#include <tonemapping_fragment>\ngl_FragColor.rgb=mix(gl_FragColor.rgb,bridgeViewColor,bridgeViewAlpha);');
  };
  wallPaint.customProgramCacheKey=()=> 'bridge-wall-live-forward-view-white-stars-black-space-v7';
  const photoGeometry=new T.BufferGeometry(),photoPositions=new Float32Array(129*2*3),photoUV=[],photoIndices=[];
  for(let i=0;i<=128;i++){photoUV.push(i/128,0,i/128,1);if(i<128){const j=i*2;photoIndices.push(j,j+2,j+3,j,j+3,j+1);}}
  photoGeometry.setAttribute('position',new T.Float32BufferAttribute(photoPositions,3));photoGeometry.setAttribute('uv',new T.Float32BufferAttribute(photoUV,2));photoGeometry.setIndex(photoIndices);
  const photo=new T.Mesh(photoGeometry,wallPaint);photo.name='bridge-room-front-panorama';photo.visible=false;room.add(photo);
  photo.userData.indicatorLights={count:12,banks:[3,6,3],stepSeconds:1/8,cycleSeconds:1.5,fadeSeconds:.25,pauseSeconds:1,repeatSeconds:2.75,trail:'fading-behind-leader',colors:['warm-white','amber'],source:'https://www.youtube.com/watch?v=peO6n-ii14w'};
  room.updateBridgeIndicators=time=>{if(Number.isFinite(time))indicatorTime.value=Math.max(0,time);};
  const wallReady=new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{
    const imageAspect=image.naturalWidth/image.naturalHeight,paintRadius=radius-.00003,wallHeight=ceilingY-floorY,imageWorldWidth=wallHeight*imageAspect,arc=imageWorldWidth/paintRadius,positions=photoGeometry.attributes.position,uv=photoGeometry.attributes.uv,coverage=Math.PI*2-2*gap;
    // Decode into a bounded canvas for GPUs with an 8192-pixel texture limit.
    const canvas=document.createElement('canvas');canvas.width=Math.min(8192,image.naturalWidth);canvas.height=Math.round(canvas.width/imageAspect);
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
    // Use the strongest blue frame columns, excluding the surrounding glow,
    // to center the actual screen at the wall's foremost (-Z) point.
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data,blueColumns=new Uint32Array(canvas.width);let screenLeft=Infinity,screenRight=-Infinity,maxBlue=0;
    for(let y=Math.floor(canvas.height*.27);y<canvas.height*.72;y++)for(let x=0;x<canvas.width;x++){
     const i=(y*canvas.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(b>100&&b>r*1.7&&b>g*1.2)maxBlue=Math.max(maxBlue,++blueColumns[x]);
    }
    if(maxBlue)for(let x=0;x<canvas.width;x++)if(blueColumns[x]>=maxBlue*.5){screenLeft=Math.min(screenLeft,x);screenRight=Math.max(screenRight,x);}
    const screenCenterU=Number.isFinite(screenLeft)?(screenLeft+screenRight)/(2*canvas.width):.1;
    if(Number.isFinite(screenLeft)&&screenRight>screenLeft){
     const isBlue=(x,y)=>{const i=(y*canvas.width+x)*4;return pixels[i+2]>100&&pixels[i+2]>pixels[i]*1.7&&pixels[i+2]>pixels[i+1]*1.2;};
     const screenWidth=screenRight-screenLeft,rows=[];let maxRow=0;
     for(let y=0;y<canvas.height;y++){let count=0;for(let x=Math.ceil(screenLeft+screenWidth*.25);x<screenRight-screenWidth*.25;x++)if(isBlue(x,y))count++;rows[y]=count;maxRow=Math.max(maxRow,count);}
     const screenTop=rows.findIndex(n=>n>=maxRow*.6);
     // Take the next horizontal border, excluding blue reflections below the screen.
     let screenBottom=rows.findIndex((n,y)=>y>screenTop+canvas.height*.15&&n>=maxRow*.6);
     while(screenBottom+1<rows.length&&rows[screenBottom+1]>=maxRow*.4)screenBottom++;
     if(maxRow>screenWidth*.2&&screenBottom>screenTop){
      viewCanvas.height=Math.round(viewCanvas.width*(screenBottom-screenTop)/screenWidth);lastViewPose=undefined;room.updateBridgeView();
      viewMaskCanvas.width=screenWidth;viewMaskCanvas.height=screenBottom-screenTop;const maskContext=viewMaskCanvas.getContext('2d'),maskPixels=maskContext.createImageData(viewMaskCanvas.width,viewMaskCanvas.height),columnTop=[],columnBottom=[];
      for(let x=screenLeft;x<screenRight;x++){
       let top=screenTop,bottom=screenBottom;
       for(let y=screenTop;y<screenTop+viewMaskCanvas.height*.25;y++)if(isBlue(x,y))top=y;
       for(let y=screenBottom;y>screenBottom-viewMaskCanvas.height*.25;y--)if(isBlue(x,y))bottom=y;
       columnTop[x-screenLeft]=top;columnBottom[x-screenLeft]=bottom;
      }
      for(let y=screenTop+4;y<screenBottom-4;y++){
       let left=screenLeft,right=screenRight;
       for(let x=screenLeft;x<screenLeft+screenWidth*.2;x++)if(isBlue(x,y))left=x;
       for(let x=screenRight;x>screenRight-screenWidth*.2;x--)if(isBlue(x,y))right=x;
       for(let x=left+3;x<right-3;x++)if(y>columnTop[x-screenLeft]+3&&y<columnBottom[x-screenLeft]-3){const i=((y-screenTop)*viewMaskCanvas.width+x-screenLeft)*4;maskPixels.data[i]=maskPixels.data[i+1]=maskPixels.data[i+2]=maskPixels.data[i+3]=255;}
      }
      maskContext.putImageData(maskPixels,0,0);
      viewMask.needsUpdate=true;viewBounds.value.set([screenLeft/canvas.width,1-screenBottom/canvas.height,screenRight/canvas.width,1-screenTop/canvas.height]);viewReady.value=1;
      photo.userData.liveViewscreen={bounds:Array.from(viewBounds.value),source:'shared-world-starfield',texture:viewTexture,mask:viewMask};
     }
    }
    for(let i=0;i<=128;i++){
     const angle=Math.PI*2-gap-coverage*i/128,x=i===64?0:Math.sin(angle)*paintRadius,z=i===64?centerZ-paintRadius:centerZ+Math.cos(angle)*paintRadius,u=i===64?screenCenterU:screenCenterU+(Math.PI-angle)/arc;
     positions.setXYZ(i*2,x,floorY,z);positions.setXYZ(i*2+1,x,ceilingY,z);
     uv.setXY(i*2,u,0);uv.setXY(i*2+1,u,1);
    }
    positions.needsUpdate=true;uv.needsUpdate=true;photoGeometry.computeVertexNormals();photoGeometry.computeBoundingSphere();
    panorama.image=canvas;panorama.needsUpdate=true;photo.visible=true;
    photo.userData.wallMapping={image:'assets/reference/bridge-front-wall.png',imageAspect,imageWorldWidth,paintRadius,fit:'wall-height',preserveAspect:true,arcRadians:arc,coverageRadians:coverage,repeats:1,hatchGapRadians:2*gap,centerAngle:Math.PI,screenCenterU,screenLocated:Number.isFinite(screenLeft),wallHeight,fullHeight:true,foremost:true,repeatAroundRoom:false,singlePanorama:true,leftToRight:true};resolve();
   };
   image.onerror=()=>reject(new Error('Could not load the bridge front-wall panorama.'));
   imageSource().then(source=>{image.src=source;}).catch(reject);
  });
  room.ready=Promise.all([wallReady,ceilingReady]);
  room.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=false;object.userData.bridgeNoShadows=true;}});
  const light=new T.Light(0x6ca8ff,.00084);light.isPointLight=true;light.type='PointLight';light.distance=.14;light.decay=2;light.name='bridge-dome-light-emitter';light.position.set(0,capY-diffuserHeight-.0004,centerZ);room.add(light);
  room.userData.circularRoom={radius,centerZ,bridgeScale,sinkOffset,wallHeightScale,entranceZ:throatStart,corridorLength:doorZ-throatStart,floorY:floorY+centerY,corridorFloorY:corridorFloorY+centerY,ceilingY:ceilingY+centerY,entranceWidth:halfEntrance*2,matteRed:true};
  return room;
 };
 const api={open:false,toggle(){this.open=!this.open;}};window.BridgeHatch=api;
 window.addEventListener('keydown',event=>{
  if(event.key.toLowerCase()!=='h'||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.defaultPrevented)return;
  if(event.target?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])')||document.querySelector('dialog[open]'))return;
  event.preventDefault();api.toggle();
 });
 // Remove only the aft entrance from the dome shell, preserving all attributes.
 window.carveBridgeHatch=(T,dome,{centerY,cutPlanes,tag='bridgeHatchOpening'})=>{
  dome.updateMatrix();const inverse=dome.matrix.clone().invert(),old=dome.geometry,attributes=Object.entries(old.attributes),offsets=[];let stride=0;
  for(const [,attribute]of attributes){offsets.push(stride);stride+=attribute.itemSize;}
  const pos=attributes.findIndex(([name])=>name==='position'),p0=offsets[pos],output=attributes.map(()=>[]),groups=[],index=old.index,total=index?index.count:old.attributes.position.count;
  // This concealed rectangular throat is wider than the round exterior aperture,
  // so oblique views cannot catch remnants of the curved shell inside the passage.
  const planes=cutPlanes||[[0,0,1,-1.446],[0,0,-1,1.4835],[1,0,0,.0104],[-1,0,0,.0104],[0,1,0,centerY+.0145],[0,-1,0,.0185-centerY]];
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
  geometry.userData={...old.userData,[tag]:true};dome.geometry=geometry;old.dispose();
 };
})();
