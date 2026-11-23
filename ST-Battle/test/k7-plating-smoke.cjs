/* Browser preview: node test/k7-plating-smoke.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]})),server=require('../server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
  const result=await page.evaluate(()=>{
   const s=battleScene,T=s.T,view=new T.Scene(),station=s.station.clone(true);station.position.set(0,0,0);station.rotation.set(0,.2,0);view.add(station);view.background=new T.Color(0x050914);
   view.add(new T.HemisphereLight(0xa6cee8,0x1d1429,1.8));const sun=new T.DirectionalLight(0xe4f3ff,3.4);sun.position.set(-3000,4000,-800);view.add(sun);
   const fill=new T.DirectionalLight(0x5597df,2.7);fill.position.set(1200,300,2000);view.add(fill);s.renderer.setPixelRatio(1);s.renderer.setSize(1920,1080,false);
   const camera=new T.PerspectiveCamera(46,16/9,.5,65000),render=(position,target)=>{camera.position.set(...position);camera.lookAt(new T.Vector3(...target));s.renderer.render(view,camera);return s.renderer.domElement.toDataURL().split(',')[1];};
   const whole=render([720,430,850],[0,50,0]),cone=render([140,225,180],[0,185,0]);let gridlines=0,plated=0;station.traverse(o=>{if(o.isLineSegments)gridlines++;if(o.isMesh&&o.material.isMeshStandardMaterial&&o.material.map)plated++;});
   const hangar=render([165,-80,230],[0,-100,0]),door=station.getObjectByName('K7 curved hangar door'),positions=door.geometry.getAttribute('position');
   let radiusError=0,minZ=Infinity,maxZ=-Infinity;
   for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);radiusError=Math.max(radiusError,Math.abs(Math.hypot(x,z)-46.25));minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
   return {whole,cone,hangar,radiusError,doorCurveDepth:maxZ-minZ,gridlines,plated,glError:s.renderer.getContext().getError()};
  });
  for(const key of ['whole','cone','hangar'])fs.writeFileSync(path.resolve(__dirname,'../exports/k7-plating-'+key+'.png'),Buffer.from(result[key],'base64'));
  assert(result.radiusError<.00001);assert(result.doorCurveDepth>4);
  assert.equal(result.gridlines,4);assert(result.plated>20);assert.equal(result.glError,0);assert.deepEqual(errors,[]);console.log(JSON.stringify({gridlines:result.gridlines,plated:result.plated,errors}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
