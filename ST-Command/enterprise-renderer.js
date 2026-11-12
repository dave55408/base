/* TOS Enterprise proportions reconstructed from the supplied orthographic sheet.
   X is starboard, Y is up, Z is aft; the bay entrance is the model origin. */
window.createEnterpriseRenderer=()=>{
  const T=window.AlpineThree;if(!T)return null;
  let renderer;try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch{return null;}
  renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),model=new T.Group(),camera=new T.PerspectiveCamera(45,1,.005,100000);
  scene.add(model);scene.add(new T.HemisphereLight(0xddeaff,0x28313d,1.25));
  const sun=new T.DirectionalLight(0xffeed6,2);sun.position.set(-3,5,4);scene.add(sun);
  const fill=new T.DirectionalLight(0x83adcf,.7);fill.position.set(3,0,-4);scene.add(fill);
  const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.63,metalness:.22,...extra});
  const hull=material(window.ENTERPRISE_HULL_COLOR),edge=hull,hullDouble=material(window.ENTERPRISE_HULL_COLOR,{side:T.DoubleSide}),trim=material(0x4c5b56),red=material(0x9c2820);
  const black=new T.MeshBasicMaterial({color:0x090e14,toneMapped:false,side:T.DoubleSide});
  const glow=color=>new T.MeshBasicMaterial({color,toneMapped:false});
  const amber=glow(0xffa344),white=glow(0xf0f4d9);
  // A soft core, visible through the muted shell, suggests an internal lamp.
  const capGlowCanvas=document.createElement('canvas');capGlowCanvas.width=512;capGlowCanvas.height=256;
  const capGlowContext=capGlowCanvas.getContext('2d'),capGlowPixels=capGlowContext.createImageData(512,256);
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){
    const front=Math.max(0,-Math.sin(x/511*Math.PI*2)*Math.sin(y/255*Math.PI)),value=Math.round(255*(.18+.82*front**3)),i=(y*512+x)*4;
    capGlowPixels.data[i]=capGlowPixels.data[i+1]=capGlowPixels.data[i+2]=value;capGlowPixels.data[i+3]=255;
  }
  capGlowContext.putImageData(capGlowPixels,0,0);const capGlowMap=new T.CanvasTexture(capGlowCanvas);
  const capMaterial=material(0x8f4540,{emissive:0x9a5149,emissiveMap:capGlowMap,emissiveIntensity:1.15,roughness:.4,metalness:.05});
  const capLineMaterial=material(0x7d3c38,{emissive:0x874740,emissiveMap:capGlowMap,emissiveIntensity:1.15,roughness:.4,metalness:.05,side:T.DoubleSide,transparent:true,opacity:.5,depthWrite:false}),capRotors=[];
  const capRadius=.087,capSeam=-.80;
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
    if(Array.isArray(mat))for(let j=0;j<profile.length-1;j++){
      const rim=profile[j][0]>.6&&profile[j][0]===profile[j+1][0];
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
  const details=createEnterpriseDetailing(T);
  const decalMaterial=map=>material(0xffffff,{map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,side:T.DoubleSide});
  const pennantMaterial=decalMaterial(details.pennant);
  function hullDecal(profile,side,level,width,height,mat,center=[0,0,0],segments=96){
    const o=hullWindow(profile,'z',center,side*Math.PI/2,level,width,height,false,segments),uv=o.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);uv.setXY(i,side>0?1-v:v,side>0?u:1-u);}
    o.material=mat;o.name='flush-hull-pennant';return o;
  }
  const registryMat=decalMaterial(details.registry);
  const saucerMat=material(0xffffff,{map:details.top,side:T.DoubleSide}),bottomSaucerMat=material(0xffffff,{map:details.bottom,side:T.DoubleSide});
  // Keep the mirrored underside UV seam off the rim and avoid coplanar trim.
  const saucerProfile=[[0,-.028],[.31,-.028],[.48,-.026],[.66,-.026],[.68,-.004],[.68,.025],[.57,.038],[.36,.055],[.18,.066],[0,.066]];
  const saucer=lathe(saucerProfile,[saucerMat,material(0xffffff,{map:details.rim,side:T.DoubleSide}),bottomSaucerMat],0,.43,-1.53);
  // Give the vertical rim its own orthographic projection without disturbing
  // the top and bottom planar maps at their shared edges.
  saucer.geometry=saucer.geometry.toNonIndexed();
  for(const group of saucer.geometry.groups)if(group.materialIndex===1){
    const p=saucer.geometry.attributes.position,uv=saucer.geometry.attributes.uv;
    for(let i=group.start;i<group.start+group.count;i++){
      const a=(Math.atan2(p.getX(i),p.getZ(i))+Math.PI*2)%(Math.PI*2);
      uv.setXY(i,a/(Math.PI*2),(p.getY(i)+.004)/.029);
    }
    uv.needsUpdate=true;
  }
  // Rounded deck shoulders, a low bridge tier and a shallow sensor cap.
  const deckProfile=[[0,0],[.192,0],[.191,.012],[.186,.025],[.177,.039],[.162,.047],[.135,.051],[0,.051]];
  function teardropHousing(geometry){
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z);p.setX(i,x*.74);p.setZ(i,(z+(r>0 ? .14*Math.max(0,z/r)**4*(r/.192)**1.5 : 0))*.74);}
    p.needsUpdate=true;const uv=geometry.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,.5+p.getX(i)/1.38,.5-p.getZ(i)/1.38);uv.needsUpdate=true;geometry.computeVertexNormals();
  }
  const upperHousing=lathe(deckProfile,saucerMat,0,.488,-1.53);teardropHousing(upperHousing.geometry);upperHousing.name='upper-saucer-teardrop';
  const deckMarker=new T.Object3D();deckMarker.position.set(0,.539,-1.405);deckMarker.name='top-yellow-service-panel';model.add(deckMarker);
  lathe([[0,0],[.077,0],[.077,.009],[.071,.022],[.059,.028],[.040,.029],[0,.029]],hull,0,.536,-1.53);
  box(0,.551,-1.466,.021,.031,.035,hull);
  const sensorGlass=material(0xa9d4ac,{emissive:0x4b8755,emissiveIntensity:.38,roughness:.3,metalness:.08});
  lathe([[0,0],[.036,0],[.036,.003],[0,.003]],edge,0,.564,-1.53);
  sphere(0,.570,-1.53,.034,.010,.034,sensorGlass);
  // The underside is a broad tapered bowl with a flattened base, not a sphere.
  const bowlProfile=[[0,-.095],[.10,-.095],[.135,-.090],[.17,-.075],[.22,-.044],[.275,-.010],[.29,0],[0,0]];
  lathe(bowlProfile,bottomSaucerMat,0,.405,-1.53);
  lathe([[0,0],[.078,0],[.078,.012],[.074,.016],[0,.016]],hull,0,.296,-1.53);
  lathe([[0,-.024],[.009,-.021],[.024,-.014],[.041,-.005],[.046,0],[0,0]],sensorGlass,0,.298,-1.53);
  beam([0,.275,-1.53],[0,.268,-1.53],.002,.002,trim);
  // The secondary hull is a tapered cylinder, with the deflector at its forward end.
  const secondaryBaseProfile=[[0,-1.19],[.13,-1.19],[.149,-1.14],[.154,-1.05],[.153,-.94],[.148,-.75],[.135,-.48],[.119,-.24],[.105,-.07],[.102,0]];
  const secondaryProfile=[...secondaryBaseProfile.slice(0,8),...Array.from({length:48},(_,i)=>{const z=-.24+(i+1)*.005;return [radiusAt(secondaryBaseProfile,z),z];})];
  const secondaryHull=lathe(secondaryProfile,[material(0xffffff,{map:details.secondary,side:T.DoubleSide}),hull],0,0,0,'z');secondaryHull.name='secondary-hull';
  // Carry enough hull below the deck to support the reference's thick base,
  // joining smoothly into the original forward section.
  const aftBaseDepth=hangarDoorProfile().bellyDepth;
  const aftSkin=secondaryHull.geometry.attributes.position;
  for(let i=0;i<aftSkin.count;i++){
    const x=aftSkin.getX(i),z=aftSkin.getY(i),depth=aftSkin.getZ(i);if(z<=-.24||depth<=0)continue;
    aftSkin.setZ(i,EnterpriseEngineeringShape.cutoutAt(z,x,{start:-.24,radius:Math.hypot(x,depth),startDepth:radiusAt(secondaryBaseProfile,-.24),startSlope:(radiusAt(secondaryBaseProfile,-.24)-radiusAt(secondaryBaseProfile,-.241))/.001,endDepth:aftBaseDepth}));
  }
  aftSkin.needsUpdate=true;secondaryHull.geometry.computeVertexNormals();
  EnterpriseEngineeringShape.smoothHullSeam(T,secondaryHull.geometry,96);
  // Slanted neck and diagonal pylons follow the side and rear reference views.
  // Bury both ends in their hulls so the dorsal reads as one solid structure.
  const dorsalSection=[[-.72,.05],[-1.0,.05],[-1.44,.46],[-1.12,.45]],dorsalVertices=[],dorsalIndices=[];
  for(const x of [-.0425,.0425])for(const [z,y] of dorsalSection)dorsalVertices.push(x,y,z);
  dorsalIndices.push(0,2,1,0,3,2,4,5,6,4,6,7);
  for(let i=0;i<4;i++){const n=(i+1)%4;dorsalIndices.push(i,n,i+4,n,n+4,i+4);}
  const dorsalGeometry=new T.BufferGeometry();dorsalGeometry.setAttribute('position',new T.Float32BufferAttribute(dorsalVertices,3));dorsalGeometry.setIndex(dorsalIndices);
  const dorsalFaces=dorsalGeometry.toNonIndexed();dorsalFaces.computeVertexNormals();mesh(dorsalFaces,hullDouble);
  const neckMaterial=decalMaterial(details.neck);
  for(const side of [-1,1]){
    const positions=dorsalSection.flatMap(([z,y])=>[side*.0425,y,z]),uv=dorsalSection.flatMap(([z,y])=>[side>0?(z+1.44)/.72:1-(z+1.44)/.72,(y-.05)/.41]);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();const skin=mesh(geo,neckMaterial);skin.renderOrder=1;
  }
  const strutGrilleMaterial=material(0x303b38,{roughness:.85,metalness:.12,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const finMaterial=hull,finGroove=material(0x66736a,{roughness:.8});
  const nacelleMetal=material(0xffffff,{map:details.nacelle});
  const inboardChannelMaterial=decalMaterial(details.inboardChannel);
  const outerGrilleMaterial=decalMaterial(details.outerGrille);
  const exhaustHoodMaterial=material(0x34413e,{roughness:.78,side:T.DoubleSide}),exhaustInsertMaterial=material(0xb3c9cc,{roughness:.35,metalness:.25});
  for(const side of [-1,1]){
    const strut=beam([side*.085,.045,-.30],[side*.445,.50,-.30],.055,.12),grilleLength=Math.hypot(.360,.455)*.82;
    // Recessed-looking panels follow the upward-facing side of each sloped strut.
    for(let n=0;n<5;n++){
      const panel=new T.Mesh(new T.PlaneGeometry(.084,grilleLength/5-.006),strutGrilleMaterial);
      panel.position.set(-side*.055/2,-grilleLength/2+(n+.5)*grilleLength/5,0);panel.rotation.y=-side*Math.PI/2;
      panel.name=(side<0?'port':'starboard')+'-strut-top-grille';strut.add(panel);
    }
    box(side*.445,.485,-.30,.058,.06,.17,edge);
    const x=side*.445;
    const nacelleProfile=[[0,capSeam],[capRadius,capSeam],[capRadius,-.75],[.087,.64],[.08146,.73],[.079,.755],[.068,.78],[0,.78]];
    lathe(nacelleProfile,[nacelleMetal,hull,exhaustHoodMaterial],x,.535,0,'z',64);
    // A forward hemisphere meets the full-width cylinder tangentially at its rim.
    const capGeometry=new T.SphereGeometry(capRadius,64,32,0,Math.PI*2,0,Math.PI/2);capGeometry.rotateX(-Math.PI/2);
    const capPositions=capGeometry.attributes.position,capUV=capGeometry.attributes.uv;
    for(let i=0;i<capPositions.count;i++){
      const phi=Math.atan2(capPositions.getZ(i),-capPositions.getX(i));
      capUV.setXY(i,(phi/(Math.PI*2)+1)%1,1-Math.acos(Math.max(-1,Math.min(1,capPositions.getY(i)/capRadius)))/Math.PI);
    }
    const cap=mesh(capGeometry,capMaterial,x,.535,capSeam);cap.name=side<0?'port-engine-cap':'starboard-engine-cap';
    lathe([[.071,.68],[.087,.68],[.087,.73],[.071,.73]],trim,x,.535,0,'z',64);
    const exhaustInsert=sphere(x,.521,.805,.049,.046,.035,exhaustInsertMaterial);exhaustInsert.name=(side<0?'port':'starboard')+'-rear-exhaust-insert';
    // The aft casing has a swept cutaway lip over the rounded exhaust boss.
    const hoodPositions=[],hoodIndices=[],hoodSteps=56;
    for(let n=0;n<=hoodSteps;n++){
      const a=-Math.PI*.55+n/hoodSteps*Math.PI*1.10,cut=.780+.070*Math.cos(a);
      for(const [r,z] of [[.087,.721],[.074,cut],[.084,.721],[.071,cut]])hoodPositions.push(x+Math.sin(a)*r,.535+Math.cos(a)*r,z);
      if(n<hoodSteps){const i=n*4;hoodIndices.push(i,i+4,i+1,i+1,i+4,i+5,i+2,i+3,i+6,i+3,i+7,i+6,i+1,i+5,i+3,i+3,i+5,i+7);}
    }
    const hoodGeo=new T.BufferGeometry();hoodGeo.setAttribute('position',new T.Float32BufferAttribute(hoodPositions,3));hoodGeo.setIndex(hoodIndices);hoodGeo.computeVertexNormals();const exhaustHood=mesh(hoodGeo,exhaustHoodMaterial);exhaustHood.name=(side<0?'port':'starboard')+'-rear-exhaust-hood';
    // Aft reference: the upper fins span about 9% of the nacelle diameter.
    // The horizontal inboard fin is broader but projects less from the casing.
    for(const {angle,width:baseWidth,tip:baseTip} of [
      {angle:-Math.PI/4,width:.0155,tip:.113},
      {angle:Math.PI/4,width:.0155,tip:.113},
      {angle:-side*Math.PI/2,width:.025,tip:.099}
    ]){
      const growth=1.15,width=baseWidth*growth,tip=.083+(baseTip-.083)*growth;
      const section=[[.27,.083],[.278,.096],[.294,.105],[.316,.109],[.622,.109],[.657,.105],[.677,.097],[.685,.083]],vertices=[],indices=[];
      const finZ=z=>.4775+(z-.4775)*growth;
      const radialX=Math.sin(angle),radialY=Math.cos(angle),tangentX=Math.cos(angle),tangentY=-Math.sin(angle);
      const finRadius=r=>.083+(r-.083)*(tip-.083)/(.109-.083);
      for(const offset of [-width/2,width/2])for(const [z,r] of section){const radius=finRadius(r);vertices.push(x+radialX*radius+tangentX*offset,.535+radialY*radius+tangentY*offset,finZ(z));}
      const count=section.length;for(let i=1;i<count-1;i++)indices.push(0,i+1,i,count,count+i,count+i+1);
      for(let i=0;i<count;i++){const n=(i+1)%count;indices.push(i,n,i+count,n,n+count,i+count);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);
      const faces=geo.toNonIndexed();faces.computeVertexNormals();const fin=mesh(faces,finMaterial);fin.name=(side<0?'port':'starboard')+'-aft-engine-fin';fin.userData.referenceDimensions={width,tip,inboard:Math.abs(angle)===Math.PI/2};
      for(const offset of [-width*.25,0,width*.25]){const groove=box(x+radialX*(tip+.0006)+tangentX*offset,.535+radialY*(tip+.0006)+tangentY*offset,finZ(.475),.001,.001,.27*growth,finGroove);groove.rotation.z=-angle;}
      const rootRadius=.083+(.096-.083)*(baseTip-.083)/(.109-.083);beam([x+radialX*rootRadius,.535+radialY*rootRadius,.215],[x+radialX*rootRadius,.535+radialY*rootRadius,.285],.005,.005,finMaterial);
    }
    const outerGrille=hullDecal(nacelleProfile,side,.49,.036,.19,outerGrilleMaterial,[x,.535,0],64);outerGrille.name=(side<0?'port':'starboard')+'-outer-service-grille';
    hullDecal(nacelleProfile,side,-.03,.068,1.03,registryMat,[x,.535,0],64);
    const channel=hullDecal(nacelleProfile,-side,-.08,.052,.94,inboardChannelMaterial,[x,.535,0],64);channel.name=(side<0?'port':'starboard')+'-dark-inboard-channel';
    const rotor=new T.Group();rotor.name=side<0?'port-cap-lines':'starboard-cap-lines';rotor.position.set(x,.535,capSeam);model.add(rotor);capRotors.push({rotor,side});
    // Curved radial ribbons sit on the bulb surface rather than around its rim.
    for(let n=0;n<12;n++){
      const positions=[],indices=[],uv=[];
      for(let j=0;j<=24;j++){
        const r=.009+j/24*.074,a=n*Math.PI/6+j/24*.15,half=2*(.0012+r*.012)/r;
        for(const t of [a-half,a+half]){
          const x=Math.sin(t)*r,y=Math.cos(t)*r,z=-Math.sqrt(capRadius**2-r**2);
          positions.push(x,y,z-.001);
          const phi=Math.atan2(z,-x);uv.push((phi/(Math.PI*2)+1)%1,1-Math.acos(y/capRadius)/Math.PI);
        }
        if(j<24){const i=j*2;indices.push(i,i+1,i+2,i+1,i+3,i+2);}
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();rotor.add(new T.Mesh(geo,capLineMaterial));
    }
  }
  // A thin flared reflector on a small stand-off, matching the side drawing.
  const copper=material(0xb88748,{roughness:.4,metalness:.5,side:T.DoubleSide}),copperBack=material(0x63462c,{roughness:.6,metalness:.35,side:T.DoubleSide}),copperRim=material(0x72502f,{roughness:.45,metalness:.5,side:T.DoubleSide});
  const plate=lathe([[0,-1.196],[.124,-1.196],[.124,-1.204],[0,-1.204]],copper,0,0,0,'z');plate.name='deflector-backplate';
  const mount=lathe([[0,-1.205],[.019,-1.205],[.016,-1.211],[.009,-1.216],[.009,-1.226],[0,-1.226]],copperRim,0,0,0,'z',64);mount.name='deflector-mount';
  const dishFront=[[0,-1.240],[.014,-1.240],[.024,-1.243],[.043,-1.249],[.065,-1.257],[.084,-1.264],[.097,-1.269]];
  const dishProfile=[...dishFront.map(([r,z])=>[r,z+.003]),...dishFront.slice().reverse()];
  const dish=lathe(dishProfile,copper,0,0,0,'z');dish.name='deflector-dish';dish.material=[copperBack,copper,copperRim];dish.geometry.clearGroups();
  for(let j=0;j<dishProfile.length-1;j++)dish.geometry.addGroup(j*96*6,96*6,j<6?0:j===6?2:1);
  const probeMetal=material(0xcbb977,{roughness:.4,metalness:.45,side:T.DoubleSide});
  const probe=lathe([[0,-1.322],[.0025,-1.322],[.0025,-1.252],[.006,-1.246],[.006,-1.241],[0,-1.241]],probeMetal,0,0,0,'z',48);probe.name='deflector-probe';
  const probeTip=sphere(0,0,-1.322,.006,.006,.006,probeMetal);probeTip.name='deflector-probe-tip';
  for(const part of [dish,probe,probeTip])part.position.z+=.012;
  // Windows, rim lights and hull markings add detail without changing the silhouette.
  const navLensCanvas=document.createElement('canvas');navLensCanvas.width=navLensCanvas.height=64;const navLensContext=navLensCanvas.getContext('2d');
  const navGradient=navLensContext.createRadialGradient(32,32,0,32,32,31);navGradient.addColorStop(0,'#ffffff');navGradient.addColorStop(.8,'#ffffff');navGradient.addColorStop(1,'#ffffff00');navLensContext.fillStyle=navGradient;navLensContext.fillRect(0,0,64,64);
  const navLensTexture=new T.CanvasTexture(navLensCanvas);
  for(const side of [-1,1]){
    const on=side<0?0xff5144:0x69e991,off=side<0?0x442823:0x243e2a;
    const lens=hullWindow(saucerProfile,'y',[0,.43,-1.53],side*Math.PI/2,.025+(.68-.635)*.013/.11,.026,.026/Math.hypot(1,.11/.013),true);
    lens.name=side<0?'port-red-navigation-light':'starboard-green-navigation-light';
    lens.material=new T.MeshBasicMaterial({color:on,map:navLensTexture,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    navigationLights.push({lens,on,off});
    hullDecal(secondaryProfile,side,-.874,.068,.563,pennantMaterial);
  }
  // The aft hangar has a hemispherical, segmented clamshell. Its two halves
  // meet along the centerline and overlap into curved stacks at each side.
  const bayHull=hull,bayEdge=material(0x89978c),interior=material(0x687271),deck=material(0x818a7e);
  function arch(rx,ry,start,end,front,back,thickness,mat){
    const positions=[],indices=[],segments=40;
    for(let i=0;i<=segments;i++){const a=start+(end-start)*i/segments;for(const [r,z] of [[0,front],[thickness,front],[0,back],[thickness,back]])positions.push(Math.cos(a)*(rx+r),.008+Math.sin(a)*(ry+r),z);}
    const quad=(a,b,d,e)=>indices.push(a,b,d,b,e,d);
    for(let i=0;i<segments;i++){const a=i*4,b=a+4;quad(a,b,a+1,b+1);quad(a+2,a+3,b+2,b+3);quad(a,a+2,b,b+2);quad(a+1,b+1,a+3,b+3);}
    quad(0,1,2,3);const a=segments*4;quad(a,a+2,a+1,a+3);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    return mesh(geo,mat);
  }
  const doorFrame=createHangarDoorFrameGeometry(T,{flatBelly:true,aftHull:secondaryHull});
  const framePaint=hullDouble;
  mesh(doorFrame.seal,framePaint).name='original-hangar-aft-bulkhead';
  mesh(doorFrame.fairing,framePaint).name='original-hangar-integrated-fairing';
  mesh(doorFrame.rim,framePaint).name='original-hangar-flat-door-rim';
  mesh(doorFrame.base,framePaint).name='original-hangar-squared-base';
  mesh(doorFrame.throat,framePaint).name='original-hangar-door-return';
  arch(.083,.071,0,Math.PI,-.018,-.265,.004,material(0x60696b,{side:T.DoubleSide}));
  for(const side of [-1,1]){
    box(side*.085,-.020,-.14115,.008,.056,.2457,interior).name=(side<0?'port':'starboard')+'-hangar-wall';
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
  const outline=[[-.083,-.047],[.083,-.047],[.083,.008]];
  for(let n=0;n<=24;n++){const a=n*Math.PI/24;outline.push([Math.cos(a)*.083,.008+Math.sin(a)*.071]);}outline.push([-.083,-.047]);
  const doorGeo=createGarageBulkheadGeometry(T,outline,-.27,-.282);mesh(doorGeo,material(0x586369,{emissive:0x586369,emissiveIntensity:.22,side:T.DoubleSide})).name='original-hangar-forward-bulkhead';
  box(0,-.051,-.1095,.18,.009,.307,deck);
  for(const side of [-1,1]){
    const redLamp=box(side*.055,doorFrame.profile.floor-.008,doorFrame.profile.baseFront+.001,.022,.002,.002,red);redLamp.name=(side<0?'port':'starboard')+'-hangar-red-light';
    const yellowLamp=box(side*.025,doorFrame.profile.floor-.014,doorFrame.profile.baseFront+.001,.0018,.011,.002,amber);yellowLamp.name=(side<0?'port':'starboard')+'-hangar-yellow-light';
  }
  const greenLamp=box(0,doorFrame.profile.floor-.008,doorFrame.profile.baseFront+.001,.024,.002,.002,glow(0x64c995));greenLamp.name='hangar-green-light';
  const doorCrown=doorFrame.profile.cy+doorFrame.profile.ry;
  box(0,upperLampY+.0015,doorFrame.profile.lampFront-.005,.018,.013,.010,framePaint).name='hangar-upper-light-mount';
  const upperLamp=box(0,upperLampY,doorFrame.profile.lampFront+.001,.010,.007,.002,amber);upperLamp.name='hangar-upper-yellow-light';
  model.add(createHangarRoofBeacon(T,1,hullDouble));
  box(0,doorCrown+.0055,doorFrame.profile.roofFront+.001,.007,.0015,.002,white);
  const bayInterior=createShuttleBayInterior(T,{rearZ:-.2698});model.add(bayInterior);
  model.position.z=-.032;
  let lastW=0,lastH=0;
  function draw(ctx,w,h,m,s){
    bayInterior.setGarageDoorOpen(m.garageDoorOpen??0);
    // Viewed head-on, +Z rotation is clockwise: port spins opposite starboard.
    const rotorTime=Number.isFinite(s.time)?s.time:(m.clock||0);
    for(const {rotor,side} of capRotors)rotor.rotation.z=-side*rotorTime*Math.PI/4;
    const doorDt=lastDoorTime===undefined?0:Math.max(0,Math.min(.1,rotorTime-lastDoorTime));lastDoorTime=rotorTime;
    if(Number.isFinite(s.bayDoorOpen))setBayDoorOpen(s.bayDoorOpen);
    else if(m.phase){
      const range=Math.hypot(m.x,m.y,m.z-110);
      const wantOpen=m.phase==='docking'||m.phase==='flight'&&(range<3||(m.clock||0)<6)||m.phase==='landed'&&(m.clock||0)<6;
      setBayDoorOpen(bayDoorOpen+Math.sign((wantOpen?1:0)-bayDoorOpen)*Math.min(Math.abs((wantOpen?1:0)-bayDoorOpen),doorDt/2.4));
    }
    const navigationFlash=((rotorTime%5)+5)%5<.5;
    for(const {lens,on,off} of navigationLights)lens.material.color.setHex(navigationFlash?on:off);
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
  return trackEnterpriseResources({draw,renderer,scene,model,camera,setBayDoorOpen,ready:details.ready},details);
};
