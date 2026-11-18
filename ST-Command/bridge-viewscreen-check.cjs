const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.goto(process.argv.includes('--file')?require('node:url').pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
   STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,room=createBridgeHatchRoom(T,{dome:{position:{z:-1.53}},centerY:.531,portZ:-1.466,doorZ:.0161});await room.ready;
   const photo=room.getObjectByName('bridge-room-front-panorama'),live=photo.userData.liveViewscreen,info=room.userData.circularRoom,mapping=photo.userData.wallMapping;
   const configure=photo.material.onBeforeCompile;let viewShader;photo.material.onBeforeCompile=function(shader,...rest){configure.call(this,shader,...rest);viewShader=shader;};
   const scene=new T.Scene();scene.add(room);scene.add(new T.HemisphereLight(0xffffff,0x555555,.8));
   const camera=new T.OrthographicCamera(-.013,.013,.00975,-.00975,.00001,1),y=info.floorY-.531+.54*(info.ceilingY-info.floorY);camera.position.set(0,y,info.centerZ-.015);camera.lookAt(0,y,info.centerZ-.06);camera.updateMatrixWorld();
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,750);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
   const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=750;const c=canvas.getContext('2d');
   function frame(pose,engines={}){room.updateBridgeView({freeSpace:true,carrier:pose,bridgeState:engines},{x:500,y:500,heading:90});renderer.render(scene,camera);c.drawImage(renderer.domElement,0,0);return c.getImageData(0,0,1000,750).data;}
   const still={x:0,y:0,z:0,heading:0,pitch:0,roll:0},first=frame(still),textureVersion=live.texture.version,same=frame({...still}),noUpload=live.texture.version===textureVersion;
   const moved=frame({...still,y:-2}),turned=frame({...still,heading:25}),rolled=frame({...still,roll:.3}),returned=frame(still);
   const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>3)n++;return n;};
   const impulse=frame(still,{drive:'impulse',speed:56}),warp=frame(still,{drive:'warp',speed:56}),stoppedWarp=frame(still,{drive:'warp',speed:0});
   const brightPixels=pixels=>{let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>100&&pixels[i+1]>100&&pixels[i+2]>100)count++;return count;};
   const warpPixels=brightPixels(warp),pointPixels=brightPixels(first),warpChanged=difference(first,warp),impulseChanged=difference(first,impulse),stoppedChanged=difference(first,stoppedWarp);frame(still);
   const b=live.bounds,project=(u,v)=>{const a=Math.PI-(u-mapping.screenCenterU)*mapping.arcRadians;return new T.Vector3(Math.sin(a)*mapping.paintRadius,info.floorY-.531+v*(info.ceilingY-info.floorY),info.centerZ+Math.cos(a)*mapping.paintRadius).project(camera);};
   const corners=[project(b[0],b[1]),project(b[0],b[3]),project(b[2],b[1]),project(b[2],b[3])],left=Math.min(...corners.map(p=>(p.x+1)*500))-2,right=Math.max(...corners.map(p=>(p.x+1)*500))+2,top=Math.min(...corners.map(p=>(1-p.y)*375))-2,bottom=Math.max(...corners.map(p=>(1-p.y)*375))+2;
   let outside=0;for(let i=0;i<first.length;i+=4){const x=i/4%1000,y=Math.floor(i/4/1000);if((x<left||x>right||y<top||y>bottom)&&Math.abs(first[i]-moved[i])+Math.abs(first[i+1]-moved[i+1])+Math.abs(first[i+2]-moved[i+2])>3)outside++;}
   const reference=document.createElement('canvas');reference.width=live.texture.image.width;reference.height=live.texture.image.height;const rc=reference.getContext('2d');rc.fillStyle='#000000';rc.fillRect(0,0,reference.width,reference.height);SpaceStarfield.draw(rc,reference.width,reference.height,{...SpaceStarfield.pose(still),soft:true});
   const shared=reference.toDataURL()===live.texture.image.toDataURL();
   function starBrightness(pixels){
    const peaks=[],lum=(x,y)=>{const i=(y*1000+x)*4;return pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;};
    for(let y=200;y<520;y++)for(let x=210;x<790;x++){const l=lum(x,y);if(l<15)continue;let peak=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&lum(x+dx,y+dy)>l)peak=false;if(peak)peaks.push(l);}
    peaks.sort((a,b)=>a-b);return {bright:peaks[Math.floor(peaks.length*.9)],max:peaks.at(-1)};
   }
   let blackPixels=0;for(let y=200;y<520;y++)for(let x=210;x<790;x++){const i=(y*1000+x)*4;if(first[i]===0&&first[i+1]===0&&first[i+2]===0)blackPixels++;}
   const blackFraction=blackPixels/(320*580),liveBrightness=starBrightness(first);viewShader.uniforms.bridgeViewReady.value=0;const originalBrightness=starBrightness(frame(still));viewShader.uniforms.bridgeViewReady.value=1;frame(still);
   frame(still,{drive:'warp',speed:56});
   const result={warpPixels,pointPixels,warpChanged,impulseChanged,stoppedChanged,blackFraction,liveBrightness,originalBrightness,bounds:b,stationary:difference(first,same),moved:difference(first,moved),turned:difference(first,turned),rolled:difference(first,rolled),returned:difference(first,returned),outside,noUpload,shared,glError:renderer.getContext().getError(),image:canvas.toDataURL().split(',')[1]};renderer.dispose();return result;
  });
  assert.equal(result.warpChanged,0,'warp retains star points without streaks');assert.equal(result.warpPixels,result.pointPixels);assert.equal(result.impulseChanged,0);assert.equal(result.stoppedChanged,0);
  assert(result.liveBrightness.max>254,'star cores reach full display white');assert(result.blackFraction>.9,'space background stays pure black');
  assert.equal(result.stationary,0);assert.equal(result.returned,0);assert(result.moved>100&&result.turned>100&&result.rolled>100);assert.equal(result.outside,0);assert(result.noUpload&&result.shared);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
  const file=path.join(os.tmpdir(),'st-command-live-bridge-viewscreen.png');fs.writeFileSync(file,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(file);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
