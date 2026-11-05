const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {createServer}=require('./dev-server.cjs');

(async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const errors=[],port=server.address().port;
  let browser;
  try{
    const chrome=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser=await chromium.launch({...(fs.existsSync(chrome)?{executablePath:chrome}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1200,height:850}});
    page.on('pageerror',error=>errors.push(error.stack||error.message));
    const directFile=process.argv.includes('--file');
    await page.goto(directFile?pathToFileURL(path.join(__dirname,'index.html')).href:'http://127.0.0.1:'+port);
    await page.waitForFunction(()=>window.elfGame?.scene.pool?.size>0);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(()=>window.Phaser.VERSION),'3.90.0');
    assert.equal(await page.locator('#phaser-host canvas').count(),1);
    assert.equal(await page.evaluate(()=>window.elfGame.game.scene.getScenes(true).length),1);
    // Tab must resize the whole room rather than cropping the previous canvas.
    assert(await page.evaluate(()=>!document.body.classList.contains('playfield-only')),'starts with controls visible');
    assert(await page.locator('aside').isVisible(),'Tab panels visible on startup');
    assert(await page.locator('#hints').isVisible(),'hints visible on startup');
    assert.equal(await page.locator('#hintsToggle').textContent(),'Hide hints');
    assert.equal(await page.locator('#hintsToggle').getAttribute('aria-expanded'),'true');
    async function checkTabLayout(){
      await page.waitForFunction(()=>{
        const host=document.getElementById('phaser-host').getBoundingClientRect();
        const canvas=document.querySelector('#phaser-host canvas').getBoundingClientRect();
        return Math.abs(canvas.left-host.left)<2&&Math.abs(canvas.top-host.top)<2&&
          Math.abs(canvas.width-host.width)<2&&Math.abs(canvas.height-host.height)<2;
      },null,{timeout:3000});
      assert.deepEqual(await page.evaluate(()=>[elfGame.game.canvas.width,elfGame.game.canvas.height]),[960,640],'entire room remains in the canvas');
    }
    await checkTabLayout();
    for(let toggle=0;toggle<4;toggle++){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.keyboard.press('Tab');
      await page.waitForFunction(visible=>document.body.classList.contains('playfield-only')!==visible,toggle%2===1);
      await checkTabLayout();
      assert.equal(await page.locator('aside').isVisible(),toggle%2===1,'Tab hides and shows controls');
    }
    await page.evaluate(()=>{
      const {rules}=elfGame;rules.newQuest();const s=rules.getState();s.mode='playing';s.room='crossroads';s.elves=[];
      for(const [index,id] of ['apple','apple2','coin','coin2','flute','flower'].entries())s.items[id]={room:s.room,x:180+index*100,y:320};
      const first=rules.frame();
      for(const id of ['apple','apple2','coin','coin2','flute','flower']){
        const entity=first.entities.find(entity=>entity.id==='item:'+id);
        if(!entity?.source||entity.crop)throw Error('Gifts must use simple pixel sprites');
        const kind=id.startsWith('apple')?'apple':id.startsWith('coin')?'coin':id;
        const sizes={apple:[6,7,14],coin:[6,6,12],flower:[5,7,15],flute:[6,2,12]},expected=sizes[kind];
        if(entity.source.width!==expected[0]||entity.source.height!==expected[1])throw Error('Sprites must use the reference block grid');
        if(Math.abs(entity.width/entity.source.width-entity.height/entity.source.height)>1e-8)throw Error('Reference pixels must stay square when enlarged');
        if(entity.width<25||entity.height<9)throw Error('Tiny native sprites must retain their gameplay display size');
        if(rules.frame().entities.find(other=>other.id===entity.id).source!==entity.source)throw Error('Simple gift textures must be reused');
        const pixels=entity.source.getContext('2d').getImageData(0,0,entity.source.width,entity.source.height).data;
        const colors=new Set();let transparent=0,filled=0;
        for(let i=0;i<pixels.length;i+=4){
          if(pixels[i+3]===0)transparent++;
          else{filled++;if(pixels[i+3]!==255)throw Error('Simple pixels must have crisp edges');colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);}
        }
        if(colors.size!==1||(!transparent&&id!=='flute'))throw Error('Simple gifts must use one flat color and preserve negative space');
        if(filled!==expected[2])throw Error('Sprite must match the reference filled-pixel count');
        if(['apple','apple2','coin','coin2'].includes(id)){
          const center=(Math.floor(entity.source.height/2)*entity.source.width+Math.floor(entity.source.width/2))*4;
          if(pixels[center+3]!==0)throw Error('Simplified apple and coin must retain the original hollow centers');
        }
      }
      s.held='flute';s.items.flute.room='held';rules.refresh();
      if(document.getElementById('itemIcon'))throw Error('The carrying panel should be removed');
      if(!rules.frame().entities.find(e=>e.id==='item:flute')?.source)throw Error('Carried flute must retain its pixel sprite');
      rules.newQuest();
    });
    await page.evaluate(async()=>{
      const {rules}=elfGame;rules.newQuest();const s=rules.getState();s.mode='playing';s.room='crossroads';
      s.elves=[];s.bat.room='south';
      const reference=new Image();reference.src=rules.assetURL('assets/dragon-ko.png');await reference.decode();
      const eyeMask=document.createElement('canvas');eyeMask.width=3;eyeMask.height=3;
      const eye=eyeMask.getContext('2d');eye.fillStyle='#fff';eye.fillRect(0,0,3,3);
      eye.globalCompositeOperation='destination-out';eye.imageSmoothingEnabled=true;eye.imageSmoothingQuality='high';
      eye.drawImage(reference,39,16,12,11,0,0,3,3);
      const mask=eye.getImageData(0,0,3,3);
      for(let i=0;i<mask.data.length;i+=4){
        const alpha=mask.data[i+3]>=128?255:0;
        if((alpha===255)!==[0,2,4,6,8].includes(i/4))throw Error('KO eye must be a symmetric three-pixel X');
        mask.data[i]=mask.data[i+1]=mask.data[i+2]=alpha;mask.data[i+3]=alpha;
      }
      eye.putImageData(mask,0,0);
      function bounds(pixels,width,height){
        let left=width,top=height,right=-1,bottom=-1;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]){
          left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
        }
        return {x:left,y:top,w:right-left+1,h:bottom-top+1};
      }
      for(const dragon of s.dragons){
        dragon.room=s.room;dragon.dead=false;dragon.biting=false;dragon.axePauseTimer=0;
        const source=()=>rules.frame().entities.find(entity=>entity.id==='dragon:'+dragon.name).source;
        const normal=source();if(!normal)throw Error('Dragon sprite not decoded');
        dragon.axePauseTimer=2;const stunned=source();
        if(stunned===normal||source()!==stunned)throw Error('KO sprite must differ and be cached');
        const scale=stunned.width/normal.width;
        if(scale!==1||stunned.height!==normal.height)throw Error('KO sprite must use the normal native pixel grid');
        const normalPixels=normal.getContext('2d').getImageData(0,0,normal.width,normal.height).data;
        const to=bounds(normalPixels,normal.width,normal.height);
        const expected=document.createElement('canvas');expected.width=stunned.width;expected.height=stunned.height;
        const brush=expected.getContext('2d');brush.imageSmoothingEnabled=false;
        brush.drawImage(normal,0,0,expected.width,expected.height);
        const unchanged=brush.getImageData(0,0,expected.width,expected.height).data;
        const tint=normal.getContext('2d').getImageData(10,6,1,1).data;
        brush.fillStyle=`rgb(${tint[0]},${tint[1]},${tint[2]})`;brush.fillRect(8*scale,8*scale,4*scale,2*scale);
        brush.globalCompositeOperation='destination-out';brush.drawImage(eyeMask,9,7);
        const expectedPixels=brush.getImageData(0,0,expected.width,expected.height).data;
        const pixels=stunned.getContext('2d').getImageData(0,0,stunned.width,stunned.height).data;
        const actualBounds=bounds(pixels,stunned.width,stunned.height);
        if(Object.keys(to).some(key=>actualBounds[key]!==to[key]*scale))throw Error('KO dragon must keep normal visible size and position');
        for(let offset=0;offset<pixels.length;offset+=4){
          const x=(offset/4)%stunned.width,y=Math.floor(offset/4/stunned.width);
          const eyeRegion=x>=8&&x<12&&y>=7&&y<10;
          for(let channel=0;channel<4;channel++){
            if(!eyeRegion&&pixels[offset+channel]!==unchanged[offset+channel])throw Error('KO state must not change any body pixel outside the eye');
            if(pixels[offset+channel]!==expectedPixels[offset+channel])throw Error('KO state must use only the imported transparent X eye');
          }
          if(pixels[offset+3]!==0&&pixels[offset+3]!==255)throw Error('KO eye must not contain blurred or fractional pixels');
        }
        dragon.axePauseTimer=0;if(source()!==normal)throw Error('Dragon eyes must recover');
        dragon.axePauseTimer=2;dragon.dead=true;if(source()===stunned)throw Error('Dead dragon must keep its dead sprite');
      }
      rules.newQuest();
    });
    await page.evaluate(()=>{
      // Exercise the real decoded castle artwork and the Scene's Arcade body.
      for(const side of ['up','left','right','down'])for(const speed of [-1,-.2])for(const x of [450,480,515]){
        elfGame.rules.newQuest();const s=elfGame.rules.getState();s.dragons=[];s.elves=[];s.bat.room='south';
        s.held='goldKey';s.heldSide=side;s.items.goldKey.room='held';s.player.x=x;
        window.joystickInput={x:0,y:speed};
        for(let frame=0;frame<1000&&s.room==='gold';frame++)elfGame.rules.step(1/60);
        if(s.room!=='goldInside')throw new Error('Golden Keep entry failed: '+side+', '+speed+', x='+x);
      }
      window.joystickInput={x:0,y:0};elfGame.rules.newQuest();
    });
    // Real keyboard events must enter an already-open gate from its front area.
    for(const key of ['ArrowUp','w'])for(const x of [430,450,480,515,540]){
      await page.evaluate(x=>{
        const {rules}=window.elfGame;rules.newQuest();const s=rules.getState();s.dragons=[];s.elves=[];s.bat.room='south';
        s.held='goldKey';s.items.goldKey.room='held';s.gates.gold=true;s.gateLatched.gold=true;s.gateLift.gold=1;
        Object.assign(s.player,{x,y:530});
      },x);
      await page.keyboard.down(key);
      await page.waitForFunction(()=>window.elfGame.rules.getState().room==='goldInside',null,{timeout:2500});
      await page.keyboard.up(key);await page.waitForTimeout(35);
    }
    await page.evaluate(()=>window.elfGame.rules.newQuest());
    await page.evaluate(()=>window.elfGame.rules.teleport('blackApproach'));
    const x=await page.evaluate(()=>window.elfGame.rules.getState().player.x);
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');
    assert(await page.evaluate(()=>window.elfGame.rules.getState().player.x)>x,'Phaser keyboard + Arcade movement');
    assert(await page.evaluate(()=>window.elfGame.scene.metrics.physicsSteps)>0);
    await page.evaluate(()=>{
      const {rules}=window.elfGame;rules.teleport('blackApproach');const s=rules.getState();s.elves=[];s.dragons=[];
      Object.assign(s.player,{x:620,y:155});
    });
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');
    assert(await page.evaluate(()=>window.elfGame.rules.getState().player.x)<=642,'Arcade terrain stops the player at the tree');
    await page.evaluate(()=>{
      const {rules}=window.elfGame;rules.teleport('labyrinthApproach');const s=rules.getState();s.elves=[];s.dragons=[];s.bat.room='south';
      for(const item of Object.values(s.items))item.room='absent';s.placedBridges={};Object.assign(s.player,{x:480,y:230});
    });
    await page.keyboard.down('ArrowDown');await page.waitForTimeout(400);await page.keyboard.up('ArrowDown');
    assert(await page.evaluate(()=>window.elfGame.rules.getState().player.y)<260,'barrier blocks without bridge');
    await page.evaluate(()=>{
      const s=window.elfGame.rules.getState();s.placedBridges.bridge={room:'labyrinthApproach',x:480,y:322.5,vertical:true};s.items.bridge.room='placed';
    });
    await page.keyboard.down('ArrowDown');await page.waitForTimeout(850);await page.keyboard.up('ArrowDown');
    assert(await page.evaluate(()=>window.elfGame.rules.getState().player.y)>400,'bridge channel remains traversable with Arcade terrain');
    await page.evaluate(()=>{const {rules}=window.elfGame;rules.newQuest();rules.teleport('goldInside');const s=rules.getState();s.dragons=[];s.elves=[];Object.assign(s.player,{x:310,y:330});s.pickupDelay=0;});
    await page.waitForFunction(()=>window.elfGame.rules.getState().held==='sword2');
    await page.keyboard.press('p',{delay:40});await page.waitForFunction(()=>window.elfGame.rules.getState().mode==='paused');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.keyboard.press('p',{delay:40});await page.waitForFunction(()=>window.elfGame.rules.getState().mode==='playing');
    await page.evaluate(()=>window.elfGame.rules.newQuest());
    await page.evaluate(()=>{
      const {rules}=elfGame;rules.teleport('moonwoodShrine');const s=rules.getState();
      s.dragons=[];s.bat.room='south';s.held=null;Object.assign(s.player,{x:220,y:235});
      rules.renderRoom();
      const pixels=rules.artworkCanvas.getContext('2d').getImageData(145,355,70,90).data;
      let gold=0,oldStand=0,black=0;
      for(let i=0;i<pixels.length;i+=4){
        if(pixels[i]>180&&pixels[i+1]>120&&pixels[i+2]<170)gold++;
        if(pixels[i]===113&&pixels[i+1]===83&&pixels[i+2]===56)oldStand++;
        if(pixels[i]===0&&pixels[i+1]===0&&pixels[i+2]===0)black++;
      }
      if(gold<300||oldStand||black)throw Error('Shrine must show the gold bell with a forest-green outline');
      const trail=rules.artworkCanvas.getContext('2d');
      const gap=trail.getImageData(208,400,1,1).data,end=trail.getImageData(230,400,1,1).data;
      if([gap,end].some(pixel=>pixel[0]!==49||pixel[1]!==76||pixel[2]!==53))throw Error('Grass must surround the bell with no path branch');
      Object.assign(s.player,{x:180,y:400});rules.action();
      if(!s.forestQuest.requested)throw Error('New bell artwork must retain its bell interaction');
      Object.assign(s.player,{x:220,y:280});
    });
    await page.waitForFunction(()=>elfGame.scene.backgroundKey===elfGame.rules.frame().backgroundKey);
    const shrineUploads=await page.evaluate(()=>elfGame.scene.metrics.roomUploads);
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(()=>elfGame.rules.getState().forestQuest.switchDown);
    await page.keyboard.up('ArrowUp');
    assert.equal(await page.evaluate(()=>elfGame.rules.frame().mechanismRects.at(-1).y),227,'walking onto the switch moves its handle');
    await page.waitForFunction(()=>elfGame.rules.getState().forestQuest.open);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(()=>!elfGame.rules.getState().forestQuest.open&&elfGame.rules.getState().forestQuest.lift===0);
    await page.keyboard.up('ArrowRight');
    assert.equal(await page.evaluate(()=>elfGame.rules.frame().mechanismRects.at(-1).y),208,'walking away releases the switch handle');
    assert(await page.evaluate(()=>elfGame.rules.getState().player.x<585),'player switch releases and gate closes before the doorway');
    assert.equal(await page.evaluate(()=>elfGame.scene.metrics.roomUploads),shrineUploads,'shrine gate animation reuses the static room texture');
    await page.evaluate(()=>{
      const {rules}=window.elfGame;rules.teleport('moonwoodShrine');const s=rules.getState();s.dragons=[];s.bat.room='south';
      const elf=s.elves[0];s.elves=[elf];
      for(const item of Object.values(s.items))if(item.room==='westInside')item.elfAssessment={home:'west',x:item.x,y:item.y};
      Object.assign(elf,{room:'moonwoodShrine',x:180,y:235,goal:null,path:[],giftTask:null,carrying:null,wait:0,stunTimer:0,surpriseTimer:0,emotionalState:{sentiment:3,passion:1}});
      s.forestQuest.helper=elf.home;s.forestQuest.requested=false;
    });
    await page.waitForFunction(()=>window.elfGame.rules.getState().forestQuest.open);
    const before=await page.evaluate(()=>window.elfGame.scene.metrics.roomUploads);
    await page.waitForTimeout(400);
    const after=await page.evaluate(()=>window.elfGame.scene.metrics.roomUploads);
    assert(after-before<=1,'idle rooms reuse the cached texture');
    await page.evaluate(()=>{window.elfGame.rules.getState().elves[0].emotionalState.sentiment=2;});
    await page.waitForFunction(()=>!window.elfGame.rules.getState().forestQuest.open);
    await page.waitForFunction(()=>window.elfGame.rules.getState().forestQuest.lift===0);
    fs.mkdirSync(path.join(__dirname,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'test-results',directFile?'phaser-shrine-file.png':'phaser-shrine.png')});
    await page.setViewportSize({width:390,height:844});
    await checkTabLayout();
    await page.keyboard.press('Tab');
    await page.waitForFunction(()=>document.body.classList.contains('playfield-only'));await checkTabLayout();
    assert(!await page.locator('aside').isVisible(),'Tab switches narrow view to fullscreen');
    await page.keyboard.press('Tab');
    await page.waitForFunction(()=>!document.body.classList.contains('playfield-only'));await checkTabLayout();
    assert(await page.locator('aside').isVisible(),'Tab restores controls in narrow view');
    await page.waitForFunction(()=>document.querySelector('#phaser-host canvas').getBoundingClientRect().width<=391);
    const bounds=await page.locator('#phaser-host canvas').boundingBox();assert(bounds.width<=391,'responsive canvas fits mobile viewport');
    await page.evaluate(()=>{
      const {rules}=elfGame;rules.newQuest();rules.teleport('crossroads');const s=rules.getState();
      s.dragons=[];s.bat.room='south';s.bat.carrying=null;
      for(const [id,item] of Object.entries(s.items))if(id!=='westKey')item.room='absent';
      const elf=s.elves[0];s.elves=[elf];
      Object.assign(elf,{room:s.room,x:350,y:320,goal:null,path:[],giftTask:null,carrying:null,wait:0,stunTimer:0,surpriseTimer:0,emotionalState:{sentiment:1,passion:3}});
      Object.assign(s.player,{x:500,y:320,stunTimer:0,axeGrace:0});
      s.held='flower';s.items.flower.room='held';
      s.items.axe={room:s.room,x:440,y:320};
      s.axeFlights.axe={room:s.room,vx:650,vy:0,travelled:0,age:0,thrower:'west'};
    });
    await page.waitForFunction(()=>elfGame.rules.getState().player.stunTimer>4.5);
    assert.equal(await page.evaluate(()=>elfGame.rules.getState().mode),'playing');
    assert.equal(await page.evaluate(()=>elfGame.rules.getState().held),null);
    const stunnedAt=await page.evaluate(()=>elfGame.rules.getState().player.x);
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(()=>elfGame.rules.getState().elves[0].carrying==='flower');
    assert.equal(await page.evaluate(()=>elfGame.rules.getState().player.x),stunnedAt,'stun blocks movement while the elf steals the drop');
    assert(await page.evaluate(()=>{
      const {rules}=elfGame,p=rules.getState().player,drawn=rules.frame().entities.find(entity=>entity.id==='player');
      return Math.abs(drawn.x-p.x)<=1.4&&Math.abs(drawn.y-p.y)<=.8;
    }),'cursor vibration remains subtle');
    await page.keyboard.up('ArrowRight');
    await page.waitForFunction(()=>elfGame.rules.getState().player.stunTimer===0);
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(150);await page.keyboard.up('ArrowRight');
    assert(await page.evaluate(()=>elfGame.rules.getState().player.x)>stunnedAt,'movement resumes after stun');
    await page.evaluate(()=>{
      const {rules}=window.elfGame;rules.newQuest();rules.teleport('goldInside');const s=rules.getState();s.elves=[];s.dragons=[];s.bat.room='south';s.held=null;
      for(const [id,item] of Object.entries(s.items))if(id.startsWith('jewel'))Object.assign(item,{room:'goldInside',x:700,y:400});
    });
    await page.waitForFunction(()=>window.elfGame.rules.getState().mode==='winning');
    await page.evaluate(()=>window.elfGame.scene.scene.restart());
    await page.waitForFunction(()=>window.elfGame?.scene.pool?.size>0);
    assert.equal(await page.locator('#phaser-host canvas').count(),1,'Scene restart does not duplicate the canvas');
    assert.deepEqual(errors,[],'no browser exceptions');
    console.log(JSON.stringify({protocol:directFile?'file:':'http:',engine:'Phaser '+await page.evaluate(()=>Phaser.VERSION),renderer:await page.evaluate(()=>window.elfGame.game.renderer.type===Phaser.WEBGL?'WebGL':'Canvas'),checks:['scene boot','native sprite display','Golden Keep entry: all key sides, full/slow joystick, center/jambs','keyboard','Arcade movement','tree collision','barrier collision','bridge crossing','second sword pickup','pause/resume','restart','happy helper gate animation','cached room artwork','mobile sizing','six-jewel victory','Scene restart cleanup'],metrics:await page.evaluate(()=>window.elfGame.scene.metrics)},null,2));
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
