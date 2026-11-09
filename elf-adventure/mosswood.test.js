const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0];
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('Mosswood reference walls leave two aligned, reversible doors to the lower room',()=>{
  const {api,window}=scope.load();api.initial('gold');const s=api.state();
  s.mode='playing';s.elves=[];s.dragons=[];s.bat.room='gold';s.bat.carrying=null;
  for(const item of Object.values(s.items))item.room='absent';
  assert.equal(api.neighbor('stone',api.dir.up),'mazeML');
  assert.equal(api.neighbor('mazeML',api.dir.down),'stone');
  assert(!api.blocked('stone',480,20,true));
  assert.equal(api.neighbor('stone',api.dir.down),'mosswoodHollow');
  assert.equal(api.neighbor('mosswoodHollow',api.dir.up),'stone');
  assert.equal(api.neighbor('mosswoodHollow',api.dir.down),'mosswoodDepths');
  assert(api.blocked('mosswoodHollow',480,620,true));
  assert.equal(api.visibleExits('mosswoodHollow').down,true);
  for(const [x,y] of [[300,20],[480,400],[20,200],[940,200],[480,620]])assert(api.blocked('stone',x,y,true));
  for(const [x,y] of [[20,320],[940,320],[169.2,620],[794.4,620],[480,220]])assert(!api.blocked('stone',x,y,true));
  for(const x of [20,940])assert(api.blocked('stone',x,470,true));
  assert(api.blocked('stone',740,160,true));
  for(const [x,y] of [[220,160],[220,480],[740,480]])assert(!api.blocked('stone',x,y,true));
  for(const x of [169.2,794.4]){
    assert(!api.blocked('mosswoodHollow',x,20,true));
    s.room='stone';Object.assign(s.player,{x,y:570});window.joystickInput={x:0,y:1};
    for(let n=0;n<80&&s.room==='stone';n++)api.update(.02);
    assert.equal(s.room,'mosswoodHollow');assert.equal(s.player.x,x);
    window.joystickInput={x:0,y:-1};
    for(let n=0;n<80&&s.room==='mosswoodHollow';n++)api.update(.02);
    assert.equal(s.room,'stone');assert.equal(s.player.x,x);
  }
  for(const [direction,x,target,reverse] of [[-1,70,'homeCrossing',1],[1,890,'crossroads',-1]]){
    s.room='stone';Object.assign(s.player,{x,y:320});window.joystickInput={x:direction,y:0};
    for(let n=0;n<100&&s.room==='stone';n++)api.update(.02);
    assert.equal(s.room,target);assert.equal(s.player.y,320);
    window.joystickInput={x:reverse,y:0};
    for(let n=0;n<100&&s.room===target;n++)api.update(.02);
    assert.equal(s.room,'stone');assert.equal(s.player.y,320);
  }
  s.room='stone';Object.assign(s.player,{x:480,y:90});window.joystickInput={x:0,y:-1};
  for(let n=0;n<100&&s.room==='stone';n++)api.update(.02);
  assert.equal(s.room,'mazeML','north doorway enters Western Maze');
  window.joystickInput={x:0,y:1};
  for(let n=0;n<100&&s.room==='mazeML';n++)api.update(.02);
  assert.equal(s.room,'stone','maze doorway returns to Mosswood Forest');
});

test('both Hollow entrances reach the south passage to the key chamber',()=>{
  const {api}=scope.load();api.initial('gold');const s=api.state();s.elves=[];
  const key={room:'mosswoodHollow',x:552,y:620};
  assert(!api.blocked(key.room,key.x,key.y,true));
  // Flood walkable floor, checking each step so narrow walls cannot be skipped.
  for(const startX of [170,790]){
    const queue=[[startX,60]],seen=new Set([startX+',60']);let reached=false;
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];if(Math.hypot(x-key.x,y-key.y)<15){reached=true;break;}
      for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10]]){
        const nx=x+dx,ny=y+dy,id=nx+','+ny;
        if(nx<15||nx>945||ny<55||ny>625||seen.has(id))continue;
        if(api.blocked(key.room,nx,ny,true)||api.blocked(key.room,x+dx/2,y+dy/2,true))continue;
        seen.add(id);queue.push([nx,ny]);
      }
    }
    assert(reached,'white key is reachable from entrance '+startX);
  }
});

test('Mosswood Depths matches the narrow passage and bottom key chamber in every quest mode',()=>{
  for(const mode of ['gold','easy','random']){
    const {api,window}=scope.load();api.initial(mode);const s=api.state();
    s.mode='playing';s.elves=[];s.dragons=[];s.bat.room='absent';
    const key=s.items.whiteKey;
    assert.equal(key.room,'mosswoodDepths');
    assert.equal(key.x,504);assert.equal(key.y,578);
    assert.equal(api.wallColor(key.room),'#3D8C45');
    assert.equal(api.neighbor(key.room,api.dir.up),'mosswoodHollow');
    for(const edge of ['down','left','right'])assert.equal(api.neighbor(key.room,api.dir[edge]),key.room);
    for(let y=20;y<=575;y+=5)assert(!api.blocked(key.room,552,y,true),'continuous narrow passage');
    for(const [x,y] of [[470,300],[640,300],[510,300],[594,300],[552,620],[440,575],[700,575]])assert(api.blocked(key.room,x,y,true),'solid green walls and half-width passage');
    for(const x of [537,567])assert(!api.blocked(key.room,x,300,true),'60-pixel-wide passage fits the player');
    for(const y of [515,530,578,585])for(const x of [480,504,552,660])assert(!api.blocked(key.room,x,y,true),'100-pixel-tall chamber floor');
    for(const x of [480,504,552,660])assert(!api.blocked(key.room,x,578,true),'wider chamber floor');
    s.room='mosswoodHollow';Object.assign(s.player,{x:552,y:570});window.joystickInput={x:0,y:1};
    for(let n=0;n<100&&s.room==='mosswoodHollow';n++)api.update(.02);
    assert.equal(s.room,key.room,'south exit enters the new room');
    assert.equal(s.player.x,552,'aligned passage');
    for(let n=0;n<100&&s.player.y<570;n++)api.update(.02);
    window.joystickInput={x:-1,y:0};
    for(let n=0;n<20&&s.held!=='whiteKey';n++){api.update(.02);api.pickup();}
    assert.equal(s.held,'whiteKey','key can be collected in the bottom chamber');
    Object.assign(s.player,{x:552,y:60});window.joystickInput={x:0,y:-1};
    for(let n=0;n<100&&s.room==='mosswoodDepths';n++)api.update(.02);
    assert.equal(s.room,'mosswoodHollow','north exit returns to the Hollow');
    assert.equal(s.held,'whiteKey','key can be brought back');
  }
});
