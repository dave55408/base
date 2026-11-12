/* Model Two paint/plating layout, with all reference-window layers omitted. */
window.createThirdEnterpriseDetailing=async T=>{
 const source=createMovieEnterpriseDetailing(T);await source.ready;const maps={};
 for(const [name,texture]of Object.entries(source))if(texture?.isTexture){
  const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;
  canvas.getContext('2d').drawImage(texture.image,0,0);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;maps[name]=map;
 }
 maps.referenceWindowLayers={};maps.ventralSaucerInk=false;applyMovieVectorDetails(T,maps);
 // Remove engineering-hull pennants and the red/gold nacelle striping,
 // preserving the dark NCC-1701 lettering in the shared registry decals.
 for(const name of ['pennant','portPennant']){
  const c=maps[name].image.getContext('2d');c.clearRect(0,0,c.canvas.width,c.canvas.height);
 }
 for(const name of ['registry','portRegistry']){
  const c=maps[name].image.getContext('2d'),image=c.getImageData(0,0,c.canvas.width,c.canvas.height),p=image.data;
  for(let i=0;i<p.length;i+=4){const [r,g,b]=p.subarray(i,i+3);if(r>g*1.2&&r>b*1.2||r>b*1.2&&g>b*1.15)p.fill(0,i,i+4);}
  c.putImageData(image,0,0);
 }
 const labels=document.createElement('canvas');labels.width=1024;labels.height=256;const lc=labels.getContext('2d');
 lc.fillStyle='#202624';lc.textAlign='center';lc.font='48px Arial';
 ['1837','1384','705','102'].forEach((text,i)=>{const x=i*256+128;lc.fillRect(x-3,28,6,62);lc.fillText(text,x,150);});
 maps.hullStencils=new T.CanvasTexture(labels);maps.hullStencils.colorSpace=T.SRGBColorSpace;

 Object.assign(maps,{referenceFeatures:[],appearance:'model-two-without-windows',smallWindows:false,pennants:false,photoRevision:2,markingReference:'Model Two gridlines, chevrons and hull paint; windows and pennants omitted',ready:Promise.resolve()});
 return maps;
};
