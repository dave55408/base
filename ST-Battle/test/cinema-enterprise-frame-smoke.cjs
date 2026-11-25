const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]})),server=require('../server.cjs');
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
    const results=await page.evaluate(()=>{
      const sim=window.battle,s=window.battleScene,T=s.T,results=[];sim.running=false;
      const render=s.renderer.render;s.renderer.render=()=>{};
      try{for(const mode of ['cautious','reckless']){
        Object.assign(sim.player,{x:3800,y:0,z:0,heading:0,pitch:0});Object.assign(sim.enemy,{x:2200,y:0,z:0,heading:0,pitch:0});
        s.setCamera('cinematic');s.cinemaFlightMode=mode;s.cinemaSpeedPercent=0;s.camera.zoom=1;s.camera.updateProjectionMatrix();
        s.camera.position.set(3000,35,500);s.camera.lookAt(2200,0,0);s.cinemaTracking=null;s.update(.05);
        Object.assign(s.cinemaTracking,{focus:'Yorktown',nextShot:Infinity,nextRelocation:Infinity});let worst=0,visible=0;
        for(let i=0;i<300;i++){
          sim.player.x+=4;s.update(.05);s.ships.Enterprise.updateWorldMatrix(true,true);if(i<40)continue;
          let edge=0;
          s.ships.Enterprise.userData.model.traverse(mesh=>{
            if(!mesh.isMesh||!mesh.visible||!mesh.geometry)return;
            mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;
            for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
              const p=new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(s.camera);edge=Math.max(edge,Math.abs(p.x),Math.abs(p.y));
            }
          });
          worst=Math.max(worst,edge);if(edge<1)visible++;
        }
        results.push({mode,worst,visible});
      }}finally{s.renderer.render=render;s.update(0);}return results;
    });
    console.log(JSON.stringify(results));for(const result of results)assert(result.visible>=245,'actual Enterprise geometry stays in frame after recovery');
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
