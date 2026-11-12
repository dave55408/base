const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  await page.evaluate(()=>{STCommand.stop();STCommand.away.launchShuttle();STCommand.state.paused=true;for(const game of STCommand.games)game.loop.stop();});
  for(const [code,key,sign,turn]of [['Numpad1','1',-1,true],['Numpad3','3',1,true],['Numpad0','0',-1,false],['NumpadDecimal','.',1,false]]){
   await page.evaluate(()=>{
    const a=STCommand,m=a.away.state;
    Object.assign(m,{phase:'flight',freeSpace:true,launchAttached:false,launchStage:null,launchLiftRemaining:0,departureRamp:false});
    Object.assign(m.carrier,{x:0,y:0,z:0,heading:0,pitch:0,roll:0,manualRoll:0,turnBank:0,returningNeutral:false,speed:0,moving:false,manual:false});
    Object.assign(m.bridgeState,{heading:90,pitch:0,throttle:0,speed:0,roll:0});
   });
   await page.dispatchEvent('body','keydown',{code,key});
   await page.evaluate(()=>{for(let n=0;n<20;n++)STCommand.away.tick(.05);});
   await page.dispatchEvent('body','keyup',{code,key});await page.waitForTimeout(60);
   const result=await page.evaluate(()=>{
    const canvas=document.getElementById('enterprise-inset-canvas'),ctx=canvas.getContext('2d');
    const original=ctx.arc;let nose;
    ctx.arc=function(x,y,r,...args){if(r===2.6)nose={x,y};return original.call(this,x,y,r,...args);};
    try{EnterpriseInset.render(STCommand.away.state,STCommand.state);}finally{ctx.arc=original;}
    // Measure the rendered blue hull's screen-space lean, independent of the
    // transform implementation. A right bank slopes down toward screen right.
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0,x=0,y=0,xy=0;
    for(let row=0;row<canvas.height;row++)for(let col=0;col<canvas.width;col++){
     const i=(row*canvas.width+col)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
     if(b>120&&b>r*1.5&&g>r*1.3){count++;x+=col;y+=row;xy+=col*row;}
    }
    return {noseOffset:nose.x-canvas.width/2,lean:xy/count-x*y/(count*count),roll:STCommand.away.state.carrier.roll};
   });
   assert(result.roll*sign>0,code+' changes physical bank in the commanded direction');
   if(turn)assert(result.noseOffset*sign>2,code+' tactical nose points toward the commanded turn');
   assert(result.lean*sign>5,code+' tactical hull banks toward the commanded direction: '+JSON.stringify(result));
  }
  assert.deepEqual(errors,[]);console.log('Passed: tactical nose and visible bank agree with left/right remote turns and manual roll.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
