/* ST Command — three Phaser displays sharing one navigation state. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const systems = [
    {id:'sol',name:'Sol / Earth',x:430,y:580,color:0x83c8ff,type:'FEDERATION HOMEWORLD'},
    {id:'vulcan',name:'Vulcan',x:545,y:484,color:0xf7ac79,type:'FEDERATION MEMBER'},
    {id:'andoria',name:'Andoria',x:358,y:390,color:0x97e6ee,type:'FEDERATION MEMBER'},
    {id:'risa',name:'Risa',x:270,y:650,color:0xe8cf91,type:'FEDERATION MEMBER'},
    {id:'ds9',name:'Deep Space Nine',x:165,y:340,color:0xf1bd79,type:'FEDERATION OUTPOST'},
    {id:'bajor',name:'Bajor',x:125,y:295,color:0xd0a4e5,type:'BAJORAN SYSTEM'},
    {id:'betazed',name:'Betazed',x:615,y:300,color:0xbba1e7,type:'FEDERATION MEMBER'},
    {id:'deneb',name:'Deneb IV',x:735,y:620,color:0x95d6c1,type:'FEDERATION MEMBER'},
    {id:'qonos',name:"Qo’noS",x:805,y:355,color:0xd88a78,type:'KLINGON HOMEWORLD'},
    {id:'romulus',name:'Romulus',x:765,y:120,color:0xa9c28b,type:'ROMULAN HOMEWORLD'},
    {id:'starbase',name:'Starbase 74',x:465,y:760,color:0x83d5ec,type:'FEDERATION OUTPOST'}
  ];
  systems.forEach((system,i)=>system.z=[0,75,-65,35,110,135,-125,-80,55,165,-100][i]);
  const state = {x:430,y:580,z:0,pitch:0,pitchTurn:0,heading:90,throttle:14,drive:'impulse',speed:.56,paused:false,autopilot:false,target:systems[1],trail:[],distance:0,time:0,turn:0,arrived:false};
  const keys = new Set();
  let lastTelemetry = 0, trailTimer = 0;
  const games = [];
  const wrap = a => (a % 360 + 360) % 360;
  const deltaAngle = (a,b) => ((b-a+540)%360)-180;
  const distanceTo = p => SpaceMath.distance(state,p);
  const pitchTo = p => SpaceMath.pitchTo(state,p);
  const bearingTo = p => wrap(Math.atan2(p.x-state.x,state.y-p.y)/RAD);
  const powerFloor = () => away.state.phase==='orbit'?0:-100;
  const say = text => {$('message').textContent=text;};
  function manual(message){state.autopilot=false;state.arrived=false;if(message)say(message);}
  function selectTarget(target){if(away.active())return;if(away.state.phase==='orbit'){away.state.phase='bridge';state.arrived=false;}state.target=target;state.arrived=false;state.autopilot=false;$('destination').value=target.id||'waypoint';say(`Course plotted: ${target.name}. Engage when ready.`);telemetry();}
  function stop(){state.throttle=0;state.speed=0;manual('All stop. Engines holding position.');telemetry();}
  function pause(){state.paused=!state.paused;keys.clear();say(state.paused?'Simulation paused. Press P or Enter to continue.':'Simulation resumed. Conn has control.');telemetry();}
  function engage(){
    if(away.engage()){telemetry();return;}
    if(away.state.phase==='orbit'){say('Press Leave Orbit to return to galaxy navigation, or launch the landing craft.');return;}
    if(distanceTo(state.target)<(state.target.type?.includes('OUTPOST')||state.target.id==='waypoint'?3:.05)){say(`Already at ${state.target.name}. Select another destination.`);return;}
    state.autopilot=true;state.arrived=false;state.paused=false;
    if(state.throttle<=0)state.throttle=65;
    say(`Navigation engaged. Setting course for ${state.target.name}.`);telemetry();
  }
  function reset(){away.reset();lastTelemetry=0;trailTimer=0;Object.assign(state,{x:430,y:580,z:0,pitch:0,pitchTurn:0,heading:90,throttle:14,drive:'impulse',speed:.56,paused:false,autopilot:false,target:systems[1],trail:[],distance:0,time:0,turn:0,arrived:false});keys.clear();$('destination').value='vulcan';$('waypoint-option')?.remove();say('Simulation reset. Enterprise is at Sol at 14% impulse power. Conn ready.');telemetry();}
  function tick(dt){
    if(state.paused){state.turn=0;state.pitchTurn=0;return;}
    state.time+=dt;
    if(away.tick(dt)){telemetry();return;}
    let turn=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
    if(turn){manual();state.heading=wrap(state.heading+turn*42*dt);}
    const oldPitch=state.pitch;
    const tilt=(keys.has('ArrowUp')||keys.has('q')?1:0)-(keys.has('ArrowDown')||keys.has('e')?1:0);
    if(tilt){manual();state.pitch=Phaser.Math.Clamp(state.pitch+tilt*30*dt,-85,85);}
    const power=(keys.has('w')?1:0)-(keys.has('s')?1:0);
    if(power){state.throttle=Math.max(-100,Math.min(100,state.throttle+power*30*dt));if(state.throttle<0)manual();}
    if(state.autopilot){const diff=deltaAngle(state.heading,bearingTo(state.target));const step=Math.min(Math.abs(diff),48*dt)*Math.sign(diff);state.heading=wrap(state.heading+step);turn=step/(48*dt||1);const pitchDiff=pitchTo(state.target)-state.pitch;state.pitch+=Math.sign(pitchDiff)*Math.min(Math.abs(pitchDiff),30*dt);}
    state.turn=turn;
    state.pitchTurn=(state.pitch-oldPitch)/Math.max(dt,.001)/30;
    state.speed=SpaceMath.poweredSpeed(state.speed,state.throttle,state.drive==='warp'?56:4,dt);
    if(state.autopilot){
      state.speed*=Math.max(0,SpaceMath.alignment(state.heading,state.pitch,bearingTo(state.target),pitchTo(state.target)));
      state.speed=Math.min(state.speed,Math.max(0,distanceTo(state.target)-(state.target.type?.includes('OUTPOST')||state.target.id==='waypoint'?1.5:.5))/dt);
    }
    const old={x:state.x,y:state.y,z:state.z},vector=SpaceMath.direction(state.heading,state.pitch);
    state.x=Math.max(15,Math.min(985,state.x+vector.x*state.speed*dt));
    state.y=Math.max(15,Math.min(885,state.y+vector.y*state.speed*dt));
    state.z=Math.max(-240,Math.min(240,state.z+vector.z*state.speed*dt));
    state.distance+=SpaceMath.distance(old,state);
    if((state.x===15||state.x===985||state.y===15||state.y===885||Math.abs(state.z)===240)&&state.throttle!==0){stop();say('Sector boundary reached. Set a new heading or pitch to continue.');}
    if(state.autopilot&&(state.target.type?.includes('OUTPOST')||state.target.id==='waypoint')&&distanceTo(state.target)<=3){state.autopilot=false;state.throttle=0;state.speed=0;state.arrived=true;say(`Arrived at ${state.target.name}. All stop. Awaiting your orders.`);}
    if(away.state.departedPlanet&&distanceTo(away.state.departedPlanet)>=1)away.state.departedPlanet=null;
    if(away.state.phase==='bridge'){const planet=systems.find(p=>p.id!==away.state.departedPlanet?.id&&!p.type.includes('OUTPOST')&&distanceTo(p)<1&&(p.id===state.target.id||SpaceMath.distance(old,p)>=1));if(planet){away.orbit(planet);telemetry();return;}}
    trailTimer+=dt;
    if(trailTimer>.35){trailTimer=0;if(!state.trail.length||SpaceMath.distance(state,state.trail.at(-1))>.4){state.trail.push({x:state.x,y:state.y,z:state.z});if(state.trail.length>240)state.trail.shift();}}
    if(state.time-lastTelemetry>.09){lastTelemetry=state.time;telemetry();}
  }
  function telemetry(){
    window.STCommandAudio?.setSimulationPaused(state.paused);
    const dist=distanceTo(state.target),bearing=bearingTo(state.target),speed=state.paused?0:state.speed;
    $('heading-output').textContent=Math.round(state.heading).toString().padStart(3,'0')+'°';
    $('heading').value=Math.round(state.heading);$('compass-needle').style.transform=`rotate(${state.heading}deg)`;
    $('pitch').value=Math.round(state.pitch);$('pitch-output').textContent=(state.pitch>=0?'+':'')+state.pitch.toFixed(0)+'°';
    $('attitude-horizon').style.transform=`translateY(${state.pitch*.55}px) rotate(${-state.turn*12}deg)`;
    $('throttle').value=state.throttle;$('throttle-output').textContent=Math.round(state.throttle)+'%';
    $('power-dial').style.setProperty('--power',(Math.abs(state.throttle)*.82)+'%');$('power-dial-value').textContent=Math.round(state.throttle)+'%';$('power-dial-mode').textContent=(state.throttle<0?'REV ':'')+state.drive.toUpperCase();
    $('target-bearing').textContent=bearing.toFixed(0).padStart(3,'0')+'°';$('target-pitch').textContent=(pitchTo(state.target)>=0?'+':'')+pitchTo(state.target).toFixed(0)+'°';
    $('target-elevation').textContent=(state.target.z>=0?'+':'')+state.target.z.toFixed(0)+' LY';$('flight-mode').textContent=state.autopilot?'AUTO NAV':'MANUAL';
    $('drive-label').textContent=(state.paused?'SIMULATION PAUSED':state.throttle<0&&state.speed>=0?'BRAKING FOR REVERSE':state.speed<0?'REVERSE THRUST':state.drive==='warp'?'WARP FIELD ACTIVE':'IMPULSE DRIVE');
    $('engine-name').textContent=state.drive==='warp'?'WARP FIELD GENERATOR':'SUBLIGHT MANEUVERING';
    $('factor').textContent=state.drive==='warp'?(state.speed<0?'REV W ':'W ')+(1+Math.abs(state.speed)/56*8).toFixed(1):(state.speed/4).toFixed(2)+' c';
    $('impulse').classList.toggle('selected',state.drive==='impulse');$('warp').classList.toggle('selected',state.drive==='warp');
    $('impulse').setAttribute('aria-pressed',state.drive==='impulse');$('warp').setAttribute('aria-pressed',state.drive==='warp');
    $('distance').textContent=dist.toFixed(1)+' LY';
    const eta=dist/Math.max(.001,speed);
    $('eta').textContent=state.paused?'PAUSED':state.throttle===0?'HOLDING':state.throttle<0&&state.speed>=0?'BRAKING':state.speed<0?'REVERSING':eta>3600?'> 1 HOUR':eta>=60?`${Math.floor(eta/60)}m ${Math.floor(eta%60)}s`:`${Math.ceil(eta)} SEC`;
    $('nav-state').textContent=state.autopilot?'TRACKING':state.arrived?'ARRIVED':'STANDBY';
    $('engage').disabled=state.autopilot;
    const closest=systems.reduce((a,b)=>distanceTo(a)<distanceTo(b)?a:b);
    $('view-label').textContent=distanceTo(closest)<35?closest.name.toUpperCase()+' SYSTEM':'DEEP SPACE / SECTOR '+Math.floor(state.x/100)+'–'+Math.floor(state.y/100);
    $('contact-count').textContent=systems.filter(p=>distanceTo(p)<120).length+' CONTACTS';
    away.updateUI();
  }
  const away=createAwayMission({state,systems,keys,say,telemetry});
  systems.forEach(p=>{const option=document.createElement('option');option.value=p.id;option.textContent=p.name;$('destination').append(option);});$('destination').value='vulcan';
  $('destination').addEventListener('change',()=>{const target=systems.find(p=>p.id===$('destination').value);if(target)selectTarget(target);});
  $('heading').addEventListener('input',event=>{manual('Manual helm control.');state.heading=+event.target.value;telemetry();});
  const setPitch=value=>{manual('Manual 3D helm control.');state.pitch=Phaser.Math.Clamp(value,-85,85);telemetry();};
  $('pitch').addEventListener('input',event=>setPitch(+event.target.value));
  $('climb').onclick=()=>setPitch(state.pitch+10);$('dive').onclick=()=>setPitch(state.pitch-10);$('level').onclick=()=>setPitch(0);
  const ball=$('attitude-ball');let ballDrag=null;
  ball.addEventListener('pointerdown',e=>{ballDrag={x:e.clientX,y:e.clientY,heading:state.heading,pitch:state.pitch};ball.setPointerCapture(e.pointerId);});
  ball.addEventListener('pointermove',e=>{if(!ballDrag)return;manual();state.heading=wrap(ballDrag.heading+(e.clientX-ballDrag.x)*1.2);state.pitch=Phaser.Math.Clamp(ballDrag.pitch-(e.clientY-ballDrag.y)*.8,-85,85);telemetry();});
  ball.addEventListener('pointerup',()=>{ballDrag=null;});ball.addEventListener('pointercancel',()=>{ballDrag=null;});
  $('throttle').addEventListener('input',event=>{state.throttle=Phaser.Math.Clamp(+event.target.value,powerFloor(),100);if(state.throttle<0)manual();telemetry();});
  const powerDial=$('power-dial');let powerDrag=null;
  powerDial.addEventListener('pointerdown',e=>{powerDrag={y:e.clientY,power:state.throttle};powerDial.setPointerCapture(e.pointerId);});
  powerDial.addEventListener('pointermove',e=>{if(!powerDrag)return;state.throttle=Phaser.Math.Clamp(powerDrag.power+(powerDrag.y-e.clientY)*.8,powerFloor(),100);if(state.throttle<0)manual();telemetry();});
  powerDial.addEventListener('pointerup',()=>{powerDrag=null;});powerDial.addEventListener('pointercancel',()=>{powerDrag=null;});
  $('port').onclick=()=>{manual('Coming to port, 15 degrees.');state.heading=wrap(state.heading-15);telemetry();};
  $('starboard').onclick=()=>{manual('Coming to starboard, 15 degrees.');state.heading=wrap(state.heading+15);telemetry();};
  ['impulse','warp'].forEach(drive=>$(drive).onclick=()=>{if(away.active()&&drive==='warp')return;state.drive=drive;say(drive==='warp'?'Warp drive selected. Set power or engage a course.':'Impulse drive selected. Precision helm control.');telemetry();});
  $('stop').onclick=stop;$('engage').onclick=engage;$('manual').onclick=()=>{manual('Autopilot disengaged. You have the conn.');telemetry();};
  const editable=el=>el&&['INPUT','SELECT','TEXTAREA'].includes(el.tagName);
  const enterpriseKeys=new Set(['Numpad1','Numpad2','Numpad3','Numpad5','Numpad7','Numpad4','Numpad8','Numpad0','NumpadDecimal','NumpadSubtract']);
  window.addEventListener('keydown',event=>{
    const key=event.key.length===1?event.key.toLowerCase():event.key;
    if(enterpriseKeys.has(event.code)&&away.state.freeSpace&&away.active()&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
      if(editable(event.target)&&!event.target.matches('.helm input[type="range"]'))return;
      event.preventDefault();if(event.code==='Numpad8')away.stopEnterprise();if(event.code==='NumpadSubtract'&&!event.repeat)away.neutralEnterprise();keys.add(event.code);return;
    }
    if(key==='1'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&(!editable(event.target)||event.target?.matches('.helm input[type="range"]'))){
      event.preventDefault();
      if(!event.repeat)away.state.targetSquareHidden=!away.state.targetSquareHidden;
      return;
    }
    const helmFlightKey=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','q','e','z','x',' ','p','r','Enter'].includes(key)&&event.target?.matches('.helm input[type="range"]');
    if(editable(event.target)&&!helmFlightKey)return;
    if(event.target?.tagName==='BUTTON'&&event.key==='Enter')return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','q','e','z','x',' ','p','r','Enter'].includes(key))event.preventDefault();
    if(!event.repeat){if(key===' ')stop();if(key==='p')pause();if(key==='r')reset();if(key==='Enter')state.paused?pause():engage();}
    keys.add(key);
  });
  window.addEventListener('keyup',e=>{if(enterpriseKeys.has(e.code)&&(keys.has(e.code)||away.state.freeSpace&&away.active())){keys.delete(e.code);return;}keys.delete(e.key.length===1?e.key.toLowerCase():e.key);});window.addEventListener('blur',()=>keys.clear());
  function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  const line=(g,x1,y1,x2,y2,color,alpha=1,width=1)=>{g.lineStyle(width,color,alpha);g.lineBetween(x1,y1,x2,y2);};
  function ship(g,x,y,angle,size=12){
    const c=Math.cos(angle),s=Math.sin(angle),pt=(a,b)=>({x:x+a*c-b*s,y:y+a*s+b*c});
    const a=pt(0,-size),b=pt(-size*.62,size*.7),d=pt(0,size*.3),e=pt(size*.62,size*.7);
    g.fillStyle(0xffb44f,1);g.fillPoints([a,b,d,e],true);g.lineStyle(1,0xffdda0,.9);g.strokePoints([a,b,d,e],true);
  }
  function planetTexture(scene,color){
    const key='planet-'+color;if(scene.textures.exists(key))return key;
    const texture=scene.textures.createCanvas(key,256,256),ctx=texture.getContext(),hex='#'+color.toString(16).padStart(6,'0');
    ctx.save();ctx.beginPath();ctx.arc(128,128,120,0,TAU);ctx.clip();
    const surface=ctx.createRadialGradient(79,69,4,145,142,155);surface.addColorStop(0,'#e9d9b9');surface.addColorStop(.25,hex);surface.addColorStop(.68,hex);surface.addColorStop(1,'#090808');ctx.fillStyle=surface;ctx.fillRect(0,0,256,256);
    const random=seeded(color);for(let n=0;n<44;n++){ctx.strokeStyle=n%2?'#f6dfb821':'#190d092b';ctx.lineWidth=1+random()*5;const y=random()*256;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(75,y-20,170,y+30,256,y+12);ctx.stroke();}
    const shadow=ctx.createLinearGradient(0,0,256,90);shadow.addColorStop(0,'#00000000');shadow.addColorStop(.35,'#00000000');shadow.addColorStop(.65,'#00000033');shadow.addColorStop(1,'#000000ef');ctx.fillStyle=shadow;ctx.fillRect(0,0,256,256);ctx.restore();texture.refresh();return key;
  }
  class ForwardScene extends Phaser.Scene{
    constructor(){super('Forward');}
    create(){this.g=this.add.graphics();this.planet=this.add.image(0,0,planetTexture(this,0xf7ac79)).setVisible(false);this.navigationGraphics=this.add.graphics().setDepth(2);const rand=seeded(1701);this.stars=Array.from({length:280},()=>({x:(rand()-.5)*2.8,y:(rand()-.5)*1.8,z:rand()*1.9+.1,t:rand()}));this.targetLabel=this.add.text(0,0,'',{fontFamily:'Consolas, monospace',fontSize:'10px',color:'#ecbc79',align:'center'}).setOrigin(.5,0).setDepth(3);this.caption=this.add.text(0,0,'',{fontFamily:'Consolas, monospace',fontSize:'9px',color:'#a77d48',align:'center'}).setOrigin(.5).setDepth(3);this.frameCounter=0;}
    update(time,delta){
      const dt=Math.min(delta/1000,.05);tick(dt);this.frameCounter++;
      EnterpriseChaseCamera.sync(away.state.phase);
      OrbitArrival.sync(away.state);
      if(away.render(this,this.scale.width,this.scale.height)){this.enterpriseChaseImage?.setVisible(false);this.planet.setVisible(false);this.targetLabel.setVisible(false);this.caption.setVisible(false);return;}
      this.awayImage?.setVisible(false);
      this.caption.setVisible(true);
      const w=this.scale.width,h=this.scale.height,cx=w/2,cy=h*.48;let g=this.g;g.clear();g.fillStyle(0x020403);g.fillRect(0,0,w,h);
      // Layered translucent circles give the distant nebula a soft, procedural glow.
      const drift=Math.sin(state.heading*RAD)*w*.12;
      for(let i=12;i>0;i--){g.fillStyle(0x413528,.009);g.fillEllipse(w*.76+drift,h*.37,w*.62*i/12,h*.85*i/12);g.fillStyle(0x263a35,.009);g.fillEllipse(w*.28+drift,h*.72,w*.68*i/12,h*.9*i/12);}
      const flow=state.speed/56;
      for(const star of this.stars){
        if(!state.paused){star.z-=dt*Math.sign(state.speed)*(.025+Math.abs(flow)*1.4)*(state.throttle?1:0);star.x-=state.turn*dt*.4;star.y+=state.pitchTurn*dt*.4;if(star.z<.08)star.z=2;if(star.z>2)star.z=.08;if(star.x< -1.5)star.x=1.5;if(star.x>1.5)star.x=-1.5;if(star.y< -1)star.y=1;if(star.y>1)star.y=-1;}
        const x=cx+star.x/star.z*w*.42,y=cy+star.y/star.z*h*.5;
        if(x<0||x>w||y<0||y>h)continue;
        const tail=state.drive==='warp'?1+flow*.17:1+flow*.04;
        if(Math.abs(flow)>.02)line(g,x,y,cx+(x-cx)*tail,cy+(y-cy)*tail,star.t>.65?0x88bfea:0xe3ecf9,Math.min(1,.3+.5/star.z),star.z<.35?1.7:.8);
        if(state.drive!=='warp'){g.fillStyle(star.t>.65?0x95bfe9:0xdce7f7,Math.min(1,.25+.45/star.z));g.fillCircle(x,y,Math.max(.5,1.25/star.z));}
      }
      // The selected system stays in the same bearing as the map and tactical marker.
      g=this.navigationGraphics;g.clear();
      const diff=deltaAngle(state.heading,bearingTo(state.target)),elevation=pitchTo(state.target)-state.pitch,dist=distanceTo(state.target),visible=Math.abs(diff)<62&&Math.abs(elevation)<46;
      const targetX=cx+diff/62*w*.46,targetY=cy-elevation/46*h*.4;
      if(visible){
        const radius=Math.max(3,Math.min(h*.24,900/(dist+12))),color=state.target.color||0xe8bd78;
        for(let i=4;i>0;i--){g.fillStyle(color,.025);g.fillCircle(targetX,targetY,radius+i*5);}
        this.planet.setTexture(planetTexture(this,color)).setPosition(targetX,targetY).setDisplaySize(radius*2.13,radius*2.13).setVisible(true).setAlpha(state.paused?.7:1);
        g.lineStyle(1,0xecbc79,.45);g.strokeCircle(targetX,targetY,radius+12);
        this.targetLabel.setPosition(targetX,targetY+radius+19).setText(state.target.name.toUpperCase()+'  /  '+dist.toFixed(1)+' LY').setVisible(true);
      }else{this.targetLabel.setVisible(false);this.planet.setVisible(false);}
      line(g,cx-18,cy,cx-7,cy,0xffb44f,.45);line(g,cx+7,cy,cx+18,cy,0xffb44f,.45);line(g,cx,cy-15,cx,cy-7,0xffb44f,.45);line(g,cx,cy+7,cx,cy+15,0xffb44f,.45);
      // A bearing ribbon acts as the navigator's horizon reference.
      for(let offset=-60;offset<=60;offset+=10){const heading=wrap(Math.round(state.heading/10)*10+offset);const diff=deltaAngle(state.heading,heading),x=cx+diff/62*w*.46;line(g,x,h-32,x,h-26,0x6d93aa,.6);}
      line(g,cx,h-40,cx-4,h-45,0xecbc79);line(g,cx,h-40,cx+4,h-45,0xecbc79);
      // Curved optical tracking rails follow the panoramic aperture.
      for(const bottom of [false,true]){
        g.lineStyle(1,0xad6129,.5);g.beginPath();
        for(let n=0;n<=60;n++){const x=w*n/60,bow=Math.sin(n/60*Math.PI)*13,y=bottom?h-24-bow:27+bow;if(n===0)g.moveTo(x,y);else g.lineTo(x,y);}g.strokePath();
        for(let n=1;n<30;n++){const x=w*n/30,bow=Math.sin(n/30*Math.PI)*13,y=bottom?h-24-bow:27+bow;line(g,x,y-2,x,y+2,n%5===0?0xdda351:0x55442c,.65);}
      }
      const direction=Math.abs(diff)>62?(diff<0?'PORT':'STARBOARD'):(elevation>0?'ABOVE':'BELOW');this.caption.setPosition(cx,h-14).setText(state.paused?'SIMULATION PAUSED':visible?`FORWARD SENSOR FEED · PITCH ${state.pitch.toFixed(0)}°`:`TARGET ${Math.abs(Math.abs(diff)>62?diff:elevation).toFixed(0)}° ${direction}`);
      if(state.paused){g.fillStyle(0x070c16,.38);g.fillRect(0,0,w,h);}
      EnterpriseChaseCamera.render(this,w,h,state);
    }
  }
  class TacticalScene extends Phaser.Scene{
    constructor(){super('Tactical');}
    create(){this.g=this.add.graphics();this.labels=systems.map(p=>this.add.text(0,0,p.name.toUpperCase(),{fontFamily:'Consolas, monospace',fontSize:'8px',color:'#c39b68'}).setOrigin(.5,0));this.rangeLabels=[40,80,120].map(n=>this.add.text(0,0,n+'',{fontFamily:'Consolas, monospace',fontSize:'8px',color:'#8e602b'}));this.label=this.add.text(0,0,'N',{fontFamily:'Consolas, monospace',fontSize:'9px',color:'#ecbc79'}).setOrigin(.5);this.shipLabel=this.add.text(0,0,'NCC-1701-D',{fontFamily:'Consolas, monospace',fontSize:'8px',color:'#ffb44f'}).setOrigin(.5);}
    update(){
      window.EnterpriseInset?.render(away.state,state);
      if(away.renderNav(this,this.scale.width,this.scale.height,'radar'))return;
      const w=this.scale.width,h=this.scale.height,cx=w/2,cy=h/2,r=Math.min(w*.39,h*.41),scale=r/120,g=this.g;g.clear();g.fillStyle(0x090603);g.fillRect(0,0,w,h);
      for(let n=1;n<=3;n++){g.lineStyle(1,0x583516,.8);g.strokeEllipse(cx,cy,r*n/3*2,r*n/3*1.24);this.rangeLabels[n-1].setPosition(cx+5,cy-r*n/3*.62+3);}
      line(g,cx-r-12,cy,cx+r+12,cy,0x583516,.7);line(g,cx,cy-r*.62-12,cx,cy+r*.62+12,0x583516,.7);
      for(let d=0;d<360;d+=30){const a=d*RAD;line(g,cx+Math.sin(a)*r,cy-Math.cos(a)*r*.62,cx+Math.sin(a)*(r+5),cy-Math.cos(a)*(r+5)*.62,0xa36a2c,.8);}
      this.label.setPosition(cx,cy-r*.62-18);
      const hdg=state.heading*RAD;
      const vector=SpaceMath.direction(state.heading,state.pitch),nose={x:cx+vector.x*r,y:cy+(vector.y*.62-vector.z*.65)*r};
      line(g,cx,cy,nose.x,nose.y,0xffb44f,.55);
      // North stays up; ship orientation matches both other views.
      systems.forEach((p,i)=>{const dist=distanceTo(p),x=cx+(p.x-state.x)*scale,baseY=cy+(p.y-state.y)*scale*.62,y=baseY-(p.z-state.z)*scale*.65;this.labels[i].setVisible(dist<116&&dist>6);if(dist<120&&dist>2){line(g,x,baseY,x,y,p.color,.5);g.fillStyle(p.color,.8);g.fillCircle(x,y,3);g.lineStyle(1,p.color,.4);g.strokeCircle(x,y,6);this.labels[i].setPosition(x,y+9).setText(p.name.toUpperCase()+` Z${p.z>=state.z?'+':''}${(p.z-state.z).toFixed(0)}`);}});
      const dist=distanceTo(state.target),ratio=Math.min(1,112/Math.max(.01,dist)),tx=cx+(state.target.x-state.x)*scale*ratio,ty=cy+((state.target.y-state.y)*.62-((state.target.z||0)-state.z)*.65)*scale*ratio;
      line(g,cx,cy,tx,ty,0xecbc79,.45);g.lineStyle(1.5,0xecbc79,.9);g.strokeRect(tx-6,ty-6,12,12);
      const sweep=state.time*.4;line(g,cx,cy,cx+Math.sin(sweep)*r,cy-Math.cos(sweep)*r*.62,0xeaa541,.14);
      ship(g,cx,cy,Math.atan2(nose.x-cx,cy-nose.y),11);this.shipLabel.setPosition(cx,cy+23).setText(`NCC-1701-D  /  Z ${state.z>=0?'+':''}${state.z.toFixed(0)}`);
    }
  }
  const MapScene=createGalaxyScene({state,systems,selectTarget,line});
  for(const [parent,Scene] of [['main-view',ForwardScene],['tactical-view',TacticalScene],['map-view',MapScene]]){
    const host=$(parent);
    const game=new Phaser.Game({type:Phaser.CANVAS,parent,width:host.clientWidth,height:host.clientHeight,backgroundColor:'#07101a',scene:Scene,render:{antialias:true},fps:{target:60},audio:{noAudio:true},banner:false});
    games.push(game);const observer=new ResizeObserver(()=>{if(game.isBooted&&game.canvas&&host.clientWidth&&host.clientHeight)game.scale.resize(host.clientWidth,host.clientHeight);});observer.observe(host);
  }
  // Readable state is available for inspection and smoke checks.
  window.STCommand={state,systems,games,away,selectTarget,engage,stop,pause,reset,tick};telemetry();
})();
