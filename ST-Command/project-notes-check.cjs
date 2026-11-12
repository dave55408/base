const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'st-notes-')),notesFile=path.join(dir,'project-notes.txt'),server=createServer({notesFile});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  await page.locator('#project-notes-open').click();await page.waitForFunction(()=>!document.getElementById('project-notes-text').disabled);
  assert(await page.evaluate(()=>STCommand.state.paused));
  const note='Project notes\nLower garage lighting.\nTest shuttle launch → cockpit.';
  await page.locator('#project-notes-text').fill(note);
  await page.waitForFunction(()=>document.getElementById('project-notes-status').textContent.startsWith('Saved in'));
  assert.equal(await fs.readFile(notesFile,'utf8'),note);
  const heading=await page.evaluate(()=>STCommand.state.heading);await page.locator('#project-notes-text').press('ArrowLeft');
  assert.equal(await page.evaluate(()=>STCommand.state.heading),heading);
  await page.locator('#project-notes-text').fill(note+'\nSave on close.');await page.locator('#project-notes-close').click();
  await page.waitForFunction(()=>!document.getElementById('project-notes').open);assert(!await page.evaluate(()=>STCommand.state.paused));
  await page.reload();await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));await page.locator('#project-notes-open').click();
  await page.waitForFunction(()=>!document.getElementById('project-notes-text').disabled);
  assert.equal(await page.locator('#project-notes-text').inputValue(),note+'\nSave on close.');
  const button=await page.locator('#project-notes-open').boundingBox(),picker=await page.locator('#enterprise-model').boundingBox();assert(button.x+button.width<picker.x);
  for(const width of [390,1280]){await page.setViewportSize({width,height:900});assert(await page.locator('#project-notes-text').isVisible());}
  assert.equal(await page.locator('#project-notes').evaluate(dialog=>getComputedStyle(dialog,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0.2)');
  await page.route('**/api/project-notes',route=>route.request().method()==='PUT'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Save unavailable'})}):route.continue());
  const savedNote=note+'\nSave button.';await page.locator('#project-notes-text').fill(savedNote);await page.locator('#project-notes-save').click();
  await page.waitForFunction(()=>document.getElementById('project-notes-status').dataset.error==='true');assert(await page.locator('#project-notes').evaluate(dialog=>dialog.open));assert.equal(await page.locator('#project-notes-text').inputValue(),savedNote);
  await page.unroute('**/api/project-notes');await page.locator('#project-notes-save').click();
  await page.waitForFunction(()=>!document.getElementById('project-notes').open);assert.equal(await fs.readFile(notesFile,'utf8'),savedNote);
  const denied=await fetch(url+'/api/project-notes',{method:'PUT',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({notes:'overwrite'})});assert.equal(denied.status,403);
  assert.equal(await fs.readFile(notesFile,'utf8'),savedNote);assert.deepEqual(errors,[]);
  console.log('Passed: local file persistence, autosave, save on close, reload, keyboard isolation, pause/resume, button placement, mobile dialog and cross-origin rejection.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
