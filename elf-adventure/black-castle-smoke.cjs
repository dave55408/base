const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const {createServer}=require('./dev-server.cjs');
(async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.waitForFunction(()=>window.elfGame?.scene.pool?.size>0);
    await page.evaluate(()=>{
      const rules=elfGame.rules,state=rules.getState();state.mode='playing';state.dragons=[];state.elves=[];state.bat.room='absent';
      const bounds={},rightOutline={};
      for(const room of ['gold','black']){
        rules.teleport(room);rules.renderRoom();
        const pixels=rules.artworkCanvas.getContext('2d').getImageData(0,0,960,640).data;
        let left=960,top=640,right=0,bottom=0;
        for(let y=80;y<490;y++)for(let x=220;x<740;x++){
          const i=(y*960+x)*4;
          const castlePixel=room==='gold'?pixels[i]===210&&pixels[i+1]===210&&pixels[i+2]===64:pixels[i]===0&&pixels[i+1]===0&&pixels[i+2]===0;
          if(castlePixel){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
        }
        bounds[room]={left,top,width:right-left+1,height:bottom-top+1};
        rightOutline[room]=[115,145,170,200,240,280,310,350,400,450].map(y=>{
          let first=960,last=-1;
          for(let x=530;x<740;x++){
            const i=(y*960+x)*4,solid=room==='gold'?pixels[i]===210&&pixels[i+1]===210&&pixels[i+2]===64:pixels[i]===0&&pixels[i+1]===0&&pixels[i+2]===0;
            if(solid){first=Math.min(first,x);last=x;}
          }
          return [first,last];
        });
      }
      if(JSON.stringify(bounds.gold)!==JSON.stringify(bounds.black))throw Error('Castle size changed: '+JSON.stringify(bounds));
      if(bounds.black.width!==407||bounds.black.height!==369)throw Error('Expected original 407 by 369 castle size');
      for(let row=0;row<rightOutline.gold.length;row++)for(let edge=0;edge<2;edge++)if(Math.abs(rightOutline.gold[row][edge]-rightOutline.black[row][edge])>1)throw Error('Right castle outline differs from Golden Keep');
    });
    await page.evaluate(()=>{
      const rules=window.elfGame.rules;
      for(const room of ['gold','goldInside','crossroads','west','blueGate','redTrail','blueVault','stone','blueMaze','moonwoodShrine','blackApproach','lamplightLanding','midnightVault','black','blackInside','blackDungeon','mazeMR']){
        rules.teleport(room);rules.renderRoom();
        const pixels=rules.artworkCanvas.getContext('2d').getImageData(0,0,960,640).data;
        let colored=false;
        for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]&&(pixels[i]!==143||pixels[i+1]!==139||pixels[i+2]!==143)){colored=true;break;}
        if(!colored)throw Error(room+' rendered only the gray background');
      }
    });
    await page.evaluate(()=>{
      const rules=window.elfGame.rules,s=rules.getState();
      s.mode='playing';s.elves=[];s.dragons=[];s.bat.room='absent';
      rules.teleport('black');s.items.blackKey.room='absent';
      rules.step(.5);
      if(!s.gates.black||s.gateLift.black!==1)throw Error('Black gate starts raised');
      s.gateLatched.black=false;
      rules.step(.1);rules.step(1);
      if(s.gates.black||s.gateLift.black!==0)throw Error('Unlatched black gate must close without its key');
      s.held='blackKey';s.items.blackKey.room='held';s.heldSide='up';s.player.x=480;s.player.y=505;
      rules.step(.1);rules.step(1);
      if(!s.gates.black||s.gateLift.black!==1)throw Error('Black key must raise the gate');
      s.player.x=480;s.player.y=510;
      rules.keyDown({key:'ArrowUp',preventDefault(){}});rules.step(.05);rules.clearInput();
      if(s.room!=='blackInside')throw Error('Open black castle must be enterable');
      rules.teleport('black');s.mode='paused';rules.refresh();
    });
    await page.waitForTimeout(200);
    await page.locator('#phaser-host canvas').screenshot({path:path.join(os.tmpdir(),'black-castle-preview.png')});
    await page.evaluate(()=>{
      const rules=window.elfGame.rules;rules.newQuest();
      if(rules.getState().dragons.some(d=>d.name==='Vesper'))throw Error('Vesper must be absent after restart');
    });
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({checks:['castle remains 407 by 369, matching Golden Keep','gate starts raised, closes, and reopens with black key','castle entry','Vesper absent after restart']}));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
