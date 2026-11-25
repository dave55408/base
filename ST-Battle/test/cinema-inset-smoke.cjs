const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]})),server=require('../server.cjs');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
    await page.click('#quick-battle');await page.click('[data-camera="cinematic"]');
    await page.waitForFunction(()=>!document.getElementById('cinema-camera-controls').hidden);
    assert.equal(await page.getAttribute('#camera-cautious','aria-pressed'),'true');
    assert.equal(await page.inputValue('#camera-shuttle-speed'),'100');
    await page.click('#camera-reckless');
    await page.locator('#camera-shuttle-speed').evaluate(input=>{input.value='100';input.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.evaluate(()=>window.battleScene.cinemaFlightMode),'reckless');
    assert.equal(await page.evaluate(()=>window.battleScene.cinemaSpeedPercent),100);
    const maximum=await page.evaluate(()=>Math.round(window.battleScene.cinemaTopSpeed*10));
    assert.equal(await page.textContent('#camera-shuttle-speed-limit'),'100% / LIMIT '+maximum+' M/S');
    for(const width of [1440,600]){
      await page.setViewportSize({width,height:1000});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.waitForFunction(()=>!document.getElementById('cinema-tactical').hidden&&!document.getElementById('cinema-turn').hidden);
      const result=await page.evaluate(()=>{
        const panel=document.getElementById('cinema-tactical'),map=document.getElementById('cinema-tactical-map'),screen=document.getElementById('battle-screen');
        const a=panel.getBoundingClientRect(),b=screen.getBoundingClientRect(),controls=screen.querySelector('.view-bottom').getBoundingClientRect(),turn=document.getElementById('cinema-turn').getBoundingClientRect();
        const pixels=map.getContext('2d').getImageData(0,0,map.width,map.height).data;
        const camera=document.getElementById('cinema-camera-controls').getBoundingClientRect();
        const bulletRatios=[...document.querySelectorAll('.integrity-bullet')].map(bar=>{
          const style=getComputedStyle(bar.parentElement),available=parseFloat(style.width)-['paddingLeft','paddingRight','borderLeftWidth','borderRightWidth'].reduce((total,key)=>total+parseFloat(style[key]),0);
          return {id:bar.id,ratio:parseFloat(getComputedStyle(bar).width)/available};
        });
        const wideBullets=bulletRatios.every(bar=>Math.abs(bar.ratio-.9)<.01);
        return {visible:getComputedStyle(panel).display!=='none',inside:a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom,belowTurns:a.top>turn.bottom&&Math.abs(a.left-turn.left)<1,cameraUpperRight:camera.right<=b.right&&camera.left>b.left+b.width/2&&camera.top>=b.top&&camera.bottom<controls.top,wideBullets,bulletRatios,clearControls:a.bottom<=controls.top,width:a.width,height:a.height,painted:pixels.some((v,i)=>i%4===3&&v>0)};
      });
      assert(result.visible&&result.inside&&result.painted&&result.belowTurns&&result.cameraUpperRight&&result.wideBullets,JSON.stringify(result));assert(result.clearControls,JSON.stringify(result));
      console.log(width,result);
      await page.screenshot({path:path.resolve(__dirname,`../exports/cinema-tactical-inset-${width}.png`),fullPage:true});
    }
    const before=await page.evaluate(()=>{
      return {time:window.battle.time,image:document.getElementById('cinema-tactical-map').toDataURL()};
    });
    await page.waitForFunction(time=>window.battle.time>time+1,before.time);
    assert.notEqual(await page.evaluate(()=>document.getElementById('cinema-tactical-map').toDataURL()),before.image,'the inset redraws as ships and shuttle move');
    await page.evaluate(()=>{window.battle.running=false;});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const original=await page.evaluate(()=>({image:document.getElementById('cinema-tactical-map').toDataURL(),zoom:window.battleScene.camera.zoom,position:window.battleScene.camera.position.toArray()}));
    const map=page.locator('#cinema-tactical-map'),bounds=await map.boundingBox();
    await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.5);await page.mouse.wheel(0,-450);
    await page.waitForFunction(previous=>document.getElementById('cinema-tactical-map').toDataURL()!==previous,original.image);
    assert.equal(await page.evaluate(()=>window.battleScene.camera.zoom),original.zoom,'map zoom leaves the Cinema lens alone');
    assert.deepEqual(await page.evaluate(()=>window.battleScene.camera.position.toArray()),original.position,'map zoom leaves shuttle position alone');
    await map.dblclick();
    await page.waitForFunction(previous=>document.getElementById('cinema-tactical-map').toDataURL()===previous,original.image);
    assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false,'map reset does not toggle fullscreen');
    await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.wheel(0,-250);
    await page.waitForFunction(previous=>document.getElementById('cinema-tactical-map').toDataURL()!==previous,original.image);
    const zoomedMap=await page.evaluate(()=>document.getElementById('cinema-tactical-map').toDataURL());
    for(const [panelId,titleId,bodyId] of [['cinema-tactical','cinema-tactical-title','cinema-tactical-body'],['cinema-camera-controls','cinema-camera-title','cinema-camera-body']]){
      const panel=page.locator('#'+panelId),title=page.locator('#'+titleId),height=(await panel.boundingBox()).height;
      await title.dblclick();assert.equal(await title.getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#'+bodyId).isVisible(),false);
      assert((await panel.boundingBox()).height<height*.5,'collapse to the title bar');
      assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false,'title double-click does not toggle fullscreen');
      await title.press('Enter');assert.equal(await title.getAttribute('aria-expanded'),'true');assert(await page.locator('#'+bodyId).isVisible());
    }
    assert.equal(await page.inputValue('#camera-shuttle-speed'),'100','collapse preserves shuttle capacity');
    assert.equal(await page.getAttribute('#camera-reckless','aria-pressed'),'true','collapse preserves operator choice');
    await page.waitForFunction(previous=>document.getElementById('cinema-tactical-map').toDataURL()===previous,zoomedMap);
    await page.click('[data-camera="tactical"]');await page.waitForFunction(()=>document.getElementById('cinema-tactical').hidden);
    assert(await page.evaluate(()=>document.getElementById('cinema-camera-controls').hidden));
    assert.deepEqual(errors,[]);console.log('Cinema inset renders, fits, clears controls, and hides in other views.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
