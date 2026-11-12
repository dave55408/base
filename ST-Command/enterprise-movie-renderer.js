/* Enterprise registered to the supplied complete starboard orthographic view.
   X is starboard, Y is up, Z is aft; the bay entrance is the model origin. */
window.createMovieEnterpriseRenderer=()=>{
  const T=window.AlpineThree;if(!T)return null;
  let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch{return null;}
  renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new T.Scene(),model=new T.Group(),camera=new T.PerspectiveCamera(45,1,.005,100000);
  scene.add(model);scene.add(new T.HemisphereLight(0xd9e6dd,0x62756b,.75));
  const sun=new T.DirectionalLight(0xeaf1ed,2.5);sun.position.set(4,6,3);scene.add(sun);
  const fill=new T.DirectionalLight(0xa4bdcb,.6);fill.position.set(3,0,-4);scene.add(fill);
  const bounce=new T.DirectionalLight(0xc6d3c7,.65);bounce.position.set(1,-4,2);scene.add(bounce);
  const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.48,metalness:.18,...extra});
  const hull=material(window.ENTERPRISE_MOVIE_HULL_COLOR),edge=hull,hullDouble=material(window.ENTERPRISE_MOVIE_HULL_COLOR,{side:T.DoubleSide}),trim=material(0x4c5b56),red=material(0x9c2820);
  const black=new T.MeshBasicMaterial({color:0x090e14,toneMapped:false,side:T.DoubleSide});
  const glow=color=>new T.MeshBasicMaterial({color,toneMapped:false});
  const amber=glow(0xffc784),white=glow(0xffedcd);
  // Fine surface grain softly scatters highlights without hiding the inner animation.
  const frostCanvas=document.createElement('canvas');frostCanvas.width=frostCanvas.height=128;
  const frostContext=frostCanvas.getContext('2d'),frostPixels=frostContext.createImageData(128,128);
  let frostSeed=417;
  for(let i=0;i<frostPixels.data.length;i+=4){frostSeed=(Math.imul(frostSeed,1664525)+1013904223)>>>0;const value=96+(frostSeed>>>26);frostPixels.data[i]=frostPixels.data[i+1]=frostPixels.data[i+2]=value;frostPixels.data[i+3]=255;}
  frostContext.putImageData(frostPixels,0,0);const frostMap=new T.CanvasTexture(frostCanvas);
  const capMaterial=material(0x000000,{roughness:.50,bumpMap:frostMap,bumpScale:.00024,metalness:0,transparent:true,opacity:.44,depthWrite:false});
  const domeLampBrightness=1.6;
  const bladeCanvas=document.createElement('canvas');bladeCanvas.width=128;bladeCanvas.height=8;
  const bladeContext=bladeCanvas.getContext('2d'),bladeGradient=bladeContext.createLinearGradient(0,0,128,0);
  for(const [stop,alpha] of [[0,0],[.10,.03],[.20,.14],[.30,.41],[.40,.80],[.50,1],[.60,.80],[.70,.41],[.80,.14],[.90,.03],[1,0]])bladeGradient.addColorStop(stop,'rgba(255,255,255,'+alpha+')');
  bladeContext.fillStyle=bladeGradient;bladeContext.fillRect(0,0,128,8);const bladeMap=new T.CanvasTexture(bladeCanvas);bladeMap.colorSpace=T.SRGBColorSpace;
  const capLineMaterial=material(0x000000,{map:bladeMap,roughness:.98,metalness:0,side:T.DoubleSide,transparent:true,opacity:.72,depthWrite:false}),capRotors=[],capInternalLights=[];
  const bladeDistanceFade={value:1};
  const domeEmissionTime={value:0};
  // Camera-relative fade across each rotor's full dome-and-tube depth.
  capLineMaterial.onBeforeCompile=shader=>{
    shader.uniforms.bladeDistanceFade=bladeDistanceFade;
    shader.vertexShader='varying vec2 vBladeDistanceRange;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vec3 bladeCenter=(modelViewMatrix*vec4(0.0,0.0,0.160,1.0)).xyz;
      vec3 bladeDirection=normalize(bladeCenter);
      vec3 bladeAxes=vec3(dot(bladeDirection,modelViewMatrix[0].xyz),dot(bladeDirection,modelViewMatrix[1].xyz),dot(bladeDirection,modelViewMatrix[2].xyz));
      float bladeExtent=dot(abs(bladeAxes),vec3(0.086,0.086,0.246));
      vBladeDistanceRange=vec2(length(bladeCenter)-bladeExtent,length(bladeCenter)+bladeExtent);`);
    shader.fragmentShader='uniform float bladeDistanceFade;\nvarying vec2 vBladeDistanceRange;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
      float bladeDepth=smoothstep(vBladeDistanceRange.x,vBladeDistanceRange.y,length(vViewPosition));
      diffuseColor.a*=mix(1.0,mix(1.0,0.08,bladeDepth),bladeDistanceFade);`);
    capLineMaterial.userData.distanceFadeShader=shader;
  };
  capLineMaterial.customProgramCacheKey=()=> 'camera-distance-blade-fade-v1';
  const capRadius=.087,capSeam=-.80,capDepthScale=.88;
  const navigationLights=[];
  function mesh(geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);model.add(o);return o;}
  function box(x,y,z,w,h,d,mat=hull){return mesh(new T.BoxGeometry(w,h,d),mat,x,y,z);}
  function sphere(x,y,z,rx,ry,rz,mat=hull){const o=mesh(new T.SphereGeometry(1,32,20),mat,x,y,z);o.scale.set(rx,ry,rz);return o;}
  function beam(a,b,width,depth,mat=hull){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.BoxGeometry(width,v.length(),depth),mat,...a);o.position.addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function lathe(profile,mat,x,y,z,axis='y',segments=96){
    const positions=[],uv=[],indices=[];
    for(const [radius,height] of profile)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*radius,height,Math.cos(a)*radius);if(axis==='z')uv.push(i/segments,(height-profile[0][1])/(profile.at(-1)[1]-profile[0][1]));else uv.push(.5+Math.sin(a)*radius/1.38*(height<0?-1:1),.5-Math.cos(a)*radius/1.38);}
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    geo.userData.hullPanelTopology={segments,rows:profile.length,kind:'lathe'};
    if(Array.isArray(mat))for(let j=0;j<profile.length-1;j++){
      const rim=profile[j][0]>.6&&profile[j][0]===profile[j+1][0]||axis==='y'&&mat.length>2&&Math.min(profile[j][0],profile[j+1][0])>=.65&&profile[j][1]<.025&&profile[j+1][1]>.020;
      const index=axis==='z'?(mat.length>2&&profile[j][1]>=.73?2:profile[j][1]===profile[j+1][1]?1:0):rim?1:(mat.length>2&&(profile[j][1]+profile[j+1][1])/2<0?2:0);
      geo.addGroup(j*segments*6,segments*6,index);
    }
    const o=mesh(geo,mat,x,y,z);if(axis==='z')o.rotation.x=Math.PI/2;return o;
  }
  const windowDark=trim.clone(),windowLit=white.clone(),windowGlass=black.clone();
  for(const mat of [windowDark,windowLit,windowGlass]){mat.polygonOffset=true;mat.polygonOffsetFactor=-1;mat.polygonOffsetUnits=-1;mat.depthWrite=false;mat.side=T.DoubleSide;}
  function radiusAt(profile,level){
    for(let j=1;j<profile.length;j++){const [r0,h0]=profile[j-1],[r1,h1]=profile[j];if(h1!==h0&&level>=Math.min(h0,h1)&&level<=Math.max(h0,h1))return r0+(r1-r0)*(level-h0)/(h1-h0);}
    return 0;
  }
  function hullWindow(profile,axis,center,angle,level,width,height,lit,segments=96){
    // Follow the actual lathe facets and taper, with no window thickness.
    const step=Math.PI*2/segments,r=radiusAt(profile,level),a0=angle-width/(2*r),a1=angle+width/(2*r),angles=[a0],levels=[level-height/2],positions=[],indices=[],uv=[];
    for(let a=(Math.floor(a0/step)+1)*step;a<a1;a+=step)angles.push(a);angles.push(a1);
    for(const [,h] of profile)if(h>level-height/2&&h<level+height/2&&!levels.includes(h))levels.push(h);levels.push(level+height/2);levels.sort((a,b)=>a-b);
    for(const h of levels)for(const a of angles){const radius=radiusAt(profile,h)*Math.cos(step/2)/Math.cos(a-(Math.floor(a/step)+.5)*step);positions.push(Math.sin(a)*radius,h,Math.cos(a)*radius);uv.push((a-a0)/(a1-a0),(h-(level-height/2))/height);}
    for(let row=0;row<levels.length-1;row++)for(let col=0;col<angles.length-1;col++){const i=row*angles.length+col,n=i+angles.length;indices.push(i,i+1,n,i+1,n+1,n);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
    const o=mesh(geo,lit?windowLit:windowDark,...center);if(axis==='z')o.rotation.x=Math.PI/2;o.renderOrder=1;o.name='flush-hull-window';return o;
  }
  const details=createMovieEnterpriseDetailing(T);
  for(const map of Object.values(details))if(map?.isTexture)map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const decalMaterial=map=>material(0xffffff,{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:T.DoubleSide});
  const pennantMaterial=decalMaterial(details.pennant),portPennantMaterial=decalMaterial(details.portPennant);
  const registryMat=decalMaterial(details.registry),portRegistryMat=decalMaterial(details.portRegistry);
  function hullDecal(profile,side,level,width,height,mat,center=[0,0,0],segments=96){
    const o=hullWindow(profile,'z',center,side*Math.PI/2,level,width,height,false,segments),uv=o.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,side>0?1-v:v,side>0?u:1-u);}
    o.material=mat;o.name='flush-hull-pennant';return o;
  }
  const saucerMat=material(0xffffff,{map:details.top,emissive:0xffead0,emissiveMap:details.topGlow,emissiveIntensity:.55,side:T.DoubleSide}),bottomSaucerMat=material(0xffffff,{map:details.bottom,emissive:0xffead0,emissiveMap:details.bottomGlow,emissiveIntensity:.55,side:T.DoubleSide});
  // Keep the mirrored underside UV seam off the rim and avoid coplanar trim.
  const saucerProfile=[[0,-.033],[.31,-.033],[.48,-.033],[.645,-.025],[.650,-.022],[.680,.022],[.674,.029],[.57,.038],[.36,.065],[.18,.078],[0,.078]];
  const saucer=lathe(saucerProfile,[saucerMat,material(0xffffff,{map:details.rim,emissive:0xffead0,emissiveMap:details.rimGlow,emissiveIntensity:.75,side:T.DoubleSide}),bottomSaucerMat],0,.380,-1.53);saucer.name='movie-saucer';
  // Give the vertical rim its own orthographic projection without disturbing
  // the top and bottom planar maps at their shared edges.
  saucer.geometry=saucer.geometry.toNonIndexed();
  for(const group of saucer.geometry.groups)if(group.materialIndex===1){
    const p=saucer.geometry.attributes.position,uv=saucer.geometry.attributes.uv;
    for(let i=group.start;i<group.start+group.count;i++){
      const a=(Math.atan2(p.getX(i),p.getZ(i))+Math.PI*2)%(Math.PI*2);
      uv.setXY(i,a/(Math.PI*2),(p.getY(i)+.022)/.044);
    }
    uv.needsUpdate=true;
  }
  // Rounded deck shoulders, a low bridge tier and a shallow sensor cap.
  const deckProfile=[[0,0],[.192,0],[.191,.0134],[.186,.0279],[.177,.0436],[.162,.0525],[.135,.057],[0,.057]];
  function teardropHousing(geometry){
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z);p.setX(i,x*.72);p.setZ(i,(z+(r>0 ? .14*Math.max(0,z/r)**4*(r/.192)**1.5 : 0))*.735);}
    p.needsUpdate=true;const uv=geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,.5+p.getX(i)/1.38,.5-p.getZ(i)/1.38);uv.needsUpdate=true;geometry.computeVertexNormals();
  }
  const upperHousing=lathe(deckProfile,material(0xffffff,{map:details.deck,emissive:0xffead0,emissiveMap:details.deckGlow,emissiveIntensity:.55,side:T.DoubleSide}),0,.456,-1.53);upperHousing.scale.y=1.05;teardropHousing(upperHousing.geometry);upperHousing.name='upper-saucer-teardrop';
  lathe([[0,0],[.077,0],[.077,.009],[.071,.022],[.059,.028],[.040,.029],[0,.029]],hull,0,.516,-1.53);
  box(0,.531,-1.466,.021,.031,.035,hull);
  const sensorGlass=material(0xf0e5ce,{emissive:0xffdcc2,emissiveIntensity:1.3,roughness:.3,metalness:.08});
  lathe([[0,0],[.036,0],[.036,.003],[0,.003]],edge,0,.544,-1.53);
  sphere(0,.550,-1.53,.034,.010,.034,sensorGlass);
  // The underside is a broad tapered bowl with a flattened base, not a sphere.
  const bowlProfile=[[0,-.095],[.10,-.095],[.135,-.090],[.17,-.075],[.22,-.044],[.275,-.010],[.29,0],[0,0]];
  const bowl=lathe(bowlProfile,bottomSaucerMat,0,.353,-1.53);bowl.name='movie-underside-bowl';
  lathe([[0,0],[.078,0],[.078,.012],[.074,.016],[0,.016]],hull,0,.244,-1.53);
  lathe([[0,-.024],[.009,-.021],[.024,-.014],[.041,-.005],[.046,0],[0,0]],sensorGlass,0,.246,-1.53);
  beam([0,.223,-1.53],[0,.216,-1.53],.002,.002,trim);
  // Aft saucer impulse housing: a broad capsule face, twin dark outlets
  // and the small center port. Its forward edge meets the curved saucer rim.
  const impulseStart=model.children.length,impulseOutline=[],impulsePositions=[],impulseIndices=[];
  for(const [center,start] of [[.114,-Math.PI/2],[-.114,Math.PI/2]])for(let i=0;i<=24;i++){
    const a=start+i/24*Math.PI;impulseOutline.push([center+.026*Math.cos(a),.379+.026*Math.sin(a)]);
  }
  const impulseCount=impulseOutline.length;
  const impulseFrontZ=x=>-1.53+Math.sqrt(.674**2-x*x);
  const impulsePoint=([x,y],z)=>{
    if(z===-.828)return [x,y,z];
    const frontX=x*(.180/.140);
    return [frontX,y+.004,impulseFrontZ(frontX)];
  };
  for(const z of [-.900,-.828]){
    const base=impulsePositions.length/3;impulsePositions.push(...impulsePoint([0,.379],z));
    for(const point of impulseOutline)impulsePositions.push(...impulsePoint(point,z));
    for(let i=0;i<impulseCount;i++){
      const a=base+1+i,b=base+1+(i+1)%impulseCount;
      impulseIndices.push(...(z===-.828?[base,a,b]:[base,b,a]));
    }
  }
  for(let i=0;i<impulseCount;i++){
    const a=impulseOutline[i],b=impulseOutline[(i+1)%impulseCount],n=impulsePositions.length/3;
    for(const [point,z] of [[a,-.900],[b,-.900],[a,-.828],[b,-.828]])impulsePositions.push(...impulsePoint(point,z));
    impulseIndices.push(n,n+1,n+2,n+1,n+3,n+2);
  }
  const impulseGeometry=new T.BufferGeometry();impulseGeometry.setAttribute('position',new T.Float32BufferAttribute(impulsePositions,3));impulseGeometry.setIndex(impulseIndices);impulseGeometry.computeVertexNormals();
  const impulseHousing=mesh(impulseGeometry,material(0x99a49b,{side:T.DoubleSide}));impulseHousing.name='movie-impulse-housing';
  for(const side of [-1,1]){
    const outlet=box(side*.061,.379,-.827,.062,.028,.003,black);outlet.name=(side<0?'port':'starboard')+'-impulse-outlet';
  }
  const impulsePort=sphere(0,.379,-.825,.004,.004,.002,black);impulsePort.name='movie-impulse-center-port';
  // The narrow spine runs from the outer impulse edge to the marked deck
  // endpoint, retaining its constant width and semicircular nose.
  // Match the longer endpoint in the supplied green outline, while keeping
  // the narrow section and rounded nose independent of grid-ring counting.
  const ridgeHalfWidth=.017,ridgeTipZ=-1.53+.400,ridgeTipCenter=ridgeTipZ+ridgeHalfWidth;
  const ridgeSections=[[-.828,ridgeHalfWidth],[impulseFrontZ(0),ridgeHalfWidth],[(impulseFrontZ(0)+ridgeTipCenter)/2,ridgeHalfWidth],[ridgeTipCenter,ridgeHalfWidth]],ridgePositions=[],ridgeIndices=[];
  for(let i=1;i<=20;i++){const a=i/20*Math.PI/2;ridgeSections.push([ridgeTipCenter-ridgeHalfWidth*Math.sin(a),ridgeHalfWidth*Math.cos(a)]);}
  const deckHeight=r=>{
    const levels=[[.18,.078],[.36,.065],[.57,.038],[.674,.029],[.680,.022]];
    for(let i=1;i<levels.length;i++)if(r<=levels[i][0]){const [a,ya]=levels[i-1],[b,yb]=levels[i];return .380+ya+(yb-ya)*(r-a)/(b-a);}
    return .402;
  };
  for(const [z,halfWidth] of ridgeSections){
    const centerY=deckHeight(Math.abs(z+1.53));
    // At the outer edge, only the portion above the impulse face is exposed.
    // Starting its cap at the housing top avoids two coplanar faces fighting.
    for(const [x,top] of [[-halfWidth,false],[-halfWidth,true],[halfWidth,true],[halfWidth,false]])ridgePositions.push(x,top?centerY+.011:z===-.828?.405:deckHeight(Math.hypot(z+1.53,x))-.006,z);
  }
  for(let row=0;row<ridgeSections.length-1;row++)for(let col=0;col<4;col++){
    const a=row*4+col,b=row*4+(col+1)%4,c=a+4,d=b+4;ridgeIndices.push(a,b,c,b,d,c);
  }
  // Give the flat rear cap independent vertices so it cannot bend the top
  // normals into a dark triangular crease. The rounded nose closes naturally.
  const ridgeCap=ridgePositions.length/3;ridgePositions.push(...ridgePositions.slice(0,12));
  ridgeIndices.push(ridgeCap,ridgeCap+2,ridgeCap+1,ridgeCap,ridgeCap+3,ridgeCap+2);
  const ridgeGeometry=new T.BufferGeometry();ridgeGeometry.setAttribute('position',new T.Float32BufferAttribute(ridgePositions,3));ridgeGeometry.setIndex(ridgeIndices);ridgeGeometry.computeVertexNormals();
  const impulseRidge=mesh(ridgeGeometry,hullDouble);impulseRidge.name='movie-impulse-dorsal-ridge';
  const impulseAssembly=new T.Group();impulseAssembly.name='movie-impulse-assembly';for(const part of model.children.slice(impulseStart))impulseAssembly.add(part);model.add(impulseAssembly);
  const primaryHull=new T.Group();primaryHull.name='reference-saucer-assembly';for(const part of [...model.children])primaryHull.add(part);primaryHull.position.set(0,.005,.084);model.add(primaryHull);
  const engineeringParts=[];
  // The secondary hull is a tapered cylinder, with the deflector at its forward end.
  const engineeringShape=window.EnterpriseEngineeringShape;
  const bodyFront=engineeringShape.profile[0][1];
  const secondaryProfile=[[0,bodyFront],...engineeringShape.profile];
  // Densely sample the aft belly so the deck-height cutout is a smooth
  // concave sweep, rather than a clipped cylinder or an open mesh edge.
  // A longer shoulder carries the fuller belly into the level aft bay floor.
  const aftCutoutStart=engineeringShape.aftCutoutStart,aftCutoutLength=-aftCutoutStart;
  const secondaryShellProfile=secondaryProfile.filter(([,z])=>z<aftCutoutStart);
  for(let i=0;i<=80;i++){const z=i===80?0:aftCutoutStart+aftCutoutLength*(i/80)**2;secondaryShellProfile.push([radiusAt(secondaryProfile,z),z]);}
  const secondarySegments=192;
  const secondaryHull=lathe(secondaryShellProfile,[material(0xffffff,{map:details.secondary,emissive:0xffead0,emissiveMap:details.secondaryGlow,emissiveIntensity:.7,side:T.DoubleSide}),hull],0,0,0,'z',secondarySegments);secondaryHull.name='secondary-hull';secondaryHull.userData.radialSegments=secondarySegments;
  engineeringParts.push(secondaryHull);
  const aftSkin=secondaryHull.geometry.attributes.position;
  for(let i=0;i<aftSkin.count;i++){
    const z=aftSkin.getY(i),down=aftSkin.getZ(i);
    if(down>0)aftSkin.setZ(i,engineeringShape.downAt(z,aftSkin.getX(i)));
    else if(down<0)aftSkin.setZ(i,-engineeringShape.upAt(z,aftSkin.getX(i)));
  }
  // Keep the markings at their physical height on the reshaped skin instead
  // of stretching a tiny window over the new nearly vertical side panels.
  const aftUV=secondaryHull.geometry.attributes.uv;
  for(let i=0;i<aftSkin.count;i++)aftUV.setY(i,(aftSkin.getY(i)+1.19)/1.19);
  for(let i=0;i<aftSkin.count;i++)if(aftSkin.getZ(i)>=0){
    const a=(Math.atan2(aftSkin.getX(i),aftSkin.getZ(i))+Math.PI*2)%(Math.PI*2);aftUV.setX(i,i%(secondarySegments+1)===secondarySegments?1:a/(Math.PI*2));
  }
  aftUV.needsUpdate=true;aftSkin.needsUpdate=true;secondaryHull.geometry.computeVertexNormals();
  engineeringShape.smoothHullSeam(T,secondaryHull.geometry,secondarySegments);
  secondaryHull.userData.aftDeckCutout=true;secondaryHull.userData.aftCutoutStart=aftCutoutStart;
  // Slanted neck and diagonal pylons follow the side and rear reference views.
  // Bury both ends in their hulls so the dorsal reads as one solid structure.
  const dorsalSection=[[-.54,.11],[-.87,.13],[-1.16,.36],[-.82,.36]],dorsalVertices=[],dorsalIndices=[];
  for(const x of [-.032,.032])for(const [z,y] of dorsalSection)dorsalVertices.push(x,y,z);
  dorsalIndices.push(0,2,1,0,3,2,4,5,6,4,6,7);
  for(let i=0;i<4;i++){const n=(i+1)%4;dorsalIndices.push(i,n,i+4,n,n+4,i+4);}
  const dorsalGeometry=new T.BufferGeometry();dorsalGeometry.setAttribute('position',new T.Float32BufferAttribute(dorsalVertices,3));dorsalGeometry.setIndex(dorsalIndices);
  const dorsalFaces=dorsalGeometry.toNonIndexed();dorsalFaces.computeVertexNormals();const dorsal=mesh(dorsalFaces,hullDouble);dorsal.name='movie-dorsal-connector';
  const neckMaterial=decalMaterial(details.neck);neckMaterial.emissive.setHex(0xffead0);neckMaterial.emissiveMap=details.neckGlow;neckMaterial.emissiveIntensity=.55;
  for(const side of [-1,1]){
    const positions=dorsalSection.flatMap(([z,y])=>[side*.032,y,z]),uv=dorsalSection.flatMap(([z,y])=>[side>0?(z+1.16)/.62:1-(z+1.16)/.62,(y-.11)/.25]);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();const skin=mesh(geo,neckMaterial);skin.renderOrder=1;
  }
  const pylonMetal=material(0xb1b1b1,{side:T.DoubleSide});
  const strutGrilleMaterial=material(0x3e3e3e,{roughness:.85,metalness:.12,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const finMaterial=hullDouble;
  const nacelleMetal=material(0xffffff,{map:details.nacelle,emissive:0xffead0,emissiveMap:details.nacelleGlow,emissiveIntensity:.5});
  const inboardChannelMaterial=decalMaterial(details.inboardChannel);
  const outerGrilleMaterial=decalMaterial(details.outerGrille);
  const exhaustHoodMaterial=material(0x666666,{roughness:.62,metalness:.18,side:T.DoubleSide}),exhaustInsertMaterial=material(0x788e80,{roughness:.54,metalness:.28});
  for(const side of [-1,1]){
    // Seat the pylon just inside the shell, leaving the hangar ceiling clear.
    // Keep its slope, outer attachment and visible grille stations unchanged.
    const strutAxis=new T.Vector3(side*.354,.370,0).normalize(),strutEmbed=.018;
    const strutRoot=new T.Vector3(side*.085,.085,-.261).addScaledVector(strutAxis,-strutEmbed);
    const strut=beam(strutRoot.toArray(),[side*.439,.455,-.261],.040,.107,pylonMetal),grilleLength=Math.hypot(.354,.370)*.82;
    strut.geometry.dispose();strut.geometry=new T.BoxGeometry(.040,new T.Vector3(side*.439,.455,-.261).distanceTo(strutRoot),.107,16,1,1);
    strut.name=(side<0?'port':'starboard')+'-engine-strut';
    // Recessed-looking panels follow the upward-facing side of each sloped strut.
    for(let n=0;n<5;n++){
      const panel=new T.Mesh(new T.PlaneGeometry(.084,grilleLength/5-.006),strutGrilleMaterial);
      panel.position.set(-side*.040/2,-grilleLength/2+(n+.5)*grilleLength/5+strutEmbed/2,0);panel.rotation.y=-side*Math.PI/2;
      panel.name=(side<0?'port':'starboard')+'-strut-top-grille';strut.add(panel);
    }
    // End the pylon and its grille at the nacelle wall, outside the clear bore.
    model.updateWorldMatrix(true,true);
    strut.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
      const v=new T.Vector3().fromBufferAttribute(p,i);o.localToWorld(v);const dx=v.x-side*.439,dy=v.y-.490,r=.0780;
      if(dx*dx+dy*dy<r*r){const b=-2*(dx*strutAxis.x+dy*strutAxis.y),c=dx*dx+dy*dy-r*r,t=(-b+Math.sqrt(b*b-4*c))/2;v.addScaledVector(strutAxis,-t);o.worldToLocal(v);p.setXYZ(i,v.x,v.y,v.z);}
    }p.needsUpdate=true;o.geometry.computeVertexNormals();});
    // A curved external shoe replaces the old solid block inside the tube.
    const shoeP=[],shoeI=[],shoeSteps=24;
    for(let i=0;i<=shoeSteps;i++){const a=-side*.45-.40+i*.80/shoeSteps;for(const [r,z] of [[.0779,-.331],[.0779,-.191],[.089,-.331],[.089,-.191]])shoeP.push(side*.439+Math.sin(a)*r,.490-Math.cos(a)*r,z);}
    for(let i=0;i<shoeSteps;i++){const a=i*4,b=a+4;for(const [u,v] of [[0,1],[2,3],[0,2],[1,3]])shoeI.push(a+u,b+u,a+v,a+v,b+u,b+v);}
    shoeI.push(0,1,2,1,3,2,shoeSteps*4,shoeSteps*4+2,shoeSteps*4+1,shoeSteps*4+1,shoeSteps*4+2,shoeSteps*4+3);
    const shoeG=new T.BufferGeometry();shoeG.setAttribute('position',new T.Float32BufferAttribute(shoeP,3));shoeG.setIndex(shoeI);shoeG.computeVertexNormals();mesh(shoeG,pylonMetal).name=(side<0?'port':'starboard')+'-engine-pylon-shoe';
    const engineStart=model.children.length;
    const x=side*.439;
    // Diffuse-only shading removes reflective highlights inside the domes.
    const interiorGray=new T.MeshLambertMaterial({color:0x353535,side:T.DoubleSide});
    const nacelleProfile=[[capRadius,capSeam],[capRadius,-.75],[.087,.64],[.087,.715],[.08146,.745],[.079,.755],[.068,.78]];
    lathe(nacelleProfile,[nacelleMetal,hull,exhaustHoodMaterial],x,.515,0,'z',64).name=(side<0?'port':'starboard')+'-engine-outer-tube';
    const rim=lathe([[.0843,capSeam-.001],[.087,capSeam-.001],[.087,capSeam+.006],[.0843,capSeam+.006]],[hullDouble,interiorGray],x,.515,0,'z',64);rim.name=(side<0?'port':'starboard')+'-dome-gray-retaining-rim';rim.geometry.clearGroups();rim.geometry.addGroup(0,64*6*2,0);rim.geometry.addGroup(64*6*2,64*6,1);
    lathe([[.0843,capSeam+.006],[.0843,capSeam-.001]],interiorGray,x,.515,0,'z',64).name=(side<0?'port':'starboard')+'-engine-inner-lip';
    // A slightly flattened dome retains the full cylinder diameter at its rim.
    const capGeometry=new T.SphereGeometry(capRadius,64,32,0,Math.PI*2,0,Math.PI/2);capGeometry.rotateX(-Math.PI/2);
    const capPositions=capGeometry.attributes.position,capUV=capGeometry.attributes.uv;
    for(let i=0;i<capPositions.count;i++){
      const phi=Math.atan2(capPositions.getZ(i),-capPositions.getX(i));
      capUV.setXY(i,(phi/(Math.PI*2)+1)%1,1-Math.acos(Math.max(-1,Math.min(1,capPositions.getY(i)/capRadius)))/Math.PI);
    }
    const cap=mesh(capGeometry,capMaterial,x,.515,capSeam);cap.scale.z=capDepthScale;cap.name=side<0?'port-engine-cap':'starboard-engine-cap';cap.renderOrder=30;
    // Additive illumination sits behind the denser outer diffuser.
    const inner=mesh(capGeometry.clone(),material(0x8b301c,{emissive:0xff210c,emissiveIntensity:1.25,roughness:.9,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}),x,.515,capSeam+.0005);inner.scale.set(.99,.99,.865);inner.renderOrder=25;inner.name=(side<0?'port':'starboard')+'-dome-inner-backing';
    // Brighter inner emission remains visible through the more opaque glass.
    const domeEmission=new T.ShaderMaterial({transparent:true,opacity:.85,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
      uniforms:{uGlowTime:domeEmissionTime,uGlowSide:{value:side},uBurntOrange:{value:new T.Color(0x9a360e)},uAmber:{value:new T.Color(0xe7811e)},uYellow:{value:new T.Color(0xffd862)},uGlowOpacity:{value:.85}},
      vertexShader:`varying vec3 vDomePoint;varying vec3 vGlowNormal;varying vec3 vGlowView;
        void main(){vDomePoint=position/0.087;vec4 view=modelViewMatrix*vec4(position,1.0);vGlowNormal=normalize(normalMatrix*normal);vGlowView=-view.xyz;gl_Position=projectionMatrix*view;}`,
      fragmentShader:`uniform float uGlowTime,uGlowSide,uGlowOpacity;uniform vec3 uBurntOrange,uAmber,uYellow;
        varying vec3 vDomePoint;varying vec3 vGlowNormal;varying vec3 vGlowView;
        float domeHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float domeNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(mix(domeHash(i),domeHash(i+vec3(1,0,0)),f.x),mix(domeHash(i+vec3(0,1,0)),domeHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(domeHash(i+vec3(0,0,1)),domeHash(i+vec3(1,0,1)),f.x),mix(domeHash(i+vec3(0,1,1)),domeHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){float t=uGlowTime,angle=t*0.20*uGlowSide+uGlowSide*1.7;float c=cos(angle),s=sin(angle);
          vec3 p=vec3(mat2(c,-s,s,c)*vDomePoint.xy,vDomePoint.z);
          float cloud=0.57*domeNoise(p*3.4+vec3(0,0,t*.13))+0.29*domeNoise(p*7.1-vec3(t*.08,0,0))+0.14*domeNoise(p*15.0);
          float hot=0.0;for(int j=0;j<3;j++){float n=float(j),a=n*2.094+uGlowSide*.8+t*.10;
            vec2 center=vec2(cos(a),sin(a))*(.46+.08*sin(n*3.1+t*.31));vec2 d=p.xy-center;
            hot+=exp(-dot(d,d)*32.0)*(.40+.60*pow(.5+.5*sin(t*(1.3+n*.23)+n*3.7+uGlowSide),2.0));}
          vec3 emission=mix(uBurntOrange,uAmber,smoothstep(.22,.78,cloud)*.76);
          emission=mix(emission,uYellow,clamp(hot*.85,0.0,.92));emission*=.88+.25*cloud;
          float facing=max(0.0,dot(normalize(vGlowNormal),normalize(vGlowView)));
          gl_FragColor=vec4(emission,uGlowOpacity*(.45+.55*pow(facing,.65)));
          #include <colorspace_fragment>
        }`});
    const redGlow=mesh(capGeometry.clone(),domeEmission,x,.515,capSeam+.00005);redGlow.scale.set(.998,.998,.879);redGlow.renderOrder=26;redGlow.name=(side<0?'port':'starboard')+'-dome-red-glow';
    // Shallow opaque bowl behind the light assembly blocks the long tube view.
    const innerCapProfile=Array.from({length:17},(_,i)=>{const t=i/16;return [.0863*t,capSeam+.025+.030*(1-t*t)];});
    const innerCap=lathe(innerCapProfile,interiorGray,x,.515,0,'z',64);innerCap.name=(side<0?'port':'starboard')+'-engine-concave-inner-cap';
    // Open-ended lining follows the complete inner tube without a backing cap.
    lathe([[.086,capSeam],[.086,.710],[.0804,.740],[.0779,.750],[.067,.779]],interiorGray,x,.515,0,'z',64).name=(side<0?'port':'starboard')+'-dome-inner-housing';
    const lampAssembly=new T.Group();lampAssembly.name=(side<0?'port':'starboard')+'-dome-internal-lights';lampAssembly.position.set(x,.515,capSeam);model.add(lampAssembly);
    const redLampAssembly=new T.Group();redLampAssembly.name=(side<0?'port':'starboard')+'-dome-red-sphere-lights';redLampAssembly.position.copy(lampAssembly.position);model.add(redLampAssembly);
    const frontRedAssembly=new T.Group();frontRedAssembly.name=(side<0?'port':'starboard')+'-dome-front-red-lights';frontRedAssembly.position.copy(lampAssembly.position);model.add(frontRedAssembly);
    const lampLayout=[[0,.56,'amber'],[-.34,.40,'green'],[.34,.40,'green'],[-.51,.13,'amber'],[.51,.13,'amber'],[-.36,-.36,'amber'],[.36,-.36,'amber'],[0,-.53,'green']];
    for(const [index,[cx,cy,color]] of lampLayout.entries()){
      const g=new T.SphereGeometry(.018,32,24);
      const mat=new T.MeshBasicMaterial({color:color==='amber'?0xffcf45:0x70a252,transparent:true,opacity:color==='amber'?.90:.18,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending});
      // A volumetric-looking soft silhouette remains diffuse from every angle.
      mat.onBeforeCompile=function(shader){
        shader.vertexShader='varying vec3 vLampNormal;\nvarying vec3 vLampView;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvLampNormal=normalize(normalMatrix*normal);\nvLampView=-mvPosition.xyz;');
        shader.fragmentShader='varying vec3 vLampNormal;\nvarying vec3 vLampView;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\nfloat lampFacing=max(0.0,dot(normalize(vLampNormal),normalize(vLampView)));\ndiffuseColor.a*=pow(lampFacing,3.0);');
        this.userData.diffuseSphereShader=shader;
      };
      mat.customProgramCacheKey=()=> 'diffuse-spherical-dome-light-v1';
      // Bright diffuse emission mixes amber and green into the red cover.
      mat.color.multiplyScalar((color==='amber'?3:1.2)*domeLampBrightness);
      const lamp=new T.Mesh(g,mat);lamp.position.set(cx*capRadius,cy*capRadius,-.50*Math.sqrt(.0805**2-(cx*capRadius)**2-(cy*capRadius)**2));lamp.scale.z=.90/1.10;lamp.name=color+'-diffuse-dome-light-'+index;lamp.renderOrder=10;lampAssembly.add(lamp);capInternalLights.push({lamp,green:color==='green',seed:index+(side<0?19:71)});
      const redMat=mat.clone();redMat.onBeforeCompile=function(shader){
        mat.onBeforeCompile.call(this,shader);
        shader.fragmentShader=shader.fragmentShader.replace('pow(lampFacing,3.0)','pow(lampFacing,3.45)');
      };redMat.customProgramCacheKey=()=> 'red-sphere-diffusion-115-percent-v1';redMat.color.setHex(0xff6f1a).multiplyScalar(2*domeLampBrightness);redMat.opacity=.40;
      const redLamp=new T.Mesh(g,redMat),angle=-Math.PI/6,c=Math.cos(angle),s=Math.sin(angle);
      // Negative Z rotation reads counterclockwise when looking into the front.
      redLamp.position.set(1.32*(lamp.position.x*c-lamp.position.y*s),1.32*(lamp.position.x*s+lamp.position.y*c),lamp.position.z+.018);redLamp.scale.copy(lamp.scale).multiplyScalar(1.05);redLamp.name='red-diffuse-dome-light-'+index;redLamp.renderOrder=9;redLampAssembly.add(redLamp);capInternalLights.push({lamp:redLamp,red:true,seed:index+(side<0?156:208)});
      const frontMat=redMat.clone();frontMat.onBeforeCompile=redMat.onBeforeCompile;frontMat.customProgramCacheKey=redMat.customProgramCacheKey;
      const frontLamp=new T.Mesh(new T.SphereGeometry(.014,32,24),frontMat);frontLamp.position.set(lamp.position.x*.70,lamp.position.y*.70,lamp.position.z-.008);frontLamp.scale.copy(lamp.scale);frontLamp.name='front-red-diffuse-dome-light-'+index;frontLamp.renderOrder=11;frontRedAssembly.add(frontLamp);capInternalLights.push({lamp:frontLamp,red:true,seed:index+(side<0?293:345)});
    }
    const rearRing=lathe([[.071,.715],[.087,.715],[.087,.745],[.071,.745]],[hullDouble,interiorGray],x,.515,0,'z',64);rearRing.name=(side<0?'port':'starboard')+'-engine-rear-collar';rearRing.geometry.clearGroups();rearRing.geometry.addGroup(0,64*6,1);rearRing.geometry.addGroup(64*6,64*6,0);rearRing.geometry.addGroup(64*6*2,64*6,1);
    lathe([[.071,.745],[.071,.715]],interiorGray,x,.515,0,'z',64).name=(side<0?'port':'starboard')+'-engine-rear-inner-collar';
    const rearCapPositions=[0,0,0],rearCapIndices=[];
    for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;rearCapPositions.push(Math.cos(a)*.068,Math.sin(a)*.068,0);if(i<64)rearCapIndices.push(0,i+1,i+2);}
    const rearCapGeometry=new T.BufferGeometry();rearCapGeometry.setAttribute('position',new T.Float32BufferAttribute(rearCapPositions,3));rearCapGeometry.setIndex(rearCapIndices);rearCapGeometry.computeVertexNormals();
    const rearCap=mesh(rearCapGeometry,exhaustHoodMaterial,x,.515,.78);rearCap.name=(side<0?'port':'starboard')+'-engine-rear-end-cap';
    // Broad hemispherical boss seated directly against the end cap, under the hood.
    const exhaustInsertGeometry=new T.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2);exhaustInsertGeometry.rotateX(Math.PI/2);
    const exhaustInsert=mesh(exhaustInsertGeometry,exhaustInsertMaterial,x,.507,.7805);exhaustInsert.scale.set(.062,.060,.060);exhaustInsert.name=(side<0?'port':'starboard')+'-rear-exhaust-insert';
    // The gray cowl projects straight aft at constant radius, with a cutaway
    // trailing edge over the rounded exhaust boss rather than a tapered tip.
    const hoodPositions=[],hoodIndices=[],hoodSteps=96;
    const hoodCut=a=>.745+.105*(1+Math.cos(a))/2;
    for(let n=0;n<=hoodSteps;n++){
      const a=-Math.PI+n/hoodSteps*Math.PI*2,cut=hoodCut(a);
      for(const [r,z] of [[.0872,.736],[.0872,cut],[.0842,.736],[.0842,cut]])hoodPositions.push(x+Math.sin(a)*r,.515+Math.cos(a)*r,z);
      if(n<hoodSteps){const i=n*4;hoodIndices.push(i,i+4,i+1,i+1,i+4,i+5,i+2,i+3,i+6,i+3,i+7,i+6,i+1,i+5,i+3,i+3,i+5,i+7);}
    }
    const hoodGeo=new T.BufferGeometry();hoodGeo.setAttribute('position',new T.Float32BufferAttribute(hoodPositions,3));hoodGeo.setIndex(hoodIndices);hoodGeo.computeVertexNormals();const exhaustHood=mesh(hoodGeo,[exhaustHoodMaterial,interiorGray]);exhaustHood.name=(side<0?'port':'starboard')+'-rear-exhaust-hood';
    // Rounded ribs run along the engine axis, from the cowl's forward seam
    // to its swept aft edge. Their ends blend into the curved shell.
    for(let rib=0;rib<12;rib++){
      const positions=[],indices=[],section=[[-1,0],[-.5,.0014],[0,.0021],[.5,.0014],[1,0]];
      for(let n=0;n<=hoodSteps;n++){
        const t=n/hoodSteps,centerAngle=-Math.PI+(rib+.5)/12*Math.PI*2;
        const shortScale=Math.min(1,(hoodCut(centerAngle)-.736)/.05);
        for(const [offset,lift] of section){
          const a=centerAngle+offset*.026*shortScale,cut=hoodCut(a);
          const endBlend=Math.min(1,t/.08,(1-t)/.08),r=.0871+lift*endBlend*shortScale,z=.736+(cut-.736)*t;
          positions.push(x+Math.sin(a)*r,.515+Math.cos(a)*r,z);
        }
      }
      for(let n=0;n<hoodSteps;n++)for(let j=0;j<section.length-1;j++){
        const a=n*section.length+j,b=a+section.length;indices.push(a,b,a+1,a+1,b,b+1);
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
      const ridge=mesh(geo,exhaustHoodMaterial);ridge.name=(side<0?'port':'starboard')+'-rear-cowling-ridge-'+rib;
    }
    // Forward inboard and rear upper fins share the same section and dimensions.
    for(const angle of [-Math.PI/4,Math.PI/4,-side*Math.PI/2]){
      const width=.0155,tip=.113;
      const section=[[.27,.083],[.278,.096],[.294,.105],[.316,.109],[.622,.109],[.657,.105],[.677,.097],[.685,.083]],vertices=[],indices=[];
      const finZ=z=>.314+(z-.27)*.841;
      const radialX=Math.sin(angle),radialY=Math.cos(angle),tangentX=Math.cos(angle),tangentY=-Math.sin(angle);
      const finRadius=r=>.083+(r-.083)*(tip-.083)/(.109-.083);
      for(const offset of [-width/2,width/2])for(const [z,r] of section){const radius=finRadius(r);vertices.push(x+radialX*radius+tangentX*offset,.515+radialY*radius+tangentY*offset,finZ(z));}
      const count=section.length;for(let i=1;i<count-1;i++)indices.push(0,i+1,i,count,count+i,count+i+1);
      for(let i=0;i<count;i++){const n=(i+1)%count;indices.push(i,n,i+count,n,n+count,i+count);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);
      const faces=geo.toNonIndexed();faces.computeVertexNormals();const fin=mesh(faces,finMaterial);const inboard=Math.abs(angle)===Math.PI/2;fin.name=(side<0?'port':'starboard')+(inboard?'-inboard-engine-fin':'-aft-engine-fin');fin.userData.referenceDimensions={width,tip,inboard,angle};
    }
    // A raised rectangular vent sits aft of the pennant's tail, clear of paint.
    const ventZ=.62,ventRadius=radiusAt(nacelleProfile,ventZ);
    const ventHousing=box(x+side*(ventRadius-.001),.515,ventZ,.014,.052,.125,hull);
    ventHousing.name=(side<0?'port':'starboard')+'-raised-aft-engine-vent';
    const outerGrille=mesh(new T.PlaneGeometry(.119,.046),outerGrilleMaterial,x+side*(ventRadius+.0061),.515,ventZ);
    outerGrille.rotation.y=side*Math.PI/2;outerGrille.name=(side<0?'port':'starboard')+'-outer-service-grille';
    for(let n=0;n<12;n++){
      const slat=box(x+side*(ventRadius+.00625),.515-.018+n*.00327,ventZ,.0002,.0007,.113,strutGrilleMaterial);
      slat.name=(side<0?'port':'starboard')+'-aft-engine-vent-slat-'+n;
    }
    // Three matching clamps share one axial station. Mirroring the side angles
    // puts the inboard and outboard clamps at exactly the same elevation.
    const clampStart=-.775,clampEnd=-.660,clampHalfArc=.50;
    for(const [location,clampAngle] of [['outboard',side*(Math.PI/2-.43)],['inboard',-side*(Math.PI/2-.43)],['bottom',0]]){
    const clampPositions=[],clampIndices=[],clampRows=30,clampCols=24;
    for(let row=0;row<=clampRows;row++)for(let col=0;col<=clampCols;col++){
      const z=clampStart+(clampEnd-clampStart)*row/clampRows,a=clampAngle+(col/clampCols-.5)*clampHalfArc*2;
      const edge=Math.min((z-clampStart)/.012,(clampEnd-z)/.012,(a-clampAngle+clampHalfArc)/.07,(clampAngle+clampHalfArc-a)/.07);
      const t=Math.max(0,Math.min(1,edge)),radius=radiusAt(nacelleProfile,z)+.009*t*t*(3-2*t);
      clampPositions.push(x+Math.sin(a)*radius,.515-Math.cos(a)*radius,z);
    }
    for(let row=0;row<clampRows;row++)for(let col=0;col<clampCols;col++){
      const a=row*(clampCols+1)+col,b=a+clampCols+1;clampIndices.push(a,b,a+1,a+1,b,b+1);
    }
    const clampGeometry=new T.BufferGeometry();clampGeometry.setAttribute('position',new T.Float32BufferAttribute(clampPositions,3));clampGeometry.setIndex(clampIndices);clampGeometry.computeVertexNormals();
    const clamp=mesh(clampGeometry,hullDouble);clamp.name=(side<0?'port':'starboard')+'-'+location+'-forward-engine-clamp';clamp.userData.raisedDepth=.009;
    }
    // Continuous circumferential grooves run behind the raised clamp.
    for(let n=0;n<5;n++){
      const level=-.736+n*.009;
      const rib=hullWindow(nacelleProfile,'z',[x,.515,0],0,level,Math.PI*2*radiusAt(nacelleProfile,level),.004,false,64);
      rib.material=strutGrilleMaterial;rib.name=(side<0?'port':'starboard')+'-forward-clamp-vent-'+n;
    }
    const registryDecal=hullDecal(nacelleProfile,side,-.03,.068,1.03,side<0?portRegistryMat:registryMat,[x,.515,0],64);registryDecal.name=(side<0?'port':'starboard')+'-nacelle-registry';
    const channel=hullDecal(nacelleProfile,-side,-.08,.052,.94,inboardChannelMaterial,[x,.515,0],64);channel.name=(side<0?'port':'starboard')+'-dark-inboard-channel';
    const rotor=new T.Group();rotor.name=side<0?'port-cap-lines':'starboard-cap-lines';rotor.position.set(x,.515,capSeam+.0006);rotor.scale.z=.864;model.add(rotor);capRotors.push({rotor,side});
    // Curved radial ribbons continue from the dome into the engine tube.
    for(let n=0;n<12;n++){
      const positions=[],indices=[],uv=[];
      const rows=48,startAngle=Math.asin(.009/capRadius);
      for(let j=0;j<=rows;j++){
        // Sample the spherical arc all the way to its equator/rear rim.
        const u=j/rows,theta=startAngle+u*(Math.PI/2-startAngle),r=capRadius*Math.sin(theta),a=n*Math.PI/6+u*.15,half=15*(.0012+r*.012)/r;
        for(const [across,t] of [[0,a-half],[1,a+half]]){
          const surfaceRadius=capRadius-.001,x=Math.sin(t)*Math.sin(theta)*surfaceRadius,y=Math.cos(t)*Math.sin(theta)*surfaceRadius,z=-Math.cos(theta)*surfaceRadius;
          positions.push(x,y,z);
          uv.push(across,u);
        }
      }
      const tubeRows=32,tubeDepth=.350;
      for(let j=1;j<=tubeRows;j++){
        const u=j/tubeRows,r=capRadius-.001-.001*u,a=n*Math.PI/6+.15,half=15*(.0012+capRadius*.012)/capRadius;
        for(const [across,t] of [[0,a-half],[1,a+half]]){positions.push(Math.sin(t)*r,Math.cos(t)*r,tubeDepth*u/rotor.scale.z);uv.push(across,1+u);}
      }
      for(let j=0;j<rows+tubeRows;j++){const i=j*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const blade=new T.Mesh(geo,capLineMaterial);blade.renderOrder=20;rotor.add(blade);
    }
    const assembly=new T.Group();assembly.name=(side<0?'port':'starboard')+'-movie-nacelle';
    const pivot=new T.Vector3(x,.515,capSeam);
    for(const child of model.children.slice(engineStart)){model.remove(child);child.position.sub(pivot);assembly.add(child);}
    assembly.position.copy(pivot);assembly.scale.set(.90,.90,1.10);model.add(assembly);
    // Match the sheet's nacelle length without rescaling the protected domes.
    // Shorten only the structure aft of their seam; all fittings and decals
    // follow the same axial map, so they continue to sit on the hull.
    assembly.updateWorldMatrix(true,true);
    assembly.traverse(o=>{
      if(!o.isMesh||o===cap||o===inner||o===redGlow||o===innerCap||o.parent===rotor||o.parent===lampAssembly||o.parent===redLampAssembly||o.parent===frontRedAssembly)return;
      const p=o.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const v=new T.Vector3().fromBufferAttribute(p,i);o.localToWorld(v);
        if(v.z>capSeam)v.z=capSeam+(v.z-capSeam)*.857;
        o.worldToLocal(v);p.setXYZ(i,v.x,v.y,v.z);
      }
      p.needsUpdate=true;o.geometry.computeVertexNormals();
    });
    assembly.position.z+=.157;assembly.position.y-=.025;
    // Slide the inboard fin forward until its leading edge bisects the pylon.
    assembly.updateWorldMatrix(true,true);
    const inboardFin=assembly.getObjectByName((side<0?'port':'starboard')+'-inboard-engine-fin'),finPositions=inboardFin.geometry.attributes.position;
    let finFront=Infinity;
    for(let i=0;i<finPositions.count;i++)finFront=Math.min(finFront,new T.Vector3().fromBufferAttribute(finPositions,i).applyMatrix4(inboardFin.matrixWorld).z);
    inboardFin.position.z+=(strut.getWorldPosition(new T.Vector3()).z-finFront)/assembly.scale.z;
    // Grow about each fin's existing center station and casing attachment.
    // Apply after registration so the inboard fins do not get repositioned.
    for(const fin of assembly.children.filter(o=>o.isMesh&&/-engine-fin$/.test(o.name))){
      const p=fin.geometry.attributes.position,{angle}=fin.userData.referenceDimensions,growth=1.15,rx=Math.sin(angle),ry=Math.cos(angle);
      let z0=Infinity,z1=-Infinity;for(let i=0;i<p.count;i++){z0=Math.min(z0,p.getZ(i));z1=Math.max(z1,p.getZ(i));}
      const centerZ=(z0+z1)/2;
      for(let i=0;i<p.count;i++){
        const dx=p.getX(i)-x,dy=p.getY(i)-.515,radial=.083+(dx*rx+dy*ry-.083)*growth,tangent=(dx*ry-dy*rx)*growth;
        p.setXYZ(i,x+rx*radial+ry*tangent,.515+ry*radial-rx*tangent,centerZ+(p.getZ(i)-centerZ)*growth);
      }
      p.needsUpdate=true;fin.geometry.computeVertexNormals();
      const dimensions=fin.userData.referenceDimensions;dimensions.width*=growth;dimensions.tip=.083+(dimensions.tip-.083)*growth;
    }
    // Batch the cowling by its two materials after all shape/normal updates.
    // Retain the original vertices, triangles and normals; only index order changes.
    const hoodExteriorIndices=[],hoodInteriorIndices=[];
    for(let n=0;n<hoodSteps;n++){
      const start=n*18;
      hoodExteriorIndices.push(...hoodIndices.slice(start,start+6),...hoodIndices.slice(start+12,start+18));
      hoodInteriorIndices.push(...hoodIndices.slice(start+6,start+12));
    }
    hoodGeo.setIndex(hoodExteriorIndices.concat(hoodInteriorIndices));
    hoodGeo.addGroup(0,hoodExteriorIndices.length,0);
    hoodGeo.addGroup(hoodExteriorIndices.length,hoodInteriorIndices.length,1);
    assembly.userData.orthographicLength=true;
  }
  const deflectorStart=model.children.length;
  // A thin flared reflector on a small stand-off, matching the side drawing.
  const copper=material(0xffffff,{vertexColors:true,roughness:.40,metalness:.48,side:T.DoubleSide}),copperBack=material(0x704832,{roughness:.52,metalness:.45,side:T.DoubleSide}),copperRim=material(0xc49a70,{roughness:.36,metalness:.58,side:T.DoubleSide});
  const darkBronze=material(0x24170f,{roughness:.68,metalness:.45,side:T.DoubleSide});
  const plate=lathe([[0,-1.196],[.124,-1.196],[.124,-1.204],[0,-1.204]],darkBronze,0,0,0,'z');plate.name='deflector-backplate';
  const mount=lathe([[0,-1.205],[.019,-1.205],[.016,-1.211],[.009,-1.216],[.009,-1.226],[0,-1.226]],darkBronze,0,0,0,'z',64);mount.name='deflector-mount';
  const dishFront=[[0,-1.240],[.014,-1.240],[.024,-1.243],[.043,-1.249],[.065,-1.257],[.084,-1.264],[.097,-1.269]];
  const dishProfile=[...dishFront.map(([r,z])=>[r,z+.003]),...dishFront.slice().reverse()];
  const dish=lathe(dishProfile,copper,0,0,0,'z');dish.name='deflector-dish';dish.material=[copperBack,copper,copperRim];dish.geometry.clearGroups();
  for(let j=0;j<dishProfile.length-1;j++)dish.geometry.addGroup(j*96*6,96*6,j<6?0:j===6?2:1);
  // Reference finish: a pale copper center grading into warmer copper at the lip.
  // Vertex color keeps the finish smooth at shuttle viewing distances.
  const dishColors=[],dishVertices=dish.geometry.attributes.position;
  for(let i=0;i<dishVertices.count;i++){
    const r=Math.hypot(dishVertices.getX(i),dishVertices.getZ(i)),t=Math.min(1,r/.097),blend=t*t*(3-2*t);
    const color=new T.Color(0xe1bb95).lerp(new T.Color(0xb4774f),blend);dishColors.push(color.r,color.g,color.b);
  }
  dish.geometry.setAttribute('color',new T.Float32BufferAttribute(dishColors,3));
  const probeMetal=material(0xd8b58b,{roughness:.35,metalness:.5,side:T.DoubleSide});
  const probe=lathe([[0,-1.337],[.0025,-1.337],[.0025,-1.252],[.006,-1.246],[.006,-1.241],[0,-1.241]],probeMetal,0,0,0,'z',48);probe.name='deflector-probe';
  const probeTip=sphere(0,0,-1.337,.006,.006,.006,probeMetal);probeTip.name='deflector-probe-tip';
  for(const part of [dish,probe,probeTip])part.position.z+=.012;
  const collarOuterProfile=[[.120,-1.211],[.122,-1.196],[.130,-1.130]];
  const deflectorCollar=lathe([[.112,-1.130],...collarOuterProfile.slice().reverse(),[.106,-1.211]],hullDouble,0,0,0,'z');deflectorCollar.name='movie-deflector-collar';
  const retainingRim=lathe([[.106,-1.209],[.1203,-1.209],[.1203,-1.213],[.106,-1.213]],copperRim,0,0,0,'z');retainingRim.name='movie-deflector-retaining-rim';
  const collarBaseZ=bodyFront*engineeringShape.bodyScale-.1665;
  const collarBaseRing=lathe([[.126,collarBaseZ+.003],[.1305,collarBaseZ+.003],[.1305,collarBaseZ-.003],[.126,collarBaseZ-.003]],copperRim,0,0,0,'z');collarBaseRing.name='movie-deflector-base-ring';
  // The collar is almost the full hull height. Keep the dish and probe at
  // their existing size while opening up the collar around them.
  for(const part of [deflectorCollar,retainingRim,collarBaseRing])part.scale.set(1/.90,1,1/.90);
  const deflectorAssembly=new T.Group();deflectorAssembly.name='reference-deflector-assembly';for(const part of model.children.slice(deflectorStart))deflectorAssembly.add(part);deflectorAssembly.scale.set(.90,.90,1);deflectorAssembly.position.z=.1665;model.add(deflectorAssembly);
  // Flush windows and inspection marks now follow the supplied orthos.
  // Windows, rim lights and hull markings add detail without changing the silhouette.
  // A low raised pad carries the forward half of the pennant and the grille.
  // One rectangular template gives all three pads identical hard edges.
  // One axial plane through the collar sets the front of every backing.
  const forwardPadStart=(-1.188+.1665)/engineeringShape.bodyScale,forwardPadEnd=-.875,forwardPadWidth=.060,forwardPadDepth=.005;
  const forwardLevels=[...secondaryProfile.map(p=>p[1]),forwardPadStart,forwardPadEnd-.008,forwardPadEnd];
  for(let z=forwardPadStart;z<forwardPadEnd;z+=.008)forwardLevels.push(z);
  const forwardProfile=[...new Set(forwardLevels)].sort((a,b)=>a-b).map(z=>[engineeringShape.radiusAt(z),z]);
  const forwardPadWallMaterial=material(window.ENTERPRISE_MOVIE_HULL_COLOR,{side:T.DoubleSide});
  const forwardPadSetback=.004;
  const hullPadBaseAt=(across,level,axis)=>{
    if(axis===0)return engineeringShape.downAt(level,across);
    const height=Math.sin(axis)*across,r=engineeringShape.radiusAt(level),extent=height>=0?engineeringShape.upAt(level,0):engineeringShape.downAt(level,0);
    return r*Math.sqrt(Math.max(0,1-(height/extent)**2));
  };
  const padBaseAt=(across,level,axis)=>{
    // Ahead of the cylinder shoulder, the pennant backing is a short solid
    // tab rooted in the sensor collar, rather than a floating raised strip.
    if(level<bodyFront){
      const collarZ=level*engineeringShape.bodyScale-.1665;
      const collarRadius=radiusAt(collarOuterProfile,collarZ);
      return Math.sqrt(Math.max(0,collarRadius**2-across**2));
    }
    return hullPadBaseAt(across,level,axis);
  };
  const padFaceAt=(across,level,axis)=>{
    // Bridge the rounded cylinder shoulder with one uninterrupted face.
    // The hull's shoulder must not create a second ledge under the grille.
    const front=engineeringShape.downAt(bodyFront,0)+forwardPadDepth;
    const blendStart=bodyFront+.025;
    if(level<=blendStart)return front;
    const t=Math.max(0,Math.min(1,(level-blendStart)/(forwardPadEnd-blendStart))),blend=t*t*(3-2*t);
    return front+(hullPadBaseAt(across,level,0)-front)*blend;
  };
  const padLevels=[forwardPadStart,forwardPadStart+forwardPadSetback];
  for(let level=forwardPadStart+forwardPadSetback+.008;level<forwardPadEnd;level+=.008)padLevels.push(level);
  padLevels.push(forwardPadEnd);
  function createForwardPad(name,axisAngle,surfaceMaterial,parent=model){
    const positions=[],uvs=[],groups=[],wallPositions=[],wallIndices=[],columns=16;
    const orient=(across,level,distance)=>[Math.cos(axisAngle)*across+Math.sin(axisAngle)*distance,level,-Math.sin(axisAngle)*across+Math.cos(axisAngle)*distance];
    // Identical faces and walls on the bottom and both sides. Bury the
    // common attachment slightly inside the hull so no extra step is needed.
    const baseAt=(across,level)=>Math.max(0,padBaseAt(across,level,0)-(level>=bodyFront?.006:.0001));
    function wall(a,b){
      const n=wallPositions.length/3;
      for(const [across,level] of [a,b])wallPositions.push(...orient(across,level,baseAt(across,level)));
      for(const [across,level] of [a,b])wallPositions.push(...orient(across,level,padFaceAt(across,level,axisAngle)));
      wallIndices.push(n,n+1,n+2,n+1,n+3,n+2);
    }
    for(let row=0;row<padLevels.length-1;row++){
      const start=positions.length/3;
      for(let col=0;col<columns;col++){
        const left=(col/columns-.5)*forwardPadWidth,right=((col+1)/columns-.5)*forwardPadWidth;
        const a=padLevels[row],b=padLevels[row+1];
        // Unshared vertices keep the front ledge and every wall sharply shaded.
        for(const [across,level] of [[left,a],[right,a],[left,b],[right,a],[right,b],[left,b]]){
          positions.push(...orient(across,level,padFaceAt(across,level,axisAngle)));
          let angle=axisAngle+Math.atan2(across,axisAngle===0?engineeringShape.downAt(level,across):baseAt(across,level));
          if(axisAngle===0&&(left+right)<0&&angle<=0)angle+=Math.PI*2;
          else if(axisAngle<0)angle+=Math.PI*2;
          uvs.push(angle/(Math.PI*2),(level+1.19)/1.19);
        }
      }
      groups.push({start,count:positions.length/3-start,materialIndex:row===0?1:0});
      wall([-forwardPadWidth/2,padLevels[row]],[-forwardPadWidth/2,padLevels[row+1]]);
      wall([forwardPadWidth/2,padLevels[row]],[forwardPadWidth/2,padLevels[row+1]]);
    }
    wall([-forwardPadWidth/2,forwardPadStart],[forwardPadWidth/2,forwardPadStart]);
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);geometry.computeVertexNormals();
    const pad=new T.Mesh(geometry,[surfaceMaterial,forwardPadWallMaterial]);pad.rotation.x=Math.PI/2;pad.name=name;
    pad.userData={depth:forwardPadDepth,rearTaper:forwardPadEnd-forwardPadStart,patternSetback:forwardPadSetback,hardCorners:true};parent.add(pad);
    const wallGeometry=new T.BufferGeometry();wallGeometry.setAttribute('position',new T.Float32BufferAttribute(wallPositions,3));wallGeometry.setIndex(wallIndices);wallGeometry.computeVertexNormals();
    const walls=new T.Mesh(wallGeometry,forwardPadWallMaterial);walls.name=name+'-plain-square-walls';pad.add(walls);
    return pad;
  }
  function followForwardPad(o,axisAngle,clearance=0){
    const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      let x=p.getX(i);const z=p.getZ(i),level=p.getY(i),radius=Math.hypot(x,z);
      if(radius<1e-8)continue;
      // Keep side paint at its original physical height on the deeper belly.
      const r=engineeringShape.radiusAt(level),extent=z>0?engineeringShape.downAt(level,0):engineeringShape.upAt(level,0);
      x=Math.sign(x)*r*Math.sqrt(Math.max(0,1-(z/extent)**2));
      const normalX=Math.sin(axisAngle),normalZ=Math.cos(axisAngle);
      const across=x*normalZ-z*normalX,normalDistance=x*normalX+z*normalZ;
      const onPad=level>=forwardPadStart&&level<=forwardPadEnd&&Math.abs(across)<=forwardPadWidth/2;
      const lift=(onPad?Math.max(0,padFaceAt(across,level,axisAngle)-normalDistance):0)+clearance;
      p.setX(i,x+normalX*lift);p.setZ(i,z+normalZ*lift);
    }
    p.needsUpdate=true;o.geometry.computeVertexNormals();
  }
  for(const side of [-1,1]){
    const on=side<0?0xff5144:0x69e991,off=side<0?0x442823:0x243e2a;
    const surfaceY=.380+.029+(.674-.635)*.009/.104;
    const lens=sphere(side*.635,surfaceY+.002,-1.53,.012,.008,.012,material(on,{emissive:on,emissiveIntensity:.8,roughness:.22,metalness:0}));
    lens.name=side<0?'port-red-navigation-light':'starboard-green-navigation-light';
    primaryHull.add(lens);
    navigationLights.push({lens,on,off,fade:true,onColor:new T.Color(on),offColor:new T.Color(off)});
    // Warm white running lights on the underside beside the lateral registries.
    const undersideY=.380-.033+(.635-.48)/(.645-.48)*.008;
    const runningLightBase=sphere(side*.635,undersideY,-1.53,.008,.002,.008,trim);primaryHull.add(runningLightBase);
    const runningLight=sphere(side*.635,undersideY-.002,-1.53,.005,.0035,.005,white.clone());
    runningLight.name=(side<0?'port':'starboard')+'-saucer-underside-running-light';primaryHull.add(runningLight);
    navigationLights.push({lens:runningLight,on:0xffedcd,off:0x25251e});
    engineeringParts.push(createForwardPad((side<0?'port':'starboard')+'-raised-forward-pennant-pad',side*Math.PI/2,hullDouble));
    const serviceGrille=hullDecal(forwardProfile,side,-1.147,.046,.064,decalMaterial(details.secondaryServiceGrille),[0,0,0],secondarySegments);serviceGrille.name=(side<0?'port':'starboard')+'-forward-hull-service-grille';followForwardPad(serviceGrille,side*Math.PI/2,.00005);engineeringParts.push(serviceGrille);
    const pennantLength=.563/engineeringShape.bodyScale;
    const hullPennant=hullDecal(forwardProfile,side,-.5925-pennantLength/2,.068,pennantLength,side<0?portPennantMaterial:pennantMaterial,[0,0,0],secondarySegments);hullPennant.name=(side<0?'port':'starboard')+'-secondary-pennant';followForwardPad(hullPennant,side*Math.PI/2,.00005);engineeringParts.push(hullPennant);
  }
  // The same rectangular template below; per-cell UVs preserve its seam.
  const ventralPad=new T.Group();ventralPad.name='ventral-raised-forward-hull-pad';model.add(ventralPad);
  engineeringParts.push(ventralPad);
  ventralPad.userData.depth=forwardPadDepth;ventralPad.userData.rearTaper=forwardPadEnd-forwardPadStart;
  createForwardPad('ventral-pad-surface',0,secondaryHull.material[0],ventralPad);
  // The aft hangar has a hemispherical, segmented clamshell. Its two halves
  // meet along the centerline and overlap into curved stacks at each side.
  const bayStart=model.children.length;
  const bayHull=hull,bayEdge=material(0x89978c),interior=material(0x71797c,{roughness:.88,emissive:0x71797c,emissiveIntensity:.18}),deck=material(0x818a7e);
  function arch(rx,ry,start,end,front,back,thickness,mat){
    const positions=[],indices=[],segments=40;
    for(let i=0;i<=segments;i++){const a=start+(end-start)*i/segments;for(const [r,z] of [[0,front],[thickness,front],[0,back],[thickness,back]])positions.push(Math.cos(a)*(rx+r),.008+Math.sin(a)*(ry+r),z);}
    const quad=(a,b,d,e)=>indices.push(a,b,d,b,e,d);
    for(let i=0;i<segments;i++){const a=i*4,b=a+4;quad(a,b,a+1,b+1);quad(a+2,a+3,b+2,b+3);quad(a,a+2,b,b+2);quad(a+1,b+1,a+3,b+3);}
    quad(0,1,2,3);const a=segments*4;quad(a,a+2,a+1,a+3);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    return mesh(geo,mat);
  }
  const hangarEnclosure=new T.Group();hangarEnclosure.name='movie-hangar-enclosure';model.add(hangarEnclosure);
  function enclosed(o,name){o.name=name;hangarEnclosure.add(o);return o;}
  const doorFrame=createHangarDoorFrameGeometry(T,{scaleY:.128/.162,flatBelly:true,aftHull:secondaryHull});
  const framePaint=hullDouble;
  enclosed(mesh(doorFrame.seal,framePaint),'movie-hangar-aft-bulkhead');
  const bayFairing=enclosed(mesh(doorFrame.fairing,framePaint.clone()),'movie-hangar-integrated-fairing');
  enclosed(mesh(doorFrame.rim,framePaint),'movie-hangar-flat-door-rim');
  enclosed(mesh(doorFrame.base,framePaint),'movie-hangar-squared-base');
  enclosed(mesh(doorFrame.throat,framePaint),'movie-hangar-door-return');
  enclosed(arch(.083,.071,0,Math.PI,-.018,-.283,.007,material(0x727b7e,{side:T.DoubleSide})),'movie-hangar-ceiling');
  for(const side of [-1,1]){
    enclosed(box(side*.087,-.019,-.149,.012,.060,.262,interior),(side<0?'port':'starboard')+'-hangar-wall');
    // Keep the full interior arch behind the recessed door return. These
    // structural shoulders sit outside the ceiling instead of narrowing
    // the whole bay to the clamshell's smaller frontal outline.
    const shoulderPositions=[],shoulderIndices=[],shoulderProfile=[];
    const roofX=y=>.083*Math.sqrt(Math.max(0,1-((y-.008)/.071)**2));
    for(let n=0;n<=64;n++)shoulderProfile.push(.008+.071*n/64);
    for(const y of shoulderProfile)for(const [x,z] of [[roofX(y)+.005,-.018],[roofX(y)+.001,-.018],[roofX(y)+.005,-.283],[roofX(y)+.001,-.283]])shoulderPositions.push(side*x,y,z);
    for(let row=0;row<shoulderProfile.length-1;row++){
      const a=row*4,b=a+4;shoulderIndices.push(a,b,a+1,a+1,b,b+1,a+2,a+3,b+2,a+3,b+3,b+2,a,a+2,b,b,a+2,b+2,a+1,b+1,a+3,a+3,b+1,b+3);
    }
    const last=(shoulderProfile.length-1)*4;shoulderIndices.push(0,1,2,1,3,2,last,last+2,last+1,last+1,last+2,last+3);
    const shoulderGeo=new T.BufferGeometry();shoulderGeo.setAttribute('position',new T.Float32BufferAttribute(shoulderPositions,3));shoulderGeo.setIndex(shoulderIndices);shoulderGeo.computeVertexNormals();
    const shoulderMaterial=material(0x727b7e,{roughness:.9,emissive:0x727b7e,emissiveIntensity:.12,side:T.DoubleSide});
    enclosed(mesh(shoulderGeo,shoulderMaterial),(side<0?'port':'starboard')+'-hangar-upper-wall');
  }
  const bayDoorLeaves=[],bayDoors=new T.Group();bayDoors.name='shuttle-bay-clamshell-doors';
  const upperLampY=doorFrame.profile.lampY;
  bayDoors.position.set(0,doorFrame.profile.cy,.018);bayDoors.scale.set(doorFrame.profile.rx,doorFrame.profile.ry,.048);model.add(bayDoors);
  const bayDoorPaint=hullDouble;
  const doorSeamMaterial=hullDouble;
  // Concentric tracks let the inner leaves tuck behind each successive leaf.
  function shellLeaf(start,end,layer,mat){
    const positions=[],indices=[],rows=28,cols=10,r=1+layer*.008;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const lat=j/rows*Math.PI/2,a=start+(end-start)*i/cols;
      positions.push(Math.sin(a)*Math.cos(lat)*r,Math.sin(lat)*r,Math.cos(a)*Math.cos(lat)*r);
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    g.userData.hullPanelTopology={segments:cols,rows:rows+1,kind:'clamshell',start,end};
    return new T.Mesh(g,mat);
  }
  for(const side of [-1,1])for(let n=0;n<3;n++){
    const span=Math.PI/6,start=side*n*span,end=side*((n+1)*span+(n<2?.025:0)),leaf=new T.Group();
    leaf.name=(side<0?'port':'starboard')+'-clamshell-leaf-'+n;
    leaf.add(shellLeaf(start,end,n,bayDoorPaint));
    leaf.add(shellLeaf(start,start+side*.010,n+.2,doorSeamMaterial));
    bayDoors.add(leaf);bayDoorLeaves.push({leaf,side,n,span});
  }
  let bayDoorOpen=1,lastDoorTime;
  function setBayDoorOpen(value){
    bayDoorOpen=Math.max(0,Math.min(1,value));
    const eased=bayDoorOpen*bayDoorOpen*(3-2*bayDoorOpen);
    // The center leaf collects its neighbors in sequence into one side stack.
    for(const {leaf,side,n,span} of bayDoorLeaves)leaf.rotation.y=side*Math.max(0,eased*(Math.asin(.90)+n*.012)-n*span);
    bayDoors.userData.open=bayDoorOpen;
    bayDoors.userData.apertureOpen=bayDoorOpen*.90;
  }
  setBayDoorOpen(1);
  // Solid forward bulkhead: the open bay looks into a finished room,
  // never through a black placeholder or out through the forward hull.
  const outline=[[-.085,-.050],[.085,-.050],[.085,.008]];
  for(let n=0;n<=40;n++){const a=n*Math.PI/40;outline.push([Math.cos(a)*.085,.008+Math.sin(a)*.074]);}
  const wallGeo=createGarageBulkheadGeometry(T,outline,-.278,-.290);
  enclosed(mesh(wallGeo,material(0x778177,{side:T.DoubleSide})),'movie-hangar-forward-bulkhead');
  enclosed(box(0,-.051,-.1155,.18,.009,.319,deck),'movie-hangar-floor');
  for(const side of [-1,1]){
    const redLamp=box(side*.055,doorFrame.profile.floor-.008/doorFrame.profile.scaleY,doorFrame.profile.baseFront+.001,.022,.002/doorFrame.profile.scaleY,.002,red);redLamp.name=(side<0?'port':'starboard')+'-hangar-red-light';
    const yellowLamp=box(side*.025,doorFrame.profile.floor-.014/doorFrame.profile.scaleY,doorFrame.profile.baseFront+.001,.0018,.011/doorFrame.profile.scaleY,.002,amber);yellowLamp.name=(side<0?'port':'starboard')+'-hangar-yellow-light';
  }
  const greenLamp=box(0,doorFrame.profile.floor-.008/doorFrame.profile.scaleY,doorFrame.profile.baseFront+.001,.024,.002/doorFrame.profile.scaleY,.002,glow(0x64c995));greenLamp.name='hangar-green-light';
  const doorCrown=doorFrame.profile.cy+doorFrame.profile.ry,beaconScale=doorFrame.profile.scaleY;
  enclosed(box(0,upperLampY+.0015/beaconScale,doorFrame.profile.lampFront-.005,.018,.013/beaconScale,.010,framePaint),'hangar-upper-light-mount');
  const upperLamp=box(0,upperLampY,doorFrame.profile.lampFront+.001,.010,.007/beaconScale,.002,amber);upperLamp.name='hangar-upper-yellow-light';
  model.add(createHangarRoofBeacon(T,beaconScale,hullDouble));
  box(0,doorCrown+.0055/beaconScale,doorFrame.profile.roofFront+.001,.007,.0015/beaconScale,.002,white);
  // Reference-style fittings share the registered bay's existing transforms.
  const bayInterior=createShuttleBayInterior(T,{fitDoorShoulders:true,storageScaleY:.162/.128,storageScaleZ:1/engineeringShape.bodyScale});model.add(bayInterior);
  const bayAssembly=new T.Group();bayAssembly.name='reference-shuttle-bay';for(const part of model.children.slice(bayStart))bayAssembly.add(part);
  bayAssembly.scale.y=.128/.162;bayAssembly.position.y=.102*(1-bayAssembly.scale.y);model.add(bayAssembly);engineeringParts.push(bayAssembly);
  const engineeringAssembly=new T.Group();engineeringAssembly.name='reference-engineering-assembly';for(const part of engineeringParts)engineeringAssembly.add(part);engineeringAssembly.scale.z=engineeringShape.bodyScale;model.add(engineeringAssembly);
  model.userData.referenceDimensions={bodyScale:engineeringShape.bodyScale,bayScaleY:bayAssembly.scale.y,bayOffsetY:bayAssembly.position.y,saucerDiameter:1.36};
  model.position.z=-.032;
  let lastW=0,lastH=0;
  function draw(ctx,w,h,m,s){
    bayInterior.setGarageDoorOpen(m.garageDoorOpen??0);
    // Viewed head-on, +Z rotation is clockwise: port spins opposite starboard.
    const rotorTime=Number.isFinite(s.time)?s.time:(m.clock||0);
    domeEmissionTime.value=rotorTime;
    for(const {rotor,side} of capRotors)rotor.rotation.z=-side*rotorTime*Math.PI*.75;
    for(const {lamp,green,red,seed} of capInternalLights){
      if(green){
        const frame=Math.floor(rotorTime*(11+seed%5)+seed*.37),noise=Math.sin(frame*127.1+seed*311.7)*43758.5453;
        const on=noise-Math.floor(noise)>.84;lamp.material.opacity=on?.18:.005;lamp.userData.on=on;
      }else{
        const t=rotorTime*(.8+(seed%4)*.17)+seed*.31,frame=Math.floor(t),f=t-frame,smooth=f*f*(3-2*f);
        const random=n=>{const v=Math.sin(n*127.1+seed*311.7)*43758.5453;return v-Math.floor(v);};
        const pulse=random(frame)*(1-smooth)+random(frame+1)*smooth;
        lamp.material.opacity=red?.15+.35*pulse:.08+.92*pulse;
        lamp.material.color.setHex(red?0xff6f1a:0xffcf45).multiplyScalar((red?1+1.5*pulse:1.4+2.6*pulse)*domeLampBrightness);
      }
    }
    const doorDt=lastDoorTime===undefined?0:Math.max(0,Math.min(.1,rotorTime-lastDoorTime));lastDoorTime=rotorTime;
    if(Number.isFinite(s.bayDoorOpen))setBayDoorOpen(s.bayDoorOpen);
    else if(m.phase){
      const range=Math.hypot(m.x,m.y,m.z-110);
      const wantOpen=m.phase==='docking'||m.phase==='flight'&&(range<3||(m.clock||0)<6)||m.phase==='landed'&&(m.clock||0)<6;
      setBayDoorOpen(bayDoorOpen+Math.sign((wantOpen?1:0)-bayDoorOpen)*Math.min(Math.abs((wantOpen?1:0)-bayDoorOpen),doorDt/2.4));
    }
    const navigationFlash=((rotorTime%2)+2)%2<.5;
    const navigationPulse=.5-.5*Math.cos(rotorTime*Math.PI*2/3);
    for(const {lens,on,off,fade,onColor,offColor} of navigationLights){
      if(fade){lens.material.color.copy(offColor).lerp(onColor,navigationPulse);lens.material.emissive.copy(lens.material.color);lens.material.emissiveIntensity=.8*navigationPulse;}
      else{const color=navigationFlash?on:off;lens.material.color.setHex(color);lens.material.emissive?.setHex(color);}
    }
    const rw=Math.min(1920,Math.round(w)),rh=Math.round(h*rw/w);
    if(lastW!==rw||lastH!==rh){renderer.setSize(rw,rh,false);lastW=rw;lastH=rh;}
    const zoom=Math.max(.5,Math.min(8,s.cameraZoom||1));
    camera.near=Math.max(.005,Math.min(10,Math.hypot(m.x,m.y,m.z-110)*.01));
    camera.fov=2*Math.atan(h/(2*w*.65*zoom))*180/Math.PI;camera.aspect=w/h;camera.updateProjectionMatrix();
    camera.position.set(m.x,m.z-110,m.y);const heading=s.heading*Math.PI/180,pitch=s.pitch*Math.PI/180;
    // Match the shuttle's physical up vector and the remote attitude monitor.
    camera.up.set(0,1,0);camera.lookAt(camera.position.x+Math.sin(heading)*Math.cos(pitch),camera.position.y+Math.sin(pitch),camera.position.z-Math.cos(heading)*Math.cos(pitch));camera.rotateZ(-(m.bank||0));
    renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,w,h);
    const bay=new T.Vector3(0,0,0).project(camera);
    return {x:(bay.x+1)*w/2,y:(1-bay.y)*h/2,visible:bay.z>=-1&&bay.z<=1};
  }
  const hullSurfaceDetail=createMovieHullSurfaceDetail(T,Math.min(8,renderer.capabilities.getMaxAnisotropy()));
  for(const material of new Set([hull,hullDouble,bayDoorPaint,pylonMetal,upperHousing.material]))hullSurfaceDetail.apply(material,0);
  hullSurfaceDetail.apply(saucerMat,1);hullSurfaceDetail.apply(bottomSaucerMat,1);
  hullSurfaceDetail.apply(saucer.material[1],4);hullSurfaceDetail.apply(secondaryHull.material[0],2);hullSurfaceDetail.apply(nacelleMetal,3);
  hullSurfaceDetail.apply(bayFairing.material,5);
  hullSurfaceDetail.prepare(model);
  model.userData.variant='movie';
  return trackEnterpriseResources({draw,renderer,scene,model,camera,setBayDoorOpen,ready:Promise.all([details.ready,hullSurfaceDetail.ready])},details);
};
