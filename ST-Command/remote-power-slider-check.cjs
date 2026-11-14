const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{const a=STCommand;a.state.throttle=0;a.away.launchShuttle();a.state.paused=true;for(const game of a.games)game.loop.stop();Object.assign(a.away.state,{phase:'flight',x:.2,y:.5,z:110.3,launchAttached:false,launchLiftRemaining:0,departureCameraPending:false,departureCameraFade:null});Object.assign(a.state,{throttle:23,speed:.05,autopilot:false});EnterpriseInset.render(a.away.state,a.state);});
 const slider=page.locator('#enterprise-inset-power');assert(await slider.isVisible());
 for(const size of [{width:1600,height:1000},{width:600,height:900}]){
  await page.setViewportSize(size);const b=await slider.boundingBox();assert(b&&b.width>100&&b.x>=0&&b.x+b.width<=size.width);
  await page.mouse.click(b.x+b.width*.8,b.y+b.height/2);
  assert(await page.evaluate(()=>STCommand.away.state.bridgeState.throttle>0),'pointer sets Enterprise power');
 }
 const result=await page.evaluate(()=>{
  const a=STCommand,m=a.away.state,s=a.state,input=document.getElementById('enterprise-inset-power'),out=[];
  for(const value of [60,-40,0]){
   input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
   out.push({requested:value,power:m.bridgeState.throttle,manual:m.carrier.manual,label:document.getElementById('enterprise-inset-power-output').value,shuttlePower:s.throttle,shuttleSpeed:s.speed});
  }
  m.bridgeState.throttle=37;EnterpriseInset.render(m,s);const synced=input.value;
  input.value=60;input.dispatchEvent(new Event('input',{bubbles:true}));a.away.tick(.1);
  return {out,synced,speed:m.carrier.speed};
 });
 for(const r of result.out){assert.equal(r.power,r.requested);assert(r.manual);assert.equal(r.label,r.requested+'%');assert.equal(r.shuttlePower,23);assert.equal(r.shuttleSpeed,.05);}
 assert.equal(result.synced,'37');assert(result.speed>0);
 await slider.focus();await page.keyboard.press('Numpad8');
 assert.equal(await page.evaluate(()=>STCommand.away.state.bridgeState.throttle),0,'all stop works while slider focused');
 await page.evaluate(()=>{EnterpriseInset.render(STCommand.away.state,STCommand.state);});assert.equal(await slider.inputValue(),'0');
 await page.evaluate(()=>{STCommand.reset();EnterpriseInset.render(STCommand.away.state,STCommand.state);});assert(await page.locator('#enterprise-inset').isHidden());assert.deepEqual(errors,[]);
 console.log('Passed: desktop/mobile pointer input, forward/reverse power, independent shuttle controls, live synchronization, engine response, focused all stop and reset.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
