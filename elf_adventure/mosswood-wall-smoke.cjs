const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('./dev-server.cjs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv.includes('--file')?pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.elfGame?.rules);
    const results=await page.evaluate(()=>{
      const {rules:r,scene}=elfGame;r.newQuest();
      const s=r.getState();s.mode='playing';s.elves=[];s.dragons=[];
      s.bat.carrying=null;s.bat.room='gold';r.teleport('mosswoodHollow');scene.scene.pause();
      const walls=r.geometry();
      const floor=(x,y)=>x>65&&x<895&&y>65&&y<570&&!walls.some(w=>x+15>w.x+1e-6&&x-15<w.x+w.w-1e-6&&y+15>w.y+1e-6&&y-15<w.y+w.h-1e-6);
      const failures=[];let checks=0;
      for(const wall of walls)for(const fraction of [.2,.5,.8])for(const side of ['left','right','up','down']){
        const horizontal=side==='up'||side==='down';
        const x=horizontal?wall.x+wall.w*fraction:side==='left'?wall.x-35:wall.x+wall.w+35;
        const y=horizontal?(side==='up'?wall.y-35:wall.y+wall.h+35):wall.y+wall.h*fraction;
        if(!floor(x,y))continue;
        for(const sign of [-1,1]){
          r.clearInput();Object.assign(s.player,{x,y});
          const press={left:'ArrowRight',right:'ArrowLeft',up:'ArrowDown',down:'ArrowUp'}[side];
          r.keyDown({key:press,preventDefault(){}});for(let n=0;n<15;n++)r.step(1/60);
          const before={x:s.player.x,y:s.player.y};
          const contact=horizontal?(side==='up'?wall.y-15:wall.y+wall.h+15):(side==='left'?wall.x-15:wall.x+wall.w+15);
          if(Math.abs((horizontal?before.y:before.x)-contact)>1e-5)continue;
          if(![0,10,20,30,40].every(d=>floor(before.x+(horizontal?d*sign:0),before.y+(horizontal?0:d*sign))))continue;
          // Exercise tiny fractional overlap at a contact, as can occur after
          // Arcade Physics separates a body from a rectangle.
          const epsilon=1e-8;
          if(horizontal)s.player.y=side==='up'?wall.y-15+epsilon:wall.y+wall.h+15-epsilon;
          else s.player.x=side==='left'?wall.x-15+epsilon:wall.x+wall.w+15-epsilon;
          r.clearInput();const slide=horizontal?(sign<0?'ArrowLeft':'ArrowRight'):(sign<0?'ArrowUp':'ArrowDown');
          r.keyDown({key:slide,preventDefault(){}});for(let n=0;n<8;n++)r.step(1/60);
          checks++;if(Math.hypot(s.player.x-before.x,s.player.y-before.y)<30)failures.push({wall,side,slide,before,after:{x:s.player.x,y:s.player.y}});
        }
      }
      // Approach the corner shown in the screenshot, then retreat from it.
      const corner=[];
      r.clearInput();Object.assign(s.player,{x:306.6,y:200.21666666666664});
      for(const key of ['ArrowDown','ArrowLeft','ArrowUp']){
        r.clearInput();r.keyDown({key,preventDefault(){}});
        const before={x:s.player.x,y:s.player.y};
        for(let n=0;n<30;n++)r.step(1/60);
        corner.push({key,before,after:{x:s.player.x,y:s.player.y}});
      }
      return {checks,failures,corner};
    });
    assert(results.checks>100,'exercise contacts across the maze');
    assert.deepEqual(results.failures,[],'the player can slide along touching walls');
    assert(Math.abs(results.corner[0].after.y-results.corner[0].before.y)<1e-6,'the corner still blocks movement through the wall');
    assert(results.corner[1].before.x-results.corner[1].after.x>50,'the player can leave the corner to the left');
    assert(results.corner[2].before.y-results.corner[2].after.y>50,'the player can leave the corner upward');
    console.log('Wall sliding passed '+results.checks+' contact checks and screenshot corner checks');
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
