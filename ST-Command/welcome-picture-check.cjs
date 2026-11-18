const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const source=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const html=source.slice(0,source.indexOf('  <main>')).replace(/<script src="browser-guards[^<]+<\/script>/,'').replace('<body>','<body><script>window.STCommand={state:{paused:false},pause(){this.state.paused=!this.state.paused;}};</script>')+'</body></html>';
  await page.route('http://welcome.test/**',route=>{
   const name=new URL(route.request().url()).pathname;
   return name==='/'?route.fulfill({contentType:'text/html',body:html}):route.fulfill({path:path.join(__dirname,decodeURIComponent(name))});
  });
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.goto('http://welcome.test/');
   await page.waitForFunction(()=>STCommand.state.paused);
   const shots=page.locator('.welcome-gallery img');assert.equal(await shots.count(),3);
   assert.equal(await page.locator('#welcome-picture').count(),0);
   assert.equal(await page.locator('.welcome-gallery button, .welcome-gallery a').count(),0);
   for(let i=0;i<3;i++){
    const shot=shots.nth(i);
    await shot.evaluate(image=>image.decode());await shot.click();
    assert.equal(await page.locator('dialog[open]').count(),1,'clicking a thumbnail does not open an expanded view');
    const bounds=await shot.boundingBox();
    assert(bounds.x>=0&&bounds.x+bounds.width<=width,'thumbnail fits the viewport');
    assert(await page.locator('#welcome-screen').evaluate(dialog=>dialog.open),'welcome stays open');
    assert(await page.evaluate(()=>STCommand.state.paused),'keep the simulation paused');
   }
   if(width===1280)await page.click('#welcome-close');else await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!STCommand.state.paused);
  }
  assert.deepEqual(errors,[]);
  console.log('Passed: static welcome thumbnails, no expanded views, Close and Escape, pause restoration, desktop and mobile fit.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
