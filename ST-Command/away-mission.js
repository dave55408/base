/* Local flight uses kilometres; the bridge continues to use light years. */
window.createAwayMission = ({state:s,systems,keys,say,telemetry}) => {
  const $=id=>document.getElementById(id),rad=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrap=v=>(v%360+360)%360,angle=(a,b)=>(b-a+540)%360-180;
  const m={phase:'bridge',planet:null,x:0,y:0,z:110,recovered:false,target:'beacon',clock:0,completed:false,roll:0,turnBank:0,pitchBob:0,lastVisualPitch:null,bank:0,garageDoorTarget:0,garageDoorOpen:0};
  const terrain=PlanetSurface.height;
  const beacon={x:8,y:-12,z:terrain(8,-12)+.12};
  const ship={x:0,y:0,z:110};
  const active=()=>!['bridge','orbit'].includes(m.phase);
  const target=()=>m.target==='beacon'?beacon:ship;
  const range=()=>Math.hypot(target().x-m.x,target().y-m.y,target().z-m.z);
  const automaticBayOpen=()=>{
    const distance=Math.hypot(m.x,m.y,m.z-110);
    if(m.phase==='flight'&&distance>4)return false;
    return m.phase==='docking'||m.phase==='flight'&&(distance<3||m.clock<6)||m.phase==='landed'&&m.clock<6;
  };
  function toggleHangarDoor(){
    if(!['flight','landed'].includes(m.phase))return;
    m.hangarDoorTarget=(m.hangarDoorTarget??Number(automaticBayOpen()))?0:1;
    m.bayDoorOpen??=Number(automaticBayOpen());
    say(m.hangarDoorTarget?'Opening hangar door.':'Closing hangar door.');telemetry();
  }
  function toggleGarageDoor(){
    if(!['flight','landed'].includes(m.phase)||!m.freeSpace&&!m.recovered)return;
    m.garageDoorTarget=m.garageDoorTarget?0:1;
    say(m.garageDoorTarget?'Opening storage garage. Four Type F shuttles on two platform levels.':'Closing storage garage.');telemetry();
  }
  const bearing=()=>wrap(Math.atan2(target().x-m.x,m.y-target().y)/rad);
  const elevation=()=>Math.atan2(target().z-m.z,Math.hypot(target().x-m.x,target().y-m.y))/rad;
  const agl=()=>m.z-terrain(m.x,m.y);
  function destinations(local){
    $('destination').replaceChildren();
    const galaxyTargets=systems.some(p=>p.id===s.target.id)?systems:[...systems,s.target];
    for(const p of local?(m.freeSpace?[{id:'ship',name:'Enterprise · aft shuttle bay'}]:[{id:'beacon',name:'Abandoned beacon'},{id:'ship',name:'Enterprise · aft shuttle bay'}]):galaxyTargets){const o=document.createElement('option');o.value=p.id;if(p.id==='waypoint')o.id='waypoint-option';o.textContent=p.name;$('destination').append(o);}
    $('destination').value=local?m.target:s.target.id;
  }
  function orbit(planet){m.phase='orbit';m.planet=planet;m.clock=0;m.orbitArrival=OrbitArrival.start();s.target=planet;$('destination').value=planet.id;s.autopilot=false;s.arrived=true;s.throttle=0;s.speed=0;s.pitch=0;s.drive='impulse';say(`Entering standard orbit around ${planet.name}.`);}
  function leaveOrbit(){
    if(m.phase!=='orbit')return;
    m.orbitArrival=null;m.departedPlanet=m.planet;m.phase='bridge';
    s.autopilot=false;s.arrived=false;s.throttle=2;s.speed=0;
    say(`Left orbit around ${m.planet.name}. Engines at 2%. Galaxy navigation ready; select a destination or use the helm.`);
    telemetry();
  }
  function launch(){
    if(m.phase!=='orbit')return;
    m.garageDoorTarget=0;m.garageDoorOpen=0;
    m.orbitArrival=null;
    m.targetSquareHidden=false;m.cockpitFromBerth=false;m.hangarDoorTarget=null;m.bayDoorOpen=1;m.cameraView='cockpit';m.departureRamp=false;m.roll=0;m.turnBank=0;m.pitchBob=0;m.lastVisualPitch=null;
    Object.assign(m,{phase:'flight',freeSpace:false,x:0,y:2,z:110,recovered:false,target:'beacon',clock:0,completed:false,approach:false,beaconApproach:false,returnLeg:0,bank:0,lookYaw:0,lookPitch:0,cameraZoom:1});
    s.paused=false;s.heading=bearing();s.pitch=-65;s.throttle=35;s.drive='impulse';s.autopilot=false;s.arrived=false;
    destinations(true);document.body.classList.add('shuttle-mode');
    say('Landing craft launched. Plot the abandoned beacon or descend manually. Same helm controls; distances now in km.');telemetry();
  }
  const canLaunchShuttle=()=>m.phase==='bridge'&&Math.abs(s.throttle)<15;
  function carrierVector(v,carrier,inverse=false){
    const h=(carrier?.heading||0)*rad,p=(carrier?.pitch||0)*rad,ch=Math.cos(h),sh=Math.sin(h),cp=Math.cos(p),sp=Math.sin(p);
    const r=carrier?.roll||0,cr=Math.cos(r),sr=Math.sin(r);
    if(inverse){const x=ch*v.x+sh*v.y,y=-sh*cp*v.x+ch*cp*v.y-sp*v.z,z=-sh*sp*v.x+ch*sp*v.y+cp*v.z;return {x:cr*x-sr*z,y,z:sr*x+cr*z};}
    const x=cr*v.x+sr*v.z,z=-sr*v.x+cr*v.z;
    return {x:ch*x-sh*cp*v.y-sh*sp*z,y:sh*x+ch*cp*v.y+ch*sp*z,z:-sp*v.y+cp*z};
  }
  function stopEnterprise(){
    if(!m.freeSpace||!active()||!m.carrier||!m.bridgeState)return;
    Object.assign(m.carrier,{manual:true,moving:false,speed:0,returningNeutral:false});
    Object.assign(m.bridgeState,{throttle:0,speed:0,turn:0,pitchTurn:0,autopilot:false});
    for(const key of keys)if(key.startsWith('Numpad'))keys.delete(key);
    say('Enterprise all stop. Shuttle controls remain active.');telemetry();
  }
  function neutralEnterprise(){
    if(!m.freeSpace||!active()||!m.carrier)return;
    Object.assign(m.carrier,{manual:true,returningNeutral:true});
    for(const key of keys)if(key.startsWith('Numpad'))keys.delete(key);
    say('Enterprise returning smoothly to neutral yaw, pitch and roll.');telemetry();
  }
  function advanceCarrier(dt){
    const carrier=m.carrier,b=m.bridgeState;if(!m.freeSpace||!carrier||!b)return;
    if(m.launchAttached&&ShuttleBayFlight.clearedEntrance(m,s))m.launchAttached=false;
    const yaw=(keys.has('Numpad3')?1:0)-(keys.has('Numpad1')?1:0),tilt=(keys.has('Numpad2')?1:0)-(keys.has('Numpad5')?1:0);
    const power=(keys.has('Numpad7')?1:0)-(keys.has('Numpad4')?1:0),roll=(keys.has('NumpadDecimal')?1:0)-(keys.has('Numpad0')?1:0);
    if(yaw||tilt||power||roll)carrier.manual=true;
    if(yaw||tilt||roll)carrier.returningNeutral=false;
    if(!carrier.manual&&!carrier.moving)return;
    const point=carrierVector({x:m.x,y:m.y,z:m.z-110},carrier),direction=carrierVector(SpaceMath.direction(s.heading,s.pitch),carrier);
    const h=s.heading*rad,p=s.pitch*rad,bank=m.bank||0;
    const worldUp=carrierVector({x:-Math.sin(h)*Math.sin(p)*Math.cos(bank)+Math.cos(h)*Math.sin(bank),y:Math.cos(h)*Math.sin(p)*Math.cos(bank)+Math.sin(h)*Math.sin(bank),z:Math.cos(p)*Math.cos(bank)},carrier);
    const wx=carrier.x+point.x,wy=carrier.y+point.y,wz=carrier.z+point.z;
    const neutralStep=(delta,rate)=>Math.abs(delta)<.02?delta:Math.sign(delta)*Math.min(Math.abs(delta),rate*dt,Math.abs(delta)*(1-Math.exp(-dt*.7)));
    const dive=carrier.returningNeutral?neutralStep(-carrier.pitch,6):carrier.manual?clamp(carrier.pitch+tilt*6*dt,-85,85)-carrier.pitch:Math.max(-3,carrier.pitch-.05*dt)-carrier.pitch;
    if(carrier.manual){b.throttle=clamp(b.throttle+power*15*dt,-100,100);carrier.speed=SpaceMath.poweredSpeed(carrier.speed,b.throttle,.8,dt);b.speed=SpaceMath.poweredSpeed(b.speed,b.throttle,b.drive==='warp'?112:8,dt);}
    // Hold bank after releasing the helm; only a correction or neutral return
    // changes it. Manual roll remains independent of the turn bank.
    if(carrier.returningNeutral){
      carrier.manualRoll=(carrier.roll/rad+neutralStep(-carrier.roll/rad,18))*rad;carrier.turnBank=0;
    }else{
      const manualRoll=(carrier.manualRoll??((carrier.roll||0)-(carrier.turnBank||0)))+roll*18*rad*dt;
      carrier.manualRoll=Math.atan2(Math.sin(manualRoll),Math.cos(manualRoll));
      if(yaw){
        const nextBank=(carrier.turnBank||0)+yaw*10*rad*dt;
        carrier.turnBank=Math.atan2(Math.sin(nextBank),Math.cos(nextBank));
      }else if(!carrier.manual){
        const bankTarget=-.5*rad;
        carrier.turnBank=(carrier.turnBank||0)+(bankTarget-(carrier.turnBank||0))*(1-Math.exp(-dt*.4));
      }
    }
    const bankedRoll=carrier.manualRoll+carrier.turnBank;
    carrier.roll=Math.atan2(Math.sin(bankedRoll),Math.cos(bankedRoll));
    // A held bank keeps steering the ship after the yaw key is released.
    // Sine keeps the rate bounded through knife-edge and inverted attitudes.
    const turn=carrier.returningNeutral?neutralStep(angle(carrier.heading,0),8):(carrier.manual?yaw*8+Math.sin(carrier.roll)*8:-.2)*dt;
    carrier.moving=Math.abs(carrier.speed)>.000001;
    const mid=(carrier.heading+turn/2)*rad,midPitch=(carrier.pitch+dive/2)*rad;
    carrier.x+=Math.sin(mid)*Math.cos(midPitch)*carrier.speed*dt;carrier.y-=Math.cos(mid)*Math.cos(midPitch)*carrier.speed*dt;carrier.z+=Math.sin(midPitch)*carrier.speed*dt;
    carrier.heading=wrap(carrier.heading+turn);carrier.pitch+=dive;
    if(carrier.returningNeutral&&Math.abs(angle(carrier.heading,0))<1e-8&&Math.abs(carrier.pitch)<1e-8&&Math.abs(carrier.roll)<1e-8){
      carrier.heading=0;carrier.pitch=0;carrier.roll=0;carrier.manualRoll=0;carrier.returningNeutral=false;
    }
    // Hold launch motion relative to the bay until the craft clears the doors.
    // Free flight remains inertial as Enterprise moves beneath the shuttle.
    if(m.phase==='flight'&&!m.launchAttached){
      const local=carrierVector({x:wx-carrier.x,y:wy-carrier.y,z:wz-carrier.z},carrier,true),nose=carrierVector(direction,carrier,true);
      m.x=local.x;m.y=local.y;m.z=110+local.z;
      s.heading=wrap(Math.atan2(nose.x,-nose.y)/rad);s.pitch=Math.asin(clamp(nose.z,-1,1))/rad;
      const up=carrierVector(worldUp,carrier,true),nh=s.heading*rad,np=s.pitch*rad;
      const relativeBank=Math.atan2(up.x*Math.cos(nh)+up.y*Math.sin(nh),-up.x*Math.sin(nh)*Math.sin(np)+up.y*Math.cos(nh)*Math.sin(np)+up.z*Math.cos(np));
      m.roll=relativeBank-(m.turnBank||0);m.bank=relativeBank;
    }
    b.heading=wrap(b.heading+turn);b.turn=turn/Math.max(dt,.001)/42;b.pitch=clamp(b.pitch+dive,-85,85);b.pitchTurn=dive/Math.max(dt,.001)/30;b.roll=carrier.roll;
    const v=SpaceMath.direction(b.heading,b.pitch);
    b.x=clamp(b.x+v.x*b.speed*dt,15,985);b.y=clamp(b.y+v.y*b.speed*dt,15,885);b.z=clamp(b.z+v.z*b.speed*dt,-240,240);
    b.distance+=Math.abs(b.speed)*dt;
  }
  function launchShuttle(){
    if(!canLaunchShuttle())return;
    m.landingChoicePending=false;m.landingCameraFade=null;$('shuttle-choice').close();
    m.departureCameraPending=true;m.departureCameraFade=null;
    m.entranceCameraFade=null;
    m.entranceCameraPose=null;
    m.launchReverseStopped=false;
    m.launchStage='lift';
    m.launchAttached=true;
    m.garageDoorTarget=0;m.garageDoorOpen=0;
    m.targetSquareHidden=true;m.cockpitFromBerth=false;m.hangarDoorTarget=1;m.bayDoorOpen=1;m.cameraView='excursion';m.departureRamp=true;m.roll=0;m.turnBank=0;m.pitchBob=0;m.lastVisualPitch=null;
    const bridgeState={...s};
    const moving=Math.abs(s.speed)>.000001||Math.abs(s.throttle)>0;
    const carrier={x:0,y:0,z:0,heading:0,pitch:0,roll:0,manualRoll:0,turnBank:0,returningNeutral:false,manual:false,moving,speed:moving?Math.max(Math.abs(s.throttle)/100*.4,Math.min(.06,Math.abs(s.speed)*.1)):0};
    if(moving){bridgeState.speed=Math.abs(s.speed)||Math.abs(s.throttle)/100*(s.drive==='warp'?56:4);bridgeState.throttle=Math.abs(s.throttle);}
    // The bay is at local y=0; negative y is inside, positive y is aft.
    // Begin on the landing pad with room for a camera behind the stern.
    const berth=ShuttleBayFlight.padRoot(180),launchDepth=berth.y;
    m.departureCameraAnchor={...berth,heading:180,pitch:0,bank:0};
    m.launchLiftRemaining=1.5;m.launchLiftFloor=berth.z;
    // Ramp up departure speed instead of appearing already underway.
    Object.assign(m,{phase:'flight',freeSpace:true,bridgeState,carrier,planet:null,x:berth.x,y:launchDepth,z:berth.z,recovered:false,target:'ship',clock:0,completed:false,approach:false,returnLeg:1,bank:0,lookYaw:0,lookPitch:0,cameraZoom:1});
    Object.assign(s,{paused:false,heading:180,pitch:0,throttle:0,speed:0,drive:'impulse',autopilot:false,arrived:false,turn:0,pitchTurn:0});keys.clear();
    destinations(true);document.body.classList.add('shuttle-mode');
    say('Clamshell doors open. Shuttle lifting to a hover. Apply thrust when ready; cockpit view engages at the second black side door from space.');telemetry();
  }
  function retrieve(){if(m.freeSpace||m.phase!=='flight'||m.recovered||m.target!=='beacon'||range()>.45||agl()>.45||Math.abs(s.speed)>.15)return;
    m.recovered=true;m.target='ship';m.returnLeg=0;$('destination').value='ship';s.autopilot=false;s.throttle=0;
    say('Beacon secured aboard. Select Enterprise and engage a return course, or climb manually to the aft bay.');telemetry();}
  function landingBlocker(){
    if(m.phase!=='flight')return 'Landing systems engaged.';
    const b=ShuttleBayFlight.dimensions(),rearLimit=b.rear+createClassFShuttle.aftExtent*(.162/3/3.20)+.002;
    if(Math.abs(m.x)>.052||m.y<rearLimit||m.y>-.025)return 'Fly inside the hangar before landing.';
    if(m.z<b.floor-.004||m.z>b.ceiling)return 'Keep the shuttle below the bay ceiling and above the deck.';
    if(Math.abs(s.speed)>.060)return 'Slow below 60 m/s before landing.';
    if(Math.abs(s.pitch)>15||Math.abs(Math.atan2(Math.sin(m.bank||0),Math.cos(m.bank||0)))>15*rad)return 'Level the shuttle before landing.';
    return '';
  }
  function finishLanding(){
    m.phase='landed';m.clock=0;s.throttle=0;s.speed=0;s.pitch=0;s.turn=0;s.pitchTurn=0;m.roll=0;m.turnBank=0;m.bank=0;m.pitchBob=0;
    Object.assign(m.landing,{pad:{x:m.x,y:m.y,z:m.z},heading:s.heading,pitch:0,bank:0});
    if(!m.landing.keepLaunchCamera)m.departureCameraAnchor={...m.landing.pad,heading:s.heading,pitch:0,bank:0};
    m.departureCameraPending=false;m.departureCameraFade=null;m.entranceCameraFade=null;
    m.landingChoicePending=true;m.landingCameraFade=m.landing.keepLaunchCamera?null:0;m.cameraView='excursion';m.lookYaw=0;m.lookPitch=0;m.cameraZoom=1;keys.clear();
    say(m.landing.keepLaunchCamera?'Shuttle back on deck. Choose Power Down or Launch Again.':'Turnaround complete. Returning to launch view.');telemetry();
  }
  function dock(){const blocker=landingBlocker();if(blocker){say(blocker);return;}
    const keepLaunchCamera=!!m.launchAttached;
    m.launchAttached=false;
    m.departureCameraPending=false;m.departureCameraFade=null;m.entranceCameraFade=null;m.landingChoicePending=false;m.landingCameraFade=null;m.launchLiftRemaining=0;
    const alignPad=!keepLaunchCamera&&Math.cos(s.heading*rad)>.5,b=ShuttleBayFlight.dimensions();
    m.landing={automatic:true,inside:true,alignPad,keepLaunchCamera,start:{x:m.x,y:m.y,z:m.z,heading:s.heading,pitch:s.pitch,bank:m.bank||0},pad:alignPad?ShuttleBayFlight.padRoot(180):{x:m.x,y:m.y,z:b.floor},heading:alignPad?180:s.heading,duration:alignPad?5.3:1.8};
    m.phase='docking';m.departureRamp=false;m.clock=0;m.cameraView='excursion';m.lookYaw=0;m.lookPitch=0;m.hangarDoorTarget=1;
    s.throttle=0;s.speed=0;s.autopilot=false;s.paused=false;keys.clear();if(document.pointerLockElement)document.exitPointerLock();
    if(!alignPad&&Math.abs(m.z-b.floor)<.0001){m.z=b.floor;finishLanding();return;}
    say(alignPad?'Landing on the circular pad, then turning to face the bay exit.':'Lowering shuttle to the deck.');telemetry();}
  function advanceLanding(){
    const landing=m.landing,start=landing.start,ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},b=ShuttleBayFlight.dimensions();
    if(landing.alignPad){
      const center=ease(m.clock/1.2),descent=ease((m.clock-1.2)/1.6),rotation=ease((m.clock-2.8)/2.5),initialPad=ShuttleBayFlight.padRoot(start.heading);
      let delta=angle(start.heading,180);if(Math.abs(delta+180)<1e-6)delta=180;
      s.heading=wrap(start.heading+delta*rotation);
      const pad=rotation>0?ShuttleBayFlight.padRoot(s.heading):initialPad;
      m.x=start.x+(pad.x-start.x)*center;m.y=start.y+(pad.y-start.y)*center;m.z=start.z+(b.floor-start.z)*descent;
    }else{const t=ease(m.clock/landing.duration);m.z=start.z+(b.floor-start.z)*t;s.heading=start.heading;}
    const level=1-ease(m.clock/1.2);s.pitch=start.pitch*level;m.bank=start.bank*level;m.roll=m.bank;m.turnBank=0;m.pitchBob=0;
    if(m.clock>=landing.duration){Object.assign(m,landing.pad);s.heading=landing.heading;finishLanding();}
  }
  function takeOff(){
    const pad=m.landing.pad;
    m.launchAttached=true;
    m.entranceCameraPose=null;
    $('shuttle-choice').close();m.landingChoicePending=false;m.landingCameraFade=null;m.entranceCameraFade=null;
    if(!m.landing.keepLaunchCamera||!m.departureCameraAnchor)m.departureCameraAnchor={...pad,heading:s.heading,pitch:s.pitch,bank:m.bank||0};
    m.cameraView='excursion';m.departureCameraPending=true;m.departureCameraFade=null;
    Object.assign(m,{phase:'flight',x:pad.x,y:pad.y,z:pad.z,landing:null,liftRemaining:0,launchStage:'lift',launchLiftRemaining:1.5,launchLiftFloor:pad.z,launchReverseStopped:false,departureRamp:true,clock:0,approach:false,returnLeg:1,bank:0,roll:0,turnBank:0,pitchBob:0,lastVisualPitch:null});
    s.throttle=0;s.speed=0;s.autopilot=false;s.paused=false;m.hangarDoorTarget=1;keys.clear();
    say('Shuttle lifting to a hover. Apply thrust when ready.');telemetry();
  }
  function powerDown(){if(m.phase!=='landed')return;$('shuttle-choice').close();m.phase='powerdown';m.clock=0;s.throttle=0;s.speed=0;s.autopilot=false;s.paused=false;keys.clear();say('Landing craft powering down. Transferring control to the bridge.');telemetry();}
  function reset(){Object.assign(m,{phase:'bridge',orbitArrival:null,landing:null,cockpitFromBerth:false,liftRemaining:0,roll:0,turnBank:0,pitchBob:0,lastVisualPitch:null,bank:0,departureRamp:false,cameraView:'cockpit',hangarDoorTarget:null,bayDoorOpen:1,garageDoorTarget:0,garageDoorOpen:0,freeSpace:false,bridgeState:null,carrier:null,planet:null,departedPlanet:null,recovered:false,completed:false,clock:0,landingChoicePending:false,landingCameraFade:null,departureCameraPending:false,departureCameraFade:null,entranceCameraFade:null,entranceCameraPose:null,launchLiftRemaining:0,launchStage:null,launchAttached:false});$('shuttle-choice').close();document.body.classList.remove('shuttle-mode');destinations(false);}
  function engage(){if(!active())return false;if(m.phase!=='flight')return true;s.autopilot=true;s.paused=false;s.throttle=65;say(`Local navigation engaged: ${m.target==='beacon'?'beacon recovery approach':'Enterprise aft bay'}.`);return true;}
  function tick(dt){
    if(m.phase==='bridge'){m.departureCameraPending=false;m.departureCameraFade=null;m.entranceCameraFade=null;m.launchLiftRemaining=0;m.launchStage=null;m.landingChoicePending=false;m.landingCameraFade=null;}
    if(m.phase==='orbit'){
      if(m.orbitArrival){m.orbitArrival.elapsed+=dt;if(m.orbitArrival.elapsed>=m.orbitArrival.total){m.orbitArrival=null;say(`Standard orbit established around ${m.planet.name}. Launch the landing craft when ready.`);}}
      s.throttle=clamp(s.throttle+((keys.has('w')?1:0)-(keys.has('s')?1:0))*30*dt,0,100);
      // Keep station-keeping rotation at idle; power increases orbital motion.
      m.clock+=dt*(1+s.throttle*.08);return true;
    }
    if(!active())return false;
    const previousBayPose={x:m.x,y:m.y,z:m.z};
    m.clock+=dt;
    const garageTarget=m.garageDoorTarget??0;
    m.garageDoorOpen=clamp((m.garageDoorOpen??0)+Math.sign(garageTarget-(m.garageDoorOpen??0))*Math.min(Math.abs(garageTarget-(m.garageDoorOpen??0)),dt/2.6),0,1);
    advanceCarrier(dt);
    // Release the launch/manual hold beyond four kilometres so the outer
    // doors close automatically and can reopen on the return approach.
    if(m.phase==='flight'&&(m.freeSpace||m.recovered)&&Math.hypot(m.x,m.y,m.z-110)>4)m.hangarDoorTarget=null;
    const doorTarget=m.hangarDoorTarget??Number(automaticBayOpen());
    m.bayDoorOpen=clamp((m.bayDoorOpen??1)+Math.sign(doorTarget-(m.bayDoorOpen??1))*Math.min(Math.abs(doorTarget-(m.bayDoorOpen??1)),dt/2.4),0,1);
    if(m.phase==='docking'&&m.landing?.automatic){advanceLanding();return true;}
    if(m.phase==='powerdown'&&m.clock>3){
      if(m.freeSpace){const time=s.time,moving=m.carrier?.moving;Object.assign(s,m.bridgeState,{time,paused:false,autopilot:false});Object.assign(m,{phase:'bridge',freeSpace:false,bridgeState:null,carrier:null});say(moving?'Shuttle secured in the hangar. Bridge has control; Enterprise is still underway.':'Shuttle secured in the hangar. Bridge has control; Enterprise remains stopped.');}
      else{m.phase='orbit';m.completed=m.recovered;s.pitch=0;s.heading=90;s.throttle=0;s.speed=0;s.autopilot=false;s.arrived=true;say(m.recovered?'Away mission complete. Beacon recovered. Bridge has control; Enterprise remains in orbit.':'Landing craft secured. Bridge has control; Enterprise remains in orbit.');}
      document.body.classList.remove('shuttle-mode');destinations(false);return true;
    }
    if(m.phase==='landed'&&m.landingCameraFade!=null){
      m.landingCameraFade+=dt;
      if(m.landingCameraFade>=ShuttleBayFlight.departureFadeDuration)m.landingCameraFade=null;
    }
    if(m.phase!=='flight'){s.throttle=0;s.speed=0;if(['landed','powerdown'].includes(m.phase)){s.heading=m.landing.heading;s.pitch=m.landing.pitch||0;m.bank=m.landing.bank||0;}return true;}
    if(m.launchLiftRemaining>0){
      m.launchLiftRemaining=Math.max(0,m.launchLiftRemaining-dt);
      const t=1-m.launchLiftRemaining/1.5,eased=t*t*(3-2*t);
      m.z=m.launchLiftFloor+.025*eased;s.speed=0;s.throttle=0;s.autopilot=false;
      if(m.launchLiftRemaining===0){m.launchStage=null;say('Shuttle hovering. Apply thrust to depart the bay.');}
      return true;
    }
    const oldHeading=s.heading,oldPitch=m.lastVisualPitch??s.pitch;
    const turn=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),tilt=(keys.has('ArrowDown')||keys.has('q')?1:0)-(keys.has('ArrowUp')||keys.has('e')?1:0);
    const rollInput=(keys.has('x')?1:0)-(keys.has('z')?1:0);
    if(turn||tilt||rollInput)s.autopilot=false;
    m.roll=Math.atan2(Math.sin((m.roll||0)+rollInput*60*rad*dt),Math.cos((m.roll||0)+rollInput*60*rad*dt));
    s.heading=wrap(s.heading+turn*42*dt);s.pitch=clamp(s.pitch+tilt*30*dt,-85,85);s.turn=turn;
    s.throttle=clamp(s.throttle+((keys.has('w')?1:0)-(keys.has('s')?1:0))*30*dt,-100,100);
    if(s.throttle<0)s.autopilot=false;
    let aim=target();
    // Return guidance first climbs to orbital altitude, then approaches the stern from aft.
    if(s.autopilot){
      if(m.target==='beacon'&&!m.beaconApproach){aim={x:8,y:-10,z:beacon.z+.08};if(Math.hypot(m.x-8,m.y+10,m.z-beacon.z-.08)<.3){m.beaconApproach=true;aim=beacon;}}
      if(m.target==='ship'){
        m.returnLeg??=0;
        if(m.returnLeg===0&&m.z>109.5)m.returnLeg=1;
        if(m.returnLeg===1&&Math.hypot(m.x-3,m.y-3,m.z-110)<.2)m.returnLeg=2;
        if(m.returnLeg===2&&Math.hypot(m.x,m.y-3,m.z-110)<.2){m.returnLeg=3;m.approach=true;}
        aim=m.returnLeg===0?{x:m.x,y:m.y-1,z:110}:m.returnLeg===1?{x:3,y:3,z:110}:m.returnLeg===2?{x:0,y:3,z:110}:ship;
      }
      const hd=wrap(Math.atan2(aim.x-m.x,m.y-aim.y)/rad),pi=Math.atan2(aim.z-m.z,Math.hypot(aim.x-m.x,aim.y-m.y))/rad;
      s.heading=wrap(s.heading+clamp(angle(s.heading,hd),-48*dt,48*dt));s.pitch+=clamp(pi-s.pitch,-30*dt,30*dt);
    }
    s.turn=clamp(angle(oldHeading,s.heading)/(42*Math.max(dt,.001)),-1,1);
    if(s.autopilot)m.roll+=(0-m.roll)*(1-Math.exp(-dt*3));
    const bankTarget=s.turn*((m.freeSpace||m.z>65)?.12:.20);
    m.turnBank=(m.turnBank||0)+(bankTarget-(m.turnBank||0))*(1-Math.exp(-dt*4));
    m.bank=m.roll+m.turnBank;
    const pitchTarget=clamp((s.pitch-oldPitch)/(30*Math.max(dt,.001)),-1,1)*3*rad;
    m.pitchBob=(m.pitchBob||0)+(pitchTarget-(m.pitchBob||0))*(1-Math.exp(-dt*4));
    const d=Math.hypot(aim.x-m.x,aim.y-m.y,aim.z-m.z);
    if(m.departureRamp&&m.freeSpace&&s.throttle>=0&&!s.autopilot){
      const departureSpeed=s.throttle/100*.4;
      s.speed+=clamp(departureSpeed-s.speed,-.05*dt,.05*dt);
      if(m.y>.08)m.departureRamp=false;
    }else{
      m.departureRamp=false;
      s.speed=SpaceMath.poweredSpeed(s.speed,s.throttle,m.freeSpace ? .4 : m.z>12?8:m.z>2?2:.35,dt);
    }
    if(s.autopilot){s.speed=Math.min(s.speed,Math.max(0,d-(m.target==='beacon'?.22:.1))*.7+(m.freeSpace&&m.target==='ship'?(m.carrier?.speed||0):0));const hd=wrap(Math.atan2(aim.x-m.x,m.y-aim.y)/rad);s.speed*=Math.max(0,Math.cos(angle(s.heading,hd)*rad));}
    m.x+=Math.sin(s.heading*rad)*Math.cos(s.pitch*rad)*s.speed*dt;m.y-=Math.cos(s.heading*rad)*Math.cos(s.pitch*rad)*s.speed*dt;
    const nextZ=m.z+Math.sin(s.pitch*rad)*s.speed*dt;m.z=m.freeSpace?nextZ:clamp(nextZ,terrain(m.x,m.y)+.06,125);
    // Limit backing toward the fixed camera during the launch sequence only.
    if(m.departureCameraPending){
      const rearLimit=ShuttleBayFlight.dimensions().launchRearLimitY;
      if(m.y<rearLimit&&m.y<previousBayPose.y){
        m.y=rearLimit;s.speed=0;s.throttle=0;s.autopilot=false;
        if(!m.launchReverseStopped)say('Launch reverse limit reached. Shuttle stopped; apply forward thrust to depart.');
        m.launchReverseStopped=true;
      }else if(m.y>rearLimit+.001)m.launchReverseStopped=false;
    }
    if(m.liftRemaining>0){const liftStep=Math.min(dt,m.liftRemaining);m.z+=(110.007-(EnterpriseModels.selected==='original'?110-.04645:110-.01530))*liftStep/1.2;m.liftRemaining-=liftStep;}
    if(m.launchAttached&&ShuttleBayFlight.clearedEntrance(m,s))m.launchAttached=false;
    if(m.departureCameraFade!=null){
      m.departureCameraFade+=dt;
      if(m.cameraView!=='cockpit'){
        m.cameraView='cockpit';m.lookYaw=0;m.lookPitch=0;m.cameraZoom=1;
        Object.assign(m,ShuttleBayFlight.cockpitEntryPose(),{roll:0,turnBank:0,bank:0,pitchBob:0,lastVisualPitch:0});
        s.heading=180;s.pitch=0;s.turn=0;s.pitchTurn=0;
      }
      if(m.departureCameraFade>=ShuttleBayFlight.departureFadeDuration)m.departureCameraFade=null;
    }
    if(m.departureCameraPending&&previousBayPose.y<ShuttleBayFlight.dimensions().cabinTransitionY&&m.y>=ShuttleBayFlight.dimensions().cabinTransitionY){
      m.departureCameraPending=false;m.departureCameraFade=0;
    }
    if(m.entranceCameraFade!=null){
      m.entranceCameraFade+=dt;
      if(m.entranceCameraFade>=ShuttleBayFlight.departureFadeDuration)m.entranceCameraFade=null;
    }
    const viewer=$('main-view'),entryView=ShuttleBayFlight.cockpitView(m,s);
    if(m.entranceCameraPose&&m.y>previousBayPose.y&&m.y>ShuttleBayFlight.dimensions().mouth+.04)m.entranceCameraPose=null;
    if((m.freeSpace||m.recovered&&m.z>95)&&m.y<previousBayPose.y&&m.cameraView==='cockpit'&&ShuttleBayFlight.lipOutsideView(entryView,viewer.clientWidth||900,viewer.clientHeight||600)){
      m.entranceCameraFade=0;m.departureCameraFade=null;m.departureCameraPending=false;
      m.entranceCameraPose=entryView;m.cameraView='excursion';
      if(document.pointerLockElement)document.exitPointerLock();
      say('Bay lip out of cockpit view. Excursion camera aligned with your approach.');
    }
    if(!m.freeSpace&&agl()<.065&&s.pitch*s.speed<0){s.pitch=0;s.throttle=0;s.speed=0;s.autopilot=false;say('Terrain clearance protection: engines holding. Climb to continue.');}
    if(s.autopilot&&m.target==='beacon'&&range()<.3){s.autopilot=false;s.throttle=0;s.speed=0;s.pitch=0;say('Beacon within retrieval range. Press RETRIEVE BEACON.');}
    if(s.autopilot&&m.target==='ship'&&m.approach&&range()<.6){s.autopilot=false;s.speed=m.carrier?.speed||0;s.throttle=s.speed/.4*100;s.pitch=0;s.heading=0;say('Aligned with aft shuttle bay. Press LAND IN BAY.');}
    m.lastVisualPitch=s.pitch;
    return true;
  }
  function updateUI(){
    const choice=$('shuttle-choice'),showChoice=m.phase==='landed'&&m.landingChoicePending&&m.landingCameraFade==null;
    if(showChoice)$('shuttle-choice-description').textContent=m.landing?.keepLaunchCamera?'Shuttle is back on deck. Power down or launch again?':'Turnaround complete. Power down or launch again?';
    if(showChoice&&!choice.open){keys.clear();choice.showModal();}
    else if(!showChoice&&choice.open)choice.close();
    const local=active();$('throttle').min=m.phase==='orbit'?'0':'-100';$('launch-craft').hidden=m.phase!=='orbit';$('leave-orbit').hidden=m.phase!=='orbit';$('launch-shuttle').hidden=!canLaunchShuttle();$('launch-craft').textContent=m.completed?'LAUNCH ANOTHER SORTIE':'LAUNCH LANDING CRAFT';
    const spaceLook=m.phase==='flight'&&(m.freeSpace||m.z>65);$('camera-controls').hidden=!spaceLook;$('main-view').classList.toggle('space-look',spaceLook);
    const fixedBayView=spaceLook&&m.cameraView==='excursion'&&(ShuttleBayFlight.inside(m)||!!m.entranceCameraPose);
    $('mouse-look').disabled=fixedBayView;
    if(fixedBayView)$('camera-hint').textContent='FIXED BAY CAMERA · HELM ROTATES SHUTTLE';
    else if($('camera-hint').textContent.startsWith('FIXED BAY'))$('camera-hint').textContent='CLICK VIEW FOR MOUSE LOOK';
    $('excursion-view').hidden=!spaceLook||(!m.freeSpace&&m.z<=95);
    $('excursion-view').textContent=m.cameraView==='excursion'?'COCKPIT VIEW':'EXCURSION VIEW';
    $('excursion-view').setAttribute('aria-pressed',String(m.cameraView==='excursion'));
    if((!spaceLook||fixedBayView)&&document.pointerLockElement===$('main-view'))document.exitPointerLock();
    $('camera-zoom').textContent=(m.cameraZoom||1).toFixed(1)+'×';
    const mapMode=local?(m.target==='ship'||m.phase!=='flight'?'approach':'surface'):'galaxy';
    if(m.mapMode!==mapMode){m.mapMode=mapMode;const approach=mapMode==='approach',surface=mapMode==='surface';
      document.querySelector('.galaxy .display-title h2').lastChild.textContent=approach?' 3D SHUTTLE ATTITUDE':surface?' SURFACE NAVIGATION':' 3D GALAXY NAVIGATION';
      document.querySelector('.galaxy .display-title>span').textContent=approach?'AFT BAY GUIDANCE':surface?'LOCAL TERRAIN':'SPATIAL HOLOGRAM';
      document.querySelector('.galaxy .display-footer span:first-child').textContent=approach?'DRAG ORBIT · SCROLL ZOOM · ⌂ RESET':surface?'LOCAL SURFACE · NORTH UP':'DRAG ORBIT · CLICK PLOT · SCROLL ZOOM';
      document.querySelector('.galaxy .display-footer span:last-child').textContent=approach?'ATTITUDE / ALIGNMENT':surface?'RANGE 30 KM':'GRID 100 LY';
      $('map-view').setAttribute('aria-label',approach?'3D shuttle attitude and aft bay approach: drag to orbit, scroll to zoom':surface?'Local planetary terrain and navigation targets':'3D galaxy: drag to orbit, scroll to zoom, click a system to plot a course');
    }
    $('control-hints').textContent=local?'← → TURN · ↑ DIVE / ↓ CLIMB · Z / X ROLL · W / S POWER · SPACE STOP · P PAUSE · R RESET · B AUDIO':'← → YAW · ↑ ↓ PITCH · W / S POWER · SPACE STOP · P PAUSE · R RESET · B AUDIO';
    $('mission-actions').hidden=!local;
    $('retrieve-beacon').hidden=m.freeSpace||m.recovered;$('retrieve-beacon').disabled=m.phase!=='flight'||m.target!=='beacon'||range()>.45||agl()>.45||Math.abs(s.speed)>.15;
    const landingReason=landingBlocker();
    $('land-bay').hidden=m.phase!=='flight';$('land-bay').disabled=!!landingReason;
    $('land-bay').textContent='LAND SHUTTLE';
    $('land-bay').title=landingReason||(m.launchAttached?'Set back down without turning, keeping the rear launch camera.':'Lower to the deck; a forward-facing shuttle lands on the circular pad and turns toward the exit.');
    const doorOpen=(m.hangarDoorTarget??Number(automaticBayOpen()))===1;
    $('hangar-door').hidden=(!m.freeSpace&&!m.recovered)||!['flight','cockpitfade','landed'].includes(m.phase);
    $('hangar-door').textContent=doorOpen?'CLOSE HANGAR DOOR':'OPEN HANGAR DOOR';
    $('hangar-door').setAttribute('aria-pressed',String(doorOpen));
    $('garage-door').hidden=(!m.freeSpace&&!m.recovered)||!['flight','landed'].includes(m.phase);
    $('garage-door').textContent=m.garageDoorTarget?'CLOSE GARAGE':'OPEN GARAGE';
    $('garage-door').setAttribute('aria-pressed',String(!!m.garageDoorTarget));
    $('power-down').hidden=m.phase!=='landed';
    $('retrieve-beacon').title='Within 450 m of beacon, below 450 m AGL, speed at most 150 m/s.';
    $('mission-status').textContent=local?`${m.phase==='flight'?(m.z>65?'UPPER ATMOSPHERE':m.z>4?'CLOUD LAYER':'LOWER ATMOSPHERE'):m.phase.toUpperCase()} · ${m.recovered?'BEACON SECURED':'RECOVER ABANDONED BEACON'} · ALT ${m.z.toFixed(2)} KM · AGL ${agl().toFixed(2)} KM`:m.phase==='orbit'?`STANDARD ORBIT · ${m.planet.name.toUpperCase()}${m.completed?' · MISSION COMPLETE':''}`:'APPROACH WITHIN 1 LY TO ENTER ORBIT';
    $('warp').disabled=local;
    if(m.freeSpace&&local)$('mission-status').textContent=`${m.phase==='flight'?'SHUTTLE FREE FLIGHT':m.phase.toUpperCase()} · SHIP RANGE ${range().toFixed(2)} KM`;
    else if(canLaunchShuttle())$('mission-status').textContent='ENTERPRISE STOPPED · SHUTTLE READY';
    if(m.phase==='orbit'){$('view-label').textContent=m.planet.name.toUpperCase()+' · STANDARD ORBIT';$('drive-label').textContent='ORBITAL STATION KEEPING';}
    if(!local)return;
    $('mission-hint').textContent=m.phase==='landed'?'Choose Power Down to return to the bridge, or Launch Again to lift off.':m.phase==='flight'?(landingReason||'LAND SHUTTLE lowers to the deck. Facing forward lands on the pad and turns toward the exit.'): 'Landing systems engaged.';
    $('view-label').textContent=m.freeSpace?'SHUTTLE · ENTERPRISE':'LANDING CRAFT · '+m.planet.name.toUpperCase();$('drive-label').textContent=s.paused?'SIMULATION PAUSED':m.phase==='powerdown'?'POWERING DOWN':m.freeSpace?'LOCAL SPACE FLIGHT':'ATMOSPHERIC FLIGHT';
    $('distance').textContent=range().toFixed(2)+' KM';$('target-bearing').textContent=bearing().toFixed(0).padStart(3,'0')+'°';$('target-pitch').textContent=elevation().toFixed(0)+'°';$('target-elevation').textContent=(target().z-m.z).toFixed(2)+' KM';$('factor').textContent=(s.speed*1000).toFixed(0)+' m/s';$('engine-name').textContent=s.throttle<0?(s.speed>=0?'BRAKING FOR REVERSE':'LANDING CRAFT / REVERSE'):'LANDING CRAFT THRUST';$('eta').textContent=s.paused?'PAUSED':s.throttle<0&&s.speed>=0?'BRAKING':s.speed<0?'REVERSING':s.throttle?Math.ceil(range()/Math.max(.001,s.speed))+' SEC':'HOLDING';$('nav-state').textContent=s.autopilot?'LOCAL TRACK':'LOCAL NAV';
  }
  $('launch-craft').onclick=launch;$('launch-shuttle').onclick=launchShuttle;$('leave-orbit').onclick=leaveOrbit;$('retrieve-beacon').onclick=retrieve;$('land-bay').onclick=dock;$('power-down').onclick=powerDown;
  $('hangar-door').onclick=toggleHangarDoor;
  $('garage-door').onclick=toggleGarageDoor;
  $('shuttle-choice-power-down').onclick=powerDown;
  $('shuttle-choice-launch').onclick=()=>{if(m.phase==='landed'&&m.landingChoicePending)takeOff();};
  $('shuttle-choice').addEventListener('cancel',event=>event.preventDefault());
  window.addEventListener('keydown',event=>{
    if(!$('shuttle-choice').open)return;
    event.stopImmediatePropagation();
    if(!['Tab','Enter',' '].includes(event.key))event.preventDefault();
  },{capture:true});
  $('excursion-view').onclick=()=>{if(m.phase!=='flight')return;if(document.pointerLockElement)document.exitPointerLock();m.entranceCameraPose=null;m.entranceCameraFade=null;m.cameraView=m.cameraView==='excursion'?'cockpit':'excursion';m.lookYaw=0;m.lookPitch=0;m.cameraZoom=1;telemetry();};
  $('destination').addEventListener('change',()=>{if(active()){m.target=$('destination').value;s.autopilot=false;say('Local target selected. Engage course or use manual helm.');telemetry();}});

  // Perspective terrain is built from a continuous multi-frequency height field.
  // Fixed, repeating world-space points give shuttle travel and mouse look
  // the same perspective as the ship, without a screen-space star overlay.
  let starSeed=1701;
  const starRandom=()=>{starSeed=(Math.imul(starSeed,1664525)+1013904223)>>>0;return starSeed/4294967296;};
  const spaceStars=Array.from({length:3000},()=>({x:starRandom()*120,y:starRandom()*120,z:starRandom()*120,size:.6+starRandom()*.9}));
  function drawSpaceStars(c,w,h,camera){
    const carrier=m.freeSpace?m.carrier:null,origin=carrierVector({x:m.x,y:m.y,z:m.z-110},carrier);
    origin.x+=carrier?.x||0;origin.y+=carrier?.y||0;origin.z+=carrier?.z||0;
    const heading=camera.heading*rad,pitch=camera.pitch*rad,focal=w*.65*(camera.cameraZoom||1);
    const forward=carrierVector(SpaceMath.direction(camera.heading,camera.pitch),carrier),right=carrierVector({x:Math.cos(heading),y:Math.sin(heading),z:0},carrier),up=carrierVector({x:-Math.sin(heading)*Math.sin(pitch),y:Math.cos(heading)*Math.sin(pitch),z:Math.cos(pitch)},carrier);
    const cb=Math.cos(m.bank||0),sb=Math.sin(m.bank||0),baseRight={...right},baseUp={...up};
    for(const axis of ['x','y','z']){right[axis]=baseRight[axis]*cb+baseUp[axis]*sb;up[axis]=-baseRight[axis]*sb+baseUp[axis]*cb;}
    const relative=(p,origin)=>((p-origin+60)%120+120)%120-60;
    c.fillStyle='#d2e7ff';
    for(const star of spaceStars){
      const dx=relative(star.x,origin.x),dy=relative(star.y,origin.y),dz=relative(star.z,origin.z);
      const side=dx*right.x+dy*right.y+dz*right.z,depth=dx*forward.x+dy*forward.y+dz*forward.z,height=dx*up.x+dy*up.y+dz*up.z;
      if(depth<=.1)continue;
      const x=w/2+side/depth*focal,y=h/2-height/depth*focal;
      if(x<0||x>w||y<0||y>h)continue;
      // Fade before wrapping so long excursions never reveal a moving boundary.
      c.globalAlpha=clamp((60-Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz)))/12,0,1)*clamp((depth-.5)/2,0,1);
      c.fillRect(x,y,star.size,star.size);
    }
    c.globalAlpha=1;
  }
  function render(scene,w,h){
    if(m.phase==='bridge'){scene.departureSnapshot=null;scene.entranceSnapshot=null;scene.landingSnapshot=null;return false;}
    if(scene.departureSnapshotAnchor!==m.departureCameraAnchor){scene.departureSnapshot=null;scene.entranceSnapshot=null;scene.departureSnapshotAnchor=m.departureCameraAnchor;}
    if(!scene.awayTexture){scene.awayTexture=scene.textures.createCanvas('away-optical',w,h);scene.awayImage=scene.add.image(0,0,'away-optical').setOrigin(0).setDepth(20);}
    const tex=scene.awayTexture;if(tex.width!==w||tex.height!==h)tex.setSize(w,h);scene.awayImage.setVisible(true);const c=tex.getContext();c.clearRect(0,0,w,h);c.lineWidth=1;
    const orbiting=m.phase==='orbit',alt=(orbiting||m.freeSpace||['docking','cockpitfade','landed','powerdown'].includes(m.phase))?110:m.z;
    if(orbiting&&OrbitArrival.render(c,w,h,m,s,scene)){tex.refresh();return true;}
    const spaceLook=['flight','landed'].includes(m.phase)&&(m.freeSpace||m.z>65);
    const cameraZoom=spaceLook?clamp(m.cameraZoom||1,.5,8):1;
    const pitchNudge=m.cameraView==='excursion'?0:(m.pitchBob||0)/rad;
    const cameraState=spaceLook?{...s,shuttleHeading:s.heading,shuttlePitch:s.pitch,heading:s.heading+(m.lookYaw||0),pitch:clamp(s.pitch+(m.lookPitch||0)+pitchNudge,-89,89),cameraZoom}:s;
    const planetColor=m.planet?.color||0x83c8ff,tint=[(planetColor>>16)&255,(planetColor>>8)&255,planetColor&255];
const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,alt>65?'#01050e':`rgb(${tint.map(v=>Math.round(v*.22+10)).join(',')})`);sky.addColorStop(1,m.freeSpace?'#030710':alt>65?'#163358':`rgb(${tint.map(v=>Math.round(v*.5+100)).join(',')})`);c.fillStyle=sky;c.fillRect(0,0,w,h);
    if(alt>60){if(spaceLook)drawSpaceStars(c,w,h,cameraState);else for(let i=0;i<180;i++){const x=((Math.sin(i*81.17)*43758)%1+1)%1*w,y=((Math.cos(i*37.7)*2342)%1+1)%1*h;c.fillStyle='#d2e7ff';c.fillRect(x,y,i%7===0?1.5:.7,1);}}
    if(!m.freeSpace&&(orbiting||alt>12)){
      scene.detailedPlanet??=createDetailedPlanet();
      c.save();c.translate(w/2,h/2);c.scale(cameraZoom,cameraZoom);c.translate(-w/2,-h/2);
      scene.detailedPlanet.draw(c,w,h,m.clock,m.planet.color,cameraState.pitch);c.restore();
    }
    const heading=cameraState.heading*rad,pitch=cameraState.pitch*rad,scale=w*.65*cameraZoom;
    const project=(x,y,z)=>{if(!orbiting&&alt<15&&scene.surfaceWorld)return scene.surfaceWorld.project(x,y,z,w,h);const dx=x-m.x,dy=y-m.y,dz=z-m.z,forward=dx*Math.sin(heading)-dy*Math.cos(heading),side=dx*Math.cos(heading)+dy*Math.sin(heading),depth=forward*Math.cos(pitch)+dz*Math.sin(pitch),up=dz*Math.cos(pitch)-forward*Math.sin(pitch);return depth>.025?{x:w/2+side/depth*scale,y:h/2-up/depth*scale,d:depth}:null;};
    function poly(points,color){const p=points.map(a=>project(...a));if(p.some(a=>!a))return;c.fillStyle=color;c.beginPath();p.forEach((a,i)=>i?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y));c.closePath();c.fill();}
    if(!orbiting&&alt<15){
      if(!scene.surfaceAttempted){scene.surfaceAttempted=true;scene.surfaceWorld=PlanetSurface.create();}
      if(scene.surfaceWorld)scene.surfaceWorld.draw(c,w,h,m,s);
      else{
      // Voxel height-field renderer: shaded rock, vegetation, water and distance haze.
      if(!scene.groundCanvas){scene.groundCanvas=document.createElement('canvas');}
      const ground=scene.groundCanvas,gw=480,gh=Math.max(100,Math.round(h/w*gw));
      ground.width=gw;ground.height=gh;const gc=ground.getContext('2d'),pixels=gc.createImageData(gw,gh),data=pixels.data;
      const far=alt>4?75:30,focal=gw*.65,sh=Math.sin(heading),ch=Math.cos(heading),sp=Math.sin(pitch),cp=Math.cos(pitch);
      for(let column=0;column<gw;column++){
        const side=(column-gw/2)/focal;let ceiling=gh;
        for(let depth=.025;depth<far&&ceiling>0;depth=depth*1.075+.012){
          const x=m.x+(sh+ch*side)*depth,y=m.y+(-ch+sh*side)*depth,z=Math.max(-.06,terrain(x,y)),dz=z-alt,d=depth*cp+dz*sp;
          if(d<=.02)continue;
          const top=clamp(Math.floor(gh/2-(dz*cp-depth*sp)/d*focal),0,gh);
          if(top>=ceiling)continue;
          const slope=(terrain(x+.035,y)-terrain(x,y+.035))/.035,noise=(Math.sin(x*213.7+y*157.3)*43758.5)%1;
          const light=clamp(.8+slope*.65,.3,1.3),fog=1-Math.exp(-depth*.045);
          let base=z<=-.059?[30,77,99]:z>.4?[132,132,119]:[80+noise*14,106+noise*15,67+noise*8];
          const r=base[0]*light*(1-fog)+132*fog,g=base[1]*light*(1-fog)+162*fog,b=base[2]*light*(1-fog)+180*fog;
          for(let yy=top;yy<ceiling;yy++){const i=(yy*gw+column)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;}ceiling=top;
        }
      }
      gc.putImageData(pixels,0,0);c.imageSmoothingEnabled=true;c.drawImage(ground,0,0,w,h);
      }
      if(!m.recovered&&!scene.surfaceWorld){
        const {x,y,z}=beacon;poly([[x-.025,y-.025,z-.12],[x+.025,y-.025,z-.12],[x+.025,y-.025,z],[x-.025,y-.025,z]],'#b8c0b9');poly([[x+.025,y-.025,z-.12],[x+.025,y+.025,z-.12],[x+.025,y+.025,z],[x+.025,y-.025,z]],'#727f81');
        for(let i=0;i<4;i++){const a=.09-i*.014,zz=z+i*.009;poly([[x-a,y-a,zz],[x+a,y-a,zz],[x+a,y+a,zz],[x-a,y+a,zz]],i%2?'#d0ccc0':'#606b76');}
      }
    }
    let shipBay=null;
    if(!orbiting&&alt>95){
      scene.enterpriseAttempted=true;scene.enterpriseRenderer=EnterpriseModels.rendererFor(scene);
      if(scene.enterpriseRenderer){shipBay=scene.enterpriseRenderer.draw(c,w,h,m,Number.isFinite(m.hangarDoorTarget)?{...cameraState,bayDoorOpen:m.bayDoorOpen}:cameraState);}
      else if(!scene.enterpriseRenderer){
      // Exterior silhouette: saucer, paired nacelles and an illuminated aft bay.
      const bay=project(ship.x,ship.y,ship.z);
      // Anchor the illustration by its black bay opening, not the hull center.
      const p=bay?{...bay,y:bay.y-.14*scale/bay.d}:null;
      if(p){const k=scale/p.d;
        c.fillStyle='#71889b';c.beginPath();c.ellipse(p.x,p.y-.26*k,.85*k,.18*k,0,0,Math.PI*2);c.fill();c.fillStyle='#a3b4c0';c.fillRect(p.x-.16*k,p.y-.22*k,.32*k,.5*k);
        for(const side of [-1,1]){c.strokeStyle='#788e9e';c.lineWidth=.055*k;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+side*.65*k,p.y-.08*k);c.stroke();c.fillStyle='#b6c4cd';c.fillRect(p.x+side*.65*k-.07*k,p.y-.4*k,.14*k,.65*k);c.fillStyle='#60bdff';c.fillRect(p.x+side*.65*k-.035*k,p.y-.35*k,.07*k,.48*k);}
        c.fillStyle='#bfced6';c.beginPath();c.ellipse(p.x,p.y+.14*k,.23*k,.19*k,0,0,Math.PI*2);c.fill();c.fillStyle='#090e14';c.beginPath();c.ellipse(p.x,p.y+.14*k,.18*k,.14*k,0,Math.PI,Math.PI*2);c.lineTo(p.x+.18*k,p.y+.25*k);c.lineTo(p.x-.18*k,p.y+.25*k);c.fill();c.strokeStyle='#f6d16d';c.lineWidth=Math.max(1,.008*k);for(const side of [-1,1]){c.beginPath();c.moveTo(p.x+side*.06*k,p.y+.24*k);c.lineTo(p.x+side*.02*k,p.y+.12*k);c.stroke();}c.fillStyle='#ff6170';c.fillRect(p.x-.13*k,p.y-.035*k,.26*k,.025*k);
      }
      }
    }
    if(!orbiting&&alt>4&&alt<65){const density=Math.sin((alt-4)/61*Math.PI);c.fillStyle=`rgba(235,232,226,${density*.3})`;c.fillRect(0,0,w,h);for(let i=0;i<17;i++){const x=((i*.19+m.clock*.025)%1.3-.15)*w,y=h*(.5+.6*Math.sin(i*2.3)),radius=w*.32;c.save();c.translate(x,y);c.scale(1,.12);const cloud=c.createRadialGradient(0,0,0,0,0,radius);cloud.addColorStop(0,`rgba(248,246,240,${density*.42})`);cloud.addColorStop(1,'#ffffff00');c.fillStyle=cloud;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();}}
    if(!orbiting){
if(m.phase==='flight'){
const p=m.target==='ship'&&shipBay?.visible?shipBay:project(target().x,target().y,target().z);c.strokeStyle='#79d6ff';c.fillStyle='#b5e9ff';c.font='12px Consolas';if(!m.targetSquareHidden&&p&&p.x>25&&p.x<w-25&&p.y>35&&p.y<h-30){c.strokeRect(p.x-14,p.y-14,28,28);c.fillText(`${m.target==='beacon'?'BEACON':'AFT BAY'} ${range().toFixed(2)} KM`,clamp(p.x+20,10,w-180),clamp(p.y,50,h-40));}
      if(!m.targetSquareHidden){c.lineWidth=1;c.strokeStyle='#9adbff90';c.beginPath();c.moveTo(w/2-25,h/2);c.lineTo(w/2-8,h/2);c.moveTo(w/2+8,h/2);c.lineTo(w/2+25,h/2);c.stroke();}
      c.fillStyle='#b5e9ff';c.fillText(m.freeSpace?`SHIP RANGE ${range().toFixed(2)} KM  /  VERTICAL ${(m.z-110).toFixed(2)} KM  /  ${(s.speed*1000).toFixed(0)} M/S`:`ALT ${m.z.toFixed(2)} KM  /  AGL ${agl().toFixed(2)} KM  /  ${(s.speed*1000).toFixed(0)} M/S`,18,h-18);
      }
      if(['docking','cockpitfade','landed','powerdown'].includes(m.phase)){
        c.fillStyle='#06101bd9';c.fillRect(0,0,w,44);c.fillStyle='#bde8ff';c.textAlign='center';c.fillText(m.phase==='docking'?'AUTOMATIC LANDING · FLIGHT CONTROLS LOCKED':m.phase==='cockpitfade'?'TOUCHDOWN · RETURNING TO COCKPIT':m.phase==='landed'?'SHUTTLE SECURED · POWER DOWN / LAUNCH AGAIN':'SYSTEMS SHUTTING DOWN · BRIDGE TRANSFER',w/2,27);c.textAlign='left';if(m.phase==='powerdown'){c.fillStyle=`rgba(0,0,0,${clamp(m.clock/3,0,1)})`;c.fillRect(0,0,w,h);}
        if(m.phase==='cockpitfade'){const fade=m.clock<.6?m.clock/.6:1-(m.clock-.6)/.6;c.fillStyle=`rgba(0,0,0,${clamp(fade,0,1)})`;c.fillRect(0,0,w,h);}
      }
    }
    if(m.cameraView==='excursion'&&(m.departureCameraPending||m.departureCameraFade!=null)){
      scene.departureSnapshot??=document.createElement('canvas');
      const snapshot=scene.departureSnapshot;
      if(snapshot.width!==w||snapshot.height!==h){snapshot.width=w;snapshot.height=h;}
      snapshot.getContext('2d').drawImage(c.canvas,0,0);
    }else if(m.departureCameraFade!=null&&scene.departureSnapshot){
      const t=clamp(m.departureCameraFade/ShuttleBayFlight.departureFadeDuration,0,1),eased=t*t*(3-2*t);
      c.save();c.globalAlpha=1-eased;c.drawImage(scene.departureSnapshot,0,0,w,h);c.restore();
    }else if(!m.departureCameraPending)scene.departureSnapshot=null;
    if(m.cameraView==='cockpit'&&m.phase==='flight'&&m.departureCameraFade==null&&m.entranceCameraFade==null){
      scene.entranceSnapshot??=document.createElement('canvas');
      const snapshot=scene.entranceSnapshot;
      if(snapshot.width!==w||snapshot.height!==h){snapshot.width=w;snapshot.height=h;}
      snapshot.getContext('2d').drawImage(c.canvas,0,0);
    }else if(m.entranceCameraFade!=null&&scene.entranceSnapshot){
      const t=clamp(m.entranceCameraFade/ShuttleBayFlight.departureFadeDuration,0,1),eased=t*t*(3-2*t);
      c.save();c.globalAlpha=1-eased;c.drawImage(scene.entranceSnapshot,0,0,w,h);c.restore();
    }else if(m.entranceCameraFade==null)scene.entranceSnapshot=null;
    if(m.phase==='docking'){
      scene.landingSnapshot??=document.createElement('canvas');const snapshot=scene.landingSnapshot;
      if(snapshot.width!==w||snapshot.height!==h){snapshot.width=w;snapshot.height=h;}
      snapshot.getContext('2d').drawImage(c.canvas,0,0);
    }else if(m.landingCameraFade!=null&&scene.landingSnapshot){
      const t=clamp(m.landingCameraFade/ShuttleBayFlight.departureFadeDuration,0,1),eased=t*t*(3-2*t);
      c.save();c.globalAlpha=1-eased;c.drawImage(scene.landingSnapshot,0,0,w,h);c.restore();
    }else scene.landingSnapshot=null;
    OrbitArrival.finish(c,w,h,m,scene);tex.refresh();return true;
  }
  function renderNav(scene,w,h,mode){
    if(!active()){scene.localImage?.setVisible(false);scene.shuttleMapTelemetry=null;return false;}
    if(!scene.localTexture){scene.localTexture=scene.textures.createCanvas('local-nav',w,h);scene.localImage=scene.add.image(0,0,'local-nav').setOrigin(0).setDepth(50);}
    scene.localImage.setVisible(true);const tex=scene.localTexture;if(tex.width!==w||tex.height!==h)tex.setSize(w,h);const c=tex.getContext();c.fillStyle='#040d18';c.fillRect(0,0,w,h);
    if(mode==='map'&&(m.target==='ship'||m.phase!=='flight')){scene.shuttleMapTelemetry=drawShuttleApproachMap(c,w,h,m,s,scene);tex.refresh();return true;}
    scene.shuttleMapTelemetry=null;
    const extent=mode==='map'?30:Math.max(2,Math.hypot(target().x-m.x,target().y-m.y)*1.3),scale=Math.min(w,h)*.38/extent,cx=w/2,cy=h/2;
    if(mode==='map'){for(let y=0;y<60;y++)for(let x=0;x<72;x++){const tx=m.x+(x/72-.5)*w/scale,ty=m.y+(y/60-.5)*h/scale;c.fillStyle=PlanetSurface.mapColor(tx,ty,m.planet.color);c.fillRect(x*w/72,y*h/60,w/72+1,h/60+1);}}
    c.strokeStyle='#4ca1d34a';c.lineWidth=1;for(let i=1;i<=3;i++){c.beginPath();c.ellipse(cx,cy,extent*scale*i/3,extent*scale*i/3,0,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(0,cy);c.lineTo(w,cy);c.moveTo(cx,0);c.lineTo(cx,h);c.stroke();
    c.font='11px Consolas';c.fillStyle='#a4d8fa';c.fillText(mode==='map'?'LOCAL SURFACE NAVIGATION':'LOCAL FLIGHT RADAR',14,23);c.fillText(`RANGE ${extent.toFixed(1)} KM · NORTH UP`,14,h-16);
    for(const [id,p,label] of [['beacon',beacon,m.recovered?'RECOVERED':'BEACON'],['ship',ship,'ENTERPRISE / AFT BAY']].filter(([id])=>!m.freeSpace||id==='ship')){const dx=(p.x-m.x)*scale,dy=(p.y-m.y)*scale,ratio=Math.min(1,(Math.min(w,h)*.4)/Math.max(1,Math.hypot(dx,dy))),x=cx+dx*ratio,y=cy+dy*ratio;c.strokeStyle=id===m.target?'#9adfff':'#4d789b';c.strokeRect(x-5,y-5,10,10);c.fillStyle=c.strokeStyle;c.fillText(label,clamp(x+9,8,w-165),clamp(y+15,40,h-40));c.fillText(m.freeSpace?'VERTICAL 0.00 KM':`ALT ${p.z.toFixed(2)} KM`,clamp(x+9,8,w-165),clamp(y+29,54,h-26));}
    c.save();c.translate(cx,cy);c.rotate(s.heading*rad);c.fillStyle='#94e1ff';c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(0,3);c.lineTo(6,7);c.fill();c.restore();tex.refresh();return true;
  }
  return {state:m,active,tick,updateUI,render,renderNav,orbit,launch,launchShuttle,stopEnterprise,neutralEnterprise,retrieve,dock,powerDown,reset,engage,terrain,range};
};
