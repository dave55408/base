/* Model Two paint/plating layout, with all reference-window layers omitted. */
window.createThirdEnterpriseDetailing=async T=>{
 const source=createMovieEnterpriseDetailing(T);await source.ready;const maps={};
 for(const [name,texture]of Object.entries(source))if(texture?.isTexture){
  const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;
  canvas.getContext('2d').drawImage(texture.image,0,0);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;maps[name]=map;
 }
 maps.referenceWindowLayers={};maps.ventralSaucerInk=true;maps.engineeringMaintenanceMarks=false;applyMovieVectorDetails(T,maps);
 // Retain the supplied red-and-gold side pennants and engine registries.
 const labels=document.createElement('canvas');labels.width=1024;labels.height=256;const lc=labels.getContext('2d');
 lc.fillStyle='#202624';lc.textAlign='center';lc.font='48px Arial';
 ['1837','1384','705','102'].forEach((text,i)=>{const x=i*256+128;lc.fillRect(x-3,28,6,62);lc.fillText(text,x,150);});
 maps.hullStencils=new T.CanvasTexture(labels);maps.hullStencils.colorSpace=T.SRGBColorSpace;

 Object.assign(maps,{referenceFeatures:[],appearance:'model-two-without-windows',smallWindows:false,pennants:true,photoRevision:2,markingReference:'Model Two gridlines, chevrons and hull paint; windows omitted; supplied engine and hull pennants restored',ready:Promise.resolve()});
 return maps;
};
