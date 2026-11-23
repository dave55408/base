/* Lightweight Enterprise silhouette based on ST Command's third model.
   Shared proportions: .69 saucer radius, raised nacelles, swept pylons,
   tapered engineering hull. No ST Command runtime dependency. */
window.BattleScene=class{
  constructor(host,sim){
    const T=this.T=window.AlpineThree;this.sim=sim;this.host=host;this.effects=[];this.projectiles=new Map();this.mode='chase';this.zoom=1;this.orbit={x:0,y:0};this.clock=0;this.shake=0;
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;host.append(this.renderer.domElement);
    this.scene=new T.Scene();this.scene.background=new T.Color(0x050914);this.camera=new T.PerspectiveCamera(46,1,.5,65000);
    this.scene.add(new T.HemisphereLight(0xa6cee8,0x1d1429,1.8));
    const sun=new T.DirectionalLight(0xe4f3ff,3.4);sun.position.set(-3000,4000,-800);this.scene.add(sun);
    const rim=new T.DirectionalLight(0x5597df,2.7);rim.position.set(1200,300,2000);this.scene.add(rim);
    const warm=new T.DirectionalLight(0xef946a,1.3);warm.position.set(-1800,-500,1200);this.scene.add(warm);this.sunLight=sun;this.rimLight=rim;this.warmLight=warm;
    // Simplified cloudy gas giant adapted from the supplied cyan planet reference.
    this.planetMap=this.loadPlanetMap();
    this.ships={Enterprise:this.makeShip('Enterprise','NCC-1701',false),Yorktown:this.makeShip('Yorktown','NCC-1717',true)};
    this.scene.add(...Object.values(this.ships));this.makeSpace();this.station=this.makeStation();this.scene.add(this.station);this.makeSpatialGuides();
    this.resize=new ResizeObserver(()=>this.resizeViewport());this.resize.observe(host);
    const canvas=this.renderer.domElement;let drag=null;
    canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,ox:this.orbit.x,oy:this.orbit.y};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;this.orbit.x=drag.ox+(e.clientX-drag.x)*.006;this.orbit.y=Battle.clamp(drag.oy+(e.clientY-drag.y)*.004,-.8,.9);});
    const end=()=>drag=null;canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Battle.clamp(this.zoom*Math.exp(e.deltaY*.0008),.5,2.5);},{passive:false});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.dispatchEvent(new CustomEvent('battle-render-error',{detail:'Graphics context lost. Reload the page to restore the viewscreen.'}));});
    this.update(0,true);
  }
  get framingAspect(){return this.fullscreenFraming?.aspect??this.camera.aspect;}
  get framingFov(){return this.fullscreenFraming?.fov??this.camera.fov;}
  resizeViewport(){
    if(this.exportResolution){const {width,height}=this.exportResolution;this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();return;}
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const visibleHeight=this.host.getBoundingClientRect().height||h;
    const fullscreen=!!document.fullscreenElement?.contains(this.host);
    if(fullscreen&&this.windowedFraming){
      this.fullscreenFraming={...this.windowedFraming};
      const tangent=Math.tan(this.fullscreenFraming.fov*Math.PI/360)*visibleHeight/this.fullscreenFraming.height;
      this.camera.fov=2*Math.atan(tangent)*180/Math.PI;
    }else{
      if(this.fullscreenFraming)this.camera.fov=this.fullscreenFraming.fov;
      this.fullscreenFraming=null;
      this.windowedFraming={height:visibleHeight,aspect:w/h,fov:this.camera.fov};
    }
    this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  }
  setReplayHD(enabled){
    if(enabled&&!window.BattleReplayHD)throw Error('HD replay is unavailable. Reload ST Battle.');
    if(enabled&&!this.hdShips)this.hdShips={Enterprise:window.BattleReplayHD.createShip(this,'Enterprise',false),Yorktown:window.BattleReplayHD.createShip(this,'Yorktown',true)};
    this.standardShips??=this.ships;
    for(const ship of Object.values(this.ships))this.scene.remove(ship);
    this.ships=enabled?this.hdShips:this.standardShips;
    this.scene.add(...Object.values(this.ships));
    const limit=enabled?Math.min(3840,this.renderer.capabilities.maxTextureSize,this.renderer.getContext().getParameter(this.renderer.getContext().MAX_RENDERBUFFER_SIZE)):3840;
    const width=Math.max(2,Math.floor(limit/32)*32);
    this.exportResolution=enabled?{width,height:width*9/16}:null;
    this.renderer.setPixelRatio(enabled?1:Math.min(devicePixelRatio,1.6));this.resizeViewport();
  }
  texture(canvas){const t=new this.T.CanvasTexture(canvas);t.colorSpace=this.T.SRGBColorSpace;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());return t;}
  loadPlanetMap(){
    // CanvasTexture is available in the game's trimmed Three.js build.
    // Keep the GPU texture dimensions fixed after its first upload.
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
    const context=canvas.getContext('2d');context.fillStyle='#65c8cc';context.fillRect(0,0,canvas.width,canvas.height);
    const texture=this.texture(canvas),image=new Image();
    image.onload=()=>{context.drawImage(image,0,0,canvas.width,canvas.height);texture.needsUpdate=true;};
    image.onerror=()=>console.warn('Planet surface texture could not load: assets/gas-giant-surface.png');
    image.src=window.BattlePlanetSurface||'assets/gas-giant-surface.png';return texture;
  }
  hullPanelCanvas(columns,rows,base='#ffffff',width=512,height=1024){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const c=canvas.getContext('2d');c.fillStyle=base;c.fillRect(0,0,width,height);
    let seed=137;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const w=width/columns,h=height/rows;
    const gunmetal=base==='#3b4249';
    c.lineWidth=.7;c.strokeStyle=gunmetal?'#536b6c60':'rgba(48,68,72,.16)';
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const x=(column+(row%2)*.5)*w,y=row*h;
      c.fillStyle=gunmetal?`rgba(${random()>.5?'240,245,239':'15,24,29'},${.025+random()*.05})`:`rgba(39,64,68,${.018+random()*.04})`;
      // Repeat each edge panel with the same shade across the wrapped seam.
      for(const at of [x,x-width]){c.fillRect(at+1,y+1,w-2,h-2);c.strokeRect(at,y,w,h);}
    }
    return canvas;
  }
  wrapLathePlating(geometry,profile,segments){
    // Follow the turned surface around its circumference and along its profile,
    // rather than projecting saucer UVs through the sides of an engine hull.
    const lengths=[0];
    for(let i=1;i<profile.length;i++)lengths.push(lengths[i-1]+Math.hypot(profile[i].x-profile[i-1].x,profile[i].y-profile[i-1].y));
    const uv=geometry.attributes.uv,total=lengths.at(-1)||1;
    for(let row=0;row<profile.length;row++)for(let column=0;column<=segments;column++)uv.setXY(row*(segments+1)+column,column/segments,lengths[row]/total);
    uv.needsUpdate=true;return geometry;
  }
  horizontalPlating(mesh){
    // Map in ship coordinates so a swept neck cannot tilt the panel rows.
    const positions=mesh.geometry.attributes.position,normals=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv;
    const points=Array.from({length:positions.count},(_,i)=>new this.T.Vector3().fromBufferAttribute(positions,i).applyQuaternion(mesh.quaternion).add(mesh.position));
    const bounds=Object.fromEntries(['x','y','z'].map(axis=>[axis,[Math.min(...points.map(p=>p[axis])),Math.max(...points.map(p=>p[axis]))]]));
    for(const [i,point] of points.entries()){
      const normal=new this.T.Vector3().fromBufferAttribute(normals,i).applyQuaternion(mesh.quaternion),axis=Math.abs(normal.x)>.5?'z':'x';
      uv.setXY(i,(point[axis]-bounds[axis][0])/(bounds[axis][1]-bounds[axis][0]||1),(point.y-bounds.y[0])/(bounds.y[1]-bounds.y[0]||1));
    }
    uv.needsUpdate=true;
  }
  trimNeckTop(mesh,top){
    // Clip the neck's swept rectangular cross-section, preserving its transform.
    const T=this.T,original=mesh.geometry,position=original.attributes.position,outline=new Map();
    let halfWidth=0;
    for(let i=0;i<position.count;i++){
      const local=new T.Vector3().fromBufferAttribute(position,i);halfWidth=Math.max(halfWidth,Math.abs(local.x));
      const point=local.applyQuaternion(mesh.quaternion).add(mesh.position);
      outline.set(point.y.toFixed(7)+','+point.z.toFixed(7),{y:point.y,z:point.z});
    }
    const points=[...outline.values()],cy=points.reduce((s,p)=>s+p.y,0)/points.length,cz=points.reduce((s,p)=>s+p.z,0)/points.length;
    points.sort((a,b)=>Math.atan2(a.z-cz,a.y-cy)-Math.atan2(b.z-cz,b.y-cy));
    const clipped=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],inside=a.y<=top;
      if(inside)clipped.push(a);
      if(inside!==(b.y<=top)){const t=(top-a.y)/(b.y-a.y);clipped.push({y:top,z:a.z+(b.z-a.z)*t});}
    }
    const inverse=mesh.quaternion.clone().invert(),vertices=[];
    const vertex=(side,i)=>new T.Vector3(mesh.position.x+side*halfWidth,clipped[i].y,clipped[i].z).sub(mesh.position).applyQuaternion(inverse);
    const triangle=(a,b,c)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
    for(let i=1;i<clipped.length-1;i++){
      triangle(vertex(1,0),vertex(1,i),vertex(1,i+1));
      triangle(vertex(-1,0),vertex(-1,i+1),vertex(-1,i));
    }
    for(let i=0;i<clipped.length;i++){
      const j=(i+1)%clipped.length;
      triangle(vertex(-1,i),vertex(-1,j),vertex(1,j));triangle(vertex(-1,i),vertex(1,j),vertex(1,i));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geometry.computeVertexNormals();
    mesh.geometry=geometry;original.dispose();
  }
  makeShip(name,registry,enemy){
    const T=this.T,root=new T.Group(),model=new T.Group();root.add(model);model.scale.setScalar(57);model.position.z=25;
    const panelBase=enemy?'#3b4249':'#ffffff';
    const hull=new T.MeshStandardMaterial({color:enemy?0xffffff:0xbbc6bf,roughness:enemy?.42:.55,metalness:enemy?.68:.4});
    if(enemy)hull.userData.yorktownHullFinish=true;
    const dark=new T.MeshStandardMaterial({color:0x293b43,metalness:.65,roughness:.45});const bronze=new T.MeshStandardMaterial({color:0x946c40,metalness:.8,roughness:.35});
    hull.map=this.texture(this.hullPanelCanvas(16,20,panelBase));
    dark.map=enemy?this.texture(this.hullPanelCanvas(16,20)):hull.map;bronze.map=this.texture(this.hullPanelCanvas(16,6));
    const domeHull=hull.clone();domeHull.map=this.texture(this.hullPanelCanvas(16,8,panelBase));
    const strutHull=hull.clone();strutHull.map=this.texture(this.hullPanelCanvas(4,16,panelBase));
    const neckHull=hull.clone();neckHull.map=this.texture(this.hullPanelCanvas(8,16,panelBase));
    const glow=c=>new T.MeshBasicMaterial({color:c});const blue=glow(0x8ae4ff),red=glow(0xff6746),windowMat=glow(0xc4f5ff);
    const mesh=(g,m,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);model.add(o);return o;};
    const sphere=(x,y,z,rx,ry,rz,m=domeHull)=>{const o=mesh(new T.SphereGeometry(1,24,16),m,x,y,z);o.scale.set(rx,ry,rz);return o;};
    const box=(x,y,z,w,h,d,m=hull)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z);
    const beam=(a,b,w,d,m=hull)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.BoxGeometry(w,v.length(),d),m,...a);o.position.addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;};
    const saucerCanvas=document.createElement('canvas');saucerCanvas.width=saucerCanvas.height=1024;const c=saucerCanvas.getContext('2d');c.fillStyle=enemy?'#3b4249':'#b4c0b9';c.fillRect(0,0,1024,1024);c.translate(512,512);
    // Native canvas hull plating and painted registry remain crisp when zoomed.
    let seed=53;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let r=74;r<495;r+=18){const seg=Math.round(r/9);for(let j=0;j<seg;j++){const a=j/seg*Math.PI*2;c.beginPath();c.arc(0,0,r,a,a+Math.PI*2/seg);c.arc(0,0,r+17,a+Math.PI*2/seg,a,true);c.closePath();c.fillStyle=`rgba(${rnd()>.5?'240,245,239':'39,64,68'},${.025+rnd()*.05})`;c.fill();}}
    c.strokeStyle='#536b6c60';c.lineWidth=1;for(const r of [100,180,250,320,403,455,480]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
    for(let j=0;j<64;j++){const a=j/64*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*100,Math.sin(a)*100);c.lineTo(Math.cos(a)*480,Math.sin(a)*480);c.stroke();}
    // The underside has the same concentric plating, without registry lettering.
    const undersideCanvas=document.createElement('canvas');undersideCanvas.width=undersideCanvas.height=1024;
    undersideCanvas.getContext('2d').drawImage(saucerCanvas,0,0);
    const undersideMat=hull.clone();undersideMat.color.set(0xffffff);undersideMat.map=this.texture(undersideCanvas);
    // Bow-facing registry follows the saucer's curve; the smaller ship name
    // sits on a straight line between the bridge and the registry number.
    const bowLettering=(text,radius,advance,font)=>{
      c.save();c.rotate(Math.PI);c.fillStyle='#171b1c';c.textAlign='center';c.textBaseline='alphabetic';c.font=font;
      for(const [index,letter] of [...text].entries()){
        const angle=(index-(text.length-1)/2)*advance/radius;
        c.save();c.translate(Math.sin(angle)*radius,Math.cos(angle)*radius);c.rotate(-angle);
        c.fillText(letter,0,0);c.restore();
      }
      c.restore();
    };
    c.save();c.rotate(Math.PI);c.fillStyle='#171b1c';c.textAlign='center';c.textBaseline='alphabetic';c.font='24px Arial';
    c.fillText('U.S.S. '+name.toUpperCase(),0,238);c.restore();
    bowLettering(registry,350,74,'500 72px Bahnschrift, Arial, sans-serif');
    c.fillStyle='#923c34';for(const x of [-235,235]){c.fillRect(x-11,40,22,130);c.fillStyle='#d0c5a6';c.fillRect(x-3,47,6,115);c.fillStyle='#923c34';}
    const saucerSource=new T.LatheGeometry([[0,-.09],[.15,-.09],[.36,-.05],[.57,-.02],[.68,.015],[.69,.04],[.69,.075],[.64,.09],[.49,.12],[.29,.16],[.15,.19],[0,.19]].map(([x,y])=>new T.Vector2(x,y)),96);
    // Separate UVs at the rim without adding any new faces or hull geometry.
    const saucerGeo=saucerSource.toNonIndexed();
    const sa=mesh(saucerGeo,hull,0,.30,-1.12);
    const topMat=new T.MeshStandardMaterial({map:this.texture(saucerCanvas),roughness:enemy?.42:.64,metalness:enemy?.68:.25,side:T.DoubleSide});
    const saucerEdgeMat=hull.clone();saucerEdgeMat.map=this.texture(this.hullPanelCanvas(128,3,panelBase,2048,128));
    // Keep registry lettering on top; use unlettered radial plating underneath.
    const saucerIndices=saucerSource.index.array,saucerPositions=saucerSource.attributes.position;
    saucerGeo.clearGroups();let groupStart=0,groupMaterial=null;
    for(let i=0;i<saucerIndices.length;i+=3){
      const y=(saucerPositions.getY(saucerIndices[i])+saucerPositions.getY(saucerIndices[i+1])+saucerPositions.getY(saucerIndices[i+2]))/3;
      const radius=[0,1,2].reduce((sum,j)=>sum+Math.hypot(saucerPositions.getX(saucerIndices[i+j]),saucerPositions.getZ(saucerIndices[i+j])),0)/3;
      const material=y>=.075?0:y>=.015&&radius>=.679?2:1;
      if(material===2)for(let j=0;j<3;j++){
        const vertex=saucerIndices[i+j];
        saucerGeo.attributes.uv.setXY(i+j,(vertex%97)/96,(saucerPositions.getY(vertex)-.015)/.06);
      }
      if(groupMaterial!==null&&material!==groupMaterial){saucerGeo.addGroup(groupStart,i-groupStart,groupMaterial);groupStart=i;}
      groupMaterial=material;
    }
    saucerGeo.addGroup(groupStart,saucerIndices.length-groupStart,groupMaterial);
    saucerGeo.attributes.uv.needsUpdate=true;
    sa.material=[topMat,undersideMat,saucerEdgeMat];
    // Central dome and lower planetary sensor array.
    sphere(0,.474,-1.12,.18,.065,.18);sphere(0,.538,-1.12,.088,.035,.088);sphere(0,.228,-1.12,.22,.085,.22);sphere(0,.158,-1.12,.07,.024,.07,blue);
    const saucerTopLight=sphere(0,.554,-1.12,.063,.024,.063,blue);saucerTopLight.name='Upper saucer blue light';
    const rimline=mesh(new T.TorusGeometry(.681,.008,5,96),dark,0,.346,-1.12);rimline.rotation.x=Math.PI/2;
    const rimWindows=[];for(let i=0;i<6;i++){const a=Math.PI+(i-2.5)*Math.PI/32;const w=box(Math.sin(a)*.688,.356,-1.12+Math.cos(a)*.688,.012,.011,.003,windowMat);w.rotation.y=a;rimWindows.push(w);}
    // ST Command's classic neck, spindle hull, and elevated warp nacelles.
    const aftShift=.18;
    const neck=beam([0,.08,-.58+aftShift],[0,.36,-.86+aftShift],.063,.25,neckHull);
    this.trimNeckTop(neck,.395);
    this.horizontalPlating(neck);
    const engineeringProfile=[[0,-.70],[.14,-.69],[.155,-.59],[.15,-.24],[.13,.05],[.11,.29],[.075,.46],[0,.49]].map(([x,y])=>new T.Vector2(x,y));
    const eng=mesh(this.wrapLathePlating(new T.LatheGeometry(engineeringProfile,48),engineeringProfile,48),hull,0,.02,-.02);eng.rotation.x=Math.PI/2;
    // Port and starboard windows follow the tapered lower engineering hull.
    // Attach them to that hull so they move with it during the breakup animation.
    const lowerHullWindows=[],profile=engineeringProfile;
    for(const side of [-1,1])for(let i=1;i<5;i++){
      const axial=-.52+i*.04;
      const j=profile.findIndex((point,index)=>index>0&&point.y>=axial),a=profile[j-1],b=profile[j];
      const radius=a.x+(b.x-a.x)*(axial-a.y)/(b.y-a.y),slope=(b.x-a.x)/(b.y-a.y),z=-.025;
      const x=side*Math.sqrt(radius*radius-z*z),normal=new T.Vector3(x/radius,-slope,z/radius).normalize();
      const w=new T.Mesh(new T.PlaneGeometry(.012,.024),windowMat);
      w.position.set(x,axial,z).addScaledVector(normal,.0008);
      w.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);
      eng.add(w);lowerHullWindows.push(w);rimWindows.push(w);
    }

    const deflector=mesh(new T.CylinderGeometry(.135,.115,.045,48),bronze,0,.02,-.735);deflector.rotation.x=Math.PI/2;
    const dish=mesh(new T.CylinderGeometry(.105,.10,.012,48),blue,0,.02,-.764);dish.rotation.x=Math.PI/2;
    const rings=mesh(new T.TorusGeometry(.12,.009,8,48),bronze,0,.02,-.766);
    // Extend down to the main saucer rim's mid-height, keeping the top fixed.
    const impulseTop=.395,impulseBottom=sa.position.y+(.015+.075)/2,impulseHeight=impulseTop-impulseBottom;
    const impulse=box(0,(impulseTop+impulseBottom)/2,-.445,.27,impulseHeight,.055,bronze);
    impulse.name='Impulse engine gold housing';
    // Build the orange exhaust into the rear face instead of layering a plane
    // over the gold housing, which flickered at distant camera depths.
    this.insetImpulseExhaust(impulse,.27,impulseHeight,.055,bronze,red);
    const engineGlows=[],pylons=[],nacelles=[];
    // Color maps paint the existing surfaces without adding meshes or relief.
    const pylonCanvas=this.hullPanelCanvas(4,16,panelBase,256,1024);
    const pc=pylonCanvas.getContext('2d');
    pc.fillStyle=enemy?'#505b63':'#c0cbce';for(const y of [160,416,672])pc.fillRect(58,y,140,192);
    const pylonPaint=strutHull.clone();pylonPaint.map=this.texture(pylonCanvas);
    const nacelleCanvas=this.hullPanelCanvas(16,40,enemy?panelBase:hull.color.getStyle(),1024,1024);
    const nc=nacelleCanvas.getContext('2d');
    // After the mirrored nacelle rolls, U=0/1 is the inward-facing horizontal
    // centerline on both tubes. Paint equal halves either side of that seam.
    nc.fillStyle=dark.color.getStyle();nc.beginPath();
    const stripeWidth=96,stripeLength=614,stripeTop=(nacelleCanvas.height-stripeLength)/2;
    for(const center of [0,nacelleCanvas.width])nc.roundRect(center-stripeWidth/2,stripeTop,stripeWidth,stripeLength,12);
    nc.fill();
    const nacellePaint=hull.clone();nacellePaint.color.set(0xffffff);nacellePaint.map=this.texture(nacelleCanvas);
    for(const side of [-1,1]){
      const pylon=beam([side*.075,.05,-.05],[side*.55,.51,.17],.035,.182,strutHull);
      pylon.material=[strutHull,strutHull,strutHull,strutHull,strutHull,strutHull];pylon.material[side<0?0:1]=pylonPaint;
      pylon.userData.attachmentPoint={x:side*.075,y:.05,z:-.05};pylon.userData.pylonSide=side<0?'port':'starboard';pylon.name=side<0?'Port nacelle strut':'Starboard nacelle strut';pylons.push(pylon);
      // Roll the complete nacelle around its fore/aft axis, leaving the pylon fixed.
      const nacelleStart=model.children.length;
      const x=side*.56,nacelle=mesh(new T.CylinderGeometry(.073,.091,1.38,32),hull,x,.53,-.02);nacelle.rotation.x=Math.PI/2;
      nacelle.material=[nacellePaint,undersideMat,undersideMat];
      nacelle.name=side<0?'Port nacelle housing':'Starboard nacelle housing';
      // Round the front housing, ending flush at the tube's front ring:
      // -.75 + .04 = -.02 - 1.38 / 2, with the same .091 radius.
      const frontProfile=[[0,-.09],[.046,-.078],[.073,-.055],[.087,-.03],[.092,0],[.092,.02],[.091,.04]].map(([r,z])=>new T.Vector2(r,z));
      const frontHousing=mesh(this.wrapLathePlating(new T.LatheGeometry(frontProfile,32),frontProfile,32),bronze,x,.53,-.75);
      frontHousing.rotation.x=Math.PI/2;frontHousing.name='Gold nacelle front housing';
      const cap=sphere(x,.53,-.80,.079,.079,.06,red);
      const rear=sphere(x,.53,.69,.067,.067,.08,blue);engineGlows.push(rear);
      box(x-side*.074,.53,-.00,.012,.025,1.1,blue);box(x+side*.074,.53,.13,.013,.036,.72,dark);
      for(let j=0;j<6;j++)box(x,.608,.39+j*.024,.065,.01,.009,dark);
      // Paired rear fittings retain their original orientation before the nacelle roll.
      for(const clockAngle of [-Math.PI/3,Math.PI/3]){
        const angle=clockAngle-side*Math.PI/2;
        const fitting=box(x+Math.sin(angle)*.065,.53+Math.cos(angle)*.065,.65,.04,.07,.22,hull);
        fitting.rotation.z=-angle;
      }
      const nacelleParts=model.children.slice(nacelleStart),rolledNacelle=new T.Group();
      rolledNacelle.position.set(x,.53,-.02);model.add(rolledNacelle);
      for(const part of nacelleParts){part.position.sub(rolledNacelle.position);rolledNacelle.add(part);}
      // Preserve the mirrored quarter turns and original raised nacelle details.
      rolledNacelle.rotation.z=-side*Math.PI/2;
      // Slide the complete engine aft along its fixed pylon, including caps and fittings.
      rolledNacelle.position.z+=aftShift;
      nacelles.push(rolledNacelle);
      sphere(side*.66,.385,-1.12,.012,.012,.012,glow(side===-1?0xff5540:0x64ffd1));
    }
    root.updateMatrixWorld(true);
    // Shields absorb damage in the simulation but have no visible bubble.
    root.userData={model,engineeringHull:eng,nacelles:{port:nacelles[0],starboard:nacelles[1]},detachedVisuals:new Set(),nacelleAftOffset:aftShift,saucer:sa,windows:rimWindows,lowerHullWindows,scars:[],engineGlows,damageGlows:[],impulse,breakupParts:[sa,eng,neck,...pylons,...nacelles]};root.name=name;
    root.userData.trails=this.makeEngineTrails(model);
    for(let i=0;i<7;i++){const glow=sphere((i%2?1:-1)*(.11+(i%3)*.16),.44,-1.10+i*.17,.025,.012,.025,new T.MeshBasicMaterial({color:0xff5822,transparent:true,opacity:0}));root.userData.damageGlows.push(glow);}
    return root;
  }
  insetImpulseExhaust(mesh,width,height,depth,housing,exhaust){
    const T=this.T,original=mesh.geometry,source=original.toNonIndexed(),positions=[],normals=[],uvs=[];
    const append=(x,y,z,nx,ny,nz,u,v)=>{positions.push(x,y,z);normals.push(nx,ny,nz);uvs.push(u,v);};
    // Box material 4 is the aft (+Z) face. Keep the other five faces intact.
    for(const group of source.groups)if(group.materialIndex!==4)for(let i=group.start;i<group.start+group.count;i++){
      const p=source.attributes.position,n=source.attributes.normal,uv=source.attributes.uv;
      append(p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv.getX(i),uv.getY(i));
    }
    const geometry=new T.BufferGeometry();geometry.addGroup(0,positions.length/3,0);
    const quad=(x0,y0,x1,y1,material)=>{
      const start=positions.length/3;
      for(const [x,y] of [[x0,y0],[x1,y0],[x1,y1],[x0,y0],[x1,y1],[x0,y1]])append(x,y,depth/2,0,0,1,x/width+.5,y/height+.5);
      geometry.addGroup(start,6,material);
    };
    const x=width/2,y=height/2,ix=x-.016,iy=y-.008;
    quad(-x,-y,x,-iy,0);quad(-x,iy,x,y,0);quad(-x,-iy,-ix,iy,0);quad(ix,-iy,x,iy,0);quad(-ix,-iy,ix,iy,1);
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    mesh.geometry=geometry;mesh.material=[housing,exhaust];original.dispose();source.dispose();
  }
  makeEngineTrails(model){
    const T=this.T,geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(48*3),3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(48*3),3));
    const trails=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x91dfff,vertexColors:true,transparent:true,opacity:.6,depthWrite:false,blending:T.AdditiveBlending}));
    trails.frustumCulled=false;trails.visible=false;model.add(trails);return trails;
  }
  updateEngineTrails(ship,state){
    const trails=ship.userData.trails,speed=Math.abs(state.speed);
    const holding=this.sim?.freeFlight||this.sim?.running===false||this.sim?.result||this.sim?.turnBased&&['planning','review'].includes(this.sim.turn?.phase);
    trails.visible=this.mode!=='cinematic'&&this.engineTrailsEnabled!==false&&!holding&&state.hull>0&&speed>.5;if(!trails.visible)return;
    const fraction=Battle.clamp(speed/300,0,1),length=.3+4.5*fraction,reverse=state.speed<0;
    const start=(reverse?-.87:.79)+(ship.userData.nacelleAftOffset||0),direction=reverse?-1:1;
    const positions=trails.geometry.attributes.position,colors=trails.geometry.attributes.color;let index=0;
    for(const side of [-1,1])for(let lane=-1;lane<=1;lane++)for(let segment=0;segment<4;segment++){
      const phase=(this.clock*(.8+fraction)+lane*.13+1)%1;
      const a=(segment+phase)/4,b=Math.min(1,a+.16);
      for(const t of [a,b]){
        positions.setXYZ(index,side*.56+lane*.014,.53+Math.abs(lane)*.012,start+direction*length*t);
        const fade=state.detachedNacelles?.[side<0?'port':'starboard']?0:(1-t)*(.8-Math.abs(lane)*.2);colors.setXYZ(index,fade,fade,fade);index++;
      }
    }
    trails.material.opacity=.35+fraction*.45;positions.needsUpdate=true;colors.needsUpdate=true;
  }
  makeStation(){
    const T=this.T,root=new T.Group(),state=this.sim.station;
    root.name='K7 Space Station';root.position.set(state.x,state.y,state.z);root.scale.setScalar(state.scale);
    const hull=new T.MeshStandardMaterial({color:0xb8c1bc,roughness:.57,metalness:.4});
    const dark=new T.MeshStandardMaterial({color:0x293d46,roughness:.6,metalness:.5});
    // Use Enterprise's painted plating; the station's separate grid lines stay untouched.
    const plating=this.texture(this.hullPanelCanvas(16,20));hull.map=dark.map=plating;
    const lit=new T.MeshBasicMaterial({color:0xb5efff});
    const windowLit=new T.MeshBasicMaterial({color:0xb5efff,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const mesh=(geometry,material,x=0,y=0,z=0)=>{if(material.isMeshStandardMaterial&&!material.map)material.map=plating;const o=new T.Mesh(geometry,material);o.position.set(x,y,z);root.add(o);return o;};
    const cylinder=(x,y,z,r,h,material=hull)=>mesh(new T.CylinderGeometry(r,r,h,32),material,x,y,z);
    const link=(a,b,r=10)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a)),o=mesh(new T.CylinderGeometry(r,r,v.length(),20),hull,...a);o.position.addScaledVector(v,.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;};
    const lathe=(profile,x,y,z,material=hull)=>{
      const points=profile.map(([r,h])=>new T.Vector2(r,h)),geometry=this.wrapLathePlating(new T.LatheGeometry(points,64),points,64);
      return mesh(geometry,material,x,y,z);
    };
    const saucer=(x,y,z,r)=>{
      const o=lathe([[0,-.13*r],[.3*r,-.13*r],[.75*r,-.08*r],[r,0],[.97*r,.045*r],[.75*r,.13*r],[.28*r,.17*r],[0,.17*r]],x,y,z);
      const seams=[];
      for(let i=0;i<16;i++){
        const a=i*Math.PI/8;
        for(const [lo,hi] of [[.3,.75],[.75,.97]]){
          const h=t=>t<.75?.17-(t-.28)/(.75-.28)*.04:.13-(t-.75)/(.97-.75)*.085;
          seams.push(x+Math.sin(a)*r*lo,y+h(lo)*r+.2,z+Math.cos(a)*r*lo,x+Math.sin(a)*r*hi,y+h(hi)*r+.2,z+Math.cos(a)*r*hi);
        }
      }
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(seams,3));root.add(new T.LineSegments(g,new T.LineBasicMaterial({color:0x52666b,transparent:true,opacity:.45})));
      return o;
    };
    const tower=(x,y,z,r,h,color,rows)=>{
      // Native cylinder UVs wrap around the taper with V fixed to horizontal height bands.
      const o=mesh(new T.CylinderGeometry(r*.19,r,h,40),hull,x,y+h/2,z);
      // Zero-thickness windows lie on the actual sloping tower facets.
      const windows=new T.InstancedMesh(new T.PlaneGeometry(1,1),windowLit,rows*15),stamp=new T.Object3D();let index=0;
      const facet=Math.cos(Math.PI/40),slope=r*.81*facet/h,tilt=Math.atan(slope);
      for(let row=0;row<rows;row++){
        const f=(row+.6)/rows,rr=r*(1-f*.81)*facet;
        for(let i=0;i<20;i++)if((i+row)%4!==0){
          const a=(i+.25)*Math.PI/10;stamp.position.set(x+Math.sin(a)*rr,y+f*h,z+Math.cos(a)*rr);
          stamp.rotation.set(-tilt,a,0,'YXZ');stamp.scale.set(rr*.11,h/rows*.22*Math.sqrt(1+slope*slope),1);
          stamp.updateMatrix();windows.setMatrixAt(index++,stamp.matrix);
        }
      }
      windows.userData.hull=o;windows.instanceMatrix.needsUpdate=true;root.add(windows);
      mesh(new T.ConeGeometry(r*.23,h*.15,24),new T.MeshStandardMaterial({color,roughness:.4,metalness:.3}),x,y+h+h*.055,z);
      return o;
    };
    cylinder(0,0,0,38,42);cylinder(0,45,0,16,44);
    saucer(0,76,0,110);cylinder(0,94,0,34,5);tower(0,97,0,32,70,0x326bb8,10);
    link([0,171,0],[0,213,0],1.1);
    const beacon=mesh(new T.SphereGeometry(2.2,10,8),new T.MeshBasicMaterial({color:0xffe2a2}),0,214,0);
    cylinder(0,-31,0,17,20);cylinder(0,-59,0,8,38);
    lathe([[0,-24],[35,-24],[46,-17],[46,17],[35,24],[0,24]],0,-100,0);
    // Wrap the hangar door, lintel and dividers around the lower drum.
    const hangarPanel=(width,height,radius,y,material,angle=0)=>{
      const arc=width/radius,o=mesh(new T.CylinderGeometry(radius,radius,height,Math.max(2,Math.ceil(arc*64)),1,true,angle-arc/2,arc),material,0,y,0);
      o.name='K7 curved hangar '+(material===dark?'door':material===lit?'lintel':'divider');return o;
    };
    hangarPanel(43,15,46.25,-101,dark);
    hangarPanel(45,1.2,46.5,-93,lit);
    for(const x of [-20,-10,0,10,20])hangarPanel(.7,13,46.5,-101,hull,x/46.25);
    // Small rear cargo pod, separate from the three radial habitats.
    const cargo=state.cargo;
    link([cargo.armStart,cargo.armStartY,0],[cargo.armEnd,cargo.armStartY,0],10);
    lathe([[0,-33],[11,-31],[18,-22],[18,22],[11,31],[0,33]],cargo.x,cargo.y,0);
    const colors=[0xe9b94d,0xc8493f,0x3aab75];
    state.pods.forEach(({x,z},i)=>{
      const length=Math.hypot(x,z);link([x/length*38,0,z/length*38],[x/length*246,0,z/length*246]);
      const collar=mesh(new T.BoxGeometry(30,25,32),hull,x*.84,0,z*.84);collar.rotation.y=-Math.atan2(z,x);
      saucer(x,0,z,52);cylinder(x,10,z,19,4);tower(x,12,z,17,36,colors[i],5);
      mesh(new T.SphereGeometry(2,10,8),new T.MeshBasicMaterial({color:colors[i]}),x*1.17,0,z*1.17);
    });
    root.userData.beacon=beacon;return root;
  }
  makePlanet(){
    const T=this.T,body=this.sim?.planet||Battle.PLANET,planet=new T.Group();planet.position.set(body.x,body.y,body.z);
    const vertexShader='varying vec2 surfaceUv;varying vec3 worldNormal;varying vec3 viewNormal;varying vec3 viewDirection;void main(){surfaceUv=uv;worldNormal=normalize(mat3(modelMatrix)*normal);vec4 p=modelViewMatrix*vec4(position,1.);viewNormal=normalize(normalMatrix*normal);viewDirection=normalize(-p.xyz);gl_Position=projectionMatrix*p;}';
    // Full longitude/latitude map: distinct terrain on every side, with no
    // black photo background or baked globe shading in the surface texture.
    const surface=new T.ShaderMaterial({uniforms:{marsMap:{value:this.planetMap||null}},vertexShader,fragmentShader:`
      uniform sampler2D marsMap;varying vec2 surfaceUv;varying vec3 worldNormal;varying vec3 viewNormal;varying vec3 viewDirection;
      void main(){
        vec3 n=normalize(worldNormal);
        vec2 photoUv=vec2(fract(surfaceUv.x+.34),surfaceUv.y);
        vec3 color=texture2D(marsMap,photoUv).rgb;
        color=clamp((color-vec3(.18))*1.08+vec3(.18),vec3(.025),vec3(1.));
        float daylight=.65+.35*smoothstep(-.12,.85,dot(n,normalize(vec3(-.3,.5,.81))));
        gl_FragColor=vec4(color*daylight*.98,1.);
        #include <colorspace_fragment>
      }`});
    planet.add(new T.Mesh(new T.SphereGeometry(body.radius,96,64),surface));
    const atmosphereRadius=body.radius+Math.max(body.atmosphere,body.radius*.15);
    // Soft exterior-only glow: fragments over the planet surface are discarded.
    // The outer extent remains 15% of the planet radius.
    // Ray-to-center distance keeps the halo aligned with the limb even at close camera ranges.
    const atmosphere=new T.Mesh(new T.SphereGeometry(atmosphereRadius,96,64),new T.ShaderMaterial({transparent:true,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending,uniforms:{innerRatio:{value:body.radius/atmosphereRadius},outerRadius:{value:atmosphereRadius},innerColor:{value:new T.Color(0x167ca8)},outerColor:{value:new T.Color(0x07456d)}},vertexShader:'varying vec3 viewPoint;varying vec3 centerView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);viewPoint=p.xyz;centerView=(modelViewMatrix*vec4(0.,0.,0.,1.)).xyz;gl_Position=projectionMatrix*p;}',fragmentShader:`
      varying vec3 viewPoint;varying vec3 centerView;
      uniform float innerRatio;uniform float outerRadius;uniform vec3 innerColor;uniform vec3 outerColor;
      void main(){
        bool inside=length(centerView)<outerRadius;
        if((inside&&gl_FrontFacing)||(!inside&&!gl_FrontFacing))discard;
        float projectedRadius=length(cross(normalize(viewPoint),centerView))/outerRadius;
        if(projectedRadius<innerRatio)discard;
        float edge=clamp((projectedRadius-innerRatio)/(1.-innerRatio),0.,1.);
        float overlap=1.;
        vec3 color=mix(innerColor,outerColor,smoothstep(.05,.9,edge));
        float haze=.38*exp(-pow(edge/.45,2.));
        float fade=haze*(1.-smoothstep(.65,1.,edge));
        gl_FragColor=vec4(color,overlap*fade);
        #include <colorspace_fragment>
      }`}));
    planet.add(atmosphere);return planet;
  }
  makeSpace(){
    const T=this.T;let seed=811;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const positions=[],colors=[];for(let i=0;i<6000;i++){const theta=rnd()*Math.PI*2,u=rnd()*2-1,r=46000+rnd()*8000,l=Math.sqrt(1-u*u);positions.push(Math.cos(theta)*l*r,u*r,Math.sin(theta)*l*r);const c=new T.Color().setHSL(rnd()<.15?.08:.58,.05+rnd()*.10,.78+rnd()*.20);colors.push(c.r,c.g,c.b);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));this.stars=new T.Points(geometry,new T.PointsMaterial({size:190,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:1}));this.stars.renderOrder=-100;this.scene.add(this.stars);
    // Continuous volumetric-style gas avoids texture seams and stays sharp in every view.
    const sky=new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,
      vertexShader:'varying vec3 skyRay;void main(){skyRay=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 skyRay;
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.07+vec3(1.3,2.8,4.1);a*=.5;}return n;}
        void main(){vec3 d=normalize(skyRay),p=d*4.+vec3(2.,4.,6.);
          float cloud=fbm(p*1.8+vec3(fbm(p+7.))*2.3);
          float band=exp(-pow((d.y+.06+sin(d.x*3.+d.z*4.)*.13)*3.,2.));
          float wisps=pow(smoothstep(.22,.84,cloud),1.5)*band;
          vec3 color=vec3(.006,.012,.025)+mix(vec3(.08,.22,.31),vec3(.27,.07,.24),smoothstep(.25,.76,fbm(p+16.)))*wisps;
          float opacity=.32+.64*smoothstep(.08,.75,wisps);
          gl_FragColor=vec4(color,opacity);}`
    });
    this.nebula=new T.Mesh(new T.SphereGeometry(38000,32,20),sky);this.nebula.rotation.y=.8;this.nebula.renderOrder=-90;this.scene.add(this.nebula);
    this.planet=this.makePlanet();this.scene.add(this.planet);
    this.makeRedSun();
  }
  makeRedSun(){
    const T=this.T;
    // The visible star and its red directional fill share one fixed sky direction.
    this.redSunDirection=new T.Vector3(-.28,-.32,-.94).normalize();
    this.redSun=new T.Group();this.redSun.name='Distant red sun';
    const core=new T.Mesh(new T.SphereGeometry(900,48,32),new T.ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec3 sunNormal;varying vec3 sunSurface;void main(){sunNormal=normalMatrix*normal;sunSurface=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 sunNormal;varying vec3 sunSurface;
        void main(){
          float limb=pow(max(0.,normalize(sunNormal).z),.45);
          float grain=.93+.07*sin(sunSurface.x*.04+sin(sunSurface.y*.035)*3.)*sin(sunSurface.z*.05);
          vec3 color=mix(vec3(.45,.006,.003),vec3(1.,.13,.025),limb)*grain;
          gl_FragColor=vec4(color,1.);
          #include <colorspace_fragment>
        }`
    }));core.name='Red stellar disk';core.renderOrder=-79;this.redSun.add(core);
    this.redSunHalo=new T.Mesh(new T.PlaneGeometry(6000,6000),new T.ShaderMaterial({
      transparent:true,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 haloUv;void main(){haloUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 haloUv;void main(){
        float radius=length(haloUv-.5)*2.;
        float glow=exp(-radius*radius*7.)*(1.-smoothstep(.65,1.,radius));
        gl_FragColor=vec4(vec3(1.,.075,.018),glow*.48);
        #include <colorspace_fragment>
      }`
    }));this.redSunHalo.name='Red stellar corona';this.redSunHalo.renderOrder=-80;this.redSun.add(this.redSunHalo);
    this.scene.add(this.redSun);
    if(this.warmLight){this.warmLight.color.setHex(0xff654b);this.scene.add(this.warmLight.target);}
  }
  updateRedSun(){
    if(!this.redSun)return;
    const anchor=this.camera.position;
    this.redSun.position.copy(anchor).addScaledVector(this.redSunDirection,50000);
    this.redSunHalo.quaternion.copy(this.camera.quaternion);
    if(this.warmLight){
      this.warmLight.position.copy(this.redSun.position);this.warmLight.target.position.copy(anchor);
      this.warmLight.target.updateMatrixWorld(true);
    }
  }
  makeSpatialGuides(){
    const T=this.T;
    const lines=(color,opacity,count)=>{
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(count*3),3));
      const o=new T.LineSegments(g,new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));
      o.frustumCulled=false;this.scene.add(o);return o;
    };
    this.spatial={levels:lines(0x6399b7,.10,256),grid:lines(0x589ba8,.12,84),rings:lines(0x76cbd5,.14,384),
      player:lines(0x79e4f0,.85,146),enemy:lines(0xff9c85,.85,146)};
    this.spatialEnabled=true;
  }
  updateTacticalPaths(){
    const T=this.T,sim=this.sim,now=sim.time||0;
    if(!this.tacticalPaths){
      this.tacticalPaths={};
      for(const [name,color] of [['Enterprise',0x398cff],['Yorktown',0x45e68b]]){
        const create=(opacity,fade=false)=>{
          const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(2400),3));geometry.setDrawRange(0,0);
          if(fade)geometry.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(2400),3));
          const line=new T.LineSegments(geometry,new T.LineBasicMaterial({color,vertexColors:fade,transparent:true,opacity,depthWrite:false}));
          line.frustumCulled=false;this.scene.add(line);return line;
        };
        this.tacticalPaths[name]={history:[],past:create(.9,true),future:create(.65,true)};
      }
    }
    if(this.pathSimulation!==sim||this.pathPlayer!==sim.player||now<(this.pathTime??-1)){
      for(const path of Object.values(this.tacticalPaths))path.history=[];
      this.pathSimulation=sim;this.pathPlayer=sim.player;
    }
    this.pathTime=now;
    const write=(line,vertices)=>{const attr=line.geometry.attributes.position;attr.array.set(vertices);attr.needsUpdate=true;line.geometry.setDrawRange(0,vertices.length/3);};
    for(const [name,state] of [['Enterprise',sim.player],['Yorktown',sim.enemy]]){
      const path=this.tacticalPaths[name],history=path.history;
      const known=name==='Enterprise'||sim.freeFlight||sim.contact;
      while(history.length&&history[0].time<now-30)history.shift();
      const last=history[history.length-1];
      if(known&&state.hull>0&&(!last||now-last.time>=.1-1e-6))history.push({time:now,x:state.x,y:state.y,z:state.z});
      const visible=this.mode==='tactical'&&!sim.replayShot&&!sim.result&&known&&state.hull>0;
      path.past.visible=path.future.visible=visible;
      if(!visible)continue;
      const vertices=[],colors=[],trace=[...history,{time:now,x:state.x,y:state.y,z:state.z}];
      const oldest=history[0]?.time??now,fadeSpan=Math.max(.1,now-oldest);
      for(let i=1;i<trace.length;i++){
        const a=trace[i-1],b=trace[i],elapsed=b.time-a.time;
        // Do not join warps or gaps in sensor contact into a traveled segment.
        if(elapsed<=0||elapsed>.3||Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)>Math.max(100,elapsed*400))continue;
        vertices.push(a.x,a.y,a.z,b.x,b.y,b.z);
        for(const point of [a,b]){const strength=Math.pow(Battle.clamp((point.time-oldest)/fadeSpan,0,1),1.3);colors.push(strength,strength,strength);}
      }
      write(path.past,vertices);
      const colorAttribute=path.past.geometry.attributes.color;colorAttribute.array.set(colors);colorAttribute.needsUpdate=true;
      const forecast=[],forecastColors=[],point={x:state.x,y:state.y,z:state.z,heading:state.heading,pitch:state.pitch};
      const speed=state.speed||0,yaw=state.turnRate||0,pitchRate=state.pitchRate||0,dt=.25;
      for(let i=0;i<60;i++){
        const before={x:point.x,y:point.y,z:point.z};
        point.heading+=yaw*dt*.5;point.pitch=Battle.clamp(point.pitch+pitchRate*dt*.5,-85,85);
        const d=Battle.direction(point);point.x+=d.x*speed*dt;point.y+=d.y*speed*dt;point.z+=d.z*speed*dt;
        point.heading+=yaw*dt*.5;point.pitch=Battle.clamp(point.pitch+pitchRate*dt*.5,-85,85);
        if(i%4<2||i===59){
          forecast.push(before.x,before.y,before.z,point.x,point.y,point.z);
          for(const fraction of [i/60,(i+1)/60]){const strength=Math.pow(1-fraction,1.3);forecastColors.push(strength,strength,strength);}
        }
      }
      write(path.future,forecast);
      const forecastAttribute=path.future.geometry.attributes.color;forecastAttribute.array.set(forecastColors);forecastAttribute.needsUpdate=true;
    }
  }
  updateSpatialGuides(){
    const p=this.sim.player,e=this.sim.enemy,T=this.T,tactical=this.mode==='tactical',chase=this.mode==='chase';
    const active=this.spatialEnabled&&!this.sim.freeFlight&&this.mode!=='cinematic'&&!this.sim.result;
    for(const [key,o] of Object.entries(this.spatial))o.visible=active&&!(tactical&&['levels','rings'].includes(key))&&!(this.sim.freeFlight&&['player','enemy'].includes(key))&&(key!=='enemy'||this.sim.contact);
    if(!active)return;
    const write=(o,points)=>{const a=o.geometry.attributes.position;a.array.set(points);a.needsUpdate=true;o.geometry.setDrawRange(0,points.length/3);};
    // Fixed world axes: pitching or turning never tilts the reference plane.
    const range=this.sim.contact?this.sim.range:600;
    // Tactical uses a calm, single-plane 5 km grid instead of stacked decks and range rings.
    const raw=tactical?500*Math.max(1,this.zoom||1):Math.max(100,range/4),base=10**Math.floor(Math.log10(raw));
    const step=([1,2,5,10].find(n=>n*base>=raw))*base;
    this.gridStep=chase?step*2:step;
    const x=Math.round(p.x/step)*step,z=Math.round(p.z/step)*step,extent=(chase?4:5)*step,grid=[];
    for(let i=chase?-4:-5;i<=(chase?4:5);i+=chase?2:1)grid.push(x+i*step,p.y,z-extent,x+i*step,p.y,z+extent,x-extent,p.y,z+i*step,x+extent,p.y,z+i*step);
    write(this.spatial.grid,grid);
    this.spatial.grid.material.opacity=tactical||chase?.10:.12;
    this.spatial.levels.material.opacity=chase?.065:.10;this.spatial.rings.material.opacity=chase?.08:.14;
    // Chase keeps only two faint deck outlines and corner rails for depth.
    const levels=[];this.levelLabels=[];
    if(!tactical)for(const level of chase?[-1,1]:[-2,-1,1,2]){
      const y=p.y+level*step;
      if(chase)levels.push(x-extent,y,z-extent,x+extent,y,z-extent,x+extent,y,z-extent,x+extent,y,z+extent,x+extent,y,z+extent,x-extent,y,z+extent,x-extent,y,z+extent,x-extent,y,z-extent);
      else for(let i=-5;i<=5;i++)levels.push(x+i*step,y,z-extent,x+i*step,y,z+extent,x-extent,y,z+i*step,x+extent,y,z+i*step);
      this.levelLabels.push({x:x+step*2,y,z:z+step*2,text:(level>0?'+':'')+(level*step/100).toFixed(1)+' KM'});
    }
    if(!tactical)for(const ix of chase?[-4,4]:[-4,0,4])for(const iz of chase?[-4,4]:[-4,0,4])levels.push(x+ix*step,p.y-(chase?1:2)*step,z+iz*step,x+ix*step,p.y+(chase?1:2)*step,z+iz*step);
    write(this.spatial.levels,levels);
    const rings=[];
    if(!tactical)for(let r=1;r<=(chase?1:3);r++)for(let i=0;i<64;i++){
      const a=i*Math.PI/32,b=(i+1)*Math.PI/32;
      rings.push(p.x+Math.cos(a)*step*r,p.y,p.z+Math.sin(a)*step*r,p.x+Math.cos(b)*step*r,p.y,p.z+Math.sin(b)*step*r);
    }
    write(this.spatial.rings,rings);
    const marker=Math.max(15,Math.min(step*.13,90));
    for(const [key,s] of [['player',p],['enemy',e]]){
      const points=[s.x,p.y,s.z,s.x,s.y,s.z];
      for(let i=0;i<32;i++){
        const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
        points.push(s.x+Math.cos(a)*marker,p.y,s.z+Math.sin(a)*marker,s.x+Math.cos(b)*marker,p.y,s.z+Math.sin(b)*marker);
      }
      // Cross at the footprint; keep the space ahead of each ship clear.
      points.push(s.x-marker*1.4,p.y,s.z,s.x+marker*1.4,p.y,s.z,s.x,p.y,s.z-marker*1.4,s.x,p.y,s.z+marker*1.4);
      write(this.spatial[key],points);
    }
    const obstruction=this.sim.stationTrace?.(p,e);
    const aligned=this.sim.lock,inRange=this.sim.range<=1500;
    const seen=this.project(e).visible;
    this.targetGuideColor=Battle.targetingColor(this.sim,seen);
    this.targetGuideState=obstruction?'K7 BLOCKING SHOT':aligned&&inRange?'IN PHASER ARC / RANGE':aligned?'ALIGNED / CLOSE RANGE':seen?'IN VIEW':'TRACKING CONTACT';
  }
  frameCloseEngagement(camPos,targetPos){
    const T=this.T,sim=this.sim;
    const eligible=['chase','cinematic'].includes(this.mode)&&sim.contact&&!sim.result&&sim.player.hull>0&&sim.enemy.hull>0;
    // Separate entry/exit distances prevent camera flicker at the boundary.
    this.closeFraming=eligible&&sim.range<(this.closeFraming?1300:1000);
    if(!this.closeFraming)return false;
    const a=this.ships.Enterprise.position,b=this.ships.Yorktown.position;
    // Keep Enterprise as the anchor and preserve the existing chase/orbit angle.
    // Yorktown can only change the camera distance, never which side it views from.
    const direction=camPos.clone().sub(a).normalize();
    targetPos.copy(a);
    // Fit both hulls, allowing space above and below for HUD and controls.
    const right=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0)).normalize();
    const up=new T.Vector3().crossVectors(right,direction).normalize();
    const tanV=Math.tan(this.framingFov*Math.PI/360),tanH=tanV*this.framingAspect;
    const horizontal=Math.max(.04,tanH*.9),vertical=tanV*.82,radius=85;
    let distance=280;
    for(const ship of [a,b]){
      const relative=ship.clone().sub(targetPos),depth=relative.dot(direction);
      distance=Math.max(distance,depth+(Math.abs(relative.dot(right))+radius)/horizontal+radius,depth+(Math.abs(relative.dot(up))+radius)/vertical+radius);
    }
    camPos.copy(targetPos).addScaledVector(direction,distance*Math.max(.7,this.zoom));
    return true;
  }
  setCamera(mode){if(mode==='tactical'&&this.mode!=='tactical')this.tacticalBaseDistance=null;const chaseStyle=value=>value==='chase'||value==='cinematic';const preserve=mode!==this.mode&&chaseStyle(mode)&&chaseStyle(this.mode);this.mode=mode;if(!preserve){this.closeFraming=false;this.orbit={x:0,y:0};this.zoom=1;if(mode!=='tactical'&&this.camera&&this.camera.zoom!==1){this.camera.zoom=1;this.camera.updateProjectionMatrix();}}}
  trackFreeFlightCamera(position,target){
    if(!this.sim.freeFlight||this.sim.replayShot||this.sim.result){this.freeFlightCamera=null;return false;}
    const p=this.sim.player,anchor=new this.T.Vector3(p.x,p.y,p.z);
    if(this.mode==='chase'||this.mode==='cinematic'){
      const T=this.T,yaw=-(p.heading||0)*Math.PI/180,pitch=(p.pitch||0)*Math.PI/180,up=new T.Vector3(0,1,0),right=new T.Vector3(1,0,0);
      const offset=new T.Vector3(0,48,235).applyAxisAngle(up,this.orbit.x);offset.y+=this.orbit.y*230;
      offset.multiplyScalar(this.zoom*Math.max(1,1.4/this.framingAspect)).applyAxisAngle(right,pitch).applyAxisAngle(up,yaw);
      position.copy(anchor).add(offset);target.copy(anchor).add(new T.Vector3(0,15,-75).applyAxisAngle(right,pitch).applyAxisAngle(up,yaw));return true;
    }
    const key=[this.mode,this.zoom,this.orbit.x,this.orbit.y].join('/');
    if(this.freeFlightCamera?.key!==key)this.freeFlightCamera={key,position:position.clone().sub(anchor),target:target.clone().sub(anchor)};
    position.copy(anchor).add(this.freeFlightCamera.position);target.copy(anchor).add(this.freeFlightCamera.target);return true;
  }
  tacticalCamera(camPos,targetPos){
    const T=this.T,a=this.ships.Enterprise.position,b=this.ships.Yorktown.position;
    targetPos.copy(a).lerp(b,.5);
    const tilt=.015+Math.abs(this.orbit.y)*.18;
    const direction=new T.Vector3(Math.sin(this.orbit.x)*tilt,1,Math.cos(this.orbit.x)*tilt).normalize();
    // A long lens keeps equal ships similarly sized across different altitudes.
    // The fixed 25 km vertical span matches the requested overview reference.
    const compression=4,aspect=this.camera.aspect||1,tan=Math.tan(this.camera.fov*Math.PI/360);
    const span=2500*Math.max(1,1/aspect),distance=span/2/tan*compression*Math.max(.5,this.zoom);
    if(this.camera.zoom!==compression){this.camera.zoom=compression;this.camera.updateProjectionMatrix();}
    camPos.copy(targetPos).addScaledVector(direction,distance);
    this.camera.far=Math.max(65000,distance+a.distanceTo(b)+1000);
  }
  frameEnterpriseLow(){
    // Shift the lens rather than changing distance, orbit or zoom.
    this.camera.updateProjectionMatrix();
    if(!['chase','cinematic'].includes(this.mode)||this.sim.replayShot||this.sim.result)return;
    const anchor=this.ships.Enterprise.position.clone().project(this.camera);
    if(anchor.z<-1||anchor.z>1)return;
    let shift=anchor.y+.44; // Enterprise center at 72% of the screen height.
    if(!this.sim.freeFlight&&this.sim.contact&&this.sim.enemy.hull>0){
      const enemy=this.ships.Yorktown.position.clone().project(this.camera);
      if(enemy.z>=-1&&enemy.z<=1&&Math.abs(enemy.x)<.9&&Math.abs(enemy.y)<.9){
        // Keep a visible opponent within the shot when the ships cross vertically.
        shift=Math.max(anchor.y+.2,Math.max(enemy.y-.85,Math.min(enemy.y+.85,shift)));
      }
    }
    this.camera.projectionMatrix.elements[9]+=shift;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }
  applyReplayDrift(){
    const shot=this.sim.replayShot,composition=this.replayComposition;if(!shot||!composition)return;
    const age=Math.max(0,(shot.screenAt??shot.at??0)-composition.started),progress=Math.min(1,age/6),sign=composition.focus==='Yorktown'?-1:1;
    // A small film-plane pan leaves the chosen damage-facing angle and lens scale intact.
    this.camera.projectionMatrix.elements[8]+=sign*.08*progress;
    this.camera.projectionMatrix.elements[9]+=.012*progress;
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
  }
  chaseCamera(camPos,targetPos){
    const T=this.T,p=this.sim.player,q=this.ships.Enterprise.quaternion;
    const offset=new T.Vector3(35*Math.min(1,this.framingAspect),45,235).applyAxisAngle(new T.Vector3(0,1,0),this.orbit.x);
    offset.y+=this.orbit.y*230;offset.multiplyScalar(this.zoom*Math.max(1,1.4/this.framingAspect)).applyQuaternion(q);
    camPos.copy(this.ships.Enterprise.position).add(offset);
    const lookAhead=Battle.clamp((this.sim.range-900)/700,0,1);
    targetPos.copy(this.ships.Enterprise.position).add(new T.Vector3(0,45,-110).multiplyScalar(lookAhead).applyQuaternion(q));
  }
  trackGameplayCamera(position,dt,snap=false){
    if(this.sim.replayShot||this.sim.result||!['chase','cinematic'].includes(this.mode)){this.gameplayCameraOffset=null;return false;}
    const ship=this.ships.Enterprise;
    // Smooth distance and orbit in Enterprise's frame so turns cannot leave
    // the camera on the wrong side of the ship or looking back at its bow.
    const offset=position.clone().sub(ship.position).applyQuaternion(ship.quaternion.clone().invert());
    if(snap||!this.gameplayCameraOffset)this.gameplayCameraOffset=offset;
    else this.gameplayCameraOffset.lerp(offset,1-Math.exp(-dt*5));
    this.camera.position.copy(this.gameplayCameraOffset).applyQuaternion(ship.quaternion).add(ship.position);
    return true;
  }
  replayDamageDirection(ship,hit,preferred,distance){
    const T=this.T,model=ship.userData?.model;if(!model||!hit?.point||!hit.normal)return null;
    ship.updateMatrixWorld(true);
    const normal=new T.Vector3(hit.normal.x,hit.normal.y,hit.normal.z);if(normal.lengthSq()<1e-8)return null;
    normal.transformDirection(model.matrixWorld);
    const target=model.localToWorld(new T.Vector3(hit.point.x,hit.point.y,hit.point.z));
    const tangent=preferred.clone().addScaledVector(normal,-preferred.dot(normal));
    if(tangent.lengthSq()<.01)tangent.crossVectors(normal,Math.abs(normal.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0));tangent.normalize();
    const across=new T.Vector3().crossVectors(normal,tangent).normalize();let best=null,bestScore=-Infinity;
    // Favor a nearly face-on view, moving sideways only when hull fittings hide the burn.
    for(const [side,up]of [[.25,0],[0,0],[-.35,0],[.55,.35],[-.55,-.35],[0,.65],[0,-.65]]){
      const candidate=normal.clone().addScaledVector(tangent,side).addScaledVector(across,up).normalize();
      const position=target.clone().addScaledVector(candidate,distance),contact=this.traceHull(ship,position,target,{camera:true});
      const visible=!contact||contact.point.distanceTo(target)<2;
      const score=(visible?10:0)+candidate.dot(normal)*3+candidate.dot(preferred)*.25;
      if(score>bestScore){bestScore=score;best=candidate;}
      if(visible&&side===.25)break;
    }
    return best;
  }
  replayCamera(camPos,targetPos){
    const T=this.T,sim=this.sim,screenAt=sim.replayShot.screenAt??sim.replayShot.at;let shot=sim.replayShot;
    const a=this.ships.Enterprise.position,b=this.ships.Yorktown.position,mid=a.clone().lerp(b,.5);
    // Keep a fixed world-space viewing side for the entire replay. Ships may
    // cross naturally without dragging the camera around their changing axis.
    if(this.replayCut==null||!this.replayAlong){
      const line=b.clone().sub(a);line.y=0;this.replayAlong=line.length()<1?new T.Vector3(0,0,-1):line.normalize();
    }
    const along=this.replayAlong.clone();
    const side=new T.Vector3(-along.z,0,along.x);this.replayAxisSide=side;
    const sameSide=direction=>{
      const amount=direction.dot(side);
      if(amount<.35)direction.addScaledVector(side,.35-amount).normalize();
      return direction;
    };
    if(this.replayCut==null)this.replayComposition=null;
    const previous=this.replayComposition,portrait=Math.max(1,1.3/this.framingAspect),radius=85;
    if(!previous){this.replayReactions=[];this.replayDetail=null;}
    if(this.replayReactions)this.replayReactions=this.replayReactions.filter(item=>screenAt-item.queuedAt<10);
    const age=previous?screenAt-previous.started:Infinity;
    const reactionReady=previous&&previous.kind!=='establishing'&&age>=3.5;
    if(!shot.sequenceKey&&shot.kind!=='destruction'&&reactionReady){
      if(this.replayDetail&&previous.kind==='impact')shot={...this.replayDetail,screenAt};
      else if(this.replayReactions?.length)shot={...this.replayReactions[0],screenAt};
    }
    const wideDistance=(direction)=>{
      let right=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0));if(right.length()<.01)right.set(1,0,0);right.normalize();
      const up=new T.Vector3().crossVectors(right,direction).normalize(),tan=Math.tan(this.framingFov*Math.PI/360);
      let required=650*portrait;
      const subjects=[{point:a,radius},{point:b,radius}];
      if(shot.kind==='establishing'&&sim.station)subjects.push({point:new T.Vector3(sim.station.x,sim.station.y,sim.station.z),radius:sim.station.radius||350});
      for(const item of subjects){const v=item.point.clone().sub(mid),depth=v.dot(direction),r=item.radius;required=Math.max(required,depth+(Math.abs(v.dot(right))+r)/(tan*this.framingAspect*.85)+r,depth+(Math.abs(v.dot(up))+r)/(tan*.75)+r);}
      return required;
    };
    const fitPair=(direction,target=mid)=>{
      const right=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0)).normalize(),up=new T.Vector3().crossVectors(right,direction).normalize();
      const tan=Math.tan(this.framingFov*Math.PI/360);let required=210*portrait;
      for(const point of [a,b]){
        const offset=point.clone().sub(target),depth=offset.dot(direction);
        required=Math.max(required,depth+radius+35,depth+radius+(Math.abs(offset.dot(right))+radius)/(tan*this.framingAspect*.88),depth+radius+(Math.abs(offset.dot(up))+radius)/(tan*.85));
      }
      return required;
    };
    // A shot is held in screen time, so slow motion cannot produce rapid cuts.
    const special=['establishing','phaser','torpedo','destruction','component'].includes(shot.kind);
    const responseCut=['impact','component'].includes(shot.kind)&&reactionReady;
    const minimum=previous?.kind==='establishing'?4.5:['duel','tracking','flyby','trailing','withdrawal'].includes(previous?.kind)?7:5;
    const sequenceCut=shot.sequenceKey&&previous?.sequenceKey!==shot.sequenceKey;
    const damageCut=shot.damageInsert&&this.replayCut!==shot.key&&previous?.kind!=='establishing'&&age>=1.5;
    const returnFromDamage=previous?.damageInsert&&!shot.damageInsert&&age>=2.5;
    const cut=!previous||sequenceCut||damageCut||returnFromDamage||this.replayCut!==shot.key&&(age>=minimum||responseCut||shot.kind==='destruction');
    if(cut){
      const twoShips=!['component','destruction'].includes(shot.kind)&&(shot.kind!=='impact'||a.distanceTo(b)<800)&&(shot.kind!=='withdrawal'||a.distanceTo(b)<1800);
      const framing=twoShips?'medium':special?'close':'medium';
      const focus=shot.focus==='Yorktown'?'Yorktown':'Enterprise',subject=framing==='wide'||twoShips?mid:this.ships[focus].position;
      let direction;
      if(framing==='wide'){
        direction=new T.Vector3(-along.z,.55,along.x).normalize();
      }else{direction=side.clone().addScaledVector(along,framing==='close'?.25:-.25);direction.y=framing==='close'?.25:.42;direction.normalize();}

      if(shot.kind==='phaser'){direction=side.clone().addScaledVector(along,.25);direction.y=-.5;direction.normalize();}
      if(shot.kind==='torpedo'){direction=side.clone().addScaledVector(along,-.35);direction.y=.2;direction.normalize();}
      if(shot.kind==='destruction'){direction=side.clone().addScaledVector(along,.3);direction.y=.5;direction.normalize();}
      if(shot.kind==='trailing'){
        const state=focus==='Enterprise'?sim.player:sim.enemy,f=Battle.direction({...state,pitch:state.pitch||0});
        direction=new T.Vector3(-f.x,.22,-f.z).addScaledVector(side,.9).normalize();
      }
      if(shot.kind==='component'){direction=side.clone().addScaledVector(along,-.2);direction.y=.2;direction.normalize();}
      if(twoShips){
        // Search fixed views from the established side of the line of action.
        // Foreshortening can show both hulls much closer than a distant broadside.
        let best=-Infinity;
        for(const bias of [-.65,-.25,.25,.65,1.05])for(const elevation of [.16,.34,.55]){
          const candidate=side.clone().addScaledVector(along,bias);candidate.y=elevation;candidate.normalize();
          if(previous&&previous.kind!=='establishing'&&candidate.dot(previous.direction)<.74)continue;
          const distance=fitPair(candidate),da=distance-a.clone().sub(mid).dot(candidate),db=distance-b.clone().sub(mid).dot(candidate);
          const separation=b.clone().sub(a).cross(candidate).length(),balance=Math.min(da,db)/Math.max(da,db);
          const score=(2/Math.max(da,db)+.25/Math.min(da,db))*(separation<radius*2.2?.3:1)*(.85+.15*balance);
          if(score>best){best=score;direction=candidate;}
        }
      }
      const damageDirection=shot.kind==='component'?this.replayDamageDirection(this.ships[focus],shot.event?.hit,direction,110*portrait):null;
      if(damageDirection)direction=damageDirection;
      else{
        if(previous&&previous.kind!=='establishing'&&direction.dot(previous.direction)<.74)direction.lerp(previous.direction,.8).normalize();
        sameSide(direction);
      }
      const nearMargin=framing==='close'?100:140,frontDistance=Math.max(nearMargin,...[a,b].map(point=>point.clone().sub(subject).dot(direction)+nearMargin));
      let distance=Math.max(frontDistance,framing==='wide'?wideDistance(direction):(framing==='medium'?430:110)*portrait);
      if(shot.kind==='phaser'&&!twoShips){direction.y=-Math.max(.3,Math.abs(direction.y));direction.normalize();distance=155*portrait;}
      if(shot.kind==='torpedo'&&!twoShips)distance=165*portrait;
      if(shot.kind==='component')distance=110*portrait;
      if(shot.kind==='trailing')distance=Math.max(260*portrait,Math.min(distance,500*portrait));
      if(twoShips)distance=fitPair(direction);
      this.replayComposition={damageInsert:!!shot.damageInsert,tracking:['tracking','trailing','component','hero'].includes(shot.kind),sequenceKey:shot.sequenceKey,framing,focus,kind:shot.kind,twoShips,direction,distance,started:screenAt,event:shot.event,projectileId:shot.projectileId,origin:this.ships[focus].position.clone()};this.replayCut=shot.key;
      if(damageDirection)this.replayComposition.damageLocalDirection=damageDirection.clone().transformDirection(this.ships[focus].userData.model.matrixWorld.clone().invert());
      if(shot.kind==='impact'){
        this.replayReactions=(this.replayReactions||[]).filter(item=>item.key!==shot.key&&item.event!==shot.event);
        this.replayDetail=shot.event?.hullDamage>0?{kind:'component',focus,key:shot.key+'-detail',event:shot.event}:null;
      }else if(shot.kind==='component')this.replayDetail=null;
    }
    const composition=this.replayComposition;
    if(composition.damageLocalDirection){
      const ship=this.ships[composition.focus];ship.updateMatrixWorld(true);
      composition.direction=composition.damageLocalDirection.clone().transformDirection(ship.userData.model.matrixWorld);
    }
    if(composition.fixedPosition){
      camPos.copy(composition.fixedPosition);targetPos.copy(composition.fixedTarget);
      this.zoomReplayAction(camPos,targetPos,false);
      sim.replayShot.framing=composition.framing;sim.replayShot.cameraKind=composition.kind;sim.replayShot.cameraFocus=composition.focus;
      return cut;
    }
    targetPos.copy(composition.framing==='wide'||composition.twoShips?mid:this.ships[composition.focus].position);
    if(composition.kind==='component'){
      const point=composition.event?.hit?.point,model=this.ships[composition.focus].userData?.model;
      if(point&&model){this.ships[composition.focus].updateMatrixWorld(true);targetPos.copy(model.localToWorld(new T.Vector3(point.x,point.y,point.z)));}
      else if(['engines','mainEngines'].includes(composition.event?.system))targetPos.add(new T.Vector3(0,25,35));
    }
    if(composition.kind==='trailing'&&!composition.twoShips){
      const state=composition.focus==='Enterprise'?sim.player:sim.enemy,f=Battle.direction({...state,pitch:state.pitch||0});
      targetPos.add(new T.Vector3(f.x,f.y,f.z).multiplyScalar(80));
    }
    if(composition.kind==='phaser'&&!composition.twoShips&&this.ships[composition.focus].userData?.model){
      const event=composition.event||{},other=event.to||(composition.focus==='Enterprise'?'Yorktown':'Enterprise');
      targetPos.copy(this.weaponEndpoints(composition.focus,other,event.hit).start);
    }
    if(composition.kind==='torpedo'&&!composition.twoShips){
      const projectile=sim.projectiles?.find(p=>p.id===composition.projectileId);
      if(projectile)targetPos.set(projectile.pos.x,projectile.pos.y,projectile.pos.z);
      else if(composition.lastTarget)targetPos.copy(composition.lastTarget);
    }
    if(composition.kind==='destruction'){
      const pieces=(this.effects||[]).filter(effect=>effect.kind==='debris');
      if(pieces.length){targetPos.set(0,0,0);for(const piece of pieces)targetPos.add(piece.object.position);targetPos.multiplyScalar(1/pieces.length);}
      const spread=pieces.reduce((r,piece)=>Math.max(r,piece.object.position.distanceTo(targetPos)),0);
      const drift=Math.max(100,...pieces.map(piece=>piece.velocity?.length()||0));
      composition.distance=Math.max(700,(spread+85+drift*Battle.DESTRUCTION_DURATION)/Math.tan(this.framingFov*Math.PI/360)/Math.min(1,this.framingAspect));
    }
    const direction=composition.direction.clone();
    const distance=composition.twoShips?fitPair(direction,targetPos):(composition.framing==='wide'?Math.max(composition.distance,wideDistance(direction)):composition.distance)*(composition.kind==='destruction'?1:1-.035*Math.min(1,(screenAt-composition.started)/5));
    camPos.copy(targetPos).addScaledVector(direction,distance);
    if(composition.kind==='flyby'&&!composition.twoShips){
      const traveled=this.ships[composition.focus].position.clone().sub(composition.origin);
      const length=traveled.length();if(length>0)camPos.addScaledVector(traveled,-Math.min(.7,300/length));
    }
    this.keepReplayScreenDirection(camPos,targetPos,composition.framing==='close'?100:140);
    if(!composition.tracking){composition.fixedPosition=camPos.clone();composition.fixedTarget=targetPos.clone();}
    this.zoomReplayAction(camPos,targetPos,cut);
    composition.lastTarget=targetPos.clone();
    sim.replayShot.framing=composition.framing;sim.replayShot.cameraKind=composition.kind;sim.replayShot.cameraFocus=composition.focus;
    return cut;
  }
  replayHullPoints(ship){
    const T=this.T,points=[];if(!ship.updateMatrixWorld||!(ship.userData?.model||ship).traverse)return points;ship.updateMatrixWorld(true);
    (ship.userData?.model||ship).traverse(mesh=>{
      if(!(mesh instanceof T.Mesh)||mesh.userData.scorch||!mesh.geometry?.attributes?.position)return;
      for(let parent=mesh;parent;parent=parent.parent)if(!parent.visible)return;
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;if(!box||box.isEmpty())return;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));
    });return points;
  }
  zoomReplayAction(position,target,snap=false){
    const T=this.T,composition=this.replayComposition,shot=this.sim.replayShot;
    if(!composition)return;
    const forward=target.clone().sub(position).normalize(),right=new T.Vector3().crossVectors(forward,new T.Vector3(0,1,0)).normalize(),up=new T.Vector3().crossVectors(right,forward).normalize();
    let subjects=composition.twoShips?Object.values(this.ships).map(ship=>({point:ship.position,radius:85})):[{point:this.ships[composition.focus].position,radius:85}];
    const closeAction=composition.twoShips&&this.ships.Enterprise.position.distanceTo(this.ships.Yorktown.position)<450&&composition.kind!=='establishing';
    if(closeAction){
      const hullPoints=Object.values(this.ships).flatMap(ship=>this.replayHullPoints(ship));
      if(hullPoints.length)subjects=hullPoints.map(point=>({point,radius:0}));
    }
    if(composition.kind==='component')subjects=[{point:target,radius:18}];
    if(composition.kind==='establishing'){
      subjects=Object.values(this.ships).map(ship=>({point:ship.position,radius:85}));

    }
    if(composition.kind==='destruction'){
      const debris=(this.effects||[]).filter(effect=>effect.kind==='debris');
      if(debris.length)subjects=debris.map(effect=>({point:effect.object.position,radius:65}));
    }
    const tan=Math.tan(this.framingFov*Math.PI/360);let desired=closeAction?3.4:2.4;
    for(const {point,radius} of subjects){
      const offset=point.clone().sub(position),depth=offset.dot(forward)-radius;
      if(depth<=1){desired=.25;break;}
      desired=Math.min(desired,depth*tan*this.framingAspect*(closeAction?.94:.86)/Math.max(.001,Math.abs(offset.dot(right))+radius),depth*tan*(closeAction?.92:.82)/Math.max(.001,Math.abs(offset.dot(up))+radius));
    }
    desired=Battle.clamp(desired,.25,closeAction?3.4:2.4);
    const current=composition.opticalZoom??1,dt=Math.max(0,shot.frameDt??1/60);
    // Widen promptly for departing action; tighten gradually to avoid pumping.
    const blend=1-Math.exp(-dt*(desired<current?4:closeAction?2:1.2));
    const next=snap?desired:Math.abs(desired-current)<.025?current:current+(desired-current)*blend;
    composition.opticalZoom=next;shot.zoom=next;
    if(Math.abs(this.camera.zoom-next)>1e-6){this.camera.zoom=next;this.camera.updateProjectionMatrix();}
  }
  keepReplayScreenDirection(position,target,nearMargin=this.sim.replayShot?.framing==='close'?100:140){
    if(this.replayComposition?.damageLocalDirection)return;
    if(this.replayComposition?.fixedPosition||!this.replayAxisSide)return;
    const offset=position.clone().sub(target),margin=offset.length()*.2,side=offset.dot(this.replayAxisSide);
    if(side<margin)offset.addScaledVector(this.replayAxisSide,margin-side);
    if(['phaser','torpedo','destruction','component','trailing'].includes(this.replayComposition?.kind)){position.copy(target).add(offset);return;}
    const length=offset.length();if(length<.001)return;
    const direction=offset.clone().multiplyScalar(1/length);
    // A subject behind a perspective camera reverses its projected screen side.
    // Keep both hull centers safely forward, even in a portrait of only one ship.
    const distance=Math.max(length,...['Enterprise','Yorktown'].map(name=>this.ships[name].position.clone().sub(target).dot(direction)+nearMargin));
    position.copy(target).addScaledVector(direction,distance);
  }
  trackReplayCamera(position,target,viewDt,snap=false){
    if(this.replayComposition?.damageLocalDirection){
      // Recorded movement is already interpolated. Keep the actual burn centered without chase lag.
      this.camera.position.copy(position);this.replayCameraTarget=target.clone();this.replayCameraOffset=position.clone().sub(target);return;
    }
    if(this.replayComposition?.fixedPosition){
      target.copy(this.replayComposition.fixedTarget);this.camera.position.copy(this.replayComposition.fixedPosition);
      this.replayCameraTarget=target.clone();this.replayCameraOffset=this.camera.position.clone().sub(target);return;
    }
    const offset=position.clone().sub(target),blend=1-Math.exp(-viewDt*4);
    if(snap||!this.replayCameraTarget){this.replayCameraTarget=target.clone();this.replayCameraOffset=offset;}
    else{this.replayCameraTarget.lerp(target,blend);this.replayCameraOffset.lerp(offset,blend);}
    target.copy(this.replayCameraTarget);this.camera.position.copy(target).add(this.replayCameraOffset);
  }
  event(event){
    const T=this.T;
    if(event.type==='station-impact'||event.type==='station-collision'||event.type==='ship-collision'){this.burst(new T.Vector3(event.pos.x,event.pos.y,event.pos.z),0xffc486,30);if(event.ship==='Enterprise')this.shake=.35;}
    if(event.type==='warp'){
      // Move the viewscreen immediately to the destination instead of flying the camera across the gap.
      this.update(0,true);
      const points=[],q=this.ships.Enterprise.quaternion;
      for(let i=0;i<50;i++){
        const a=Math.random()*Math.PI*2,r=90+Math.random()*240,z=(Math.random()-.5)*700;
        const start=new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z).applyQuaternion(q);
        const end=new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z+120+Math.random()*250).applyQuaternion(q);
        points.push(...start.toArray(),...end.toArray());
      }
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
      const streaks=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x9cddff,transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending}));
      streaks.position.set(event.to.x,event.to.y,event.to.z);this.scene.add(streaks);this.effects.push({object:streaks,life:0,max:.8,kind:'warp'});
    }
    if(event.type==='beam'){
      for(const state of [this.sim.player,this.sim.enemy])if(state.name)this.syncWeaponShip(state);
      const {start:a,end:b}=this.weaponEndpoints(event.from,event.to,event.hit,event.missed);
      const g=new T.Group(),v=b.clone().sub(a),length=v.length();
      const enemyBeam=event.from==='Yorktown',beamColors=enemyBeam?[0xff4d24,0xffad64,0xfff7e8]:[0x103cff,0x2864ff,0x92b4ff];
      for(const [radius,color,opacity] of [[7,beamColors[0],.2],[2.4,beamColors[1],.8],[.8,beamColors[2],1]]){const mesh=new T.Mesh(new T.CylinderGeometry(radius,radius,length,8),new T.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:T.AdditiveBlending}));mesh.position.copy(a).addScaledVector(v,.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize());g.add(mesh);}
      this.scene.add(g);this.effects.push({object:g,life:0,max:event.duration||Battle.PHASER_DURATION,kind:'beam',from:event.from,to:event.to,hit:event.hit,missed:event.missed,baseLength:Math.max(.001,length)});
      // Broad launch flare and impact bloom frame the bright sustained beam.
      for(const [position,size] of (event.practice||event.missed?[[a,30]]:[[a,30],[b,50]])){
        const flare=new T.Sprite(new T.SpriteMaterial({map:this.glowMap(),color:enemyBeam?0xffa660:0x2864ff,transparent:true,opacity:1,depthWrite:false,blending:T.AdditiveBlending}));
        flare.position.copy(position);flare.scale.setScalar(size);this.scene.add(flare);this.effects.push({object:flare,life:0,max:.6,kind:'flash'});
      }
    }
    if(event.type==='impact'){
      if(this.sim.replayShot){
        this.replayReactions??=[];
        this.replayReactions.push({kind:'impact',focus:event.ship,event,key:'reaction-'+this.sim.time+'-'+event.ship,queuedAt:this.sim.replayShot.screenAt??0});
        if(this.replayReactions.length>3)this.replayReactions.shift();
      }
      const ship=this.ships[event.ship];if(event.ship==='Enterprise')this.shake=.7;
      const source=event.ship==='Enterprise'?this.sim.enemy:this.sim.player,pos=ship.position.clone(),v=new T.Vector3(source.x-pos.x,source.y-pos.y,source.z-pos.z).normalize();pos.addScaledVector(v,35);
      if(event.hit){ship.updateMatrixWorld(true);pos.copy(ship.userData.model.localToWorld(new T.Vector3(event.hit.point.x,event.hit.point.y,event.hit.point.z)));}
      if(event.hullDamage>0){if(event.hit)this.addImpactScar(ship,event.weapon,event.hit);else this.addHullScar(ship,event.weapon);}
      this.burst(pos,event.hullDamage>0?0xff793c:0x9bdfff,event.weapon==='phaser'?(event.hullDamage>0?65:40):(event.hullDamage>0?45:24));
    }
    if(event.type==='nacelle-detached')this.detachNacelle(event.ship,event.side);
    if(event.type==='destroyed')this.breakApart(event.ship);
    if(event.type==='scan'){const o=new T.Mesh(new T.SphereGeometry(1,32,20),new T.MeshBasicMaterial({color:0x6de4e5,wireframe:true,transparent:true,opacity:.25,depthWrite:false}));o.position.copy(this.ships.Enterprise.position);this.scene.add(o);this.effects.push({object:o,life:0,max:2,kind:'scan'});}
  }
  addHullScar(ship,weapon){
    const T=this.T,u=ship.userData,index=u.scars.length;
    // Conform scorch geometry to the saucer surface so it stays attached in every attitude.
    const a=index*2.399963+Math.random()*.5,r=.23+Math.random()*.18;
    const cx=Math.cos(a)*r,cz=Math.sin(a)*r;
    const attacker=ship.name==='Enterprise'?this.ships.Yorktown:this.ships.Enterprise;
    ship.updateMatrixWorld(true);
    const source=ship.worldToLocal(attacker.getWorldPosition(new T.Vector3()));
    const top=source.y>=0;
    const profile=top?[[0,.19],[.15,.19],[.29,.16],[.49,.12],[.64,.09],[.69,.075]]:[[0,-.09],[.15,-.09],[.36,-.05],[.57,-.02],[.68,.015],[.69,.04]];
    const surface=(x,z)=>{
      const radius=Math.hypot(x,z);
      for(let i=1;i<profile.length;i++)if(radius<=profile[i][0]){
        const [a,y]=profile[i-1],[b,v]=profile[i];return y+(v-y)*(radius-a)/(b-a)+(top?.002:-.002);
      }
      return top?.077:.038;
    };
    const point=u.model.worldToLocal(u.saucer.localToWorld(new T.Vector3(cx,surface(cx,cz),cz)));
    this.addImpactScar(ship,weapon,{point,normal:{x:0,y:top?1:-1,z:0}});
  }
  disposeScar(scar){scar.parent?.remove(scar);scar.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  cloneHullMaterial(material){
    const clone=material.clone();
    if(material.userData.hdDetailPatch){clone.onBeforeCompile=material.onBeforeCompile;clone.customProgramCacheKey=material.customProgramCacheKey;}
    return clone;
  }
  syncWeaponShip(state){
    const ship=this.ships[state.name];ship.position.set(state.x,state.y,state.z);
    const pose=this.sim.replayShot&&this.sim.replayPoses?.[state.name]||state;
    ship.rotation.set((pose.pitch||0)*Math.PI/180,-(pose.heading||0)*Math.PI/180,pose.bank||0,'YXZ');this.syncNacelles(ship,state);ship.updateMatrixWorld(true);return ship;
  }
  traceHull(ship,origin,aim,{camera=false}={}){
    const T=this.T;let nearest=null;
    ship.updateMatrixWorld(true);
    ship.userData.model.traverse(mesh=>{
      if(!(mesh instanceof T.Mesh)||mesh.userData.scorch||mesh.material?.transparent&&mesh.material.opacity===0||!mesh.geometry?.attributes?.position)return;
      for(let parent=mesh;parent;parent=parent.parent)if(!parent.visible)return;
      if(camera&&[].concat(mesh.material).every(material=>material.transparent))return;
      const start=mesh.worldToLocal(origin.clone()),end=mesh.worldToLocal(aim.clone()),d=end.sub(start);
      if(camera){
        if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;let near=0,far=1;
        for(const axis of ['x','y','z']){
          if(Math.abs(d[axis])<1e-10){if(start[axis]<box.min[axis]||start[axis]>box.max[axis])return;}
          else{const a=(box.min[axis]-start[axis])/d[axis],b=(box.max[axis]-start[axis])/d[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return;}
        }
      }
      const positions=mesh.geometry.attributes.position.array,indices=mesh.geometry.index?.array,count=indices?indices.length:positions.length/3;
      for(let i=0;i<count;i+=3){
        const ai=(indices?indices[i]:i)*3,bi=(indices?indices[i+1]:i+1)*3,ci=(indices?indices[i+2]:i+2)*3;
        const ax=positions[ai],ay=positions[ai+1],az=positions[ai+2];
        const ux=positions[bi]-ax,uy=positions[bi+1]-ay,uz=positions[bi+2]-az,vx=positions[ci]-ax,vy=positions[ci+1]-ay,vz=positions[ci+2]-az;
        const px=d.y*vz-d.z*vy,py=d.z*vx-d.x*vz,pz=d.x*vy-d.y*vx,det=ux*px+uy*py+uz*pz;
        if(Math.abs(det)<1e-10)continue;
        const tx=start.x-ax,ty=start.y-ay,tz=start.z-az,u=(tx*px+ty*py+tz*pz)/det;if(u<0||u>1)continue;
        const qx=ty*uz-tz*uy,qy=tz*ux-tx*uz,qz=tx*uy-ty*ux,v=(d.x*qx+d.y*qy+d.z*qz)/det;if(v<0||u+v>1)continue;
        const t=(vx*qx+vy*qy+vz*qz)/det;if(t<0||t>1.05||nearest&&t>=nearest.t)continue;
        const point=new T.Vector3(start.x+d.x*t,start.y+d.y*t,start.z+d.z*t).applyMatrix4(mesh.matrixWorld);
        const a=new T.Vector3(ax,ay,az).applyMatrix4(mesh.matrixWorld),b=new T.Vector3(positions[bi],positions[bi+1],positions[bi+2]).applyMatrix4(mesh.matrixWorld),c=new T.Vector3(positions[ci],positions[ci+1],positions[ci+2]).applyMatrix4(mesh.matrixWorld);
        const normal=b.sub(a).cross(c.sub(a)).normalize();if(normal.dot(origin.clone().sub(point))<0)normal.multiplyScalar(-1);
        nearest={t,point,normal,mesh};
      }
    });return nearest;
  }
  phaserEmitter({aft=false,ship}={}){
    const T=this.T;if(!aft)return new T.Vector3(0,.265,-1.65);
    const u=ship?.userData;if(u?.aftPhaserEmitter)return u.aftPhaserEmitter.clone();
    const hull=u?.engineeringHull,model=u?.model;if(!hull||!model)return new T.Vector3(0,.14,.32);
    ship.updateMatrixWorld(true);if(!hull.geometry.boundingBox)hull.geometry.computeBoundingBox();
    const box=hull.geometry.boundingBox,matrix=model.matrixWorld.clone().invert().multiply(hull.matrixWorld),points=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new T.Vector3(x,y,z).applyMatrix4(matrix));
    const zMin=Math.min(...points.map(p=>p.z)),zMax=Math.max(...points.map(p=>p.z)),yMin=Math.min(...points.map(p=>p.y)),yMax=Math.max(...points.map(p=>p.y)),aftZ=zMax-(zMax-zMin)*.15;
    const top=model.localToWorld(new T.Vector3(0,yMax+.3,aftZ)),bottom=model.localToWorld(new T.Vector3(0,yMin-.3,aftZ)),contact=this.traceHull(ship,top,bottom,{camera:true});
    const emitter=contact?model.worldToLocal(contact.point.clone()):new T.Vector3(0,yMax,aftZ);emitter.y+=.002;
    u.aftPhaserEmitter=emitter;return emitter.clone();
  }
  resolveWeaponHit(shooter,target,aim,weapon='phaser',projectilePosition=null,projectileEnd=null){
    const T=this.T,from=this.syncWeaponShip(shooter),to=this.syncWeaponShip(target),model=to.userData.model;
    const close=this.sim.turnBased&&!this.sim.freeFlight&&['approach','attack','withdraw'].includes(this.sim.turn?.phase)&&(this.sim.turn?.maneuver==='close'||Battle.angle(shooter,target)>(weapon==='phaser'?65:28));
    const aft=(shooter.name===this.sim.enemy.name||close)&&Battle.angle(shooter,target)>90;
    const emitter=this.phaserEmitter({aft,ship:from});
    const r=Battle.distance(shooter,target)||1,forward=close?{x:(target.x-shooter.x)/r,y:(target.y-shooter.y)/r,z:(target.z-shooter.z)/r}:Battle.direction(shooter);
    const origin=projectilePosition?new T.Vector3(projectilePosition.x,projectilePosition.y,projectilePosition.z):weapon==='torpedo'?from.position.clone().add(new T.Vector3(forward.x,forward.y,forward.z).multiplyScalar(!close&&aft?-30:30)):from.userData.model.localToWorld(emitter.clone());
    const localSource=model.worldToLocal(origin.clone()),side=localSource.x<0?-1:1;
    const anchors={hull:[0,.3,-1.12],bridge:[0,.55,-1.12],engines:[0,.375,-.445],mainEngines:[side*.56,.53,.1+(to.userData.nacelleAftOffset||0)],reactor:[0,.02,-.02],shields:[0,.1,-.58+(to.userData.nacelleAftOffset||0)],weapons:[side*.4,.32,-1.3],sensors:[0,.15,-1.12]};
    const previewPylon=this.sim.previewNacelleBreakoff&&shooter===this.sim.enemy&&target===this.sim.player&&!this.sim.freeFlight;
    const pylon=previewPylon?to.userData.breakupParts.find(part=>part.userData.pylonSide===(this.sim.previewAttackArc|| (side<0?'port':'starboard'))):null;
    const selected=pylon?pylon.position.toArray():anchors[aim]||anchors.hull,endpoint=model.localToWorld(new T.Vector3(...selected));
    const result=projectileEnd?this.traceHull(to,origin,new T.Vector3(projectileEnd.x,projectileEnd.y,projectileEnd.z)):this.traceHull(to,origin,endpoint)||this.traceHull(to,origin,model.localToWorld(new T.Vector3(...anchors.hull)));
    if(!result)return undefined;
    const point=model.worldToLocal(result.point.clone()),normal=result.normal.clone().transformDirection(model.matrixWorld.clone().invert());
    let component=null,best=Infinity;
    for(const [key,anchor] of Object.entries(anchors))if(key!=='hull'){
      const score=point.distanceTo(new T.Vector3(...anchor));if(score<best){best=score;component=key;}
    }
    const plain=v=>({x:v.x,y:v.y,z:v.z});return {emitter:plain(emitter),point:plain(point),normal:plain(normal),worldPoint:plain(result.point),component:result.mesh?.userData.pylonSide?'mainEngines':component,...(result.mesh?.userData.pylonSide?{pylonSide:result.mesh.userData.pylonSide}:{})};
  }
  weaponEndpoints(fromName,toName,hit,missed=false){
    const T=this.T,from=this.ships[fromName],to=this.ships[toName];
    if(this.sim.freeFlight||missed){
      from.updateMatrixWorld(true);
      const state=fromName==='Enterprise'?this.sim.player:this.sim.enemy,target=toName==='Enterprise'?this.sim.player:this.sim.enemy;
      const aft=!this.sim.freeFlight&&(fromName==='Yorktown'||this.sim.turn?.maneuver==='close')&&Battle.angle(state,target)>90;
      const start=from.userData.model.localToWorld(this.phaserEmitter({aft,ship:from})),d=Battle.direction(state);
      return {start,end:start.clone().add(new T.Vector3(d.x,d.y,d.z).multiplyScalar(aft?-1500:1500))};
    }
    from.updateMatrixWorld(true);to.updateMatrixWorld(true);
    const aft=hit?.emitter&&Math.abs(hit.emitter.x)<.001&&hit.emitter.z>-.4;
    const emitter=aft?this.phaserEmitter({aft:true,ship:from}):hit?.emitter||this.phaserEmitter(),point=hit?.point||{x:0,y:.3,z:-1.12};
    return {start:from.userData.model.localToWorld(new T.Vector3(emitter.x,emitter.y,emitter.z)),end:to.userData.model.localToWorld(new T.Vector3(point.x,point.y,point.z))};
  }
  addImpactScar(ship,weapon,hit){
    const T=this.T,model=ship.userData.model,center=new T.Vector3(hit.point.x,hit.point.y,hit.point.z),size=weapon==='torpedo'?.12:.065;
    ship.updateMatrixWorld(true);
    const toModel=model.matrixWorld.clone().invert(),triangles=[];
    let owner=null,nearest=Infinity;
    // Work on real hull facets, not a plane facing the incoming weapon. Keep
    // the mark on its physical breakup piece so it travels with the wreckage.
    model.traverse(mesh=>{
      if(!(mesh instanceof T.Mesh)||mesh.userData.scorch||!mesh.geometry?.attributes?.position)return;
      for(let parent=mesh;parent;parent=parent.parent)if(!parent.visible)return;
      const materials=[].concat(mesh.material);
      // HD hull maps include lit windows; that does not make the hull a lamp.
      if(materials.every(m=>m.transparent||m.emissive?.getHex()>0&&!m.emissiveMap))return;
      let part=mesh;
      while(part.parent&&part.parent!==model&&!ship.userData.breakupParts.includes(part))part=part.parent;
      const matrix=toModel.clone().multiply(mesh.matrixWorld),positions=mesh.geometry.attributes.position,indices=mesh.geometry.index;
      const count=indices?indices.count:positions.count;
      for(let i=0;i<count;i+=3){
        const vertices=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(positions,indices?indices.getX(i+j):i+j).applyMatrix4(matrix));
        // Ignore distant facets before the more expensive clipping work.
        const reach=size*1.7;
        if(['x','y','z'].some(axis=>Math.min(...vertices.map(v=>v[axis]))>center[axis]+reach||Math.max(...vertices.map(v=>v[axis]))<center[axis]-reach))continue;
        const [a,b,c]=vertices,ab=b.clone().sub(a),ac=c.clone().sub(a),n=ab.clone().cross(ac).normalize();
        const projected=center.clone().addScaledVector(n,-center.clone().sub(a).dot(n));
        const inside=n.lengthSq()>0&&vertices.every((v,j)=>vertices[(j+1)%3].clone().sub(v).cross(projected.clone().sub(v)).dot(n)>=-1e-10);
        const distance=inside?projected.distanceToSquared(center):Math.min(...vertices.map((v,j)=>{
          const edge=vertices[(j+1)%3].clone().sub(v),t=Math.max(0,Math.min(1,center.clone().sub(v).dot(edge)/(edge.lengthSq()||1)));
          return v.clone().addScaledVector(edge,t).distanceToSquared(center);
        }));
        if(distance<nearest){nearest=distance;owner=part;}
        triangles.push({part,vertices});
      }
    });
    if(!owner)return;
    const scar=new T.Group(),modelToPart=owner.matrixWorld.clone().invert().multiply(model.matrixWorld);
    scar.position.copy(center.clone().applyMatrix4(modelToPart));
    scar.userData.scorch=true;
    // A small irregular blast volume clips the existing triangles. This wraps
    // across curved surfaces and corners, including both sides of thin pieces,
    // without extending a floating decal beyond their silhouette.
    const planes=[];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      if(!x&&!y&&!z)continue;
      const normal=new T.Vector3(x,y,z).normalize(),roughness=.9+.1*Math.sin(x*17+y*31+z*13)**2;
      planes.push({normal,roughness});
    }
    for(const [layer,[scale,opacity,color]] of [[1.45,.65,0x170c09],[1.28,.95,0xff2108],[1,.995,0x010101]].entries()){
      const vertices=[],scarPoints=[];
      for(const triangle of triangles){
        if(triangle.part!==owner)continue;
        let polygon=triangle.vertices;
        for(const {normal,roughness} of planes){
          const clipped=[],limit=size*scale*roughness;
          for(let i=0;i<polygon.length;i++){
            const a=polygon[i],b=polygon[(i+1)%polygon.length],da=normal.dot(a.clone().sub(center))-limit,db=normal.dot(b.clone().sub(center))-limit;
            if(da<=0)clipped.push(a);
            if((da<=0)!==(db<=0))clipped.push(a.clone().lerp(b,da/(da-db)));
          }
          polygon=clipped;if(polygon.length<3)break;
        }
        if(polygon.length<3)continue;
        const [a,b,c]=triangle.vertices,normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
        const point=p=>p.clone().addScaledVector(normal,.0006+layer*.0002).applyMatrix4(modelToPart).sub(scar.position).toArray();
        for(let i=1;i<polygon.length-1;i++)for(const vertex of [polygon[0],polygon[i],polygon[i+1]]){
          vertices.push(...point(vertex));scarPoints.push(...vertex.clone().sub(center).multiplyScalar(1/size).toArray());
        }
      }
      if(!vertices.length)continue;
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
      const options={transparent:true,opacity,side:T.DoubleSide,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2};
      let material;
      if(layer===1){
        geometry.setAttribute('scarPoint',new T.Float32BufferAttribute(scarPoints,3));
        material=new T.ShaderMaterial({...options,
          uniforms:{emberTime:{value:this.clock||0},scarPlanes:{value:planes.map(({normal,roughness})=>normal.clone().multiplyScalar(1/roughness))}},
          vertexShader:`attribute vec3 scarPoint;varying vec3 vScarPoint;
            void main(){vScarPoint=scarPoint;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
          fragmentShader:`uniform float emberTime;uniform vec3 scarPlanes[26];varying vec3 vScarPoint;
            float grain(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
            void main(){
              float radius=0.;for(int i=0;i<26;i++)radius=max(radius,dot(scarPlanes[i],vScarPoint));
              float fade=1.-smoothstep(1.05,1.28,radius);
              float cluster=grain(floor(vScarPoint*12.)),spark=grain(floor(vScarPoint*42.));
              float flicker=.65+.35*sin(emberTime*(3.+cluster*4.)+cluster*60.);
              float ember=smoothstep(.58,.94,spark)*smoothstep(.18,.55,cluster)*flicker;
              vec3 red=mix(vec3(.85,.008,.001),vec3(1.,.24,.012),ember);
              gl_FragColor=vec4(red,fade*(.3+.65*ember));
            }`
        });
        material.userData.damageEmbers=true;
      }else material=new T.MeshBasicMaterial({color,...options});
      const mark=new T.Mesh(geometry,material);mark.userData.scorch=true;scar.add(mark);
    }
    if(!scar.children.length)return;
    owner.add(scar);ship.userData.scars.push(scar);if(ship.userData.scars.length>80)this.disposeScar(ship.userData.scars.shift());return scar;
  }
  syncNacelles(ship,state){
    for(const [side,nacelle] of Object.entries(ship.userData.nacelles||{})){
      const attached=!state.detachedNacelles?.[side];nacelle.visible=attached;
      const pylon=ship.userData.breakupParts.find(part=>part.userData.pylonSide===side);if(pylon)pylon.visible=attached;
      if(!attached)this.scarNacelleMount(ship,side);
      else if(ship.userData.mountScars?.[side]){const scar=ship.userData.mountScars[side];this.disposeScar(scar);ship.userData.scars=ship.userData.scars.filter(item=>item!==scar);delete ship.userData.mountScars[side];}
    }
  }
  scarNacelleMount(ship,side){
    const T=this.T,u=ship.userData;u.mountScars??={};if(u.mountScars[side]?.parent)return;
    const pylon=u.breakupParts.find(part=>part.userData.pylonSide===side),base=pylon?.userData.attachmentPoint;if(!base)return;
    const direction=new T.Vector3(side==='port'?-.475:.475,.46,.22).normalize(),anchor=new T.Vector3(base.x,base.y,base.z);
    const origin=u.model.localToWorld(anchor.clone().addScaledVector(direction,.35)),aim=u.model.localToWorld(anchor.clone()),contact=this.traceHull(ship,origin,aim);
    const point=contact?u.model.worldToLocal(contact.point.clone()):anchor;
    const normal=contact?contact.normal.clone().transformDirection(u.model.matrixWorld.clone().invert()):direction;
    const scar=this.addImpactScar(ship,'torpedo',{point,normal});if(scar){scar.userData.mountSide=side;u.mountScars[side]=scar;}
  }
  detachNacelle(name,side){
    const T=this.T,ship=this.ships[name],u=ship.userData,part=u.nacelles?.[side];
    if(!part||u.detachedVisuals.has(side))return;
    const state=name==='Enterprise'?this.sim.player:this.sim.enemy;
    if(state.name)this.syncWeaponShip(state);ship.updateMatrixWorld(true);u.detachedVisuals.add(side);
    const piece=part.clone(true);piece.visible=true;
    piece.position.copy(part.getWorldPosition(new T.Vector3()));part.getWorldQuaternion(piece.quaternion);piece.scale.copy(part.getWorldScale(new T.Vector3()));
    const pylon=u.breakupParts.find(candidate=>candidate.userData.pylonSide===side);
    if(pylon){
      const support=pylon.clone(true);support.visible=true;piece.updateMatrixWorld(true);
      const local=piece.matrixWorld.clone().invert().multiply(pylon.matrixWorld);
      local.decompose(support.position,support.quaternion,support.scale);piece.add(support);pylon.visible=false;
    }
    piece.traverse(mesh=>{if(mesh.geometry)mesh.geometry=new T.BufferGeometry().copy(mesh.geometry);if(mesh.material)mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>this.cloneHullMaterial(m)):this.cloneHullMaterial(mesh.material);});
    part.visible=false;
    const sign=side==='port'?-1:1,forward=Battle.direction(state),outward=new T.Vector3(sign*35,-12,8).applyQuaternion(ship.quaternion);
    const velocity=new T.Vector3(forward.x,forward.y,forward.z).multiplyScalar(state.speed||0).add(outward);
    this.scene.add(piece);this.effects.push({object:piece,kind:'nacelle-debris',ship:name,side,life:0,max:30,velocity,spin:new T.Vector3(.12,sign*.16,sign*.22)});
    this.burst(piece.position,0xff793c,35);
  }
  breakApart(name){
    this.destroyedShips??=new Set();if(this.destroyedShips.has(name))return;this.destroyedShips.add(name);
    const T=this.T,ship=this.ships[name],state=name==='Enterprise'?this.sim.player:this.sim.enemy;
    if(state.name)this.syncWeaponShip(state);ship.updateMatrixWorld(true);ship.visible=false;this.destructionFocus=name;this.shake=1.1;
    const origin=ship.position.clone(),forward=Battle.direction(state),drift=new T.Vector3(forward.x,forward.y,forward.z).multiplyScalar(state.speed*.35);
    let seed=name==='Enterprise'?7123:1947;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const register=(object,velocity,spin)=>{this.scene.add(object);this.effects.push({object,kind:'debris',life:0,max:8,velocity,spin});};
    for(const part of ship.userData.breakupParts){
      if(!part.visible)continue;
      const piece=part.clone(true);piece.position.copy(part.getWorldPosition(new T.Vector3()));part.getWorldQuaternion(piece.quaternion);piece.scale.copy(part.getWorldScale(new T.Vector3()));
      piece.traverse(mesh=>{if(mesh.geometry)mesh.geometry=new T.BufferGeometry().copy(mesh.geometry);if(mesh.material){mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>this.cloneHullMaterial(m)):this.cloneHullMaterial(mesh.material);for(const material of [].concat(mesh.material)){material.color?.multiplyScalar(.7);material.emissive?.setRGB(.6,.09,.005);}}});
      const outward=piece.position.clone().sub(origin);if(outward.length()<1)outward.set(random()-.5,random()-.5,random()-.5);
      register(piece,outward.normalize().multiplyScalar(35+random()*45).add(drift),new T.Vector3(random()-.5,random()-.5,random()-.5).multiplyScalar(1.1));
    }
    for(let i=0;i<18;i++){
      const shard=new T.Mesh(new T.BoxGeometry(3+random()*6,1+random()*3,3+random()*8),new T.MeshStandardMaterial({color:0x42464a,roughness:.85,emissive:0x8b2507}));
      shard.position.copy(origin).add(new T.Vector3(random()-.5,random()-.5,random()-.5).multiplyScalar(45));
      register(shard,new T.Vector3(random()-.5,random()-.5,random()-.5).normalize().multiplyScalar(50+random()*75).add(drift),new T.Vector3(random()-.5,random()-.5,random()-.5).multiplyScalar(3));
    }
    this.burst(origin,0xffa14c,180);
    const object=new T.Group();this.scene.add(object);
    const centers=[.2,.45,.7,1.0].map(at=>({at,position:origin.clone().add(new T.Vector3(random()-.5,random()-.5,random()-.5).multiplyScalar(85))}));
    this.effects.push({object,kind:'detonations',life:0,max:Battle.DESTRUCTION_DURATION,centers});
  }
  advanceDebris(effect,dt){
    effect.object.position.addScaledVector(effect.velocity,dt);effect.object.rotation.x+=effect.spin.x*dt;effect.object.rotation.y+=effect.spin.y*dt;effect.object.rotation.z+=effect.spin.z*dt;
    effect.object.traverse(mesh=>{for(const material of [].concat(mesh.material||[])){material.emissive?.multiplyScalar(Math.exp(-dt*2));if(material.uniforms?.emberTime)material.uniforms.emberTime.value+=dt;}});
  }
  burst(position,color,count){
    const T=this.T,positions=new Float32Array(count*3),velocity=[];for(let i=0;i<count;i++)velocity.push(new T.Vector3((Math.random()-.5)*100,(Math.random()-.5)*100,(Math.random()-.5)*100));
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));const points=new T.Points(geo,new T.PointsMaterial({map:this.glowMap(),color,size:9,transparent:true,opacity:1,depthWrite:false,blending:T.AdditiveBlending}));points.position.copy(position);this.scene.add(points);this.effects.push({object:points,velocity,life:0,max:1.4,kind:'burst'});
    const flash=new T.Sprite(new T.SpriteMaterial({map:this.glowMap(),color,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));flash.position.copy(position);flash.scale.setScalar(count>50?140:45);this.scene.add(flash);this.effects.push({object:flash,life:0,max:.65,kind:'flash'});
  }
  glowMap(){if(this.glow)return this.glow;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.1,'#fff');g.addColorStop(.25,'#ffffff90');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,64,64);return this.glow=this.texture(c);}
  disposeEffect(effect){this.scene.remove(effect.object);effect.object.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of [].concat(o.material))m.dispose();}});}
  updateStationRotation(){if(this.station)this.station.rotation.y=(this.sim.time||0)*Battle.K7_ROTATION_RATE;}
  update(dt,snap=false){
    const T=this.T,sim=this.sim,p=sim.player,e=sim.enemy;this.clock+=dt;
    this.updateStationRotation();
    if(!sim.replayShot&&this.mode!=='tactical'&&this.camera.zoom!==1){this.camera.zoom=1;this.camera.updateProjectionMatrix();}
    for(const [name,state] of [['Enterprise',p],['Yorktown',e]]){
      const ship=this.ships[name],pose=sim.replayShot&&sim.replayPoses?.[name]||state;this.syncNacelles(ship,state);this.updateEngineTrails(ship,state);ship.position.set(state.x,state.y,state.z);ship.rotation.order='YXZ';ship.rotation.set(pose.pitch*Math.PI/180,-pose.heading*Math.PI/180,pose.bank||0,'YXZ');
      ship.visible=state.hull>0;const u=ship.userData;
      u.model.rotation.z=!sim.replayShot&&state.hull<25?Math.sin(this.clock*.6)*.03:0;
      u.engineGlows.forEach(o=>o.material.color.setHex(state.integrity.engines<20?0x553323:0x8ae4ff));
      u.damageGlows.forEach((o,i)=>{o.material.opacity=state.hull<(85-i*10)?(.4+Math.sin(this.clock*7+i)*.3):0;});
      for(const scar of u.scars)for(const layer of scar.children)if(layer.material?.uniforms?.emberTime)layer.material.uniforms.emberTime.value=this.clock;
    }
    if(this.sunLight){this.sunLight.intensity=sim.replayShot?3.8:3.4;this.rimLight.intensity=sim.replayShot?2.2:2.7;this.warmLight.intensity=sim.replayShot?.35:1.3;}
    this.nebula.visible=sim.environment==='nebula'&&!sim.replayShot;this.nebula.position.copy(this.ships.Enterprise.position);this.stars.position.copy(this.ships.Enterprise.position);
    const targetPos=new T.Vector3(),camPos=new T.Vector3(),forward=new T.Vector3(...Object.values(Battle.direction(p))),q=this.ships.Enterprise.quaternion;
    if(sim.replayShot){snap=this.replayCamera(camPos,targetPos)||snap;
    }else if(this.mode==='forward'){
      camPos.copy(this.ships.Enterprise.position).add(new T.Vector3(0,30,-90).applyQuaternion(q));targetPos.copy(camPos).addScaledVector(forward,1000);this.ships.Enterprise.visible=false;
    }else if(this.mode==='tactical'){
      this.tacticalCamera(camPos,targetPos);
    }else{
      this.chaseCamera(camPos,targetPos);
    }
    if(sim.result&&!sim.replayShot&&this.destructionFocus){
      const debris=this.effects.filter(effect=>effect.kind==='debris');
      targetPos.copy(this.ships[this.destructionFocus].position);
      if(debris.length){targetPos.set(0,0,0);for(const piece of debris)targetPos.add(piece.object.position);targetPos.multiplyScalar(1/debris.length);}
      const spread=debris.reduce((radius,piece)=>Math.max(radius,piece.object.position.distanceTo(targetPos)),0);
      const distance=Math.max(390,(spread+70)/Math.sin(this.framingFov*Math.PI/360)/Math.min(1,this.framingAspect));
      camPos.copy(targetPos).add(new T.Vector3(220,120,300).normalize().multiplyScalar(distance));
    }
    else if(!sim.replayShot)this.frameCloseEngagement(camPos,targetPos);
    this.trackFreeFlightCamera(camPos,targetPos);
    if(sim.freeFlight)this.shake=0;
    if(sim.replayShot){
      this.gameplayCameraOffset=null;
      this.trackReplayCamera(camPos,targetPos,sim.replayShot.frameDt??dt,snap);
    }else if(!this.trackGameplayCamera(camPos,dt,snap)){
      if(snap||this.mode==='tactical')this.camera.position.copy(camPos);else this.camera.position.lerp(camPos,1-Math.exp(-dt*5));
    }
    this.shake=Math.max(0,this.shake-dt);if(this.shake>0&&!sim.replayShot)this.camera.position.add(new T.Vector3(Math.sin(this.clock*100),Math.cos(this.clock*119),0).multiplyScalar(this.shake*1.4));
    if(sim.replayShot)this.keepReplayScreenDirection(this.camera.position,targetPos);
    this.keepCameraOutsidePlanet();this.camera.lookAt(targetPos);this.camera.updateMatrixWorld();this.frameEnterpriseLow();this.applyReplayDrift();this.updateRedSun();
    const active=new Set();for(const t of sim.projectiles){active.add(t.id);let o=this.projectiles.get(t.id);if(!o){o=new T.Sprite(new T.SpriteMaterial({map:this.glowMap(),color:t.from==='Enterprise'?0xffbe77:0xff6555,depthWrite:false,blending:T.AdditiveBlending}));o.scale.setScalar(22);this.scene.add(o);this.projectiles.set(t.id,o);}o.position.set(t.pos.x,t.pos.y,t.pos.z);}
    for(const [id,o] of this.projectiles)if(!active.has(id)){this.scene.remove(o);o.material.dispose();this.projectiles.delete(id);}
    for(const fx of [...this.effects]){
      fx.life+=dt;const t=fx.life/fx.max;
      if(fx.kind==='debris'||fx.kind==='nacelle-debris')this.advanceDebris(fx,dt);
      if(fx.kind==='detonations')while(fx.centers.length&&fx.centers[0].at<=fx.life)this.burst(fx.centers.shift().position,0xff843b,90);
      if(t>=1){this.disposeEffect(fx);this.effects.splice(this.effects.indexOf(fx),1);continue;}
      if(fx.kind==='burst'){const a=fx.object.geometry.attributes.position;fx.velocity.forEach((v,i)=>a.setXYZ(i,v.x*fx.life,v.y*fx.life,v.z*fx.life));a.needsUpdate=true;fx.object.material.opacity=1-t;}
      if(fx.kind==='warp')fx.object.material.opacity=(1-t)*.8;
      if(fx.kind==='scan'){fx.object.scale.setScalar(30+t*1400);fx.object.material.opacity=(1-t)*.22;}
      if(fx.kind==='flash'){fx.object.material.opacity=1-t;fx.object.scale.multiplyScalar(1+dt*.5);}
      if(fx.kind==='beam'){
        // Keep sustained beams attached as both ships maneuver during the burst.
        const {start,end}=this.weaponEndpoints(fx.from,fx.to,fx.hit,fx.missed),vector=end.clone().sub(start),length=vector.length(),midpoint=start.clone().lerp(end,.5);
        for(const mesh of fx.object.children){mesh.position.copy(midpoint);mesh.scale.y=length/fx.baseLength;if(length>0)mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vector.clone().normalize());}
        const pulse=.85+.15*Math.sin(fx.life*90),fade=Math.min(1,fx.life/.035)*Math.pow(1-t,.45);
        fx.object.children.forEach((o,i)=>{o.material.opacity=[.2,.8,1][i]*fade*pulse;o.scale.x=o.scale.z=1+Math.sin(fx.life*70)*.12;});
      }
    }
    this.updateSpatialGuides();this.updateTacticalPaths();
    this.renderer.render(this.scene,this.camera);
  }
  project(state){const v=new this.T.Vector3(state.x,state.y,state.z).project(this.camera);return {x:(v.x+1)/2,y:(1-v.y)/2,visible:v.z<1&&v.z>-1&&Math.abs(v.x)<.92&&Math.abs(v.y)<.88};}
  keepCameraOutsidePlanet(){
    const body=this.sim.planet;if(!body)return;
    const center=new this.T.Vector3(body.x,body.y,body.z),offset=this.camera.position.clone().sub(center),radius=body.radius+body.atmosphere+10;
    if(offset.length()<radius){if(offset.length()<.001)offset.set(0,1,0);this.camera.position.copy(center).add(offset.normalize().multiplyScalar(radius));}
  }
  clearTransientEffects(){for(const fx of this.effects)this.disposeEffect(fx);this.effects=[];for(const o of this.projectiles.values()){this.scene.remove(o);o.material.dispose();}this.projectiles.clear();this.shake=0;}
  clearReplayTransient(){
    for(const effect of this.effects)this.disposeEffect(effect);this.effects=[];
    for(const object of this.projectiles.values()){this.scene.remove(object);object.material.dispose();}this.projectiles.clear();
    this.replayReactions=[];this.replayDetail=null;this.shake=0;
  }
  reset(){this.destroyedShips=new Set();this.destructionFocus=null;for(const fx of this.effects)this.disposeEffect(fx);this.effects=[];for(const o of this.projectiles.values()){this.scene.remove(o);o.material.dispose();}this.projectiles.clear();for(const s of Object.values(this.ships)){for(const scar of s.userData.scars)this.disposeScar(scar);s.userData.scars=[];s.userData.mountScars={};s.userData.detachedVisuals?.clear();for(const part of [...Object.values(s.userData.nacelles||{}),...s.userData.breakupParts.filter(part=>part.userData.pylonSide)])part.visible=true;}this.shake=0;this.setCamera('chase');this.update(0,true);}
};
