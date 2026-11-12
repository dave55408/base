const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;ship.model.updateWorldMatrix(true,true);const T=AlpineThree;
  // Pixel landmarks measured on the supplied starboard drawing, normalized
  // to the existing 2048 x 1152 sheet. These are independent of model settings.
  const unit=1.36/419,screenX=z=>823.16-z/unit,screenY=y=>642-y/unit;
  function bounds(name){const root=ship.model.getObjectByName(name),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray();v.forEach((n,k)=>{min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);});}});return {min,max};}
  const saucer=bounds('movie-saucer'),body=bounds('secondary-hull'),engines=['port','starboard'].map(side=>bounds(side+'-movie-nacelle'));
  const neck=ship.model.getObjectByName('movie-dorsal-connector'),np=neck.geometry.attributes.position,upper=[];
  for(let i=0;i<np.count;i++)if(np.getY(i)>.35){const v=new T.Vector3().fromBufferAttribute(np,i).applyMatrix4(neck.matrixWorld);upper.push(screenX(v.z));}
  const pylons=['port','starboard'].map(side=>bounds(side+'-engine-strut')).map(b=>({aft:screenX(b.max[2]),front:screenX(b.min[2])}));
  const landmarks={saucerAft:screenX(saucer.max[2]),saucerFront:screenX(saucer.min[2]),bodyAft:screenX(body.max[2]),bodyFront:screenX(body.min[2]),bodyTop:screenY(body.max[1]),bodyBottom:screenY(body.min[1]),neckAft:Math.min(...upper),neckFront:Math.max(...upper),pylons,engines:engines.map(b=>({aft:screenX(b.max[2]),front:screenX(b.min[2])}))};
  const cam=new T.OrthographicCamera(-970*unit/2,970*unit/2,250*unit/2,-250*unit/2,.001,100),cz=(823.16-1025)*unit,cy=(642-575)*unit;
  cam.position.set(10,cy,cz);cam.lookAt(0,cy,cz);ship.renderer.setClearColor(0xffffff,1);ship.renderer.setSize(1940,500,false);ship.renderer.render(ship.scene,cam);
  const out=document.createElement('canvas');out.width=1940;out.height=1000;const c=out.getContext('2d'),reference=new Image();reference.src='assets/reference/image-1444/enterprise-orthos.png';await reference.decode();
  const normalized=document.createElement('canvas');normalized.width=2048;normalized.height=1152;normalized.getContext('2d').drawImage(reference,0,0,2048,1152);
  c.drawImage(normalized,540,450,970,250,0,0,1940,500);c.drawImage(ship.renderer.domElement,0,500);
  return {landmarks,glError:ship.renderer.getContext().getError(),image:out.toDataURL()};
 });
 const near=(n,target,label)=>assert(Math.abs(n-target)<=5,label+': '+n+' vs '+target);
 const p=result.landmarks;near(p.saucerAft,1069,'saucer aft edge');near(p.saucerFront,1488,'saucer front edge');
 // The annotated revision sets the cylinder shoulder back by .034 model
 // units (about 10.5 reference pixels); the sensor and pennant tabs stay forward.
 near(p.bodyAft,833,'main cylinder aft junction');near(p.bodyFront,1135,'revised main cylinder shoulder');near(p.bodyTop,595,'main hull upper contour');near(p.bodyBottom,689,'main hull lower contour');
 for(const engine of p.engines){near(engine.aft,552,'engine rear cowl');near(engine.front,1057,'engine collector tip');}
 near(p.neckAft,1085,'neck aft upper joint');near(p.neckFront,1191,'neck forward upper joint');
 for(const pylon of p.pylons){near(pylon.aft,897,'pylon aft edge');near(pylon.front,930,'pylon forward edge');}
 assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'preview-reference-alignment.png'),Buffer.from(result.image.split(',')[1],'base64'));
 console.log('Passed: revised cylinder shoulder and preserved reference landmarks for saucer, hull height, neck, pylons and engines.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
