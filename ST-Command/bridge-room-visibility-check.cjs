const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();
 if(!process.argv.includes('--file'))await page.route('**/assets/reference/bridge-room.png',async route=>{await new Promise(r=>setTimeout(r,150));await route.continue();});
 await page.goto(process.argv.includes('--file')?pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>STCommand?.games.every(g=>g.isBooted));
 const result=await page.evaluate(async live=>{
  for(const g of STCommand.games)g.loop.stop();EnterpriseModels.selected='third';const T=AlpineThree,ship=live?EnterpriseModels.rendererFor(STCommand.games[0].scene.getScene('Forward')):createThirdEnterpriseRenderer(),port=ship.model.getObjectByName('aft-bridge-docking-port');BridgeHatch.open=true;port.setHatchOpen(1);ship.model.updateWorldMatrix(true,true);
  const center=port.localToWorld(new T.Vector3(0,0,.0165)),camera=new T.PerspectiveCamera(6.2,1.6,.005,10),sheet=document.createElement('canvas');sheet.width=3200;sheet.height=1000;const out=sheet.getContext('2d'),sample=document.createElement('canvas');sample.width=800;sample.height=500;const c=sample.getContext('2d'),checks=[];
  function frame(angle,row,col){const a=angle*Math.PI/180;camera.position.copy(center).add(new T.Vector3(0,.25*Math.sin(a),.25*Math.cos(a)));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(800,500,false);if(live)ship.draw(c,800,500,{x:camera.position.x,y:camera.position.z,z:110+camera.position.y,phase:'flight',freeSpace:true,cameraView:'cockpit'},{heading:0,pitch:-angle,cameraZoom:8,time:0});else ship.renderer.render(ship.scene,camera);c.clearRect(0,0,800,500);c.drawImage(ship.renderer.domElement,0,0);out.drawImage(sample,col*800,row*500);const pixels=c.getImageData(200,75,400,350).data;let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>pixels[i+1]*1.6&&pixels[i]>pixels[i+2]*1.4&&pixels[i]>45)red++;return red;}
  frame(0,0,0);await ship.ready;
  const picture=port.getObjectByName('bridge-room-back-wall-picture');
  for(const [i,angle]of [0,5,10,15].entries()){
   const red=frame(angle,1,i),before=c.getImageData(0,0,800,500).data;picture.visible=false;frame(angle,0,i);picture.visible=true;const after=c.getImageData(0,0,800,500).data;let picturePixels=0;
   for(let k=0;k<before.length;k+=4)if(Math.abs(before[k]-after[k])+Math.abs(before[k+1]-after[k+1])+Math.abs(before[k+2]-after[k+2])>20)picturePixels++;
   checks.push({angle,red,picturePixels});
  }
  const loaded=picture.material.map.image.width,glError=ship.renderer.getContext().getError();ship.dispose();return {checks,loaded,glError,image:sheet.toDataURL().split(',')[1]};
 },process.argv.includes('--live'));fs.writeFileSync(path.join(__dirname,'preview-bridge-room-angles.png'),Buffer.from(result.image,'base64'));console.log(JSON.stringify({checks:result.checks,loaded:result.loaded,glError:result.glError}));
 if(process.argv.includes('--verify')){
  assert.equal(result.glError,0,'The first render followed by picture loading must not generate texture upload errors');
  assert(result.checks[0].red>500,'The actual colored photograph must render, rather than the black temporary texture');
  for(const row of result.checks)assert(row.picturePixels>100,'Picture must remain visible at '+row.angle+' degrees');
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
