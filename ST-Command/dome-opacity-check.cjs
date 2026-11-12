const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;const T=AlpineThree,scratch=document.createElement('canvas').getContext('2d'),cap=ship.model.getObjectByName('port-engine-cap'),glow=ship.model.getObjectByName('port-dome-red-glow');
  const lamps=[];ship.model.traverse(o=>{if(o.isMesh&&/diffuse-dome-light-/.test(o.name))lamps.push(o);});
  function animate(time){ship.draw(scratch,2,2,{x:0,y:-2,z:110.49},{heading:180,pitch:0,time});return lamps.map(o=>o.material.opacity);}
  const pulse=animate(.8),stable=animate(.8),changed=animate(1.1);animate(.8);
  const bright=lamps.map(o=>o.material.color.clone()),opacity=cap.material.opacity,glowOpacity=glow.material.uniforms.uGlowOpacity.value;
  const visible=new Set();for(const name of ['port-engine-cap','port-dome-inner-backing','port-dome-red-glow','port-dome-inner-housing','port-engine-concave-inner-cap','port-dome-gray-retaining-rim','port-cap-lines','port-dome-internal-lights','port-dome-red-sphere-lights','port-dome-front-red-lights'])ship.model.getObjectByName(name)?.traverse(o=>{if(o.isMesh)visible.add(o);});
  ship.model.traverse(o=>{if(o.isMesh)o.visible=visible.has(o);});ship.model.updateWorldMatrix(true,true);
  const center=cap.localToWorld(new T.Vector3()),camera=new T.OrthographicCamera(-.095,.095,.095,-.095,.001,100);camera.position.copy(center).add(new T.Vector3(-.20,.06,-1));camera.lookAt(center);camera.updateWorldMatrix(true,false);
  const sheet=document.createElement('canvas');sheet.width=1500;sheet.height=500;const ctx=sheet.getContext('2d'),images=[];
  for(const [i,settings]of [[.20,1,.55],[.44,1,.55],[.44,1.6,.85]].entries()){
   cap.material.opacity=settings[0];glow.material.uniforms.uGlowOpacity.value=settings[2];lamps.forEach((lamp,k)=>lamp.material.color.copy(bright[k]).multiplyScalar(settings[1]/1.6));
   ship.renderer.setSize(500,500,false);ship.renderer.render(ship.scene,camera);ctx.fillStyle='#091117';ctx.fillRect(i*500,0,500,500);ctx.drawImage(ship.renderer.domElement,i*500,0);
   images.push(ctx.getImageData(i*500,0,500,500).data);ctx.font='14px Consolas';ctx.fillStyle='#ffcf8a';ctx.fillText(['BEFORE','DENSER SHELL / ORIGINAL LIGHTS','DENSER SHELL / BRIGHTER LIGHTS'][i],i*500+12,24);
  }
  let brighterPixels=0;for(let i=0;i<images[2].length;i+=4)if(images[2][i]+images[2][i+1]+images[2][i+2]>images[1][i]+images[1][i+1]+images[1][i+2]+10)brighterPixels++;
  return {opacity,glowOpacity,brighterPixels,pulse,stable,changed,lamps:lamps.length,glError:ship.renderer.getContext().getError(),image:sheet.toDataURL('image/png')};
 });
 assert.equal(result.opacity,.44);assert.equal(result.glowOpacity,.85);assert.equal(result.lamps,48);assert(result.brighterPixels>1000,'internal brightness compensates visibly through the denser glass');assert.deepEqual(result.pulse,result.stable);assert.notDeepEqual(result.pulse,result.changed);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 if(process.argv.includes('--preview')){const file=path.join(os.tmpdir(),'st-command-dome-opacity.png');fs.writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));console.log('Preview: '+file);}
 console.log('Passed: denser outer domes, visibly brighter internal glow and lamps, animated light variation, stable paused lighting and clean WebGL rendering.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
