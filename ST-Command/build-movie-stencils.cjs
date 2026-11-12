const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ENTERPRISE_MOVIE_ORTHOS);
 const result=await page.evaluate(async()=>{
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=ENTERPRISE_MOVIE_ORTHOS;});
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;
  function simplify(points,tolerance){
   if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let index=0,best=0;
   for(let i=1;i<points.length-1;i++){const p=points[i],t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0,d=Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);if(d>best){best=d;index=i;}}
   if(best<=tolerance)return [a,b];return [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];
  }
  function smoothContour(points){
   const lengths=[0];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];lengths.push(lengths.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
   const perimeter=lengths.at(-1),count=Math.max(12,Math.ceil(perimeter/.25)),sample=[];let edge=0;
   for(let i=0;i<count;i++){const d=perimeter*i/count;while(edge<points.length-1&&lengths[edge+1]<d)edge++;const a=points[edge],b=points[(edge+1)%points.length],t=(d-lengths[edge])/(lengths[edge+1]-lengths[edge]||1);sample.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
   const step=perimeter/count,sigma=.65,radius=Math.ceil(3*sigma/step),weights=[];let total=0;
   for(let j=-radius;j<=radius;j++){const w=Math.exp(-.5*(j*step/sigma)**2);weights.push(w);total+=w;}
   return sample.map((p,i)=>{let x=0,y=0;for(let j=-radius;j<=radius;j++){const q=sample[((i+j)%count+count)%count],w=weights[j+radius];x+=q[0]*w;y+=q[1]*w;}return [x/total,y/total];});
  }
  function trace(w,h,width,height,project,label,mode='ink'){
   const mask=new Uint8Array(w*h),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const [sx,sy]=project(x/w,y/h),i=(Math.round(sy*image.height/1152)*image.width+Math.round(sx*image.width/2048))*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
    if(label==='Engineering pennant / red'&&y/h<.18)continue;
    const selected=mode==='red'?r>100&&r>g*1.45&&r>b*1.5:mode==='gold'?r>150&&g>120&&b<130&&r>b*1.5&&g>b*1.4:.2126*r+.7152*g+.0722*b<105&&r<g*1.20+5&&b<g*1.20+5;if(selected)mask[y*w+x]=1;
   }
   let components=0;
   for(let seed=0;seed<mask.length;seed++)if(mask[seed]&&!seen[seed]){
    let head=0,tail=1;queue[0]=seed;seen[seed]=1;
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);for(const n of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(n>=0&&mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
    if(tail<16)for(let i=0;i<tail;i++)mask[queue[i]]=0;else components++;
   }
   const edges=new Map(),stride=w+1;
   function edge(a,b){if(!edges.has(a))edges.set(a,[]);edges.get(a).push(b);}
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){
    const a=y*stride+x;if(!y||!mask[(y-1)*w+x])edge(a,a+1);if(x===w-1||!mask[y*w+x+1])edge(a+1,a+1+stride);
    if(y===h-1||!mask[(y+1)*w+x])edge(a+1+stride,a+stride);if(!x||!mask[y*w+x-1])edge(a+stride,a);
   }
   const contours=[];
   while(edges.size){
    const start=edges.keys().next().value;let loop=[];let p=start;
    for(let guard=0;guard<100000;guard++){
     loop.push([p%stride/w*width,Math.floor(p/stride)/h*height]);const list=edges.get(p);if(!list)break;
     const next=list.pop();if(!list.length)edges.delete(p);p=next;if(p===start)break;
    }
    if(loop.length<4)continue;let area=0;for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];area+=a[0]*b[1]-b[0]*a[1];}
    if(Math.abs(area)<.06)continue;
    loop=smoothContour(loop);
    let far=1;for(let i=2;i<loop.length;i++)if(Math.hypot(loop[i][0]-loop[0][0],loop[i][1]-loop[0][1])>Math.hypot(loop[far][0]-loop[0][0],loop[far][1]-loop[0][1]))far=i;
    const tolerance=mode==='red'?1.20:mode==='gold'?.65:label==='U.S.S. ENTERPRISE'?.55:label.includes('saucer')?1.05:.75;
    const points=[...simplify(loop.slice(0,far+1),tolerance).slice(0,-1),...simplify([...loop.slice(far),loop[0]],tolerance).slice(0,-1)];
    contours.push(points.map(p=>p.map(v=>Math.round(v*1000)/1000)));
   }
   const all=contours.flat(),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
   return {label,width,height,components,bounds:[minX,minY,maxX-minX,maxY-minY],contours};
  }
  const bandRadius=[],bandAngles=[];
  for(let y=35;y<435;y++)for(let x=1270;x<1475;x++){
   const radius=Math.hypot(x-1270,y-235),angle=Math.atan2(y-235,x-1270);if(radius<154||radius>200||Math.abs(angle)>1.25)continue;
   const i=(Math.round(y*image.height/1152)*image.width+Math.round(x*image.width/2048))*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   if(r>80&&r>g*.98&&g>b*1.13&&r>b*1.20){bandRadius.push(radius);bandAngles.push(angle);}
  }
  bandRadius.sort((a,b)=>a-b);bandAngles.sort((a,b)=>a-b);const quantile=(a,q)=>a[Math.floor((a.length-1)*q)];
  const saucerBand={inner:quantile(bandRadius,.03),outer:quantile(bandRadius,.97),start:quantile(bandAngles,.005),end:quantile(bandAngles,.995)};
  return {
   source:'Image 1444.png',saucerBand,shipName:'U.S.S. ENTERPRISE',registry:'NCC-1701',
   top:trace(1280,256,223.2,34,(u,v)=>{const a=.90-u*1.80,r=107+v*34;return [1270+r*Math.cos(a),235+r*Math.sin(a)];},'NCC-1701 / saucer'),
   name:trace(1152,152,144,19,(u,v)=>[1329+v*19,308-u*144],'U.S.S. ENTERPRISE'),
   side:trace(720,240,90,30,(u,v)=>[724+u*90,474+v*30],'NCC-1701 / nacelle and underside'),
   hullRed:trace(1280,184,160,23,(u,v)=>[984+u*160,630+v*23],'Engineering pennant / red','red'),
   hullGold:trace(1280,184,160,23,(u,v)=>[984+u*160,630+v*23],'Engineering pennant / gold','gold'),
   engineRed:trace(2360,208,295,26,(u,v)=>[655+u*295,477+v*26],'Nacelle pennant / red','red'),
   engineGold:trace(2360,208,295,26,(u,v)=>[655+u*295,477+v*26],'Nacelle pennant / gold','gold')
  };
 });
 const out=path.join(__dirname,'assets/reference/image-1444');fs.writeFileSync(path.join(out,'lettering-stencils.json'),JSON.stringify(result));
 fs.writeFileSync(path.join(out,'lettering-stencils.js'),'/* Smooth outlines traced from Image 1444; source coordinates retained. */\nwindow.ENTERPRISE_1444_STENCILS='+JSON.stringify(result)+';\n');
 console.log('Saucer band:',JSON.stringify(result.saucerBand));
 console.log(JSON.stringify(Object.fromEntries(['top','name','side','hullRed','hullGold','engineRed','engineGold'].map(k=>[k,{components:result[k].components,contours:result[k].contours.length,bounds:result[k].bounds}]))));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

