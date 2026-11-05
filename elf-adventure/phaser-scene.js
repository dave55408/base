/* global Phaser */
(() => {
  'use strict';
  const rules=window.ElfAdventure;
  const color=value=>Number.parseInt((value||'#ffffff').slice(1),16);

  class AdventureScene extends Phaser.Scene {
    constructor(){super({key:'AdventureScene'});}

    preload(){
      this.load.image('bat-up',rules.assetURL('assets/bat_up.png'));
      this.load.image('bat-down',rules.assetURL('assets/bat_down.png'));
      // Existing recolored artwork is decoded once by the rules adapter.
      // Those generated textures are registered lazily after decoding.
    }

    create(){
      this.pool=new Map();this.labelPool=new Map();this.sources=new WeakMap();this.textureSerial=0;
      this.ownedTextures=new Set(['room-artwork']);
      this.metrics={roomUploads:0,textureUploads:0,physicsSteps:0,steps:0};
      this.background=this.textures.addCanvas('room-artwork',rules.artworkCanvas);
      this.add.image(0,0,'room-artwork').setOrigin(0).setDepth(0);
      this.light=this.add.graphics().setDepth(10).setVisible(false);
      this.effects=this.add.graphics().setDepth(170);
      this.darkness=this.add.graphics().setDepth(175);
      this.pauseShade=this.add.rectangle(480,320,960,640,0x0b1418,.65).setDepth(190).setVisible(false);
      this.pauseText=this.add.text(480,320,'PAUSED',{fontFamily:'monospace',fontSize:'52px',color:'#f5d691'}).setOrigin(.5).setDepth(191).setVisible(false);
      this.playerBody=this.add.zone(480,530,30,30);
      this.physics.add.existing(this.playerBody);
      this.playerBody.body.setAllowGravity(false).setBounce(0).setCollideWorldBounds(false);
      this.terrain=this.physics.add.staticGroup();
      this.collider=this.physics.add.collider(this.playerBody,this.terrain,null,(player,wall)=>{
        const a=player.body,b=wall.body;
        // Treat floating-point contact as touching, not penetration. Otherwise
        // an adjoining wall can catch a body sliding along a shared edge.
        return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1e-7&&
          Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1e-7;
      });
      this.physics.world.setBounds(-80,-80,1120,800);
      const output=this.game.canvas;
      rules.artworkCanvas.id='game-artwork';rules.artworkCanvas.style.display='none';
      output.id='game';output.tabIndex=0;output.setAttribute('aria-label','Elf Adventure game world');
      this.tooltipLayer=document.createElement('div');
      this.tooltipLayer.className='elf-tooltip-layer';
      output.parentElement.appendChild(this.tooltipLayer);
      rules.attach(this,output);
      this.onDown=event=>rules.keyDown(event);this.onUp=event=>rules.keyUp(event);
      this.input.keyboard.on('keydown',this.onDown);this.input.keyboard.on('keyup',this.onUp);
      this.game.events.on(Phaser.Core.Events.BLUR,rules.clearInput);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,this.shutdown,this);
      this.resizeObserver=new ResizeObserver(()=>{
        // Tab changes the parent without resizing the browser window. Refresh
        // must use its new bounds, otherwise FIT clips at the previous size.
        this.scale.getParentBounds();
        this.scale.refresh();
      });
      this.resizeObserver.observe(document.getElementById('phaser-host'));
      this.renderFrame(rules.frame());
      // A small explicit boundary is useful for local development and browser smoke tests.
      window.elfGame={game:this.game,scene:this,rules};
    }

    update(time,delta){
      if(!this.pool)return;
      // Substeps prevent tunneling after a delayed frame without running two RAF loops.
      const dt=1/60;
      this.simulationRemainder=(this.simulationRemainder||0)+Math.min(delta/1000,.1);
      while(this.simulationRemainder>=dt-1e-8){
        rules.step(dt);this.simulationRemainder=Math.max(0,this.simulationRemainder-dt);this.metrics.steps++;
      }
      this.renderFrame(rules.frame());
      rules.tooltip();
    }

    syncTerrain(){
      const key=rules.geometryKey();
      if(key===this.terrainKey)return;
      this.terrainKey=key;this.terrain.clear(true,true);
      // Retire old bodies before inserting the new room's colliders.
      this.physics.world.postUpdate();
      for(const rect of rules.geometry()){
        const zone=this.add.zone(rect.x+rect.w/2,rect.y+rect.h/2,rect.w,rect.h);
        this.terrain.add(zone);zone.body.updateFromGameObject();
      }
    }

    resolveMotion(player,dx,dy,dt){
      this.syncTerrain();
      const body=this.playerBody.body;
      body.reset(player.x,player.y);body.setVelocity(dx/dt,dy/dt);body.preUpdate(false,dt);
      this.physics.world.step(dt);this.metrics.physicsSteps++;
      const motion={x:body.center.x-player.x,y:body.center.y-player.y};
      // The adapter still handles transparent castle pixels, bridge channels,
      // movable objects, protection fields and room-transition rules.
      return motion;
    }

    textureFor(entity){
      if(entity.id==='bat')return {key:Math.floor(performance.now()/180)%2===0?'bat-up':'bat-down'};
      const source=entity.source;
      if(!source||!(source.width||source.naturalWidth)||source.complete===false)return null;
      let entry=this.sources.get(source);
      if(!entry){
        const key='art:'+this.textureSerial++;
        const texture=source.getContext?this.textures.addCanvas(key,source):this.textures.addImage(key,source);
        entry={key,texture,version:entity.version||''};this.sources.set(source,entry);this.metrics.textureUploads++;
        this.ownedTextures.add(key);
      }else if(entry.version!==(entity.version||'')){
        entry.texture.refresh();entry.version=entity.version||'';this.metrics.textureUploads++;
      }
      let frame;
      if(entity.crop){
        frame='crop:'+entity.crop.join(',');
        if(!entry.texture.has(frame)){const [x,y,w,h]=entity.crop;entry.texture.add(frame,0,x,y,w,h);}
      }
      return {key:entry.key,frame};
    }

    renderFrame(frame){
      if(frame.backgroundKey!==this.backgroundKey){
        rules.renderRoom();this.background.refresh();this.backgroundKey=frame.backgroundKey;this.metrics.roomUploads++;
      }
      const active=new Set();
      for(const entity of frame.entities){
        active.add(entity.id);
        let image=this.pool.get(entity.id);
        if(!image){image=this.add.image(entity.x,entity.y,'__WHITE');this.pool.set(entity.id,image);}
        const texture=this.textureFor(entity),textureKey=texture?texture.key+':'+(texture.frame||''):'__WHITE';
        if(image.getData('art')!==textureKey){
          image.setTexture(texture?.key||'__WHITE',texture?.frame);image.setData('art',textureKey);
        }
        if(texture)image.clearTint();else image.setTint(color(entity.color));
        image.setAlpha(entity.alpha??1);
        image.setPosition(Math.round(entity.x),Math.round(entity.y)).setDisplaySize(entity.width,entity.height).setDepth(entity.depth).setVisible(true);
      }
      for(const [id,image] of this.pool)if(!active.has(id))image.setVisible(false);
      this.light.setVisible(!!frame.light);
      this.light.clear().fillStyle(0xe5bc00,.8);
      if(frame.light)for(const r of frame.light.rects)this.light.fillRect(r.x,r.y,r.w,r.h);
      this.darkness.clear().fillStyle(0x151515,1);
      for(const r of frame.darknessRects||[])this.darkness.fillRect(r.x,r.y,r.w,r.h);
      this.darkness.fillStyle(0x333333,1);
      for(const r of frame.darkRoomWallRects||[])this.darkness.fillRect(r.x,r.y,r.w,r.h);
      this.effects.clear();
      for(const rect of frame.mechanismRects||[]){
        this.effects.fillStyle(color(rect.color||'#000000'),1).fillRect(rect.x,rect.y,rect.w,rect.h);
      }
      for(const ring of frame.rings){
        this.effects.lineStyle(4,color(ring.color),1);
        for(let i=0;i<24;i++){const a=i*Math.PI/12;this.effects.beginPath();this.effects.arc(ring.x,ring.y,ring.radius,a,a+Math.PI/24);this.effects.strokePath();}
      }
      if(frame.mode==='winning'){
        const t=rules.getState().winTimer;
        for(let i=0;i<16;i++)this.effects.fillStyle(Phaser.Display.Color.HSVToRGB((t*.8+i/16)%1,1,1).color).fillRect(305+i*79%355,75+i*137%310,5+i%3*3,5+i%3*3);
      }
      const labels=new Set();
      const canvasBounds=this.game.canvas.getBoundingClientRect(),hostBounds=this.tooltipLayer.parentElement.getBoundingClientRect();
      Object.assign(this.tooltipLayer.style,{left:(canvasBounds.left-hostBounds.left)+'px',top:(canvasBounds.top-hostBounds.top)+'px',width:canvasBounds.width+'px',height:canvasBounds.height+'px'});
      this.tooltipLayer.hidden=frame.mode==='title'||frame.mode==='paused'||frame.blockedByDialog;
      for(const label of frame.labels){
        labels.add(label.id);let text=this.labelPool.get(label.id);
        if(!text){text=document.createElement('div');text.className='elf-tooltip';this.tooltipLayer.appendChild(text);this.labelPool.set(label.id,text);}
        if(text.textContent!==label.text)text.textContent=label.text;
        text.hidden=false;
        const x=label.x*canvasBounds.width/rules.width-text.offsetWidth/2;
        const y=(label.y+55)*canvasBounds.height/rules.height-text.offsetHeight;
        text.style.left=Math.round(Math.max(3,Math.min(canvasBounds.width-text.offsetWidth-3,x)))+'px';
        text.style.top=Math.round(Math.max(3,Math.min(canvasBounds.height-text.offsetHeight-3,y)))+'px';
      }
      for(const [id,text] of this.labelPool)if(!labels.has(id))text.hidden=true;
      this.pauseShade.setVisible(frame.mode==='paused');this.pauseText.setVisible(frame.mode==='paused');
    }

    shutdown(){
      this.resizeObserver.disconnect();
      this.tooltipLayer.remove();
      this.input.keyboard.off('keydown',this.onDown);this.input.keyboard.off('keyup',this.onUp);
      this.game.events.off(Phaser.Core.Events.BLUR,rules.clearInput);
      if(this.collider.world)this.collider.destroy();
      // Phaser may have already destroyed the display list / physics groups.
      if(this.terrain.children)this.terrain.clear(true,true);
      rules.detach();
      this.pool.clear();this.labelPool.clear();
      for(const key of this.ownedTextures)this.textures.remove(key);
      delete window.elfGame;
    }
  }

  window.AdventureScene=AdventureScene;
  new Phaser.Game({
    type:Phaser.AUTO,parent:'phaser-host',width:rules.width,height:rules.height,
    backgroundColor:'#8f8b8f',pixelArt:true,roundPixels:true,
    render:{antialias:false,preserveDrawingBuffer:true},
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,resizeInterval:50},
    physics:{default:'arcade',arcade:{gravity:{x:0,y:0},customUpdate:true,debug:false}},
    scene:[AdventureScene],audio:{noAudio:true},banner:false
  });
})();
