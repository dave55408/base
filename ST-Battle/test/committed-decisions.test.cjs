const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('../engine.js');
function duel(route){
  const s=new B.Simulation(97);s.running=true;
  Object.assign(s.player,{x:6000,y:0,z:0,heading:0,pitch:0,speed:60});
  Object.assign(s.enemy,{x:6000,y:0,z:-900,heading:0,pitch:0,speed:60});
  s.selectManeuver(route,0);
  for(let i=0;i<3;i++)assert(s.updateStep(i,{weapon:i===2?'torpedo':'phaser',target:'hull',range:1000,maneuvers:[0]}));
  assert(s.commitOrders());return s;
}
test('spending the last attack does not make Keep Your Distance turn away to a new range',()=>{
  const s=duel('distance');s.autoHelm(.05);
  assert.notEqual(s.turn.navigation.openingRange,true);assert.equal(s.turn.navigation.holdRange,1000);
  for(const order of s.turn.orders)order.status='hit';
  let aim;s.steerFlight=(ship,point)=>{aim=point;};
  s.autoHelm(.05);
  assert.notEqual(s.turn.navigation.openingRange,true);assert.equal(s.turn.navigation.holdRange,1000);
  assert.equal(aim,s.enemy,'finishing the salvo keeps the existing engagement course');
});

test('every attack leg steers directly toward Yorktown despite shield preferences and evasion requests',()=>{
  for(const route of ['direct','port','starboard','above','below','behind','hide']){
    const s=duel(route),n=s.turn.navigation;s.captainEnabled=true;
    n.stage='attack';if(route==='behind'){n.rearPhase='stern';n.rearAcquired=true;n.rearLostFor=0;}
    Object.assign(s.turn.orders[0],{target:'shield-port',attackArc:'port'});
    s.playerMind.evadeUntil=s.time+10;s.playerMind.evadeAim={x:7000,y:500,z:1000};
    let aim,immediate;
    s.steerFlight=(ship,point,dt,yaw,pitch,urgent,direct)=>{aim=point;immediate=direct;};
    s.autoHelm(.05);
    if(route==='direct'){assert(n.flyPast.strafe);assert(aim.z<s.enemy.z,'Direct Assault holds its strafing run through the target');}
    else assert.equal(aim,s.enemy,route);
    assert.equal(immediate,true,route);
    for(const order of s.turn.orders)order.status='hit';
    s.autoHelm(.05);
    if(route==='direct')assert(aim.z<s.enemy.z,'finishing shots does not interrupt the strafing pass');
    else assert.equal(aim,s.enemy,`${route} holds its attack course after firing`);
  }
});

test('a curved approach points at Yorktown on the same update that its attack leg begins',()=>{
  const s=duel('port');s.turn.navigation.elapsed=5;
  let aim;s.steerFlight=(ship,point)=>{aim=point;};s.autoHelm(.05);
  assert.equal(s.turn.navigation.stage,'attack');assert.equal(aim,s.enemy);
});

test('port and starboard open on the ordered side of Enterprise regardless of Yorktown bearing',()=>{
  for(const route of ['port','starboard'])for(const heading of [0,90,180,270])for(const enemyBearing of [0,90,180,270]){
    const s=duel(route),p=s.player,sign=route==='port'?-1:1;
    p.heading=heading;p.turnRate=0;p.yawAcceleration=0;p.sweepTurnSide=-sign;
    const a=enemyBearing*Math.PI/180;Object.assign(s.enemy,{x:p.x+Math.sin(a)*2500,y:0,z:p.z-Math.cos(a)*2500});
    s.initNavigation();const point=s.turn.navigation.waypoint;
    assert.equal(Math.sign(B.delta(p.heading,B.bearing(p,point))),sign,`${route}, heading ${heading}, target bearing ${enemyBearing}`);
    s.autoHelm(.05);assert.equal(Math.sign(p.turnRate),sign);
  }
});

test('Direct assault drops a previous sweeping turn and chooses the shortest direction to Yorktown',()=>{
  for(const side of [-1,1]){
    const s=duel('direct'),p=s.player;
    Object.assign(p,{heading:0,turnRate:0,yawAcceleration:0,sweepTurnSide:-side,steeringHeading:side>0?190:170});
    const heading=side*170*Math.PI/180;
    Object.assign(s.enemy,{x:p.x+Math.sin(heading)*1500,y:0,z:p.z-Math.cos(heading)*1500});
    s.autoHelm(.05);
    assert.equal(p.sweepTurnSide,0);assert.equal(Math.sign(p.turnRate),side,'the nearer side wins over the old sweep');
    assert.equal(p.flightTargetSpeed,B.MIN_IMPULSE_SPEED,'hold slow impulse while turning');
    assert.equal(p.speedIntent,'TURNING FOR ATTACK');
    p.heading=B.bearing(p,s.enemy);p.pitch=0;p.turnRate=0;p.yawAcceleration=0;
    s.autoHelm(.05);
    assert.equal(p.speedIntent,'ACCELERATING FOR ATTACK RUN');assert(p.flightTargetSpeed>150);
  }
});
test('shield-sector decisions ignore alternating suggestions but accept sustained, new-maneuver and urgent decisions',()=>{
  const s=new B.Simulation(97),mind={};
  assert.equal(s.committedAttackArc(mind,'fore','1:0'),'fore');
  for(let i=1;i<=12;i++){s.time=i*.6;assert.equal(s.committedAttackArc(mind,i%2?'port':'starboard','1:0'),'fore');}
  s.time=8;assert.equal(s.committedAttackArc(mind,'aft','1:0'),'fore');
  s.time=9.5;assert.equal(s.committedAttackArc(mind,'aft','1:0'),'aft');
  assert.equal(s.committedAttackArc(mind,'port','1:1'),'port','a new committed maneuver can choose a new approach');
  assert.equal(s.committedAttackArc(mind,'starboard','1:1',true),'starboard','a decisive firing opportunity can override the hold');
});
test('rear attacks keep their acquired attack leg across brief sector-boundary crossings',()=>{
  const s=duel('behind'),n=s.turn.navigation;n.rearPhase='stern';
  s.player.z=s.enemy.z+600;s.autoHelm(.05);assert.equal(n.stage,'attack');
  s.enemy.heading=90;
  for(let i=0;i<20;i++){s.autoHelm(.1);assert.equal(n.stage,'attack');}
  for(let i=0;i<12;i++)s.autoHelm(.1);
  assert.equal(n.stage,'position','a sustained loss of the stern position still triggers reacquisition');
});
