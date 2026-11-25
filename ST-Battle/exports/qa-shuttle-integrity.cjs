const fs=require('fs'),path=require('path'),{chromium}=require(require.resolve('playwright',{paths:[path.resolve('../elf-adventure')]}));
(async()=>{
 const server=require('../server.cjs');await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1500,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(1500);
 await page.evaluate(()=>{document.getElementById('close-welcome').click();const s=window.battle;s.player.integrity.engines=38;s.enemy.integrity.weapons=57;document.getElementById('game-shell').classList.remove('cinema-view');});
 await page.waitForTimeout(250);await page.screenshot({path:'exports/integrity-bars.png',fullPage:true});
 await page.evaluate(()=>{const s=window.battleScene;s.setCamera('cinematic');s.update(.05);s.setCamera('tactical');s.update(0);});
 await page.waitForTimeout(150);
 await page.screenshot({path:'exports/tactical-shuttle.png',fullPage:true});
 console.log(JSON.stringify(await page.evaluate(()=>({bars:[...document.querySelectorAll('.integrity-bullet')].map(el=>({id:el.id,rect:{w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height},value:el.getAttribute('aria-valuetext')})),marker:window.battleScene.tacticalShuttle?.visible,gl:window.battleScene.renderer.getContext().getError()}))));
 console.log('Errors',errors);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});

