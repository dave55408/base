/* ST-Command hull finish; view distance adjusted to ST Battle model scale. */
/* Fine pylon mesh with a dark inner bevel and a shallow recessed center. */
window.createRecessedPylonGrilleMaterial=T=>{
 const face=document.createElement('canvas'),height=document.createElement('canvas');face.width=face.height=height.width=height.height=512;
 const c=face.getContext('2d'),h=height.getContext('2d');
 c.fillStyle='#b0b0b0';c.fillRect(0,0,512,512);h.fillStyle='#b0b0b0';h.fillRect(0,0,512,512);
 const bevel=c.createLinearGradient(0,0,512,512);bevel.addColorStop(0,'#363636');bevel.addColorStop(.5,'#626262');bevel.addColorStop(1,'#c6c6c6');c.fillStyle=bevel;c.fillRect(9,9,494,494);
 c.fillStyle='#626262';c.fillRect(22,22,468,468);h.fillStyle='#303030';h.fillRect(22,22,468,468);
 for(const ctx of [c,h]){ctx.save();ctx.beginPath();ctx.rect(22,22,468,468);ctx.clip();ctx.strokeStyle=ctx===c?'#a5a5a5':'#555555';ctx.lineWidth=3;ctx.beginPath();for(let n=22;n<=490;n+=13){ctx.moveTo(n,22);ctx.lineTo(n,490);ctx.moveTo(22,n);ctx.lineTo(490,n);}ctx.stroke();ctx.restore();}
 const map=new T.CanvasTexture(face);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;const bump=new T.CanvasTexture(height);bump.anisotropy=8;
 return new T.MeshStandardMaterial({color:0xc2c2c2,map,bumpMap:bump,bumpScale:.00045,roughness:.85,metalness:.2,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
};

/* Four pylon panels share a narrow rim and finish below the engine joint. */
window.addPylonGrilleStrip=(T,strut,{side,grilleLength,embed=0,face,material})=>{
 const prefix=side<0?'port':'starboard',count=4,gap=.008,width=.058;
 const originalStart=-grilleLength/2+embed/2+.012,end=grilleLength/2+embed/2-.065;
 const height=(end-originalStart-.003*(count-1))/count;
 // Keep the top panel and every panel's dimensions fixed; spread toward the root.
 const start=originalStart-(gap-.003)*(count-1),center=(start+end)/2;
 const frameMaterial=new T.MeshStandardMaterial({color:0x9ca69c,roughness:.86,metalness:.15,side:T.DoubleSide});
 function outline(w,h,r){const points=[];for(const [x,y,a]of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,Math.PI/2],[-w/2+r,-h/2+r,Math.PI],[w/2-r,-h/2+r,Math.PI*1.5]])for(let n=0;n<=8;n++){const angle=a+n*Math.PI/16;points.push([x+Math.cos(angle)*r,y+Math.sin(angle)*r]);}return points;}
 const outer=outline(width+.012,end-start+.012,.005),inner=outline(width,end-start,.0015),positions=[],indices=[];
 for(let n=0;n<outer.length;n++)for(const p of [outer[n],inner[n]])positions.push(p[0],p[1],0);
 for(let n=0;n<outer.length;n++){const a=n*2,b=((n+1)%outer.length)*2;indices.push(a,b,a+1,a+1,b,b+1);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const frame=new T.Mesh(geometry,frameMaterial);frame.name=prefix+'-strut-top-grille-frame';frame.position.set(-side*(face+.0001),center,0);frame.rotation.y=-side*Math.PI/2;strut.add(frame);
 for(let n=0;n<count;n++){
  const panel=new T.Mesh(new T.PlaneGeometry(width,height,16,4),material);
  panel.position.set(-side*(face+.00025),start+height/2+n*(height+gap),0);panel.rotation.y=-side*Math.PI/2;
  panel.name=prefix+'-strut-top-grille';strut.add(panel);
 }
 strut.userData.pylonGrilleLayout={count,start,end,width,height,gap,engineSetback:.065,sharedFrame:true};
};

/* Riveted plating at half-size, fading in during the shuttle approach. */
window.createMovieHullSurfaceDetail=(T,anisotropy=1)=>{
 if(window.enterpriseHullSurfaceDetail){const layer=window.enterpriseHullSurfaceDetail;layer.texture.anisotropy=Math.max(layer.texture.anisotropy,anisotropy);return layer;}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
 const c=canvas.getContext('2d');c.fillStyle='#808080';c.fillRect(0,0,1024,1024);
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.MirroredRepeatWrapping;
 texture.colorSpace=T.SRGBColorSpace;
 texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.anisotropy=anisotropy;
 const strength={value:1},image=new Image();
 const ready=new Promise((resolve,reject)=>{
  let active=true;const finish=()=>{active=false;image.onload=image.onerror=null;delete texture.userData.cancelLoad;};
  texture.userData.cancelLoad=()=>{if(!active)return;finish();image.src='';resolve();};
  image.onload=()=>{if(!active)return;c.drawImage(image,0,0,1024,1024);texture.needsUpdate=true;finish();resolve();};
  image.onerror=()=>{finish();reject(Error('Hull panel detail tile failed to load'));};image.src=window.ENTERPRISE_HULL_PANEL_TILE;
 });
 // Measure the real mesh surface, including taper, deckhouse deformation and
 // object scale. Generic rounded parts use these coordinates instead of a
 // world-space projection that cuts flat strips through the model.
 function prepare(root){
  root.updateWorldMatrix(true,true);
  root.traverse(mesh=>{
   if(!mesh.isMesh)return;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   if(!materials.some(m=>m.userData.hullSurfaceDetail))return;
   const geometry=mesh.geometry,p=geometry.attributes.position,topology=geometry.userData.hullPanelTopology,mapping=geometry.userData.hullSurfaceMapping,coords=[];
   if(mapping?.kind==='cylinder-z'){
    const normals=geometry.attributes.normal,e=mesh.matrixWorld.elements,sx=Math.hypot(e[0],e[1],e[2]),sy=Math.hypot(e[4],e[5],e[6]),sz=Math.hypot(e[8],e[9],e[10]);
    for(let i=0;i<p.count;i++){
     const x=p.getX(i)-mapping.centerX,y=p.getY(i)-mapping.centerY,z=p.getZ(i),radius=Math.hypot(x,y),radial=(normals.getX(i)*x+normals.getY(i)*y)/radius;
     if(Math.abs(normals.getZ(i))>.5)coords.push(x*sx/.085,y*sy/.085);
     else if(Math.abs(radial)>.7)coords.push(Math.atan2(x,-y)*radius*(sx+sy)/2/.085,z*sz/.085);
     else coords.push(radius*(sx+sy)/2/.085,z*sz/.085);
    }
    geometry.userData.hullPanelMapping='cylindrical-attachment';
   }else if(topology&&p.count===(topology.segments+1)*topology.rows){
    const {segments,rows,kind}=topology,stride=segments+1,points=[],perimeters=[],along=new Float64Array(stride);
    for(let row=0;row<rows;row++){
     const ring=[],lengths=[0];
     for(let i=0;i<=segments;i++){
      const v=new T.Vector3().fromBufferAttribute(p,row*stride+i);
      if(kind==='clamshell'){v.x*=.083;v.y*=.130;v.z*=.048;}else v.applyMatrix4(mesh.matrixWorld);
      ring.push(v);if(i)lengths.push(lengths.at(-1)+v.distanceTo(ring[i-1]));
     }
     points.push(ring);perimeters.push(lengths);
    }
    const repeats=Math.max(2,Math.round(Math.max(...perimeters.map(a=>a.at(-1)))/.085/2)*2);
    for(let row=0;row<rows;row++)for(let i=0;i<=segments;i++){
     if(row)along[i]+=points[row][i].distanceTo(points[row-1][i]);
     let u=perimeters[row].at(-1)>1e-8?perimeters[row][i]/perimeters[row].at(-1)*repeats:i/segments*repeats,v=along[i]/.085;
     if(kind==='clamshell')u=(topology.start+(topology.end-topology.start)*i/segments)/(Math.PI*2)*6;
     if(kind==='aft-fairing'){
      const n=row*stride+i,x=p.getX(n),y=p.getY(n);
      u=(i===segments?1:((Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2))/(Math.PI*2))*8;
      v=-along[i]/(.067*1.19);
     }
     coords.push(u,v);
    }
    geometry.userData.hullPanelMapping=kind;
   }else{
    // The remaining fittings are planar faces, so use their object-local
    // tangent axes. Coordinates stay attached when a fitting moves or rotates.
    const normals=geometry.attributes.normal,physical=materials.some(m=>m.userData.hullSurfacePhysical),e=mesh.matrixWorld.elements;
    const scale=physical?[Math.hypot(e[0],e[1],e[2]),Math.hypot(e[4],e[5],e[6]),Math.hypot(e[8],e[9],e[10])]:[1,1,1];
    for(let i=0;i<p.count;i++){
     const x=p.getX(i)*scale[0],y=p.getY(i)*scale[1],z=p.getZ(i)*scale[2],nx=Math.abs(normals.getX(i)),ny=Math.abs(normals.getY(i)),nz=Math.abs(normals.getZ(i));
     coords.push(...(nx>=ny&&nx>=nz?[z/.085,y/.085]:ny>=nz?[x/.085,z/.085]:[x/.085,y/.085]));
    }
    geometry.userData.hullPanelMapping='local-planar';
   }
   geometry.setAttribute('hullSurfaceUv',new T.Float32BufferAttribute(coords,2));
  });
 }
 function apply(material,mode=0,options={}){
  const tileScale=options.tileScale??1;material.userData.hullPanelTileScale=tileScale;
  material.userData.hullSurfaceDetail=true;material.userData.hullSurfaceMode=mode;material.userData.hullSurfacePhysical=!!options.physical;material.userData.hullPaintUnderlay=options.paintUnderlay||false;material.userData.hullPaintOpacity=options.paintOpacity??1;
  material.onBeforeCompile=shader=>{
   shader.uniforms.hullPanelTile={value:texture};shader.uniforms.hullPanelStrength=strength;shader.uniforms.hullPanelMode={value:mode};shader.uniforms.hullPanelTileScale={value:tileScale};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHullPatternPosition;\nvarying vec2 vHullGridUv;\nattribute vec2 hullSurfaceUv;\nvarying vec2 vHullSurfaceUv;');
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvHullPatternPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\nvHullGridUv=uv;\nvHullSurfaceUv=hullSurfaceUv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    uniform sampler2D hullPanelTile;
    uniform float hullPanelStrength;
    uniform float hullPanelMode;
    uniform float hullPanelTileScale;
    varying vec3 vHullPatternPosition;
    varying vec2 vHullGridUv;
    varying vec2 vHullSurfaceUv;
    float hullPanelRandom(vec2 cell){
     return fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
    }
    float hullPanelWear(vec2 p){
     vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
     return mix(mix(hullPanelRandom(cell),hullPanelRandom(cell+vec2(1.0,0.0)),f.x),
                mix(hullPanelRandom(cell+vec2(0.0,1.0)),hullPanelRandom(cell+vec2(1.0)),f.x),f.y);
    }
    float hullPanelCycle(float x,bool engine){
     float a=engine?0.06:0.067,b=engine?0.20:0.23,c=engine?0.38:0.40,d=engine?0.56:0.58,e=engine?0.75:0.77;
     if(x<a)return x/a;if(x<b)return 1.0+(x-a)/(b-a);if(x<c)return 2.0+(x-b)/(c-b);
     if(x<d)return 3.0+(x-c)/(d-c);if(x<e)return 4.0+(x-d)/(e-d);if(x<0.94)return 5.0+(x-e)/(0.94-e);return 6.0+(x-0.94)/0.06;
    }
    float sampleHullPanel(){
     vec2 p=vHullGridUv,grid=vHullSurfaceUv,saucerPitch=vec2(0.0);
     if(hullPanelMode>0.5&&hullPanelMode<1.5){
      vec2 d=p-0.5;float r=length(d),a=atan(d.x,d.y)/6.28318530718;
      float ring=r<0.10?r/0.10:r<0.46?1.0+(r-0.10)/0.06:7.0+(r-0.46)/0.03;
      grid=vec2(a*32.0,ring);
      // Fix the circumferential pitch at the middle of each ring. Let the
      // existing tile bend gently with the polar grid instead of cancelling
      // its curvature by recomputing a flat physical pitch at every pixel.
      float band=floor(ring),width=band<0.5?0.10:band<7.0?0.06:0.03;
      float middle=band<0.5?0.05:band<7.0?0.10+(band-0.5)*0.06:0.46+(band-6.5)*0.03;
      saucerPitch=vec2(6.28318530718*middle/32.0,width)*1.38;
     }
     if(hullPanelMode>1.5&&hullPanelMode<3.5)grid=vec2(p.x*8.0,hullPanelCycle(1.0-p.y,hullPanelMode>2.5));
     if(hullPanelMode>3.5&&hullPanelMode<4.5)grid=vec2(p.x*32.0,1.0-p.y);
     // Measure each grid coordinate on the actual surface, before wrapping.
     // Rounded fittings keep their measured pitch; saucer cells allow a
     // little stretching so panel rows follow the concentric painted seams.
     vec2 gx=dFdx(grid),gy=dFdy(grid);
     vec3 px=dFdx(vHullPatternPosition),py=dFdy(vHullPatternPosition);
     float det=gx.x*gy.y-gx.y*gy.x;
     if(abs(det)<0.00000001)return texture2D(hullPanelTile,vHullSurfaceUv*2.0*hullPanelTileScale).r;
     vec2 cellSize=vec2(length((px*gy.y-py*gx.y)/det),length((py*gx.x-px*gy.x)/det));
     if(saucerPitch.y>0.0)cellSize=saucerPitch;
     // Stable variation belongs to a hull cell, never to time or the camera.
     vec2 cell=floor(grid)+vec2(hullPanelMode*37.0,hullPanelMode*19.0);
     float seed=hullPanelRandom(cell);
     vec2 tile=fract(grid)*cellSize/0.0425*hullPanelTileScale;
     // Quarter turns and mirrors preserve scale and the grid-aligned edges.
     if(seed>0.5)tile=tile.yx;
     if(hullPanelRandom(cell+17.0)>0.5)tile.x=-tile.x;
     if(hullPanelRandom(cell+43.0)>0.5)tile.y=-tile.y;
     // Reuse the source artwork with different crops and small fitting
     // imperfections. All variation stays attached to its panel in space.
     float angle=(hullPanelRandom(cell+89.0)-0.5)*0.030;
     float cs=cos(angle),sn=sin(angle);
     tile=mat2(cs,-sn,sn,cs)*tile;
     tile*=vec2(0.97+0.06*hullPanelRandom(cell+101.0),0.97+0.06*hullPanelRandom(cell+113.0));
     tile+=vec2(hullPanelRandom(cell+127.0),hullPanelRandom(cell+139.0))*2.0;
     vec2 wander=vec2(hullPanelWear(tile*1.7+cell),hullPanelWear(tile*1.7+cell+29.0))-0.5;
     tile+=wander*0.035;
     float tone=(hullPanelRandom(cell+71.0)-0.5)*0.045;
     float wear=(hullPanelWear(tile*0.8+cell)-0.5)*0.024;
     // Restart at the painted grid: surplus repeats are cropped at cell edges.
     return clamp(texture2D(hullPanelTile,tile).r+tone+wear,0.0,1.0);
    }`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float hullPanelAmount=(1.0-smoothstep(0.50,3.50,length(vViewPosition)))*hullPanelStrength;
    // The alloy's linear-space color mask leaves lettering, lamps and paint intact.
    float hullPanelMask=${options.bareMetal?'1.0':'1.0-smoothstep(0.018,0.065,distance(diffuseColor.rgb,vec3(0.3968,0.4621,0.4020)))'};
    float hullPanelHeight=sampleHullPanel();
    float hullPanelTone=clamp(0.5+(hullPanelHeight-0.5)*1.18,0.0,1.0);
    float hullPanelWeight=0.25*hullPanelAmount*hullPanelMask;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(hullPanelTone),hullPanelWeight);
    // Paint inherits the same plate grain and relief, with its hue preserved.
    float hullPaintRegion=${options.paintUnderlay==='underside'?'1.0-smoothstep(0.16,0.24,min(vHullGridUv.x,1.0-vHullGridUv.x))':options.paintUnderlay==='engine-front-brown'?'smoothstep(0.008,0.035,diffuseColor.r-diffuseColor.g)*smoothstep(0.003,0.018,diffuseColor.g-diffuseColor.b)':options.paintUnderlay?'1.0':'0.0'};
    vec3 hullPaintMetal=mix(vec3(0.3968,0.4621,0.4020),vec3(hullPanelTone),0.25*hullPanelAmount);
    diffuseColor.rgb=mix(diffuseColor.rgb,hullPaintMetal,${(1-(options.paintOpacity??1)).toFixed(3)}*(1.0-hullPanelMask)*hullPaintRegion);
    float hullPaintWeight=${(options.paintUnderlay==='engine-front-brown'||options.paintUnderlay==='coupling-panel')?'0.70':'0.35'}*hullPanelAmount*(1.0-hullPanelMask)*hullPaintRegion;
    diffuseColor.rgb*=mix(1.0,${(options.paintUnderlay==='engine-front-brown'||options.paintUnderlay==='coupling-panel')?'0.40+1.20':'0.65+0.70'}*hullPanelTone,hullPaintWeight);
    hullPanelWeight=max(hullPanelWeight,hullPaintWeight);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 hullQ0=dFdx(-vViewPosition),hullQ1=dFdy(-vViewPosition);
    vec3 hullR1=cross(hullQ1,normal),hullR2=cross(normal,hullQ0);
    float hullDet=dot(hullQ0,hullR1);
    // Shallow relief keeps panel seams in the same tonal range as the hull grid.
    normal=normalize(abs(hullDet)*normal-sign(hullDet)*(dFdx(hullPanelHeight)*hullR1+dFdy(hullPanelHeight)*hullR2)*0.00008*hullPanelWeight);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.54-0.08*hullPanelHeight,hullPanelWeight*0.35);');
  };
  material.customProgramCacheKey=()=> 'movie-hull-panels-curved-handmade-v19'+(options.bareMetal?'-bare':'')+'-paint-'+(options.paintUnderlay||'none')+'-opacity-'+(options.paintOpacity??1);material.needsUpdate=true;
 }
 return window.enterpriseHullSurfaceDetail={texture,ready,apply,prepare,strength};
};
// Separate the flat end caps from the rounded attachment faces so the panel
// coordinates and shading cannot smear across their perpendicular edges.
window.createPlatedPylonShoeGeometry=(T,geometry,centerX,centerY)=>{
 const result=geometry.toNonIndexed();geometry.dispose();result.computeVertexNormals();
 const p=result.attributes.position,n=result.attributes.normal;
 for(let i=0;i<p.count;i++){
  if(Math.abs(n.getZ(i))>.5)continue;
  const x=p.getX(i)-centerX,y=p.getY(i)-centerY,r=Math.hypot(x,y),dot=(n.getX(i)*x+n.getY(i)*y)/r;
  if(Math.abs(dot)>.7)n.setXYZ(i,Math.sign(dot)*x/r,Math.sign(dot)*y/r,0);
 }
 result.userData.hullSurfaceMapping={kind:'cylinder-z',centerX,centerY};return result;
};
