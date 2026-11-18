/* Simple reference-shaped helm furniture. Each solid has planar UV faces. */
window.createBridgeHelmConsole=(T,{floorY,centerZ})=>{
 // Bridge coordinates use kilometres; move the entire helm assembly one foot fore.
 const forwardOffset=.004+.0003048,platformHeight=.00124;
 const furniture=new T.Group();furniture.name='bridge-front-helm';furniture.position.set(0,floorY,centerZ-forwardOffset);
 furniture.scale.setScalar(.9);
 const paint=(color,roughness=.8)=>new T.MeshStandardMaterial({color,roughness,metalness:0});
 const black=paint(0x161719,.48),red=paint(0x8d2520),gray=paint(0x8b8b83),dark=paint(0x24282b),shell=paint(0x8995ad),cushion=paint(0x111214,.6);
 const chairMetal=new T.MeshStandardMaterial({color:0x34383d,roughness:.32,metalness:.8});
 const artworkReady=[];
 function artwork(name){
  const placeholder=document.createElement('canvas');placeholder.width=placeholder.height=1;
  const texture=new T.CanvasTexture(placeholder);texture.name='helm-'+name;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const material=name==='chair_arrows.png'?new T.MeshBasicMaterial({map:texture,toneMapped:false}):new T.MeshStandardMaterial({map:texture,roughness:.14,metalness:.12,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.2,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});material.userData.helmArtwork=name;
  artworkReady.push(new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>{texture.image=image;texture.needsUpdate=true;resolve();};
   image.onerror=()=>reject(new Error('Could not load helm artwork: '+name));
   image.src=location.protocol==='file:'?window.BRIDGE_HELM_IMAGES[name]:'assets/reference/helm/'+name+(name==='chair_arrows.png'?'?v=27':'');
  }));
  return material;
 }
 function topArtwork(mesh,material){
  mesh.material[2]=material;
  // Top of each photograph faces the viewscreen; left remains port from the seats.
  const uv=mesh.geometry.attributes.uv;for(let i=8;i<12;i++)uv.setY(i,1-uv.getY(i));uv.needsUpdate=true;
 }
 // Separate vertices and unit-square UVs make each face ready for a photograph.
 function solid(name,corners,materials,parent=furniture){
  const faces=[[0,3,2,1],[4,5,6,7],[3,7,6,2],[0,1,5,4],[0,4,7,3],[1,2,6,5]],positions=[],uv=[],indices=[];
  const geometry=new T.BufferGeometry();
  for(const [face,vertices]of faces.entries()){
   for(const i of vertices)positions.push(...corners[i]);
   uv.push(0,0,0,1,1,1,1,0);const a=face*4;
   indices.push(a,a+1,a+2,a,a+2,a+3);geometry.addGroup(face*6,6,face);
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,Array.isArray(materials)?materials:Array(6).fill(materials));mesh.name=name;
  mesh.userData.textureFaces=['front','back','top','bottom','port','starboard'];parent.add(mesh);return mesh;
 }
 function wedge(name,x,width,front,rear,bottom,frontTop,rearTop,materials){
  const l=x-width/2,r=x+width/2;
  return solid(name,[[l,bottom,front],[r,bottom,front],[r,frontTop,front],[l,frontTop,front],[l,bottom,rear],[r,bottom,rear],[r,rearTop,rear],[l,rearTop,rear]],materials);
 }
 function box(name,x,y,z,w,h,d,material,parent=furniture){
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 function chairShellGeometry(){
  // A single thick, cupped sheet flows from the seat pan into the tall back.
  // Color changes share vertices and normals rather than separate back pieces.
  const controls=[
   [.0045,.0003,-.0036,.00015],[.00425,.0018,-.0033,.00025],[.00405,.0032,-.0024,.0005],
   [.0040,.0039,0,.00055],[.0044,.0036,.0018,.0005],
   [.0055,.00335,.0027,.0004],[.0080,.00275,.0031,.00032],
   [.0125,.0017,.00385,.0002],[.0140,.00155,.00385,.00015]
  ],profiles=[],columns=24,positions=[],uv=[],blue=[],upper=[],thickness=.0003;
  for(let row=0;row<controls.length-1;row++)for(let step=0;step<6;step++){
   const t=step/6,a=controls[Math.max(0,row-1)],b=controls[row],c=controls[row+1],d=controls[Math.min(controls.length-1,row+2)];
   profiles.push(b.map((value,i)=>.5*(2*value+(-a[i]+c[i])*t+(2*a[i]-5*value+4*c[i]-d[i])*t*t+(-a[i]+3*value-3*c[i]+d[i])*t*t*t)));
  }
  profiles.push(controls.at(-1));
  const stride=columns+1,skinSize=profiles.length*stride;
  for(let skin=0;skin<2;skin++)for(let row=0;row<profiles.length;row++){
   const [y,width,z,cup]=profiles[row],before=profiles[Math.max(0,row-1)],after=profiles[Math.min(profiles.length-1,row+1)],dy=after[0]-before[0],dz=after[2]-before[2],length=Math.hypot(dy,dz),ny=dz/length,nz=-dy/length;
   for(let i=0;i<=columns;i++){
    const t=i/columns*2-1,offset=cup*t*t-(skin?thickness:0),roundTop=Math.max(0,(row/(profiles.length-1)-.9)/.1)*.00025*t*t,roundFront=.0002*t*t*Math.max(0,1-row/(profiles.length-1)/.22),roundBlue=.00085*t**4*Math.max(0,1-Math.abs(y-.0080)/.002);
    positions.push(t*width,y+ny*offset-roundTop-roundBlue,z+nz*offset+roundFront);uv.push(i/columns,row/(profiles.length-1));
   }
  }
  function triangle(a,b,c){const y=[a,b,c].reduce((sum,i)=>sum+profiles[Math.floor((i%skinSize)/stride)][0]/3,0);(y>.0080?upper:blue).push(a,b,c);}
  for(let row=0;row<profiles.length-1;row++)for(let i=0;i<columns;i++){
   const a=row*stride+i,b=a+1,c=a+stride,d=c+1;
   triangle(a,c,b);triangle(b,c,d);
   triangle(a+skinSize,b+skinSize,c+skinSize);triangle(b+skinSize,d+skinSize,c+skinSize);
  }
  const border=[];for(let i=0;i<=columns;i++)border.push(i);for(let row=1;row<profiles.length;row++)border.push(row*stride+columns);for(let i=columns-1;i>=0;i--)border.push((profiles.length-1)*stride+i);for(let row=profiles.length-2;row>0;row--)border.push(row*stride);
  for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length];triangle(a,b,a+skinSize);triangle(b,b+skinSize,a+skinSize);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex([...blue,...upper]);geometry.addGroup(0,blue.length,0);geometry.addGroup(blue.length,upper.length,1);geometry.computeVertexNormals();return geometry;
 }
 // Follow the rear surface so the supplied transparent insignia wraps with the
 // plastic. The shell's row 36 is the continuous, rounded blue/black boundary.
 function chairArrowsGeometry(shellGeometry){
  const source=shellGeometry.attributes.position,stride=25,skinSize=source.count/2,positions=[],uv=[],indices=[];
  const firstRow=28,lastRow=36,firstColumn=6,lastColumn=18,width=lastColumn-firstColumn+1;
  // Hold the horizontal span and center; reduce the surface span by 10%.
  const referenceRow=29;
  for(let row=firstRow;row<=lastRow;row++)for(let column=firstColumn;column<=lastColumn;column++){
   const sampleRow=(firstRow+lastRow)/2+(row-(firstRow+lastRow)/2)*.9,lower=Math.floor(sampleRow),rowBlend=sampleRow-lower;
   const at=(r,c,axis)=>source[axis](skinSize+r*stride+c);
   const shellWidth=at(lower,24,'getX')*(1-rowBlend)+at(lower+1,24,'getX')*rowBlend;
   const x=source.getX(skinSize+referenceRow*stride+column),sample=(x/shellWidth+1)*12,left=Math.floor(sample),blend=sample-left;
   const surface=axis=>(at(lower,left,axis)*(1-blend)+at(lower,left+1,axis)*blend)*(1-rowBlend)+(at(lower+1,left,axis)*(1-blend)+at(lower+1,left+1,axis)*blend)*rowBlend;
   positions.push(x,surface('getY'),surface('getZ')+.000015);
   uv.push((column-firstColumn)/(lastColumn-firstColumn),(row-firstRow)/(lastRow-firstRow));
   if(row<lastRow&&column<lastColumn){const a=(row-firstRow)*width+column-firstColumn;indices.push(a,a+1,a+width,a+1,a+width+1,a+width);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 const platform=new T.Group();platform.name='bridge-helm-platform';furniture.add(platform);
 const deck=paint(0x252321,1);
 box('bridge-helm-platform-base',0,.0006,-.0027,.032,.0012,.0204,black,platform);
 box('bridge-helm-platform-deck',0,.00122,-.0027,.0308,.00004,.0192,deck,platform);
 const consoleGroup=new T.Group();consoleGroup.name='bridge-helm-console';consoleGroup.position.y=platformHeight;furniture.add(consoleGroup);
 const consoleTop=.009325,polishedBlack=paint(0x080808,.12);polishedBlack.metalness=.18;
 const consolePitch=.25,consoleTopAt=z=>consoleTop-consolePitch*(z+.011);
 function topTrim(name,x,z,width,height,depth){
  const front=z-depth/2,rear=z+depth/2;
  const trim=wedge(name,x,width,front,rear,consoleTopAt(rear)-height,consoleTopAt(front),consoleTopAt(rear),polishedBlack);consoleGroup.add(trim);return trim;
 }
 for(const [side,label]of [[-1,'port'],[1,'starboard']]){
  const wing=wedge('bridge-helm-'+label+'-desk',side*.0098,.0112,-.0121,-.0038,.0036,consoleTopAt(-.0121),consoleTopAt(-.0038),[red,black,black,black,red,red]);consoleGroup.add(wing);
  topArtwork(wing,artwork(side<0?'sulu.png':'checkov.png'));
  box('bridge-helm-'+label+'-support',side*.010,.0033,-.0074,.0048,.0066,.0048,dark,consoleGroup);
 }
 const forwardBar=wedge('bridge-helm-forward-panel',0,.0078,-.0121,-.0103,.0036,consoleTopAt(-.0121),consoleTopAt(-.0103),[red,black,polishedBlack,dark,red,red]);consoleGroup.add(forwardBar);
 topArtwork(forwardBar,artwork('front_bar.png'));
 // Frosted translucent housing centered in the gap between the button banks.
 // A broad rectangular foot slopes inward to a smaller, flat rectangular cap.
 const barGlass=new T.MeshStandardMaterial({color:0xc8c5b8,roughness:.4,metalness:0,transparent:true,opacity:.64,depthWrite:false});
 solid('bridge-helm-front-bar-center',[
  [-.00088,consoleTopAt(-.011575)+.00001,-.011575],[.00088,consoleTopAt(-.011575)+.00001,-.011575],[.00060,consoleTopAt(-.01135)+.00096,-.01135],[-.00060,consoleTopAt(-.01135)+.00096,-.01135],
  [-.00088,consoleTopAt(-.010825)+.00001,-.010825],[.00088,consoleTopAt(-.010825)+.00001,-.010825],[.00060,consoleTopAt(-.01105)+.00096,-.01105],[-.00060,consoleTopAt(-.01105)+.00096,-.01105]
 ],barGlass,consoleGroup);
 // Reference outline: a broad rectangular instrument housing, square shoulders,
 // then a narrower rectangular extension with square shoulder corners.
 const navigationOutline=[[-.0039,-.0102],[.0039,-.0102],[.0039,.0007],[.0021,.0007],[.0021,.005],[-.0021,.005],[-.0021,.0007],[-.0039,.0007]];
 const fasciaTop=consoleTopAt(-.0121),fasciaBottom=.0036,fasciaWidth=.03155;
 const navigationFrontHeight=fasciaBottom+(fasciaTop-fasciaBottom)*2/3,navigationRearHeight=.0044*2/3;
 const navigationTop=z=>navigationFrontHeight+(navigationRearHeight-navigationFrontHeight)*(z+.0102)/.0152;
 const navigationPositions=[],navigationUv=[],navigationIndices=[],navigationGeometry=new T.BufferGeometry();
 for(const top of [true,false])for(const [x,z]of navigationOutline){
  navigationPositions.push(top?x:x*(.0019/.0039),top?navigationTop(z):.0001,z);
  navigationUv.push((x+.0039)/.0078,(z+.0102)/.0152);
 }
 // Split the wide cap at both shoulders so the neck shares complete edges.
 const navigationCap=[0,7,6,0,6,3,0,3,1,1,3,2,6,5,4,6,4,3];
 navigationIndices.push(...navigationCap);navigationGeometry.addGroup(0,navigationCap.length,0);
 for(let i=0;i<navigationCap.length;i+=3)navigationIndices.push(navigationCap[i]+8,navigationCap[i+2]+8,navigationCap[i+1]+8);
 navigationGeometry.addGroup(navigationCap.length,navigationCap.length,1);
 for(let i=0;i<navigationOutline.length;i++){
  const j=(i+1)%navigationOutline.length,start=navigationPositions.length/3,indexStart=navigationIndices.length;
  for(const k of [i+8,i,j,j+8])navigationPositions.push(...navigationPositions.slice(k*3,k*3+3));
  navigationUv.push(0,0,0,1,1,1,1,0);navigationIndices.push(start,start+1,start+2,start,start+2,start+3);navigationGeometry.addGroup(indexStart,6,1);
 }
 navigationGeometry.setAttribute('position',new T.Float32BufferAttribute(navigationPositions,3));navigationGeometry.setAttribute('uv',new T.Float32BufferAttribute(navigationUv,2));navigationGeometry.setIndex(navigationIndices);navigationGeometry.computeVertexNormals();
 const navigation=new T.Mesh(navigationGeometry,[gray,gray]);navigation.name='bridge-helm-navigation-pedestal';navigation.userData.textureFaces=['top','bottom','front','starboard-body','starboard-shoulder','starboard-neck','rear','port-neck','port-shoulder','port-body'];consoleGroup.add(navigation);
 // The instrument housing stays behind the red fascia.
 const navigationImageFront=-.00985,navigationImageRear=.00056375;
 const navigationPanel=wedge('bridge-helm-navigation-image-panel',0,.007605,navigationImageFront,navigationImageRear,navigationTop(navigationImageRear)-.0001,navigationTop(navigationImageFront)+.00003,navigationTop(navigationImageRear)+.00003,gray);consoleGroup.add(navigationPanel);
 topArtwork(navigationPanel,artwork('navigator.png'));
 const chronPanel=wedge('bridge-helm-chron-image-panel',0,.0034,.0013,.00275,navigationTop(.00275)-.0001,navigationTop(.0013)+.00003,navigationTop(.00275)+.00003,gray);consoleGroup.add(chronPanel);
 topArtwork(chronPanel,artwork('chron.png'));
 for(const part of [navigation,navigationPanel,chronPanel])part.scale.x=.9;
 // A separate plain V has a horizontal gray cap extending back into the helm.
 // Its dark side faces replace the exposed gray instrument-housing pieces.
 const vTop=navigationFrontHeight,vBottom=.0001,vFront=-.0132,vRear=-.0118,vHalfTop=.0039*.9,vHalfBottom=.0019*.9;
 const projection=solid('bridge-helm-front-v-projection',[
  [-vHalfBottom,vBottom,vFront],[vHalfBottom,vBottom,vFront],[vHalfTop,vTop,vFront],[-vHalfTop,vTop,vFront],
  [-vHalfBottom,vBottom,vRear],[vHalfBottom,vBottom,vRear],[vHalfTop,vTop,vRear],[-vHalfTop,vTop,vRear]
 ],[gray,gray,gray,gray,dark,dark],consoleGroup);
 projection.userData={flatGrayTop:true,topHeightRatio:2/3,projectsIntoConsole:true};
 // One flat red fascia and full-width glossy rails, with square outer corners.
 const fascia=box('bridge-helm-front-fascia',0,(fasciaTop+fasciaBottom)/2,-.0122,.031,fasciaTop-fasciaBottom,.0002,red,consoleGroup);
 fascia.userData.continuousFront=true;
 topTrim('bridge-helm-front-trim',0,-.0122,fasciaWidth,.00055,.0006);
 box('bridge-helm-front-bottom-trim',0,fasciaBottom,-.0122,fasciaWidth,.00055,.0006,polishedBlack,consoleGroup);
 for(const [side,label]of [[-1,'port'],[1,'starboard']]){
  box('bridge-helm-'+label+'-front-edge',side*.0155,(fasciaBottom+consoleTopAt(-.0122))/2,-.0122,.00055,consoleTopAt(-.0122)-fasciaBottom,.0006,polishedBlack,consoleGroup);
  topTrim('bridge-helm-'+label+'-bar-edge',side*.00395,-.01125,.0003,.00055,.0019);
  topTrim('bridge-helm-'+label+'-top-edge',side*.0155,-.00795,.00055,.00055,.0085);
  box('bridge-helm-'+label+'-bottom-edge',side*.0155,.0036,-.00795,.00055,.00055,.0085,polishedBlack,consoleGroup);
  box('bridge-helm-'+label+'-rear-edge',side*.0155,(.0036+consoleTopAt(-.0038))/2,-.0038,.00055,consoleTopAt(-.0038)-.0036,.00055,polishedBlack,consoleGroup);
  topTrim('bridge-helm-'+label+'-rear-top-edge',side*.0099875,-.0038,.011575,.00055,.00055);
 }
 // Each crossed foot narrows in width and thickness toward soft, rounded ends.
 function chairFootGeometry(){
  const positions=[],uv=[],indices=[],rings=32,sides=12;
  for(let row=0;row<=rings;row++){
   const angle=-Math.PI/2+Math.PI*row/rings,x=.0033*Math.sin(angle),t=Math.abs(x)/.0033;
   const taper=(1-.55*t**1.5)*Math.min(1,Math.cos(angle)/.35);
   for(let column=0;column<=sides;column++){
    const around=column/sides*Math.PI*2;
    positions.push(x,.000275*taper*Math.sin(around),.000425*taper*Math.cos(around));uv.push(row/rings,column/sides);
    if(row<rings&&column<sides){const a=row*(sides+1)+column,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1);}
   }
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 const chairFeet=chairFootGeometry();
 const chairs=[],chairArtwork=artwork('chair_arrows.png'),chairArrowMaterial=shell.clone();
 chairArrowMaterial.map=chairArtwork.map;
 chairArrowMaterial.transparent=true;chairArrowMaterial.opacity=.5;chairArrowMaterial.depthWrite=false;
 // Blend dark details and faint pale highlights into the same lit blue plastic.
 chairArrowMaterial.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   #ifdef USE_MAP
    float arrowLightness = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float arrowDark = clamp((0.145 - arrowLightness) * 30.0, 0.0, 1.0);
    float arrowHighlight = smoothstep(0.17, 0.21, arrowLightness) * 0.22;
    diffuseColor.a *= max(arrowDark, arrowHighlight);
    diffuseColor.rgb = mix(diffuse * 0.55, mix(diffuse, vec3(1.0), 0.25), arrowHighlight / max(arrowDark + arrowHighlight, 0.0001));
   #endif`);
 };
 chairArrowMaterial.customProgramCacheKey=()=> 'shell-blended-chair-arrows-highlights';
 chairArrowMaterial.polygonOffset=true;chairArrowMaterial.polygonOffsetFactor=-1;chairArrowMaterial.polygonOffsetUnits=-1;
 for(const [side,label]of [[-1,'port'],[1,'starboard']]){
  const chair=new T.Group();chair.name='bridge-helm-'+label+'-chair';chair.position.set(side*.0096,platformHeight,.002);furniture.add(chair);chairs.push(chair);
  const stem=new T.Mesh(new T.CylinderGeometry(.000375,.00045,.0035,24),chairMetal);stem.name=chair.name+'-pedestal';stem.position.y=.0019;chair.add(stem);
  for(const [i,angle]of [Math.PI/4,Math.PI*3/4].entries()){const foot=new T.Mesh(chairFeet,chairMetal);foot.name=chair.name+'-foot-'+i;foot.position.y=.00028;foot.rotation.y=angle;chair.add(foot);}
  const seat=new T.Mesh(chairShellGeometry(),[shell,black]);seat.name=chair.name+'-shell';chair.add(seat);
  const arrows=new T.Mesh(chairArrowsGeometry(seat.geometry),chairArrowMaterial);arrows.name=chair.name+'-arrows';chair.add(arrows);
  const pad=new T.Mesh(new T.SphereGeometry(1,16,10),cushion);pad.name=chair.name+'-seat';pad.scale.set(.0035,.0005,.0035);pad.position.set(0,.00465,-.0009);chair.add(pad);
  const backPadGeometry=new T.SphereGeometry(1,24,16),bp=backPadGeometry.attributes.position;
  for(let i=0;i<bp.count;i++){
   const y=.010975+Math.sign(bp.getY(i))*Math.abs(bp.getY(i))**.35*.002875,t=(y-.0081)/.00575,width=.00255*(1-t)+.0013*t,z=.0030+t*.00085;
   bp.setXYZ(i,Math.sign(bp.getX(i))*Math.abs(bp.getX(i))**.35*width,y,z-.0003+Math.sign(bp.getZ(i))*Math.abs(bp.getZ(i))**.45*.00035);
  }
  bp.needsUpdate=true;backPadGeometry.computeVertexNormals();
  const backPad=new T.Mesh(backPadGeometry,cushion);backPad.name=chair.name+'-back-pad';chair.add(backPad);

 }
 furniture.userData={purpose:'simple helm console and two chairs',facing:'fore',textureReady:true,chairCount:chairs.length,forwardOffset,platformHeight};
 furniture.ready=Promise.all(artworkReady);
 return furniture;
};

/* Empty plinth behind the helm, reserved for a later captain's chair. */
window.createBridgeCaptainRiser=(T,{floorY,upperFloorY,centerZ,radius})=>{
 const riser=new T.Group();riser.name='bridge-captain-riser';riser.position.set(0,floorY,centerZ);
 const height=(upperFloorY-floorY)/2,frontZ=.0055,rearZ=radius+.00025,chairWidth=.014,flareStartZ=frontZ+(rearZ-frontZ)*.4,midZ=(frontZ+rearZ)/2,capThickness=.00004;
 // Keep the first 40% straight, then widen toward the upper deck.
 // All side walls continue vertically to the pit floor.
 function platformGeometry(inset,thickness){
  const outline=[[-chairWidth/2+inset,frontZ+inset],[chairWidth/2-inset,frontZ+inset],[chairWidth/2-inset,flareStartZ-inset],[.010-inset,rearZ-inset],[-.010+inset,rearZ-inset],[-chairWidth/2+inset,flareStartZ-inset]],positions=[],uv=[],indices=[];
  function quad(vertices){const a=positions.length/3;for(const p of vertices)positions.push(...p);uv.push(0,0,0,1,1,1,1,0);indices.push(a,a+1,a+2,a,a+2,a+3);}
  const point=(i,y)=>[outline[i][0],y,outline[i][1]-midZ],lo=-thickness/2,hi=thickness/2;
  for(const face of [[0,5,2,1],[5,4,3,2]]){quad(face.map(i=>point(i,hi)));quad([...face].reverse().map(i=>point(i,lo)));}
  for(let i=0;i<outline.length;i++){const j=(i+1)%outline.length;quad([point(i,lo),point(i,hi),point(j,hi),point(j,lo)]);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 const geometry=platformGeometry(0,height-capThickness);
 const base=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x161719,roughness:.48,metalness:0}));
 base.name='bridge-captain-riser-base';base.position.set(0,(height-capThickness)/2,midZ);riser.add(base);
 const capGeometry=platformGeometry(.00015,capThickness);
 const plinth=new T.Mesh(capGeometry,new T.MeshStandardMaterial({color:0x252321,roughness:1,metalness:0}));
 plinth.name='bridge-captain-riser-plinth';plinth.position.set(0,height-capThickness/2,midZ);riser.add(plinth);
 riser.userData={purpose:'empty captain riser connected to upper deck',chairIncluded:false,height,upperDeckStep:upperFloorY-floorY-height,frontZ,rearZ,chairWidth,chairPadDepth:flareStartZ-frontZ,flareStartZ,connectedToUpperDeck:true};return riser;
};
