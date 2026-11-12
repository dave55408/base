const path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createEnterpriseRenderer);
  const captures=await page.evaluate(()=>{
    const ship=createEnterpriseRenderer(),canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;const c=canvas.getContext('2d');
    for(const child of ship.model.children)child.visible=/engine-cap|cap-lines/.test(child.name);
    return [-.445,.445].map(x=>[0,1.25].map(time=>{c.clearRect(0,0,800,500);ship.draw(c,800,500,{x,y:-1.12,z:110.535,bank:0},{heading:180,pitch:0,time});return canvas.toDataURL();}));
  });console.log(JSON.stringify(captures.map(side=>side.map(data=>crypto.createHash('sha256').update(data).digest('hex')))));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
