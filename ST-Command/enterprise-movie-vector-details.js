/* Smooth hull and window layers; reference markings are applied separately. */
window.applyMovieVectorDetails=(T,maps)=>{
  const base='#a9b5aa';
  const sizes={top:[2048,2048],bottom:[2048,2048],deck:[2048,2048],rim:[2048,256],secondary:[1024,2048],nacelle:[1024,2048],neck:[1024,1024]};
  for(const [name,[w,h]] of Object.entries(sizes)){
    const canvas=maps[name].image;canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
    if(name!=='neck'){c.fillStyle=base;c.fillRect(0,0,w,h);}
    // The source-space feature layer retains reference window groups at every
    // projection scale; do not threshold and discard them a second time.
    const referenceLayer=maps.referenceWindowLayers?.[name];
    if(referenceLayer)c.drawImage(referenceLayer,0,0,w,h);
    maps[name].needsUpdate=true;
    const glow=maps[name+'Glow'].image;glow.width=w;glow.height=h;const gc=glow.getContext('2d'),light=gc.createImageData(w,h);
    const data=c.getImageData(0,0,w,h).data;
    for(let i=0;i<data.length;i+=4){const on=Math.min(data[i],data[i+1],data[i+2])>214;light.data[i]=light.data[i+1]=light.data[i+2]=on?255:0;light.data[i+3]=255;}
    gc.putImageData(light,0,0);maps[name+'Glow'].needsUpdate=true;
  }
  for(const name of ['registry','portRegistry','pennant','portPennant']){
    const c=maps[name].image.getContext('2d');c.clearRect(0,0,c.canvas.width,c.canvas.height);maps[name].needsUpdate=true;
  }
  applyMovieMarkings(T,maps);
  maps.vectorDetails=true;
};

