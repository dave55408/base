const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

function duel(){
  const s=new B.Simulation(97);
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0,bank:0,speed:0});
  Object.assign(s.enemy,{x:6000,y:0,z:-150,heading:180,pitch:0,bank:0,speed:0});
  s.events=[];return s;
}

test('opposing saucers register contact without pushing either ship apart',()=>{
  const s=duel();assert(s.range>100);assert.deepEqual(B.shipContact(s.player,s.enemy).parts,['saucer','saucer']);
  const hull=[s.player.hull,s.enemy.hull],before=[{...s.player},{...s.enemy}];s.resolveShipCollision();
  assert(B.shipContact(s.player,s.enemy));assert.equal(s.shipsTouching,true);
  for(const [i,ship] of [s.player,s.enemy].entries())for(const key of ['x','y','z','speed','heading','pitch','bank'])assert.equal(ship[key],before[i][key]);
  assert.deepEqual([s.player.hull,s.enemy.hull],hull,'ordinary contact does not acquire ramming damage');
  assert.equal(s.events.filter(e=>e.type==='ship-collision').length,1);
  s.resolveShipCollision();assert.equal(s.events.filter(e=>e.type==='ship-collision').length,1);
});

test('vertically separated ships can pass closer than 100 units without a phantom collision',()=>{
  const s=duel();Object.assign(s.enemy,{z:0,y:60,heading:0});
  assert(s.range<100);assert.equal(B.shipContact(s.player,s.enemy),null);
  const positions=[{...s.player},{...s.enemy}];s.resolveShipCollision();
  assert.equal(s.shipsTouching,false);assert.equal(s.events.length,0);
  for(const [i,ship] of [s.player,s.enemy].entries())for(const axis of ['x','y','z'])assert.equal(ship[axis],positions[i][axis]);
});

test('warp nacelles participate in contact and detached engines leave a real gap',()=>{
  const s=duel();Object.assign(s.enemy,{x:6064,z:60,heading:0});
  assert.deepEqual(B.shipContact(s.player,s.enemy).parts,['nacelle','nacelle']);
  s.player.detachedNacelles.starboard=true;
  assert.equal(B.shipContact(s.player,s.enemy),null);
  assert(!B.shipCollisionShapes(s.player).some(shape=>shape.side==='starboard'));
  assert(B.shipCollisionShapes(s.player).some(shape=>shape.side==='port'));
});

test('swept movement catches a fast crossing even if both frame endpoints are clear',()=>{
  const s=duel();Object.assign(s.enemy,{x:6250,z:0,heading:0});
  const before={Enterprise:{x:6000,y:0,z:0},Yorktown:{x:5750,y:0,z:0}};
  const end=[{...s.player},{...s.enemy}];
  assert.equal(B.shipContact(s.player,s.enemy),null);
  s.resolveShipCollision(before);
  assert(s.events.some(e=>e.type==='ship-collision'));
  assert.equal(B.shipContact(s.player,s.enemy),null);
  for(const [i,ship] of [s.player,s.enemy].entries())for(const axis of ['x','y','z'])assert.equal(ship[axis],end[i][axis]);
});

test('contacts at varied attitudes preserve positions and do not repeat collision cues',()=>{
  for(let i=0;i<150;i++){
    const s=duel();
    Object.assign(s.player,{heading:i*137%360,pitch:i*37%150-75,bank:Math.sin(i)*.7});
    Object.assign(s.enemy,{x:6000+Math.sin(i*17)*80,y:Math.sin(i*3)*40,z:Math.cos(i*11)*90,heading:i*71%360,pitch:i*11%150-75,bank:Math.cos(i)*.7});
    const before=[{...s.player},{...s.enemy}];s.resolveShipCollision();
    for(const [j,ship] of [s.player,s.enemy].entries())for(const axis of ['x','y','z'])assert.equal(ship[axis],before[j][axis]);
    for(const ship of [s.player,s.enemy])assert(Number.isFinite(ship.x+ship.y+ship.z));
    const count=s.events.length;s.resolveShipCollision();assert.equal(s.events.length,count);
  }
});

test('Free Flight contact preserves both ships positions',()=>{
  const s=duel();s.freeFlight=true;const before=[{...s.player},{...s.enemy}];
  s.resolveShipCollision();assert(s.shipsTouching);
  for(const [i,ship] of [s.player,s.enemy].entries())for(const axis of ['x','y','z'])assert.equal(ship[axis],before[i][axis]);
});
