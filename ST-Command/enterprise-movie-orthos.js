/* Detail projection from Image 1444.png (coordinates normalized to 2048x1152).
   Geometry, metal color, nacelle domes and deflector remain movie-specific. */
window.applyMovieOrthographicDetails=async(T,maps)=>{
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Movie orthographic reference failed to load'));image.src=window.ENTERPRISE_MOVIE_ORTHOS;});
  const w=2048,h=1152,base=[169,181,170],canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,w,h);
  const raw=c.getImageData(0,0,w,h).data;
  c.filter='blur(10px)';c.drawImage(canvas,0,0);c.filter='none';const blurred=c.getImageData(0,0,w,h).data;
  // Remove connected white background; keep enclosed window/RCS markings.
  const background=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  function seed(p){if(background[p])return;const i=p*4;if(Math.min(raw[i],raw[i+1],raw[i+2])<229)return;background[p]=1;queue[tail++]=p;}
  for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
  while(head<tail){const p=queue[head++],x=p%w;if(x)seed(p-1);if(x<w-1)seed(p+1);if(p>=w)seed(p-w);if(p<w*(h-1))seed(p+w);}
  // White lamps/paint are compact enclosed shapes. Large bright regions in
  // this sheet are studio reflections and must never become emissive paint.
  const whiteMask=new Uint8Array(w*h),visited=new Uint8Array(w*h);
  for(let p=0;p<w*h;p++){const i=p*4;if(!background[p]&&Math.min(raw[i],raw[i+1],raw[i+2])>210)whiteMask[p]=1;}
  for(let seed=0;seed<w*h;seed++)if(whiteMask[seed]&&!visited[seed]){
    head=0;tail=1;queue[0]=seed;visited[seed]=1;let minX=w,maxX=0,minY=h,maxY=0;
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const n of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&whiteMask[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}
    }
    if(tail>230||maxX-minX>24||maxY-minY>24)for(let n=0;n<tail;n++)whiteMask[queue[n]]=0;
  }
  // Long dark contours belong to photographed geometry, not hull paint.
  // Retain compact window/stencil components and the explicit large symbols.
  const inkMask=new Uint8Array(w*h);visited.fill(0);
  for(let p=0;p<w*h;p++){const i=p*4,r=raw[i],g=raw[i+1],b=raw[i+2],delta=((r-blurred[i])+(g-blurred[i+1])+(b-blurred[i+2]))/3;if(!background[p]&&(Math.max(r,g,b)<35||Math.max(r,g,b)<140&&delta< -14))inkMask[p]=1;}
  for(let seed=0;seed<w*h;seed++)if(inkMask[seed]&&!visited[seed]){
    head=0;tail=1;queue[0]=seed;visited[seed]=1;let minX=w,maxX=0,minY=h,maxY=0;
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const n of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&inkMask[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}
    }
    const undersideSymbol=minX>1290&&maxX<1380&&minY>748&&maxY<1070;
    const nacelleHatch=minX>805&&maxX<910&&(minY>758&&maxY<801||minY>1017&&maxY<1065);
    if(!undersideSymbol&&!nacelleHatch&&(tail>500||maxX-minX>50||maxY-minY>50))for(let n=0;n<tail;n++)inkMask[queue[n]]=0;
  }
  // Preserve compact reference windows/stencils before projecting them. The
  // former post-projection size filter discarded these as the texture grew.
  const featureCanvas=document.createElement('canvas');featureCanvas.width=w;featureCanvas.height=h;
  const fc=featureCanvas.getContext('2d'),features=[];
  function detailRegion(x,y){return x>817&&x<1144&&y>603&&y<683 || x>1008&&x<1210&&y>530&&y<600 || x>1070&&x<1482&&y>473&&y<580 || x>34&&x<443&&y>475&&y<574 || x>1580&&x<1995&&y>472&&y<576 || x>1195&&x<1333&&y>190&&y<276 || x>1170&&x<1370&&y>840&&y<984 || x>552&&x<1034&&y>465&&y<516;}
  for(const [mask,lit] of [[whiteMask,true],[inkMask,false]]){
    visited.fill(0);
    for(let seed=0;seed<w*h;seed++)if(mask[seed]&&!visited[seed]){
      head=0;tail=1;queue[0]=seed;visited[seed]=1;let minX=w,maxX=0,minY=h,maxY=0;
      while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(const n of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&mask[n]&&!visited[n]){visited[n]=1;queue[tail++]=n;}
      }
      const bw=maxX-minX+1,bh=maxY-minY+1,x=(minX+maxX)/2,y=(minY+maxY)/2;
      if(!detailRegion(x,y)||tail<2||tail>64||bw>12||bh>8||tail/(bw*bh)<.42)continue;
      // Registry letters and the pennant artwork use the separate vector layer.
      if(x>720&&x<815&&y>477&&y<504 || x>980&&y>630&&y<652)continue;
      fc.fillStyle=lit?'#f1f3df':'#25382d';fc.beginPath();fc.roundRect(minX,minY,Math.max(1.5,bw),Math.max(1.25,bh),Math.min(bw,bh)*.15);fc.fill();
      features.push({x,y,width:bw,height:bh,lit});
    }
  }
  const featurePixels=fc.getImageData(0,0,w,h).data;
  maps.referenceFeatures=features;maps.referenceWindowLayers={};
  const noFeature=[0,0,0,0];
  function sampleFeature(x,y){
    const ix=Math.floor(x),iy=Math.floor(y);
    if(ix<0||ix>=w-1||iy<0||iy>=h-1)return noFeature;
    const first=(iy*w+ix)*4+3;
    if(!(featurePixels[first]||featurePixels[first+4]||featurePixels[first+w*4]||featurePixels[first+w*4+4]))return noFeature;
    const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,out=[0,0,0,0];
    for(const [dx,dy,weight] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){
      const px=x0+dx,py=y0+dy;if(px<0||px>=w||py<0||py>=h)continue;const i=(py*w+px)*4,a=featurePixels[i+3]/255;
      for(let k=0;k<3;k++)out[k]+=featurePixels[i+k]*a*weight;out[3]+=a*weight;
    }
    if(out[3])for(let k=0;k<3;k++)out[k]/=out[3];out[3]*=255;return out;
  }
  const clean=new Uint8ClampedArray(raw.length);
  for(let i=0;i<raw.length;i+=4){
    const r=raw[i],g=raw[i+1],b=raw[i+2],contrast=((r-blurred[i])+(g-blurred[i+1])+(b-blurred[i+2]))/3;
    const ink=inkMask[i/4]===1;
    const paint=r>g*1.25&&r>b*1.25 || r>b*1.23&&g>b*1.12;
    const white=whiteMask[i/4]===1;
    for(let k=0;k<3;k++)clean[i+k]=background[i/4]?base[k]:ink||paint||white?raw[i+k]:base[k]+Math.max(-20,Math.min(20,(raw[i+k]-blurred[i+k])*.65));
    clean[i+3]=255;
  }
  function sample(x,y){const i=(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4;return clean.subarray(i,i+3);}
  function project(name,fn){
    const canvas=maps[name].image,c=canvas.getContext('2d'),cw=canvas.width,ch=canvas.height,data=c.createImageData(cw,ch),featureData=c.createImageData(cw,ch);
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
      const p=fn(x/cw,y/ch),rgb=p?sample(...p):base,i=(y*cw+x)*4;data.data.set(rgb,i);data.data[i+3]=255;if(p)featureData.data.set(sampleFeature(...p),i);
    }
    const layer=document.createElement('canvas');layer.width=cw;layer.height=ch;layer.getContext('2d').putImageData(featureData,0,0);maps.referenceWindowLayers[name]=layer;
    c.putImageData(data,0,0);
    if(name==='top'||name==='bottom'){
      c.save();c.translate(cw/2,ch/2);c.strokeStyle='rgba(91,115,99,.21)';c.lineWidth=.8;
      for(const r of [.10,.16,.22,.28,.34,.40,.46,.49]){c.beginPath();c.arc(0,0,cw*r,0,Math.PI*2);c.stroke();}
      for(let n=0;n<32;n++){const a=n*Math.PI/16;c.beginPath();c.moveTo(Math.sin(a)*cw*.10,Math.cos(a)*cw*.10);c.lineTo(Math.sin(a)*cw*.49,Math.cos(a)*cw*.49);c.stroke();}c.restore();
    }
    maps[name].needsUpdate=true;
    const glow=maps[name+'Glow'];if(glow){
      const gc=glow.image.getContext('2d'),light=gc.createImageData(cw,ch);
      for(let i=0;i<data.data.length;i+=4){const on=Math.min(data.data[i],data.data[i+1],data.data[i+2])>218;light.data[i]=light.data[i+1]=light.data[i+2]=on?255:0;light.data[i+3]=255;}
      gc.putImageData(light,0,0);glow.needsUpdate=true;
    }
  }
  project('top',(u,v)=>{
    const x=(u-.5)*1.38,z=(v-.5)*1.38,sx=1268-z*205/.68,sy=235+x*205/.68;
    // Avoid painting the source's larger deckhouse shadow on the movie saucer.
    if(((sx-1254)/68)**2+((sy-235)/46)**2<1)return null;
    if(Math.abs(sx-1268)<7&&(Math.abs(sy-47)<9||Math.abs(sy-422)<9))return null;
    return [sx,sy];
  });
  project('deck',(u,v)=>[1268-(v-.5)*1.38*205/.68*1.17,235+(u-.5)*1.38*205/.68*1.24]);
  project('bottom',(u,v)=>[1268-(v-.5)*1.38*201/.68,910+(u-.5)*1.38*201/.68]);
  project('rim',(u,v)=>{
    const a=u*Math.PI*2,x=.68*Math.sin(a),z=.68*Math.cos(a),y=.025-v*.029;
    if(Math.abs(x)>Math.abs(z))return [1276-z*304,523-y*283];
    return [z<0?1785-x*300:239+x*300,523-y*283];
  });
  function cylinder(name,lo,hi,secondary){
    const profile=secondary?[[.13,-1.19],[.154,-1.05],[.148,-.75],[.135,-.48],[.119,-.24],[.102,0]]:[[.087,-.8],[.087,.64],[.068,.78]];
    project(name,(u,v)=>{
      const z=hi-v*(hi-lo),a=u*Math.PI*2;let r=profile[0][0];
      for(let j=1;j<profile.length;j++)if(z>=profile[j-1][1]&&z<=profile[j][1])r=profile[j-1][0]+(profile[j][0]-profile[j-1][0])*(z-profile[j-1][1])/(profile[j][1]-profile[j-1][1]);
      const x=r*Math.sin(a),y=-r*Math.cos(a),sx=secondary?814-z*286.5:1020-(z+.8)*297.5;
      if(Math.abs(x)>Math.abs(y)){
        if(secondary&&sx<850)return null; // modeled bay doors replace their photographed outline
        const sy=(secondary?643:489)-y*(secondary?290:281.6);
        if(!secondary&&sx>645&&sx<951&&Math.abs(sy-490)<13)return null;
        if(secondary&&sx>979&&sx<1148&&Math.abs(sy-640)<11)return null;
        return [sx,sy];
      }
      if(secondary&&y>0&&(sx>1064||sx<850))return null; // hidden by saucer in this view
      const top=y>0;
      return [secondary?(top?sx:789-z*306):(top?sx:1021-(z+.8)*282.3),
        (secondary?(top?235:910):(top?103:784))+(top?x:-x)*(secondary?315:281.6)];
    });
  }
  cylinder('nacelle',-.8,.78,false);cylinder('secondary',-1.19,0,true);
  project('registry',(u,v)=>[651+u*295,478+v*25]);
  project('pennant',(u,v)=>[980+u*164,628+v*25]);
  project('neck',(u,v)=>[814-(-1.44+u*.72)*286.5,643-(.46-v*.41)*290]);
  maps.orthographicDetails=true;
};

