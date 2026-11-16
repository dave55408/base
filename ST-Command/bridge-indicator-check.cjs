const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.goto(process.argv.includes('--file')?require('node:url').pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
   STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,room=createBridgeHatchRoom(T,{dome:{position:{z:-1.53}},centerY:.531,portZ:-1.466,doorZ:.0161});await room.ready;
   const scene=new T.Scene();scene.add(room);scene.add(new T.HemisphereLight(0xffffff,0x555555,.8));
   const info=room.userData.circularRoom,photo=room.getObjectByName('bridge-room-front-panorama'),rowY=info.floorY-.531+.3515*(info.ceilingY-info.floorY),camera=new T.OrthographicCamera(-.006,.006,.003,-.003,.00001,1);
   camera.position.set(0,rowY,info.centerZ-.02);camera.lookAt(0,rowY,info.centerZ-.06);
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1024,512);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
   const sheet=document.createElement('canvas');sheet.width=2048;sheet.height=1024;const c=sheet.getContext('2d'),frames=[],version=photo.material.map.version;
   for(const [i,time]of [0,2/8,5/8,9/8].entries()){
    room.updateBridgeIndicators(time);renderer.render(scene,camera);const x=i%2*1024,y=Math.floor(i/2)*512;c.drawImage(renderer.domElement,x,y);frames.push(c.getImageData(x,y,1024,512).data);
   }
   let changed=0,outside=0;
   for(let i=0;i<frames[0].length;i+=4)if(Math.abs(frames[0][i]-frames[1][i])+Math.abs(frames[0][i+1]-frames[1][i+1])+Math.abs(frames[0][i+2]-frames[1][i+2])>5){changed++;const y=Math.floor(i/4/1024);if(y<160||y>352)outside++;}
   const uploaded=photo.material.map.version!==version;
   room.updateBridgeIndicators(2.751);renderer.render(scene,camera);const repeat=document.createElement('canvas');repeat.width=1024;repeat.height=512;const rc=repeat.getContext('2d');rc.drawImage(renderer.domElement,0,0);const last=rc.getImageData(0,0,1024,512).data;let repeatDifference=0;for(let i=0;i<last.length;i++)repeatDifference=Math.max(repeatDifference,Math.abs(last[i]-frames[0][i]));
   const sampleCanvas=document.createElement('canvas');sampleCanvas.width=1024;sampleCanvas.height=512;const sc=sampleCanvas.getContext('2d');
   function sampleTrail(time,pixels=[4741,4724,4707]){room.updateBridgeIndicators(time);renderer.render(scene,camera);sc.drawImage(renderer.domElement,0,0);return pixels.map(x=>{const u=x/9800,a=Math.PI-(u-photo.userData.wallMapping.screenCenterU)*photo.userData.wallMapping.arcRadians,p=new T.Vector3(Math.sin(a)*photo.userData.wallMapping.paintRadius,rowY,info.centerZ+Math.cos(a)*photo.userData.wallMapping.paintRadius).project(camera),pixel=sc.getImageData(Math.round((p.x+1)*512),Math.round((1-p.y)*256),1,1).data;return pixel[0]*.2126+pixel[1]*.7152+pixel[2]*.0722;});}
   const trailEarly=sampleTrail(.6375),trailLate=sampleTrail(.725),pauseEarly=sampleTrail(1.75),pauseLate=sampleTrail(2.749);
   const endFade=[1.51,1.61,1.73].map(t=>sampleTrail(t,[4861])[0]);const restartRight=sampleTrail(2.751,[4861,4844]),restRight=sampleTrail(2,[4861,4844]);const result={endFade,restartRight,restRight,metadata:photo.userData.indicatorLights,trailEarly,trailLate,pauseEarly,pauseLate,changed,outside,uploaded,repeatDifference,glError:renderer.getContext().getError(),image:sheet.toDataURL().split(',')[1]};renderer.dispose();return result;
  });
  assert(result.endFade[0]>result.endFade[1]&&result.endFade[1]>result.endFade[2],'rightmost light must fade before the pause');assert.deepEqual(result.restartRight,result.restRight,'rightmost lights must stay dark when sequence restarts');assert.equal(result.metadata.count,12);assert(result.trailEarly[0]>result.trailEarly[1]&&result.trailEarly[1]>result.trailEarly[2]);assert(result.trailLate[0]>result.trailLate[1]&&result.trailLate[1]>result.trailLate[2]);assert(Math.abs(result.trailLate[0]-result.trailEarly[0])<=1);assert(result.trailLate[1]<result.trailEarly[1]&&result.trailLate[2]<result.trailEarly[2]);assert.deepEqual(result.pauseEarly,result.pauseLate);assert(result.pauseEarly.every((v,i)=>v<result.trailEarly[i]),'lights rest between cycles');assert.equal(result.metadata.pauseSeconds,1);assert.equal(result.metadata.repeatSeconds,2.75);assert.equal(result.metadata.cycleSeconds,1.5);assert.equal(result.metadata.stepSeconds,1/8);assert.deepEqual(result.metadata.banks,[3,6,3]);assert(result.changed>100,'indicators must visibly animate');assert.equal(result.outside,0,'animation must stay below the viewscreen');assert.equal(result.uploaded,false,'wall texture must stay static');assert(result.repeatDifference<=1,'light sequence must loop');assert.equal(result.glError,0);assert.deepEqual(errors,[]);
  const file=path.join(os.tmpdir(),'st-command-animated-bridge-indicators.png');fs.writeFileSync(file,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(file);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
