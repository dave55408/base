const assert=require('node:assert/strict'),path=require('path'),fs=require('fs'),os=require('os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer);
  const result=await page.evaluate(async()=>{
   STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,ship=NightMode.attach(createThirdEnterpriseRenderer());await ship.ready;NightMode.enabled=true;
   const rig=ship.model.userData.exteriorLights,w=640,h=480,sheet=document.createElement('canvas');sheet.width=w*2;sheet.height=h*2;const ctx=sheet.getContext('2d'),deltas=[];
   ship.renderer.setSize(w,h,false);ship.renderer.setClearColor(0x03070b,1);
   // The halo must remain visible from outside the dish, beyond its silhouette.
   const views=[{eye:[.27,.10,-1.39],at:[0,0,-1.075],fov:36,ring:true,match:()=>false},{eye:[0,2.2,-.7],at:[0,.42,-1.35],fov:45,match:l=>l.id.endsWith('-nacelle-forward')}];
   for(const [row,view]of views.entries()){
    const camera=new T.PerspectiveCamera(view.fov,w/h,.001,10);camera.position.set(...view.eye);camera.lookAt(new T.Vector3(...view.at));let before;
    for(let col=0;col<2;col++){
     rig.setEnabled(!!col);for(const l of rig.lamps){l.light.visible=false;l.lens.emissiveIntensity=0;l.lens.color.setHex(0x535a55);}
     ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*w,row*h);
     const sample=document.createElement('canvas');sample.width=w;sample.height=h;const c=sample.getContext('2d');c.drawImage(ship.renderer.domElement,0,0);const pixels=c.getImageData(0,0,w,h).data;
     if(!col)before=pixels;else{let total=0,changed=0;for(let i=0;i<pixels.length;i+=4){const d=Math.abs(pixels[i]-before[i])+Math.abs(pixels[i+1]-before[i+1])+Math.abs(pixels[i+2]-before[i+2]);total+=d;if(d>12)changed++;}deltas.push({mean:total/(w*h*3),changed});}
    }
   }
   rig.setEnabled(true);
   return {deltas,gl:ship.renderer.getContext().getError(),shadows:rig.lamps.filter(l=>l.light.castShadow).length,sensorSpots:rig.lamps.filter(l=>l.id.startsWith('deflector-rear-')).length,ringRadius:rig.glowRing.userData.radius,ringVisible:rig.glowRing.visible,image:sheet.toDataURL().split(',')[1]};
  });
  const preview=path.join(os.tmpdir(),'st-command-hull-light-appearance.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(preview);
  assert.deepEqual(errors,[]);assert.equal(result.gl,0);assert.equal(result.shadows,0);assert.equal(result.sensorSpots,0);assert.equal(result.ringRadius,.097*2/3);assert.equal(result.ringVisible,false);assert(result.deltas.every(d=>d.changed===0),'sensor ring and saucer-facing nacelle lights stay off');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
