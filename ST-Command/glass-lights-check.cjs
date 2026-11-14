const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
 const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|compile/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);
  const result=await page.evaluate(async()=>{
   for(const game of STCommand.games)game.loop.sleep();const T=AlpineThree,checks=[],sheet=document.createElement('canvas');sheet.width=1200;sheet.height=1200;const ctx=sheet.getContext('2d');
   for(const [row,factory]of [createEnterpriseRenderer,createMovieEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
    const ship=factory();await ship.ready;let covers=0;
    ship.model.traverse(o=>{if(o.name.endsWith('-glass-cover')){covers++;if(!o.material.isMeshPhongMaterial||!o.material.transparent||o.material.depthWrite||o.material.opacity>.35)throw Error('Lenses need thin transparent glass covers');}});
    const names=['port-red-navigation-light','starboard-green-navigation-light','shuttle-bay-green-light','hangar-upper-white-light'];
    for(const name of names){const lens=ship.model.getObjectByName(name);if(!lens?.getObjectByName(name+'-glass-cover'))throw Error('Missing glass on '+name);}
    const lamp=ship.model.getObjectByName('port-red-navigation-light'),colors=[];
    for(const time of [0,.25,1.5,5]){ship.draw(null,1,1,{},{time},true);colors.push(lamp.material.color.getHex());}
    if(new Set(colors).size<2)throw Error('Glass covers must preserve blinking and pulsing');
    ship.model.updateWorldMatrix(true,true);
    for(const [col,name]of ['shuttle-bay-green-light','hangar-upper-white-light'].entries()){
     const lens=ship.model.getObjectByName(name),center=lens.getWorldPosition(new T.Vector3()),camera=new T.OrthographicCamera(-.025,.025,.025,-.025,.0001,10);
     camera.position.copy(center).add(new T.Vector3(.022,col?.012:.05,.07));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(600,400,false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*600,row*400);
    }
    checks.push({variant:ship.model.userData.variant||'original',covers,glError:ship.renderer.getContext().getError()});ship.dispose();
   }
   return {checks,image:sheet.toDataURL()};
  });
  assert.deepEqual(errors,[]);for(const c of result.checks){assert(c.covers>10);assert.equal(c.glError,0);}
  const preview=path.join(require('node:os').tmpdir(),'st-command-glass-lights.png');fs.writeFileSync(preview,Buffer.from(result.image.split(',')[1],'base64'));console.log(JSON.stringify(result.checks));console.log(preview);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
