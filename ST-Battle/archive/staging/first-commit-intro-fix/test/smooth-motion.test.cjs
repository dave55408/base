const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../engine.js');

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
