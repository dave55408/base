const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{
 for(const file of ['index.html','away-mission.js'])assert(!/[\u00c3\u00c2\u00e2][^\x00-\x7f]/.test(fs.readFileSync(file,'utf8')),file+' contains broken encoding');
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
  assert.equal((await page.locator('#port').textContent()).trim(),'\u21b6PORT');assert.equal((await page.locator('#starboard').textContent()).trim(),'\u21b7STBD');
  assert((await page.locator('#heading-output').textContent()).includes('\u00b0'));await page.locator('#port').click();assert.equal(await page.evaluate(()=>STCommand.state.heading),75);
  await page.evaluate(()=>{STCommand.games.forEach(g=>g.loop.stop());Object.assign(STCommand.away.state,{phase:'flight',freeSpace:true});STCommand.away.updateUI();});
  const text=await page.locator('body').textContent();assert(!/[\u00c3\u00c2\u00e2][^\x00-\x7f]/.test(text),'rendered UI contains garbled symbols');assert.deepEqual(errors,[]);
  console.log('Passed: helm arrows, degree signs, control behavior, and flight labels render without corrupted encoding.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
