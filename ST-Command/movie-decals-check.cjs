const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;const maps=enterpriseMovieMaps,a=maps.pennant.image,b=maps.portPennant.image;
  const ap=a.getContext('2d').getImageData(0,0,a.width,a.height).data,bp=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
  let maxRGB=0,maxAlpha=0,aa=0,sumA=0,sumB=0,countA=0,countB=0,overlap=0,paint=0;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
   const i=(y*a.width+x)*4,j=(y*a.width+a.width-1-x)*4;
   for(let k=0;k<3;k++)maxRGB=Math.max(maxRGB,Math.abs(ap[i+k]-bp[j+k]));maxAlpha=Math.max(maxAlpha,Math.abs(ap[i+3]-bp[j+3]));
   if(ap[i+3]>0&&ap[i+3]<255)aa++;
   if(ap[i]>150&&ap[i+1]>125&&ap[i+2]<130&&ap[i+3]>200){sumA+=x+.5;countA++;}
   if(bp[i]>150&&bp[i+1]>125&&bp[i+2]<130&&bp[i+3]>200){sumB+=x+.5;countB++;}
  }
  for(const [name,center] of [['registry',maps.registryCenters[0]],['portRegistry',maps.registryCenters[1]]]){
   const canvas=maps[name].image,p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   for(let y=Math.floor(canvas.height*.43);y<canvas.height*.59;y++)for(let x=Math.ceil(canvas.width*(center-maps.registryTextWidth/2+.006));x<canvas.width*(center+maps.registryTextWidth/2-.006);x++){
    const i=(y*canvas.width+x)*4;if(p[i]>80&&p[i]>p[i+1]*1.7&&p[i+1]<100&&p[i+2]<90&&p[i+3]>128)overlap++;
   }
  }
  for(const name of ['top','bottom','deck','secondary','nacelle']){
   const image=maps[name].image,p=image.getContext('2d').getImageData(0,0,image.width,image.height).data;for(let i=0;i<p.length;i+=4)if(p[i]>p[i+1]+10&&p[i+3])paint++;
  }
  const uA=sumA/countA/a.width,uB=sumB/countB/a.width;
  const top=maps.top.image,pixels=top.getContext('2d').getImageData(0,0,top.width,top.height).data;
  function labelInk(x0,y0,x1,y1){let count=0;for(let y=Math.floor(y0*top.height);y<y1*top.height;y++)for(let x=Math.floor(x0*top.width);x<x1*top.width;x++){const i=(y*top.width+x)*4;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])<115)count++;}return count;}
  const labels={name:labelInk(.33,.315,.67,.355),registry:labelInk(.22,.13,.78,.31)};
  const stencils=ENTERPRISE_1444_STENCILS,components=[stencils.name.components,stencils.top.components,stencils.side.components];
  const referenceFeatureCount=maps.referenceFeatures.length;
  const restoredWindows={};
  for(const name of ['secondary','neck','deck','rim']){
    const image=maps[name].image,p=image.getContext('2d').getImageData(0,0,image.width,image.height).data;let lit=0,dark=0;
    for(let i=0;i<p.length;i+=4){if(p[i+3]>128&&Math.min(p[i],p[i+1],p[i+2])>220)lit++;if(p[i+3]>128&&Math.max(p[i],p[i+1],p[i+2])<100)dark++;}
    restoredWindows[name]={lit,dark};
  }
  const textureKeys=['top','bottom','registry','portRegistry','pennant','portPennant','secondaryServiceGrille'];
  const cachedTextures=textureKeys.every(name=>maps[name]?.isTexture);
  const detailMeshes=['port-forward-hull-service-grille','starboard-forward-hull-service-grille'].every(name=>!!ship.model.getObjectByName(name));
  const atlas=document.createElement('canvas');atlas.width=1800;atlas.height=1580;const c=atlas.getContext('2d');c.fillStyle='#091117';c.fillRect(0,0,atlas.width,atlas.height);
  function label(s,y){c.fillStyle='#e2cca7';c.font='21px Arial';c.fillText(s,24,y);}
  function art(image,x,y,w,h){c.fillStyle='#a9b5aa';c.fillRect(x,y,w,h);c.drawImage(image,x,y,w,h);}
  label('IMAGE 1444 / REPLACED NAME AND SAUCER REGISTRY',32);
  c.save();c.translate(1800,740);c.rotate(Math.PI);c.drawImage(maps.top.image,410,287,1228,472,0,0,1800,690);c.restore();
  label('STARBOARD NACELLE REGISTRY',785);art(maps.registry.image,0,800,1800,103);
  label('PORT NACELLE REGISTRY / READABLE TEXT, MIRRORED PENNANT',948);art(maps.portRegistry.image,0,963,1800,103);
  label('STARBOARD ENGINEERING PENNANT / SUPPLIED CLOSE-UP',1110);art(maps.pennant.image,0,1125,1800,190);
  label('PORT ENGINEERING PENNANT / MIRRORED',1360);art(maps.portPennant.image,0,1375,1800,190);
  return {referenceFeatureCount,restoredWindows,image:atlas.toDataURL('image/jpeg',.96),maxRGB,maxAlpha,aa,overlap,paint,labels,components,cachedTextures,detailMeshes,reference:maps.markingReference,shipName:maps.shipName,registryText:maps.registryText,marked:maps.paintedMarkings,zA:-.874+.563*(.5-uA),zB:-.874+.563*(uB-.5),
   materials:ship.model.getObjectByName('port-secondary-pennant').material.map===maps.portPennant&&ship.model.getObjectByName('starboard-secondary-pennant').material.map===maps.pennant};
 });
 assert(result.referenceFeatureCount>100,'compact window and stencil groups survive source extraction');for(const name of ['secondary','neck','rim'])assert(result.restoredWindows[name].lit>20&&result.restoredWindows[name].dark>20,name+' retains lit and dark reference windows after cleanup');assert(result.restoredWindows.deck.dark>20,'deck retains its dark reference windows');
 assert.equal(result.reference,'Image 1444.png');assert.equal(result.shipName,'U.S.S. ENTERPRISE');assert.equal(result.registryText,'NCC-1701');assert.deepEqual(result.components,[16,8,8],'complete reference name and registry glyphs are traced');assert(result.labels.name>2000&&result.labels.registry>5000,'both replacement labels are painted on the saucer');assert(result.cachedTextures&&result.detailMeshes,'cached textures and new forward grilles remain valid');
 assert(result.marked&&result.materials);assert.equal(result.maxAlpha,0,'port pennant silhouette mirrors starboard exactly');assert(result.maxRGB<=1,'mirrored colors agree within alpha rounding');assert(result.aa>300,'smooth antialiased decal edges');
 assert.equal(result.overlap,0,'red stripes do not cross the readable registry lettering');assert(result.paint>10000,'reference hull markings are restored');assert(Math.abs(result.zA-result.zB)<1e-6&&result.zA< -.98,'both pennants face forward at the same station');
 fs.writeFileSync(path.join(__dirname,'preview-image-1444-markings.jpg'),Buffer.from(result.image.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);console.log('Passed: '+result.referenceFeatureCount+' reference features; secondary, neck, deck and rim window layers; smooth markings, mirrored pennants and readable registries.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

