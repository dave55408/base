/* Run explicitly to render and inspect hull burns on standard and HD ships. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.resolve(__dirname,'../../elf-adventure')]}));
const server=require('../server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.battleScene);
  for(const hd of [false,true]){
   const result=await page.evaluate(async hd=>{
    const s=window.battleScene,T=s.T;s.sim.replayShot=null;s.replayCut=null;if(hd){await BattleReplayHD.load();s.setReplayHD(true);}s.update(0,true);let replayHit;
    for(const ship of Object.values(s.ships)){
     const model=ship.userData.model;ship.updateMatrixWorld(true);
     for(const [index,x]of [-.22,.22].entries()){
      const start=model.localToWorld(new T.Vector3(x,1.2,-1.15)),end=model.localToWorld(new T.Vector3(x,-.2,-1.15)),contact=s.traceHull(ship,start,end);
      if(!contact)throw Error('No saucer contact');const point=model.worldToLocal(contact.point.clone()),normal=contact.normal.clone().transformDirection(model.matrixWorld.clone().invert());s.addImpactScar(ship,index?'phaser':'torpedo',{point,normal});if(ship===s.ships.Yorktown&&index===0)replayHit={point,normal};
     }
    }
    const ship=s.ships.Yorktown,model=ship.userData.model,camera=new T.PerspectiveCamera(40,16/9,.5,65000);
    camera.position.copy(model.localToWorld(new T.Vector3(1.05,1.5,.25)));camera.lookAt(model.localToWorld(new T.Vector3(0,.25,-1.0)));
    const render=time=>{s.clock=time;s.update(0,true);s.renderer.render(s.scene,camera);return s.renderer.domElement.toDataURL().split(',')[1];};
    const first=render(0),second=render(1.1);
    s.replayCut=null;s.sim.replayShot={kind:'component',focus:'Yorktown',key:'damage-preview',screenAt:7,at:7,damageInsert:true,event:{hullDamage:5,hit:replayHit}};s.update(0,true);
    const contact=model.localToWorld(replayHit.point.clone()),normal=replayHit.normal.clone().transformDirection(model.matrixWorld),facing=s.camera.position.clone().sub(contact).normalize().dot(normal),projected=contact.clone().project(s.camera);
    s.renderer.render(s.scene,s.camera);const replay=s.renderer.domElement.toDataURL().split(',')[1];
    return {first,second,replay,facing,center:[projected.x,projected.y],counts:Object.values(s.ships).map(ship=>ship.userData.scars.length),glError:s.renderer.getContext().getError()};
   },hd);
   assert(result.counts.every(c=>c===2));assert.equal(result.glError,0);assert.notEqual(result.first,result.second,'rendered embers flicker over time');
   const file=path.resolve(__dirname,'../exports/damage-embers-'+(hd?'hd':'standard')+'.png');fs.writeFileSync(file,Buffer.from(result.second,'base64'));console.log(JSON.stringify({hd,file,counts:result.counts}));
   assert(result.facing>.9);assert(result.center.every(v=>Math.abs(v)<.05));fs.writeFileSync(path.resolve(__dirname,'../exports/replay-damage-camera-'+(hd?'hd':'standard')+'.png'),Buffer.from(result.replay,'base64'));
  }
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
