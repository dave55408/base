const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1800,height:1400}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/window-plan/';await page.goto(url+'index.html');await page.waitForFunction(()=>window.WindowPlanEditor);
  const initial=await page.evaluate(()=>({records:WindowPlanEditor.data.windows.length,unique:new Set(WindowPlanEditor.data.windows.map(w=>w.id)).size,windows:WindowPlanEditor.data.windows.filter(w=>w.category==='window').length}));assert.equal(initial.records,initial.unique);assert.equal(initial.windows,161);
  await page.locator('#window-picker').selectOption('SH-01');assert.equal(await page.locator('#selection-title').textContent(),'SH-01');
  await page.locator('#window-state').selectOption('unlit');assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').state),'unlit');
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').state),'lit');
  await page.locator('#redo').click();assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').state),'unlit');
  await page.locator('#view').selectOption('side');const mark=page.locator('#side-SH-01');await mark.focus();const zBefore=await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').position[2]);
  await page.keyboard.press('ArrowRight');assert(Math.abs((await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').position[2]))-zBefore-.002)<1e-8);
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').state),'lit');
  const position=await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').position),box=await mark.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+24,box.y+box.height/2-12,{steps:5});await page.mouse.up();
  const moved=await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').position);assert(moved[1]>position[1]&&moved[2]>position[2],'drag changes the shared 3D record');
  await page.locator('#duplicate').click();assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.length),initial.records+1);await page.locator('#delete-window').click();assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.length),initial.records);
  await page.locator('#side').selectOption('port');assert(await page.locator('#side-PH-01').count());assert.equal(await page.locator('#side-SH-01').count(),0);
  const [jsonDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#export-json').click()]);const jsonFile=path.join(require('node:os').tmpdir(),'enterprise-window-export.json');await jsonDownload.saveAs(jsonFile);const exported=JSON.parse(fs.readFileSync(jsonFile,'utf8'));assert.equal(exported.windows.find(w=>w.id==='SH-01').position[2],moved[2]);
  const [svgDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#export-svg').click()]);const svgFile=path.join(require('node:os').tmpdir(),'enterprise-window-export.svg');await svgDownload.saveAs(svgFile);assert(fs.readFileSync(svgFile,'utf8').includes('id="rear-PH-'));
  await page.locator('#reset').click();await page.locator('#import-json').setInputFiles(jsonFile);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Imported '));assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').position[2]),moved[2]);
  await page.reload();assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='SH-01').position[2]),moved[2]);
  await page.locator('#view').selectOption('front');await page.locator('#front-FW-02').dblclick();assert.equal(await page.evaluate(()=>WindowPlanEditor.data.windows.find(w=>w.id==='FW-02').state),'unlit','double-click toggles a window without losing the pointer target');
  const adapter=fs.readFileSync(path.join(__dirname,'window-plan/three-window-layer.js'),'utf8');await page.addScriptTag({url:url.replace('/window-plan/','/')+'vendor/alpine-three.js'});await page.addScriptTag({content:adapter});
  const layer=await page.evaluate(()=>{const group=createWindowPlanLayer(AlpineThree,WindowPlanEditor.data);let finite=true;group.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)if(!Number.isFinite(n))finite=false;});return {batches:group.children.length,count:group.userData.windowIds.length,finite};});assert.equal(layer.count,161);assert.equal(layer.batches,2);assert(layer.finite);
  await page.locator('#reset').click();await page.locator('#view').selectOption('all');await page.locator('#side').selectOption('starboard');await page.screenshot({path:path.join(require('node:os').tmpdir(),'enterprise-window-editor.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'editor fits mobile width');await page.screenshot({path:path.join(require('node:os').tmpdir(),'enterprise-window-editor-mobile.png'),fullPage:true});
  await page.goto(pathToFileURL(path.join(__dirname,'window-plan/index.html')).href);assert.equal(await page.locator('#view-front').count(),1,'offline editor works without a server');
  await page.goto(url+'enterprise-window-map.svg');await page.setViewportSize({width:1600,height:1240});await page.locator('svg').screenshot({path:path.join(__dirname,'window-plan/enterprise-window-map.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({initial,layer}));console.log('Passed: three vector orthographic views, unique window records, lit/unlit edits, shared 3D dragging, keyboard, undo/redo, duplicate/delete, independent port side, SVG/JSON export/import, persistence, batched Three.js adapter, mobile layout and offline use.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
