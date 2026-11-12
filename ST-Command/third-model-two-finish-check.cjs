const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  ShipTextures.quality='high';const second=createMovieEnterpriseRenderer(),third=createThirdEnterpriseRenderer();await Promise.all([second.ready,third.ready]);
  const T=AlpineThree,maps=enterpriseThirdMaps,group=third.model.getObjectByName('third-photo-details');
  const windows=group.userData.features.filter(r=>['engineering','neck','bridge','rim','bowl','pylon'].includes(r.region)).length;
  const pennants=group.userData.features.filter(r=>r.region==='pennant').length;
  let pennantColorPixels=0,registryInk=0;
  for(const name of ['pennant','portPennant','registry','portRegistry']){
   const image=maps[name].image,p=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
   for(let i=0;i<p.length;i+=4)if(p[i+3]){
    const r=p[i],g=p[i+1],b=p[i+2];if(r>g*1.2&&r>b*1.2||r>b*1.2&&g>b*1.15)pennantColorPixels++;
    if(name.includes('egistry')&&Math.max(r,g,b)<120)registryInk++;
   }
  }
  const bottom=maps.bottom.image,bottomPixels=bottom.getContext('2d').getImageData(0,0,bottom.width,bottom.height).data;let undersideInk=0;
  for(let i=0;i<bottomPixels.length;i+=4)if(bottomPixels[i+3]&&Math.max(bottomPixels[i],bottomPixels[i+1],bottomPixels[i+2])<120)undersideInk++;
  const glowBlack=['top','bottom','deck','rim','secondary','neck','nacelle'].every(name=>{const image=maps[name+'Glow'].image,p=image.getContext('2d').getImageData(0,0,image.width,image.height).data;for(let i=0;i<p.length;i+=4)if(p[i]||p[i+1]||p[i+2])return false;return true;});
  const image=maps.top.image,pixels=image.getContext('2d').getImageData(0,0,image.width,image.height).data;let paint=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==169||pixels[i+1]!==181||pixels[i+2]!==170)paint++;
  let plated=0;third.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.hullSurfaceDetail)plated++;});
  const pylonPanels=['port','starboard'].map(side=>{
   const a=[],b=[];for(const [ship,items]of [[second,a],[third,b]])ship.model.getObjectByName(side+'-engine-strut').traverse(o=>{if(o.name===side+'-strut-top-grille')items.push([o.material.color.getHex(),o.geometry.parameters.width,o.geometry.parameters.height,o.position.toArray(),o.rotation.toArray()]);});
   const strut=third.model.getObjectByName(side+'-engine-strut');let minSurface=Infinity,vertices=0;
   strut.updateWorldMatrix(true,true);
   strut.traverse(o=>{if(o.name!==side+'-strut-top-grille')return;const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
     const v=o.localToWorld(new T.Vector3().fromBufferAttribute(p,i));
     const t=Math.max(0,Math.min(1,(v.y-.085)/.370)),station=-.293;
     v.z=station+(v.z-station-.012*(1-t)+.008*t)/(1.06-.15*t);
     strut.worldToLocal(v);minSurface=Math.min(minSurface,(Math.abs(v.x)/.020)**6+(Math.abs(v.z)/.0535)**6);vertices++;
    }
   });
   return {count:b.length,matches:JSON.stringify(a)===JSON.stringify(b),minSurface,vertices};
  });
  const ctx=document.createElement('canvas').getContext('2d');
  function engineState(ship){
   return ['port','starboard'].map(side=>{
    const cap=ship.model.getObjectByName(side+'-engine-cap'),rotor=ship.model.getObjectByName(side+'-cap-lines');
    const lamps=['-dome-internal-lights','-dome-red-sphere-lights','-dome-front-red-lights'].map(suffix=>ship.model.getObjectByName(side+suffix).children.map(o=>({position:o.position.toArray(),color:o.material.color.toArray(),opacity:o.material.opacity,scale:o.scale.toArray()})));
    return {cap:cap.material.opacity,blade:rotor.children[0].material.opacity,rotation:rotor.rotation.toArray(),lamps};
   });
  }
  const engines=[];for(const time of [0,.7,2.5]){
   for(const ship of [second,third])ship.draw(ctx,640,360,{x:1,y:1,z:111,garageDoorOpen:0},{heading:0,pitch:0,time,bayDoorOpen:0});
   engines.push(JSON.stringify(engineState(second))===JSON.stringify(engineState(third)));
  }
  const out=document.createElement('canvas');out.width=2400;out.height=1440;const c=out.getContext('2d');
  const views=[['THIRD / TOP GRID AND PYLON PANELS',[0,6,-.7],[0,.2,-.7],1.7],['THIRD / UNDERSIDE CHEVRONS',[0,-6,-.7],[0,.2,-.7],1.7],['THIRD / SIDE WITHOUT WINDOWS',[6,.2,-.65],[0,.2,-.65],1.7],['THIRD / ENGINE EFFECTS',[1.1,.75,-2.3],[.35,.49,-.7],.58]];
  for(const [i,[label,pos,aim,half]]of views.entries()){
   const camera=new T.OrthographicCamera(-half,half,half*.6,-half*.6,.001,100);camera.position.set(...pos);if(i===0)camera.up.set(-1,0,0);if(i===1)camera.up.set(1,0,0);camera.lookAt(...aim);
   third.renderer.setClearColor(0x111a22,1);third.renderer.setSize(1200,720,false);third.renderer.render(third.scene,camera);const x=i%2*1200,y=Math.floor(i/2)*720;c.drawImage(third.renderer.domElement,x,y);c.fillStyle='#ffe4ac';c.font='19px Arial';c.fillText(label,x+15,y+26);
  }
  return {windows,pennants,pennantColorPixels,registryInk,undersideInk,glowBlack,paint,plated,pylonPanels,engines,appearance:maps.appearance,glError:third.renderer.getContext().getError(),preview:out.toDataURL().split(',')[1]};
 });
 assert.equal(result.windows,0);assert.equal(result.pennants,0);assert.equal(result.pennantColorPixels,0);assert(result.registryInk>1000);assert(result.glowBlack);assert(result.paint>10000);assert(result.plated>10);assert(result.pylonPanels.every(p=>p.count===5&&p.matches&&p.minSurface>1.01&&p.vertices>=425));assert(result.engines.every(Boolean));assert.equal(result.appearance,'model-two-without-windows');assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 assert.equal(result.undersideInk,0);
 fs.writeFileSync(path.join(__dirname,'preview-third-model-two-finish.png'),Buffer.from(result.preview,'base64'));delete result.preview;console.log(JSON.stringify(result));console.log('Passed: no small windows or underside ink, Model Two paint/plating, identical engine animation states and matching pylon panels.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
