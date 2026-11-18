const assert=require('node:assert/strict'),path=require('path'),fs=require('fs'),os=require('os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,ship=NightMode.attach(createThirdEnterpriseRenderer());window.testLitShip=ship;await ship.ready;ship.model.updateWorldMatrix(true,true);
  const rig=ship.model.userData.exteriorLights,sheet=document.createElement('canvas');sheet.width=1440;sheet.height=2400;const ctx=sheet.getContext('2d'),deltas=[];
  ship.renderer.setSize(720,480,false);ship.renderer.setClearColor(0x03070b,1);
  const views=[{name:'DORSAL / DAY',eye:[.7,1.8,-2.4],at:[0,.3,-1.2],night:false},{name:'DORSAL / NIGHT',eye:[.7,1.8,-2.4],at:[0,.3,-1.2],night:true},{name:'VENTRAL / NIGHT',eye:[.6,-1.6,-2.3],at:[0,.2,-1.2],night:true},{name:'PROFILE / NIGHT',eye:[2,.85,-.25],at:[0,.2,-.7],night:true}];
  views.push({name:'PENNANT CLOSEUP / DAY',eye:[1.7,-.022,-.83],at:[0,-.022,-.83],night:false,fov:16});
  for(const [row,view]of views.entries()){
   NightMode.enabled=view.night;const camera=new T.PerspectiveCamera(view.fov||48,1.5,.001,20);camera.position.set(...view.eye);camera.lookAt(new T.Vector3(...view.at));let before;
   for(let col=0;col<2;col++){
    ExteriorLights.enabled=!!col;ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*720,row*480);
    const sample=document.createElement('canvas');sample.width=720;sample.height=480;const c=sample.getContext('2d');c.drawImage(ship.renderer.domElement,0,0);const pixels=c.getImageData(0,0,720,480).data;
    if(!col)before=pixels;else{let total=0;for(let i=0;i<pixels.length;i+=4)for(let k=0;k<3;k++)total+=Math.abs(pixels[i+k]-before[i+k]);deltas.push(total/(720*480*3));}
    ctx.fillStyle='#fff';ctx.font='17px Arial';ctx.fillText(view.name+(col?' / ON':' / OFF'),col*720+16,row*480+26);
   }
  }
  const sourceDistances=rig.lamps.map(l=>l.light.position.distanceTo(l.light.target.position));
  return {count:rig.lamps.length,soft:rig.lamps.every(l=>{const up=l.id.endsWith('-impulse-deck'),down=l.id.endsWith('-nacelle-forward'),front=l.id==='bridge-registry',ventral=l.id.endsWith('-ventral-registry'),registry=l.id.endsWith('-saucer-nacelle-registry'),pennant=l.id.endsWith('-engineering-forward');return l.light.penumbra===(pennant?.50:registry?.30:ventral?.40:front?.60:down?.55:up?.15:.65)&&(!(up||down||registry||pennant)||l.light.angle===(pennant?Math.PI/30:registry?Math.PI/90:down?Math.PI/45:Math.PI/30))&&!l.light.castShadow;}),live:rig.lamps.every(l=>l.light.intensity===l.intensity&&l.lens.emissiveIntensity===(l.intensity>0?1.4:0)),sourceDistances,deltas,gl:ship.renderer.getContext().getError(),image:sheet.toDataURL().split(',')[1]};
 });
 assert.deepEqual(errors,[]);assert.equal(result.count,11);assert(result.soft&&result.live);assert.equal(result.gl,0);assert(result.deltas.every(d=>d>.05));assert(result.sourceDistances.every(d=>d>.05));
 await page.locator('#welcome-close').click();await page.locator('[data-exterior-lights]').click();
 assert.equal(await page.evaluate(()=>ExteriorLights.enabled),false);assert.equal(await page.locator('[data-exterior-lights]').getAttribute('aria-pressed'),'false');assert(await page.evaluate(()=>testLitShip.model.userData.exteriorLights.lamps.every(l=>l.light.intensity===0&&l.lens.emissiveIntensity===0)));
 await page.reload();await page.waitForFunction(()=>window.ExteriorLights);assert.equal(await page.evaluate(()=>ExteriorLights.enabled),false);await page.evaluate(()=>ExteriorLights.enabled=true);
 const preview=path.join(os.tmpdir(),'st-command-exterior-lights.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(preview);
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
