const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[],centerArtRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('bridge-ceiling-center'))centerArtRequests.push(r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
   STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,ship=createThirdEnterpriseRenderer();await ship.ready;ship.model.updateWorldMatrix(true,true);
   const port=ship.model.getObjectByName('aft-bridge-docking-port'),room=port.getObjectByName('bridge-circular-room'),info=room.userData.circularRoom,stairs=room.getObjectByName('bridge-corridor-entry-stairs').userData.stairway,pit=room.getObjectByName('bridge-room-sunken-stair-6').userData.stairway;
   const skins=['bridge-dome','upper-saucer-teardrop','docking-port-surround'].map(name=>ship.model.getObjectByName(name));
   const triangles=[];
   for(const mesh of skins){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;for(let i=0;i<(index?index.count:p.count);i+=3)triangles.push({name:mesh.name,v:[0,1,2].map(k=>port.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k))))});}
   const hits=[];let probes=0;
   for(let step=0;step<stairs.treads;step++)for(const x of [-.006,0,.006]){
    const z=info.entranceZ+(step+.5)*stairs.treadDepth,low=info.floorY-port.position.y+step*stairs.riserHeight+.00008,high=Math.min(low+.008,info.ceilingY-port.position.y-.001);probes++;
    for(const {name,v:[a,b,c]}of triangles){const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-14)continue;const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,w=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den,t=1-u-w;if(Math.min(u,w,t)<-1e-8)continue;const y=u*a.y+w*b.y+t*c.y;if(y>low&&y<high)hits.push({name,step,x,z,y});}
   }
   port.setHatchOpen(1);const sheet=document.createElement('canvas');sheet.width=2000;sheet.height=700;const c=sheet.getContext('2d');ship.renderer.setSize(1000,700,false);
   const camera=new T.PerspectiveCamera(65,10/7,.00001,10);camera.position.copy(port.localToWorld(new T.Vector3(0,info.floorY-port.position.y+.006,info.entranceZ-.005)));camera.lookAt(port.localToWorld(new T.Vector3(0,stairs.thresholdY-port.position.y+.004,info.entranceZ+info.corridorLength+.006)));ship.renderer.render(ship.scene,camera);c.drawImage(ship.renderer.domElement,0,0);
   camera.position.copy(port.localToWorld(new T.Vector3(0,info.floorY-port.position.y+.012,info.centerZ)));camera.lookAt(port.localToWorld(new T.Vector3(0,info.ceilingY-port.position.y+.006,info.centerZ-.008)));ship.renderer.render(ship.scene,camera);c.drawImage(ship.renderer.domElement,1000,0);
   const dome=room.getObjectByName('bridge-room-ceiling-center-cap'),light=room.getObjectByName('bridge-dome-light-emitter');
   const result={probes,hits,corridorRise:stairs.riserHeight,pitRise:pit.riserHeight,treads:stairs.treads,thresholdRise:stairs.thresholdRise,dome:!!dome.userData.domeLight?.diffuse,softLight:light?.isPointLight&&light.intensity>0&&!light.castShadow,wallArt:!!room.getObjectByName('bridge-room-front-panorama'),panelArt:!!room.getObjectByName('bridge-room-ceiling-section-1').material.map,glError:ship.renderer.getContext().getError(),image:sheet.toDataURL().split(',')[1]};ship.dispose();return result;
  });
  assert.equal(result.hits.length,0,JSON.stringify(result.hits));assert.equal(result.corridorRise,result.pitRise);assert(result.thresholdRise>=0&&result.thresholdRise<result.pitRise);assert(result.dome&&result.softLight&&result.wallArt&&result.panelArt);assert.equal(result.glError,0);assert.deepEqual(errors,[]);assert.deepEqual(centerArtRequests,[]);
  const file=path.join(os.tmpdir(),'st-command-clear-stairs-dome-light.png');fs.writeFileSync(file,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(file);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
