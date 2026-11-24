const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

function duel(){
  const s=new B.Simulation(97);
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0,bank:0,speed:0});
  Object.assign(s.enemy,{x:6000,y:0,z:-120,heading:180,pitch:0,bank:0,speed:0});
  s.events=[];return s;
}

test('opposing saucers block Enterprise while preserving Yorktown movement',()=>{
  const approach=duel();approach.enemy.z=-135;assert.equal(B.shipContact(approach.player,approach.enemy),null,'inset volumes allow the visible hulls to get closer');
  const s=duel();assert(s.range>100);assert.deepEqual(B.shipContact(s.player,s.enemy).parts,['saucer','saucer']);
  const hull=[s.player.hull,s.enemy.hull],before=[{...s.player},{...s.enemy}];s.resolveShipCollision();
  assert.equal(B.shipContact(s.player,s.enemy),null);assert.equal(s.shipsTouching,true);
  for(const key of ['x','y','z','speed','heading','pitch','bank'])assert.equal(s.enemy[key],before[1][key]);
  for(const key of ['speed','heading','pitch','bank'])assert.equal(s.player[key],before[0][key]);
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

test('approaching through the contact margin still emits the first collision sound cue',()=>{
  for(const freeFlight of [true,false]){
    const s=duel();s.freeFlight=freeFlight;Object.assign(s.enemy,{x:6066,y:0,z:0,heading:0});
    assert.equal(B.shipContact(s.player,s.enemy),null);assert(B.shipContact(s.player,s.enemy,3));
    s.resolveShipCollision();assert.equal(s.shipsTouching,false);assert.equal(s.events.length,0);
    s.enemy.x=6063;s.resolveShipCollision();
    assert.equal(s.events.filter(e=>e.type==='ship-collision').length,1,'first real contact emits the audio event');
    assert.equal(B.shipContact(s.player,s.enemy),null,'the contact barrier still clears Enterprise');
    s.resolveShipCollision();assert.equal(s.events.filter(e=>e.type==='ship-collision').length,1,'ongoing contact does not repeat the sound');
    s.enemy.x=s.player.x+400;s.resolveShipCollision();assert.equal(s.shipsTouching,false);
    Object.assign(s.enemy,{x:s.player.x+50,y:s.player.y,z:s.player.z});s.resolveShipCollision();
    assert.equal(s.events.filter(e=>e.type==='ship-collision').length,2,'a separate impact gets another sound');
  }
});

test('warp nacelles participate in contact and detached engines leave a real gap',()=>{
  const s=duel();Object.assign(s.enemy,{x:6052,z:60,heading:0});
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
  for(const axis of ['x','y','z'])assert.equal(s.enemy[axis],end[1][axis]);
  assert.notDeepEqual([s.player.x,s.player.y,s.player.z],[end[0].x,end[0].y,end[0].z]);
});

test('contacts at varied attitudes clear Enterprise and preserve Yorktown without repeated cues',()=>{
  for(let i=0;i<150;i++){
    const s=duel();
    Object.assign(s.player,{heading:i*137%360,pitch:i*37%150-75,bank:Math.sin(i)*.7});
    Object.assign(s.enemy,{x:6000+Math.sin(i*17)*80,y:Math.sin(i*3)*40,z:Math.cos(i*11)*90,heading:i*71%360,pitch:i*11%150-75,bank:Math.cos(i)*.7});
    const before=[{...s.player},{...s.enemy}];s.resolveShipCollision();
    assert.equal(B.shipContact(s.player,s.enemy),null);
    for(const axis of ['x','y','z'])assert.equal(s.enemy[axis],before[1][axis]);
    for(const ship of [s.player,s.enemy])assert(Number.isFinite(ship.x+ship.y+ship.z));
    const count=s.events.length;s.resolveShipCollision();assert.equal(s.events.length,count);
  }
});

test('Free Flight and combat clear Enterprise without moving Yorktown',()=>{
  for(const freeFlight of [true,false]){
    const s=duel();s.freeFlight=freeFlight;const before={...s.enemy};
    s.resolveShipCollision();assert(s.shipsTouching);assert.equal(B.shipContact(s.player,s.enemy),null);
    for(const axis of ['x','y','z'])assert.equal(s.enemy[axis],before[axis]);
  }
});
