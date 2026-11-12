/* Shared Class F shuttle geometry, in reference metres. */
window.createClassFShuttle=T=>{
  const engineScale=window.createClassFShuttle.engineScale;
  const model=new T.Group();model.name='class-f-shuttle';
  const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.48,metalness:.18,...extra});
  function mesh(geo,mat,x=0,y=0,z=0){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);model.add(o);return o;}
  function sphere(x,y,z,rx,ry,rz,mat){const o=mesh(new T.SphereGeometry(1,32,20),mat,x,y,z);o.scale.set(rx,ry,rz);return o;}
  function beam(a,b,width,depth,mat){const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.BoxGeometry(width,v.length(),depth),mat,...a);o.position.addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function lathe(profile,mat,x,y,z,axis='y',segments=40){
    const positions=[],uv=[],indices=[];
    for(const [r,h] of profile)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*r,h,Math.cos(a)*r);uv.push(i/segments,(h-profile[0][1])/(profile.at(-1)[1]-profile[0][1]));}
    for(let row=0;row<profile.length-1;row++)for(let i=0;i<segments;i++){const a=row*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.userData.hullPanelTopology={segments,rows:profile.length,kind:'lathe'};const o=mesh(g,mat,x,y,z);if(axis==='z')o.rotation.x=Math.PI/2;return o;
  }
  const shuttlePaint=material(0xc4c8d1,{roughness:.58,metalness:.12,side:T.DoubleSide}),shuttleRoof=material(0x858a94,{roughness:.7,metalness:.08,side:T.DoubleSide});
  const shuttleBelly=material(0x777d86,{roughness:.64,side:T.DoubleSide}),shuttleGlass=material(0x060c22,{roughness:.26,metalness:.12,side:T.DoubleSide});
  function shuttleQuad(points,mat,name,uv=[0,0,1,0,1,1,0,1]){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();const part=mesh(g,mat);part.name=name;return part;
  }
  const shuttleSection=[[3.40,.70,1.11],[2.10,2.26,.96],[-3.10,2.26,.96],[-3.40,.72,1.11],[-3.00,.40,.98],[-2.30,.28,.92],[1.80,.28,.92],[2.80,.42,1.02]];
  for(let i=0;i<shuttleSection.length;i++){
    if(i===2)continue; // The aft face is built as a recessed assembly below.
    const a=shuttleSection[i],b=shuttleSection[(i+1)%shuttleSection.length];
    shuttleQuad([[-a[2],a[1],a[0]],[a[2],a[1],a[0]],[b[2],b[1],b[0]],[-b[2],b[1],b[0]]],i===1?shuttleRoof:i>3?shuttleBelly:shuttlePaint,'class-f-body-panel-'+i);
  }
  for(const side of [-1,1]){
    const p=shuttleSection.flatMap(([z,y,w])=>[side*w,y,z]),idx=[];for(let i=1;i<shuttleSection.length-1;i++)idx.push(0,i,i+1);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,shuttlePaint).name=(side<0?'port':'starboard')+'-class-f-body';
    beam([side*.98,2.2275,-3.10],[side*.98,2.2275,2.08],.065,.065,shuttlePaint).name=(side<0?'port':'starboard')+'-class-f-roof-rail';
  }
  const noseZ=y=>3.40-(y-.70)*1.30/1.56;
  for(let i=0;i<3;i++){
    const x=(i-1)*.61,left=x-.265,right=x+.265;
    shuttleQuad([[left,1.37,noseZ(1.37)+.008],[right,1.37,noseZ(1.37)+.008],[right,1.90,noseZ(1.90)+.008],[left,1.90,noseZ(1.90)+.008]],shuttleGlass,'class-f-windshield-'+i);
  }
  function shuttleDecal(canvas){const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});}
  // Rear reference: a recessed dark radiator band with eight violet slots,
  // a framed lower service panel and the flared white side returns.
  const rearZ=y=>-3.40+(y-.72)*.30/1.54,rearWidth=y=>1.11-(y-.72)*.15/1.54;
  const rearPoint=(x,y,depth=0)=>[x,y,rearZ(y)+depth];
  const rearDark=material(0x070b13,{roughness:.72,side:T.DoubleSide});
  const violet=material(0x8770e8,{emissive:0x7351ed,emissiveIntensity:1.20,roughness:.3,metalness:.05,side:T.DoubleSide});
  shuttleQuad([rearPoint(-.94,1.60,.065),rearPoint(.94,1.60,.065),rearPoint(.885,2.16,.065),rearPoint(-.885,2.16,.065)],rearDark,'class-f-rear-radiator-recess');
  for(const [yb,yt] of [[1.52,1.60],[2.16,2.26]])shuttleQuad([rearPoint(-rearWidth(yb),yb,-.008),rearPoint(rearWidth(yb),yb,-.008),rearPoint(rearWidth(yt),yt,-.008),rearPoint(-rearWidth(yt),yt,-.008)],shuttlePaint,'class-f-rear-radiator-frame-'+yb);
  for(const side of [-1,1]){
    shuttleQuad([rearPoint(side*rearWidth(1.52),1.52,-.008),rearPoint(side*(rearWidth(1.60)-.085),1.60,.065),rearPoint(side*(rearWidth(2.16)-.085),2.16,.065),rearPoint(side*rearWidth(2.26),2.26,-.008)],shuttlePaint,(side<0?'port':'starboard')+'-class-f-rear-side-return');
    // Follow the back of the cabin only as far as the shelf's rear root.
    // The trim ends there and its upper cap stays flush with the roof.
    const cheek=[rearPoint(side*.96,2.26,-.025),rearPoint(side*1.10,.72,-.025),[side*1.02,.72,-3.12]];
    for(let i=1;i<cheek.length;i++){
      const trim=beam(cheek[i-1],cheek[i],.055,.055,shuttlePaint);trim.name=(side<0?'port':'starboard')+'-class-f-rear-wrap-'+i;
      trim.updateMatrix();const inverse=trim.matrix.clone().invert(),p=trim.geometry.attributes.position;
      for(let n=0;n<p.count;n++){const v=new T.Vector3().fromBufferAttribute(p,n).applyMatrix4(trim.matrix);v.y=Math.min(v.y,2.26);v.applyMatrix4(inverse);p.setXYZ(n,v.x,v.y,v.z);}
      p.needsUpdate=true;trim.geometry.computeVertexNormals();
    }
  }
  for(let i=0;i<8;i++){
    const x=-.77+i*.22;
    shuttleQuad([rearPoint(x-.030,1.71,.045),rearPoint(x+.030,1.71,.045),rearPoint(x+.030,2.07,.045),rearPoint(x-.030,2.07,.045)],violet,'class-f-rear-violet-slot-'+i);
  }
  // Soft local halos share one small texture and one draw call for all eight windows.
  const haloCanvas=document.createElement('canvas');haloCanvas.width=64;haloCanvas.height=128;
  const haloContext=haloCanvas.getContext('2d');haloContext.filter='blur(8px)';haloContext.fillStyle='#fff';haloContext.fillRect(20,15,24,98);
  const haloTexture=new T.CanvasTexture(haloCanvas),haloPositions=[],haloUvs=[],haloIndices=[];
  for(let i=0;i<8;i++){
    const x=-.77+i*.22,start=i*4;
    haloPositions.push(...rearPoint(x-.080,1.65,.038),...rearPoint(x+.080,1.65,.038),...rearPoint(x+.080,2.13,.038),...rearPoint(x-.080,2.13,.038));
    haloUvs.push(0,0,1,0,1,1,0,1);haloIndices.push(start,start+1,start+2,start,start+2,start+3);
  }
  const haloGeometry=new T.BufferGeometry();haloGeometry.setAttribute('position',new T.Float32BufferAttribute(haloPositions,3));haloGeometry.setAttribute('uv',new T.Float32BufferAttribute(haloUvs,2));haloGeometry.setIndex(haloIndices);
  mesh(haloGeometry,new T.MeshBasicMaterial({map:haloTexture,color:0x9b83ff,transparent:true,opacity:.22,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false})).name='class-f-rear-window-glow';
  const lowerZ=y=>rearZ(y)+.035+.13*(1.52-y)/.80;
  const lowerPoint=(x,y,offset=0)=>[x,y,lowerZ(y)+offset];
  shuttleQuad([lowerPoint(-1.08,.72),lowerPoint(1.08,.72),lowerPoint(1.015,1.52),lowerPoint(-1.015,1.52)],shuttleBelly,'class-f-rear-service-panel');
  const rearCanvas=document.createElement('canvas');rearCanvas.width=1024;rearCanvas.height=512;const rc=rearCanvas.getContext('2d');
  rc.fillStyle='#141a23';rc.font='bold 60px Arial';rc.fillText('NCC-1701/7',90,99);rc.fillStyle='#773526';rc.fillRect(495,55,180,47);
  rc.strokeStyle='#aeb5bb';rc.lineWidth=4;for(let block=0;block<3;block++)for(let line=0;line<8;line++){rc.beginPath();rc.moveTo(135+block*85,228+line*13);rc.lineTo(204+block*85,228+line*13);rc.stroke();}
  rc.strokeStyle='#454c56';rc.lineWidth=3;rc.strokeRect(665,180,255,230);rc.fillStyle='#363d47';rc.fillRect(670,192,46,8);rc.fillStyle='#aeb5bb';rc.fillRect(678,398,224,5);
  shuttleQuad([lowerPoint(-1.02,.75,-.004),lowerPoint(1.02,.75,-.004),lowerPoint(.97,1.49,-.004),lowerPoint(-.97,1.49,-.004)],shuttleDecal(rearCanvas),'class-f-rear-markings',[1,0,0,0,0,1,1,1]);
  for(const side of [-1,1]){
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=512;const c=canvas.getContext('2d'),front=side>0?.17:.83,back=side>0?.68:.32;
    c.fillStyle='#a82f27';c.fillRect(60,347,1928,23);
    c.font='italic 50px Georgia';c.textAlign='center';c.fillText('Galileo II',front*2048,244);
    c.clearRect(back*2048-340,322,680,78);c.fillStyle='#141a23';c.font='bold 85px Arial';c.fillText('NCC-1701/7',back*2048,224);c.font='bold 38px Arial';c.fillText('U.S.S. ENTERPRISE',back*2048,286);
    const door=(side>0?.35:.65)*2048;c.strokeStyle='#858c97';c.lineWidth=2;c.strokeRect(door-135,192,270,295);c.fillStyle='#111a33';for(const dx of [-70,70])c.fillRect(door+dx-35,213,70,27);
    const goldX=(side>0?.11:.89)*2048;c.fillStyle='#d7bb46';c.beginPath();c.moveTo(goldX,330);c.quadraticCurveTo(goldX+25,357,goldX,384);c.quadraticCurveTo(goldX-20,357,goldX,330);c.fill();
    const surfaceX=y=>side*(1.11+(y-.70)/1.56*(.96-1.11)+.006),zf=2.37,za=-3.05,yb=.72,yt=2.12;
    shuttleQuad([[surfaceX(yb),yb,zf],[surfaceX(yb),yb,za],[surfaceX(yt),yt,za],[surfaceX(yt),yt,zf]],shuttleDecal(canvas),(side<0?'port':'starboard')+'-class-f-markings',side>0?[0,0,1,0,1,1,0,1]:[1,0,0,0,0,1,1,1]);
    // Swept side shelf above each cylindrical engine.
    const wing=[[side*1.01,.72,.35],[side*1.44,.341,-.45],[side*1.44,.341,-3.22],[side*1.02,.72,-3.12]];
    shuttleQuad(wing,shuttleRoof,(side<0?'port':'starboard')+'-class-f-engine-shelf');
    const engineStart=model.children.length;
    lathe([[0,-3.48],[.17,-3.48],[.20,-3.20],[.20,1.62],[.18,1.82],[0,1.82]],shuttlePaint,side*1.40,.201,0,'z',40).name=(side<0?'port':'starboard')+'-class-f-nacelle';
    lathe([[.201,1.30],[.201,1.48]],material(0x864a2c,{roughness:.55}),side*1.40,.201,0,'z',40);
    sphere(side*1.40,.201,1.79,.19,.19,.18,material(0xe6b66a,{emissive:0xc7883a,emissiveIntensity:.22,roughness:.38})).name=(side<0?'port':'starboard')+'-class-f-engine-cap';
    const rearMetal=material(0x929b9e,{roughness:.34,metalness:.60});
    sphere(side*1.40,.201,-3.48,.16,.16,.16,rearMetal).name=(side<0?'port':'starboard')+'-class-f-rear-exhaust-ball';
    const hoodPositions=[],hoodIndices=[],hoodSteps=64,cut=a=>-3.32-.30*(1+Math.cos(a))/2;
    for(let i=0;i<=hoodSteps;i++){
      const a=-Math.PI+i/hoodSteps*Math.PI*2;
      for(const [r,z] of [[.2008,-3.17],[.2008,cut(a)],[.187,-3.17],[.187,cut(a)]])hoodPositions.push(side*1.40+Math.sin(a)*r,.201+Math.cos(a)*r,z);
      if(i<hoodSteps){const n=i*4;hoodIndices.push(n,n+4,n+1,n+1,n+4,n+5,n+2,n+3,n+6,n+3,n+7,n+6,n+1,n+5,n+3,n+3,n+5,n+7);}
    }
    const hoodGeo=new T.BufferGeometry();hoodGeo.setAttribute('position',new T.Float32BufferAttribute(hoodPositions,3));hoodGeo.setIndex(hoodIndices);hoodGeo.computeVertexNormals();
    const exhaust=material(0x636b72,{roughness:.68,metalness:.22,side:T.DoubleSide});mesh(hoodGeo,exhaust).name=(side<0?'port':'starboard')+'-class-f-rear-cowling';
    for(let rib=0;rib<16;rib++){
      const center=-Math.PI/2+(rib+.5)/16*Math.PI,p=[],idx=[];
      for(let row=0;row<=12;row++)for(let col=0;col<3;col++){
        const a=center+(col-1)*.025,t=row/12,r=col===1?.2022:.2007;p.push(side*1.40+Math.sin(a)*r,.201+Math.cos(a)*r,-3.17+(cut(a)+.008+3.17)*t);
      }
      for(let row=0;row<12;row++)for(let col=0;col<2;col++){const a=row*3+col,b=a+3;idx.push(a,b,a+1,a+1,b,b+1);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();mesh(g,exhaust).name=(side<0?'port':'starboard')+'-class-f-rear-engine-rib-'+rib;
    }
    // Enlarge each complete nacelle about its center, keeping its underside
    // on the deck and its shelf attached to the original shuttle body.
    const anchor=new T.Vector3(side*1.40,.201,-.835),engine=new T.Group();
    engine.name=(side<0?'port':'starboard')+'-class-f-engine-assembly';
    engine.position.copy(anchor);engine.position.y*=engineScale;engine.scale.setScalar(engineScale);
    for(const part of model.children.slice(engineStart)){part.position.sub(anchor);engine.add(part);}
    model.add(engine);
  }
  const frontCanvas=document.createElement('canvas');frontCanvas.width=1024;frontCanvas.height=256;const fc=frontCanvas.getContext('2d');fc.textAlign='center';fc.fillStyle='#a82f27';fc.font='italic 48px Georgia';fc.fillText('Galileo II',512,98);fc.fillStyle='#141a23';fc.font='bold 48px Arial';fc.fillText('U.S.S. ENTERPRISE',512,190);
  shuttleQuad([[-.85,.76,noseZ(.76)+.010],[.85,.76,noseZ(.76)+.010],[.85,1.27,noseZ(1.27)+.010],[-.85,1.27,noseZ(1.27)+.010]],shuttleDecal(frontCanvas),'class-f-nose-markings');
  // Keep compression inside the returned root so placement can set its own
  // scale without losing the 20% height reduction.
  model.name='class-f-compressed-geometry';model.scale.y=.80;
  const craft=new T.Group();craft.name='class-f-shuttle';craft.add(model);
  const plating=createMovieHullSurfaceDetail(T);
  for(const mat of [shuttlePaint,shuttleRoof,shuttleBelly])plating.apply(mat,0,{physical:true,bareMetal:true});
  craft.userData.referenceWidth=3.20;craft.userData.heightScale=.80;return craft;
};
createClassFShuttle.engineScale=1.10;
createClassFShuttle.aftExtent=.835+(3.64-.835)*createClassFShuttle.engineScale;
