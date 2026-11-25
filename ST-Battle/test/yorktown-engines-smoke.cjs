const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]})),server=require('../server.cjs');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
    assert(await page.evaluate(()=>Object.values(window.battleScene.ships).every(ship=>{let clean=true;ship.traverse(part=>{if(/nacelle light strip/i.test(part.name))clean=false;});return clean;})),'both ships omit the bright nacelle-top strips');
    for(const [name,eye] of [['rear',[100,120,180]],['top',[35,140,45]],['front',[100,110,-100]]]){
      const image=await page.evaluate(eye=>{
        const s=window.battleScene,sim=window.battle;sim.running=false;
        Object.assign(sim.enemy,{x:0,y:0,z:0,heading:0,pitch:0,bank:0});s.update(0,true);
        s.ships.Enterprise.visible=false;s.nebula.visible=false;s.stars.visible=false;if(s.planet)s.planet.visible=false;
        s.camera.position.set(...eye);s.camera.up.set(0,1,0);s.camera.zoom=1;s.camera.aspect=1.5;s.camera.updateProjectionMatrix();
        s.camera.lookAt(0,25,20);s.camera.updateMatrixWorld();s.renderer.setSize(1200,800,false);s.renderer.render(s.scene,s.camera);
        return s.renderer.domElement.toDataURL().split(',')[1];
      },eye);
      fs.writeFileSync(path.resolve(__dirname,`../exports/yorktown-engines-${name}.png`),Buffer.from(image,'base64'));
    }
    assert.deepEqual(errors,[]);console.log('Saved Yorktown nacelle close-ups.');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
