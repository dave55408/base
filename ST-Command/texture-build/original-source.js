/* Markings sampled from the supplied 1672 x 941 orthographic sheet.
   Remove baked lighting; preserve its actual ink, window groups and stencils.
   Nacelle dome materials and animation remain independent. */
window.ENTERPRISE_HULL_COLOR=0x9eafa4;
window.createEnterpriseDetailing=T=>{
  if(window.enterpriseMarkingMaps)return window.enterpriseMarkingMaps;
  const base=[158,175,164],maps={},jobs=[];let sample;
  function map(name,w,h,paint){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const c=canvas.getContext('2d');c.fillStyle='#9eafa4';c.fillRect(0,0,w,h);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    maps[name]=texture;jobs.push(()=>{paint(c,w,h);texture.needsUpdate=true;});
  }
  function pixels(c,w,h,project){
    const data=c.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=project(x,y,w,h),rgb=p?sample(...p):base,i=(y*w+x)*4;
      data.data.set(rgb,i);data.data[i+3]=255;
    }c.putImageData(data,0,0);
  }
  for(const [name,cy,r] of [['top',194,166.5],['bottom',744,164.5]]){
    map(name,1536,1536,(c,w,h)=>pixels(c,w,h,(x,y)=>{
      const dx=(x/w-.5)*1.38/.68*r,dy=(y/h-.5)*1.38/.68*r;
      const sx=1038-dy,sy=cy+dx;
      if(name==='top'&&Math.abs(sx-1038)<6&&(Math.abs(sy-38)<7||Math.abs(sy-347)<7))return null;
      return [sx,sy];
    }));
  }
  map('rim',1536,128,(c,w,h)=>pixels(c,w,h,(x,y)=>{
    const a=x/w*Math.PI*2,rx=.68*Math.sin(a),rz=.68*Math.cos(a),localY=.025-y/h*.029;
    const sy=427-localY*230;
    if(Math.abs(rx)>Math.abs(rz))return [1045-rz*250,sy];
    return [rz<0?1463-rx*246:198+rx*246,sy];
  }));
  function cylinder(name,lo,hi,secondary){
    const profile=secondary?[[.13,-1.19],[.154,-1.05],[.148,-.75],[.135,-.48],[.119,-.24],[.102,0]]:[[.087,-.8],[.087,.64],[.068,.78]];
    map(name,768,1536,(c,w,h)=>pixels(c,w,h,(x,y)=>{
      const a=x/w*Math.PI*2,z=hi-y/h*(hi-lo);let r=profile[0][0];
      for(let i=1;i<profile.length;i++)if(z>=profile[i-1][1]&&z<=profile[i][1])r=profile[i-1][0]+(profile[i][0]-profile[i-1][0])*(z-profile[i-1][1])/(profile[i][1]-profile[i-1][1]);
      const rx=r*Math.sin(a),ry=-r*Math.cos(a),sx=secondary?665-z*234.5:837-(z+.8)*236;
      if(Math.abs(rx)>Math.abs(ry)){
        const sy=(secondary?525:400)-ry*(secondary?230:213);
        if(!secondary&&sx>531&&sx<780&&Math.abs(sy-400)<10)return null;
        if(secondary&&sx>802&&sx<937&&Math.abs(sy-524)<8)return null;
        return [sx,sy];
      }
      return [sx,(secondary?(ry>0?194:744):(ry>0?86:642))+(ry>0?rx:-rx)*(secondary?230:213)];
    }));
  }
  cylinder('nacelle',-.8,.78,false);cylinder('secondary',-1.19,0,true);
  map('registry',1536,128,(c,w,h)=>pixels(c,w,h,(x,y)=>[534+x/w*243,392+y/h*16]));
  map('pennant',1024,128,(c,w,h)=>pixels(c,w,h,(x,y)=>[804+x/w*132,516+y/h*16]));
  map('neck',512,512,(c,w,h)=>pixels(c,w,h,(x,y)=>[665-(-1.44+x/w*.72)*234.5,525-(.46-y/h*.41)*230]));
  map('inboardChannel',1024,128,(c,w,h)=>{
    c.fillStyle='#718078';c.fillRect(0,0,w,h);c.fillStyle='#303b38';
    c.beginPath();c.roundRect(8,8,w-16,h-16,14);c.fill();
  });
  map('outerGrille',512,128,(c,w,h)=>pixels(c,w,h,(x,y)=>[491+x/w*27,392+y/h*18]));
  const image=new Image();
  maps.ready=new Promise((resolve,reject)=>{
    image.onload=()=>{
      const source=document.createElement('canvas');source.width=1672;source.height=941;
      const c=source.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,1672,941);
      const raw=c.getImageData(0,0,1672,941).data;
      c.filter='blur(8px)';c.drawImage(source,0,0);c.filter='none';
      const background=new Uint8Array(1672*941),queue=new Int32Array(1672*941);let head=0,tail=0;
      function seed(p){if(background[p])return;const i=p*4;if(Math.min(raw[i],raw[i+1],raw[i+2])<229)return;background[p]=1;queue[tail++]=p;}
      for(let x=0;x<1672;x++){seed(x);seed(940*1672+x);}
      for(let y=0;y<941;y++){seed(y*1672);seed(y*1672+1671);}
      while(head<tail){const p=queue[head++],x=p%1672;if(x)seed(p-1);if(x<1671)seed(p+1);if(p>=1672)seed(p-1672);if(p<1672*940)seed(p+1672);}
      const blurred=c.getImageData(0,0,1672,941).data,clean=new Uint8ClampedArray(raw.length);
      for(let i=0;i<raw.length;i+=4){
        const r=raw[i],g=raw[i+1],b=raw[i+2],dark=Math.max(r,g,b)<115;
        const paint=r>g*1.25&&r>b*1.25 || r>b*1.23&&g>b*1.13;
        const white=Math.min(r,g,b)>216&&r-blurred[i]>8;
        for(let k=0;k<3;k++)clean[i+k]=background[i/4]?base[k]:dark||paint||white?raw[i+k]:base[k]+(raw[i+k]-blurred[i+k])*.9;
        clean[i+3]=255;
      }
      sample=(x,y)=>{const i=(Math.max(0,Math.min(940,Math.round(y)))*1672+Math.max(0,Math.min(1671,Math.round(x))))*4;return clean.subarray(i,i+3);};
      jobs.forEach(job=>job());resolve();
    };
    image.onerror=()=>reject(new Error('Enterprise reference marking sheet failed to load'));
    image.src=window.ENTERPRISE_MARKING_SHEET||'assets/reference/enterprise-model-sheet.png';
  });
  window.enterpriseMarkingMaps=maps;return maps;
};

