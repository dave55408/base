const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

test('both heavy hulls build speed slowly and carry speed into a braking order',()=>{
  const s=new B.Simulation();
  for(const ship of [s.player,s.enemy]){
    ship.speed=B.MIN_IMPULSE_SPEED;ship.flightAcceleration=0;
    for(let i=0;i<20;i++)s.easeFlightSpeed(ship,180,.05);
    assert(ship.speed>25&&ship.speed<40,'first second builds thrust gradually');
    ship.speed=150;ship.flightAcceleration=0;
    for(let i=0;i<20;i++)s.easeFlightSpeed(ship,15,.05);
    assert(ship.speed>130&&ship.speed<145,'braking retains most speed during the first second');
    ship.flightAcceleration=28;
    const before=ship.speed;s.easeFlightSpeed(ship,15,.1);
    assert(ship.speed>before,'a new order takes time to reverse existing thrust');
    for(let i=0;i<240;i++)s.easeFlightSpeed(ship,15,.05);
    assert(Math.abs(ship.speed-15)<.01,'sustained braking still reaches the ordered speed');
  }
});

test('automatic steering eases yaw, pitch and bank through abrupt command reversals',()=>{
  const s=new B.Simulation(),p=s.player,dt=.05;
  Object.assign(p,{x:2000,y:0,z:0,heading:0,pitch:0});
  for(let i=0;i<160;i++){
    const before={heading:p.heading,pitch:p.pitch,yaw:p.turnRate,pitchRate:p.pitchRate||0,bank:p.bank,yawAcceleration:p.yawAcceleration||0,pitchAcceleration:p.pitchAcceleration||0};
    s.steerFlight(p,{x:i<80?3000:1000,y:i<80?700:-700,z:-300},dt);
    assert(Math.abs(p.turnRate-before.yaw)<=42*.9*dt+1e-9);
    assert(Math.abs(p.pitchRate-before.pitchRate)<=30*.9*dt+1e-9);
    assert(Math.abs(p.yawAcceleration-before.yawAcceleration)<=42*3*dt+1e-9);
    assert(Math.abs(p.pitchAcceleration-before.pitchAcceleration)<=30*3*dt+1e-9);
    assert(Math.abs(B.delta(before.heading,p.heading))<=42*dt+1e-9);
    assert(Math.abs(p.pitch-before.pitch)<=30*dt+1e-9);
    assert(Math.abs(p.bank-before.bank)<.08);
  }
});

test('steering takes the short turn across north and settles without oscillation',()=>{
  const s=new B.Simulation(),p=s.player;Object.assign(p,{x:0,y:0,z:0,heading:359,pitch:0});
  const aim={x:Math.sin(Math.PI/180)*1000,y:0,z:-Math.cos(Math.PI/180)*1000};
  for(let i=0;i<160;i++)s.steerFlight(p,aim,.05);
  assert(Math.abs(B.delta(p.heading,1))<.001);assert(Math.abs(p.turnRate)<.01);assert(Math.abs(p.bank)<.001);
});

test('automatic speed changes limit acceleration and ease braking into a new command',()=>{
  const s=new B.Simulation(),p=s.player,dt=.05;
  for(let i=0;i<300;i++){
    const before=p.flightAcceleration||0,desired=i<100?180:15;
    s.easeFlightSpeed(p,desired,dt);
    assert(Math.abs(p.flightAcceleration-before)<=75*dt+1e-8);
    assert(p.speed>=B.MIN_IMPULSE_SPEED);assert(p.flightAcceleration<=45);assert(p.flightAcceleration>=-65);
  }
  assert(Math.abs(p.speed-15)<.01);
});

test('both ships commit to a sweeping turn when a target jitters across directly astern',()=>{
  for(const side of ['player','enemy']){
    const s=new B.Simulation(97),ship=s[side];Object.assign(ship,{x:6000,y:0,z:0,heading:0,pitch:0,speed:150});
    for(let i=0;i<240;i++){
      const h=(ship.heading+(i%2?176:-176))*Math.PI/180;
      s.steerFlight(ship,{x:ship.x+Math.sin(h)*1000,y:0,z:ship.z-Math.cos(h)*1000},.05);
      assert(ship.turnRate<=0,'rear target changes must not reverse the chosen turn');
      assert(Math.abs(ship.turnRate)<=42*.6+1e-8,'routine turns use a wider arc');
    }
    assert(ship.turnRate< -20,'ships continue the sweep instead of stalling');
  }
});

test('broad course changes settle without repeated reversals and avoidance can release a committed turn',()=>{
  for(const side of ['player','enemy']){
    const s=new B.Simulation(97),ship=s[side];Object.assign(ship,{x:6000,y:0,z:0,heading:0,pitch:0});
    let reverseFrames=0;
    for(let i=0;i<400;i++){s.steerFlight(ship,{x:7000,y:0,z:0},.05);if(ship.turnRate<-.3)reverseFrames++;}
    assert.equal(reverseFrames,0);assert(Math.abs(B.delta(ship.heading,90))<.01);
    ship.sweepTurnSide=1;ship.turnRate=20;
    for(let i=0;i<40;i++){
      const h=(ship.heading-170)*Math.PI/180;
      s.steerFlight(ship,{x:ship.x+Math.sin(h)*1000,y:0,z:ship.z-Math.cos(h)*1000},.05,42,30,true);
      assert.equal(ship.sweepTurnSide,0);
    }
    assert(ship.turnRate<0,'urgent avoidance can turn the other way');
  }
});
