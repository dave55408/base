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
    const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv.includes('--file')?pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.elfGame?.rules);
    await page.evaluate(()=>{
      const {rules:r,scene}=elfGame;r.newQuest();
      const s=r.getState();s.mode='playing';s.elves=[];s.dragons=[];s.bat.room='absent';
      r.teleport('mosswoodHollow');scene.scene.pause();
      for(const [room,y] of [['mosswoodHollow',620],['mosswoodDepths',100]]){
        r.teleport(room);r.renderRoom();
        const row=r.artworkCanvas.getContext('2d').getImageData(0,y,960,1).data;
        const floor=[];
        for(let x=450;x<650;x++)if(row[x*4]===143&&row[x*4+1]===139&&row[x*4+2]===143)floor.push(x);
        if(floor.length!==60||floor[0]!==522||floor[59]!==581)throw Error(room+': door and passage must both render 60 pixels wide');
        if(room==='mosswoodDepths')for(const [y,expected] of [[100,[61,140,69]],[350,[67,150,74]],[550,[73,160,79]]]){
          const actual=Array.from(r.artworkCanvas.getContext('2d').getImageData(100,y,1,1).data).slice(0,3);
          if(actual.join(',')!==expected.join(','))throw Error('Mosswood Depths background band color mismatch at '+y);
        }
      }
      r.teleport('mosswoodHollow');
      Object.assign(s.player,{x:552,y:570});r.clearInput();
      r.keyDown({key:'ArrowDown',preventDefault(){}});
      for(let n=0;n<30&&s.room==='mosswoodHollow';n++)r.step(1/60);
      if(s.room!=='mosswoodDepths')throw Error('South exit failed');
      for(let n=0;n<150&&s.player.y<576;n++)r.step(1/60);
      if(s.player.y<570)throw Error('Passage blocked');
      r.clearInput();r.keyDown({key:'ArrowLeft',preventDefault(){}});
      for(let n=0;n<20&&s.held!=='whiteKey';n++)r.step(1/60);
      if(s.held!=='whiteKey')throw Error('Key pickup failed');
      Object.assign(s.player,{x:552,y:60});r.clearInput();
      r.keyDown({key:'ArrowUp',preventDefault(){}});
      for(let n=0;n<30&&s.room==='mosswoodDepths';n++)r.step(1/60);
      if(s.room!=='mosswoodHollow'||s.held!=='whiteKey')throw Error('Return with key failed');
      r.clearInput();s.held=null;s.items.whiteKey={room:'mosswoodDepths',x:504,y:578};
      r.teleport('mosswoodDepths');Object.assign(s.player,{x:552,y:95});scene.scene.resume();
    });
    await page.waitForTimeout(200);
    await page.locator('#phaser-host canvas').screenshot({path:'test-results/mosswood-depths.png'});
    const pause=await page.evaluate(async()=>{
      const pixel=()=>new Promise(resolve=>elfGame.game.renderer.snapshotPixel(10,10,color=>resolve([color.r,color.g,color.b,color.a])));
      const before=await pixel();elfGame.rules.pause();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {before,after:await pixel(),shade:getComputedStyle(document.getElementById('overlay')).backgroundColor,visible:!document.getElementById('overlay').hidden,mode:elfGame.rules.getState().mode};
    });
    assert.equal(pause.mode,'paused');assert(pause.visible);
    assert.deepEqual(pause.after,pause.before,'pause does not add an extra canvas darkening layer');
    await page.locator('.stage').screenshot({path:'test-results/mosswood-depths-paused.png'});
    const death=await page.evaluate(()=>{
      const r=elfGame.rules;r.pause();r.newQuest();const s=r.getState();s.mode='playing';
      s.elves=[];s.bat.room='absent';const d=s.dragons.find(d=>d.name==='Vesper');s.dragons=[d];
      r.teleport('mosswoodHollow');Object.assign(s.player,{x:552,y:550});Object.assign(d,{room:s.room,x:552,y:550});
      for(let n=0;n<120&&s.mode==='playing';n++)r.step(1/60);
      return {mode:s.mode,shade:getComputedStyle(document.getElementById('overlay')).backgroundColor};
    });
    assert.equal(death.mode,'lost');assert.equal(pause.shade,death.shade,'pause and death use identical screen darkening');
    assert.deepEqual(errors,[]);
    console.log('Browser checks passed: entry, narrowed passage, key pickup, return, rendering, and matching pause/death darkening.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
