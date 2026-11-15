const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
const {createVersionTracker,validateVersion}=require('./app-version.cjs'),{createServer}=require('./server.cjs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
(async()=>{
 const tempRoot=path.resolve(os.tmpdir()),fixture=await fs.mkdtemp(path.join(tempRoot,'st-command-version-'));let browser,server;
 try{
  for(const value of ['0.0.0','1.0.1','12.34.56','1.0.0-alpha','1.0.0-rc.1','1.0.0-0.3.7','1.0.0-x-y-z.--','1.0.0+001','1.0.0-beta+exp.sha.5114f85'])assert.equal(validateVersion(value),value);
  for(const value of ['v1.0.0','01.0.0','1.01.0','1.0.01','1.0','1.0.0-01','1.0.0-alpha.01','1.0.0+','1.0.0-a..b','1.0.0+build_1','1.0.0\n',null,1])assert.throws(()=>validateVersion(value),/Semantic Versioning/);
  await fs.mkdir(path.join(fixture,'assets'));await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({version:'2.4.0'}));
  await fs.writeFile(path.join(fixture,'index.html'),'<html>game</html>');await fs.writeFile(path.join(fixture,'game.js'),'const game=1;');
  await fs.writeFile(path.join(fixture,'assets','texture.txt'),'paint one');await fs.writeFile(path.join(fixture,'project-notes.html'),'private notes');
  const tracker=createVersionTracker(fixture),first=await tracker.current(true);
  assert.match(first.version,/^2\.4\.0\+[a-f0-9]{8}$/);assert.deepEqual(await tracker.current(true),first);
  await fs.writeFile(path.join(fixture,'project-notes.html'),'changed notes');assert.deepEqual(await tracker.current(true),first);
  await fs.writeFile(path.join(fixture,'game.js'),'const game=22;');const code=await tracker.current(true);assert.notEqual(code.revision,first.revision);
  await fs.writeFile(path.join(fixture,'assets','texture.txt'),'new paint two');const asset=await tracker.current(true);assert.notEqual(asset.revision,code.revision);
  await fs.unlink(path.join(fixture,'assets','texture.txt'));assert.notEqual((await tracker.current(true)).revision,asset.revision);
  await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({version:'2.5.0'}));assert.match((await tracker.current(true)).version,/^2\.5\.0\+/);
  await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({version:'2.5.0-rc.1+build.001'}));const prerelease=await tracker.current(true);assert.match(prerelease.version,/^2\.5\.0-rc\.1\+build\.001\.[a-f0-9]{8}$/);validateVersion(prerelease.version);
  await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({version:'2.5.0'}));
  server=createServer({versionRoot:fixture});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const response=await fetch(origin+'/api/version');assert.equal(response.headers.get('cache-control'),'no-store');assert.match((await response.json()).version,/^2\.5\.0\+/);
  assert.equal((await fetch(origin+'/api/version',{method:'PUT'})).status,405);assert.equal((await fetch(origin+'/api/version',{method:'HEAD'})).status,200);
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForFunction(()=>window.STCommandVersion?.current);
  assert.equal(await page.locator('#project-notes-open').count(),0);assert.equal(await page.locator('#project-notes').count(),0);
  const initial=await page.locator('#app-version-number').textContent(),initialBuild=await page.evaluate(()=>STCommandVersion.current.version);assert.equal(initial,'2.5.0');
  assert.equal(await page.locator('#app-version').evaluate(e=>e.tagName),'OUTPUT');assert.equal(await page.locator('#app-build-number').textContent(),await page.evaluate(()=>STCommandVersion.current.revision));assert(await page.locator('#app-version').evaluate(e=>{const s=getComputedStyle(e);return s.borderTopWidth==='0px'&&s.backgroundColor==='rgba(0, 0, 0, 0)'&&e.textContent.includes('Version #')&&e.textContent.includes('Build #');}));
  await fs.writeFile(path.join(fixture,'game.js'),'const game=333;');await new Promise(r=>setTimeout(r,1100));
  await page.evaluate(()=>STCommandVersion.refresh());assert.equal(await page.locator('#app-version-number').textContent(),initial);assert.notEqual(await page.evaluate(()=>STCommandVersion.current.version),initialBuild);
  await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({version:'2.5.1-rc.1+ci.42'}));await new Promise(r=>setTimeout(r,1100));await page.evaluate(()=>STCommandVersion.refresh());
  const changed=await page.locator('#app-version-number').textContent();assert.equal(changed,'2.5.1-rc.1');assert((await page.locator('#app-version').getAttribute('title')).includes('+ci.42.'));
  await page.reload();await page.waitForFunction(()=>window.STCommandVersion?.current);assert.equal(await page.locator('#app-version-number').textContent(),changed);
  await page.route('**/api/version',route=>route.abort());await page.evaluate(()=>STCommandVersion.refresh());assert.equal(await page.locator('#app-version-number').textContent(),changed);await page.unroute('**/api/version');
  await page.evaluate(()=>NightMode.enabled=true);await page.setViewportSize({width:390,height:844});
  const box=await page.locator('#app-version').boundingBox();assert(box.x>=0&&box.x+box.width<=390);assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
  await page.screenshot({path:path.join(tempRoot,'st-command-version-mobile.png')});
  const offline=await browser.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  await offline.waitForFunction(()=>window.STCommandVersion?.current);assert.equal(await offline.locator('#app-version-number').textContent(),await offline.evaluate(()=>ST_COMMAND_VERSION.release.split('+')[0]));
  assert.deepEqual(errors,[]);assert.equal(await fs.readFile(path.join(fixture,'project-notes.html'),'utf8'),'changed notes');
  const releaseRoot=path.join(fixture,'release-check');await fs.mkdir(releaseRoot);await fs.copyFile(path.join(__dirname,'app-version.cjs'),path.join(releaseRoot,'app-version.cjs'));
  const project=JSON.parse(await fs.readFile(path.join(__dirname,'package.json'),'utf8'));await fs.writeFile(path.join(releaseRoot,'package.json'),JSON.stringify({name:'st-command-version-test',version:'2.4.9',scripts:project.scripts}));
  const execFile=require('node:util').promisify(require('node:child_process').execFile),npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  for(const [bump,expected] of [['patch','2.4.10'],['minor','2.5.0'],['major','3.0.0']]){
   await execFile(process.execPath,[npmCli,'run','version:'+bump],{cwd:releaseRoot});assert.equal(JSON.parse(await fs.readFile(path.join(releaseRoot,'package.json'),'utf8')).version,expected);
   assert((await fs.readFile(path.join(releaseRoot,'app-version-data.js'),'utf8')).includes('"release":"'+expected+'"'));
  }
  console.log('Passed: strict SemVer, prerelease/build metadata, patch/minor/major release commands, source-build refresh, semantic-version display, offline fallback and mobile layout.');
 }finally{
  await browser?.close();if(server)await new Promise(r=>server.close(r));
  if(!path.resolve(fixture).startsWith(tempRoot+path.sep))throw Error('Unexpected temporary test path');await fs.rm(fixture,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
