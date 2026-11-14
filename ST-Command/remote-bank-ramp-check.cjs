const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
 await page.evaluate(()=>{STCommand.stop();STCommand.away.launchShuttle();STCommand.state.paused=true;for(const g of STCommand.games)g.loop.stop();});
 for(const [code,key,field,sign,max] of [['Numpad1','1','turnBank',-1,10],['Numpad3','3','turnBank',1,10],['Numpad5','5','pitch',-1,6],['Numpad2','2','pitch',1,6],['Numpad0','0','manualRoll',-1,18],['NumpadDecimal','.','manualRoll',1,18]]){
  await page.evaluate(()=>{const a=STCommand,m=a.away.state;Object.assign(m,{phase:'flight',launchAttached:false,launchLiftRemaining:0});Object.assign(m.carrier,{manual:true,moving:false,speed:0,pitch:0,roll:0,manualRoll:0,turnBank:0,returningNeutral:false,yawHeld:0,pitchHeld:0,rollHeld:0,yawInput:0,pitchInput:0,rollInput:0});a.state.throttle=0;a.state.speed=0;});
  await page.dispatchEvent('body','keydown',{code,key});
  const rates=await page.evaluate(field=>{const a=STCommand,c=a.away.state.carrier,step=()=>{const before=c[field];a.away.tick(.05);return (c[field]-before)/.05*(field==='pitch'?1:180/Math.PI);};const first=step();for(let n=0;n<5;n++)step();const middle=step();for(let n=0;n<8;n++)step();const full=step();return {first,middle,full};},field);
  assert(rates.first*sign>0&&rates.first*sign<max*.3);assert(rates.middle*sign>rates.first*sign&&rates.middle*sign<max);assert(Math.abs(rates.full*sign-max)<1e-7);
  await page.dispatchEvent('body','keyup',{code,key});
  const held=await page.evaluate(field=>{const a=STCommand,c=a.away.state.carrier,before=c[field];a.away.tick(.1);return c[field]-before;},field);assert(Math.abs(held)<1e-10,'release holds the current attitude');
  await page.dispatchEvent('body','keydown',{code,key});
  const restarted=await page.evaluate(field=>{const a=STCommand,c=a.away.state.carrier,before=c[field];a.away.tick(.05);return (c[field]-before)/.05*(field==='pitch'?1:180/Math.PI);},field);assert(Math.abs(restarted-rates.first)<1e-7,'a fresh press starts gently again');await page.dispatchEvent('body','keyup',{code,key});
 }
 console.log('Passed: both bank, pitch and roll directions start gently, accelerate to their previous maximum rates, hold on release and restart gently.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
