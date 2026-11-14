const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{const a=STCommand;a.stop();a.away.launchShuttle();a.state.paused=true;for(const g of a.games)g.loop.stop();Object.assign(a.away.state,{phase:'flight',freeSpace:true,target:'ship',x:.2,y:.5,z:110.3,launchAttached:false,launchStage:null,launchLiftRemaining:0});EnterpriseInset.render(a.away.state,a.state);});
 const panel=page.locator('#enterprise-inset'),handle=panel.locator('.enterprise-inset-title');await handle.scrollIntoViewIfNeeded();let b=await handle.boundingBox();
 await page.mouse.move(b.x+30,b.y+b.height/2);await page.mouse.down();await page.mouse.move(320,140,{steps:8});await page.mouse.up();
 let rect=await panel.boundingBox();assert(rect.x>200&&rect.x<340&&rect.y>100&&rect.y<150,'title drags the helm panel freely outside its original display');assert.equal(await panel.evaluate(p=>p.parentElement===document.body),true);
 b=await handle.boundingBox();await page.mouse.move(b.x+20,b.y+8);await page.mouse.down();await page.mouse.move(1595,995,{steps:6});await page.mouse.up();rect=await panel.boundingBox();assert(rect.x+rect.width<=1595&&rect.y+rect.height<=995,'drag keeps all controls inside the window');
 await page.setViewportSize({width:600,height:900});rect=await panel.boundingBox();assert(rect.x>=5&&rect.y>=5&&rect.x+rect.width<=595&&rect.y+rect.height<=895,'floating helm reclamps after resizing');
 const slider=panel.locator('#enterprise-inset-power');await slider.fill('35');assert.equal(await page.evaluate(()=>STCommand.away.state.bridgeState.throttle),35,'power remains interactive after dragging');
 await handle.dblclick();assert.equal(await panel.evaluate(p=>p.parentElement.classList.contains('tactical')),true,'double-click restores the original dock');
 await page.setViewportSize({width:1600,height:1000});
 const result=await page.evaluate(()=>{
  const a=STCommand,canvas=document.createElement('canvas'),gallery=document.createElement('canvas');gallery.width=1800;gallery.height=1080;const out=gallery.getContext('2d'),checks=[];
  const locations=[[0,.25,110],[.8,2,111.2],[-8,-5,106],[300,500,250]],angles=[[-25,52],[65,-45],[180,82],[-120,-82]];
  for(const [w,h]of [[900,360],[320,560],[1000,220]])for(const [yaw,tilt]of angles)for(const [x,y,z]of locations){
   canvas.width=w;canvas.height=h;const m={...a.away.state,x,y,z,bank:.8},s={...a.state,heading:123,pitch:32},view={yaw,tilt};
   const fit=drawShuttleApproachMap(canvas.getContext('2d'),w,h,m,s,view);
   for(const bounds of [fit.enterpriseBounds,fit.shuttleBounds])if(bounds.left<fit.viewport.left-1e-6||bounds.right>fit.viewport.right+1e-6||bounds.top<fit.viewport.top-1e-6||bounds.bottom>fit.viewport.bottom+1e-6)throw Error('A complete ship was clipped: '+JSON.stringify({w,h,yaw,tilt,x,y,z,fit}));
   if(Math.abs(fit.zoom-fit.maxZoom)>1e-8)throw Error('Default view must use the largest fitting zoom');
   view.shuttleApproachZoom=fit.maxZoom*.55;const smaller=drawShuttleApproachMap(canvas.getContext('2d'),w,h,m,s,view);if(smaller.zoom>=fit.zoom)throw Error('Manual zoom-out must remain available');
   checks.push({w,h,yaw,tilt,zoom:fit.zoom});
  }
  const map=a.games[2].scene.getScene('Map'),galaxyZoom=map.zoom;map.update();const initial=map.shuttleMapTelemetry;
  document.getElementById('map-zoom-out').click();map.update();const smaller=map.shuttleMapTelemetry.zoom;if(!(smaller<initial.zoom))throw Error('Zoom-out button must use the attitude zoom');
  map.setZoom(initial.maxZoom+100);map.update();if(Math.abs(map.shuttleMapTelemetry.zoom-map.shuttleMapTelemetry.maxZoom)>1e-8)throw Error('Zoom-in must stop at the full-ship fit limit');
  document.getElementById('map-home').click();map.update();if(map.shuttleApproachZoom!==null)throw Error('Reset restores automatic fitting');if(map.zoom!==galaxyZoom)throw Error('Attitude zoom must not change galaxy zoom');
  const examples=[{x:0,y:.25,z:110,yaw:-25,tilt:52},{x:2,y:5,z:112,yaw:65,tilt:-45},{x:-8,y:-5,z:106,yaw:180,tilt:52},{x:300,y:500,z:250,yaw:-120,tilt:-45}];
  for(const [i,example]of examples.entries()){canvas.width=900;canvas.height=540;drawShuttleApproachMap(canvas.getContext('2d'),900,540,{...a.away.state,...example,bank:.8},{...a.state,heading:123,pitch:32},example);out.drawImage(canvas,i%2*900,Math.floor(i/2)*540);}
  return {count:checks.length,image:gallery.toDataURL('image/png').split(',')[1]};
 });
 const preview=path.join(require('node:os').tmpdir(),'st-command-attitude-auto-fit.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));console.log('Preview: '+preview);assert.deepEqual(errors,[]);console.log('Passed: draggable/re-dockable helm, resize clamping, working power slider, '+result.count+' full-ship fit scenarios, dynamic zoom limit, zoom-out and reset.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
