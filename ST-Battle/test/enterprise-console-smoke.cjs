/* Visual and scope verification: node test/enterprise-console-smoke.cjs */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]})),server=require('../server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);await page.click('#close-welcome');
  for(const width of [1440,1920]){
   await page.setViewportSize({width,height:1000});
   const result=await page.evaluate(async()=>{
    const theme=document.querySelector('link[href="enterprise-console.css"]'),settle=async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().filter(animation=>animation.constructor.name==='CSSTransition').map(animation=>animation.finished.catch(()=>{})));};
    const properties=['borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','boxShadow','color','fill','stroke','fontSize','fontWeight','borderRadius','padding','margin','width','height'];
    const snapshot=()=>[...document.querySelectorAll('.yorktown-rail,.yorktown-rail *')].map(element=>{const style=getComputedStyle(element);return Object.fromEntries(properties.map(key=>[key,style[key]]));});
    theme.disabled=true;await settle();const before=snapshot();theme.disabled=false;await settle();const after=snapshot();
    const enterprise=[...document.querySelectorAll('main>.enterprise-console')].map(element=>({background:getComputedStyle(element).backgroundImage,border:getComputedStyle(element).borderTopColor,overflow:element.scrollWidth-element.clientWidth}));
    const yorktown=[...document.querySelectorAll('.yorktown-rail>.panel')].map(element=>({background:getComputedStyle(element).backgroundImage,color:getComputedStyle(element).backgroundColor,header:getComputedStyle(element.querySelector('.panel-heading')).backgroundImage}));
    const grid=document.getElementById('spatial-guides'),actions=document.getElementById('open-planner').parentElement,toolbar=grid.closest('.view-bottom');
    const view=document.querySelector('#cameras [data-camera].active'),gridStyle=getComputedStyle(grid),viewStyle=getComputedStyle(view);
    const planning={gridWithViews:grid.parentElement.id==='cameras',noFreeFlight:!toolbar.querySelector('#free-flight'),gridMatchesViews:['fontSize','padding'].every(key=>gridStyle[key]===viewStyle[key]),insideToolbar:toolbar.contains(actions),outsideWeapons:!document.querySelector('main>.weapons').contains(actions),unique:!document.querySelector('#commit-orders')&&['open-planner','commit-next-turn','random-turn','spatial-guides'].every(id=>document.querySelectorAll('#'+id).length===1),overflow:toolbar.scrollWidth-toolbar.clientWidth};
    const toolbarButtons=[...toolbar.querySelectorAll('button')].map(button=>{const style=getComputedStyle(button);return {camera:!!button.closest('#cameras'),color:style.color,background:style.backgroundImage,shadow:style.boxShadow};});
    return {before,after,enterprise,yorktown,planning,toolbarButtons,valueColor:getComputedStyle(document.querySelector('.enterprise-console .power-dial strong')).color};
   });
   assert.deepEqual(result.after,result.before,'Yorktown label, control, border and layout styling remain unchanged');assert.equal(result.enterprise.length,4);assert.equal(result.valueColor,'rgb(255, 255, 255)');
   assert.equal(result.yorktown.length,4);assert(result.yorktown.every(panel=>panel.color==='rgb(25, 27, 30)'&&panel.background.includes('radial-gradient')&&panel.background.includes('41, 44, 48')&&panel.header.includes('linear-gradient')),'all Yorktown panels retain gunmetal gray with layered gradient fills');
   assert(result.planning.gridWithViews&&result.planning.noFreeFlight&&result.planning.gridMatchesViews&&result.planning.insideToolbar&&result.planning.outsideWeapons&&result.planning.unique,JSON.stringify(result.planning));assert(result.planning.overflow<=1,'toolbar controls fit without horizontal overflow');
   assert(result.toolbarButtons.filter(button=>button.camera).every(button=>button.background==='none'&&button.shadow==='none'),'camera modes retain their simple flat style');
   assert(result.toolbarButtons.filter(button=>!button.camera).every(button=>['rgb(255, 199, 105)','rgb(255, 229, 168)'].includes(button.color)&&button.background==='none'&&button.shadow==='none'),'right toolbar buttons use flat fills with yellow accents');
   assert(result.enterprise.every(panel=>panel.border==='rgb(71, 138, 180)'&&panel.background.includes('16, 35, 55')));console.log(JSON.stringify({width,yorktownElements:result.before.length,enterprisePanels:result.enterprise.length,overflow:result.enterprise.map(p=>p.overflow)}));
  }
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.resolve(__dirname,'../exports/enterprise-blue-console.png'),fullPage:true});
  await page.click('#spatial-guides');assert.equal(await page.locator('#spatial-guides').getAttribute('aria-pressed'),'false');await page.click('#spatial-guides');assert.equal(await page.locator('#spatial-guides').getAttribute('aria-pressed'),'true');
  await page.click('#open-planner');assert(await page.locator('#plan-wizard').evaluate(dialog=>dialog.open));await page.click('#wizard-cancel');assert.deepEqual(errors,[]);
  await page.click('[data-camera="tactical"]');await page.waitForFunction(()=>battleScene.mode==='tactical'&&!battleScene.spatial.levels.visible&&!battleScene.spatial.rings.visible);
  assert.equal(await page.evaluate(()=>battleScene.gridStep),500);await page.screenshot({path:path.resolve(__dirname,'../exports/tactical-simple-grid.png'),fullPage:true});assert.deepEqual(errors,[]);
  await page.click('[data-camera="cinematic"]');assert.equal(await page.locator('#spatial-guides').textContent(),'Grid off');assert(await page.locator('#spatial-guides').isDisabled());assert.equal(await page.locator('#spatial-guides').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>battleScene.spatialEnabled),false);
  await page.click('[data-camera="tactical"]');assert(await page.locator('#spatial-guides').isEnabled());assert.equal(await page.locator('#spatial-guides').textContent(),'Grid on');assert.equal(await page.evaluate(()=>battleScene.spatialEnabled),true);
  await page.waitForFunction(()=>battleScene.spatial.grid.visible&&!battleScene.spatial.levels.visible&&!battleScene.spatial.rings.visible);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
