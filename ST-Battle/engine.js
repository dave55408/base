/* Standalone combat simulation. World axes: X starboard, Y up, -Z north. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Battle=factory();})(globalThis,()=>{
  const IMPULSE_SPEED_MULTIPLIER=1.5,MIN_IMPULSE_SPEED=15,PHASER_DURATION=1.4,MAX_BANK=40*Math.PI/180;
  // Heavy hulls take time to build thrust and shed speed, even after a new order.
  const FLIGHT_ACCELERATION=28,FLIGHT_BRAKING=32,FLIGHT_JERK=32;
  const RAD=Math.PI/180,clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
  const wrap=n=>(n%360+360)%360,delta=(a,b)=>((b-a+540)%360)-180;
  const arcs=['fore','starboard','aft','port','dorsal','ventral'];
  const systems=['engines','shields','weapons','sensors'];
  const Replay=typeof module==='object'&&module.exports?require('./replay.js'):globalThis.BattleReplay;
  const DESTRUCTION_DURATION=Replay?.DESTRUCTION_DURATION??5;
  const targets={hull:'Primary hull',engines:'Impulse engines',mainEngines:'Warp engines',bridge:'Bridge',shields:'Shield generators',weapons:'Weapons',sensors:'Sensors',reactor:'Reactor',...Object.fromEntries(arcs.map(a=>['shield-'+a,a[0].toUpperCase()+a.slice(1)+' shield']))};
  const weaponSpecs={phaser:{name:'Phaser',energy:28,reserve:3,maxRange:1500,optimal:[500,1000]},torpedo:{name:'Torpedo',energy:24,reserve:1.5,maxRange:1900,optimal:[300,700]}};
  const maneuvers={direct:{name:'Direct assault',description:'Line up a strafing run, fire while passing Yorktown, then come about for another pass.'},flank:{name:'Flanking attack',description:'Curve around the nearer side of Yorktown, then turn in to attack.'},port:{name:'Curving attack — to port',description:'Sweep to your port side before turning in to attack.'},starboard:{name:'Curving attack — to starboard',description:'Sweep to your starboard side before turning in to attack.'},above:{name:'Attack from above',description:'Climb above Yorktown, dive into the attack, then fly past before turning back.'},below:{name:'Attack from below',description:'Descend below Yorktown, climb into the attack, then fly past before re-engaging.'},behind:{name:'Attack from behind',description:'Sweep around Yorktown, get astern, then fire from behind.'},hide:{name:'Hide then direct assault',description:'Seek cover behind K7, wait six seconds, then attack.'},ram:{name:'Ram',description:'Attempt a high-speed collision. A solid impact causes massive damage to both ships.'},close:{name:'Close battle',description:'Match Yorktown\'s course and speed. Both ships can fire in any direction.'},chase:{name:'Chase',description:'Pursue Yorktown at maximum available speed, even after assigned attacks are spent.'},distance:{name:'Keep your distance',description:'Hold near your selected firing range and pull away when Yorktown closes in.'},flee:{name:'Flee and effect repairs',description:'Withdraw during your share of the turn. Divert power and repair the most damaged areas with available parts.'}};
  // Legacy route names remain readable in old recordings, but are not listed in the planner.
  for(const key of ['port','starboard'])Object.defineProperty(maneuvers,key,{enumerable:false});
  const DEFAULT_SALVO=Object.freeze({phaser:2,torpedo:1}),ATTACK_COUNT=3,MANEUVER_COUNT=2;
  const TURN={execution:30,planning:30,closing:5,directApproach:30,approach:12,attack:12,disengage:3,withdraw:30,review:30};
  const COMBO=Object.freeze({window:6,systemMultiplier:1.5});
  const ENEMY_PERSONALITIES=Object.freeze({
    aggressive:{name:'Aggressive',range:.82,retreatHull:18,styles:{press:6,flank:3,standoff:1},targets:{hull:5,weapons:2,engines:1}},
    flanker:{name:'Flanker',range:1,retreatHull:25,styles:{press:2,flank:6,standoff:2},targets:{hull:3,weapons:3,engines:2}},
    hunter:{name:'Engine hunter',range:.95,retreatHull:25,styles:{press:4,flank:5,standoff:1},targets:{hull:1,weapons:2,mainEngines:7}},
    cautious:{name:'Cautious',range:1.25,retreatHull:38,styles:{press:1,flank:3,standoff:6},targets:{hull:2,weapons:5,engines:3}}
  });
  const COMBAT_VARIATION=Object.freeze({damage:.1,failureChance:.12,failureDuration:4,failureCooldown:12});
  // Shared by both ships: shield management matters more than raw damage rolls.
  const VULNERABILITY=Object.freeze({exposedHull:1.5,penetratingHull:1.15,subsystems:1.2,shieldRecharge:.8});
  const PLANET={name:'Mars',x:-13000,y:-3000,z:-18000,radius:2800,atmosphere:60};
  const direction=s=>({x:Math.sin(s.heading*RAD)*Math.cos(s.pitch*RAD),y:Math.sin(s.pitch*RAD),z:-Math.cos(s.heading*RAD)*Math.cos(s.pitch*RAD)});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  const bearing=(a,b)=>wrap(Math.atan2(b.x-a.x,a.z-b.z)/RAD);
  const elevation=(a,b)=>Math.atan2(b.y-a.y,Math.hypot(b.x-a.x,b.z-a.z))/RAD;
  function angle(a,b){const d=direction(a),r=distance(a,b)||1;return Math.acos(clamp((d.x*(b.x-a.x)+d.y*(b.y-a.y)+d.z*(b.z-a.z))/r,-1,1))/RAD;}
  function facing(ship,source){
    const d=direction(ship),h=ship.heading*RAD,p=ship.pitch*RAD;
    const v={x:source.x-ship.x,y:source.y-ship.y,z:source.z-ship.z};
    const f=v.x*d.x+v.y*d.y+v.z*d.z,r=v.x*Math.cos(h)+v.z*Math.sin(h),u=-v.x*Math.sin(h)*Math.sin(p)+v.y*Math.cos(p)+v.z*Math.cos(h)*Math.sin(p);
    if(Math.abs(u)>Math.max(Math.abs(f),Math.abs(r)))return u>0?'dorsal':'ventral';
    if(Math.abs(f)>Math.abs(r))return f>0?'fore':'aft';return r>0?'starboard':'port';
  }
  // Compound oriented boxes follow the rendered model (scale 57, local Z offset 25).
  // Saucer strips preserve its round outline without filling the spaces beside the hull.
  const SHIP_CONTACT_SCALE=.81,SHIP_CONTACT_PARTS=[];
  for(let i=0;i<12;i++){
    const a=-.69+i*1.38/12,b=a+1.38/12,near=Math.min(Math.abs(a),Math.abs(b));
    SHIP_CONTACT_PARTS.push({part:'saucer',center:[0,.35,-1.12+(a+b)/2],half:[Math.sqrt(.69**2-near**2),.14,(b-a)/2]});
  }
  SHIP_CONTACT_PARTS.push(
    {part:'bridge',center:[0,.51,-1.12],half:[.18,.07,.18]},
    {part:'sensor dome',center:[0,.205,-1.12],half:[.22,.075,.22]},
    {part:'hull',center:[0,.02,-.15],half:[.16,.16,.625]},
    {part:'neck',center:[0,.235,-.54],half:[.04,.16,.245]}
  );
  for(const [side,sign] of [['port',-1],['starboard',1]]){
    SHIP_CONTACT_PARTS.push({part:'nacelle',side,center:[sign*.56,.53,.135],half:[.105,.105,.815]});
    for(let i=0;i<4;i++){
      const t=(i+.5)/4;
      SHIP_CONTACT_PARTS.push({part:'pylon',side,center:[sign*(.075+.475*t),.05+.46*t,-.05+.22*t],half:[.08,.075,.12]});
    }
  }
  const dot3=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  function shipCollisionShapes(ship){
    const h=ship.heading*RAD,p=(ship.pitch||0)*RAD,b=ship.bank||0,ch=Math.cos(h),sh=Math.sin(h),cp=Math.cos(p),sp=Math.sin(p),cb=Math.cos(b),sb=Math.sin(b);
    const axes=[{x:ch*cb-sh*sp*sb,y:cp*sb,z:sh*cb+ch*sp*sb},{x:-ch*sb-sh*sp*cb,y:cp*cb,z:-sh*sb+ch*sp*cb},{x:-sh*cp,y:-sp,z:ch*cp}];
    return SHIP_CONTACT_PARTS.filter(part=>!part.side||!ship.detachedNacelles?.[part.side]).map(part=>{
      const local=part.center.map(v=>v*57);local[2]+=25;
      const center={x:ship.x,y:ship.y,z:ship.z};
      for(let i=0;i<3;i++)for(const axis of ['x','y','z'])center[axis]+=axes[i][axis]*local[i]*SHIP_CONTACT_SCALE;
      const half=part.half.map(v=>(v*57+.4)*SHIP_CONTACT_SCALE),extent={};
      for(const axis of ['x','y','z'])extent[axis]=half.reduce((sum,h,i)=>sum+h*Math.abs(axes[i][axis]),0);
      return {part:part.part,side:part.side,center,axes,half,extent};
    });
  }
  function collisionAxes(aa,bb){
    const axes=[...aa[0].axes,...bb[0].axes];
    for(const u of aa[0].axes)for(const v of bb[0].axes){
      const n={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x},len=Math.hypot(n.x,n.y,n.z);
      if(len>1e-7)axes.push({x:n.x/len,y:n.y/len,z:n.z/len});
    }
    return axes;
  }
  function shipSeparation(a,b,normal){
    const aa=shipCollisionShapes(a),bb=shipCollisionShapes(b),axes=collisionAxes(aa,bb),intervals=[];
    // Exit the union of all component contacts so clearing one part cannot enter another.
    for(const u of aa)for(const v of bb){
      const delta={x:v.center.x-u.center.x,y:v.center.y-u.center.y,z:v.center.z-u.center.z};
      let enter=-Infinity,exit=Infinity;
      for(const n of axes){
        const radius=box=>box.half.reduce((sum,h,i)=>sum+h*Math.abs(dot3(box.axes[i],n)),0);
        const r=radius(u)+radius(v)+.02,d=dot3(delta,n),speed=dot3(normal,n);
        if(Math.abs(speed)<1e-8){if(Math.abs(d)>=r){exit=-Infinity;break;}continue;}
        const t1=(-r-d)/speed,t2=(r-d)/speed;
        enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
        if(enter>exit)break;
      }
      if(exit>=0&&enter<=exit)intervals.push([enter,exit]);
    }
    intervals.sort((u,v)=>u[0]-v[0]);let exit=0;
    for(const interval of intervals){if(interval[0]>exit)break;exit=Math.max(exit,interval[1]);}
    return exit+.02;
  }
  function shipContact(a,b,padding=0){
    if(distance(a,b)>260+padding)return null;
    const aa=shipCollisionShapes(a),bb=shipCollisionShapes(b),axes=collisionAxes(aa,bb);
    let deepest=null;
    for(const u of aa)for(const v of bb){
      const delta={x:v.center.x-u.center.x,y:v.center.y-u.center.y,z:v.center.z-u.center.z};
      if(['x','y','z'].some(axis=>Math.abs(delta[axis])>u.extent[axis]+v.extent[axis]+padding*2))continue;
      let depth=Infinity,normal=null;
      for(const n of axes){
        const r=box=>box.half.reduce((sum,h,i)=>sum+(h+padding/2)*Math.abs(dot3(box.axes[i],n)),0);
        const projection=dot3(delta,n),overlap=r(u)+r(v)-Math.abs(projection);
        if(overlap<=0){normal=null;break;}
        if(overlap<depth){depth=overlap;const sign=projection<0?-1:1;normal={x:n.x*sign,y:n.y*sign,z:n.z*sign};}
      }
      if(normal&&(!deepest||depth>deepest.depth))deepest={depth,normal,parts:[u.part,v.part],pos:{x:(u.center.x+v.center.x)/2,y:(u.center.y+v.center.y)/2,z:(u.center.z+v.center.z)/2}};
    }
    return deepest;
  }
  function ship(name,x,y,z,heading){return {name,x,y,z,heading,pitch:0,bank:0,turnRate:0,throttle:0,speed:MIN_IMPULSE_SPEED,hull:100,reactor:100,
    integrity:{engines:100,shields:100,weapons:100,sensors:100,bridge:100,mainEngines:100},power:{engines:24,shields:30,weapons:30,sensors:16},
    shields:Object.fromEntries(arcs.map(a=>[a,100])),bias:{fore:24,starboard:17,aft:16,port:17,dorsal:13,ventral:13},
    energyReserve:100,energyRate:0,capacitor:100,torpedoes:24,cooldown:{phaser:0,torpedo:0,scan:0},heat:0,lastHit:-100,repair:'sensors',repairBudget:30,phaserCombo:null,detachedNacelles:{port:false,starboard:false}};}
  function redistribute(map,key,value){
    const old=map[key];map[key]=clamp(value);const others=Object.keys(map).filter(k=>k!==key),total=others.reduce((s,k)=>s+map[k],0);
    for(const k of others)map[k]=(100-map[key])*(total?map[k]/total:1/others.length);
    return old!==map[key];
  }
  const targetingColor=(sim,visible)=>!sim.contact?'#a8b7c5':sim.lock&&sim.range<=1500?'#79f0a3':sim.lock||visible?'#ffad45':'#ff9c85';
  const K7_ROTATION_RATE=0; // Keep the rendered station and its collision volumes stationary.
  function makeK7(){
    const cargoArmLength=(246-38)/10;
    const station={cargo:{x:-(110+cargoArmLength+18),y:76,z:0,armStartY:76,armStart:-90,armEnd:-(110+cargoArmLength)},name:'K7',x:-430,y:-20,z:-430,radius:335,scale:1.4,parts:[],pods:[]};
    const add=(x,y,z,rx,ry,rz)=>station.parts.push({x:station.x+x,y:station.y+y,z:station.z+z,rx,ry,rz});
    add(0,76,0,110,20,110);add(0,129,0,33,44,33);add(0,192,0,4,24,4);
    add(0,0,0,39,25,39);add(0,45,0,18,31,18);add(0,-45,0,13,38,13);add(0,-100,0,47,26,47);
    add(station.cargo.x,station.cargo.y,0,19,36,19);
    for(let i=0;i<=4;i++)add(station.cargo.armStart+(station.cargo.armEnd-station.cargo.armStart)*i/4,station.cargo.armStartY,0,10,10,10);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3,x=Math.cos(a)*280,z=Math.sin(a)*280;station.pods.push({x,z});
      add(x,0,z,52,12,52);add(x,31,z,18,25,18);
      // Overlapping volumes follow each thin arm rather than filling the gaps between pods.
      for(let d=40;d<=240;d+=20)add(Math.cos(a)*d,0,Math.sin(a)*d,15,15,15);
    }
    station.radius*=station.scale;
    for(const part of station.parts){
      for(const axis of ['x','y','z'])part[axis]=station[axis]+(part[axis]-station[axis])*station.scale;
      for(const axis of ['rx','ry','rz'])part[axis]*=station.scale;
    }
    return station;
  }
  class Simulation{
    constructor(seed=97,{turnBased=true,randomStart=false,openingApproach=randomStart}={}){this.seed=seed;this.turnBased=turnBased;this.randomStart=randomStart;this.openingApproach=openingApproach;this.reset();}
    random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    get enemyPersonalityProfile(){return ENEMY_PERSONALITIES[this.enemyPersonality]||ENEMY_PERSONALITIES.flanker;}
    setEnemyPersonality(selection){
      if(this.result||!Object.hasOwn(ENEMY_PERSONALITIES,selection))return false;
      if(selection===this.enemyPersonality)return true;
      this.enemyPersonality=selection;
      this.enemyMind.nextTactic=-1;this.enemyMind.nextThink=0;this.enemyMind.appliedTactic=null;
      this.chooseEnemyTactics();
      if(this.running&&this.turnBased&&this.maneuvering&&!this.freeFlight)this.thinkEnemy();
      return true;
    }
    weightedChoice(entries){
      let roll=this.random()*entries.reduce((sum,[,weight])=>sum+weight,0);
      for(const [value,weight] of entries){roll-=weight;if(roll<0)return value;}
      return entries[entries.length-1][0];
    }
    chooseEnemyTactics(){
      const m=this.enemyMind;if(this.time<(m.nextTactic??-1))return;
      const profile=this.enemyPersonalityProfile,e=this.enemy;
      const styles=Object.entries(profile.styles).map(([style,weight])=>[style,weight*(style==='standoff'&&(e.capacitor<35||e.heat>70)?3:1)]);
      m.style=this.weightedChoice(styles);m.arcRoll=this.random();
      m.preferredTarget=this.enemyHasContact(true)?this.weightedChoice(Object.entries(profile.targets)):'hull';
      m.rangeScale=profile.range*({press:.9,flank:1,standoff:1.12}[m.style]);
      m.nextTactic=this.time+6+this.random()*4;
    }
    reset(){if(this.freeFlight)this.turnBased=this.combatTurnBased;this.freeFlight=false;this.lastReplay=null;this.replayRecording=null;this.station=makeK7();this.planet={...PLANET};this.lastPlanetWarning=-10;this.player=ship('Enterprise',0,0,150,0);this.enemy=ship('Yorktown',380,150,-1600,168);this.enemy.throttle=45;this.enemyRetreating=false;this.shipsTouching=false;this.enemyMind={nextThink:0,lastKnown:null,evadeUntil:0,threatId:null,waitingOrder:null,waitingSince:0};this.warpCharges=5;this.time=0;this.running=false;this.result=null;this.events=[];this.log=[];this.projectiles=[];this.target='hull';this.environment='nebula';this.scanUntil=0;this.aiShot=6;this.aiTorp=11;this.hits=0;this.shots=0;this.resetBattleStats();this.initTurns();if(this.randomStart)this.randomizeStartingPositions();this.enemyPersonality=this.weightedChoice(Object.keys(ENEMY_PERSONALITIES).map(key=>[key,1]));this.message('COMMAND','Yorktown is hunting you. All stations, stand by.');}
    resetBattleStats(){
      this.captainEnabled=false;this.captainStatus='';this.playerMind={nextThink:0,lastKnown:null,arc:null,order:null,waitingSince:0,failedRoutes:{}};
      this.difficulty??='captain';this.battleStats={score:0,chain:0,bestChain:0,lastScoredAt:-Infinity,optimalHits:0,victoryBonus:0};
      this.challenge=['hull','accuracy','speed'][Math.abs(this.seed)%3];
    }
    get difficultyProfile(){return ({cadet:{name:'Cadet',enemyDamage:.7,scoreMultiplier:.8},captain:{name:'Captain',enemyDamage:1,scoreMultiplier:1},admiral:{name:'Admiral',enemyDamage:1.25,scoreMultiplier:1.4}})[this.difficulty]||{name:'Captain',enemyDamage:1,scoreMultiplier:1};}
    setDifficulty(level){
      if(!['cadet','captain','admiral'].includes(level)||this.running||this.time>0||this.result||this.freeFlight||this.turn.orders)return false;
      this.difficulty=level;return true;
    }
    get challengeDescription(){return ({hull:'Win with at least 50% hull.',accuracy:'Win with at least 80% accuracy.',speed:'Win in under 3 minutes.'})[this.challenge];}
    get accuracy(){return this.shots?Math.min(100,Math.round(this.hits/this.shots*100)):0;}
    get activeChain(){return this.time-this.battleStats.lastScoredAt<=8?this.battleStats.chain:0;}
    get challengeComplete(){return this.result==='victory'&&(this.challenge==='hull'?this.player.hull>=50:this.challenge==='accuracy'?this.accuracy>=80:this.time<180);}
    scoreHit(shieldDamage,hullDamage,weapon){
      const stats=this.battleStats;stats.chain=this.time-stats.lastScoredAt<=8?Math.min(5,stats.chain+1):1;stats.lastScoredAt=this.time;stats.bestChain=Math.max(stats.bestChain,stats.chain);
      const band=weaponSpecs[weapon]?.optimal,optimal=!!band&&this.range>=band[0]&&this.range<=band[1];if(optimal)stats.optimalHits++;
      const points=Math.round((25+shieldDamage*4+hullDamage*60)*(1+(stats.chain-1)*.25)*(optimal?1.15:1)*this.difficultyProfile.scoreMultiplier);
      stats.score+=points;return points;
    }
    completeBattleScore(){
      const stats=this.battleStats;if(this.result!=='victory'||stats.victoryBonus)return;
      stats.victoryBonus=Math.round((600+this.player.hull*10+this.accuracy*4+Math.max(0,180-this.time)*3+(this.challengeComplete?750:0))*this.difficultyProfile.scoreMultiplier);stats.score+=stats.victoryBonus;
    }
    get battleGrade(){
      if(this.result!=='victory')return 'D';
      const performance=this.accuracy*.45+this.player.hull*.4+Math.max(0,1-this.time/240)*15;
      return performance>=85?'S':performance>=70?'A':performance>=50?'B':'C';
    }
    message(station,text){this.log.unshift({time:this.time,station,text});this.log.length=Math.min(40,this.log.length);this.events.push({type:'message',station,text});}
    startFreeFlight(){
      this.combatTurnBased=this.turnBased;this.freeFlight=true;this.turnBased=false;
      this.freeFlightOrbit={radius:700,height:350,angle:Math.atan2(this.enemy.z-this.station.z,this.enemy.x-this.station.x)};
      this.enemy.speed=55;this.enemy.flightAcceleration=0;this.flyYorktownOrbit(0);
      this.projectiles=[];this.events=[];this.running=true;
      this.message('CONN','Free flight. Manual helm. R fires practice phasers; T launches practice torpedoes. No damage. Yorktown is cruising near K7.');
    }
    flyYorktownOrbit(dt){
      const e=this.enemy,k=this.station,o=this.freeFlightOrbit;o.angle+=e.speed/o.radius*dt;
      e.x=k.x+Math.cos(o.angle)*o.radius;e.z=k.z+Math.sin(o.angle)*o.radius;e.y=k.y+o.height;
      e.heading=wrap(180+o.angle/RAD);e.pitch=0;e.pitchRate=0;e.turnRate=e.speed/o.radius/RAD;
      e.bank+=(-.04-e.bank)*(1-Math.exp(-3*dt));
    }
    randomizeStartingPositions(){
      const k=this.station,p=this.player,e=this.enemy;
      const angle=this.random()*Math.PI*2,separation=(70+this.random()*15)*RAD*(this.random()<.5?-1:1);
      for(const [s,a] of [[p,angle],[e,angle+separation]]){
        const radius=(this.openingApproach?3400:1000)+this.random()*400;
        s.x=k.x+Math.cos(a)*radius;s.z=k.z+Math.sin(a)*radius;s.y=k.y-100+this.random()*350;
      }
      if(this.openingApproach){
        const center=(p.y+e.y)/2,side=p.y>=e.y?1:-1,gap=200+Math.min(60,Math.abs(p.y-e.y)*60/350);
        p.y=center+side*gap/2;e.y=center-side*gap/2;
      }
      p.heading=wrap(bearing(p,e)+(this.random()-.5)*20);p.pitch=elevation(p,e);
      e.heading=wrap(bearing(e,p)+(this.random()-.5)*40);e.pitch=elevation(e,p);
    }
    planetClearance(ship=this.player){return distance(ship,this.planet)-this.planet.radius-this.planet.atmosphere;}
    planetSpeedLimit(ship,desired){
      const planet=this.planet,d=direction(ship),sign=Math.sign(desired)||1;
      const x=planet.x-ship.x,y=planet.y-ship.y,z=planet.z-ship.z,along=(x*d.x+y*d.y+z*d.z)*sign,radius=planet.radius+planet.atmosphere+120;
      const side=x*x+y*y+z*z-along*along;if(along<=0||side>=radius*radius)return desired;
      const approach=along-Math.sqrt(Math.max(0,radius*radius-side));
      return sign*Math.min(Math.abs(desired),Math.max(MIN_IMPULSE_SPEED,Math.sqrt(2*FLIGHT_BRAKING*Math.max(0,approach-150))));
    }
    moveAroundPlanet(ship,previous){
      const k=this.planet,radius=k.radius+k.atmosphere+120,dx=ship.x-previous.x,dy=ship.y-previous.y,dz=ship.z-previous.z;
      const x=previous.x-k.x,y=previous.y-k.y,z=previous.z-k.z,a=dx*dx+dy*dy+dz*dz,b=2*(x*dx+y*dy+z*dz),c=x*x+y*y+z*z-radius*radius;
      const discriminant=b*b-4*a*c,t=a>0&&discriminant>=0?(-b-Math.sqrt(discriminant))/(2*a):-1;
      if(distance(ship,k)>=radius&&!(c>=0&&t>=0&&t<=1))return;
      const fraction=c>=0&&t>=0&&t<=1?t:1;
      let nx=x+dx*fraction,ny=y+dy*fraction,nz=z+dz*fraction,len=Math.hypot(nx,ny,nz);
      if(len<.001){nx=0;ny=1;nz=0;len=1;}nx/=len;ny/=len;nz/=len;
      Object.assign(ship,{x:k.x+nx*(radius+1),y:k.y+ny*(radius+1),z:k.z+nz*(radius+1)});
      const sign=Math.sign(ship.speed)||1,d=direction(ship),inward=Math.min(0,(d.x*nx+d.y*ny+d.z*nz)*sign);
      let tx=d.x*sign-inward*nx,ty=d.y*sign-inward*ny,tz=d.z*sign-inward*nz;
      if(Math.hypot(tx,ty,tz)<.1){tx=-nz;ty=0;tz=nx;if(Math.hypot(tx,tz)<.1)tx=1;}
      const ahead={x:(tx+nx*.15)*sign,y:(ty+ny*.15)*sign,z:(tz+nz*.15)*sign},origin={x:0,y:0,z:0};
      ship.heading=bearing(origin,ahead);ship.pitch=clamp(elevation(origin,ahead),-85,85);ship.turnRate=0;ship.pitchRate=0;ship.speed=sign*MIN_IMPULSE_SPEED;ship.flightAcceleration=0;
      if(ship===this.player){ship.throttle=0;if(this.time-(this.lastPlanetWarning??-10)>4){this.lastPlanetWarning=this.time;this.message('HELM','Cloud-top clearance reached. Deflecting to keep Enterprise above the atmosphere.');}}
    }
    nacelleSpeedFactor(ship){
      const lost=Object.values(ship.detachedNacelles||{}).filter(Boolean).length;
      return lost>=2?.12:lost===1?.45:1;
    }
    flightMobility(ship,minimum=.12,maximum=1.6){
      const hardware=.35+ship.integrity.mainEngines*.0065,factor=this.nacelleSpeedFactor(ship),output=this.output(ship,'engines');
      const intactOutput=output*hardware/Math.min(hardware,factor);
      return Math.max(.08,Math.min(clamp(output/24,minimum,maximum),clamp(intactOutput/24,minimum,maximum)*factor));
    }
    output(s,key){if((s.systemFailures?.[key]||0)>this.time)return 0;return s.power[key]*s.reactor/100*s.integrity[key]/100*(.5+s.integrity.bridge/200)*(key==='engines'?Math.min(.35+s.integrity.mainEngines*.0065,this.nacelleSpeedFactor(s)):1);}
    initTurns(){
      if(this.openingApproach&&!this.randomStart){this.player.x=this.enemy.x=2000;this.player.y=-120;this.enemy.y=120;this.enemy.z=-4000;this.player.pitch=elevation(this.player,this.enemy);this.enemy.heading=bearing(this.enemy,this.player);this.enemy.pitch=elevation(this.enemy,this.player);}
      this.turn={number:1,phase:'planning',remaining:TURN.planning,elapsed:0,revisions:2,
        draft:Array(ATTACK_COUNT).fill(null),draftManeuvers:Array(MANEUVER_COUNT).fill(null),draftManeuver:null,maneuvers:null,stageIndex:0,maneuver:null,navigation:null,orders:null,enemyOrders:null,spent:{player:{phaser:0,torpedo:0},enemy:{phaser:0,torpedo:0}},offArcSpent:{player:false,enemy:false},baseline:null,report:null};
    }
    get maneuvering(){return !this.turnBased||!['planning','review'].includes(this.turn.phase);}
    drawEnergy(s,amount){s.energyReserve=clamp(s.energyReserve-Math.max(0,amount));}
    updateEnergy(s,dt,capacitorGain=0,shieldGain=0,repairGain=0){
      // Reactor health and remaining warp nacelles limit generation; damaged conduits leak energy.
      const generation=1.8*(.25+.75*s.reactor/100)*this.nacelleSpeedFactor(s);
      const propulsion=s.coastingTurn?0:.65*clamp(Math.abs(s.speed)/190,0,2)*(s.power.engines/24);
      const leakage=(100-s.hull)*.012+(100-s.reactor)*.006;
      const demand=.2+propulsion+this.output(s,'sensors')*.003+leakage;
      const replenishment=capacitorGain*.12+shieldGain*.08+repairGain*.5;
      s.energyRate=generation-demand-(dt>0?replenishment/dt:0);
      s.energyReserve=clamp(s.energyReserve+s.energyRate*dt);
    }
    snapshot(){return [this.player,this.enemy].map(s=>({hull:s.hull,shields:{...s.shields},integrity:{...s.integrity},reactor:s.reactor}));}
    setPhase(phase){const t=this.turn,remaining=t.phase==='approach'&&phase==='attack'?t.remaining:['approach','attack','withdraw'].includes(phase)?t.stageDuration??TURN[phase]:TURN[phase];t.phase=phase;t.remaining=remaining;t.elapsed=0;this.events.push({type:'phase',phase,pass:t.number});}
    applyPlanPreset(style){
      if(!this.turnBased||this.freeFlight||this.result||!['planning','review'].includes(this.turn.phase))return false;
      const presets={
        timid:{routes:['distance','flee'],shots:[['phaser','weapons',1400],['phaser','weapons',1200],['torpedo','engines',1600]]},
        disabling:{routes:['flank','behind'],shots:[['phaser','weapons',900],['phaser','weapons',800],['torpedo','engines',650]]},
        strong:{routes:['flank','distance'],shots:[['phaser','shields',1000],['phaser','weapons',1200],['torpedo','hull',1400]]},
        aggressive:{routes:['direct','flank'],shots:[['phaser','weapons',1000],['phaser','bridge',900],['torpedo','reactor',700]]},
        berserk:{routes:['direct','ram'],shots:[['phaser','weapons',500],['phaser','bridge',400],['torpedo','reactor',300]]}
      },preset=Object.hasOwn(presets,style)?presets[style]:null;if(!preset)return false;
      // Keep all three shots eligible across both offensive maneuvers. Wary
      // and Berserk fire during M1, leaving M2 for repairs or the ram.
      const attackRoutes=preset.routes.map((route,i)=>route!=='flee'&&route!=='ram'?i:-1).filter(i=>i>=0);
      const draft=preset.shots.map(([weapon,target,range])=>({weapon,target,range,maneuvers:[...attackRoutes]}));
      if(!this.planReady(draft,preset.routes))return false;
      Object.assign(this.turn,{draft,draftManeuvers:[...preset.routes],draftManeuver:preset.routes[0]});return true;
    }
    randomizePlan(){return this.bestGuessPlan();}
    randomMotionPlan(){
      if(!this.turnBased||this.freeFlight||this.result||!['planning','review'].includes(this.turn.phase))return false;
      const keys=Object.keys(maneuvers),route=keys[Math.min(keys.length-1,Math.floor(this.random()*keys.length))];
      const draft=route==='flee'?Array(ATTACK_COUNT).fill(null):['phaser','phaser',this.player.torpedoes>0?'torpedo':'phaser'].map(weapon=>({weapon,target:'hull',range:weapon==='torpedo'?700:1000,maneuvers:[0]}));
      Object.assign(this.turn,{draft,draftManeuvers:[route,null],draftManeuver:route});return true;
    }
    bestGuessPlan(){
      if(!this.turnBased||this.freeFlight||this.result||!['planning','review'].includes(this.turn.phase))return false;
      const p=this.player,seen=this.captainObservation(),repairable=p.repairBudget>0;
      const finishNow=seen.detailed&&seen.hull<=1&&seen.shields[facing(seen,p)]<25&&distance(p,seen)<=700&&angle(p,seen)<65&&p.torpedoes>0&&p.capacitor>=24&&p.cooldown.torpedo===0&&p.integrity.weapons>=10&&p.reactor>=25&&!this.stationTrace(p,seen);
      const emergency=!finishNow&&repairable&&(p.hull<32||p.integrity.weapons<10||p.integrity.engines<12||p.integrity.mainEngines<15||p.integrity.sensors<10||p.reactor<25);
      const noWeapons=p.integrity.weapons<10;
      if(emergency||noWeapons&&repairable){
        Object.assign(this.turn,{draft:Array(ATTACK_COUNT).fill(null),draftManeuvers:['flee',null],draftManeuver:'flee'});
        this.captainStatus=repairable?'Withdraw, recharge shields and repair the weakest essential system.':'Disengage: preserve Enterprise while weapons or hull are critical.';return true;
      }
      const arc=seen.detailed?this.captainAttackArc(seen):null;
      const candidates=['direct','flank','above','below','behind','hide'].map(route=>({route,score:this.captainRouteScore(route,seen,arc)})).sort((a,b)=>a.score-b.score);
      const first=noWeapons?'close':candidates[0].route,routes=[first,null],internal=this.captainInternalTarget(seen),breached=seen.detailed&&seen.shields[arc]<25;
      const phaseTarget=seen.detailed&&!breached?'shield-'+arc:internal;
      const fleeing=this.captainTargetEscaping(seen),longRange=fleeing&&p.integrity.engines<60;
      const cautious=p.hull<50||p.capacitor<35||p.heat>70;
      const phasers=[{weapon:'phaser',target:phaseTarget,range:longRange?1500:1000,maneuvers:[0]},
        {weapon:'phaser',target:phaseTarget,range:longRange?1500:cautious?1000:900,maneuvers:[0]}];
      const torpedo={weapon:'torpedo',target:internal,range:finishNow?700:longRange?1800:cautious?700:650,maneuvers:[0]};
      const bursts=Array.from({length:DEFAULT_SALVO.phaser},(_,i)=>({...phasers[i%phasers.length],maneuvers:[0]})),torpedoes=Array.from({length:DEFAULT_SALVO.torpedo},()=>({...torpedo,maneuvers:[0]}));
      const draft=breached&&p.torpedoes>0&&p.cooldown.torpedo<=2?[...torpedoes,...bursts]:[...bursts,...torpedoes];
      if(arc)for(const order of draft)order.attackArc=arc;
      if(!this.planReady(draft,routes))return false;
      Object.assign(this.turn,{draft,draftManeuvers:routes,draftManeuver:first});this.playerMind.arc=arc;
      this.captainStatus=noWeapons?'Weapons disabled. Holding close contact.':!seen.contact?'Restore sensors and close on the last known contact.':breached?'Exploit the '+arc+' breach; '+internal+' targeted.':'Open the '+(arc||'facing')+' shield, then hit '+internal+'.';return true;
    }
    captainObservation(){
      const p=this.player,m=this.playerMind;
      if(this.contact){
        const e=this.enemy,seen={x:e.x,y:e.y,z:e.z,heading:e.heading,pitch:e.pitch,speed:e.speed,contact:true,detailed:this.detailed,at:this.time};
        if(seen.detailed)Object.assign(seen,{hull:e.hull,shields:{...e.shields},integrity:{...e.integrity},reactor:e.reactor});
        m.lastKnown={...seen};return seen;
      }
      if(m.lastKnown){const known=m.lastKnown,d=direction(known),age=Math.min(8,Math.max(0,this.time-known.at));return {x:known.x+d.x*known.speed*age,y:known.y+d.y*known.speed*age,z:known.z+d.z*known.speed*age,heading:known.heading,pitch:known.pitch,speed:known.speed,contact:false,detailed:false};}
      const d=direction(p);return {x:p.x+d.x*1400,y:p.y+d.y*1400,z:p.z+d.z*1400,heading:wrap(p.heading+180),pitch:0,speed:0,contact:false,detailed:false};
    }
    captainArcPoint(seen,arc,r=700){
      const vertical=arc==='dorsal'||arc==='ventral',a=(seen.heading+({fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0}[arc]))*RAD;
      return {x:seen.x+(vertical?0:Math.sin(a)*r),y:seen.y+(arc==='dorsal'?r:arc==='ventral'?-r:0),z:seen.z-(vertical?0:Math.cos(a)*r)};
    }
    captainAttackArc(seen){
      const p=this.player,current=facing(seen,p);let best=current,bestScore=Infinity;
      for(const arc of arcs){
        const point=this.captainArcPoint(seen,arc),blocked=this.stationTrace(p,point,75),unsafe=this.planetClearance(point)<180;
        const inside=!!this.stationTrace(point,point,70);
        const score=seen.shields[arc]*1.5+(arc===current?-22:12)+distance(p,point)*.018+angle(p,point)*.12+(blocked?65:0)+(unsafe||inside?1000:0);
        if(score<bestScore){bestScore=score;best=arc;}
      }return best;
    }
    captainTargetEscaping(seen){
      if(!seen.contact)return false;const p=this.player,r=distance(p,seen)||1,d=direction(seen);
      return (d.x*(seen.x-p.x)+d.y*(seen.y-p.y)+d.z*(seen.z-p.z))/r*seen.speed>70;
    }
    captainInternalTarget(seen){
      if(!seen.detailed)return 'hull';if(seen.hull<55)return 'hull';
      if(this.captainTargetEscaping(seen)&&seen.integrity.engines>8)return 'engines';
      if(this.player.hull<50&&seen.integrity.weapons>=10)return 'weapons';
      const limits={weapons:10,sensors:12,engines:12,mainEngines:15,bridge:20},weights={weapons:1.4,sensors:.9,engines:.9,mainEngines:.7,bridge:1};
      const vulnerable=Object.keys(limits).filter(key=>seen.integrity[key]>limits[key]&&seen.integrity[key]<40).sort((a,b)=>(seen.integrity[a]-limits[a])/weights[a]-(seen.integrity[b]-limits[b])/weights[b]);
      return vulnerable[0]||(seen.reactor<35?'reactor':seen.integrity.weapons>=35?'weapons':'reactor');
    }
    captainRouteScore(route,seen,arc){
      const p=this.player,forward=direction(p),right={x:-forward.z,z:forward.x},to={x:p.x-seen.x,z:p.z-seen.z},len=Math.hypot(to.x,to.z)||1;
      let point={x:seen.x+to.x/len*350,y:seen.y,z:seen.z+to.z/len*350};
      if(route==='port'||route==='starboard')point=this.curveApproach(route,seen);
      if(route==='flank')point=this.flankApproach(seen).waypoint;
      if(route==='above'||route==='below')point.y+=route==='above'?800:-800;
      if(route==='behind')point=this.captainArcPoint(seen,'aft',650);
      if(route==='hide')point=this.coverPosition(seen);
      let score=distance(p,point)*.03+angle(p,point)*.2+(this.stationTrace(p,point,90)?180:0)+(this.planetClearance(point)<180?1000:0);
      if(arc&&facing(seen,point)!==arc)score+=55;
      if(route==='behind')score+=20;if(route==='hide')score+=p.capacitor<35||p.heat>75?-15:80;
      if(route==='direct'&&arc&&facing(seen,p)===arc)score-=25;
      if(p.integrity.engines<35&&route!=='direct')score+=35;
      score+=(this.playerMind.failedRoutes[route]||0)*35;return score;
    }
    committedAttackArc(mind,requested,key,urgent=false){
      const decision=mind.arcDecision;
      if(!decision||decision.key!==key||urgent){mind.arcDecision={key,arc:requested,since:this.time};return requested;}
      if(requested===decision.arc){decision.candidate=null;return decision.arc;}
      if(decision.candidate!==requested){decision.candidate=requested;decision.candidateSince=this.time;}
      // Finish a useful approach before accepting a marginally better sector.
      if(this.time-decision.since>=4&&this.time-decision.candidateSince>=1.5){decision.arc=requested;decision.since=this.time;decision.candidate=null;}
      return decision.arc;
    }
    updateCaptain(){
      if(!this.captainEnabled||!this.turnBased||this.freeFlight||this.result||!this.maneuvering||this.time<this.playerMind.nextThink)return;
      const p=this.player,m=this.playerMind,t=this.turn,seen=this.captainObservation();m.nextThink=this.time+.6;
      const order=this.nextOrder(p),withdrawing=t.maneuver==='flee'||t.phase==='disengage';
      const incoming=this.output(p,'sensors')>=3.5?this.projectiles.find(torpedo=>torpedo.target===p.name&&distance(torpedo.pos,p)<550&&!this.stationTrace(p,torpedo.pos,2)):null;
      if(incoming&&m.threatId!==incoming.id){
        m.threatId=incoming.id;const h=p.heading*RAD,side=p.shields.starboard>=p.shields.port?1:-1;
        m.evadeAim={x:p.x+Math.cos(h)*450*side,y:p.y+(incoming.pos.y>=p.y?-200:200),z:p.z+Math.sin(h)*450*side};m.evadeUntil=this.time+2;
        if(p.hull<12&&!this.warpUsed)this.warp();
      }
      // Charge the weapons before the firing window, then sustain maximum useful
      // output during the salvo. Chase with engines when a shot is not imminent.
      const firing=order&&seen.contact&&distance(p,seen)<=order.range+(m.firing?350:180)&&angle(p,seen)<(m.firing?85:65);m.firing=!!firing;
      const profile=withdrawing?{engines:42,shields:38,weapons:5,sensors:15}:incoming?{engines:34,shields:30,weapons:22,sensors:14}:!seen.contact?{engines:40,shields:16,weapons:14,sensors:30}:firing?{engines:24,shields:22,weapons:40,sensors:14}:p.capacitor<35||p.heat>70?{engines:28,shields:18,weapons:40,sensors:14}:p.hull<40?{engines:30,shields:30,weapons:26,sensors:14}:{engines:36,shields:24,weapons:26,sensors:14};
      Object.assign(p.power,profile);if(seen.contact)redistribute(p.bias,facing(p,seen),60);
      if(seen.contact&&!seen.detailed&&p.capacitor>=40&&p.cooldown.scan===0)this.scan();
      const broken=['weapons','sensors','engines','mainEngines','reactor'].filter(key=>(key==='reactor'?p.reactor:p.integrity[key])<({weapons:10,sensors:13,engines:15,mainEngines:15,reactor:25}[key]));
      const repairs=broken.length?broken:withdrawing&&p.hull<70?['hull']:['reactor',...Object.keys(p.integrity)];
      p.repair=repairs.reduce((a,b)=>(a==='hull'?p.hull:a==='reactor'?p.reactor:p.integrity[a])<=(b==='hull'?p.hull:b==='reactor'?p.reactor:p.integrity[b])?a:b);
      for(const shot of t.orders||[])if(shot.status==='pending'&&shot.weapon==='torpedo'&&p.torpedoes<=0)shot.status='skipped';
      if(!order||order.status!=='pending'||withdrawing)return;
      if(m.order!==order){m.order=order;m.waitingSince=this.time;}
      if(seen.detailed){
        const current=facing(seen,p),best=this.captainAttackArc(seen),waited=this.time-m.waitingSince;
        const proposed=t.maneuver==='behind'?'aft':seen.shields[current]<25||waited>10&&seen.shields[current]<65?current:best;
        const exploit=proposed===current&&seen.shields[current]<25&&seen.shields[m.arcDecision?.arc]>=25;
        const arc=this.committedAttackArc(m,proposed,t.number+':'+t.stageIndex,exploit);
        order.attackArc=arc;m.arc=arc;
        order.target=order.weapon==='phaser'&&seen.shields[arc]>=25?'shield-'+arc:this.captainInternalTarget(seen);
        this.captainStatus=seen.shields[arc]<25?'Exploit '+arc+' breach / '+order.target+'.':'Concentrate fire on '+arc+' / shields '+Math.round(seen.shields[arc])+'%.';
      }else{delete order.attackArc;if(order.target.startsWith('shield-'))order.target='hull';this.captainStatus='Reacquire contact; avoid precision targeting without sensors.';}
      if(this.captainTargetEscaping(seen)||this.time-m.waitingSince>15)order.range=Math.min(weaponSpecs[order.weapon].maxRange,Math.max(order.range,distance(p,seen)+50));
    }
    previewEngineSide(){
      const missing=this.player.detachedNacelles;
      if(missing.port&&missing.starboard)return null;
      if(!this.previewAttackArc||missing[this.previewAttackArc])this.previewAttackArc=!missing.port&&!missing.starboard?(facing(this.player,this.enemy)==='starboard'?'starboard':'port'):missing.port?'starboard':'port';
      return this.previewAttackArc;
    }
    planEnemy(){
      this.chooseEnemyTactics();
      if(this.previewNacelleBreakoff&&this.previewEngineSide()){

        return [{weapon:'phaser',range:1000},{weapon:'phaser',range:900},{weapon:'torpedo',range:800}].map(order=>({...order,target:'mainEngines',attackArc:this.previewAttackArc}));
      }
      const p=this.player,e=this.enemy,detailed=this.enemyHasContact(true),arc=detailed?this.enemyAttackArc():facing(p,e);
      const shield=detailed?p.shields[arc]:100,internal=detailed?this.enemyInternalTarget():'hull',target=detailed&&shield>=25?'shield-'+arc:internal;
      if(this.enemyHasContact())this.rememberEnemyContact();
      const phasers=[{weapon:'phaser',target,range:1000},{weapon:'phaser',target,range:750}],torpedo={weapon:'torpedo',target:internal,range:650};
      const bursts=Array.from({length:DEFAULT_SALVO.phaser},(_,i)=>({...phasers[i%phasers.length]})),torpedoes=Array.from({length:DEFAULT_SALVO.torpedo},()=>({...torpedo}));
      return (detailed&&shield<25?[...torpedoes,...bursts]:[...bursts,...torpedoes]).map(order=>({...order,tactical:true,baseRange:order.range,range:clamp(Math.round(order.range*this.enemyMind.rangeScale/25)*25,400,weaponSpecs[order.weapon].maxRange-50),attackArc:detailed?arc:null}));
    }
    enemyHasContact(detailed=false){return this.range<2000&&this.enemy.integrity.sensors>12&&this.output(this.enemy,'sensors')>=(detailed?10:3.5);}
    rememberEnemyContact(){const p=this.player;this.enemyMind.lastKnown={x:p.x,y:p.y,z:p.z,heading:p.heading,pitch:p.pitch,speed:p.speed,at:this.time};}
    enemyTrack(){
      if(this.enemyHasContact()){this.rememberEnemyContact();return this.player;}
      const known=this.enemyMind.lastKnown;if(known){const age=clamp(this.time-known.at,0,8),d=direction(known);return {...known,x:known.x+d.x*known.speed*age,y:known.y+d.y*known.speed*age,z:known.z+d.z*known.speed*age};}
      const e=this.enemy,d=direction(e);return {x:e.x+d.x*1000,y:e.y+d.y*1000,z:e.z+d.z*1000,heading:e.heading,pitch:e.pitch,speed:0};
    }
    enemyAttackArc(){
      const engineSide=this.enemyWarpEngineSide();if(engineSide)return engineSide;
      const p=this.player,e=this.enemy,exposed=facing(p,e),offset={fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0};
      const candidates=[];
      for(const arc of arcs){
        const a=(p.heading+offset[arc])*RAD,vertical=arc==='dorsal'||arc==='ventral';
        const point={x:p.x+(vertical?0:Math.sin(a)*650),y:p.y+(arc==='dorsal'?650:arc==='ventral'?-650:0),z:p.z-(vertical?0:Math.cos(a)*650)};
        const flankBonus=this.enemyMind.style==='flank'&&['aft','port','starboard'].includes(arc)?30:0;
        const cost=p.shields[arc]+(arc===exposed?-18:20)+angle(e,point)*.12+(this.stationTrace(e,point,60)?35:0)-flankBonus;
        candidates.push({arc,cost});
      }
      candidates.sort((a,b)=>a.cost-b.cost);
      const strong=candidates.filter(candidate=>candidate.cost<=candidates[0].cost+12).slice(0,3);
      return strong[Math.min(strong.length-1,Math.floor((this.enemyMind.arcRoll??0)**2*strong.length))].arc;
    }
    enemyWarpEngineSide(){
      if(this.enemyPersonality!=='hunter'||!this.enemyHasContact(true))return null;
      const p=this.player,m=this.enemyMind,lost=p.detachedNacelles;
      if(lost.port&&lost.starboard){m.warpEngineSide=null;return null;}
      if(!m.warpEngineSide||lost[m.warpEngineSide]){
        const right=(this.enemy.x-p.x)*Math.cos(p.heading*RAD)+(this.enemy.z-p.z)*Math.sin(p.heading*RAD);
        m.warpEngineSide=lost.port?'starboard':lost.starboard?'port':p.shields.port===p.shields.starboard?(right<0?'port':'starboard'):p.shields.port<p.shields.starboard?'port':'starboard';
      }
      return m.warpEngineSide;
    }
    enemyInternalTarget(){
      if(this.enemyWarpEngineSide())return 'mainEngines';
      const p=this.player;if(p.hull<35)return 'hull';
      const candidates=['weapons','engines','reactor','bridge','mainEngines','sensors'].filter(key=>(key!=='mainEngines'||!p.detachedNacelles.port||!p.detachedNacelles.starboard)&&(key==='reactor'?p.reactor:p.integrity[key])>8);
      const weak=candidates.sort((a,b)=>(a==='reactor'?p.reactor:p.integrity[a])-(b==='reactor'?p.reactor:p.integrity[b]))[0];
      const preferred=this.enemyMind.preferredTarget==='mainEngines'&&p.detachedNacelles.port&&p.detachedNacelles.starboard?'hull':this.enemyMind.preferredTarget;
      return weak&&(weak==='reactor'?p.reactor:p.integrity[weak])<60?weak:preferred||'hull';
    }
    reengageEnemy(){
      const m=this.enemyMind,choices=['port','starboard','above','below','behind'].filter(key=>key!==m.returnManeuver);
      m.returnManeuver=choices[Math.floor(this.random()*choices.length)];m.returnLegComplete=false;
      m.reengageUntil=this.time+20;m.runAwaySince=null;m.evadeUntil=0;m.nextThink=0;this.enemyRetreating=false;
      Object.assign(this.enemy.power,{engines:34,shields:28,weapons:26,sensors:12});
      this.message('TACTICAL',`Yorktown is turning back after ten seconds: ${maneuvers[m.returnManeuver].name}.`);
    }
    enemyReturnAim(target){
      const m=this.enemyMind;if(m.returnLegComplete)return target;
      const a=(target.heading||0)*RAD,key=m.returnManeuver,side=key==='port'?-1:1;
      const point=key==='above'||key==='below'?{x:target.x,y:target.y+(key==='above'?500:-500),z:target.z}:
        key==='behind'?{x:target.x-Math.sin(a)*550,y:target.y,z:target.z+Math.cos(a)*550}:
        {x:target.x+Math.cos(a)*550*side,y:target.y,z:target.z+Math.sin(a)*550*side};
      if(distance(this.enemy,point)<180){m.returnLegComplete=true;return target;}return point;
    }
    enemyPursuesRepairs(){
      const p=this.player,e=this.enemy,t=this.turn;
      if(this.freeFlight||this.result||p.hull<=0||e.hull<15||e.integrity.weapons<10||!this.enemyHasContact(true))return false;
      if(!['approach','attack','withdraw','disengage'].includes(t.phase))return false;
      if(!['withdraw','disengage'].includes(t.phase)&&t.maneuver!=='flee'&&!t.navigation?.retiring)return false;
      const condition=ship=>ship.hull*.55+ship.reactor*.1+Object.values(ship.integrity).reduce((sum,value)=>sum+value,0)/Object.keys(ship.integrity).length*.25+Object.values(ship.shields).reduce((sum,value)=>sum+value,0)/arcs.length*.1;
      return condition(e)>condition(p)+2;
    }
    enemyPressesAdvantage(){
      const p=this.player,e=this.enemy;
      if(this.enemyPursuesRepairs())return true;
      // Enterprise red alert overrides even Yorktown's emergency retreat.
      if(!this.freeFlight&&p.hull>0&&p.hull<25)return true;
      const vulnerable=p.hull<99.99||p.reactor<99.99||Object.values(p.integrity).some(value=>value<99.99)||Object.values(p.detachedNacelles||{}).some(Boolean)||Object.values(p.shields).some(value=>value<25);
      return !this.freeFlight&&p.hull>0&&e.hull>=15&&e.integrity.weapons>=10&&vulnerable;
    }
    thinkEnemy(){
      const e=this.enemy,p=this.player,m=this.enemyMind;if(this.time<m.nextThink)return;m.nextThink=this.time+.75;this.chooseEnemyTactics();
      const contact=this.enemyHasContact(),detailed=this.enemyHasContact(true);if(contact)this.rememberEnemyContact();
      const repairPursuit=this.enemyPursuesRepairs(),pressing=this.enemyPressesAdvantage();if(pressing)this.enemyRetreating=false;
      const threat=contact?p:this.enemyTrack(),exposed=facing(e,threat),order=this.nextOrder(e);
      redistribute(e.bias,exposed,55);
      const repairKeys=this.enemyRetreating||e.hull<35?['hull','engines','reactor','shields','weapons','sensors']:['reactor',...Object.keys(e.integrity)];
      e.repair=repairKeys.reduce((a,b)=>(a==='hull'?e.hull:a==='reactor'?e.reactor:e.integrity[a])<=(b==='hull'?e.hull:b==='reactor'?e.reactor:e.integrity[b])?a:b);
      if(this.enemyRetreating&&e.integrity.engines<40)e.repair='engines';
      else if(e.reactor<35)e.repair='reactor';
      else if(!this.enemyRetreating&&e.integrity.sensors<=12)e.repair='sensors';
      else if(!this.enemyRetreating&&e.integrity.weapons<10)e.repair='weapons';
      const incoming=this.output(e,'sensors')>=3.5?this.projectiles.filter(t=>t.target===e.name&&distance(t.pos,e)<550&&!this.stationTrace(e,t.pos,2)).sort((a,b)=>distance(a.pos,e)-distance(b.pos,e))[0]:null;
      if(incoming&&m.threatId!==incoming.id){
        m.threatId=incoming.id;const h=e.heading*RAD,side=e.shields.port>=e.shields.starboard?1:-1;
        m.evadeAim={x:e.x+Math.cos(h)*650*side,y:e.y+(incoming.pos.y>=e.y?-240:240),z:e.z+Math.sin(h)*650*side};m.evadeUntil=this.time+2.4;
      }else if(!incoming&&e.shields[exposed]<20&&order&&(e.cooldown[order.weapon]>1||e.capacitor<14)&&this.time>=m.evadeUntil){
        const h=e.heading*RAD,side=e.shields.port>=e.shields.starboard?1:-1;
        m.evadeAim={x:e.x+Math.cos(h)*600*side,y:e.y,z:e.z+Math.sin(h)*600*side};m.evadeUntil=this.time+2.2;
      }
      if(this.enemyRetreating&&e.hull>=Math.max(35,this.enemyPersonalityProfile.retreatHull+10)&&e.integrity.engines>=40&&e.integrity.weapons>=30){this.enemyRetreating=false;this.message('TACTICAL','Yorktown has stabilized and is re-engaging.');}
      let profile,stance;
      if(this.enemyRetreating){profile={engines:45,shields:35,weapons:10,sensors:10};stance='RETREATING';}
      else if(!pressing&&m.reengageUntil>this.time){profile={engines:34,shields:28,weapons:26,sensors:12};stance='RE-ENGAGING';}
      else if(!contact){profile={engines:25,shields:30,weapons:15,sensors:30};stance='REACQUIRING CONTACT';}
      else if(!pressing&&(e.hull<45||e.shields[exposed]<20)||m.evadeUntil>this.time){profile={engines:34,shields:38,weapons:16,sensors:12};stance='DEFENSIVE';}
      else if(repairPursuit){profile={engines:42,shields:17,weapons:29,sensors:12};stance='PURSUING REPAIR WITHDRAWAL';}
      else if(pressing){profile={engines:34,shields:20,weapons:34,sensors:12};stance='PRESSING ATTACK';}
      else if(order&&this.range<=order.range+(m.firing?300:120)&&angle(e,p)<(m.firing?70:45)){profile={engines:20,shields:24,weapons:44,sensors:12};stance='ATTACKING';}
      else{profile={engines:40,shields:22,weapons:26,sensors:12};stance='PURSUING';}
      Object.assign(e.power,profile);e.tactic=stance;m.firing=stance==='ATTACKING';
      if(!this.enemyRetreating&&contact&&!pressing&&m.evadeUntil<=this.time){
        if(m.style==='standoff')redistribute(e.power,'shields',Math.max(e.power.shields,34));
        else if(m.style==='press')redistribute(e.power,'weapons',Math.max(e.power.weapons,34));
      }
      if(order!==m.waitingOrder){m.waitingOrder=order;m.waitingSince=this.time;}
      if(detailed&&order){
        const current=facing(p,e),breached=p.shields[current]<25;
        // Refresh only unspent orders; decisions never reset the firing budget.
        if(m.appliedTactic!==m.nextTactic){
          m.appliedTactic=m.nextTactic;
          for(const pending of this.turn.enemyOrders||[])if(pending.status==='pending'&&pending.tactical){
            const base=pending.baseRange;
            pending.range=clamp(Math.round(base*m.rangeScale/25)*25,400,weaponSpecs[pending.weapon].maxRange-50);
            pending.attackArc=this.enemyAttackArc();
            pending.target=pending.weapon==='phaser'&&p.shields[pending.attackArc]>=25?'shield-'+pending.attackArc:this.enemyInternalTarget();
          }
        }
        if(order.weapon==='torpedo'||breached){order.target=this.enemyInternalTarget();if(breached)order.attackArc=current;}
        else if(order.weapon==='phaser'&&p.shields[current]<60){order.target='shield-'+current;order.attackArc=current;}
        if(order.weapon==='torpedo'){
          const d=direction(p),away=(d.x*(p.x-e.x)+d.y*(p.y-e.y)+d.z*(p.z-e.z))/(this.range||1);
          if(away>.5&&p.speed>e.speed*.9)order.range=Math.max(order.range,Math.min(1700,this.range+50));
        }
        if(this.time-m.waitingSince>10){order.attackArc=angle(e,p)<45&&this.range<=order.range+300?current:this.enemyAttackArc();if(order.target.startsWith('shield-'))order.target='shield-'+order.attackArc;}
        const engineSide=this.enemyWarpEngineSide();
        if(engineSide){order.attackArc=engineSide;order.target=order.weapon==='phaser'&&p.shields[engineSide]>=25?'shield-'+engineSide:'mainEngines';}
        if(repairPursuit){
          order.attackArc=current;order.target=order.weapon==='phaser'&&p.shields[current]>=25?'shield-'+current:this.enemyInternalTarget();
          order.range=Math.max(order.range,Math.min(weaponSpecs[order.weapon].maxRange-50,this.range+75));
        }
        if(this.previewNacelleBreakoff){order.target='mainEngines';order.attackArc=this.previewEngineSide();}
        if(order.attackArc){
          const clearShot=!engineSide&&!this.previewNacelleBreakoff&&this.time-m.waitingSince>=2.5&&angle(e,p)<45&&this.range<=order.range&&e.cooldown[order.weapon]===0&&e.capacitor>=weaponSpecs[order.weapon].energy&&e.integrity.weapons>=10&&!this.stationTrace(e,p,2);
          if(clearShot)order.attackArc=current;
          const exploit=order.attackArc===current&&breached&&p.shields[m.arcDecision?.arc]>=25;
          order.attackArc=this.committedAttackArc(m,order.attackArc,this.turn.number+':'+this.turn.stageIndex,!!engineSide||repairPursuit||this.previewNacelleBreakoff||exploit||clearShot);
          if(order.target.startsWith('shield-'))order.target='shield-'+order.attackArc;
        }
      }
    }
    attackAssignments(step,index){return step?.maneuvers??(this.turn.draftManeuvers.some(Boolean)?this.defaultAttackAssignments(index):[Math.min(index,MANEUVER_COUNT-1)]);}
    defaultAttackAssignments(index){const available=this.turn.draftManeuvers.map((key,i)=>key&&key!=='flee'?i:-1).filter(i=>i>=0);return available.includes(index)?[index]:available.length?[available[available.length-1]]:[];}
    validStep(step){return !!step&&Object.hasOwn(weaponSpecs,step.weapon)&&Object.hasOwn(targets,step.target)&&Number.isFinite(step.range)&&step.range>=300&&step.range<=weaponSpecs[step.weapon].maxRange&&(!Object.hasOwn(step,'maneuvers')||Array.isArray(step.maneuvers)&&step.maneuvers.length>0&&new Set(step.maneuvers).size===step.maneuvers.length&&step.maneuvers.every(i=>Number.isInteger(i)&&i>=0&&i<MANEUVER_COUNT));}
    selectManeuver(key,index=null){
      if(this.result||this.maneuvering||!Object.hasOwn(maneuvers,key)||index!==null&&(!Number.isInteger(index)||index<0||index>=MANEUVER_COUNT))return false;
      for(const i of index===null?Array.from({length:MANEUVER_COUNT},(_,i)=>i):[index]){
        this.turn.draftManeuvers[i]=key;
        if(key==='flee')this.turn.draft=this.turn.draft.map((step,j)=>step?{...step,maneuvers:this.attackAssignments(step,j).filter(m=>m!==i)}:null);
      }
      this.turn.draftManeuver=this.turn.draftManeuvers.find(Boolean)||null;return true;
    }
    deleteManeuver(index){
      if(this.result||this.maneuvering||!Number.isInteger(index)||index<0||index>=MANEUVER_COUNT||!this.turn.draftManeuvers[index])return false;
      this.turn.draftManeuvers[index]=null;this.turn.draft=this.turn.draft.map((step,i)=>step?{...step,maneuvers:this.attackAssignments(step,i).filter(m=>m!==index)}:null);
      this.turn.draftManeuver=this.turn.draftManeuvers.find(Boolean)||null;return true;
    }
    planReady(plan=this.turn.draft,routes=this.turn.draftManeuvers){
      if(!Array.isArray(plan)||plan.length!==ATTACK_COUNT)return false;
      if(!Array.isArray(routes)||routes.length!==MANEUVER_COUNT||!routes.some(Boolean)||routes.some(key=>key&&!Object.hasOwn(maneuvers,key)))return false;
      if(!routes.some(key=>key&&key!=='flee'))return true;
      if(this.maneuvering&&this.turn.orders?.every(order=>order.status==='unused')&&plan.every(step=>!step))return true;
      return Array.isArray(plan)&&plan.length===ATTACK_COUNT&&Array.from(plan).every((step,i)=>this.validStep(step)&&(this.maneuvering&&this.turn.orders?.[i]?.status!=='pending'||this.attackAssignments(step,i).every(m=>routes[m]&&routes[m]!=='flee')));
    }
    clearStep(index){if(this.result||!Number.isInteger(index)||index<0||index>=ATTACK_COUNT||this.maneuvering)return false;this.turn.draft[index]=null;return true;}
    updateStep(index,step){
      const t=this.turn;
      if(!this.turnBased||this.result||!Number.isInteger(index)||index<0||index>=ATTACK_COUNT||!this.validStep(step))return false;
      const planning=['planning','review'].includes(t.phase);
      if(!planning&&(!this.running||!['approach','attack','withdraw'].includes(t.phase)||t.revisions<=0))return false;
      if(!planning&&t.orders[index].status!=='pending')return false;
      const assigned=this.attackAssignments(step,index);
      if(assigned.some(m=>t.draftManeuvers[m]==='flee')||!planning&&(!assigned.every(m=>t.draftManeuvers[m])||!assigned.some(m=>m>=t.stageIndex)))return false;
      const plan=t.draft.map(s=>s&&({...s}));plan[index]={weapon:step.weapon,target:step.target,range:step.range,maneuvers:[...assigned].sort()};

      if(!planning){if(!this.planReady(plan)||JSON.stringify(t.draft[index])===JSON.stringify(plan[index]))return false;t.revisions--;t.orders[index]={...plan[index],status:'pending'};}
      t.draft=plan;return true;
    }
    canReviseManeuver(index){
      const t=this.turn;return !this.result&&['approach','attack','withdraw'].includes(t.phase)&&t.revisions>0&&Number.isInteger(index)&&!!t.maneuvers?.[index]&&index>=t.stageIndex&&(index!==t.stageIndex||t.stageCompletedAt===null);
    }
    applyRevisions(plan,routes=this.turn.draftManeuvers,validateOnly=false){
      const t=this.turn;if(this.result||!['approach','attack','withdraw'].includes(t.phase)||!this.planReady(plan,routes))return false;
      const changes=Array.from({length:ATTACK_COUNT},(_,i)=>i).filter(i=>JSON.stringify(plan[i])!==JSON.stringify(t.draft[i]));
      const routeChanges=Array.from({length:MANEUVER_COUNT},(_,i)=>i).filter(i=>routes[i]!==t.maneuvers[i]),cost=changes.length+routeChanges.length;
      if(cost>t.revisions||routeChanges.some(i=>!routes[i]||!this.canReviseManeuver(i))||changes.some(i=>t.orders[i].status!=='pending'||!this.attackAssignments(plan[i],i).some(m=>m>=t.stageIndex)))return false;
      if(validateOnly)return true;
      for(const i of changes){t.draft[i]={...plan[i],maneuvers:[...this.attackAssignments(plan[i],i)]};t.orders[i]={...t.draft[i],status:'pending'};}
      const currentChanged=routeChanges.includes(t.stageIndex),remaining=t.remaining,elapsed=t.elapsed;
      if(currentChanged)this.restoreFlightPower();
      t.maneuvers=[...routes];t.draftManeuvers=[...routes];t.draftManeuver=routes.find(Boolean)||null;
      if(currentChanged){
        t.maneuver=routes[t.stageIndex];t.stageHistory[t.stageHistory.length-1]=t.maneuver;t.stageCompletedAt=null;t.cleanupDeadline=null;this.initNavigation();
        if(t.maneuver==='flee'){t.savedPower={...this.player.power};t.savedRepair=this.player.repair;Object.assign(this.player.power,{engines:50,shields:30,weapons:5,sensors:15});}
        this.setPhase(t.maneuver==='flee'?'withdraw':'approach');t.remaining=Math.min(remaining,t.remaining);t.elapsed=elapsed;
      }
      if(routes.every(key=>!key||key==='flee'))for(const order of t.orders)if(order.status==='pending')order.status='skipped';
      if(routeChanges.length){this.events.push({type:'maneuvers-revised',routes:[...routes]});this.message('HELM','Updated flight maneuvers applied.');if(this.replayRecording)this.replayRecording.record.maneuvers=[...routes];}
      t.revisions-=cost;return true;
    }
    commitOrders(){
      const t=this.turn;
      if(!this.turnBased||!this.running||this.result||!['planning','review'].includes(t.phase)||!this.planReady())return false;
      this.player.fullStop=false;this.player.phaserCombo=null;this.enemy.phaserCombo=null;
      if(t.phase==='review')t.number++;
      t.weaponsReadyAt=this.time+(t.number>1?.5:0);
      t.maneuvers=[...t.draftManeuvers];const offensive=t.maneuvers.some(key=>key&&key!=='flee');
      t.orders=t.draft.map((s,i)=>offensive?{...s,maneuvers:[...this.attackAssignments(s,i)],status:'pending'}:{status:'unused',maneuvers:[]});
      t.maneuverStatus=t.maneuvers.map(key=>key?'pending':'not-selected');t.enemyOrders=this.planEnemy().map(s=>({...s,status:'pending'}));t.spent={player:{phaser:0,torpedo:0},enemy:{phaser:0,torpedo:0}};t.offArcSpent={player:false,enemy:false};t.revisions=2;t.baseline=this.snapshot();t.report=null;t.stageHistory=[];
      const closing=this.openingApproach&&t.number===1;
      t.executionDeadline=this.time+TURN.execution+(closing?TURN.closing:0);t.cleanupDeadline=null;t.endedEarly=false;this.replayRecording=Replay?new Replay.Recorder(this):null;
      if(closing){
        t.stageIndex=-1;t.maneuver=null;t.navigation=null;t.stageCompletedAt=null;
        t.phase='closing';t.remaining=TURN.closing;t.elapsed=0;t.weaponsReadyAt=this.time+TURN.closing;
        t.approachAltitude=(this.player.y+this.enemy.y)/2;t.approachElevations={Enterprise:this.player.y,Yorktown:this.enemy.y};
        this.events.push({type:'phase',phase:'closing',pass:t.number});
        this.message('HELM','Closing on Yorktown. Five-second approach; weapons hold. Committed plans follow.');
      }else this.startStage(t.maneuvers.findIndex(Boolean));
      this.message('COMMAND',`Turn ${t.number}: ${t.maneuvers.filter(Boolean).length} maneuver(s) committed. Three scheduled shots committed. Additional manual fire uses energy and ammunition.`);this.captureReplay(true);return true;
    }
    captureReplay(force=false){
      if(!this.replayRecording)return;
      this.replayRecording.capture(this,force);
      if(this.result||this.turn.phase==='review'){this.lastReplay=this.replayRecording.finish(this);this.replayRecording=null;}
    }
    restoreFlightPower(){const t=this.turn;if(t.savedPower){Object.assign(this.player.power,t.savedPower);this.player.repair=t.savedRepair;t.savedPower=null;}}
    skipManeuver(){
      const t=this.turn;
      if(!this.turnBased||this.freeFlight||this.result||!t.orders||!['approach','attack','withdraw'].includes(t.phase))return false;
      const next=this.nextStageIndex();if(next<0)return this.endPass();
      for(const [i,order] of t.orders.entries())if(order.status==='pending'&&this.attackAssignments(order,i).includes(t.stageIndex)&&!this.attackAssignments(order,i).some(stage=>stage>t.stageIndex&&t.maneuvers[stage]))order.status='skipped';
      t.maneuverStatus[t.stageIndex]='skipped';
      this.events.push({type:'action-aborted',reason:'captain-skipped-maneuver',maneuver:t.maneuver,stage:t.stageIndex,nextStage:next,rammed:!!t.navigation?.rammed});
      this.startStage(next);this.captureReplay(true);return true;
    }
    endPass(){
      const t=this.turn;if(!this.turnBased||this.result||!t.orders||!['approach','attack','withdraw','disengage'].includes(t.phase))return false;
      for(const order of [...t.orders,...t.enemyOrders])if(order.status==='pending')order.status='skipped';
      t.maneuverStatus=t.maneuverStatus.map(status=>status==='active'?'ended':status==='pending'?'skipped':status);
      for(const projectile of this.projectiles)if(projectile.order)projectile.order.status='cancelled';
      const cancelled=this.projectiles.length;this.projectiles=[];this.events.push({type:'pass-ended',cancelledProjectiles:cancelled});
      this.events.push({type:'action-aborted',reason:'captain-ended-pass',maneuver:t.maneuver,stage:t.stageIndex,rammed:!!t.navigation?.rammed});
      this.finishPass(true);return true;
    }
    finishPass(endedEarly=false){
      const t=this.turn,current=this.snapshot();
      if(this.captainEnabled){
        const failed=!t.orders.some(order=>Number.isFinite(order.firedAt))&&t.orders.some(order=>order.weapon);
        for(const route of t.maneuvers.filter(key=>key&&key!=='flee'))this.playerMind.failedRoutes[route]=failed?Math.min(3,(this.playerMind.failedRoutes[route]||0)+1):(this.playerMind.failedRoutes[route]||0)*.5;
      }
      t.report=current.map((s,i)=>({hull:Math.max(0,t.baseline[i].hull-s.hull),shields:Object.fromEntries(arcs.map(a=>[a,Math.max(0,t.baseline[i].shields[a]-s.shields[a])])),integrity:Object.fromEntries(Object.keys(s.integrity).map(k=>[k,Math.max(0,t.baseline[i].integrity[k]-s.integrity[k])])),reactor:Math.max(0,t.baseline[i].reactor-s.reactor)}));
      this.restoreFlightPower();t.endedEarly=endedEarly;this.setPhase('review');
      this.message('COMMAND',endedEarly?`Turn ${t.number} ended by the captain. Remaining actions cancelled. Plan the next turn.`:`Turn ${t.number} complete. Review damage and choose the next maneuver.`);
      this.captureReplay(true);
    }
    startStage(index){
      const t=this.turn;this.restoreFlightPower();t.stageIndex=index;t.maneuver=t.maneuvers[index];t.maneuverStatus[index]='active';t.stageCompletedAt=null;t.stageHistory.push(t.maneuver);
      t.assaultTiming=null;
      const remainingStages=t.maneuvers.slice(index).filter(Boolean).length;
      t.stageDuration=Math.max(0,((t.executionDeadline??this.time+TURN.execution)-this.time)/remainingStages);
      this.initNavigation();this.target=this.nextOrder()?.target||'hull';this.setPhase(t.maneuver==='flee'?'withdraw':'approach');
      if(t.maneuver==='flee'){t.savedPower={...this.player.power};t.savedRepair=this.player.repair;Object.assign(this.player.power,{engines:50,shields:30,weapons:5,sensors:15});}
      this.message('HELM',`M${index+1}: ${maneuvers[t.maneuver].name}.`);
    }
    coverPosition(enemy=this.enemy){
      // K7 has large gaps: hide behind an actual solid part, not its bounding sphere.
      let best=null,bestScore=Infinity;
      const parts=[...this.station.parts].sort((a,b)=>b.rx*b.ry*b.rz-a.rx*a.ry*a.rz).slice(0,8);
      for(const part of parts){
        const length=distance(part,enemy)||1,v={x:(part.x-enemy.x)/length,y:(part.y-enemy.y)/length,z:(part.z-enemy.z)/length};
        const surface=1/Math.sqrt((v.x/part.rx)**2+(v.y/part.ry)**2+(v.z/part.rz)**2);
        for(const clearance of [200,300,450]){
          const point={x:part.x+v.x*(surface+clearance),y:part.y+v.y*(surface+clearance),z:part.z+v.z*(surface+clearance)};
          if(this.stationTrace(point,point,90)||!this.stationTrace(enemy,point)||this.planetClearance(point)<100)continue;
          const score=distance(this.player,point)+(this.stationTrace(this.player,point,90)?400:0);
          if(score<bestScore){best=point;bestScore=score;}
        }
      }
      if(best)return best;
      const k=this.station,d=distance(k,enemy)||1,r=k.radius+240;
      return {x:k.x+(k.x-enemy.x)/d*r,y:k.y+(k.y-enemy.y)/d*r,z:k.z+(k.z-enemy.z)/d*r};
    }
    coverPath(destination){
      if(!this.stationTrace(this.player,destination,90))return [destination];
      const k=this.station,r=k.radius+220,nodes=[this.player,destination];
      for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])if(x||y||z){
        const point={x:k.x+x*r,y:k.y+y*r,z:k.z+z*r};
        if(this.planetClearance(point)>100&&!this.stationTrace(point,point,90))nodes.push(point);
      }
      const costs=nodes.map(()=>Infinity),previous=[],visited=new Set();costs[0]=0;
      for(let count=0;count<nodes.length;count++){
        let from=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(from<0||costs[i]<costs[from]))from=i;
        if(from<0||!Number.isFinite(costs[from]))break;
        if(from===1){const path=[];for(let i=1;i!==0;i=previous[i])path.unshift({...nodes[i]});return path;}
        visited.add(from);
        for(let to=1;to<nodes.length;to++)if(!visited.has(to)){
          const cost=costs[from]+distance(nodes[from],nodes[to]);
          if(cost<costs[to]&&!this.stationTrace(nodes[from],nodes[to],90)){costs[to]=cost;previous[to]=from;}
        }
      }
      return [destination];
    }
    flankApproach(enemy=this.enemy){
      const p=this.player,a=(enemy.heading||0)*RAD,r=clamp(distance(p,enemy)*.45,450,850);
      const candidates=[-1,1].map(sign=>({side:sign<0?'port':'starboard',point:{x:enemy.x+Math.cos(a)*r*sign-Math.sin(a)*r*.15,y:enemy.y,z:enemy.z+Math.sin(a)*r*sign+Math.cos(a)*r*.15}}));
      candidates.sort((a,b)=>distance(p,a.point)-distance(p,b.point)||Math.abs(delta(p.heading,bearing(p,a.point)))-Math.abs(delta(p.heading,bearing(p,b.point))));
      const chosen=candidates[0],turn=delta(p.heading,bearing(p,chosen.point))<0?'port':'starboard';
      const waypoint=this.stationTrace(p,chosen.point,90)?this.curveApproach(turn,enemy):chosen.point;
      const error=delta(p.heading,bearing(p,waypoint));
      return {side:chosen.side,goal:chosen.point,waypoint,turn:Math.abs(error)<3?'direct':error<0?'port':'starboard'};
    }
    curveApproach(route,enemy=this.enemy){
      const p=this.player,f=direction(p),sign=route==='port'?-1:1,ahead=clamp(distance(p,enemy)*.6,300,900);
      let preferred;
      for(const advance of [ahead,ahead*.5,0,-300]){
        const point={x:p.x+f.x*advance-f.z*900*sign,y:p.y+f.y*advance,z:p.z+f.z*advance+f.x*900*sign};
        preferred??=point;
        if(!this.stationTrace(p,point,90)&&this.planetClearance(point)>100)return point;
      }
      return preferred;
    }
    initNavigation(){
      const t=this.turn,p=this.player,e=this.enemy,f=direction(p),right={x:-f.z,z:f.x},toward={x:p.x-e.x,z:p.z-e.z},len=Math.hypot(toward.x,toward.z)||1;
      // A committed maneuver is a new decision, rather than target jitter.
      delete p.steeringHeading;delete p.steeringPitch;p.steeringHeadingReversal=p.steeringPitchReversal=null;p.flightSpeedDecision=null;
      p.sweepTurnSide=0;p.verticalThrust=0;
      const waypoint={x:e.x+toward.x/len*350,y:e.y,z:e.z+toward.z/len*350};
      if(t.maneuver==='port'||t.maneuver==='starboard')Object.assign(waypoint,this.curveApproach(t.maneuver));
      const flank=t.maneuver==='flank'?this.flankApproach():null;if(flank)Object.assign(waypoint,flank.waypoint);
      if(t.maneuver==='above'||t.maneuver==='below')waypoint.y+=t.maneuver==='above'?800:-800;
      if(t.maneuver==='hide')Object.assign(waypoint,this.coverPosition());
      t.navigation={stage:['direct','distance','ram','close','chase','flee'].includes(t.maneuver)?'attack':'position',elapsed:0,wait:6,waypoint};
      t.navigation.relativeAnchor={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z};
      t.navigation.relativeStillTime=0;t.navigation.relativeStalled=false;
      if(flank){t.navigation.flankSide=flank.side;t.navigation.flankTurn=flank.turn;t.navigation.flankGoal=flank.goal;}
      if(t.maneuver==='hide'){t.navigation.coverPath=this.coverPath(waypoint);t.navigation.coverIndex=0;}
      if(t.maneuver==='behind'){
        const forward=direction(e),right={x:Math.cos(e.heading*RAD),z:Math.sin(e.heading*RAD)};
        t.navigation.rearSide=(p.x-e.x)*right.x+(p.z-e.z)*right.z<0?-1:1;
        t.navigation.rearPhase=facing(e,p)==='aft'?'stern':'flank';
        Object.assign(waypoint,{x:e.x-forward.x*150+right.x*850*t.navigation.rearSide,y:e.y,z:e.z-forward.z*150+right.z*850*t.navigation.rearSide});
      }
    }
    avoidShipCollision(ship,target,aim){
      const intentionalRam=this.turnBased&&!this.freeFlight&&this.turn.maneuver==='ram'&&['approach','attack'].includes(this.turn.phase)&&!this.turn.navigation?.rammed;
      if(intentionalRam){ship.collisionAvoidance=null;return aim;}
      const a=direction(ship),b=direction(target),r={x:target.x-ship.x,y:target.y-ship.y,z:target.z-ship.z};
      const av=ship.flightVelocity||{x:a.x*ship.speed,y:a.y*ship.speed,z:a.z*ship.speed},bv=target.flightVelocity||{x:b.x*target.speed,y:b.y*target.speed,z:b.z*target.speed};
      const v={x:bv.x-av.x,y:bv.y-av.y,z:bv.z-av.z};
      const speedSquared=v.x*v.x+v.y*v.y+v.z*v.z,dot=r.x*v.x+r.y*v.y+r.z*v.z;
      const closestTime=speedSquared>1e-6?clamp(-dot/speedSquared,0,8):0;
      const miss=Math.hypot(r.x+v.x*closestTime,r.y+v.y*closestTime,r.z+v.z*closestTime),range=Math.hypot(r.x,r.y,r.z);
      const danger=range<180||dot<0&&closestTime>0&&miss<180;
      const imminentContact=range<180||this.turn.navigation?.flyPast?.strafe&&closestTime>0&&closestTime<2&&miss<160;
      const assaultPass=ship===this.player&&this.turnBased&&!this.freeFlight&&this.turn.maneuver==='direct'&&this.turn.navigation?.stage==='attack'&&!this.turn.navigation.flyPastComplete&&!imminentContact;
      let avoidance=ship.collisionAvoidance;
      if(danger){
        if(!avoidance||avoidance.until<this.time||avoidance.assaultPass&&imminentContact||assaultPass&&!avoidance.assaultPass&&!avoidance.emergency){
          const horizontal=Math.hypot(r.x,r.z),length=range||1;
          // Both ships pass to their own right; retain that side until clear.
          const side=horizontal>1?{x:-r.z/horizontal,z:r.x/horizontal}:{x:ship===this.player?1:-1,z:0};
          avoidance={x:side.x*900-r.x/length*350,y:(ship===this.player?1:-1)*180-r.y/length*350,z:side.z*900-r.z/length*350,emergency:!!imminentContact};
          if(assaultPass){
            const pass=this.turn.navigation.flyPast?.trackingDirection||this.turn.navigation.flyPast?.direction||{x:r.x/length,y:r.y/length,z:r.z/length},horizontal=Math.hypot(pass.x,pass.z)||1;
            // Make room to pass on the right without peeling away from the
            // assault. Immediate hull danger still uses emergency avoidance.
            const clearance=this.turn.navigation.flyPast?.strafe?0:240;
            avoidance={x:pass.x*1400-pass.z/horizontal*clearance,y:pass.y*1400,z:pass.z*1400+pass.x/horizontal*clearance,assaultPass:true};
          }
        }
        avoidance.until=this.time+2;ship.collisionAvoidance=avoidance;
      }
      if(avoidance&&avoidance.until>=this.time)return {x:ship.x+avoidance.x,y:ship.y+avoidance.y,z:ship.z+avoidance.z};
      ship.collisionAvoidance=null;return aim;
    }
    desiredFlightSpeed(ship,target,aim,{mode='attack',order=null,alignFirst=false,avoiding=false,turnRate=42,speedOverride=0,strafing=false,firingPass=false}={}){
      const mobility=this.flightMobility(ship),maximum=125*mobility*IMPULSE_SPEED_MULTIPLIER;
      const aimDistance=distance(ship,aim),error=angle(ship,aim);let speed=maximum,reason='CLOSING FOR ATTACK';
      if(mode==='ram'){speed=maximum;reason='RAMMING SPEED';}
      else if(mode==='attack'){speed=maximum;reason='ACCELERATING FOR ATTACK RUN';}
      else if(mode==='pursuit'){speed=maximum;reason='PURSUING AT MAXIMUM SPEED';}
      else if(mode==='close'){
        const f=direction(target),slot=ship===this.player&&this.turn.navigation?.waypoint||{x:target.x-f.x*200,y:target.y-f.y*200,z:target.z-f.z*200};
        speed=target.speed+((slot.x-ship.x)*f.x+(slot.y-ship.y)*f.y+(slot.z-ship.z)*f.z)*.4;reason='MATCHING YORKTOWN COURSE AND SPEED';
      }
      else if(mode==='cover'){speed=MIN_IMPULSE_SPEED;reason='HOLDING COVER';}
      
      else if(mode==='escape'||mode==='breakaway')reason=mode==='escape'?'OPENING ESCAPE RANGE':'BREAKING AWAY';
      else if(mode==='position'){
        speed=Math.min(maximum,Math.sqrt(2*FLIGHT_BRAKING*Math.max(0,aimDistance-120)));reason='POSITIONING FOR ATTACK';
      }else{
        const range=distance(ship,target)||1,line={x:(target.x-ship.x)/range,y:(target.y-ship.y)/range,z:(target.z-ship.z)/range},d=direction(target);
        const targetAway=(d.x*line.x+d.y*line.y+d.z*line.z)*target.speed;
        const desiredRange=order?(mode==='distance'?order.range*.95:Math.min(order.range*.82,weaponSpecs[order.weapon].optimal[1]*.95)):range;
        const weaponOutput=this.output(ship,'weapons'),cost=weaponSpecs[order?.weapon||'phaser'].energy;
        const chargeWait=order&&ship.capacitor<cost?(cost-ship.capacitor)/Math.max(.01,weaponOutput*.42):0;
        const heatWait=order?.weapon==='phaser'?Math.max(0,(ship.heat-85)/(5+weaponOutput*.12)):0;
        const readyIn=order?Math.max(0,ship.cooldown[order.weapon]||0,chargeWait,heatWait):0;
        // Arrive slightly inside the ordered range as the weapon becomes ready,
        // matching radial target motion instead of racing past a firing window.
        speed=targetAway+(range-desiredRange)/Math.max(2.2,readyIn+.8);
        reason=mode==='distance'?'KEEPING DISTANCE / HOLDING FIRING RANGE':order&&range>order.range?'CLOSING TO FIRING RANGE':'HOLDING FIRING SOLUTION';
      }
      if(firingPass&&mode==='attack'){speed=Math.min(speed,maximum*.72);reason='CONTROLLED ATTACK RUN';}
      if(error>12&&mode!=='cover'&&(!strafing||error>45)){
        const angular=turnRate*Math.PI/180,radius=Math.max(45,Math.min(350,aimDistance*.6));
        speed=Math.min(speed,maximum*clamp(1-error/140,.12,1),radius*angular);
        reason=mode==='escape'||mode==='breakaway'?'TURNING FOR WITHDRAWAL':'TURNING FOR ATTACK';
      }
      if(alignFirst&&error>12){speed=MIN_IMPULSE_SPEED;reason='TURNING FOR ATTACK';}
      if(speedOverride>0){speed=maximum;reason='MANUAL SPEED UP / RELEASE W TO RESUME PLAN';}
      else if(speedOverride<0){speed=MIN_IMPULSE_SPEED;reason='MANUAL SLOW DOWN / RELEASE S TO RESUME PLAN';}
      if(ship.collisionAvoidance){
        const strafing=ship===this.player&&ship.collisionAvoidance.assaultPass&&this.turn.navigation?.flyPast?.strafe&&distance(ship,target)>=300;
        if(strafing)reason=firingPass?'CONTROLLED STRAFING PASS':'STRAFING PASS';
        else{speed=Math.min(speed,55,Math.sqrt(2*FLIGHT_BRAKING*Math.max(0,distance(ship,target)-180)));reason='AVOIDING SHIP COLLISION';}
      }
      const f=direction(ship),lookAhead=Math.max(200,Math.abs(ship.speed)*3),ahead={x:ship.x+f.x*lookAhead,y:ship.y+f.y*lookAhead,z:ship.z+f.z*lookAhead};
      const hit=this.stationTrace(ship,ahead,90);
      if(hit){speed=Math.min(speed,Math.sqrt(2*FLIGHT_BRAKING*Math.max(0,hit.t*lookAhead-75)));reason='BRAKING FOR K7';}
      else if(avoiding&&distance(ship,this.station)<this.station.radius+450){speed=Math.min(speed,80);reason='ROUNDING K7';}
      const planetSafeSpeed=Math.abs(this.planetSpeedLimit(ship,speed));if(planetSafeSpeed<speed){speed=planetSafeSpeed;reason='BRAKING FOR PLANET';}
      return {speed:clamp(speed,MIN_IMPULSE_SPEED,maximum),reason,mobility,maximum};
    }
    adjustFlightSpeed(ship,target,aim,options,dt){
      const command=this.desiredFlightSpeed(ship,target,aim,options),acceleration=FLIGHT_ACCELERATION*Math.max(.35,command.mobility),braking=FLIGHT_BRAKING;
      const range=distance(ship,target),error=angle(ship,target);
      const safe=!options.avoiding&&!ship.collisionAvoidance&&!/BRAKING FOR|ROUNDING K7/.test(command.reason);
      const combatTurn=this.turnBased&&!this.freeFlight&&!ship.fullStop&&!options.speedOverride&&['attack','pursuit'].includes(options.mode)&&safe;
      const coast=combatTurn&&!options.strafing&&ship.speed<=command.maximum+.001&&(ship.coastingTurn?range<1400&&error>12:range<1000&&range>280&&error>45);
      if(coast){
        const d=direction(ship);ship.flightVelocity??={x:d.x*ship.speed,y:d.y*ship.speed,z:d.z*ship.speed};
        ship.coastingTurn=true;ship.flightAcceleration=0;ship.throttle=0;
        ship.flightTargetSpeed=ship.speed;ship.speedIntent='COASTING / ROTATING TO FIRE';return;
      }
      ship.coastingTurn=false;
      // Emergency avoidance uses active braking and course correction.
      if(!safe||options.speedOverride)ship.flightVelocity=null;
      const previous=ship.flightSpeedDecision,override=options.speedOverride||0;
      const urgent=options.avoiding||ship.collisionAvoidance||/BRAKING FOR|ROUNDING K7/.test(command.reason)||['ACCELERATING FOR ATTACK RUN','PURSUING AT MAXIMUM SPEED','RAMMING SPEED','TURNING FOR ATTACK'].includes(command.reason)||override||angle(ship,aim)>60;
      if(!urgent&&previous&&previous.mode===options.mode&&previous.order===options.order&&previous.override===override){
        const change=command.speed-previous.speed;
        const reversing=(previous.speed-ship.speed)*(command.speed-ship.speed)<0;
        if(Math.abs(change)<8){command.speed=previous.speed;previous.pendingFor=0;}
        else if(reversing){
          const side=Math.sign(change);previous.pendingFor=previous.pendingSide===side?previous.pendingFor+dt:dt;previous.pendingSide=side;
          if(previous.pendingFor<1.5)command.speed=previous.speed;
        }else previous.pendingFor=0;
      }
      command.speed=clamp(command.speed,MIN_IMPULSE_SPEED,command.maximum);
      const sameDecision=previous&&previous.mode===options.mode&&previous.order===options.order&&previous.override===override;
      ship.flightSpeedDecision={mode:options.mode,order:options.order,override,speed:command.speed,pendingSide:previous?.pendingSide,pendingFor:urgent||!sameDecision?0:previous?.pendingFor||0};
      ship.speedOverride=options.speedOverride||0;
      ship.flightTargetSpeed=command.speed;ship.speedIntent=command.reason;
      this.easeFlightSpeed(ship,command.speed,dt,acceleration,braking);
      ship.throttle=command.speed<=MIN_IMPULSE_SPEED+.01?0:clamp(command.speed/command.maximum*100);
    }
    moveFlightVelocity(ship,dt){
      const d=direction(ship),wanted={x:d.x*ship.speed,y:d.y*ship.speed,z:d.z*ship.speed};
      if(!ship.flightVelocity)return wanted;
      const v=ship.flightVelocity;
      if(!ship.coastingTurn){
        const targetSpeed=ship.flightTargetSpeed??ship.speed,target={x:d.x*targetSpeed,y:d.y*targetSpeed,z:d.z*targetSpeed};
        const change={x:target.x-v.x,y:target.y-v.y,z:target.z-v.z},length=Math.hypot(change.x,change.y,change.z);
        const limit=FLIGHT_ACCELERATION*Math.max(.35,this.flightMobility(ship))*dt;
        if(length<=limit){ship.flightVelocity=null;ship.speed=targetSpeed;return target;}
        for(const axis of ['x','y','z'])v[axis]+=change[axis]*limit/length;
      }
      ship.speed=Math.hypot(v.x,v.y,v.z);return v;
    }
    easeFlightSpeed(ship,desired,dt,acceleration=FLIGHT_ACCELERATION,braking=FLIGHT_BRAKING){
      if(dt<=0)return;
      const error=desired-ship.speed,wanted=clamp(error*1.5,-braking,acceleration);
      ship.flightAcceleration=(ship.flightAcceleration||0)+clamp(wanted-(ship.flightAcceleration||0),-FLIGHT_JERK*dt,FLIGHT_JERK*dt);
      const change=ship.flightAcceleration*dt;
      if(error*change>=0&&Math.abs(change)>=Math.abs(error)){ship.speed=desired;ship.flightAcceleration=0;}
      else ship.speed=Math.max(MIN_IMPULSE_SPEED,ship.speed+change);
    }
    steerFlight(ship,aim,dt,maxYaw=42,maxPitch=30,urgent=false,immediate=false,shortest=false){
      if(dt<=0)return;
      const heading=bearing(ship,aim),pitch=clamp(elevation(ship,aim),-85,85);
      // A fleeting opposite request should not countermand a deliberate turn.
      // Sustained corrections and large course changes still get a response.
      for(const [key,wanted,current,rate,threshold] of [['steeringHeading',heading,ship.heading,ship.turnRate,1.2],['steeringPitch',pitch,ship.pitch,ship.pitchRate||0,.8]]){
        const yaw=key==='steeringHeading',difference=(a,b)=>yaw?delta(a,b):b-a;
        const error=difference(current,wanted),oldError=difference(current,ship[key]);
        const pendingKey=key+'Reversal';let pending=ship[pendingKey];
        if(!urgent&&!immediate&&Number.isFinite(ship[key])&&Math.abs(error)<60&&error*(Math.abs(rate)>1?rate:oldError)<0){
          const side=Math.sign(error);pending=pending?.side===side?{side,elapsed:pending.elapsed+dt}:{side,elapsed:dt};ship[pendingKey]=pending;
          if(pending.elapsed<2.25)continue;
        }else ship[pendingKey]=null;
        if(urgent||shortest||!Number.isFinite(ship[key])||Math.abs(difference(ship[key],wanted))>threshold)ship[key]=wanted;
      }
      let yawError=delta(ship.heading,ship.steeringHeading);
      const pitchError=ship.steeringPitch-ship.pitch;
      // Retain the chosen side while a target crosses directly behind the ship.
      // Release once it is well forward of the rear hemisphere, or avoidance needs a new turn.
      if(urgent||shortest||Math.abs(yawError)<110)ship.sweepTurnSide=0;
      if(!urgent&&!shortest&&(Math.abs(yawError)>150||ship.sweepTurnSide&&Math.abs(yawError)>110)){
        ship.sweepTurnSide||=Math.abs(ship.turnRate)>2?Math.sign(ship.turnRate):Math.sign(yawError);
        if(Math.sign(yawError)!==ship.sweepTurnSide)yawError+=ship.sweepTurnSide*360;
      }
      const sweepYaw=maxYaw*(urgent?1:.6);
      // Damped angular acceleration brakes into alignment instead of overshooting
      // and repeatedly reversing. Tiny course corrections have a quiet deadband.
      const yawLimit=sweepYaw*(urgent?.65:.42);
      const yawAcceleration=clamp(yawError*2-ship.turnRate*2.8,-yawLimit,yawLimit);
      const pitchLimit=maxPitch*(urgent?.85:.55);
      const pitchAcceleration=clamp(pitchError*2.4-(ship.pitchRate||0)*3.1,-pitchLimit,pitchLimit);
      ship.yawAcceleration=(ship.yawAcceleration||0)+clamp(yawAcceleration-(ship.yawAcceleration||0),-maxYaw*3*dt,maxYaw*3*dt);
      ship.pitchAcceleration=(ship.pitchAcceleration||0)+clamp(pitchAcceleration-(ship.pitchAcceleration||0),-maxPitch*3*dt,maxPitch*3*dt);
      ship.turnRate=clamp(ship.turnRate+ship.yawAcceleration*dt,-sweepYaw,sweepYaw);
      ship.pitchRate=clamp((ship.pitchRate||0)+ship.pitchAcceleration*dt,-maxPitch,maxPitch);
      ship.heading=wrap(ship.heading+ship.turnRate*dt);ship.pitch=clamp(ship.pitch+ship.pitchRate*dt,-85,85);
      const bank=-clamp(ship.turnRate/sweepYaw,-1,1)*MAX_BANK;
      ship.bank+=(bank-ship.bank)*(1-Math.exp(-(urgent?1.8:1.3)*dt));
    }
    circlingBreakaway(dt,ship=this.player){
      const t=this.turn,enemyActor=ship===this.enemy,n=enemyActor?this.enemyMind:t.navigation,p=ship,e=enemyActor?this.player:this.enemy;
      if(n&&enemyActor&&(this.freeFlight||!this.turnBased||this.enemyRetreating||!this.enemyHasContact()||!['approach','attack'].includes(t.phase))){n.breakaway=null;n.circleWatch=null;return null;}
      if(!n||dt<=0)return n?.breakaway?.aim||null;
      if(n.breakaway){
        const move=n.breakaway;move.elapsed+=dt;
        if(move.elapsed>=(enemyActor?1.5:3)&&(distance(p,e)>=move.range+(enemyActor?180:250)||move.elapsed>=(enemyActor?4:6))){
          n.breakaway=null;n.circleWatch=null;n.circleCooldown=8;
          if(enemyActor)n.circleReengageUntil=this.time+5;
          else if(move.resumeManeuver==='direct'&&t.maneuver==='direct')n.resumeDirect=true;
          delete p.steeringHeading;delete p.steeringPitch;p.sweepTurnSide=0;return null;
        }
        return move.aim;
      }
      const otherBreakaway=enemyActor?t.navigation?.breakaway:this.enemyMind.breakaway;
      if(otherBreakaway){n.circleWatch=null;return null;}
      if(this.idealAttackOrder(this.nextOrder(p),p,e)){n.circleWatch=null;return null;}
      n.circleCooldown=Math.max(0,(n.circleCooldown||0)-dt);
      const range=distance(p,e),eligible=(enemyActor||n.stage==='attack'&&!['ram','flee'].includes(t.maneuver))&&['approach','attack'].includes(t.phase)&&!n.circleCooldown;
      const turning=eligible&&!n.flyPast&&range>280&&range<1800&&!p.collisionAvoidance&&!e.collisionAvoidance&&Math.abs(p.turnRate)>3&&Math.abs(e.turnRate)>3&&p.turnRate*e.turnRate>0;
      if(!turning){n.circleWatch=null;return null;}
      const current=bearing(p,e);
      if(!n.circleWatch)n.circleWatch={elapsed:0,min:range,max:range,previous:current,sweep:0,aimError:angle(p,e)};
      const watch=n.circleWatch,change=delta(watch.previous,current);watch.previous=current;
      watch.min=Math.min(watch.min,range);watch.max=Math.max(watch.max,range);
      if(watch.max-watch.min>Math.max(35,watch.min*.1)||watch.aimError-angle(p,e)>8||change*watch.sweep<0&&Math.abs(change)>1){n.circleWatch=null;return null;}
      watch.elapsed+=dt;watch.sweep+=change;
      if(watch.elapsed<1.5-1e-8||Math.abs(watch.sweep)<9)return null;
      // Choose one outward heading and hold it; do not chase a moving escape point.
      const forward=direction(p),r=range||1,out={x:(p.x-e.x)/r,y:(p.y-e.y)/r,z:(p.z-e.z)/r};
      const v={x:out.x*.85+forward.x*1.2,y:out.y*.85+forward.y*1.2,z:out.z*.85+forward.z*1.2};
      const radial=v.x*out.x+v.y*out.y+v.z*out.z;
      if(radial<.25)for(const axis of ['x','y','z'])v[axis]+=out[axis]*(.25-radial);
      const length=Math.hypot(v.x,v.y,v.z)||1;
      const aim={x:p.x+v.x/length*1200,y:p.y+v.y/length*1200,z:p.z+v.z/length*1200};
      n.breakaway={aim,range,elapsed:0,resumeManeuver:enemyActor?null:t.maneuver};n.circleWatch=null;
      delete p.steeringHeading;delete p.steeringPitch;p.sweepTurnSide=0;
      this.events.push({type:'circling-breakaway',ship:p.name});
      this.message(enemyActor?'TACTICAL':'HELM',enemyActor?'Yorktown is breaking the circling pattern. Establishing a new approach.':'Breaking the circling pattern. Establishing a new approach.');
      return aim;
    }
    autoHelm(dt,keys={}){
      const t=this.turn,p=this.player,e=this.enemy,n=t.navigation;if(!n)return;
      if(t.stageCompletedAt!==null&&this.nextStageIndex()<0)return;
      n.elapsed+=dt;let aim=e;
      n.retiring=false;
      if(t.phase==='disengage'||t.maneuver==='flee'||n.retiring){
        const d=direction(p),v={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z};if(Math.hypot(v.x,v.y,v.z)<1)Object.assign(v,d);
        aim={x:p.x+v.x,y:p.y+v.y+150,z:p.z+v.z};
      }else if(t.maneuver==='chase'){
        // Pursuit points at Yorktown immediately and closes at available speed.
        n.waypoint={x:e.x,y:e.y,z:e.z};n.stage='attack';aim=e;
      }else if(t.maneuver==='ram'){

        const f=direction(e),lead=Math.min(t.maneuver==='ram'?2:3,distance(p,e)/Math.max(40,p.speed));
        aim={x:e.x+f.x*e.speed*lead,y:e.y+f.y*e.speed*lead,z:e.z+f.z*e.speed*lead};n.stage='attack';
      }else if(t.maneuver==='close'){
        const f=direction(e),right={x:Math.cos(e.heading*RAD),z:Math.sin(e.heading*RAD)};
        if(!n.closeSide)n.closeSide=(p.x-e.x)*right.x+(p.z-e.z)*right.z<0?-1:1;
        const slot={x:e.x-f.x*200+right.x*220*n.closeSide,y:e.y-f.y*200,z:e.z-f.z*200+right.z*220*n.closeSide};
        const separation=distance(p,slot);
        if(separation<650)n.matchingCourse=true;else if(separation>950)n.matchingCourse=false;
        aim=n.matchingCourse?{x:p.x+f.x*700+(slot.x-p.x)*1.2,y:p.y+f.y*700+(slot.y-p.y)*1.2,z:p.z+f.z*700+(slot.z-p.z)*1.2}:slot;
        n.waypoint=slot;n.stage='attack';
      }else if(t.maneuver==='distance'){

        const order=this.nextPlannedOrder(p);
        n.holdRange??=order?.range||1400;
        if(order)n.holdRange=Math.min(n.holdRange,order.range);
        const range=distance(p,e),desired=n.holdRange*.95;
        if(range<desired*.85)n.openingRange=true;
        else if(range>=desired*1.05)n.openingRange=false;
        n.stage='attack';
        if(n.openingRange){
          const d=direction(p),r=range||1,v=range>1?{x:(p.x-e.x)/r,y:(p.y-e.y)/r,z:(p.z-e.z)/r}:d;
          aim={x:p.x+v.x*1000,y:p.y+v.y*1000,z:p.z+v.z*1000};
        }
      }else if(t.maneuver==='behind'){

        const forward=direction(e),right={x:Math.cos(e.heading*RAD),z:Math.sin(e.heading*RAD)},order=this.nextPlannedOrder(p);
        const flank={x:e.x-forward.x*150+right.x*850*n.rearSide,y:e.y,z:e.z-forward.z*150+right.z*850*n.rearSide};
        if(n.rearPhase==='flank'&&(distance(p,flank)<250||n.elapsed>4.5||facing(e,p)==='aft'))n.rearPhase='stern';
        const standOff=Math.max(300,Math.min(800,(order?.range||1000)*.72));
        n.waypoint=n.rearPhase==='flank'?flank:{x:e.x-forward.x*standOff,y:e.y-forward.y*standOff,z:e.z-forward.z*standOff};
        const astern=n.rearPhase==='stern'&&facing(e,p)==='aft';
        if(astern&&angle(p,e)<55){n.rearAcquired=true;n.rearLostFor=0;}
        else n.rearLostFor=(n.rearLostFor||0)+dt;
        if(n.rearLostFor>3)n.rearAcquired=false;
        n.stage=n.rearAcquired?'attack':'position';aim=n.stage==='attack'?e:n.waypoint;
      }else if(t.maneuver==='hide'&&n.stage!=='attack'){
        if(n.stage==='position'&&this.stationTrace(e,p)){n.stage='hiding';this.message('HELM','K7 cover established. Holding six seconds before the assault.');}
        if(n.stage==='hiding'){n.wait-=dt;if(n.wait<=0)n.stage='attack';}
        if(n.stage==='position'){
          const path=n.coverPath||[n.waypoint];
          while(n.coverIndex<path.length-1&&distance(p,path[n.coverIndex])<140)n.coverIndex++;
          aim=path[n.coverIndex];
          // Refresh an exhausted approach if Yorktown has moved around K7.
          if(distance(p,n.waypoint)<160&&!this.stationTrace(e,p)){
            n.waypoint=this.coverPosition();n.coverPath=this.coverPath(n.waypoint);n.coverIndex=0;aim=n.coverPath[0];
          }
        }else if(n.stage==='hiding'){
          const hit=this.stationTrace(e,p),part=hit?.part||this.station,r=distance(p,part)||1;
          aim={x:p.x+(p.x-part.x)/r*500,y:p.y+(p.y-part.y)/r*500,z:p.z+(p.z-part.z)/r*500};
        }
      }else if(n.stage==='position'){
        aim=n.waypoint;
        if(distance(p,aim)<220||n.elapsed>4.5)n.stage='attack';
      }
      const order=this.nextPlannedOrder(p);
      const attackRun=n.stage==='attack'&&t.phase!=='disengage'&&['direct','flank','port','starboard','above','below','behind','hide'].includes(t.maneuver);
      // Once the attack leg begins, keep the bow on the enemy. Shield-sector
      // preferences and tactical evasion must not pull an assault off course.
      if(attackRun)aim=e;
      if(t.maneuver==='direct'&&n.flyPastComplete&&angle(p,e)<25&&distance(p,e)>700)n.flyPastComplete=false;
      if(['direct','above','below'].includes(t.maneuver)&&attackRun&&!n.flyPastComplete&&!n.breakaway){
        const attacked=t.orders.some(order=>order.firedStage===t.stageIndex);
        if(!n.flyPast&&(attacked||distance(p,e)<300||t.maneuver==='direct'&&distance(p,e)<1200&&angle(p,e)<25)){
          const r=distance(p,e)||1;
          let point=e;
          if(t.maneuver==='direct'){
            const horizontal=Math.hypot(e.x-p.x,e.z-p.z)||1,lead=Math.min(1.5,r/Math.max(100,p.speed)*.25),f=direction(e);
            n.directRunCount=(n.directRunCount||0)+1;
            n.strafeSide=(t.number+t.stageIndex+n.directRunCount-1)%3===0?-1:1;
            // Aim beside and through the target, rather than at its center.
            // Once established, the run stays straight while the guns track.
            point={x:e.x+f.x*e.speed*lead-(e.z-p.z)/horizontal*215*n.strafeSide,y:e.y+f.y*e.speed*lead,z:e.z+f.z*e.speed*lead+(e.x-p.x)/horizontal*215*n.strafeSide};
          }
          const length=distance(p,point)||1;
          n.flyPast={direction:{x:(point.x-p.x)/length,y:(point.y-p.y)/length,z:(point.z-p.z)/length},elapsed:0,strafe:t.maneuver==='direct'};
          if(n.flyPast.strafe){n.flyPast.side=n.strafeSide<0?'port':'starboard';n.flyPast.aimPoint={...point};n.flyPast.targetAnchor={x:e.x,y:e.y,z:e.z};}
        }
        if(n.flyPast){
          const pass=n.flyPast,d=pass.direction;pass.elapsed+=dt;
          const beyond=(p.x-e.x)*d.x+(p.y-e.y)*d.y+(p.z-e.z)*d.z;
          if(pass.elapsed>=1.2&&beyond>=(pass.strafe?500:220)){
            n.flyPast=null;n.flyPastComplete=true;
            if(p.collisionAvoidance?.assaultPass)p.collisionAvoidance=null;
            this.events.push({type:'come-about',ship:p.name,maneuver:t.maneuver,stage:t.stageIndex});
          }
          else{
            // Track target drift gently on the inbound leg, then freeze the
            // run before the close pass. The original crossing axis stays fixed.
            if(pass.strafe&&pass.targetAnchor&&-beyond>600&&distance(e,pass.targetAnchor)>25){
              const unit=v=>{const length=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/length,y:v.y/length,z:v.z/length};};
              const blend=(a,b,t)=>unit({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
              let wanted=unit({x:pass.aimPoint.x+e.x-pass.targetAnchor.x-p.x,y:pass.aimPoint.y+e.y-pass.targetAnchor.y-p.y,z:pass.aimPoint.z+e.z-pass.targetAnchor.z-p.z});
              const deviation=Math.acos(clamp(dot3(d,wanted),-1,1));
              if(deviation>6*RAD)wanted=blend(d,wanted,6*RAD/deviation);
              const current=pass.trackingDirection||d,change=Math.acos(clamp(dot3(current,wanted),-1,1));
              pass.trackingDirection=blend(current,wanted,change>0?Math.min(1,3*RAD*dt/change):1);
            }
            const course=pass.trackingDirection||d;
            aim={x:p.x+course.x*1400,y:p.y+course.y*1400,z:p.z+course.z*1400};
          }
        }
      }
      if(!attackRun&&this.captainEnabled&&this.playerMind.evadeUntil>this.time&&this.playerMind.evadeAim&&t.phase!=='disengage'&&!['flee','ram','close','chase'].includes(t.maneuver)&&!n.retiring)aim=this.playerMind.evadeAim;
      const breakout=this.circlingBreakaway(dt);if(breakout)aim=breakout;
      if(!breakout&&n.resumeDirect){
        n.resumeDirect=false;n.stage='attack';n.flyPast=null;n.flyPastComplete=false;aim=e;
        this.message('HELM','Circling pattern cleared. Resuming Direct Assault.');
      }
      aim=this.avoidShipCollision(p,e,aim);
      const f=direction(p),ahead={x:p.x+f.x*280,y:p.y+f.y*280,z:p.z+f.z*280};
      n.avoiding=!!(this.stationTrace(p,aim,90)||this.stationTrace(p,ahead,90));
      if(n.avoiding){n.stationSide??=p.x>=this.station.x?1:-1;n.stationClearFor=0;}
      else n.stationClearFor=(n.stationClearFor||0)+dt;
      if(n.stationSide&&n.stationClearFor<1.5)n.avoiding=true;
      else if(!n.avoiding)n.stationSide=null;
      if(n.avoiding&&!(t.maneuver==='hide'&&n.stage==='position'&&n.coverPath?.length))aim={x:this.station.x+n.stationSide*(this.station.radius+200),y:this.station.y+this.station.radius+180,z:this.station.z};
      const mobility=this.flightMobility(p),rate=42*mobility;
      const evading=this.captainEnabled&&this.playerMind.evadeUntil>this.time&&aim===this.playerMind.evadeAim;
      const verticalAttack=['above','below'].includes(t.maneuver)&&!n.avoiding&&!p.collisionAvoidance&&!breakout;
      let steeringAim=aim,wantedLift=0;
      if(verticalAttack){
        const altitude=aim.y-p.y,liftLimit=this.output(p,'engines')>0?Math.min(45*mobility,Math.abs(p.speed)*.35):0;
        wantedLift=clamp(altitude*.35,-liftLimit,liftLimit);
        // Small altitude changes use vertical thrusters; larger climbs and
        // dives still pitch the hull, with the thrusters assisting the move.
        if(altitude)steeringAim={x:aim.x,y:p.y+Math.sign(altitude)*Math.max(0,Math.abs(altitude)-220),z:aim.z};
      }
      p.verticalThrust=(p.verticalThrust||0)+clamp(wantedLift-(p.verticalThrust||0),-18*mobility*dt,18*mobility*dt);
      this.steerFlight(p,steeringAim,dt,rate,30*mobility,n.avoiding||!!p.collisionAvoidance||evading,t.maneuver==='chase'||attackRun||!!breakout,!!breakout||attackRun&&t.maneuver==='direct');
      const mode=breakout?'breakaway':t.maneuver==='flee'?'escape':t.phase==='disengage'||n.retiring?'breakaway':t.maneuver==='ram'?'ram':t.maneuver==='chase'?'pursuit':t.maneuver==='close'&&n.matchingCourse?'close':t.maneuver==='distance'?(n.openingRange?'escape':'distance'):n.stage==='hiding'?'cover':n.stage==='position'?'position':'attack';
      const strafing=t.maneuver==='direct'&&!!n.flyPast&&!breakout;
      const inbound=!n.flyPast||dot3({x:e.x-p.x,y:e.y-p.y,z:e.z-p.z},n.flyPast.direction)>0;
      const firingPass=t.maneuver==='direct'&&attackRun&&!breakout&&inbound&&distance(p,e)<=1200&&p.integrity.weapons>=10&&this.output(p,'weapons')>=3&&!!this.nextPlannedOrder(p);
      this.adjustFlightSpeed(p,e,aim,{mode,order,strafing,firingPass,alignFirst:!strafing&&!breakout&&attackRun&&t.maneuver==='direct',avoiding:n.avoiding,turnRate:rate,speedOverride:(keys.more?1:0)-(keys.less?1:0)},dt);
      if(t.maneuver==='flee'){
        p.repair=['hull','reactor',...Object.keys(p.integrity)].reduce((a,b)=>(a==='hull'?p.hull:a==='reactor'?p.reactor:p.integrity[a])<(b==='hull'?p.hull:b==='reactor'?p.reactor:p.integrity[b])?a:b);
      }
    }
    nextStageIndex(){return this.turn.maneuvers?.findIndex((key,i)=>key&&i>this.turn.stageIndex)??-1;}
    nextPlannedOrder(shooter=this.player){
      if(shooter!==this.player)return this.turn.enemyOrders?.find(order=>order.status==='pending'&&(!order.maneuvers||order.maneuvers.includes(this.turn.stageIndex)));
      if(this.turn.maneuver==='flee')return undefined;
      return this.turn.orders?.find((order,i)=>order.weapon&&order.status==='pending'&&this.attackAssignments(order,i).includes(this.turn.stageIndex));
    }
    idealAttackOrder(order,shooter,target){
      if(!order?.weapon||order.status!=='pending')return false;
      const range=distance(shooter,target),optimal=weaponSpecs[order.weapon].optimal,arc=facing(target,shooter);
      if(range<optimal[0]||range>optimal[1]||range>order.range||!this.forwardFiringArc(order.weapon,shooter,target))return false;
      if(order.attackArc&&arc!==order.attackArc||order.target.startsWith('shield-')&&arc!==order.target.slice(7))return false;
      return this.weaponStatus(order.weapon,shooter,target)==='READY';
    }
    nextOrder(shooter=this.player){
      const t=this.turn,normal=this.nextPlannedOrder(shooter),target=shooter===this.player?this.enemy:this.player;
      const salvo=shooter===this.player&&t.maneuver==='direct'?this.directAssaultSalvo():null;
      if(salvo&&['approach','attack'].includes(t.phase)){
        const combo=target.phaserCombo,torpedo=salvo[2];
        if(combo?.source===shooter.name&&combo.turn===t.number&&combo.hits>=2&&!combo.used&&this.time<=combo.until&&combo.arc===facing(target,shooter)&&this.idealAttackOrder(torpedo,shooter,target))return torpedo;
        const phaser=salvo.find(order=>order.weapon==='phaser'&&order.status==='pending');
        if(phaser)return phaser;
      }
      const held=shooter===this.player&&(t.maneuver==='flee'||t.maneuver==='hide'&&t.navigation?.stage!=='attack');
      if(!this.turnBased||this.freeFlight||this.result||held||!['approach','attack'].includes(t.phase)||t.remaining<=0||this.time+1e-8<(t.weaponsReadyAt??0)||this.idealAttackOrder(normal,shooter,target))return normal;
      const orders=shooter===this.player?t.orders:t.enemyOrders;
      return orders?.find((order,i)=>order!==normal&&(shooter!==this.player||this.attackAssignments(order,i).some(stage=>stage>t.stageIndex&&t.maneuvers?.[stage]&&t.maneuvers[stage]!=='flee'))&&this.idealAttackOrder(order,shooter,target))||normal;
    }
    directAssaultSalvo(){
      const t=this.turn,orders=t.orders?.filter((order,i)=>order.weapon&&this.attackAssignments(order,i).includes(t.stageIndex));
      return orders?.length===3&&orders[0].weapon==='phaser'&&orders[1].weapon==='phaser'&&orders[2].weapon==='torpedo'?orders:null;
    }
    turnStatus(type,shooter,target,scheduled=true){
      const t=this.turn,order=this.nextOrder(shooter);
      const opportunity=scheduled&&order&&order!==this.nextPlannedOrder(shooter);
      if(t.phase==='withdraw'&&shooter===this.player)return 'WITHDRAWING / WEAPONS HOLD';
      if(!['approach','attack','withdraw'].includes(t.phase))return t.phase.toUpperCase()+' / WEAPONS HOLD';
      if(t.stageCompletedAt!==null&&this.nextStageIndex()<0)return 'TURN COMPLETE / WEAPONS HOLD';
      if(this.time+1e-8<(t.weaponsReadyAt??0))return 'COMMITTING ORDERS / WEAPONS HOLD';
      if(shooter===this.player&&t.maneuver==='hide'&&t.navigation.stage!=='attack')return 'K7 COVER MANEUVER';
      if(!opportunity&&shooter===this.player&&order&&t.maneuver==='behind'&&facing(target,shooter)!=='aft')return 'POSITIONING BEHIND YORKTOWN';
      if(!opportunity&&shooter===this.player&&t.navigation.stage==='position')return 'POSITIONING FOR ATTACK';
      if(!scheduled)return null;
      if(!order)return this.nextStageIndex()>=0?'MANEUVER COMPLETE':'TURN PLAN COMPLETE';
      if(order.weapon!==type)return 'NEXT STEP: '+order.weapon.toUpperCase();
      if(scheduled&&shooter===this.player&&t.maneuver==='direct'&&this.directAssaultSalvo()){
        const focus=t.navigation.salvoFocus,combo=target.phaserCombo,arc=facing(target,shooter);
        if(type==='phaser'&&focus&&combo?.hits===1&&combo.source===shooter.name&&combo.turn===t.number&&arc!==focus.arc&&this.time-focus.at<3)return 'TRACKING THE SAME SHIELD';
        if(type==='torpedo'&&combo?.source===shooter.name&&combo.turn===t.number&&combo.hits>=2&&!combo.used&&this.time<=combo.until&&arc!==combo.arc)return 'ALIGNING FOR SHIELD OPENING';
      }
      if((shooter===this.enemy||this.captainEnabled)&&order.attackArc&&facing(target,shooter)!==order.attackArc)return 'SEEKING EXPOSED SHIELD';
      if(!order||distance(shooter,target)>order.range)return 'CLOSE TO ORDERED RANGE';
      if(order.target.startsWith('shield-')&&facing(target,shooter)!==order.target.slice(7))return 'SELECTED SHIELD NOT EXPOSED';
      return null;
    }
    advanceTurn(dt){
      const t=this.turn,previousRemaining=t.remaining;t.remaining=Math.max(0,t.remaining-dt);t.elapsed+=dt;
      if(!this.maneuvering)return false;
      if(t.phase==='approach'||t.phase==='attack'||t.phase==='withdraw'){
        if(t.maneuver==='direct'&&t.stageCompletedAt===null){
          const timing=t.assaultTiming??={closing:0,started:false},order=this.nextPlannedOrder(this.player);
          if(!timing.started){
            const fired=t.orders.some(shot=>shot.firedStage===t.stageIndex);
            if(!order||fired||this.range<=order.range)timing.started=true;
            else if(previousRemaining>0){
              // Closing to the first ordered firing range must not use up the
              // strafing window or steal time from the following maneuver.
              const held=Math.min(dt,previousRemaining,Math.max(0,TURN.directApproach-timing.closing));
              timing.closing+=held;t.remaining+=held;t.executionDeadline+=held;
              if(timing.closing>=TURN.directApproach-1e-8)timing.started=true;
            }
          }
        }
        const timedOut=t.remaining<=0;
        const n=t.navigation,relative={x:this.player.x-this.enemy.x,y:this.player.y-this.enemy.y,z:this.player.z-this.enemy.z};
        // A fixed anchor catches accumulated drift, rather than just comparing adjacent frames.
        if(!n.relativeAnchor||distance(relative,n.relativeAnchor)>25){n.relativeAnchor=relative;n.relativeStillTime=0;}
        else n.relativeStillTime+=dt;
        if(n.relativeStillTime>3)n.relativeStalled=true;
        const stalled=n.relativeStalled;
        for(const [shooter,target] of [[this.player,this.enemy],[this.enemy,this.player]]){
          if(this.result)break;
          if(shooter===this.enemy&&this.enemyRetreating&&!this.closeBattleFire()&&!(angle(shooter,target)>90&&this.inFiringArc(this.nextOrder(shooter)?.weapon,shooter,target)))continue;
          if(shooter===this.player&&(t.remaining<=0||stalled))continue;
          const order=this.nextOrder(shooter);if(order)this.fire(order.weapon,shooter,target,true);
        }
        for(const order of t.orders)if(order.status==='pending'&&order.weapon==='torpedo'&&this.player.torpedoes<=0)order.status='skipped';
        const here=t.orders.filter((order,i)=>order.weapon&&this.attackAssignments(order,i).includes(t.stageIndex));
        const unfinished=here.some(order=>order.status==='pending');
        if(timedOut)t.remaining=0;
        if(timedOut||stalled)for(const order of here)if(order.status==='pending'&&!order.maneuvers.some(m=>m>t.stageIndex&&t.maneuvers[m]))order.status='skipped';
        const fired=t.orders.filter(order=>order.firedStage===t.stageIndex),enemyBeams=this.nextStageIndex()<0?t.enemyOrders.filter(order=>order.weapon==='phaser'&&Number.isFinite(order.firedAt)):[];
        const beamEnd=Math.max(0,...fired.map(order=>order.firedAt+(order.weapon==='phaser'?PHASER_DURATION:0)),...enemyBeams.map(order=>order.firedAt+PHASER_DURATION));

        const finished=stalled||timedOut;
        if(finished&&t.stageCompletedAt===null){
          t.stageCompletedAt=this.time;
          if(stalled||timedOut&&!['flee','chase'].includes(t.maneuver)&&(t.maneuver==='ram'?!n.rammed:unfinished)){
            n.aborted=true;this.events.push({type:'action-aborted',reason:stalled?'no-relative-progress':'timeout',maneuver:t.maneuver,stage:t.stageIndex,nextStage:this.nextStageIndex(),rammed:!!n.rammed});
          }
        }
        const complete=finished&&this.time>=beamEnd;
        if(!this.result&&complete){
          if(stalled&&!n.relativeAdvanceLogged){n.relativeAdvanceLogged=true;this.message('HELM','Relative position held for over three seconds. Advancing the flight plan.');}
          t.maneuverStatus[t.stageIndex]=t.maneuver==='flee'?'repaired':'complete';
          const next=this.nextStageIndex();
          if(next>=0)this.startStage(next);
          else{
            for(const pending of t.enemyOrders)if(pending.status==='pending')pending.status='skipped';
            // End immediately after the final effects resolve, with no exit turn.
            if(this.projectiles.length===0)this.finishPass();
            return true;
          }
        }
      }else if(t.phase==='disengage'&&this.projectiles.length===0&&(t.remaining<=0||t.elapsed>=3&&this.range>=1400)){
        this.finishPass();
      }
      return true;
    }
    reportTorpedoMiss(projectile,reason){
      if(projectile.practice||projectile.missReported)return;
      projectile.missReported=true;
      if(projectile.order)projectile.order.status=reason==='blocked'?'intercepted':'missed';
      this.events.push({type:'torpedo-missed',from:projectile.from,target:projectile.target,projectileId:projectile.id,reason});
    }
    resolveShipCollision(previousPositions){
      const p=this.player,e=this.enemy,ships=[p,e],steps=ships.map(s=>{
        const before=previousPositions?.[s.name]||s;
        return {x:s.x-before.x,y:s.y-before.y,z:s.z-before.z};
      });
      // Follow movement in short steps, keeping Enterprise outside Yorktown's volumes.
      const travel=steps.map(step=>Math.hypot(step.x,step.y,step.z)),count=Math.max(1,Math.ceil((travel[0]+travel[1])/4));
      if(distance(p,e)>260+travel[0]+travel[1]){this.shipsTouching=false;return;}
      for(const axis of ['x','y','z'])p[axis]-=steps[0][axis];
      let impact=null,closing=0,impactAxis=null;
      for(let step=0;step<=count;step++){
        if(step>0)for(const axis of ['x','y','z'])p[axis]+=steps[0][axis]/count;
        const sample={...e,x:e.x-steps[1].x*(1-step/count),y:e.y-steps[1].y*(1-step/count),z:e.z-steps[1].z*(1-step/count)};
        const contact=shipContact(p,sample);
        if(contact){
          if(!impact){
            impact=contact;const pd=direction(p),ed=direction(e),r=distance(p,sample)||1;
            const sign=contact.normal.x*(sample.x-p.x)+contact.normal.y*(sample.y-p.y)+contact.normal.z*(sample.z-p.z)<0?-1:1;
            impactAxis={x:contact.normal.x*sign,y:contact.normal.y*sign,z:contact.normal.z*sign};
            closing=((pd.x*p.speed-ed.x*e.speed)*(sample.x-p.x)+(pd.y*p.speed-ed.y*e.speed)*(sample.y-p.y)+(pd.z*p.speed-ed.z*e.speed)*(sample.z-p.z))/r;
          }
          const correction=shipSeparation(p,sample,contact.normal);
          for(const axis of ['x','y','z'])p[axis]-=contact.normal[axis]*correction;
        }
      }
      if(impact&&!this.shipsTouching){
        const intentional=this.turnBased&&!this.freeFlight&&this.turn.maneuver==='ram'&&['approach','attack'].includes(this.turn.phase)&&this.turn.remaining>0&&!this.turn.navigation?.rammed;
        this.ramImpact(closing);
        this.events.push({type:'ship-collision',ship:p.name,other:e.name,pos:impact.pos,intentional});
      }
      if(impact){
        // Inelastic contact: absorb closing motion instead of reflecting it
        // back out of the hulls. Tangential motion lets glancing hits slide.
        const velocity=ship=>{const d=direction(ship);return {...(ship.flightVelocity||{x:d.x*ship.speed,y:d.y*ship.speed,z:d.z*ship.speed})};};
        const pv=velocity(p),ev=velocity(e),n=impactAxis;
        const closing=(pv.x-ev.x)*n.x+(pv.y-ev.y)*n.y+(pv.z-ev.z)*n.z;
        if(closing>0){
          for(const axis of ['x','y','z']){pv[axis]-=n[axis]*closing*.5;ev[axis]+=n[axis]*closing*.5;}
          for(const [ship,v] of [[p,pv],[e,ev]]){ship.flightVelocity=v;ship.speed=Math.hypot(v.x,v.y,v.z);ship.flightAcceleration=0;ship.coastingTurn=false;}
        }
      }
      // Clearance padding holds an existing contact; it must not silently start one.
      this.shipsTouching=!!impact||this.shipsTouching&&!!shipContact(p,e,3);
    }
    ramImpact(closingSpeed){
      const t=this.turn;if(this.freeFlight||this.result||!this.turnBased||t.maneuver!=='ram'||!['approach','attack'].includes(t.phase)||t.remaining<=0||t.navigation?.rammed||closingSpeed<60)return false;
      t.navigation.rammed=true;
      const amount=clamp(45+closingSpeed*.18,45,90);
      for(const [target,source] of [[this.enemy,this.player],[this.player,this.enemy]]){
        const arc=facing(target,source),before=target.hull,shield=target.shields[arc];
        target.shields[arc]=0;target.hull=clamp(target.hull-amount);target.lastHit=this.time;this.drawEnergy(target,amount*.4);
        for(const key of ['engines','mainEngines','bridge'])target.integrity[key]=clamp(target.integrity[key]-amount*.5);
        target.reactor=clamp(target.reactor-amount*.2,12,100);
        const hullDamage=before-target.hull,scorePoints=target===this.enemy?this.scoreHit(shield,hullDamage,'ram'):0;
        this.events.push({type:'impact',ship:target.name,arc,hullDamage,amount,weapon:'ram',scorePoints,shieldBroken:shield>0,shieldDepleted:true});
        this.message('DAMAGE',target.name+': ramming impact / hull -'+Math.round(hullDamage)+'%.');
      }
      this.battleStats.chain=0;this.battleStats.lastScoredAt=-Infinity;
      const destroyed=[this.player,this.enemy].filter(ship=>ship.hull<=0);
      if(destroyed.length){
        this.result=this.player.hull<=0?'defeat':'victory';this.running=false;this.completeBattleScore();
        for(const ship of destroyed)this.events.push({type:'destroyed',ship:ship.name});
        this.message('COMMAND',this.player.hull<=0?'Enterprise lost in the ramming impact.':'Yorktown destroyed by ramming impact.');this.captureReplay(true);
      }
      return true;
    }
    stationTrace(from,to,padding=0){
      const angle=(this.time||0)*K7_ROTATION_RATE,c=Math.cos(angle),s=Math.sin(angle),station=this.station;
      const unrotate=p=>{const x=p.x-station.x,z=p.z-station.z;return {x:station.x+c*x-s*z,y:p.y,z:station.z+s*x+c*z};};
      from=unrotate(from);to=unrotate(to);
      let nearest=null;
      for(const part of this.station.parts){
        const rx=part.rx+padding,ry=part.ry+padding,rz=part.rz+padding;
        const ox=(from.x-part.x)/rx,oy=(from.y-part.y)/ry,oz=(from.z-part.z)/rz;
        const dx=(to.x-from.x)/rx,dy=(to.y-from.y)/ry,dz=(to.z-from.z)/rz;
        const a=dx*dx+dy*dy+dz*dz,b=ox*dx+oy*dy+oz*dz,c=ox*ox+oy*oy+oz*oz-1;
        let t=0;
        if(c>0){const disc=b*b-a*c;if(a<1e-12||disc<0)continue;t=(-b-Math.sqrt(disc))/a;if(t<0||t>1)continue;}
        if(nearest&&nearest.t<=t)continue;
        const pos={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,z:from.z+(to.z-from.z)*t};
        const nx=(pos.x-part.x)/(rx*rx),ny=(pos.y-part.y)/(ry*ry),nz=(pos.z-part.z)/(rz*rz),len=Math.hypot(nx,ny,nz)||1;
        nearest={t,pos,normal:{x:nx/len,y:ny/len,z:nz/len},part};
      }
      if(nearest){
        const x=nearest.pos.x-station.x,z=nearest.pos.z-station.z,n=nearest.normal;
        nearest.pos={x:station.x+c*x+s*z,y:nearest.pos.y,z:station.z-s*x+c*z};
        nearest.normal={x:c*n.x+s*n.z,y:n.y,z:-s*n.x+c*n.z};
      }
      return nearest;
    }
    moveAroundStation(s,from){
      const hit=this.stationTrace(from,s,45);if(!hit)return;
      for(const axis of ['x','y','z'])s[axis]=hit.pos[axis]+hit.normal[axis]*.5;
      // Recover safely even if a saved/test position began inside overlapping station volumes.
      for(let pass=0;pass<8;pass++){
        const inside=this.stationTrace(s,s,45);if(!inside)break;
        const part=inside.part,dx=s.x-part.x,dy=s.y-part.y,dz=s.z-part.z;
        const n=Math.hypot(dx/(part.rx+45),dy/(part.ry+45),dz/(part.rz+45));
        if(n<1e-8){s.y=part.y+part.ry+46;continue;}
        const k=1.002/n;s.x=part.x+dx*k;s.y=part.y+dy*k;s.z=part.z+dz*k;
      }
      if(Math.abs(s.speed)>1){this.events.push({type:'station-collision',ship:s.name,pos:{x:hit.pos.x,y:hit.pos.y,z:hit.pos.z}});if(s===this.player)this.message('HELM','K7 collision avoidance: deflecting at slow impulse. Steer clear of the station.');}
      // Deflect around the obstacle at minimum speed instead of parking against it.
      const sign=Math.sign(s.speed)||1,d=direction(s),n=hit.normal;
      let x=d.x*sign,y=d.y*sign,z=d.z*sign;
      const inward=Math.min(0,x*n.x+y*n.y+z*n.z);x-=inward*n.x;y-=inward*n.y;z-=inward*n.z;
      if(Math.hypot(x,y,z)<.1){x=n.z;y=0;z=-n.x;if(Math.hypot(x,z)<.1)x=1;}
      x+=n.x*.06;y+=n.y*.06;z+=n.z*.06;
      const ahead={x:x*sign,y:y*sign,z:z*sign},origin={x:0,y:0,z:0};
      s.heading=bearing(origin,ahead);s.pitch=clamp(elevation(origin,ahead),-85,85);
      s.speed=sign*MIN_IMPULSE_SPEED;s.flightVelocity=null;s.coastingTurn=false;s.flightAcceleration=0;s.verticalThrust=0;if(s===this.player)s.throttle=0;
    }
    get contact(){const p=this.player;return this.output(p,'sensors')>=3.5&&p.integrity.sensors>12&&distance(p,this.enemy)<2000;}
    get detailed(){return this.contact&&(this.output(this.player,'sensors')>=10||this.scanUntil>this.time);}
    get yorktownTelemetry(){return this.player.integrity.sensors>=100;}
    get range(){return distance(this.player,this.enemy);}
    get lock(){return this.contact&&angle(this.player,this.enemy)<65&&!this.stationTrace(this.player,this.enemy);}
    closeBattleFire(){return this.turnBased&&!this.freeFlight&&this.turn.maneuver==='close'&&['approach','attack'].includes(this.turn.phase);}
    forwardFiringArc(type,shooter,target){return angle(shooter,target)<=65;}
    inFiringArc(type,shooter,target){
      if(this.closeBattleFire()||this.forwardFiringArc(type,shooter,target))return true;
      if(this.turnBased&&!this.freeFlight&&['approach','attack','withdraw'].includes(this.turn.phase))return !this.turn.offArcSpent?.[shooter===this.player?'player':'enemy'];
      const a=angle(shooter,target),limit=65;
      return !this.turnBased&&shooter===this.enemy&&180-a<=limit;
    }
    status(type,shooter=this.player,target=this.enemy,scheduled=true){
      if(this.freeFlight&&shooter!==this.player)return 'FREE FLIGHT / WEAPONS SECURED';
      if(this.result)return 'ENGAGEMENT ENDED';if(!this.running)return 'STANDING BY';
      if(this.freeFlight)return shooter.cooldown[type]>0?'RECHARGING':'READY';
      if(this.turnBased){const hold=this.turnStatus(type,shooter,target,scheduled);if(hold)return hold;}
      return this.weaponStatus(type,shooter,target);
    }
    weaponStatus(type,shooter,target){
      if(shooter.integrity.weapons<10||this.output(shooter,'weapons')<3)return 'WEAPONS OFFLINE';
      if(shooter.cooldown[type]>0)return 'RECHARGING';
      if(type==='torpedo'&&shooter.torpedoes<=0)return 'MAGAZINE EMPTY';
      if(shooter.energyReserve<weaponSpecs[type].reserve)return 'LOW ENERGY RESERVE';
      if(shooter.capacitor<weaponSpecs[type].energy)return 'LOW CAPACITOR';
      if(type==='phaser'&&shooter.heat>85)return 'PHASERS OVERHEATED';
      if(distance(shooter,target)>=2000||distance(shooter,target)>(type==='phaser'?1500:2000))return 'OUT OF RANGE';
      if(!this.inFiringArc(type,shooter,target))return 'OUTSIDE FIRING ARC';
      if((shooter===this.player&&!this.contact)||(this.turnBased&&shooter===this.enemy&&!this.enemyHasContact()))return 'SENSOR LOCK LOST';
      if(this.stationTrace(shooter,target))return 'K7 BLOCKING SHOT';
      return 'READY';
    }
    selfDestruct(){
      if(!this.running||this.result)return false;
      this.player.hull=0;this.result='defeat';this.running=false;
      this.events.push({type:'destroyed',ship:this.player.name,selfDestruct:true});
      this.message('COMMAND','Enterprise self-destruct initiated. Command signal terminated.');
      this.captureReplay(true);return true;
    }
    torpedoAim(origin,target,point=target){
      const d=direction(target),v={x:d.x*target.speed,y:d.y*target.speed,z:d.z*target.speed},r={x:point.x-origin.x,y:point.y-origin.y,z:point.z-origin.z};
      const a=v.x*v.x+v.y*v.y+v.z*v.z-400*400,b=2*(r.x*v.x+r.y*v.y+r.z*v.z),c=r.x*r.x+r.y*r.y+r.z*r.z,discriminant=b*b-4*a*c;
      const roots=Math.abs(a)<1e-8?(Math.abs(b)>1e-8?[-c/b]:[]):discriminant>=0?[(-b-Math.sqrt(discriminant))/(2*a),(-b+Math.sqrt(discriminant))/(2*a)]:[];
      const times=roots.filter(time=>time>0&&time<=8),time=times.length?Math.min(...times):0;
      return {x:point.x+v.x*time,y:point.y+v.y*time,z:point.z+v.z*time};
    }
    fire(type,shooter=this.player,target=this.enemy,scheduled=true){
      const status=this.status(type,shooter,target,scheduled);if(status!=='READY')return false;
      if(shooter===this.player&&this.beforePlayerFire?.(type,scheduled)===false)return false;
      if(this.freeFlight){
        shooter.cooldown[type]=type==='phaser'?1.65:5.5;this.shots++;
        if(type==='phaser')this.events.push({type:'beam',from:shooter.name,to:target.name,duration:PHASER_DURATION,practice:true});
        else{
          const d=direction(shooter),pos={x:shooter.x+d.x*30,y:shooter.y+d.y*30,z:shooter.z+d.z*30};
          this.projectiles.push({id:this.time+'-'+shooter.name,from:shooter.name,target:target.name,pos,life:0,maxLife:8,heading:shooter.heading,pitch:shooter.pitch,practice:true});
          this.events.push({type:'launch',from:shooter.name,to:target.name,practice:true});
        }
        return true;
      }
      if(this.turnBased&&!this.closeBattleFire()&&!this.forwardFiringArc(type,shooter,target)){
        this.turn.offArcSpent??={player:false,enemy:false};this.turn.offArcSpent[shooter===this.player?'player':'enemy']=true;
      }
      const order=this.turnBased&&scheduled?this.nextOrder(shooter):null;
      const opportunity=order&&order!==this.nextPlannedOrder(shooter);
      if(opportunity)this.events.push({type:'opportunity-attack',ship:shooter.name,weapon:type,target:order.target,stage:this.turn.stageIndex,assignedManeuvers:order.maneuvers?[...order.maneuvers]:null});
      if(order){order.status=type==='phaser'?'hit':'in-flight';order.firedAt=this.time;if(shooter===this.player)order.firedStage=this.turn.stageIndex;if(this.turn.phase==='approach')this.setPhase('attack');}
      if(this.turnBased)this.turn.spent[shooter===this.player?'player':'enemy'][type]++;
      this.drawEnergy(shooter,weaponSpecs[type].reserve);
      shooter.capacitor-=weaponSpecs[type].energy;shooter.cooldown[type]=type==='phaser'?1.65:5.5;
      const optimal=weaponSpecs[type].optimal,inBand=distance(shooter,target)>=optimal[0]&&distance(shooter,target)<=optimal[1];
      const strength=clamp(this.output(shooter,'weapons')/25,.2,1.6)*(shooter===this.enemy?.9:1)*(order&&inBand?1.15:1);
      if(shooter===this.player)this.shots++;
      if(type==='phaser'){
        const aim=order?order.target:shooter===this.player?this.target:null,hit=this.resolveWeaponHit?.(shooter,target,aim,'phaser');
        const missed=!!this.resolveWeaponHit&&!hit;
        shooter.heat+=23;this.events.push({type:'beam',from:shooter.name,to:target.name,duration:PHASER_DURATION,hit,missed});
        if(!missed)this.damage(target,shooter,17*strength,'phaser',aim,hit);
      }else{
        shooter.torpedoes--;const aft=shooter===this.enemy&&angle(shooter,target)>90,close=this.closeBattleFire()||this.turnBased&&!this.forwardFiringArc(type,shooter,target),r=distance(shooter,target)||1,d=close?{x:(target.x-shooter.x)/r,y:(target.y-shooter.y)/r,z:(target.z-shooter.z)/r}:direction(shooter),sign=!close&&aft?-1:1,pos={x:shooter.x+d.x*30*sign,y:shooter.y+d.y*30*sign,z:shooter.z+d.z*30*sign};
        const targetSystem=order?order.target:shooter===this.player?this.target:null,contact=this.resolveWeaponHit?.(shooter,target,targetSystem,'torpedo');
        const aim=this.torpedoAim(pos,target,contact?.worldPoint||target);
        this.projectiles.push({id:this.time+'-'+shooter.name,from:shooter.name,target:target.name,pos,life:0,maxLife:8,strength,targetSystem,order,heading:bearing(pos,aim),pitch:elevation(pos,aim)});
        this.events.push({type:'launch',from:shooter.name,to:target.name});
      }return true;
    }
    damage(target,source,amount,weapon,aim,hit=null){
      if(this.freeFlight||this.result)return;
      const damageRoll=amount>0&&Object.hasOwn(weaponSpecs,weapon)?1+(this.random()*2-1)*COMBAT_VARIATION.damage:1;
      amount*=damageRoll;
      if(source===this.enemy)amount*=this.difficultyProfile.enemyDamage;
      const arc=facing(target,source),shield=target.shields[arc],hullBefore=target.hull;
      const opening=target.phaserCombo;
      const combo=weapon==='torpedo'&&this.turnBased&&!!this.turn.orders&&opening?.source===source.name&&opening.turn===this.turn.number&&opening.arc===arc&&opening.hits>=2&&!opening.used&&this.time<=opening.until;
      if(combo)opening.used=true;
      let disrupted=false;
      if(weapon==='phaser'&&amount>0&&this.turnBased&&this.turn.orders){
        if(source===this.player&&this.turn.maneuver==='direct')this.turn.navigation.salvoFocus={arc,at:this.time};
        const same=opening?.source===source.name&&opening.turn===this.turn.number&&opening.arc===arc;
        target.phaserCombo=same?{...opening,hits:opening.hits+1}:{source:source.name,turn:this.turn.number,arc,hits:1,until:0,used:false};
        if(target.phaserCombo.hits===2){target.phaserCombo.until=this.time+COMBO.window;disrupted=true;}
      }
      const shieldAim=typeof aim==='string'&&aim.startsWith('shield-');
      if(shieldAim&&aim.slice(7)===arc)amount*=1.3;
      const shieldDamage=amount*(weapon==='phaser'?2.8:1.95);
      target.shields[arc]=clamp(shield-shieldDamage);target.lastHit=this.time;
      // Weakened shields leak sooner, and an overloaded hit can penetrate immediately.
      const protection=combo?Math.min(shield,20):shield;
      const penetration=protection<40?.65+(40-protection)/80:Math.max(0,shieldDamage-protection)/Math.max(shieldDamage,1)*.7;
      const hullMultiplier=protection<25?VULNERABILITY.exposedHull:VULNERABILITY.penetratingHull;
      const calculatedHullDamage=amount*penetration*(weapon==='torpedo'?1.35:.65)*.18*(aim==='hull'?1.35:1)*hullMultiplier;
      target.hull=clamp(target.hull-calculatedHullDamage);
      const hullDamage=hullBefore-target.hull;
      this.drawEnergy(target,(shield-target.shields[arc])*.035+Math.min(hullDamage,hullBefore)*.6);
      let system=null;
      if(hullDamage>0){
        const available=[...systems,'reactor','bridge','mainEngines'];system=hit&&available.includes(hit.component)?hit.component:aim&&aim!=='hull'&&!shieldAim&&Object.hasOwn(targets,aim)&&this.random()<.78?aim:available[Math.floor(this.random()*available.length)];
        // Internal bulkheads soften the escalation: +20% system damage, not +50%.
        const systemDamage=hullDamage/hullMultiplier*VULNERABILITY.subsystems*(combo?COMBO.systemMultiplier:1);
        if(system==='reactor')target.reactor=clamp(target.reactor-systemDamage,12,100);
        else target.integrity[system]=clamp(target.integrity[system]-systemDamage*1.8);
        // Damage to power conduits also cuts total available output.
        target.reactor=clamp(target.reactor-systemDamage*.12,12,100);
      }
      let failure=null;
      if(hullDamage>0&&target.hull>0&&target.shields[arc]===0&&this.time>=(target.nextSystemFailure??0)&&this.random()<COMBAT_VARIATION.failureChance){
        const candidates=systems.filter(key=>key!=='shields'&&target.integrity[key]>12&&this.output(target,key)>3.5);
        if(candidates.length){
          failure=candidates.includes(system)?system:candidates[Math.floor(this.random()*candidates.length)];
          target.systemFailures??={};target.systemFailures[failure]=this.time+COMBAT_VARIATION.failureDuration;
          target.nextSystemFailure=this.time+COMBAT_VARIATION.failureCooldown;
          this.events.push({type:'system-failure',ship:target.name,system:failure,until:target.systemFailures[failure],duration:COMBAT_VARIATION.failureDuration});
          this.message(target===this.player?'DAMAGE':'TACTICAL',`${target.name}: ${failure} temporarily offline after shield breach. Rerouting power (${COMBAT_VARIATION.failureDuration}s).`);
        }
      }
      let scorePoints=0;
      if(source===this.player){this.hits++;scorePoints=this.scoreHit(shield-target.shields[arc],Math.min(hullDamage,hullBefore),weapon);}
      else if(target===this.player){this.battleStats.chain=0;this.battleStats.lastScoredAt=-Infinity;}
      this.events.push({type:'impact',ship:target.name,arc,hullDamage,amount,weapon,system,hit,damageRoll,failure,scorePoints,chain:this.activeChain,combo,shieldBroken:shield>0&&target.shields[arc]===0,shieldDepleted:target.shields[arc]===0});
      if(hullDamage>0&&['port','starboard'].includes(hit?.pylonSide)&&!target.detachedNacelles?.[hit.pylonSide]){

        target.detachedNacelles??={port:false,starboard:false};target.detachedNacelles[hit.pylonSide]=true;
        target.integrity.mainEngines=Math.min(target.integrity.mainEngines,100-50*Object.values(target.detachedNacelles).filter(Boolean).length);
        this.events.push({type:'nacelle-detached',ship:target.name,side:hit.pylonSide,point:hit.point});
        if(target===this.player&&this.enemyPersonality==='hunter'){
          this.enemyMind.nextThink=0;this.enemyMind.appliedTactic=null;
          const side=this.enemyWarpEngineSide();
          if(this.enemyHasContact(true))for(const order of this.turn.enemyOrders||[])if(order.status==='pending'){
            order.attackArc=side||this.enemyAttackArc();
            order.target=side?(order.weapon==='phaser'&&target.shields[side]>=25?'shield-'+side:'mainEngines'):this.enemyInternalTarget();
          }
        }
        if(target===this.player&&this.previewNacelleBreakoff){
          const remaining=this.previewEngineSide();
          if(!remaining)this.previewNacelleBreakoff=false;
          else for(const order of this.turn.enemyOrders||[])if(order.status==='pending'){order.target='mainEngines';order.attackArc=remaining;}
        }
      }
      if(disrupted&&target.hull>0)this.events.push({type:'shield-disrupted',ship:target.name,from:source.name,arc,until:target.phaserCombo.until,duration:COMBO.window});
      if(target===this.player||hullDamage>0||target.shields[arc]===0)this.message(target===this.player?'DAMAGE':'TACTICAL',`${target.name}: ${arc} shield ${Math.round(target.shields[arc])}%${hullDamage>0?`; hull hit${system?' / '+system+' damaged':''}`:'.'}`);
      if(target.hull<=0&&!this.result){this.result=target===this.enemy?'victory':'defeat';this.running=false;this.completeBattleScore();this.events.push({type:'destroyed',ship:target.name});this.message('COMMAND',target===this.enemy?'Yorktown neutralized. Stand down from red alert.':'Enterprise lost. Command signal terminated.');this.captureReplay(true);}
    }
    scan(){if(!this.running||!this.maneuvering||this.result||this.player.cooldown.scan>0||this.output(this.player,'sensors')<3.5||this.player.capacitor<12||this.player.energyReserve<2)return false;this.drawEnergy(this.player,2);this.player.capacitor-=12;this.player.cooldown.scan=14;this.scanUntil=this.time+8;this.message('SCIENCE','Active sweep. Target subsystem telemetry resolved for eight seconds.');this.events.push({type:'scan'});return true;}
    get warpUsed(){return this.warpCharges<=0;}
    warp(){
      if(this.turnBased&&this.turn.phase==='closing')return false;
      if(!this.running||!this.maneuvering||this.result||this.warpUsed||this.player.hull<=0||this.player.energyReserve<12)return false;
      const p=this.player,d=direction(p),from={x:p.x,y:p.y,z:p.z};
      const destination={x:p.x+d.x*3000,y:p.y+d.y*3000,z:p.z+d.z*3000};
      if(this.stationTrace(destination,destination,45)){this.message('HELM','Warp destination obstructed by K7. Change heading before jumping.');return false;}
      if(distance(destination,this.planet)<this.planet.radius+this.planet.atmosphere+120){this.message('HELM','Warp destination inside the planet. Change heading before jumping.');return false;}
      this.drawEnergy(p,12);
      Object.assign(p,destination);
      this.warpCharges--;
      this.events.push({type:'warp',from,to:{x:p.x,y:p.y,z:p.z},direction:d});
      this.message('HELM','Emergency warp complete: 30 km along current heading and pitch. Warp charge spent.');
      return true;
    }
    stopEnterprise(){
      if(this.result||this.player.hull<=0)return false;
      Object.assign(this.player,{fullStop:true,throttle:0,speed:0,flightAcceleration:0,flightVelocity:null,coastingTurn:false,turnRate:0,pitchRate:0,bank:0});return true;
    }
    slowAhead(){this.player.fullStop=false;this.player.throttle=0;this.player.speed=MIN_IMPULSE_SPEED;this.player.flightAcceleration=0;}
    repair(key){if(![...systems,'reactor','bridge','mainEngines'].includes(key))return;this.player.repair=key;}
    advanceOpeningApproach(dt){
      const t=this.turn,step=Math.min(dt,t.remaining),p=this.player,e=this.enemy;
      const progress=clamp((t.elapsed+step)/TURN.closing,0,1),blend=progress*progress*(3-2*progress);
      for(const [s,target] of [[p,e],[e,p]]){
        let aim=this.avoidShipCollision(s,target,{x:target.x,y:s.y,z:target.z});
        const blocked=this.stationTrace(s,aim,90);
        if(blocked)aim={x:s.x,y:this.station.y+600,z:s.z};
        this.steerFlight(s,aim,step,26,18,!!blocked);
        s.fullStop=false;s.coastingTurn=false;s.verticalThrust=0;s.speedIntent='INITIAL APPROACH';
        this.easeFlightSpeed(s,Math.min(120,Math.max(MIN_IMPULSE_SPEED,(this.range-800)/12))*this.flightMobility(s),step);
        const previous={x:s.x,y:s.y,z:s.z},v=this.moveFlightVelocity(s,step);
        if(!blocked&&step>0){
          const start=t.approachElevations[s.name],altitude=t.approachAltitude+Math.sign(start-t.approachAltitude)*40;
          const desiredY=start+(altitude-start)*blend,limit=45*this.flightMobility(s);
          s.verticalThrust=clamp((desiredY-s.y)/step-v.y,-limit,limit);
        }
        s.x+=v.x*step;s.y+=(v.y+s.verticalThrust)*step;s.z+=v.z*step;
        this.moveAroundStation(s,previous);this.moveAroundPlanet(s,previous);
      }
      this.time+=step;t.elapsed+=step;t.remaining=Math.max(0,TURN.closing-t.elapsed);
      if(t.remaining<1e-8){
        p.verticalThrust=e.verticalThrust=0;
        t.executionDeadline=this.time+TURN.execution;
        this.startStage(t.maneuvers.findIndex(Boolean));
      }
      this.captureReplay(true);
    }
    tick(dt,keys={}){
      if(!this.running||this.result)return;dt=clamp(dt,0,.1);
      if(this.turnBased&&!this.freeFlight&&this.turn.phase==='closing'){this.advanceOpeningApproach(dt);return;}
      if(this.captainEnabled)this.updateCaptain();
      if(this.turnBased&&!this.advanceTurn(dt))return;
      if(this.result||!this.maneuvering){this.captureReplay(true);return;}
      this.time+=dt;
      for(const ship of [this.player,this.enemy])for(const [system,until] of Object.entries(ship.systemFailures||{}))if(until<=this.time){
        delete ship.systemFailures[system];this.events.push({type:'system-restored',ship:ship.name,system});
        this.message(ship===this.player?'DAMAGE':'TACTICAL',`${ship.name}: ${system} power restored.`);
      }
      const p=this.player,e=this.enemy;
      if(keys.more||keys.less||p.throttle!==0)p.fullStop=false;
      if(keys.stop)this.stopEnterprise();
      const previousPositions={[p.name]:{x:p.x,y:p.y,z:p.z},[e.name]:{x:e.x,y:e.y,z:e.z}};
      const turn=(keys.right?1:0)-(keys.left?1:0),tilt=(keys.down?1:0)-(keys.up?1:0);
      const mobility=this.flightMobility(p);
      if(this.turnBased){if(!p.fullStop)this.autoHelm(dt,keys);}
      else{
      if(turn){
        const maxRate=42*mobility;
        p.turnRate=clamp(p.turnRate+turn*28*mobility*dt,-maxRate,maxRate);
        if(Math.abs(p.turnRate)<.05)p.turnRate=0;
        const bank=-p.turnRate/maxRate*MAX_BANK;p.bank+=(bank-p.bank)*(1-Math.exp(-2.2*dt));
      }
      // Releasing steering preserves the selected yaw rate and bank angle.
      p.heading=wrap(p.heading+p.turnRate*dt);p.pitch=clamp(p.pitch+tilt*30*mobility*dt,-85,85);
      p.throttle=clamp(p.throttle+((keys.more?1:0)-(keys.less?1:0))*30*dt,-100,100);
      if(keys.stop)this.stopEnterprise();
      }
      if(!this.turnBased&&!p.fullStop){
      const commanded=p.throttle/100*125*mobility*IMPULSE_SPEED_MULTIPLIER;
      const desired=this.planetSpeedLimit(p,(Math.sign(commanded)||1)*Math.max(MIN_IMPULSE_SPEED,Math.abs(commanded)));
      if(p.speed*desired<0){
        p.speed=Math.abs(p.speed)<=MIN_IMPULSE_SPEED+.001?Math.sign(desired)*MIN_IMPULSE_SPEED:Math.sign(p.speed)*Math.max(MIN_IMPULSE_SPEED,Math.abs(p.speed)-FLIGHT_BRAKING*dt);
        p.flightAcceleration=0;
      }else{const sign=Math.sign(desired);p.speed=Math.abs(p.speed);this.easeFlightSpeed(p,Math.abs(desired),dt,FLIGHT_ACCELERATION*Math.max(.35,mobility),FLIGHT_BRAKING);p.speed*=sign;}
      if(Math.abs(p.speed)<MIN_IMPULSE_SPEED)p.speed=Math.sign(desired)*MIN_IMPULSE_SPEED;
      }
      const repairPursuit=this.enemyPursuesRepairs(),pressing=this.enemyPressesAdvantage();if(pressing)this.enemyRetreating=false;
      if(!pressing&&!this.freeFlight&&e.hull<this.enemyPersonalityProfile.retreatHull&&!this.enemyRetreating&&this.time>=(this.enemyMind.reengageUntil||0)){
        this.enemyRetreating=true;
        Object.assign(e.power,{engines:45,shields:35,weapons:10,sensors:10});
        e.repair='engines';
        this.message('TACTICAL','Yorktown is badly damaged and attempting to retreat.');
      }
      const m=this.enemyMind,runningAway=!pressing&&!this.freeFlight&&this.time>=(m.reengageUntil||0)&&this.enemyRetreating;
      if(runningAway){m.runAwaySince??=this.time;if(this.time-m.runAwaySince>=10-1e-8)this.reengageEnemy();}
      else m.runAwaySince=null;
      const enemyReturning=!pressing&&!this.freeFlight&&m.reengageUntil>this.time;
      if(this.turnBased)this.thinkEnemy();
      const enemyLocked=!this.turnBased||this.enemyHasContact(),enemyTarget=this.turnBased?this.enemyTrack():p;
      const range=this.range,weak=Object.entries(p.shields).sort((a,b)=>a[1]-b[1])[0][0];
      const flank={fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0}[weak]+p.heading;
      const waypoint=range<800?{x:p.x+Math.sin(flank*RAD)*430,y:p.y+(weak==='dorsal'?270:weak==='ventral'?-270:Math.sin(this.time*.055)*80),z:p.z-Math.cos(flank*RAD)*430}:p;
      const attackRun=range<1450&&(this.aiShot<1.5||this.aiTorp<1.5);
      const away={x:e.x+(e.x-enemyTarget.x),y:e.y+(e.y-enemyTarget.y),z:e.z+(e.z-enemyTarget.z)};
      if(distance(enemyTarget,e)<1){const d=direction(e);away.x=e.x+d.x*1000;away.y=e.y+d.y*1000;away.z=e.z+d.z*1000;}
      let aim=enemyReturning?enemyTarget:this.enemyRetreating?away:this.turnBased?enemyTarget:pressing||attackRun?p:waypoint;
      if(this.freeFlight){const o=this.freeFlightOrbit,a=o.angle+.25;aim={x:this.station.x+Math.cos(a)*o.radius,y:this.station.y+o.height,z:this.station.z+Math.sin(a)*o.radius};}
      const enemyOrder=this.nextPlannedOrder(e);let enemyPositioning=!enemyLocked;
      if(this.turnBased&&enemyLocked&&this.turn.phase!=='disengage'&&!this.enemyRetreating&&!repairPursuit&&enemyOrder&&(enemyOrder.attackArc||enemyOrder.target.startsWith('shield-'))){
        const sector=enemyOrder.attackArc||enemyOrder.target.slice(7),offset={fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0}[sector],a=(p.heading+offset)*RAD;
        if(facing(p,e)!==sector){enemyPositioning=true;const vertical=sector==='dorsal'||sector==='ventral',offset=enemyOrder.range*.8;aim={x:p.x+(vertical?0:Math.sin(a)*offset),y:p.y+(sector==='dorsal'?offset:sector==='ventral'?-offset:0),z:p.z-(vertical?0:Math.cos(a)*offset)};}
      }
      if(this.turnBased&&enemyLocked&&!this.enemyRetreating&&this.turn.phase!=='disengage'){
        if(this.enemyMind.evadeUntil>this.time&&this.enemyMind.evadeAim){aim=this.enemyMind.evadeAim;enemyPositioning=true;}
        else if(!enemyPositioning&&enemyOrder?.weapon==='torpedo'){
          const lead=direction(p),seconds=Math.min(1.5,this.range/400*.3);aim={x:p.x+lead.x*p.speed*seconds,y:p.y+lead.y*p.speed*seconds,z:p.z+lead.z*p.speed*seconds};
        }
      }
      if(!pressing&&enemyOrder&&enemyLocked&&!enemyPositioning&&angle(e,p)>90&&this.inFiringArc(enemyOrder.weapon,e,p)&&this.range<=enemyOrder.range&&!enemyReturning){const d=direction(e);aim={x:e.x+d.x*1000,y:e.y+d.y*1000,z:e.z+d.z*1000};}
      if(enemyReturning){aim=this.enemyReturnAim(enemyTarget);enemyPositioning=!m.returnLegComplete;}
      const enemyReacquiring=!this.enemyRetreating&&enemyLocked&&this.time<(m.circleReengageUntil||0);
      if(enemyReacquiring){aim=enemyTarget;enemyPositioning=false;}
      const enemyBreakout=this.circlingBreakaway(dt,e);
      if(enemyBreakout){aim=enemyBreakout;enemyPositioning=false;}
      if(!this.freeFlight)aim=this.avoidShipCollision(e,p,aim);
      const forward=direction(e),ahead={x:e.x+forward.x*300,y:e.y+forward.y*300,z:e.z+forward.z*300};
      let enemyAvoiding=!!(this.stationTrace(e,aim,90)||this.stationTrace(e,ahead,90));
      if(enemyAvoiding){m.stationSide??=e.x>=this.station.x?1:-1;m.stationClearFor=0;}
      else m.stationClearFor=(m.stationClearFor||0)+dt;
      if(m.stationSide&&m.stationClearFor<1.5)enemyAvoiding=true;
      else if(!enemyAvoiding)m.stationSide=null;
      if(enemyAvoiding){
        aim={x:this.station.x+m.stationSide*430*this.station.scale,y:this.station.y+330*this.station.scale,z:this.station.z};
      }
      const rate=26*this.flightMobility(e,.1,1.5);
      const coasting=this.turnBased&&this.turn.stageCompletedAt!==null&&this.nextStageIndex()<0;
      const enemyEvading=m.evadeUntil>this.time&&aim===m.evadeAim;
      if(!this.freeFlight&&!coasting)this.steerFlight(e,aim,dt,rate,18,enemyAvoiding||!!e.collisionAvoidance||enemyEvading,!!enemyBreakout,!!enemyBreakout);
      if(this.turnBased&&!coasting){
        const mode=enemyBreakout?'breakaway':enemyReacquiring?'attack':enemyReturning?'position':this.enemyRetreating?'escape':repairPursuit&&!enemyPositioning&&!enemyAvoiding?'pursuit':this.turn.phase==='disengage'||!enemyOrder?'pursuit':enemyPositioning||enemyAvoiding?'position':'attack';
        this.adjustFlightSpeed(e,enemyTarget,aim,{mode,order:enemyOrder,avoiding:enemyAvoiding,turnRate:rate},dt);
      }else if(!this.turnBased)this.easeFlightSpeed(e,this.freeFlight?Math.max(MIN_IMPULSE_SPEED,55*this.nacelleSpeedFactor(e)):Math.max(MIN_IMPULSE_SPEED,(this.enemyRetreating?110:range>700?70:range<240?20:43)*this.flightMobility(e,.1,1.5)*IMPULSE_SPEED_MULTIPLIER),dt);
      if(p.fullStop){p.speed=0;p.throttle=0;p.flightAcceleration=0;}
      for(const s of [p,e]){
        const previous={x:s.x,y:s.y,z:s.z};
        if(this.freeFlight&&s===e)this.flyYorktownOrbit(dt);
        else{const v=this.moveFlightVelocity(s,dt);s.x+=v.x*dt;s.y+=(v.y+(s===p&&this.turnBased&&!this.freeFlight&&!p.fullStop&&!p.coastingTurn?p.verticalThrust||0:0))*dt;s.z+=v.z*dt;this.moveAroundStation(s,previous);this.moveAroundPlanet(s,previous);}
        for(const key of Object.keys(s.cooldown))s.cooldown[key]=Math.max(0,s.cooldown[key]-dt);
        const capacitorBefore=s.capacitor,shieldsBefore=arcs.reduce((sum,a)=>sum+s.shields[a],0),partsBefore=s.repairBudget;
        const reserveSupply=(.25+.75*clamp(s.energyReserve/15,0,1))*this.nacelleSpeedFactor(s);
        s.capacitor=clamp(s.capacitor+this.output(s,'weapons')*.42*reserveSupply*dt);s.heat=Math.max(0,s.heat-dt*(5+this.output(s,'weapons')*.12));
        for(const a of arcs)s.shields[a]=clamp(s.shields[a]+this.output(s,'shields')*.03*VULNERABILITY.shieldRecharge*reserveSupply*(this.turnBased?.3:1)*(s.bias[a]/16.667)*dt*(this.time-s.lastHit>3?1:.18));
        if(s.repairBudget>0&&this.time-s.lastHit>6){const key=s.repair,current=key==='hull'?s.hull:key==='reactor'?s.reactor:s.integrity[key],gain=Math.min(100-current,dt*(key==='hull'?.35:.65),s.repairBudget);if(key==='reactor')s.reactor+=gain;else if(key==='hull')s.hull+=gain;else s.integrity[key]+=gain;s.repairBudget-=gain;}
        this.updateEnergy(s,dt,s.capacitor-capacitorBefore,arcs.reduce((sum,a)=>sum+s.shields[a],0)-shieldsBefore,partsBefore-s.repairBudget);
      }
      this.resolveShipCollision(previousPositions);
      // Yorktown tracks through a low-visibility region, but needs a closer fire solution.
      this.aiShot-=dt;this.aiTorp-=dt;
      if(!this.turnBased&&(!this.enemyRetreating||angle(e,p)>90&&this.inFiringArc('phaser',e,p))&&this.aiShot<=0&&range<(this.environment==='nebula'?1250:1500)&&this.fire('phaser',e,p))this.aiShot=4.2;
      if(!this.turnBased&&(!this.enemyRetreating||angle(e,p)>90&&this.inFiringArc('torpedo',e,p))&&this.aiTorp<=0&&range<1800&&this.fire('torpedo',e,p))this.aiTorp=11;
      for(const t of [...this.projectiles]){
        t.life+=dt;const target=t.target===p.name?p:e;
        const d=direction(t),step=400*dt;
        const end={x:t.pos.x+d.x*step,y:t.pos.y+d.y*step,z:t.pos.z+d.z*step};
        if(t.practice){
          if(t.life>=t.maxLife)this.projectiles.splice(this.projectiles.indexOf(t),1);
          else Object.assign(t.pos,end);
          continue;
        }
        const previousTarget=previousPositions[target.name],rx=t.pos.x-previousTarget.x,ry=t.pos.y-previousTarget.y,rz=t.pos.z-previousTarget.z;
        const vx=end.x-target.x-rx,vy=end.y-target.y-ry,vz=end.z-target.z-rz,denominator=vx*vx+vy*vy+vz*vz;
        const fraction=denominator?clamp(-(rx*vx+ry*vy+rz*vz)/denominator,0,1):0;
        const near=Math.hypot(rx+vx*fraction,ry+vy*fraction,rz+vz*fraction)<(this.resolveWeaponHit?100:40);
        const source=t.from===p.name?p:e,hit=near?this.resolveWeaponHit?.(source,target,t.targetSystem,'torpedo',t.pos,end):null;
        const struck=!t.missReported&&near&&(!this.resolveWeaponHit||!!hit);
        const obstruction=this.stationTrace(t.pos,end,2);
        if(obstruction){this.events.push({type:'station-impact',pos:obstruction.pos,weapon:'torpedo'});this.reportTorpedoMiss(t,'blocked');this.projectiles.splice(this.projectiles.indexOf(t),1);}
        else if(struck){if(t.order)t.order.status='hit';this.damage(target,source,38*t.strength,'torpedo',t.targetSystem,hit);this.projectiles.splice(this.projectiles.indexOf(t),1);}
        else if(t.life>t.maxLife){this.reportTorpedoMiss(t,'expired');this.projectiles.splice(this.projectiles.indexOf(t),1);}
        else{
          const away={x:end.x-target.x,y:end.y-target.y,z:end.z-target.z};
          const pastHull=away.x*d.x+away.y*d.y+away.z*d.z>180;
          const receding=away.x*vx+away.y*vy+away.z*vz>0;
          if(pastHull&&receding)this.reportTorpedoMiss(t,'passed');
          Object.assign(t.pos,end);
        }
      }
      this.captureReplay();
    }
  }
  return {Simulation,shipCollisionShapes,shipContact,ENEMY_PERSONALITIES,COMBAT_VARIATION,VULNERABILITY,COMBO,DEFAULT_SALVO,ATTACK_COUNT,MANEUVER_COUNT,TURN,PLANET,targets,weaponSpecs,maneuvers,PHASER_DURATION,DESTRUCTION_DURATION,MIN_IMPULSE_SPEED,K7_ROTATION_RATE,targetingColor,makeK7,clamp,wrap,delta,direction,distance,bearing,elevation,angle,facing,redistribute,arcs,systems};
});
