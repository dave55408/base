const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0]
  .replace('globalThis.testApi={stunPlayer,','globalThis.testApi={roomWalls,stunPlayer,');
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

test('Briarstone adds eight distinct walls per room and keeps its doorways connected',()=>{
  for(const mode of ['gold','easy','random']){
    const {api}=scope.load();api.initial(mode);const s=api.state();
    s.mode='playing';s.elves=[];s.dragons=[];s.bat.room='absent';
    for(const item of Object.values(s.items))item.room='absent';
    const layouts=[];
    for(const room of ['labyrinthGate','labyrinthVault']){
      s.room=room;const walls=api.roomWalls(room);layouts.push(JSON.stringify(walls));
      assert.equal(walls.length,14,'six original walls plus eight additions');
      for(const wall of walls)assert(api.blocked(room,wall.x+wall.w/2,wall.y+wall.h/2,true),'wall blocks movement');
      const seen=new Set(['480,20']),queue=[[480,20]];
      for(let i=0;i<queue.length;i++){
        const [x,y]=queue[i];
        for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10]]){
          const nx=x+dx,ny=y+dy,key=nx+','+ny;
          if(nx<20||nx>940||ny<20||ny>620||seen.has(key)||api.blocked(room,nx,ny,true))continue;
          seen.add(key);queue.push([nx,ny]);
        }
      }
      if(api.visibleExits(room).down)assert(seen.has('480,620'),'north and south doorways remain connected');
      if(room==='labyrinthVault')assert(seen.has('940,320'),'White Castle exit remains reachable');
    }
    assert.notEqual(layouts[0],layouts[1],'each room has a different configuration');
  }
});
