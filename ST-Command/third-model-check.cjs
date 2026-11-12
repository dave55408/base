const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const preserved=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/reference/third-model-preserved.json'),'utf8'));
 for(const [name,hash]of Object.entries(preserved))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex'),hash,name+' remains unchanged');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|texture/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer&&window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
   ShipTextures.quality='high';const second=createMovieEnterpriseRenderer(),third=createThirdEnterpriseRenderer();await Promise.all([second.ready,third.ready]);
   const T=AlpineThree,near=(a,b)=>Math.abs(a-b)<1e-6;
   function bounds(ship,name){const root=ship.model.getObjectByName(name),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];root.updateWorldMatrix(true,true);
    root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray();v.forEach((n,k)=>{min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);});}});return {min,max,size:max.map((n,i)=>n-min[i])};}
   function signature(ship,name){const root=ship.model.getObjectByName(name),positions=[];root.updateWorldMatrix(true,true);root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)positions.push(...new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray());});return JSON.stringify(positions);}
   let finite=true,indexed=true;third.model.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal','uv','hullPanelUv']){const a=o.geometry.attributes[key];if(a)for(const n of a.array)if(!Number.isFinite(n))finite=false;}const index=o.geometry.index;if(index)for(const n of index.array)if(n<0||n>=o.geometry.attributes.position.count)indexed=false;});
   const fin=bounds(third,'port-aft-engine-fin'),inboard=bounds(third,'port-inboard-engine-fin'),pylon=bounds(third,'port-engine-strut');
   const stationary=['movie-saucer','port-engine-cap','starboard-engine-cap','port-engine-outer-tube','starboard-engine-outer-tube'];
   const preservedBounds=stationary.every(name=>bounds(second,name).min.every((n,i)=>near(n,bounds(third,name).min[i]))&&bounds(second,name).max.every((n,i)=>near(n,bounds(third,name).max[i])));
   const doorMatches=[];for(const open of [0,.25,.5,1]){second.setBayDoorOpen(open);third.setBayDoorOpen(open);doorMatches.push(signature(second,'shuttle-bay-clamshell-doors')===signature(third,'shuttle-bay-clamshell-doors'));}
   const interiorMatches=signature(second,'reference-bay-interior')===signature(third,'reference-bay-interior');
   const hull2=second.model.getObjectByName('secondary-hull'),hull3=third.model.getObjectByName('secondary-hull'),p2=hull2.geometry.attributes.position,p3=hull3.geometry.attributes.position;let sternRetraction=0;
   for(let i=0;i<p2.count;i++)if(Math.abs(p2.getY(i))<1e-7){const a=new T.Vector3().fromBufferAttribute(p2,i).applyMatrix4(hull2.matrixWorld),b=new T.Vector3().fromBufferAttribute(p3,i).applyMatrix4(hull3.matrixWorld);sternRetraction=Math.max(sternRetraction,a.z-b.z);}
   const shoulderAdvance=bounds(second,'secondary-hull').min[2]-bounds(third,'secondary-hull').min[2];
   const detailCounts={saucer:[second,third].map(s=>s.model.getObjectByName('movie-saucer').geometry.attributes.position.count),deck:[second,third].map(s=>s.model.getObjectByName('upper-saucer-teardrop').geometry.attributes.position.count),bowl:[second,third].map(s=>s.model.getObjectByName('movie-underside-bowl').geometry.attributes.position.count)};
   const reference=new Image();reference.src='assets/reference/image-1444/enterprise-orthos.png';await reference.decode();
   const sheet=document.createElement('canvas');sheet.width=2048;sheet.height=1152;sheet.getContext('2d').drawImage(reference,0,0,2048,1152);
   const out=document.createElement('canvas');out.width=1800;out.height=1420;const c=out.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1800,1420);c.font='18px Arial';c.fillStyle='#111';['REFERENCE','SECOND MODEL','THIRD MODEL'].forEach((s,i)=>c.fillText(s,i*600+15,25));
   const specs=[['STARBOARD',[540,450,970,250],'side'],['TOP',[540,15,970,430],'top'],['BOTTOM',[550,700,970,420],'bottom'],['FRONT',[1570,450,450,250],'front'],['BACK',[20,450,450,250],'back']];let row=38;
   for(const [name,[x,y,w,h],kind]of specs){
    const scale=Math.min(580/w,250/h),dw=w*scale,dh=h*scale,unit=1.36/419;c.fillStyle='#111';c.font='13px Arial';c.fillText(name,12,row+14);c.drawImage(sheet,x,y,w,h,10,row+22,dw,dh);
    for(const [i,ship]of [second,third].entries()){
     ship.setBayDoorOpen(0);const cam=new T.OrthographicCamera(-w*unit/2,w*unit/2,h*unit/2,-h*unit/2,.01,100);
     if(kind==='side'){const z=(823.16-x-w/2)*unit,cy=(642-y-h/2)*unit;cam.position.set(10,cy,z);cam.lookAt(0,cy,z);}
     else if(kind==='top'){const cx=(y+h/2-235.2)*unit,z=(823.16-x-w/2)*unit;cam.position.set(cx,10,z);cam.up.set(-1,0,0);cam.lookAt(cx,0,z);}
     else if(kind==='bottom'){const cx=(909.6-y-h/2)*unit,z=(823.16-x-w/2)*unit;cam.position.set(cx,-10,z);cam.up.set(1,0,0);cam.lookAt(cx,0,z);}
     else{const cx=(kind==='front'?-1:1)*(x+w/2-(kind==='front'?1790.4:241.6))*unit,cy=(642-y-h/2)*unit;cam.position.set(cx,cy,kind==='front'?-10:10);cam.lookAt(cx,cy,0);}
     ship.renderer.setClearColor(0xffffff,1);ship.renderer.setSize(w,h,false);ship.renderer.render(ship.scene,cam);c.drawImage(ship.renderer.domElement,(i+1)*600+10,row+22,dw,dh);
    }
    row+=dh+40;
   }
   const dishDiameter=bounds(third,'deflector-dish').size[0],collarDiameter=bounds(third,'movie-deflector-collar').size[0];
   const glError=third.renderer.getContext().getError(),maps=enterpriseThirdMaps;second.dispose();const sharedSurvives=maps.top.image.width===2048;third.dispose();
   return {finite,indexed,preservedBounds,doorMatches,interiorMatches,sternRetraction,shoulderAdvance,detailCounts,finLength:fin.size[2],finStationError:Math.abs(inboard.min[2]-(pylon.min[2]+pylon.max[2])/2),dishDiameter,dishCollarRatio:dishDiameter/collarDiameter,glError,sharedSurvives,revisionCount:third.model.userData.revisions.length,preview:out.toDataURL().split(',')[1]};
  });
  assert(result.finite&&result.indexed);assert(result.preservedBounds);assert(result.doorMatches.every(Boolean)&&result.interiorMatches);assert(Math.abs(result.sternRetraction)<1e-6,'aft hull retains its shared fairing junction');assert(Math.abs(result.shoulderAdvance-.034)<1e-5);assert(Math.abs(result.finLength-.339)<1e-5);assert(result.finStationError<1e-6);assert(result.sharedSurvives);assert.equal(result.revisionCount,11);assert.equal(result.glError,0);
  assert(Math.abs(result.dishCollarRatio-.752)<.001,'reflector fills three quarters of collar');
  for(const counts of Object.values(result.detailCounts))assert(counts[1]>counts[0]*3,'curved profiles are subdivided');
  fs.writeFileSync(path.join(__dirname,'preview-third-model-reference.png'),Buffer.from(result.preview,'base64'));delete result.preview;
  // Exercise the live factory, both texture settings, cameras and persistence.
  await page.locator('#enterprise-model').selectOption('third');await page.locator('#stop').click();await page.locator('#launch-shuttle').click();
  await page.evaluate(()=>{STCommand.state.paused=true;for(const g of STCommand.games)g.loop.stop();});
  for(const quality of ['low','high']){
   await page.locator('#texture-quality').selectOption(quality);
   const live=await page.evaluate(async quality=>{
    const a=STCommand,scene=a.games[0].scene.getScene('Forward'),ship=EnterpriseModels.rendererFor(scene);await ship.ready;
    const before=JSON.stringify([a.away.state.x,a.away.state.y,a.away.state.z,a.state.heading,a.state.pitch]);
    const ctx=document.createElement('canvas').getContext('2d');
    ship.draw(ctx,640,360,{...a.away.state,cameraView:'excursion'},{...a.state,time:0});
    return {variant:ship.model.userData.variant,width:enterpriseThirdMaps.top.image.width,glError:ship.renderer.getContext().getError(),craft:!!ship.excursionShuttle,unchanged:before===JSON.stringify([a.away.state.x,a.away.state.y,a.away.state.z,a.state.heading,a.state.pitch]),cached:Object.keys(scene.enterpriseRenderers).length};
   },quality);
   assert.equal(live.variant,'third');assert.equal(live.width,quality==='low'?1024:2048);assert(live.craft&&live.unchanged);assert.equal(live.cached,1);assert.equal(live.glError,0);
  }
  for(const model of ['movie','original','third']){await page.locator('#enterprise-model').selectOption(model);assert.equal(await page.locator('#enterprise-model').inputValue(),model);}
  await page.reload();assert.equal(await page.locator('#enterprise-model').inputValue(),'third');await page.setViewportSize({width:430,height:900});assert(await page.locator('#enterprise-model').isVisible());assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
  const local=await browser.newPage();local.on('pageerror',e=>errors.push(e.message));await local.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  assert.equal(await local.evaluate(async()=>{EnterpriseModels.selected='third';const ship=EnterpriseModels.rendererFor({});await ship.ready;ship.renderer.render(ship.scene,ship.camera);return ship.renderer.getContext().getError();}),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result));console.log('Passed: third-model geometry, preserved earlier models, five reference views, bay animation/interior, live cameras, texture modes, cleanup, selector persistence, mobile and direct-file loading.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
