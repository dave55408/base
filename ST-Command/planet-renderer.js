/* A lit, rotating globe. Surface longitude advances while the limb stays fixed. */
window.createDetailedPlanet = () => {
  const tw=3072,th=1536,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let seed=1701;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function field(scales,weights,stretch=1){
    const canvas=document.createElement('canvas');canvas.width=tw;canvas.height=th;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,tw,th);ctx.globalCompositeOperation='lighter';
    scales.forEach((n,j)=>{
      const small=document.createElement('canvas');small.width=n+1;small.height=Math.ceil(n/2*stretch)+1;
      const sc=small.getContext('2d'),pixels=sc.createImageData(small.width,small.height);
      for(let y=0;y<small.height;y++)for(let x=0;x<=n;x++){
        const i=(y*small.width+x)*4,value=x===n?pixels.data[y*small.width*4]:Math.floor(random()*256);
        pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;
      }
      sc.putImageData(pixels,0,0);ctx.globalAlpha=weights[j];ctx.drawImage(small,-tw/n/2,-th/(small.height-1)/2,tw+tw/n,th+th/(small.height-1));
    });
    return ctx.getImageData(0,0,tw,th).data;
  }
  const continents=field([4,8,16,32,64,128,256],[.42,.26,.14,.08,.05,.03,.02]);
  const detail=field([32,64,128,256,512,1024],[.3,.25,.18,.13,.09,.05]);
  const weather=field([12,24,48,96,192,384],[.35,.26,.17,.11,.07,.04],5);
  const surface=new Uint8ClampedArray(tw*th*3),cloudOpacity=new Uint8ClampedArray(tw*th);
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
    const p=y*tw+x,i=p*4,k=p*3,lat=Math.abs(y/th*2-1),e=(continents[i]-124)/64,d=detail[i]/255;
    let r,g,b;
    if(e<0){const shelf=Math.exp(e*18);r=12+shelf*22;g=43+shelf*43;b=77+shelf*34;}
    else{
      const mountain=clamp((d-.47)*5+e*.8),dry=clamp(e*2.1+(d-.5)*.7),snow=clamp((lat-.8)*9+mountain*1.5-.65);
      r=53+dry*75+mountain*24;g=89+dry*27+mountain*18;b=47+dry*38+mountain*32;
      const relief=clamp(.83+(detail[i]-detail[Math.max(0,i-4)])*.055,.5,1.15);r*=relief;g*=relief;b*=relief;
      r=r*(1-snow)+220*snow;g=g*(1-snow)+230*snow;b=b*(1-snow)+235*snow;
    }
    const ice=clamp((lat-.94)*20);r=r*(1-ice)+220*ice;g=g*(1-ice)+231*ice;b=b*(1-ice)+237*ice;
    cloudOpacity[p]=clamp((weather[i]/255-.51)*6.2+(d-.5)*.16)*.52*255;
    surface[k]=r;surface[k+1]=g;surface[k+2]=b;
  }
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  let frame,longitude,latitude,lighting,rim,lastTime=-Infinity,lastWidth=0,lastHeight=0,lastColor=null,lastPitch=null,lastLayout='';
  const speed=.0128; // Left-and-down rotation; one revolution in about 8 minutes.
  const contrast=value=>clamp((value-80)*1.3+80,0,255);
  function prepare(w,h,pitch,globe=null){
    canvas.width=w;canvas.height=h;frame=ctx.createImageData(w,h);
    const count=w*h;longitude=new Float32Array(count);latitude=new Uint32Array(count);lighting=new Float32Array(count);rim=new Float32Array(count);
    const down=clamp(-pitch/85),radius=globe?globe.radius:w*.78*(1+down*.25),cx=globe?globe.cx:w*.18;
    const cy=globe?globe.cy:h+radius*.69+pitch/85*h*1.8,tilt=.5,cos=Math.cos(tilt),sin=Math.sin(tilt);
    const axis=40*Math.PI/180,axisCos=Math.cos(axis),axisSin=Math.sin(axis);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const nx=(x-cx)/radius,ny=(y-cy)/radius,rr=nx*nx+ny*ny,p=y*w+x;if(rr>=1)continue;
      const nz=Math.sqrt(1-rr),rx=nx*axisCos-ny*axisSin,ry=nx*axisSin+ny*axisCos;
      const sy=ry*cos+nz*sin,sz=nz*cos-ry*sin;
      longitude[p]=Math.atan2(rx,sz)/(Math.PI*2)+.5;
      latitude[p]=Math.min(th-1,Math.floor((Math.asin(sy)/Math.PI+.5)*th))*tw;
      lighting[p]=clamp(.59-nx*.3-ny*.33+nz*.26,.13,1.13);rim[p]=Math.pow(1-nz,5)*.7;
      frame.data[p*4+3]=Math.round(clamp((1-rr)*radius)*255);
    }
  }
  function draw(target,w,h,time,iconColor=0x83c8ff,pitch=0,globe=null){
    const rw=Math.min(1920,Math.round(w)),rh=Math.round(h*rw/w);
    const layout=globe?`${globe.cx}/${globe.cy}/${globe.radius}`:'',layoutChanged=layout!==lastLayout;
    const viewPitch=Math.round(clamp(pitch,-85,85)*2)/2,resized=rw!==lastWidth||rh!==lastHeight;
    if(resized||layoutChanged||Math.abs(time-lastTime)>=1/20||iconColor!==lastColor||viewPitch!==lastPitch){
      if(resized||layoutChanged||viewPitch!==lastPitch){prepare(rw,rh,viewPitch,globe?{cx:globe.cx*rw/w,cy:globe.cy*rw/w,radius:globe.radius*rw/w}:null);lastWidth=rw;lastHeight=rh;lastPitch=viewPitch;lastLayout=layout;}
      const red=(iconColor>>16)&255,green=(iconColor>>8)&255,blue=iconColor&255,max=Math.max(1,red,green,blue);
      const tr=.12+.88*red/max,tg=.12+.88*green/max,tb=.12+.88*blue/max;
      const turn=time*speed/(Math.PI*2),out=frame.data;
      for(let p=0;p<longitude.length;p++){
        const i=p*4;if(!out[i+3])continue;
        const u=((longitude[p]+turn)%1+1)%1*tw,x=Math.floor(u),f=u-x,a=(latitude[p]+x)*3,b=(latitude[p]+(x+1)%tw)*3,light=lighting[p],haze=rim[p];
        // Deepen oceans and bring out terrain relief before tinting and clouds.
        const r=contrast(surface[a]*(1-f)+surface[b]*f),g=contrast(surface[a+1]*(1-f)+surface[b+1]*f),bv=contrast(surface[a+2]*(1-f)+surface[b+2]*f);
        const luminance=.2126*r+.7152*g+.0722*bv;
        const cloud=(cloudOpacity[a/3]*(1-f)+cloudOpacity[b/3]*f)/255;
        out[i]=((.12*r+.88*luminance)*tr*1.2*(1-cloud)+(222+red*.08)*cloud)*light*(1-haze)+(red*.8+35)*haze;
        out[i+1]=((.12*g+.88*luminance)*tg*1.2*(1-cloud)+(222+green*.08)*cloud)*light*(1-haze)+(green*.8+35)*haze;
        out[i+2]=((.12*bv+.88*luminance)*tb*1.2*(1-cloud)+(222+blue*.08)*cloud)*light*(1-haze)+(blue*.8+35)*haze;
      }
      ctx.putImageData(frame,0,0);lastTime=time;lastColor=iconColor;
    }
    target.drawImage(canvas,0,0,w,h);
  }
  return {draw,drawGlobe:(target,w,h,time,color,layout)=>draw(target,w,h,time,color,0,layout),rotationSpeed:speed};
};
