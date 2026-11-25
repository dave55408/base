const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(aspect=1.8){
  const c={window:{},console,AbortController};vm.createContext(c);
  for(const file of ['vendor/three.js','engine.js','assets/camera-shuttle-outline.js','scene.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  const T=c.window.AlpineThree,s=Object.create(c.window.BattleScene.prototype);
  Object.assign(s,{T,cinemaSpeedPercent:100,mode:'cinematic',zoom:1,orbit:{x:0,y:0},sim:{enemy:{hull:100}},camera:new T.PerspectiveCamera(46,aspect,.5,65000),ships:{Enterprise:new T.Group(),Yorktown:new T.Group()}});
  s.camera.position.set(0,45,235);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();
  s.ships.Yorktown.position.set(0,150,-1600);
  const frame=(dt=1/60,snap=false)=>{
    const position=new T.Vector3(),target=new T.Vector3();s.cinemaCamera(position,target,dt,snap);
    s.camera.position.copy(position);s.camera.lookAt(target);s.camera.updateMatrixWorld();s.frameEnterpriseLow(dt,snap);
  };
  return {s,T,frame};
}
test('Cinema shuttle has its own speed limit and falls behind faster capital ships',()=>{
  const {s,frame}=fixture(),dt=1/60;let previous=s.camera.position.clone();
  frame(0);s.cinemaTracking.nextRelocation=Infinity;
  for(let i=0;i<900;i++){
    for(const ship of Object.values(s.ships))ship.position.x+=250*dt;
    frame(dt);
    assert(s.camera.position.distanceTo(previous)<=220*dt+1e-7,'camera travel is bounded by shuttle speed');previous.copy(s.camera.position);
    assert(s.cinemaTracking.velocity.length()<=220+1e-8);
  }
  assert(s.cinemaTracking.velocity.length()>110,'the shuttle can exceed its former speed limit');
  assert(s.ships.Enterprise.position.x-s.camera.position.x>400,'the camera cannot translate with the faster ships');
});

test('Reckless follows Enterprise more closely while Cautious retains the established flight',()=>{
  const normal=fixture(),cautious=fixture(),reckless=fixture();
  cautious.s.cinemaFlightMode='cautious';reckless.s.cinemaFlightMode='reckless';
  for(let i=0;i<300;i++)for(const f of [normal,cautious,reckless])f.frame(.05);
  assert(normal.s.cinemaTracking.position.distanceTo(cautious.s.cinemaTracking.position)<1e-8);
  assert(reckless.s.cinemaTracking.position.distanceTo(reckless.s.ships.Enterprise.position)<cautious.s.cinemaTracking.position.distanceTo(cautious.s.ships.Enterprise.position)-200);
  const state=reckless.s.cinemaTracking,position=state.position.clone();reckless.s.cinemaFlightMode='cautious';reckless.frame(0,true);
  assert.equal(reckless.s.cinemaTracking,state);assert(state.position.distanceTo(position)<1e-8,'changing modes does not teleport the shuttle');
});

test('the Cinema shuttle speed setting applies to either flight mode, including zero',()=>{
  for(const mode of ['cautious','reckless']){
    const {s,frame}=fixture();s.cinemaFlightMode=mode;s.cinemaSpeedPercent=80/220*100;
    frame(0);s.cinemaTracking.nextRelocation=Infinity;
    for(let i=0;i<250;i++){
      for(const ship of Object.values(s.ships))ship.position.x+=10;
      const before=s.cinemaTracking.position.clone();frame(.05);
      assert(s.cinemaTracking.velocity.length()<=80+1e-8);assert(s.cinemaTracking.position.distanceTo(before)<=4+1e-8);
    }
    s.cinemaSpeedPercent=0;const before=s.cinemaTracking.position.clone(),speed=s.cinemaTracking.velocity.length();frame(.05);
    assert(s.cinemaTracking.velocity.length()>speed-1,'a stop request preserves momentum while braking');
    for(let i=0;i<250;i++)frame(.05);
    assert(s.cinemaTracking.velocity.length()<.05,'the shuttle settles to a stop');
    assert(s.cinemaTracking.position.distanceTo(before)>1);
  }
});

test('the light shuttle accelerates and brakes faster than a capital ship',()=>{
  const B=require('../engine.js'),big=new B.Simulation(),{s,frame}=fixture();
  s.sim.enemy.hull=0;s.ships.Enterprise.position.x=2000;s.cinemaSpeedPercent=187.5/220*100;
  for(let i=0;i<60;i++){frame(.05);big.easeFlightSpeed(big.player,187.5,.05);}
  assert(s.cinemaTracking.velocity.length()>big.player.speed+10,'the shuttle builds speed more quickly');
  s.cinemaTracking.velocity.set(100,0,0);s.cinemaTracking.flightAcceleration.set(0,0,0);s.cinemaSpeedPercent=0;
  big.player.speed=100;big.player.flightAcceleration=0;
  for(let i=0;i<40;i++){frame(.05);big.easeFlightSpeed(big.player,15,.05);}
  assert(s.cinemaTracking.velocity.length()<big.player.speed-10,'the shuttle sheds speed more quickly');
});

test('shuttle thrust changes gradually and retains momentum when the shot reverses',()=>{
  const {s,T,frame}=fixture();s.sim.enemy.hull=0;frame(0);s.cinemaTracking.nextRelocation=Infinity;
  let acceleration=new T.Vector3(),velocity=s.cinemaTracking.velocity.clone();
  for(let i=0;i<240;i++){
    s.ships.Enterprise.position.x=i<120?1600:-1600;frame(.05);
    const state=s.cinemaTracking;
    assert(state.flightAcceleration.distanceTo(acceleration)<=64*.05+1e-8,'thrust has a bounded rate of change');
    assert(state.velocity.distanceTo(velocity)<=42*.05+1e-8,'momentum cannot instantly change direction');
    acceleration.copy(state.flightAcceleration);velocity.copy(state.velocity);
  }
});

test('the shuttle top speed follows Enterprises available maximum and caps the speed setting',()=>{
  const {s,frame}=fixture();let mobility=1;
  s.sim.player={speed:100};s.sim.flightMobility=()=>mobility;s.cinemaSpeedPercent=100;
  frame(.05);assert.equal(s.cinemaTracking.maxSpeed,187.5);
  mobility=1.6;frame(.05);assert.equal(s.cinemaTracking.maxSpeed,300);
  s.cinemaSpeedPercent=50;frame(.05);assert.equal(s.cinemaTracking.maxSpeed,150);
  mobility=.45;frame(.05);assert.equal(s.cinemaTracking.maxSpeed,42.1875);
  s.cinemaSpeedPercent=100;mobility=1;frame(.05);assert.equal(s.cinemaTracking.maxSpeed,187.5);
});

test('Cinema confidently uses a tighter lens when both ships fit in a shared shot',()=>{
  const {s,frame}=fixture();s.cinemaFlightMode='reckless';s.ships.Enterprise.position.set(-50,0,0);s.ships.Yorktown.position.set(50,0,0);
  s.camera.position.set(0,80,900);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();frame(0);
  s.cinemaSpeedPercent=0;
  for(let i=0;i<240;i++)frame(.05);
  assert.equal(s.cinemaTracking.focus,'pair');assert(s.camera.zoom>3.85,'use the available close framing instead of leaving extra zoom headroom');
  for(const ship of Object.values(s.ships)){
    const p=ship.position.clone().project(s.camera);assert(Math.abs(p.x)<.9&&Math.abs(p.y)<.86&&Math.abs(p.z)<1,'both subjects remain comfortably inside the frame');
  }
});

test('both Cinema operators keep the sixfold shared zoom limit and complete ship envelopes in frame',()=>{
  for(const mode of ['cautious','reckless'])for(const aspect of [.8,1.8]){
    const {s,T,frame}=fixture(aspect);s.cinemaFlightMode=mode;s.cinemaSpeedPercent=0;
    s.ships.Enterprise.position.set(-30,0,0);s.ships.Yorktown.position.set(30,0,0);
    s.camera.position.set(0,0,2400);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();frame(0);
    for(let i=0;i<300;i++){
      const before=s.camera.zoom;frame(.05);
      assert(Math.abs(Math.log(s.camera.zoom/before))<.1,'higher magnification still eases smoothly');
    }
    assert(s.camera.zoom<=6.00001,'retain the two-ship zoom ceiling');if(mode==='cautious')assert(Math.abs(s.camera.zoom-2.5)<.05,'Cautious uses moderate zoom while holding its distance');else assert(s.camera.zoom>5.9);
    for(const ship of Object.values(s.ships))for(const x of [-65,65])for(const y of [-65,65])for(const z of [-65,65]){
      const corner=ship.position.clone().add(new T.Vector3(x,y,z)).project(s.camera);
      assert(Math.abs(corner.x)<1&&Math.abs(corner.y)<1&&Math.abs(corner.z)<1,'keep clearance around both ship envelopes');
    }
  }
});

test('Cinema moves closer for a vertically stacked pair while retaining both hull envelopes',()=>{
  for(const mode of ['cautious','reckless'])for(const aspect of [.8,1.8]){
    const vertical=fixture(aspect),horizontal=fixture(aspect);
    for(const [f,stacked] of [[vertical,true],[horizontal,false]]){
      const {s,frame}=f;s.cinemaFlightMode=mode;
      s.ships.Enterprise.position.set(stacked?0:-80,stacked?-80:0,0);
      s.ships.Yorktown.position.set(stacked?0:80,stacked?80:0,0);
      s.camera.position.set(0,30,1400);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();
      for(let i=0;i<900;i++)frame(.05);
    }
    const {s,T,frame}=vertical,center=s.cinemaSubject(s.ships.Enterprise).lerp(s.cinemaSubject(s.ships.Yorktown),.5);
    assert(s.cinemaTracking.stackedApproach>.95,'recognize the vertical composition');
    assert(horizontal.s.cinemaTracking.stackedApproach<.01,'leave side-by-side compositions on the established camera behavior');
    assert(s.camera.position.distanceTo(center)<(mode==='reckless'?700:900),`move in instead of holding the usual wide position (${mode}, ${aspect}: ${s.camera.position.distanceTo(center)})`);
    assert(s.camera.zoom<=6.00001,'retain the sixfold zoom ceiling');
    for(const ship of Object.values(s.ships))for(const x of [-65,65])for(const y of [-65,65])for(const z of [-65,65]){
      const corner=ship.position.clone().add(new T.Vector3(x,y,z)).project(s.camera);
      assert(Math.abs(corner.x)<1&&Math.abs(corner.y)<1&&Math.abs(corner.z)<1,'keep both full ship envelopes inside the frame');
    }
    const before=s.camera.position.clone(),weight=s.cinemaTracking.stackedApproach;frame(0);
    assert(s.camera.position.distanceTo(before)<1e-8);assert.equal(s.cinemaTracking.stackedApproach,weight);
  }
});

test('the operator smoothly tightens the shot as both ships move closer together',()=>{
  const {s,frame}=fixture();s.cinemaFlightMode='reckless';s.ships.Enterprise.position.set(-250,0,0);s.ships.Yorktown.position.set(250,0,0);
  s.camera.position.set(0,80,1300);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();frame(0);s.cinemaSpeedPercent=0;
  for(let i=0;i<200;i++)frame(.05);
  const wide=s.camera.zoom;s.ships.Enterprise.position.x=-40;s.ships.Yorktown.position.x=40;frame(.05);
  assert(Math.abs(s.camera.zoom-wide)<.15,'tightening starts smoothly');
  for(let i=0;i<200;i++)frame(.05);
  assert(s.camera.zoom>wide*1.5);assert(s.camera.zoom>5,'use a tighter lens when the two-ship composition permits it');
  for(const ship of Object.values(s.ships)){const p=ship.position.clone().project(s.camera);assert(Math.abs(p.x)<.9&&Math.abs(p.y)<.86);}
});

test('Cinema reacquires Enterprise when an enemy shot would leave her off the right edge',()=>{
  for(const mode of ['cautious','reckless']){
    const {s,frame}=fixture();s.cinemaFlightMode=mode;s.cinemaSpeedPercent=0;
    s.ships.Enterprise.position.set(800,0,0);s.ships.Yorktown.position.set(-800,0,0);
    s.camera.position.set(0,35,500);s.camera.lookAt(-800,0,0);s.camera.updateMatrixWorld();frame(0);
    s.cinemaTracking.focus='Yorktown';s.cinemaTracking.nextShot=Infinity;s.cinemaTracking.nextRelocation=Infinity;
    let visible=0;
    for(let i=0;i<300;i++){
      s.ships.Enterprise.position.x+=4;frame(.05);
      const point=s.cinemaSubject(s.ships.Enterprise).project(s.camera);
      if(i>40&&Math.abs(point.x)<.95&&Math.abs(point.y)<.95&&Math.abs(point.z)<1)visible++;
    }
    assert(visible>245,`keep Enterprise visible after reacquiring her (${mode}: ${visible})`);
    assert.notEqual(s.cinemaTracking.focus,'Yorktown','do not remain fixed on Yorktown as Enterprise exits');
    const position=s.camera.position.clone();frame(0);assert(s.camera.position.distanceTo(position)<1e-8,'the framing correction does not teleport the shuttle');
  }
});

test('Cinema widens faster than it tightens while the camera stays aboard a stopped shuttle',()=>{
  const changes=[];
  for(const widening of [true,false]){
    const {s,frame}=fixture();s.cinemaSpeedPercent=0;
    s.ships.Enterprise.position.set(-50,0,0);s.ships.Yorktown.position.set(50,0,0);
    s.camera.position.set(0,0,2000);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();frame(0);
    const state=s.cinemaTracking,start=state.position.clone();state.lensZoom=2;state.lensVelocity=0;
    s.zoom=widening?2.5:.625;
    for(let i=0;i<10;i++){
      frame(.05);
      assert(s.camera.position.distanceTo(start)<1e-8,'lens framing does not translate the shuttle');
      assert(s.camera.position.distanceTo(s.cinemaShuttlePose.position)<1e-8,'rendered camera and Tactical shuttle share one position');
    }
    changes.push(Math.abs(Math.log(state.lensZoom/2)));
  }
  assert(changes[0]>changes[1]*1.5,'open framing promptly and tighten more gradually');
});

test('Cinema uses optical zoom for a distant subject and respects manual zoom smoothly',()=>{
  for(const aspect of [.7,1.8,2.5]){
    const {s,frame}=fixture(aspect);s.cinemaFlightMode='reckless';s.cinemaSpeedPercent=0;s.sim.enemy.hull=0;
    for(let i=0;i<240;i++)frame(.05);
    for(let i=0;i<400;i++){s.ships.Enterprise.position.z-=7.5;frame(.05);}
    assert(s.camera.zoom>1.2,'a distant ship gets a tighter optical shot');assert(s.camera.zoom<=4);
    const before=s.camera.zoom;s.zoom=2;frame(.05);
    assert(s.camera.zoom<=before);assert(before-s.camera.zoom<=.125+1e-8,'lens changes do not jump');
    assert.equal(s.camera.projectionMatrix.elements[9],0,'Cinema does not pin Enterprise to the bottom edge');
  }
});

test('Cinema remains horizontal through ship rolls, climbs and heading reversals',()=>{
  const {s,T,frame}=fixture();
  for(let i=0;i<400;i++){
    s.ships.Enterprise.rotation.set(.7,Math.PI,1.3);s.ships.Yorktown.rotation.set(-.6,-Math.PI,-1.1);
    s.ships.Yorktown.position.y=700*Math.sin(i*.01);frame(.05);
    const right=new T.Vector3(1,0,0).applyQuaternion(s.camera.quaternion),forward=s.camera.getWorldDirection(new T.Vector3());
    assert(Math.abs(right.y)<1e-8,'the horizon has no bank');assert(Math.abs(forward.y)<=.50001,'ordinary shots avoid steep camera pitches');
    assert.equal(s.camera.up.y,1);
  }
});

test('Cinema flies to changing shots, limits movement after stalls, and freezes when paused',()=>{
  const {s,frame}=fixture(),start=s.camera.position.clone();
  for(let i=0;i<1500;i++)frame(1/60);
  assert(s.camera.position.distanceTo(start)>100,'the shuttle explores new viewing angles');assert(s.cinemaTracking.shot>=3);
  const before=s.camera.position.clone(),direction=s.camera.getWorldDirection(new s.T.Vector3());s.orbit.x=Math.PI;
  frame(3);assert(s.camera.position.distanceTo(before)<=22+1e-7);assert(direction.angleTo(s.camera.getWorldDirection(new s.T.Vector3()))<=Math.PI/60+1e-6);
  const position=s.camera.position.clone(),gaze=s.camera.quaternion.clone(),zoom=s.camera.zoom;
  s.ships.Enterprise.position.x+=3000;s.ships.Yorktown.position.x+=3000;frame(0,true);
  assert(s.camera.position.distanceTo(position)<1e-7,'even a warp does not teleport the camera shuttle');assert(gaze.angleTo(s.camera.quaternion)<1e-7);assert.equal(s.camera.zoom,zoom);
  s.setCamera('chase');assert.equal(s.cinemaTracking,null);
});

test('Cinema shuttle also operates in Free Flight without being overridden by the Chase camera',()=>{
  const {s,T,frame}=fixture();s.sim.freeFlight=true;frame(.05);
  const position=s.camera.position.clone(),target=new T.Vector3();
  assert.equal(s.trackFreeFlightCamera(position,target),false);assert.equal(s.trackGameplayCamera(position,.05),false);
});

test('Cinema keeps action visible during natural operator pans toward Enterprise',()=>{
  for(const moving of [false,true]){
    const {s,frame}=fixture();s.ships.Yorktown.position.set(0,100,-900);let visibleFrames=0,actionFrames=0;
    for(let i=0;i<600;i++){
      if(moving)for(const ship of Object.values(s.ships))ship.position.x+=5;
      frame(.05);
      const focus=s.cinemaTracking.focus,subjects=focus==='pair'?Object.values(s.ships):[s.ships[focus]];
      if(subjects.some(ship=>{const p=ship.position.clone().project(s.camera);return Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1;}))visibleFrames++;
      if(Object.values(s.ships).some(ship=>{const p=ship.position.clone().project(s.camera);return Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1;}))actionFrames++;
    }
    assert(visibleFrames>=570,'brief operator pans still acquire the intended subject promptly');
    assert(actionFrames>=590,'the previous subject remains in view during almost all of a reframing pan');
  }
});

test('each committed turn establishes both ships for five seconds with a lens that fits the shot',()=>{
  const {s,T,frame}=fixture();s.ships.Yorktown.position.set(0,100,-900);
  s.camera.position.set(600,200,600);s.camera.lookAt(new T.Vector3(0,50,-450));s.camera.zoom=3;
  s.sim.turn={number:1,phase:'attack'};
  for(let i=0;i<100;i++)frame(.05);
  assert(s.cinemaTracking.establishing);assert.equal(s.cinemaTracking.focus,'pair');assert(s.camera.zoom>0&&s.camera.zoom<=6);
  for(const ship of Object.values(s.ships)){const p=ship.position.clone().project(s.camera);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1);}
  for(let i=0;i<10;i++)frame(.05);assert.equal(s.cinemaTracking.establishing,false);
  s.sim.turn.number=2;frame(.05);assert(s.cinemaTracking.establishing);assert.equal(s.cinemaTracking.focus,'pair');
  const elapsed=s.cinemaTracking.elapsed,until=s.cinemaTracking.establishUntil;for(let i=0;i<100;i++)frame(0,true);
  assert.equal(s.cinemaTracking.elapsed,elapsed);assert.equal(s.cinemaTracking.establishUntil,until,'pausing cannot consume or repeatedly restart the opening');
});

test('Enterprise receives ST-Command motion lead, bounded lead room and a gradual recovery after stopping',()=>{
  const {s,frame}=fixture();s.sim.enemy.hull=0;frame(0);s.cinemaSpeedPercent=0;
  for(let i=0;i<300;i++){
    s.ships.Enterprise.position.x+=2;frame(.02);
    const operator=s.cinemaTracking.operator;
    assert(operator.lead.length()<=operator.leadLimit+1e-8);assert(operator.history.length<60);
  }
  const operator=s.cinemaTracking.operator,lead=operator.lead.length();
  assert(operator.lead.x>0,'the operator aims ahead of Enterprise moving to screen-right');
  assert(s.ships.Enterprise.position.clone().project(s.camera).x<0,'Enterprise has space ahead of its motion');
  const old=operator.lead.clone();frame(.02);assert(operator.lead.distanceTo(old)<lead*.3,'stopping does not snap the lead away');
  for(let i=0;i<200;i++)frame(.02);assert(operator.lead.length()<lead*.1);
});

test('ST-Command motion lead leaves room ahead in shared and single Cinema shots',()=>{
  for(const mode of ['cautious','reckless'])for(const paired of [false,true])for(const side of [-1,1]){
    const {s,frame}=fixture();s.cinemaFlightMode=mode;s.cinemaSpeedPercent=0;s.sim.enemy.hull=paired?100:0;
    s.ships.Enterprise.position.set(-80*side,0,0);s.ships.Yorktown.position.set(-400*side,0,-100);
    s.ships.Enterprise.rotation.y=-side*Math.PI/2;
    s.camera.position.set(0,45,1200);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();frame(0);s.cinemaTracking.nextRelocation=Infinity;
    for(let i=0;i<400;i++){for(const ship of Object.values(s.ships))ship.position.x+=side*2;frame(.02);}
    const operator=s.cinemaTracking.operator,point=s.cinemaSubject(s.ships.Enterprise).project(s.camera);
    assert(operator.lead.x*side>0,'the operator looks into the direction of apparent travel');
    const composition=paired?s.cinemaSubject(s.ships.Enterprise).lerp(s.cinemaSubject(s.ships.Yorktown),.5).project(s.camera):point;
    assert(composition.x*side<-.025,`leave clear space ahead of the moving composition (${mode}, ${paired}, ${side}: ${composition.x})`);
    for(const ship of paired?Object.values(s.ships):[s.ships.Enterprise]){const p=s.cinemaSubject(ship).project(s.camera);assert(Math.abs(p.x)<.95&&Math.abs(p.y)<.95,'keep the selected ships in view');}
    const lead=operator.lead.length();for(let i=0;i<250;i++)frame(.02);assert(operator.lead.length()<lead*.1,'lead eases away when the ship stops');
  }
});

test('Reckless chases a moving Enterprise from a close position behind her',()=>{
  for(const heading of [0,Math.PI/2]){
    const {s,T,frame}=fixture();s.cinemaFlightMode='reckless';s.sim.enemy.hull=0;s.ships.Enterprise.rotation.y=heading;
    const forward=new T.Vector3(0,0,-1).applyQuaternion(s.ships.Enterprise.quaternion),aft=forward.clone().negate();
    s.camera.position.copy(aft).multiplyScalar(235).add(new T.Vector3(0,45,0));s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();
    frame(0);s.cinemaTracking.nextRelocation=Infinity;
    for(let i=0;i<700;i++){s.ships.Enterprise.position.addScaledVector(forward,70*.05);const previous=s.cinemaTracking.position.clone();frame(.05);assert(s.cinemaTracking.position.distanceTo(previous)<=220*.05+1e-7);}
    const offset=s.cinemaTracking.position.clone().sub(s.cinemaSubject(s.ships.Enterprise));
    assert(offset.dot(aft)>150&&offset.dot(aft)<320,'stay just astern instead of ahead or far behind');assert(offset.length()<350);
    assert(Math.abs(s.cinemaTracking.velocity.length()-70)<3,'match Enterprise travel using independent shuttle velocity');
  }
});

test('Cinema follows the actual ship center as Enterprise rotates',()=>{
  const {s,T}=fixture(),ship=s.ships.Enterprise,model=new T.Group(),hull=new T.Mesh(new T.BoxGeometry(80,20,120),new T.MeshBasicMaterial());
  hull.position.set(12,5,-20);model.add(hull);ship.add(model);ship.userData.model=model;
  for(const angle of [0,.5,1]){ship.rotation.y=angle;ship.updateMatrixWorld(true);assert(s.cinemaSubject(ship).distanceTo(hull.getWorldPosition(new T.Vector3()))<1e-7);}
});

test('Cinema centers Enterprise during withdrawals instead of pairing or following Yorktown',()=>{
  for(const scenario of ['withdraw','disengage','flee','enemy-retreat','replay']){
    const {s,frame}=fixture();s.ships.Yorktown.position.set(700,100,-900);
    s.sim.turn={number:1,phase:scenario==='withdraw'||scenario==='disengage'?scenario:'attack',maneuver:scenario==='flee'?'flee':'direct'};
    if(scenario==='enemy-retreat')s.sim.enemyRetreating=true;
    if(scenario==='replay')s.sim.replayShot={kind:'withdrawal'};
    for(let i=0;i<300;i++){frame(.05);assert.equal(s.cinemaTracking.focus,'Enterprise',scenario);}
    assert.equal(s.cinemaTracking.establishing,false);assert.equal(s.cinemaTracking.operator.focus,'Enterprise');
    const p=s.ships.Enterprise.position.clone().project(s.camera);
    assert(Math.abs(p.x)<.05&&Math.abs(p.y)<.05,'the retreat shot settles on Enterprise at frame center');
  }
});

test('Cinema holds both fighting ships in a shared composition across shot changes',()=>{
  for(const aspect of [.7,1.8,2.5]){
    const {s,T,frame}=fixture(aspect);s.ships.Yorktown.position.set(0,100,-900);
    s.camera.position.set(700,200,700);s.camera.lookAt(new T.Vector3(0,50,-450));
    for(let i=0;i<700;i++){
      for(const ship of Object.values(s.ships))ship.position.x+=1;
      frame(.05);
      if(i<100)continue;
      assert.equal(s.cinemaTracking.focus,'pair',`scheduled shots retain the two-ship fight (${aspect}, frame ${i}, eye ${s.camera.position.toArray()})`);
      for(const ship of Object.values(s.ships)){
        const p=ship.position.clone().project(s.camera);
        assert(Math.abs(p.x)<.94&&Math.abs(p.y)<.94&&Math.abs(p.z)<1,'both ships have room inside the frame');
      }
    }
  }
});

test('Cinema eases pan direction reversals and lens reversals without a velocity jump',()=>{
  const {s,T,frame}=fixture();s.sim.enemy.hull=0;frame(.02);s.cinemaSpeedPercent=0;
  let pan=s.cinemaTracking.panRate,lens=s.cinemaTracking.lensVelocity;
  for(let i=0;i<600;i++){
    s.ships.Enterprise.position.set(i<300?250:-250,0,-900);
    s.zoom=i<300?.5:3;frame(.02);
    const state=s.cinemaTracking;
    assert(Math.abs(state.panRate-pan)<=65*Math.PI/180*.02+1e-8,'pan acceleration stays bounded through a new bearing');
    assert(Math.abs(state.lensVelocity-lens)<.3,'lens speed eases through a new framing request');
    pan=state.panRate;lens=state.lensVelocity;
  }
});

test('Cinema pans around after ships pass directly behind the shuttle, including an exact reversal',()=>{
  for(const paired of [false,true]){
    const {s,T,frame}=fixture();s.sim.enemy.hull=paired?100:0;frame(.02);
    const state=s.cinemaTracking;s.cinemaSpeedPercent=0;state.velocity.set(0,0,0);state.position.set(0,0,0);
    state.gaze.set(0,0,-1);state.panRotation=null;state.panRate=0;state.operator=null;
    s.ships.Enterprise.position.set(0,0,600);s.ships.Yorktown.position.set(0,0,900);
    state.framingCenter=new T.Vector3(0,0,paired?750:600);
    const position=state.position.clone();frame(.02);
    assert(state.gaze.z<-.99,'the reverse view starts with a gradual pan');
    const paused=state.gaze.clone(),rate=state.panRate;frame(0,true);
    assert(state.gaze.distanceTo(paused)<1e-9);assert.equal(state.panRate,rate);
    for(let i=0;i<400;i++){
      const before=state.gaze.clone();frame(.02);
      assert(before.angleTo(state.gaze)<=55*Math.PI/180*.02+1e-7,'reverse pan respects ST-Commands speed limit');
      assert(state.position.distanceTo(position)<1e-9,'panning does not relocate the shuttle');
    }
    assert(state.gaze.z>.99,'the operator acquires ships directly behind the shuttle');
    assert.equal(state.relocation,undefined);
  }
});

test('distant Cinema action triggers a short fade with relocation hidden at full black',()=>{
  const {s,frame}=fixture();frame(.05);
  s.ships.Enterprise.position.x+=8000;s.ships.Yorktown.position.x+=8000;
  const original=s.camera.position.clone();frame(0,true);assert(s.camera.position.distanceTo(original)<1e-8,'a paused warp cannot teleport the shuttle');
  let moved=false,partial=false;
  for(let i=0;i<35;i++){
    const previous=s.camera.position.clone();frame(.05);
    if(s.cinemaTracking.fadeOpacity>0&&s.cinemaTracking.fadeOpacity<1)partial=true;
    if(s.camera.position.distanceTo(previous)>220*.05+1e-7){assert.equal(s.cinemaTracking.fadeOpacity,1);moved=true;}
  }
  assert(partial&&moved);assert.equal(s.cinemaTracking.fadeOpacity,0);
  assert(s.camera.position.distanceTo(s.ships.Enterprise.position)<2200,'the shuttle resets close to the ships');
  const right=new s.T.Vector3(1,0,0).applyQuaternion(s.camera.quaternion);assert(Math.abs(right.y)<1e-8);
});

test('Cinema relocation freezes on pause, avoids blocked viewpoints and renders its fade into the canvas',()=>{
  const {s,T,frame}=fixture();frame(.05);s.ships.Enterprise.position.x+=8000;s.ships.Yorktown.position.x+=8000;
  s.sim.stationTrace=from=>from.x>8500&&Math.abs(from.z+800)<250?{}:null;
  for(let i=0;i<50&&!s.cinemaTracking.fadeOpacity;i++)frame(.05);
  const position=s.camera.position.clone(),opacity=s.cinemaTracking.fadeOpacity;
  for(let i=0;i<50;i++)frame(0,true);
  assert.equal(s.cinemaTracking.fadeOpacity,opacity);assert(s.camera.position.distanceTo(position)<1e-8);
  let renders=0;s.renderer={autoClear:true,render(scene,camera){renders++;assert.equal(this.autoClear,false);assert(camera instanceof T.OrthographicCamera);}};
  s.renderCinemaFade();assert.equal(renders,1);assert.equal(s.renderer.autoClear,true);assert.equal(s.cinemaFade.material.opacity,opacity);
  for(let i=0;i<40;i++)frame(.05);
  assert(s.camera.position.x>8000&&s.camera.position.distanceTo(s.ships.Enterprise.position)<2200,'a blocked angle is replaced by a clear viewpoint on the same side');
  s.setCamera('chase');s.renderCinemaFade();assert.equal(renders,1,'leaving Cinema removes the fade');
});

test('Cinema flies on the established side as the action line turns and ships cross',()=>{
  const {s,T,frame}=fixture();s.camera.position.set(900,180,-450);s.camera.lookAt(0,50,-450);
  let screenOrder;
  for(let i=0;i<1800;i++){
    const a=i*.0008,along=new T.Vector3(Math.sin(a),0,-Math.cos(a));
    s.ships.Enterprise.position.copy(along).multiplyScalar(-450).add(new T.Vector3(0,0,-450));
    s.ships.Yorktown.position.copy(along).multiplyScalar(450).add(new T.Vector3(0,100,-450));
    s.orbit.x=i>900?Math.PI*2:0;frame(.05);
    const midpoint=s.ships.Enterprise.position.clone().lerp(s.ships.Yorktown.position,.5);
    assert(s.camera.position.clone().sub(midpoint).dot(s.cinemaTracking.actionSide)>0,'the shuttle retains its established side');
    if(i>100){const sign=Math.sign(s.ships.Enterprise.position.clone().project(s.camera).x-s.ships.Yorktown.position.clone().project(s.camera).x);screenOrder??=sign;assert.equal(sign,screenOrder,'camera motion does not reverse the ships on screen');}
  }
  const side=s.cinemaTracking.actionSide.clone(),a=s.ships.Enterprise.position.clone(),b=s.ships.Yorktown.position.clone();
  for(let i=0;i<=100;i++){s.ships.Enterprise.position.copy(a).lerp(b,i/100);s.ships.Yorktown.position.copy(b).lerp(a,i/100);frame(.05);assert(s.cinemaTracking.actionSide.dot(side)>.99,'ships crossing do not flip the viewing hemisphere');}
});

test('Cinema flies toward Enterprises preferred rear quarter as it turns and uses that POV after a fade reset',()=>{
  const {s,frame}=fixture();s.sim.enemy.hull=0;
  for(let i=0;i<200;i++)frame(.05);
  assert(s.camera.position.x>80&&s.camera.position.z>80,'the shuttle seeks an elevated rear-quarter view');
  s.ships.Enterprise.rotation.y=Math.PI;
  let previous=s.camera.position.clone();
  for(let i=0;i<200;i++){
    frame(.05);assert(s.camera.position.distanceTo(previous)<=220*.05+1e-7,'following the preferred POV remains a physical shuttle flight');previous.copy(s.camera.position);
    assert(s.camera.position.x>0,'the approach stays on the established viewing side');
  }
  assert(s.camera.position.z<-60,'the shuttle follows the stern to Enterprises new heading');
  s.ships.Enterprise.position.x+=8000;
  for(let i=0;i<40;i++)frame(.05);
  const offset=s.camera.position.clone().sub(s.ships.Enterprise.position);
  assert(offset.x>0&&offset.z<0&&offset.length()<1000,'fade resets also acquire the preferred rear-quarter POV');
  assert.equal(s.cinemaTracking.fadeOpacity,0);
});
test('Keep Your Distance holds Enterprise as the Cinema subject, including opening and relocation',()=>{
  const {s,frame}=fixture();
  s.sim.turn={phase:'approach',number:1,maneuver:'distance'};
  s.ships.Yorktown.position.set(300,0,-500);
  for(let i=0;i<100;i++)frame(.05);
  assert.equal(s.cinemaTracking.focus,'Enterprise');
  assert.equal(s.cinemaTracking.establishing,false);
  const enterprise=s.cinemaSubject(s.ships.Enterprise).project(s.camera);
  assert(Math.abs(enterprise.x)<.5&&Math.abs(enterprise.y)<.5,'track Enterprise with room for the operator motion lead');
  s.cinemaTracking.position.set(5000,0,0);
  for(let i=0;i<20;i++)frame(.05);
  assert.equal(s.cinemaTracking.focus,'Enterprise');
  assert(s.cinemaTracking.position.distanceTo(s.cinemaSubject(s.ships.Enterprise))>200,'camera stays outside the hull');
});

test('Tactical retains the Cinema shuttle pose and draws a dashed outline only in Tactical',()=>{
  const {s,T,frame}=fixture();s.scene=new T.Scene();s.updateStationDetail=()=>{};
  frame(.05);const pose=s.cinemaShuttlePose.position.clone();
  s.setCamera('tactical');s.updateTacticalShuttle();
  assert(s.tacticalShuttle.visible);
  assert(s.tacticalShuttle.position.distanceTo(pose)<1e-7);
  const vertices=s.tacticalShuttle.geometry.attributes.position;
  assert(vertices.count>12,'outline consists of separate short dashes');
  for(let i=0;i<vertices.count;i+=2){
    const a=new T.Vector3().fromBufferAttribute(vertices,i),b=new T.Vector3().fromBufferAttribute(vertices,i+1);
    assert(a.distanceTo(b)<=10.00001);
  }
  s.setCamera('chase');s.updateTacticalShuttle();assert(!s.tacticalShuttle.visible);
  assert(s.cinemaShuttlePose.position.distanceTo(pose)<1e-7);
});

test('the Tactical viewing arc follows the shuttle lens and remains subtle',()=>{
  const {s,T,frame}=fixture();s.scene=new T.Scene();s.updateStationDetail=()=>{};frame(0);
  const wide=s.cinemaShuttlePose.horizontalFov;s.cinemaTracking.lensZoom=3;frame(0);
  assert(s.cinemaShuttlePose.horizontalFov<wide,'optical zoom narrows the indicated view');
  s.setCamera('tactical');s.updateTacticalShuttle(0);
  const fov=s.tacticalShuttle.userData.fov,edge=fov.arc.geometry.attributes.position;
  assert(fov.fan.material.opacity<=.1);assert(fov.arc.material.opacity<=.35);
  assert.equal(fov.fan.visible,false,'full Tactical leaves the viewing cone unshaded');
  const before=Math.abs(edge.getX(0));s.cinemaTracking.lensZoom=4;s.updateTacticalShuttle(0);
  assert(Math.abs(edge.getX(0))<before,'the Tactical arc updates with a changed lens');
  assert(fov.radius>210,'the viewing line extends beyond the longer arc radius');
  const radius=fov.radius,center=s.ships.Enterprise.position.clone().lerp(s.ships.Yorktown.position,.5);
  assert(radius>Math.hypot(s.cinemaShuttlePose.position.x-center.x,s.cinemaShuttlePose.position.z-center.z)+1250*Math.hypot(1,s.camera.aspect),'the cone covers the entire tactical overview');
  s.zoom=3;s.updateTacticalShuttle(0);assert(fov.radius>radius*1.5,'extend the cone when Tactical zooms out');
  s.zoom=.5;s.updateTacticalShuttle(0);assert(fov.radius<radius,'reduce its reach when Tactical zooms back in');
});

test('Tactical shows the live Cinema flight while its own camera controls stay independent',()=>{
  const cinema=fixture(),tactical=fixture(),{s,T}=tactical;
  for(const f of [cinema,tactical]){f.s.scene=new f.T.Scene();f.s.updateStationDetail=()=>{};f.frame(.05);}
  const tracking=s.cinemaTracking,start=tracking.position.clone();
  s.setCamera('tactical');assert.equal(s.cinemaTracking,tracking);
  s.camera.position.set(300,12000,700);s.camera.lookAt(0,0,0);s.camera.zoom=4;
  s.orbit={x:2,y:.8};s.zoom=2;
  const eye=s.camera.position.clone(),rotation=s.camera.quaternion.clone();
  for(let i=0;i<200;i++){
    for(const f of [cinema,tactical])for(const ship of Object.values(f.s.ships))ship.position.x+=5;
    cinema.frame(.05);s.updateTacticalShuttle(.05);
    assert(s.tacticalShuttle.position.distanceTo(cinema.s.cinemaShuttlePose.position)<1e-7,'the outline follows the same flight as Cinema');
    assert(s.cinemaShuttlePose.gaze.distanceTo(cinema.s.cinemaShuttlePose.gaze)<1e-7);
  }
  assert(s.tacticalShuttle.position.distanceTo(start)>100,'the shuttle moves live in Tactical');
  assert(s.camera.position.distanceTo(eye)<1e-9);assert(rotation.angleTo(s.camera.quaternion)<1e-7);assert.equal(s.camera.zoom,4);
  assert.equal(s.zoom,2);assert.equal(s.orbit.x,2);
  const stopped=s.tacticalShuttle.position.clone();s.updateTacticalShuttle(0,true);
  assert(s.tacticalShuttle.position.distanceTo(stopped)<1e-9,'pause freezes the shuttle');
  s.setCamera('cinematic');assert.equal(s.cinemaTracking,tracking);assert.equal(s.zoom,1);assert.equal(s.orbit.x,0);
  tactical.frame(.05);cinema.frame(.05);
  assert(s.camera.position.distanceTo(cinema.s.camera.position)<1e-7,'returning to Cinema resumes the live shuttle');
});

test('entering Tactical before Cinema seeds the flight before the overview camera moves',()=>{
  const {s,T}=fixture();s.scene=new T.Scene();s.updateStationDetail=()=>{};
  const seed=s.camera.position.clone();s.setCamera('tactical');s.camera.position.set(0,12000,0);s.camera.zoom=4;
  s.updateTacticalShuttle(.05);
  assert(s.tacticalShuttle.position.distanceTo(seed)<1,'the shuttle starts at its saved flight position');
  assert.equal(s.cinemaTracking.lensZoom<2,true,'the Tactical lens does not seed the Cinema lens');
});
