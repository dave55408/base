const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const harness=fs.readFileSync(__dirname+'/easy-mode.test.js','utf8').split("test('all elves")[0];
const scope={require,__dirname,console};vm.runInNewContext(harness+'\nglobalThis.load=loadGame;',scope);

function setup(room,x,y){
  const {api}=scope.load();api.initial('gold');const s=api.state();
  s.mode='playing';s.room=room;s.elves=[];s.held='coin';s.items.coin.room='held';
  const d=s.dragons.find(d=>d.name==='Yorgle');s.dragons=[d];
  Object.assign(s.bat,{room,x,y,vx:0,vy:0,carrying:null,carryingDragon:d.name,sightCooldown:10,chaseTimer:0});
  Object.assign(s.player,{x,y});s.pickupDelay=1;
  return {api,s,d};
}

test('bat places a dragon clear of the narrow passage walls before stealing an item',()=>{
  const {api,s,d}=setup('mosswoodDepths',575,430);s.player.x=552;
  assert(api.blocked(s.room,575,495,true),'old carried position intersects the passage wall');
  d.navigationGoal={x:1,y:1};d.navigationWaypoint={x:1,y:1};d.path=[{x:1,y:1}];
  api.updateBat(0);
  assert.equal(s.bat.carryingDragon,null);assert.equal(s.bat.carrying,'coin');assert.equal(s.held,null);
  for(const [dx,dy] of [[0,0],[-5,-35],[5,-35],[-5,35],[5,35]])assert(!api.blocked(d.room,d.x+dx,d.y+dy,true),'dragon body clears terrain');
  assert.equal(d.navigationGoal,null);assert.equal(d.navigationWaypoint,null);assert.equal(d.path.length,0);
  const start={x:d.x,y:d.y};
  for(let n=0;n<10;n++)api.updateDragons(.05);
  assert(Math.hypot(d.x-start.x,d.y-start.y)>10,'released dragon can move');
});

test('bat releases living and dead dragons safely from walls, trees, and room edges',()=>{
  for(const [room,x,y] of [['mosswoodHollow',265,470],['mazeML',480,320],['stone',480,360],['gold',480,250],['crossroads',20,20]])for(const dead of [false,true]){
    const {api,s,d}=setup(room,x,y);d.dead=dead;api.updateBat(0);
    assert.equal(s.bat.carryingDragon,null,room+' has a safe landing');
    assert.equal(d.dead,dead);
    for(const [dx,dy] of [[0,0],[-5,-35],[5,-35],[-5,35],[5,35]])assert(!api.blocked(d.room,d.x+dx,d.y+dy,true),room+' clears terrain');
  }
});

test('bat retains its dragon and leaves the player item alone when no landing is available',()=>{
  const {api,s,d}=setup('midnightVault',552,430);api.updateBat(0);
  assert.equal(s.bat.carryingDragon,d.name);assert.equal(s.bat.carrying,null);
  assert.equal(s.held,'coin');assert.equal(s.items.coin.room,'held');
});
