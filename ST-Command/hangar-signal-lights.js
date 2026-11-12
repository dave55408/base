/* Self-lit hangar lamps with soft, depth-tested halos on the aft face. */
window.addHangarSignalGlow=(T,lamp,color,width,height,depth=.002)=>{
 if(lamp.geometry.type==='SphereGeometry'){
  lamp.material=lamp.material.clone();lamp.material.color.setHex(color);lamp.material.emissive.setHex(color);lamp.material.emissiveIntensity=1.8;
 }else lamp.material=new T.MeshBasicMaterial({color,toneMapped:false});
 if(!addHangarSignalGlow.texture){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  const gradient=c.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.28,'rgba(255,255,255,.65)');gradient.addColorStop(.6,'rgba(255,255,255,.18)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=gradient;c.fillRect(0,0,128,128);addHangarSignalGlow.texture=new T.CanvasTexture(canvas);
 }
 const halo=new T.Mesh(new T.PlaneGeometry(width*2,height*4),new T.MeshBasicMaterial({map:addHangarSignalGlow.texture,color,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
 halo.name=lamp.name+'-glow';halo.position.copy(lamp.position);halo.position.z+=depth/2+.0003;halo.renderOrder=10;lamp.parent.add(halo);
 return lamp;
};
