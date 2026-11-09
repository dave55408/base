/* Local flight uses kilometres; the bridge continues to use light years. */
window.createAwayMission = ({state:s,systems,keys,say,telemetry}) => {
  const $=id=>document.getElementById(id),rad=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrap=v=>(v%360+360)%360,angle=(a,b)=>(b-a+540)%360-180;
  const m={phase:'bridge',planet:null,x:0,y:0,z:110,recovered:false,target:'beacon',clock:0,completed:false};
  const terrain=PlanetSurface.height;
  const beacon={x:8,y:-12,z:terrain(8,-12)+.12};
  const ship={x:0,y:0,z:110};
  const active=()=>!['bridge','orbit'].includes(m.phase);
  const target=()=>m.target==='beacon'?beacon:ship;
  const range=()=>Math.hypot(target().x-m.x,target().y-m.y,target().z-m.z);
  const bearing=()=>wrap(Math.atan2(target().x-m.x,m.y-target().y)/rad);
  const elevation=()=>Math.atan2(target().z-m.z,Math.hypot(target().x-m.x,target().y-m.y))/rad;
  const agl=()=>m.z-terrain(m.x,m.y);
  function destinations(local){
    $('destination').replaceChildren();
    for(const p of local?[{id:'beacon',name:'Abandoned beacon'},{id:'ship',name:'Enterprise · aft shuttle bay'}]:systems){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;$('destination').append(o);}
    $('destination').value=local?m.target:s.target.id;
  }
  function orbit(planet){m.phase='orbit';m.planet=planet;s.target=planet;$('destination').value=planet.id;s.autopilot=false;s.arrived=true;s.throttle=0;s.speed=0;s.pitch=0;s.drive='impulse';say(`Standard orbit established around ${planet.name}. Launch the landing craft when ready.`);}
  function leaveOrbit(){
    if(m.phase!=='orbit')return;
    m.departedPlanet=m.planet;m.phase='bridge';
    s.autopilot=false;s.arrived=false;s.throttle=2;s.speed=0;
    say(`Left orbit around ${m.planet.name}. Engines at 2%. Galaxy navigation ready; select a destination or use the helm.`);
    telemetry();
  }
  function launch(){
    if(m.phase!=='orbit')return;
    Object.assign(m,{phase:'flight',x:0,y:2,z:110,recovered:false,target:'beacon',clock:0,completed:false,approach:false,beaconApproach:false,returnLeg:0,bank:0});
    s.paused=false;s.heading=bearing();s.pitch=-65;s.throttle=35;s.drive='impulse';s.autopilot=false;s.arrived=false;
    destinations(true);document.body.classList.add('shuttle-mode');
    say('Landing craft launched. Plot the abandoned beacon or descend manually. Same helm controls; distances now in km.');telemetry();
  }
  function retrieve(){if(m.phase!=='flight'||m.recovered||m.target!=='beacon'||range()>.45||agl()>.45||s.speed>.15)return;
    m.recovered=true;m.target='ship';m.returnLeg=0;$('destination').value='ship';s.autopilot=false;s.throttle=0;
    say('Beacon secured aboard. Select Enterprise and engage a return course, or climb manually to the aft bay.');telemetry();}
  function dock(){if(m.phase!=='flight'||!m.recovered||m.target!=='ship'||m.y<=0||Math.abs(m.x)>.3||range()>.65||s.speed>.12||Math.abs(angle(s.heading,0))>15||Math.abs(s.pitch)>12)return;
    m.phase='docking';m.clock=0;m.bank=0;s.throttle=0;s.speed=0;s.autopilot=false;s.pitch=0;s.heading=0;
    say('Aft bay approach accepted. Landing guidance engaged.');telemetry();}
  function powerDown(){if(m.phase!=='landed')return;m.phase='powerdown';m.clock=0;s.throttle=0;s.speed=0;s.autopilot=false;say('Landing craft powering down. Transferring control to the bridge.');telemetry();}
  function reset(){Object.assign(m,{phase:'bridge',planet:null,departedPlanet:null,recovered:false,completed:false,clock:0});document.body.classList.remove('shuttle-mode');destinations(false);}
  function engage(){if(!active())return false;if(m.phase!=='flight')return true;s.autopilot=true;s.paused=false;s.throttle=65;say(`Local navigation engaged: ${m.target==='beacon'?'beacon recovery approach':'Enterprise aft bay'}.`);return true;}
  function tick(dt){
    if(m.phase==='orbit'){m.clock+=dt;return true;}
    if(!active())return false;
    m.clock+=dt;
    if(m.phase==='powerdown'&&m.clock>3){m.phase='orbit';m.completed=true;document.body.classList.remove('shuttle-mode');destinations(false);s.pitch=0;s.heading=90;s.throttle=0;s.autopilot=false;s.arrived=true;say('Away mission complete. Beacon recovered. Bridge has control; Enterprise remains in orbit.');return true;}
    if(m.phase==='docking'&&m.clock>4){m.phase='landed';say('Touchdown in the aft shuttle bay. Power down the landing craft to return to the bridge.');}
    if(m.phase!=='flight'){s.throttle=0;s.speed=0;return true;}
    const oldHeading=s.heading;
    const turn=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),tilt=(keys.has('ArrowDown')||keys.has('q')?1:0)-(keys.has('ArrowUp')||keys.has('e')?1:0);
    if(turn||tilt)s.autopilot=false;
    s.heading=wrap(s.heading+turn*42*dt);s.pitch=clamp(s.pitch+tilt*30*dt,-85,85);s.turn=turn;
    s.throttle=clamp(s.throttle+((keys.has('w')?1:0)-(keys.has('s')?1:0))*30*dt,0,100);
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
    s.turn=clamp(angle(oldHeading,s.heading)/(42*Math.max(dt,.001)),-1,1);m.bank=((m.bank||0)+(-s.turn*.23-(m.bank||0))*(1-Math.exp(-dt*4)));
    const d=Math.hypot(aim.x-m.x,aim.y-m.y,aim.z-m.z);
    s.speed=s.throttle/100*(m.z>12?8:m.z>2?2:.35);
    if(s.autopilot){s.speed=Math.min(s.speed,Math.max(0,d-(m.target==='beacon'?.22:.1))*.7);const hd=wrap(Math.atan2(aim.x-m.x,m.y-aim.y)/rad);s.speed*=Math.max(0,Math.cos(angle(s.heading,hd)*rad));}
    m.x+=Math.sin(s.heading*rad)*Math.cos(s.pitch*rad)*s.speed*dt;m.y-=Math.cos(s.heading*rad)*Math.cos(s.pitch*rad)*s.speed*dt;m.z=clamp(m.z+Math.sin(s.pitch*rad)*s.speed*dt,terrain(m.x,m.y)+.06,125);
    if(agl()<.065&&s.pitch<0){s.pitch=0;s.throttle=0;s.speed=0;s.autopilot=false;say('Terrain clearance protection: engines holding. Climb to continue.');}
    if(s.autopilot&&m.target==='beacon'&&range()<.3){s.autopilot=false;s.throttle=0;s.speed=0;s.pitch=0;say('Beacon within retrieval range. Press RETRIEVE BEACON.');}
    if(s.autopilot&&m.target==='ship'&&m.approach&&range()<.6){s.autopilot=false;s.throttle=0;s.speed=0;s.pitch=0;s.heading=0;say('Aligned with aft shuttle bay. Press LAND IN BAY.');}
    return true;
  }
  function updateUI(){
    const local=active();$('launch-craft').hidden=m.phase!=='orbit';$('leave-orbit').hidden=m.phase!=='orbit';$('launch-craft').textContent=m.completed?'LAUNCH ANOTHER SORTIE':'LAUNCH LANDING CRAFT';
    const mapMode=local?(m.target==='ship'||m.phase!=='flight'?'approach':'surface'):'galaxy';
    if(m.mapMode!==mapMode){m.mapMode=mapMode;const approach=mapMode==='approach',surface=mapMode==='surface';
      document.querySelector('.galaxy .display-title h2').lastChild.textContent=approach?' 3D SHUTTLE ATTITUDE':surface?' SURFACE NAVIGATION':' 3D GALAXY NAVIGATION';
      document.querySelector('.galaxy .display-title>span').textContent=approach?'AFT BAY GUIDANCE':surface?'LOCAL TERRAIN':'SPATIAL HOLOGRAM';
      document.querySelector('.galaxy .display-footer span:first-child').textContent=approach?'DRAG ORBIT · SCROLL ZOOM · ⌂ RESET':surface?'LOCAL SURFACE · NORTH UP':'DRAG ORBIT · CLICK PLOT · SCROLL ZOOM';
      document.querySelector('.galaxy .display-footer span:last-child').textContent=approach?'ATTITUDE / ALIGNMENT':surface?'RANGE 30 KM':'GRID 100 LY';
      $('map-view').setAttribute('aria-label',approach?'3D shuttle attitude and aft bay approach: drag to orbit, scroll to zoom':surface?'Local planetary terrain and navigation targets':'3D galaxy: drag to orbit, scroll to zoom, click a system to plot a course');
    }
    $('control-hints').textContent=local?'← → TURN · ↑ DIVE / ↓ CLIMB · W / S POWER · SPACE STOP · P PAUSE · R RESET · B AUDIO':'← → YAW · ↑ ↓ PITCH · W / S POWER · SPACE STOP · P PAUSE · R RESET · B AUDIO';
    $('mission-actions').hidden=!local;
    $('retrieve-beacon').hidden=m.recovered;$('retrieve-beacon').disabled=m.phase!=='flight'||m.target!=='beacon'||range()>.45||agl()>.45||s.speed>.15;
    $('land-bay').hidden=!m.recovered||m.phase!=='flight';$('land-bay').disabled=m.target!=='ship'||m.y<=0||Math.abs(m.x)>.3||range()>.65||s.speed>.12||Math.abs(angle(s.heading,0))>15||Math.abs(s.pitch)>12;
    $('power-down').hidden=m.phase!=='landed';
    $('retrieve-beacon').title='Within 450 m of beacon, below 450 m AGL, speed at most 150 m/s.';
    $('land-bay').title='Within 650 m of aft bay, speed at most 120 m/s, heading 000° ±15°, pitch within ±12°.';
    $('mission-status').textContent=local?`${m.phase==='flight'?(m.z>65?'UPPER ATMOSPHERE':m.z>4?'CLOUD LAYER':'LOWER ATMOSPHERE'):m.phase.toUpperCase()} · ${m.recovered?'BEACON SECURED':'RECOVER ABANDONED BEACON'} · ALT ${m.z.toFixed(2)} KM · AGL ${agl().toFixed(2)} KM`:m.phase==='orbit'?`STANDARD ORBIT · ${m.planet.name.toUpperCase()}${m.completed?' · MISSION COMPLETE':''}`:'APPROACH WITHIN 1 LY TO ENTER ORBIT';
    $('warp').disabled=local;
    if(m.phase==='orbit'){$('view-label').textContent=m.planet.name.toUpperCase()+' · STANDARD ORBIT';$('drive-label').textContent='ORBITAL STATION KEEPING';}
    if(!local)return;
    $('mission-hint').textContent=m.phase==='landed'?'Power down the craft to transfer to the bridge.':m.phase==='flight'?m.recovered?'AFT BAY: ≤650 m · ≤120 m/s · heading 000° ±15° · level ±12°':'RETRIEVE: ≤450 m range · ≤450 m AGL · ≤150 m/s. Engage course for a guided approach.':'Landing systems engaged.';
    $('view-label').textContent='LANDING CRAFT · '+m.planet.name.toUpperCase();$('drive-label').textContent=s.paused?'SIMULATION PAUSED':m.phase==='powerdown'?'POWERING DOWN':'ATMOSPHERIC FLIGHT';
    $('distance').textContent=range().toFixed(2)+' KM';$('target-bearing').textContent=bearing().toFixed(0).padStart(3,'0')+'°';$('target-pitch').textContent=elevation().toFixed(0)+'°';$('target-elevation').textContent=(target().z-m.z).toFixed(2)+' KM';$('factor').textContent=(s.speed*1000).toFixed(0)+' m/s';$('engine-name').textContent='LANDING CRAFT THRUST';$('eta').textContent=s.throttle?Math.ceil(range()/Math.max(.001,s.speed))+' SEC':'HOLDING';$('nav-state').textContent=s.autopilot?'LOCAL TRACK':'LOCAL NAV';
  }
  $('launch-craft').onclick=launch;$('leave-orbit').onclick=leaveOrbit;$('retrieve-beacon').onclick=retrieve;$('land-bay').onclick=dock;$('power-down').onclick=powerDown;
  $('destination').addEventListener('change',()=>{if(active()){m.target=$('destination').value;s.autopilot=false;say('Local target selected. Engage course or use manual helm.');telemetry();}});

  // Perspective terrain is built from a continuous multi-frequency height field.
  function render(scene,w,h){
    if(m.phase==='bridge')return false;
    if(!scene.awayTexture){scene.awayTexture=scene.textures.createCanvas('away-optical',w,h);scene.awayImage=scene.add.image(0,0,'away-optical').setOrigin(0).setDepth(20);}
    const tex=scene.awayTexture;if(tex.width!==w||tex.height!==h)tex.setSize(w,h);scene.awayImage.setVisible(true);const c=tex.getContext();c.clearRect(0,0,w,h);c.lineWidth=1;
    const orbiting=m.phase==='orbit',alt=orbiting?110:m.z;
    const tint=[(m.planet.color>>16)&255,(m.planet.color>>8)&255,m.planet.color&255];
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,alt>65?'#01050e':`rgb(${tint.map(v=>Math.round(v*.22+10)).join(',')})`);sky.addColorStop(1,alt>65?'#163358':`rgb(${tint.map(v=>Math.round(v*.5+100)).join(',')})`);c.fillStyle=sky;c.fillRect(0,0,w,h);
    if(alt>60){for(let i=0;i<180;i++){const x=((Math.sin(i*81.17)*43758)%1+1)%1*w,y=((Math.cos(i*37.7)*2342)%1+1)%1*h;c.fillStyle='#d2e7ff';c.fillRect(x,y,i%7===0?1.5:.7,1);}}
    if(orbiting||alt>12){
      scene.detailedPlanet??=createDetailedPlanet();
      scene.detailedPlanet.draw(c,w,h,m.clock,m.planet.color,s.pitch);
    }
    const heading=s.heading*rad,pitch=s.pitch*rad,scale=w*.65;
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
    if(!orbiting&&alt>95){
      // Exterior silhouette: saucer, paired nacelles and an illuminated aft bay.
      const p=project(0,-3,110),near=Math.hypot(m.x,m.y,m.z-110);
      if(p&&near<30){const k=scale/p.d;
        c.fillStyle='#71889b';c.beginPath();c.ellipse(p.x,p.y-.26*k,.85*k,.18*k,0,0,Math.PI*2);c.fill();c.fillStyle='#a3b4c0';c.fillRect(p.x-.16*k,p.y-.22*k,.32*k,.5*k);
        for(const side of [-1,1]){c.strokeStyle='#788e9e';c.lineWidth=.055*k;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+side*.65*k,p.y-.08*k);c.stroke();c.fillStyle='#b6c4cd';c.fillRect(p.x+side*.65*k-.07*k,p.y-.4*k,.14*k,.65*k);c.fillStyle='#60bdff';c.fillRect(p.x+side*.65*k-.035*k,p.y-.35*k,.07*k,.48*k);}
        c.fillStyle='#bfced6';c.beginPath();c.ellipse(p.x,p.y+.14*k,.23*k,.19*k,0,0,Math.PI*2);c.fill();c.fillStyle='#090e14';c.beginPath();c.ellipse(p.x,p.y+.14*k,.18*k,.14*k,0,Math.PI,Math.PI*2);c.lineTo(p.x+.18*k,p.y+.25*k);c.lineTo(p.x-.18*k,p.y+.25*k);c.fill();c.strokeStyle='#f6d16d';c.lineWidth=Math.max(1,.008*k);for(const side of [-1,1]){c.beginPath();c.moveTo(p.x+side*.06*k,p.y+.24*k);c.lineTo(p.x+side*.02*k,p.y+.12*k);c.stroke();}c.fillStyle='#ff6170';c.fillRect(p.x-.13*k,p.y-.035*k,.26*k,.025*k);
      }
    }
    if(!orbiting&&alt>4&&alt<65){const density=Math.sin((alt-4)/61*Math.PI);c.fillStyle=`rgba(235,232,226,${density*.3})`;c.fillRect(0,0,w,h);for(let i=0;i<17;i++){const x=((i*.19+m.clock*.025)%1.3-.15)*w,y=h*(.5+.6*Math.sin(i*2.3)),radius=w*.32;c.save();c.translate(x,y);c.scale(1,.12);const cloud=c.createRadialGradient(0,0,0,0,0,radius);cloud.addColorStop(0,`rgba(248,246,240,${density*.42})`);cloud.addColorStop(1,'#ffffff00');c.fillStyle=cloud;c.fillRect(-radius,-radius,radius*2,radius*2);c.restore();}}
    if(!orbiting){
      const p=project(target().x,target().y,target().z);c.strokeStyle='#79d6ff';c.fillStyle='#b5e9ff';c.font='12px Consolas';if(p&&p.x>25&&p.x<w-25&&p.y>35&&p.y<h-30){c.strokeRect(p.x-14,p.y-14,28,28);c.fillText(`${m.target==='beacon'?'BEACON':'AFT BAY'} ${range().toFixed(2)} KM`,clamp(p.x+20,10,w-180),clamp(p.y,50,h-40));}
      c.lineWidth=1;c.strokeStyle='#9adbff90';c.beginPath();c.moveTo(w/2-25,h/2);c.lineTo(w/2-8,h/2);c.moveTo(w/2+8,h/2);c.lineTo(w/2+25,h/2);c.stroke();c.fillStyle='#b5e9ff';c.fillText(`ALT ${m.z.toFixed(2)} KM  /  AGL ${agl().toFixed(2)} KM  /  ${(s.speed*1000).toFixed(0)} M/S`,18,h-18);
      if(['docking','landed','powerdown'].includes(m.phase)){
        c.fillStyle='#101c29';c.fillRect(0,0,w,h);c.fillStyle='#526476';c.beginPath();c.moveTo(0,h);c.lineTo(w*.36,h*.35);c.lineTo(w*.64,h*.35);c.lineTo(w,h);c.fill();
        for(let i=0;i<7;i++){const inset=i*23;c.strokeStyle='#a6bdcd';c.lineWidth=5;c.strokeRect(inset,inset,w-inset*2,h-inset*1.5);}
        c.strokeStyle='#f1d06d';c.lineWidth=3;for(const side of [-1,1]){c.beginPath();c.moveTo(w/2+side*w*.13,h);c.lineTo(w/2+side*12,h*.36);c.stroke();}c.fillStyle='#bde8ff';c.textAlign='center';c.fillText(m.phase==='docking'?'AFT BAY · LANDING GUIDANCE':m.phase==='landed'?'TOUCHDOWN · POWER DOWN TO RETURN TO BRIDGE':'SYSTEMS SHUTTING DOWN · BRIDGE TRANSFER',w/2,h*.23);c.textAlign='left';if(m.phase==='powerdown'){c.fillStyle=`rgba(0,0,0,${clamp(m.clock/3,0,1)})`;c.fillRect(0,0,w,h);}
      }
    }
    tex.refresh();return true;
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
    for(const [id,p,label] of [['beacon',beacon,m.recovered?'RECOVERED':'BEACON'],['ship',ship,'ENTERPRISE / AFT BAY']]){const dx=(p.x-m.x)*scale,dy=(p.y-m.y)*scale,ratio=Math.min(1,(Math.min(w,h)*.4)/Math.max(1,Math.hypot(dx,dy))),x=cx+dx*ratio,y=cy+dy*ratio;c.strokeStyle=id===m.target?'#9adfff':'#4d789b';c.strokeRect(x-5,y-5,10,10);c.fillStyle=c.strokeStyle;c.fillText(label,clamp(x+9,8,w-165),clamp(y+15,40,h-40));c.fillText(`ALT ${p.z.toFixed(2)} KM`,clamp(x+9,8,w-165),clamp(y+29,54,h-26));}
    c.save();c.translate(cx,cy);c.rotate(s.heading*rad);c.fillStyle='#94e1ff';c.beginPath();c.moveTo(0,-10);c.lineTo(-6,7);c.lineTo(0,3);c.lineTo(6,7);c.fill();c.restore();tex.refresh();return true;
  }
  return {state:m,active,tick,updateUI,render,renderNav,orbit,launch,retrieve,dock,powerDown,reset,engage,terrain,range};
};
