const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
   STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,room=createBridgeHatchRoom(T,{dome:{position:{z:-1.53}},centerY:.531,portZ:-1.466,doorZ:.0161});await room.ready;
   const scene=new T.Scene();scene.add(room);scene.add(new T.HemisphereLight(0xffffff,0x555555,.2));
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.shadowMap.type=T.PCFSoftShadowMap;
   const info=room.userData.circularRoom,camera=new T.PerspectiveCamera(65,10/7,.00001,10);camera.position.set(.005,info.floorY-.531+.014,info.centerZ+.018);camera.lookAt(0,info.floorY-.531+.003,info.centerZ-.03);
   const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=700;const c=canvas.getContext('2d');
   renderer.shadowMap.enabled=false;renderer.render(scene,camera);c.drawImage(renderer.domElement,0,0);const before=c.getImageData(0,0,1000,700).data;
   renderer.shadowMap.enabled=true;room.traverse(o=>{if(o.isMesh)o.material.needsUpdate=true;});renderer.render(scene,camera);c.drawImage(renderer.domElement,1000,0);const after=c.getImageData(1000,0,1000,700).data;
   let maxDiff=0;for(let i=0;i<after.length;i++)maxDiff=Math.max(maxDiff,Math.abs(after[i]-before[i]));let changed=0;for(let i=0;i<after.length;i+=4)if(Math.abs(after[i]-before[i])+Math.abs(after[i+1]-before[i+1])+Math.abs(after[i+2]-before[i+2])>3)changed++;
   const lamps=[],door=room.getObjectByName('bridge-inner-door-left');
   const noShadowLights=lamps.every(l=>!l.castShadow);room.setInnerDoorOpen(1);let noShadowMeshes=true;room.traverse(o=>{if(o.isMesh&&(o.castShadow||o.receiveShadow))noShadowMeshes=false;});const floorFlat=room.getObjectByName('bridge-room-floor').material.isMeshBasicMaterial;
   const ledge=room.getObjectByName('bridge-ceiling-light-ledge'),downlightsRemoved=!room.getObjectByName('bridge-ceiling-downlights'),domeLight=room.getObjectByName('bridge-dome-light-emitter');const dome=room.getObjectByName('bridge-room-ceiling-center-cap').userData.domeLight;const result={domeColor:domeLight.color.getHex(),domeCoverage:(dome.radius/dome.mountRadius)**2,ledgeColor:ledge.material.color.getHex(),downlightsRemoved,centerLight:domeLight?.intensity>0,maxDiff,changed,noShadowLights,noShadowMeshes,floorFlat,gloss:door.material[4].roughness,reflection:!!door.material[4].envMap,bridgeFace:door.material[5].color.getHex(),bridgeEdgesUnlit:[0,1,2,3,5].every(i=>door.material[i].isMeshBasicMaterial&&door.material[i].color.getHex()===0x080808&&room.getObjectByName('bridge-inner-door-header').material[i].isMeshBasicMaterial),bridgeFaceUnlit:!!door.material[5].isMeshBasicMaterial,frameFaceUnlit:!!room.getObjectByName('bridge-inner-door-header').material[5].isMeshBasicMaterial,frameFace:room.getObjectByName('bridge-inner-door-header').material[5].color.getHex(),glError:renderer.getContext().getError(),image:canvas.toDataURL().split(',')[1]};
   for(const lamp of lamps)lamp.shadow.dispose();renderer.dispose();return result;
  });
  assert(Math.abs(result.domeCoverage-.448)<1e-10);assert.equal(result.domeColor,0x6ca8ff);assert.equal(result.ledgeColor,0x1d222f);assert(result.downlightsRemoved&&result.centerLight);assert.equal(result.changed,0,'bridge must render without shadows');assert(result.noShadowLights&&result.noShadowMeshes&&result.floorFlat);assert(result.gloss<=.2&&result.reflection);assert(result.bridgeEdgesUnlit,'door and frame edges must stay dark');assert(result.bridgeFaceUnlit&&result.frameFaceUnlit,'bridge-facing door and frame must ignore scene lights');assert.equal(result.bridgeFace,0x080808);assert.equal(result.frameFace,0x080808);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
  const file=path.join(os.tmpdir(),'st-command-bridge-shadows.png');fs.writeFileSync(file,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(file);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
