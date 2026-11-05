const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {createServer}=require('./dev-server.cjs');
const path=require('node:path');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.argv.includes('--file')?pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.elfGame?.scene.pool);await page.waitForTimeout(650);
    await page.evaluate(()=>{
      const {rules,scene}=elfGame;rules.newQuest();rules.teleport('lamplightLanding');scene.scene.pause();
      const s=rules.getState();s.bat.room='absent';s.dragons=s.dragons.filter(d=>d.darkGuardian);
      document.getElementById('hints').hidden=true;
      const elf=s.elves[0];s.elves=[elf];
      for(const [id,item] of Object.entries(s.items))if(!['lamp','jewelNight'].includes(id)){item.room='absent';delete item.treasureOwner;}
      Object.assign(elf,{room:s.room,x:400,y:250,goal:null,path:[],giftTask:null,carrying:null,wait:0,stunTimer:0,surpriseTimer:0,stolenItems:{},emotionalState:{sentiment:3,passion:1}});
      Object.assign(s.player,{x:610,y:565});scene.renderFrame(rules.frame());
    });
    await page.screenshot({path:path.join(os.tmpdir(),'elf-lamplight-landing.png')});
    await page.evaluate(()=>{
      const {rules,scene}=elfGame;rules.teleport('midnightVault');const s=rules.getState();
      for(let i=0;i<120;i++)rules.step(1/60);
      if(s.mode!=='playing')throw Error('Dark entry should be safe');
      if(rules.frame().darknessRects.length!==1)throw Error('Unlit room must be black');
      scene.renderFrame(rules.frame());
    });
    await page.screenshot({path:path.join(os.tmpdir(),'elf-midnight-dark.png')});
    await page.evaluate(()=>{
      const {rules,scene}=elfGame;rules.teleport('lamplightLanding');const s=rules.getState();Object.assign(s.player,{x:610,y:565});rules.action();
      if(!s.darkQuest.helper)throw Error('Bell must summon the trusting friend');
      for(let i=0;i<3600&&!s.dragons[0].distracted;i++){
        if(s.elves[0].carrying==='lamp'&&s.room!=='midnightVault')rules.teleport('midnightVault');
        rules.step(1/60);
      }
      if(!s.dragons[0].distracted||s.elves[0].room!=='midnightVault'||s.mode!=='playing')throw Error('Friend must safely distract the dragon');
      scene.renderFrame(rules.frame());
    });
    await page.screenshot({path:path.join(os.tmpdir(),'elf-midnight-friend.png')});
    const result=await page.evaluate(()=>{
      const {rules,scene}=elfGame,s=rules.getState(),uploads=scene.metrics.roomUploads;
      const maskArea=rules.frame().darknessRects.reduce((a,r)=>a+r.w*r.h,0);
      Object.assign(s.player,{x:875,y:560});rules.step(1/60);scene.renderFrame(rules.frame());
      if(s.held!=='jewelNight')throw Error('Distracted dragon must allow the jewel pickup');
      if(scene.metrics.roomUploads!==uploads)throw Error('Light should reuse cached room artwork');
      return {litFraction:1-maskArea/(960*640),held:s.held,helper:s.elves[0].home,dragon:s.dragons[0].name};
    });
    for(const room of ['labyrinthGate','labyrinthVault']){
      await page.evaluate(room=>{
        const {rules,scene}=elfGame,s=rules.getState();
        s.elves=[];s.dragons=[];s.held=null;
        rules.teleport(room);s.items.lamp={room,x:480,y:320};
        const frame=rules.frame();
        if(frame.darknessRects.length||frame.light.w!==960||frame.light.h!==640)throw Error('Briarstone must enlarge its original light without dark masks');
        scene.renderFrame(frame);const uploads=scene.metrics.roomUploads;
        const fraction=frame.light.rects.reduce((sum,r)=>sum+r.w*r.h,0)/(960*640);
        if(fraction<=0||fraction>=.98||new Set(frame.light.rects.map(r=>r.w)).size<2)throw Error('Lamp must leave gray outside a jagged rim and behind walls');
        if(frame.mechanismRects.filter(r=>r.color==='#8f8b8f').length!==14)throw Error('All Briarstone walls must remain gray above the light');
        if(frame.mechanismRects.some(r=>r.color==='#000000'))throw Error('Briarstone walls must have no black outlines');
        s.items.lamp.x=150;s.items.lamp.y=130;scene.renderFrame(rules.frame());
        if(scene.metrics.roomUploads!==uploads)throw Error('Moving the lamp must reuse room artwork');
        if(!scene.light.visible||rules.frame().light.w<=108)throw Error('Original light must grow with the lamp');
        s.items.lamp.room='lamplightLanding';scene.renderFrame(rules.frame());
        if(Math.abs(rules.frame().light.w-108*1.15)>1e-9||Math.abs(rules.frame().light.h-108*1.15)>1e-9)throw Error('Larger clean square must return without the lamp');
        if(rules.frame().light.rects.length!==1)throw Error('Unlit Briarstone light must stay a clean square');
      },room);
      await page.screenshot({path:path.join(os.tmpdir(),'elf-'+room+'-lamp.png')});
    }
    assert.deepEqual(errors,[]);assert(result.litFraction>0&&result.litFraction<.98,'lamp near the corner clips the light footprint');console.log(JSON.stringify(result));
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
