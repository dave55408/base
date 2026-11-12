const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
  const preserved=JSON.parse(fs.readFileSync(path.join(__dirname,'assets/reference/movie-study/original-model-sha256.json'),'utf8'));
  for(const [name,hash] of Object.entries(preserved))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex'),hash,'original '+name+' stays unchanged');
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:2048,height:1152}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  const result=await page.evaluate(async()=>{
    const original=createEnterpriseRenderer(),movie=createMovieEnterpriseRenderer();await Promise.all([original.ready,movie.ready]);
    const comparison=document.createElement('canvas');comparison.width=1800;comparison.height=1500;const cc=comparison.getContext('2d');
    const sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1500;const sc=sheet.getContext('2d');
    const views=[['STARBOARD',[5,.25,-.66]],['TOP',[0,5,-.66]],['FORWARD QUARTER',[2.7,1.3,-3.6]],['AFT QUARTER',[2.7,1.2,2.8]],['UNDERSIDE',[0,-5,-.66]],['AFT / CLAMSHELL',[0,.25,5]]];
    const counts=[];
    function render(ship,view,w=900,h=500){
      const tile=document.createElement('canvas');tile.width=w;tile.height=h;const c=tile.getContext('2d'),[name,pos]=view;
      ship.draw(c,w,h,{x:pos[0],z:110+pos[1],y:pos[2],bank:0},{heading:0,pitch:0,time:0,bayDoorOpen:1});
      const half=name==='AFT / CLAMSHELL'?.9:1.85,cam=new AlpineThree.OrthographicCamera(-half,half,half*h/w,-half*h/w,.01,100);
      cam.position.set(...pos);if(name==='TOP')cam.up.set(-1,0,0);else if(name==='UNDERSIDE')cam.up.set(1,0,0);cam.lookAt(0,.25,-.66);
      ship.renderer.render(ship.scene,cam);c.clearRect(0,0,w,h);c.drawImage(ship.renderer.domElement,0,0,w,h);return tile;
    }
    function tile(c,canvas,x,y,label){c.fillStyle='#070c10';c.fillRect(x,y,900,500);c.drawImage(canvas,x,y);c.fillStyle='#dfc69b';c.font='17px Arial';c.fillText(label,x+22,y+30);}
    for(let i=0;i<views.length;i++){
      const frame=render(movie,views[i]),p=frame.getContext('2d').getImageData(0,0,900,500).data;let n=0;
      for(let j=3;j<p.length;j+=4)if(p[j]>128)n++;counts.push(n);
      tile(sc,frame,i%2*900,Math.floor(i/2)*500,'MOVIE REFERENCE · '+views[i][0]);
    }
    for(const [i,v] of [views[0],views[2],views[4]].entries()){
      tile(cc,render(original,v),0,i*500,'ORIGINAL · '+v[0]);
      tile(cc,render(movie,v),900,i*500,'MOVIE REFERENCE · '+v[0]);
    }
    return {movie:sheet.toDataURL('image/jpeg',.94),comparison:comparison.toDataURL('image/jpeg',.94),counts};
  });
  assert(result.counts.every(n=>n>5000),'movie model is visible from every flight/reference angle');
  for(const [name,data] of [['preview-movie-enterprise.jpg',result.movie],['preview-enterprise-comparison.jpg',result.comparison]])fs.writeFileSync(path.join(__dirname,name),Buffer.from(data.split(',')[1],'base64'));
  const picker=page.locator('#enterprise-model');assert.equal(await picker.inputValue(),'movie');
  const fit=await picker.boundingBox(),header=await page.locator('.forward>.display-title').boundingBox();assert(fit.x>=header.x&&fit.x+fit.width<=header.x+header.width&&fit.y+fit.height<=header.y+header.height,'model selector fits the existing viewscreen header');
  await page.locator('#stop').click();await page.locator('#launch-shuttle').click();await page.evaluate(()=>{STCommand.state.paused=true;});
  await page.waitForFunction(()=>STCommand.games[0].scene.getScene('Forward').enterpriseRenderer?.model.userData.variant==='movie');
  const flight=await page.evaluate(()=>({x:STCommand.away.state.x,y:STCommand.away.state.y,z:STCommand.away.state.z,phase:STCommand.away.state.phase,target:STCommand.away.state.target}));
  await picker.selectOption('original');await page.evaluate(()=>{const scene=STCommand.games[0].scene.getScene('Forward');STCommand.away.render(scene,scene.scale.width,scene.scale.height);});
  assert(await page.evaluate(()=>{const scene=STCommand.games[0].scene.getScene('Forward');return scene.enterpriseRenderer===scene.enterpriseRenderers.original;}));
  assert.deepEqual(await page.evaluate(()=>({x:STCommand.away.state.x,y:STCommand.away.state.y,z:STCommand.away.state.z,phase:STCommand.away.state.phase,target:STCommand.away.state.target})),flight,'switching models preserves the sortie');
  await picker.selectOption('movie');await page.evaluate(()=>{const scene=STCommand.games[0].scene.getScene('Forward');STCommand.away.render(scene,scene.scale.width,scene.scale.height);});
  assert(await page.evaluate(()=>{const scene=STCommand.games[0].scene.getScene('Forward');return scene.enterpriseRenderer===scene.enterpriseRenderers.movie;}),'movie renderer is reused after switching back');
  await page.reload();await page.waitForFunction(()=>window.EnterpriseModels);assert.equal(await picker.inputValue(),'movie','model preference survives reload');
  assert.deepEqual(errors,[]);
  console.log(process.argv.includes('--image')?result.movie:process.argv.includes('--comparison')?result.comparison:'Passed: independent movie model, unchanged original files, six rendered angles, compact selector, live switching with flight preserved, and saved preference.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

