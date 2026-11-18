const assert=require('node:assert/strict'),path=require('path'),fs=require('fs'),os=require('os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,ship=NightMode.attach(createThirdEnterpriseRenderer());await ship.ready;
  const rig=ship.model.userData.exteriorLights,lamps=rig.lamps.filter(l=>l.id.includes('deflector-projection')),sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1000;const ctx=sheet.getContext('2d'),deltas=[];NightMode.enabled=true;ExteriorLights.enabled=true;
  ship.renderer.setSize(800,500,false);ship.renderer.setClearColor(0x03070b,1);
  for(const [row,eye]of [[0,-.03,-1.65],[.35,-.15,-1.48]].entries()){
   const camera=new T.PerspectiveCamera(38,1.6,.0001,10);camera.position.set(...eye);camera.lookAt(new T.Vector3(0,-.025,-1.04));let before;
   for(let col=0;col<2;col++){
    for(const l of lamps)l.light.intensity=col?l.intensity:0;
    ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*800,row*500);
    const c=document.createElement('canvas');c.width=800;c.height=500;const cc=c.getContext('2d');cc.drawImage(ship.renderer.domElement,0,0);const pixels=cc.getImageData(0,0,800,500).data;
    if(!col)before=pixels;else{let total=0;for(let i=0;i<pixels.length;i+=4)for(let k=0;k<3;k++)total+=Math.abs(pixels[i+k]-before[i+k]);deltas.push(total/(800*500*3));}
    ctx.fillStyle='#fff';ctx.font='16px Arial';ctx.fillText((row?'OBLIQUE':'FRONT')+(col?' / THREE LIGHTS ON':' / THREE LIGHTS OFF'),col*800+16,row*500+25);
   }
  }
  const positions=lamps.map(l=>({id:l.id,source:l.light.position.toArray(),target:l.light.target.position.toArray(),mount:ship.model.getObjectByName('hull-spotlight-'+l.id).userData.mount}));
  ExteriorLights.enabled=false;const off=lamps.every(l=>l.light.intensity===0&&l.lens.emissiveIntensity===0);ExteriorLights.enabled=true;const on=lamps.every(l=>l.light.intensity===l.intensity&&l.lens.emissiveIntensity>0);
  return {count:rig.lamps.length,positions,off,on,deltas,gl:ship.renderer.getContext().getError(),image:sheet.toDataURL().split(',')[1]};
 });
 const preview=path.join(os.tmpdir(),'st-command-deflector-projection-lights.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(preview);
 assert.deepEqual(errors,[]);assert.equal(result.count,20);assert.equal(result.positions.length,3);assert(result.on&&result.off);assert.equal(result.gl,0);assert(result.deltas.some(d=>d>.01));
 for(const l of result.positions){assert(l.mount.endsWith('plain-square-walls'));assert(l.source[2]<-1.02);assert(Math.hypot(l.target[0],l.target[1])<Math.hypot(l.source[0],l.source[1]));}
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
