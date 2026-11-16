const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  await page.evaluate(()=>STCommand.games.forEach(g=>g.loop.stop()));
  await page.keyboard.press('h');await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert(await page.evaluate(()=>BridgeHatch.open&&document.getElementById('door-status-hud').hidden),'airlock opens without a viewscreen message');
  await page.keyboard.press('h');await page.waitForFunction(()=>document.getElementById('door-status-hud').hidden);
  await page.evaluate(()=>Object.assign(STCommand.away.state,{phase:'flight',hangarDoorTarget:1,bayDoorOpen:.3,garageDoorTarget:1,garageDoorOpen:.2}));
  await page.waitForFunction(()=>document.getElementById('door-status-hud').textContent==='Opening Hangar Door\nOpening Garage');
  await page.screenshot({path:path.join(os.tmpdir(),'st-command-door-messages.png')});
  await page.evaluate(()=>Object.assign(STCommand.away.state,{bayDoorOpen:1,garageDoorOpen:1}));await page.waitForFunction(()=>document.getElementById('door-status-hud').hidden);
  const result=await page.evaluate(async()=>{
   const T=AlpineThree,ship=createThirdEnterpriseRenderer();await ship.ready;
   const port=ship.model.getObjectByName('aft-bridge-docking-port'),room=port.getObjectByName('bridge-circular-room'),inner=room.getObjectByName('bridge-corridor-inner-door');
   BridgeHatch.open=false;port.setHatchOpen(0);port.updateHatch(0);BridgeHatch.open=true;
   for(let i=1;i<=9;i++)port.updateHatch(i/10);
   const before={outer:port.userData.hatchOpen,inner:port.userData.innerDoorOpen};
   port.updateHatch(1);const atOne=port.userData.innerDoorOpen;
   for(let i=11;i<=16;i++)port.updateHatch(i/10);
   const halfway={open:inner.userData.open,left:room.getObjectByName('bridge-inner-door-left').position.x,right:room.getObjectByName('bridge-inner-door-right').position.x};
   const scene=new T.Scene();let snapshot=room.clone(true);snapshot.visible=true;scene.add(snapshot);scene.add(new T.HemisphereLight(0xffffff,0x555555,2));
   const camera=new T.PerspectiveCamera(55,1.6,.0001,10);camera.position.set(0,.0005,.015);camera.lookAt(0,-.001,room.userData.circularRoom.entranceZ);
   ship.renderer.setSize(960,600,false);ship.renderer.setClearColor(0x101820,1);
   const canvas=document.createElement('canvas');canvas.width=2880;canvas.height=600;const c=canvas.getContext('2d');
   for(const [i,open]of [0,.5,1].entries()){
    room.setInnerDoorOpen(open);scene.remove(snapshot);snapshot=room.clone(true);snapshot.visible=true;scene.add(snapshot);
    ship.renderer.render(scene,camera);c.drawImage(ship.renderer.domElement,960*i,0);c.fillStyle='#ffffff';c.font='20px sans-serif';c.fillText(['CLOSED','SPLITTING AT CENTER','OPEN'][i],960*i+20,30);
   }
   // Restore the animated state after the isolated render snapshots.
   for(let i=17;i<=24;i++)port.updateHatch(i/10);
   const fullyOpen=port.userData.innerDoorOpen;
   BridgeHatch.open=false;for(let i=25;i<=38;i++)port.updateHatch(i/10);
   const innerClosed={outer:port.userData.hatchOpen,inner:port.userData.innerDoorOpen};
   for(let i=39;i<=54;i++)port.updateHatch(i/10);
   const waiting=port.userData.hatchOpen;
   for(let i=55;i<=58;i++)port.updateHatch(i/10);
   const outerClosing=port.userData.hatchOpen;
   for(let i=59;i<=72;i++)port.updateHatch(i/10);
   const closed={outer:port.userData.hatchOpen,inner:port.userData.innerDoorOpen};
   port.setInteriorView(true);port.setHatchOpen(1);BridgeHatch.open=true;let testTime=7.3;port.updateHatch(testTime);BridgeHatch.open=false;const advance=seconds=>{for(let i=0;i<Math.round(seconds*100);i++)port.updateHatch(testTime+=.01);};advance(1.3);const insideOuterClosed={outer:port.userData.hatchOpen,inner:port.userData.innerDoorOpen};advance(1.7);const insideWaiting=port.userData.innerDoorOpen;advance(.8);const insideClosing=port.userData.innerDoorOpen;advance(1);const insideClosed={outer:port.userData.hatchOpen,inner:port.userData.innerDoorOpen};const result={insideOuterClosed,insideWaiting,insideClosing,insideClosed,before,atOne,halfway,fullyOpen,innerClosed,waiting,outerClosing,closed,roof:room.getObjectByName('bridge-room-entrance-ceiling').material.color.getHex(),glError:ship.renderer.getContext().getError(),image:canvas.toDataURL().split(',')[1]};ship.dispose();return result;
  });
  assert(result.before.outer>0&&result.before.inner===0);assert(result.atOne<1e-10);assert(result.halfway.open>.4&&result.halfway.open<.6);assert(result.halfway.left<0&&result.halfway.right>0);assert(Math.abs(result.halfway.left+result.halfway.right)<1e-10);assert.equal(result.fullyOpen,1);assert.deepEqual(result.closed,{outer:0,inner:0});assert.equal(result.roof,0x8f2425);assert.equal(result.glError,0);assert.deepEqual(errors,[]);
  assert.deepEqual(result.insideOuterClosed,{outer:0,inner:1});assert.equal(result.insideWaiting,1);assert(result.insideClosing>0&&result.insideClosing<1);assert.deepEqual(result.insideClosed,{outer:0,inner:0});assert.deepEqual(result.innerClosed,{outer:1,inner:0});assert.equal(result.waiting,1);assert(result.outerClosing>0&&result.outerClosing<1);
  const preview=path.join(os.tmpdir(),'st-command-inner-door.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));console.log('Passed: opening messages, delayed opening, red door closes first with two-second wait before outer closure, opposite sliding panels, red roof, no browser/shader errors.');console.log(preview);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
