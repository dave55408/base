/* Movie-reference silver-green alloy with details projected from the supplied orthos. */
window.ENTERPRISE_MOVIE_HULL_COLOR=0xa9b5aa;
window.createMovieEnterpriseDetailing=T=>{
  if(window.enterpriseMovieMaps)return window.enterpriseMovieMaps;
  const source=createEnterpriseDetailing(T),maps={},base=[169,181,170],jobs=[];
  // WebGL texture storage cannot be resized after the first live frame.
  // Allocate final dimensions before creating any CanvasTexture, including glow.
  const finalSizes={top:[2048,2048],bottom:[2048,2048],deck:[2048,2048],rim:[2048,256],secondary:[1024,2048],nacelle:[1024,2048],neck:[1024,1024],registry:[2048,256],portRegistry:[2048,256],pennant:[2048,256],portPennant:[2048,256]};
  function texture(name,w,h,paint){
    [w,h]=finalSizes[name]||[w,h];
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const c=canvas.getContext('2d');c.fillStyle='#a9b5aa';c.fillRect(0,0,w,h);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
    maps[name]=tex;jobs.push(()=>{paint(c,w,h);tex.needsUpdate=true;});
  }
  function finish(c,w,h,name,keep){
    c.drawImage(source[name].image,0,0,w,h);
    const data=c.getImageData(0,0,w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=(y*w+x)*4,r=data.data[i],g=data.data[i+1],b=data.data[i+2];
      if(!keep(x/w,y/h,r,g,b)){
        // Very fine alloy variation rather than engraved rings and spokes.
        const grain=((x*17+y*31)%13)/13-.5;
        for(let k=0;k<3;k++)data.data[i+k]=base[k]+grain*1.3;
      }
    }c.putImageData(data,0,0);
  }
  texture('top',1536,1536,(c,w,h)=>finish(c,w,h,'top',(x,y,r,g,b)=>{
    const d=Math.hypot(x-.5,y-.5);
    const registry=y<.45&&d>.15&&d<.42&&Math.max(r,g,b)<125;
    const rcs=d>.40&&d<.49&&Math.min(r,g,b)>214;
    const yellow=d<.15&&r>b*1.25&&g>b*1.16;
    return registry||rcs||yellow;
  }));
  texture('bottom',1536,1536,(c,w,h)=>finish(c,w,h,'bottom',(x,y,r,g,b)=>
    Math.abs(y-.5)<.08&&Math.abs(x-.5)>.22&&Math.abs(x-.5)<.41&&Math.max(r,g,b)<115));
  for(const name of ['registry','pennant'])texture(name,name==='registry'?1536:1024,128,(c,w,h)=>finish(c,w,h,name,(x,y,r,g,b)=>
    Math.max(r,g,b)<115||r>g*1.3&&r>b*1.25||r>b*1.25&&g>b*1.15));
  texture('rim',1024,128,()=>{});
  for(const name of ['nacelle','secondary'])texture(name,512,1024,(c,w,h)=>{
    c.strokeStyle='rgba(79,98,84,.10)';c.lineWidth=1;
    for(const y of [h*.10,h*.34,h*.65,h*.89]){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  });
  // The movie shows the small gold ventral service hatch, without the
  // orthographic model's surrounding boxed inspection markings.
  jobs.push(()=>{
    const c=maps.secondary.image.getContext('2d'),temp=document.createElement('canvas');temp.width=512;temp.height=1024;
    const tc=temp.getContext('2d');tc.drawImage(source.secondary.image,0,0,512,1024);
    const ink=tc.getImageData(0,0,512,1024),out=c.getImageData(0,0,512,1024);
    for(let i=0;i<ink.data.length;i+=4){const r=ink.data[i],g=ink.data[i+1],b=ink.data[i+2];if(r>b*1.3&&g>b*1.2&&r>130&&g>100)out.data.set(ink.data.subarray(i,i+3),i);}
    c.putImageData(out,0,0);maps.secondary.needsUpdate=true;
  });
  texture('neck',512,512,(c,w,h)=>{
    c.clearRect(0,0,w,h);c.fillStyle='#243029';
    for(const [x,y] of [[.24,.32],[.34,.32],[.44,.32],[.32,.46],[.42,.46],[.52,.46],[.39,.60],[.49,.60]])c.fillRect(x*w,y*h,12,5);
  });
  texture('inboardChannel',1024,128,(c,w,h)=>{
    c.fillStyle='#a9a9a9';c.fillRect(0,0,w,h);
    c.fillStyle='#6e6e6e';c.beginPath();c.roundRect(4,4,w-8,h-8,20);c.fill();
    c.fillStyle='#404040';c.beginPath();c.roundRect(12,12,w-24,h-24,17);c.fill();
  });
  texture('outerGrille',512,128,(c,w,h)=>{
    c.fillStyle='#707070';c.fillRect(0,0,w,h);c.strokeStyle='#505050';c.lineWidth=2;
    for(let y=8;y<h;y+=8){c.beginPath();c.moveTo(3,y);c.lineTo(w-3,y);c.stroke();}
  });
  texture('secondaryServiceGrille',512,256,(c,w,h)=>{
    c.fillStyle='#a9b5aa';c.fillRect(0,0,w,h);c.fillStyle='#849486';c.beginPath();c.roundRect(10,14,w-20,h-28,12);c.fill();
    c.strokeStyle='#5d7563';c.lineWidth=3;for(let y=31;y<h-20;y+=22){c.beginPath();c.moveTo(26,y);c.lineTo(w-26,y);c.stroke();}
  });
  texture('portPennant',2048,256,()=>{});
  texture('portRegistry',2048,256,()=>{});
  texture('deck',1536,1536,()=>{});
  for(const name of ['top','bottom','rim','deck','secondary','nacelle','neck']){
    const canvas=document.createElement('canvas');canvas.width=maps[name].image.width;canvas.height=maps[name].image.height;
    const c=canvas.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,canvas.width,canvas.height);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;maps[name+'Glow']=tex;
  }
  maps.ready=source.ready.then(()=>{jobs.forEach(job=>job());return applyMovieOrthographicDetails(T,maps).then(()=>applyMovieVectorDetails(T,maps));});
  window.enterpriseMovieMaps=maps;return maps;
};

