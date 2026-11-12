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
   const geometry=mesh.geometry,p=geometry.attributes.position,topology=geometry.userData.hullPanelTopology,coords=[];
   if(topology&&p.count===(topology.segments+1)*topology.rows){
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
  material.userData.hullSurfaceDetail=true;material.userData.hullSurfaceMode=mode;material.userData.hullSurfacePhysical=!!options.physical;
  material.onBeforeCompile=shader=>{
   shader.uniforms.hullPanelTile={value:texture};shader.uniforms.hullPanelStrength=strength;shader.uniforms.hullPanelMode={value:mode};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHullPatternPosition;\nvarying vec2 vHullGridUv;\nattribute vec2 hullSurfaceUv;\nvarying vec2 vHullSurfaceUv;');
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvHullPatternPosition=(modelMatrix*vec4(transformed,1.0)).xyz;\nvHullGridUv=uv;\nvHullSurfaceUv=hullSurfaceUv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    uniform sampler2D hullPanelTile;
    uniform float hullPanelStrength;
    uniform float hullPanelMode;
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
     if(abs(det)<0.00000001)return texture2D(hullPanelTile,vHullSurfaceUv*2.0).r;
     vec2 cellSize=vec2(length((px*gy.y-py*gx.y)/det),length((py*gx.x-px*gy.x)/det));
     if(saucerPitch.y>0.0)cellSize=saucerPitch;
     // Stable variation belongs to a hull cell, never to time or the camera.
     vec2 cell=floor(grid)+vec2(hullPanelMode*37.0,hullPanelMode*19.0);
     float seed=hullPanelRandom(cell);
     vec2 tile=fract(grid)*cellSize/0.0425;
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
    // Blend the reference over bare metal at 25%; keep paint and lettering clean.
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(hullPanelTone),hullPanelWeight);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 hullQ0=dFdx(-vViewPosition),hullQ1=dFdy(-vViewPosition);
    vec3 hullR1=cross(hullQ1,normal),hullR2=cross(normal,hullQ0);
    float hullDet=dot(hullQ0,hullR1);
    // Shallow relief keeps panel seams in the same tonal range as the hull grid.
    normal=normalize(abs(hullDet)*normal-sign(hullDet)*(dFdx(hullPanelHeight)*hullR1+dFdy(hullPanelHeight)*hullR2)*0.00008*hullPanelWeight);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.54-0.08*hullPanelHeight,hullPanelWeight*0.35);');
  };
  material.customProgramCacheKey=()=> 'movie-hull-panels-curved-handmade-v14'+(options.bareMetal?'-bare':'');material.needsUpdate=true;
 }
 return window.enterpriseHullSurfaceDetail={texture,ready,apply,prepare,strength};
};
