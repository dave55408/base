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
  const ceilingY=corridorFloorY+baseWallHeight-sinkOffset,floorY=ceilingY-baseWallHeight*1.2,halfEntrance=.0084,corridorCeilingY=.0095;
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
  const deckMaterial=new T.MeshStandardMaterial({color:0x090a0c,roughness:1,metalness:0,side:T.DoubleSide});
  const lowerRadius=radius*.64,depth=baseWallHeight*.25,lowerFloor=floorY-depth;
  // Pair the circular boundary with the sunken opening. Close the ring at
  // the corridor mouth; a separate solid staircase connects it to the hatch.
  const deckPositions=[],deckIndices=[];
  for(let i=0;i<=128;i++){const [x,z]=outline[i],d=Math.hypot(x,z-centerZ);deckPositions.push(x,floorY,z,x/d*lowerRadius,floorY,centerZ+(z-centerZ)/d*lowerRadius);}
  for(let i=0;i<=128;i++){const j=i*2,k=((i+1)%129)*2;deckIndices.push(j,k,k+1,j,k+1,j+1);}
  surface('bridge-room-floor',deckPositions,deckIndices).material=deckMaterial;
  const sunken=new T.Group();sunken.name='bridge-room-sunken-room';room.add(sunken);
  const lowerPositions=[0,lowerFloor,centerZ],lowerIndices=[];
  for(let i=0;i<=128;i++){const angle=i*Math.PI/64;lowerPositions.push(Math.sin(angle)*lowerRadius,lowerFloor,centerZ+Math.cos(angle)*lowerRadius);if(i<128)lowerIndices.push(0,i+2,i+1);}
  const lowerDeck=surface('bridge-room-sunken-floor',lowerPositions,lowerIndices);lowerDeck.material=deckMaterial;sunken.add(lowerDeck);
  const stairWidth=.012*bridgeScale,stairGap=Math.asin(stairWidth/2/lowerRadius),wallPositions=[],wallIndices=[];
  const stairways=[{clock:6,angle:0},{clock:2,angle:Math.PI*2/3},{clock:10,angle:Math.PI*4/3}];
  for(let section=0;section<stairways.length;section++){
   const start=stairways[section].angle+stairGap,end=(stairways[section+1]?.angle??Math.PI*2)-stairGap,base=wallPositions.length/3;
   for(let i=0;i<=48;i++){const angle=start+(end-start)*i/48,x=Math.sin(angle)*lowerRadius,z=centerZ+Math.cos(angle)*lowerRadius;wallPositions.push(x,lowerFloor,z,x,floorY,z);if(i<48){const j=base+i*2;wallIndices.push(j,j+2,j+3,j,j+3,j+1);}}
  }
  const lowerWall=surface('bridge-room-sunken-wall',wallPositions,wallIndices);lowerWall.material=deckMaterial;sunken.add(lowerWall);
  const stairStart=Math.sqrt(lowerRadius*lowerRadius-(stairWidth/2)**2),run=.020*bridgeScale,stepCount=7;
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
  const corridorDrop=corridorFloorY-floorY,corridorTreads=4,landing=.003,stairBack=doorZ-landing,corridorTread=(stairBack-entranceZ)/corridorTreads;
  const corridorProfile=[[doorZ,floorY-.00005],[entranceZ,floorY-.00005],[entranceZ,floorY]];
  for(let i=corridorTreads-1;i>=0;i--){const z=stairBack-i*corridorTread;corridorProfile.push([z,corridorFloorY-corridorDrop*(i+1)/corridorTreads],[z,corridorFloorY-corridorDrop*i/corridorTreads]);}
  corridorProfile.push([doorZ,corridorFloorY]);
  const entryStairs=makeSolidStair('bridge-corridor-entry-stairs',corridorProfile,halfEntrance*2);
  entryStairs.userData.stairway={treads:corridorTreads,riserHeight:corridorDrop/corridorTreads,treadDepth:corridorTread,thresholdY:corridorFloorY+centerY,bridgeFloorY:floorY+centerY,drop:corridorDrop,closedSolid:true};
  sunken.userData.sunkenRoom={radius:lowerRadius,centerZ:portZ+centerZ,diameterRatio:.64,height:depth,heightRatio:depth/(ceilingY-floorY),floorY:lowerFloor+centerY,upperFloorY:floorY+centerY,steps:stepCount-1,stairways:stairways.map(s=>s.clock),twelveOClock:'fore',connected:true};
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
  function ceilingPatch(name,start,end,material,offset=0,inner=.2,outer=1,flat=false){
   const positions=[],indices=[],uv=[],radialSteps=20,angularSteps=name.includes('seam')?1:name.includes('cap')?128:24;
   for(let r=0;r<=radialSteps;r++)for(let a=0;a<=angularSteps;a++){
    const t=inner+(outer-inner)*r/radialSteps,angle=start+(end-start)*a/angularSteps;
    positions.push(Math.sin(angle)*radius*t,ceilingY+rise*(1-(flat ? .04 : t*t))+offset,centerZ+Math.cos(angle)*radius*t);
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
  const capCanvas=document.createElement('canvas');capCanvas.width=capCanvas.height=1024;
  const capTexture=new T.CanvasTexture(capCanvas);capTexture.colorSpace=T.SRGBColorSpace;capTexture.anisotropy=8;
  const capPaint=new T.MeshStandardMaterial({color:0xffffff,map:capTexture,emissive:0xffffff,emissiveMap:capTexture,emissiveIntensity:.6,roughness:1,metalness:0,side:T.DoubleSide});
  const cap=ceilingPatch('bridge-room-ceiling-center-cap',0,Math.PI*2,capPaint,0,0,.2,true),capPositions=cap.geometry.attributes.position,capUV=cap.geometry.attributes.uv;
  // Planar coordinates put the top of the artwork at the ship's fore (-Z).
  for(let i=0;i<capPositions.count;i++)capUV.setXY(i,.5+capPositions.getX(i)/(radius*.4),.5-(capPositions.getZ(i)-centerZ)/(radius*.4));
  cap.userData.artworkMapping={image:'assets/reference/bridge-ceiling-center.png',foreAtImageTop:true,fit:'center-cover'};
  const capReady=new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{const side=Math.min(image.naturalWidth,image.naturalHeight);capCanvas.getContext('2d').drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,1024,1024);capTexture.needsUpdate=true;capPaint.userData.artworkLoaded=true;resolve();};
   image.onerror=()=>reject(new Error('Could not load the circular ceiling artwork.'));
   imageSource('bridge-ceiling-center','BRIDGE_CEILING_CENTER_IMAGE').then(source=>{image.src=source;}).catch(reject);
  });
  ceilingPatch('bridge-room-ceiling-cap-rim',0,Math.PI*2,seamMaterial,-.000025,.198,.202,true);
  const throatStart=centerZ+Math.sqrt(radius*radius-halfEntrance*halfEntrance);
  const throat=surface('bridge-room-entrance-ceiling',[-halfEntrance,ceilingY,throatStart,halfEntrance,ceilingY,throatStart,halfEntrance,corridorCeilingY,doorZ,-halfEntrance,corridorCeilingY,doorZ],[0,1,2,0,2,3]);
  throat.material=new T.MeshStandardMaterial({color:0x303236,roughness:1,metalness:0,side:T.DoubleSide});ceiling.add(throat);
  ceiling.userData.domeCeiling={sections:8,radius,rise,riseScale:1.375,centerCapRadius:radius*.2,centerCapDiameterRatio:.2,artwork:'assets/reference/bridge-ceiling-panel.png',springY:ceilingY+centerY,apexY:ceilingY+centerY+rise*.96};
  const p=[],indices=[];
  // The circular skin stops at the corridor. Its two straight side walls are
  // closed solids below, rather than exposed single sheets.
  for(let i=0;i<outline.length;i++){const [x,z]=outline[i];p.push(x,i<=128?floorY:corridorFloorY,z,x,i<=128?ceilingY:corridorCeilingY,z);}
  for(let i=0;i<128;i++){
   const a=i*2,b=((i+1)%outline.length)*2;indices.push(a,b,b+1,a,b+1,a+1);
  }
  const entranceWalls=surface('bridge-room-curved-wall-and-entrance',p,indices);
  entranceWalls.material=new T.MeshStandardMaterial({color:0x303236,roughness:1,metalness:0,side:T.DoubleSide});
  for(const side of [-1,1]){
   const positions=[],thickness=.0006;
   for(const x of [side*halfEntrance,side*(halfEntrance+thickness)])positions.push(x,floorY,entranceZ,x,ceilingY,entranceZ,x,corridorCeilingY,doorZ,x,floorY,doorZ);
   const mesh=surface('bridge-corridor-'+(side<0?'port':'starboard')+'-wall',positions,[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);
   mesh.material=entranceWalls.material;mesh.userData.wallThickness=thickness;
  }
  // Wrap the full panorama once, in left-to-right image order. Its large screen
  // is near the left edge of the artwork, and is aligned directly fore (-Z).
  const placeholder=document.createElement('canvas');placeholder.width=placeholder.height=1;
  const panorama=new T.CanvasTexture(placeholder);panorama.colorSpace=T.SRGBColorSpace;panorama.anisotropy=8;panorama.wrapS=T.RepeatWrapping??1000;
  const wallPaint=new T.MeshStandardMaterial({color:0xffffff,map:panorama,emissive:0xffffff,emissiveMap:panorama,emissiveIntensity:.45,roughness:1,metalness:0,side:T.DoubleSide});
  const photoGeometry=new T.BufferGeometry(),photoPositions=new Float32Array(129*2*3),photoUV=[],photoIndices=[];
  for(let i=0;i<=128;i++){photoUV.push(i/128,0,i/128,1);if(i<128){const j=i*2;photoIndices.push(j,j+2,j+3,j,j+3,j+1);}}
  photoGeometry.setAttribute('position',new T.Float32BufferAttribute(photoPositions,3));photoGeometry.setAttribute('uv',new T.Float32BufferAttribute(photoUV,2));photoGeometry.setIndex(photoIndices);
  const photo=new T.Mesh(photoGeometry,wallPaint);photo.name='bridge-room-front-panorama';photo.visible=false;room.add(photo);
  const wallReady=new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{
    const imageAspect=image.naturalWidth/image.naturalHeight,paintRadius=radius-.00003,wallHeight=ceilingY-floorY,arc=Math.PI*2,positions=photoGeometry.attributes.position,uv=photoGeometry.attributes.uv,coverage=Math.PI*2-2*gap;
    // Decode into a bounded canvas for GPUs with an 8192-pixel texture limit.
    const canvas=document.createElement('canvas');canvas.width=Math.min(8192,image.naturalWidth);canvas.height=Math.round(canvas.width/imageAspect);
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
    // Locate the blue outline of the large viewscreen in the first panel.
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let screenLeft=Infinity,screenRight=-Infinity;
    for(let y=Math.floor(canvas.height*.27);y<canvas.height*.72;y++)for(let x=Math.floor(canvas.width*.06);x<canvas.width*.15;x++){
     const i=(y*canvas.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(b>100&&b>r*1.7&&b>g*1.2){screenLeft=Math.min(screenLeft,x);screenRight=Math.max(screenRight,x);}
    }
    const screenCenterU=Number.isFinite(screenLeft)?(screenLeft+screenRight)/(2*canvas.width):.1;
    for(let i=0;i<=128;i++){
     const angle=Math.PI*2-gap-coverage*i/128,x=Math.sin(angle)*paintRadius,z=centerZ+Math.cos(angle)*paintRadius,u=screenCenterU+(Math.PI-angle)/arc;
     positions.setXYZ(i*2,x,floorY,z);positions.setXYZ(i*2+1,x,ceilingY,z);
     uv.setXY(i*2,u,0);uv.setXY(i*2+1,u,1);
    }
    positions.needsUpdate=true;uv.needsUpdate=true;photoGeometry.computeVertexNormals();photoGeometry.computeBoundingSphere();
    panorama.image=canvas;panorama.needsUpdate=true;photo.visible=true;
    photo.userData.wallMapping={image:'assets/reference/bridge-front-wall.png',imageAspect,arcRadians:arc,coverageRadians:coverage,repeats:coverage/arc,hatchGapRadians:2*gap,centerAngle:Math.PI,screenCenterU,screenLocated:Number.isFinite(screenLeft),wallHeight,fullHeight:true,foremost:true,repeatAroundRoom:true,singlePanorama:true,leftToRight:true};resolve();
   };
   image.onerror=()=>reject(new Error('Could not load the bridge front-wall panorama.'));
   imageSource().then(source=>{image.src=source;}).catch(reject);
  });
  room.ready=Promise.all([wallReady,ceilingReady,capReady]);
  const light=new T.Light(0xffe4d6,.0007);light.isPointLight=true;light.type='PointLight';light.distance=.14;light.decay=2;light.name='bridge-room-soft-light';light.position.set(0,ceilingY-.0015,centerZ);room.add(light);
  room.userData.circularRoom={radius,centerZ,bridgeScale,sinkOffset,wallHeightScale:1.2,entranceZ:throatStart,corridorLength:doorZ-throatStart,floorY:floorY+centerY,corridorFloorY:corridorFloorY+centerY,ceilingY:ceilingY+centerY,entranceWidth:halfEntrance*2,matteRed:true};
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
