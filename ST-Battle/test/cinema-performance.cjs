const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]})),server=require('../server.cjs');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const results=[];
    for(const variant of process.argv.slice(2).length?process.argv.slice(2):['normal','without-inset','without-3d']){
      const page=await browser.newPage({viewport:{width:1440,height:1000}});
      await page.route('**/app.js',async route=>{
        let source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
        if(variant==='without-controls')source=source.replace(/(function cinemaTactical\(\)\{\s+drawCinemaTactical\(\);)\s+updateCinemaCameraControls\(\);/,'$1');
        if(variant==='without-map')source=source.replace(/(function cinemaTactical\(\)\{)\s+drawCinemaTactical\(\);/,'$1');
        const measure=(name,code)=>`{const t=performance.now();${code};const m=window.cinemaProfile.${name}??={ms:0,n:0};m.ms+=performance.now()-t;m.n++;}`;
        source=source.replace('scene?.update(sceneDt,!sim.running&&!sim.result);hud();radar();cinemaTactical();',
          'window.cinemaProfile??={};'+measure('scene',variant==='without-3d'?'': 'scene?.update(sceneDt,!sim.running&&!sim.result)')+measure('hud','hud()')+measure('radar','radar()')+measure('inset',variant==='without-inset'?'':'cinemaTactical()'));
        await route.fulfill({contentType:'application/javascript',body:source});
      });
      await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
      await page.click('#quick-battle');await page.click('[data-camera="cinematic"]');
      await page.waitForTimeout(2500);
      const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
      const before=await cdp.send('Performance.getMetrics');
      const data=await page.evaluate(async()=>{
        window.cinemaProfile={};const frames=[];let last=performance.now();const end=last+4000;
        await new Promise(resolve=>{function frame(now){frames.push(now-last);last=now;if(now<end)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
        const s=window.battleScene;frames.sort((a,b)=>a-b);
        return {timings:window.cinemaProfile,frames:frames.length,medianFrame:frames[Math.floor(frames.length*.5)],p95Frame:frames[Math.floor(frames.length*.95)],render:s.renderer.info.render};
      });
      const after=await cdp.send('Performance.getMetrics'),metrics={};
      for(const name of ['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration'])metrics[name]=after.metrics.find(m=>m.name===name).value-before.metrics.find(m=>m.name===name).value;
      results.push({variant,...data,metrics});await page.close();
    }
    fs.writeFileSync(path.resolve(__dirname,'../exports/cinema-performance.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
