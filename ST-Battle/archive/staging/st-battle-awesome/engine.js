/* Standalone combat simulation. World axes: X starboard, Y up, -Z north. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Battle=factory();})(globalThis,()=>{
  const IMPULSE_SPEED_MULTIPLIER=1.5,MIN_IMPULSE_SPEED=15,PHASER_DURATION=1.4,MAX_BANK=Math.PI/6;
  const RAD=Math.PI/180,clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
  const wrap=n=>(n%360+360)%360,delta=(a,b)=>((b-a+540)%360)-180;
  const arcs=['fore','starboard','aft','port','dorsal','ventral'];
  const systems=['engines','shields','weapons','sensors'];
  const Replay=typeof module==='object'&&module.exports?require('./replay.js'):globalThis.BattleReplay;
  const DESTRUCTION_DURATION=Replay?.DESTRUCTION_DURATION??5;
  const targets={hull:'Primary hull',engines:'Impulse engines',mainEngines:'Main engines',bridge:'Bridge',shields:'Shield generators',weapons:'Weapons',sensors:'Sensors',reactor:'Reactor',...Object.fromEntries(arcs.map(a=>['shield-'+a,a[0].toUpperCase()+a.slice(1)+' shield']))};
  const weaponSpecs={phaser:{name:'Phaser',maxRange:1500,optimal:[500,1000]},torpedo:{name:'Torpedo',maxRange:1900,optimal:[300,700]}};
  const maneuvers={direct:{name:'Direct assault',description:'Close head-on, fire your sequence, then break away.'},port:{name:'Curving attack — to port',description:'Sweep to your port side before turning in to attack.'},starboard:{name:'Curving attack — to starboard',description:'Sweep to your starboard side before turning in to attack.'},above:{name:'Attack from above',description:'Climb above Yorktown, then dive into your attack run.'},below:{name:'Attack from below',description:'Descend below Yorktown, then climb into your attack run.'},behind:{name:'Attack from behind',description:'Sweep around Yorktown, get astern, then fire from behind.'},hide:{name:'Hide then direct assault',description:'Seek cover behind K7, wait six seconds, then attack.'},flee:{name:'Flee and effect repairs',description:'Withdraw for 30 seconds. Divert power and repair the most damaged areas with available parts.'}};
  const TURN={planning:30,approach:75,attack:75,disengage:6,withdraw:30,review:30};
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
  function ship(name,x,y,z,heading){return {name,x,y,z,heading,pitch:0,bank:0,turnRate:0,throttle:0,speed:MIN_IMPULSE_SPEED,hull:100,reactor:100,
    integrity:{engines:100,shields:100,weapons:100,sensors:100,bridge:100,mainEngines:100},power:{engines:24,shields:30,weapons:30,sensors:16},
    shields:Object.fromEntries(arcs.map(a=>[a,100])),bias:{fore:24,starboard:17,aft:16,port:17,dorsal:13,ventral:13},
    capacitor:100,torpedoes:24,cooldown:{phaser:0,torpedo:0,scan:0},heat:0,lastHit:-100,repair:'sensors',repairBudget:30};}
  function redistribute(map,key,value){
    const old=map[key];map[key]=clamp(value);const others=Object.keys(map).filter(k=>k!==key),total=others.reduce((s,k)=>s+map[k],0);
    for(const k of others)map[k]=(100-map[key])*(total?map[k]/total:1/others.length);
    return old!==map[key];
  }
  const targetingColor=(sim,visible)=>!sim.contact?'#a8b7c5':sim.lock&&sim.range<=1500?'#79f0a3':sim.lock||visible?'#ffad45':'#ff9c85';
  function makeK7(){
    const cargoArmLength=(246-38)/10;
    const station={cargo:{x:-(110+cargoArmLength+18),y:76,z:0,armStart:-110,armEnd:-(110+cargoArmLength)},name:'K7',x:-430,y:-20,z:-430,radius:335,scale:1.4,parts:[],pods:[]};
    const add=(x,y,z,rx,ry,rz)=>station.parts.push({x:station.x+x,y:station.y+y,z:station.z+z,rx,ry,rz});
    add(0,76,0,110,20,110);add(0,129,0,33,44,33);add(0,192,0,4,24,4);
    add(0,0,0,39,25,39);add(0,45,0,18,31,18);add(0,-45,0,13,38,13);add(0,-100,0,47,26,47);
    add(station.cargo.x,76,0,19,36,19);
    for(let i=0;i<=3;i++)add(-(110+cargoArmLength*i/3),76,0,8,8,8);
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
    constructor(seed=97,{turnBased=true,randomStart=false}={}){this.seed=seed;this.turnBased=turnBased;this.randomStart=randomStart;this.reset();}
    random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    reset(){if(this.freeFlight)this.turnBased=this.combatTurnBased;this.freeFlight=false;this.lastReplay=null;this.replayRecording=null;this.station=makeK7();this.planet={...PLANET};this.lastPlanetWarning=-10;this.player=ship('Enterprise',0,0,150,0);this.enemy=ship('Yorktown',380,150,-1600,168);this.enemy.throttle=45;this.enemyRetreating=false;this.shipsTouching=false;this.enemyMind={nextThink:0,lastKnown:null,evadeUntil:0,threatId:null,waitingOrder:null,waitingSince:0};this.warpUsed=false;this.time=0;this.running=false;this.result=null;this.events=[];this.log=[];this.projectiles=[];this.target='hull';this.environment='nebula';this.scanUntil=0;this.aiShot=6;this.aiTorp=11;this.hits=0;this.shots=0;this.resetBattleStats();this.initTurns();if(this.randomStart)this.randomizeStartingPositions();this.message('COMMAND','Yorktown is hunting you. All stations, stand by.');}
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
      const [lo,hi]=weaponSpecs[weapon].optimal,optimal=this.range>=lo&&this.range<=hi;if(optimal)stats.optimalHits++;
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
      this.message('CONN','Free flight. Manual helm. F fires practice phasers; T launches practice torpedoes. No damage. Yorktown is cruising near K7.');
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
        const radius=1000+this.random()*400;
        s.x=k.x+Math.cos(a)*radius;s.z=k.z+Math.sin(a)*radius;s.y=k.y-100+this.random()*350;
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
      return sign*Math.min(Math.abs(desired),Math.max(MIN_IMPULSE_SPEED,Math.sqrt(2*65*Math.max(0,approach-150))));
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
    output(s,key){return s.power[key]*s.reactor/100*s.integrity[key]/100*(.5+s.integrity.bridge/200)*(key==='engines'?.35+s.integrity.mainEngines*.0065:1);}
    initTurns(){
      this.turn={number:1,phase:'planning',remaining:TURN.planning,elapsed:0,revisions:2,
        draft:[null,null,null],draftManeuvers:[null,null,null],draftManeuver:null,maneuvers:null,stageIndex:0,maneuver:null,navigation:null,orders:null,enemyOrders:null,spent:{player:{phaser:0,torpedo:0},enemy:{phaser:0,torpedo:0}},baseline:null,report:null};
    }
    get maneuvering(){return !this.turnBased||!['planning','review'].includes(this.turn.phase);}
    snapshot(){return [this.player,this.enemy].map(s=>({hull:s.hull,shields:{...s.shields},integrity:{...s.integrity},reactor:s.reactor}));}
    setPhase(phase){const t=this.turn;t.phase=phase;t.remaining=TURN[phase];t.elapsed=0;this.events.push({type:'phase',phase,pass:t.number});}
    applyPlanPreset(style){
      if(!this.turnBased||this.freeFlight||this.result||!['planning','review'].includes(this.turn.phase))return false;
      const presets={
        timid:{routes:['hide','port','flee'],shots:[['phaser','weapons',1400,0],['phaser','weapons',1200,1],['torpedo','engines',1600,1]]},
        strong:{routes:['port','above','direct'],shots:[['phaser','shields',1000,0],['phaser','weapons',750,1],['torpedo','hull',650,2]]},
        aggressive:{routes:['direct','above','behind'],shots:[['phaser','weapons',700,0],['phaser','bridge',550,1],['torpedo','reactor',350,2]]}
      },preset=Object.hasOwn(presets,style)?presets[style]:null;if(!preset)return false;
      const draft=preset.shots.map(([weapon,target,range,maneuver])=>({weapon,target,range,maneuvers:[maneuver]}));
      if(!this.planReady(draft,preset.routes))return false;
      Object.assign(this.turn,{draft,draftManeuvers:[...preset.routes],draftManeuver:preset.routes[0]});return true;
    }
    randomizePlan(){return this.bestGuessPlan();}
    bestGuessPlan(){
      if(!this.turnBased||this.freeFlight||this.result||!['planning','review'].includes(this.turn.phase))return false;
      const p=this.player,seen=this.captainObservation(),repairable=p.repairBudget>0;
      const finishNow=seen.detailed&&seen.hull<=1&&seen.shields[facing(seen,p)]<25&&distance(p,seen)<=700&&angle(p,seen)<28&&p.torpedoes>0&&p.capacitor>=24&&p.cooldown.torpedo===0&&p.integrity.weapons>=10&&p.reactor>=25&&!this.stationTrace(p,seen);
      const emergency=!finishNow&&repairable&&(p.hull<32||p.integrity.weapons<10||p.integrity.engines<12||p.integrity.mainEngines<15||p.integrity.sensors<10||p.reactor<25);
      const noWeapons=p.integrity.weapons<10;
      if(emergency||noWeapons){
        Object.assign(this.turn,{draft:[null,null,null],draftManeuvers:['flee',null,null],draftManeuver:'flee'});
        this.captainStatus=repairable?'Withdraw, recharge shields and repair the weakest essential system.':'Disengage: preserve Enterprise while weapons or hull are critical.';return true;
      }
      const arc=seen.detailed?this.captainAttackArc(seen):null;
      const candidates=['direct','port','starboard','above','below','behind','hide'].map(route=>({route,score:this.captainRouteScore(route,seen,arc)})).sort((a,b)=>a.score-b.score);
      const first=candidates[0].route,routes=[first,null,null],internal=this.captainInternalTarget(seen),breached=seen.detailed&&seen.shields[arc]<25;
      const phaseTarget=seen.detailed&&!breached?'shield-'+arc:internal;
      const fleeing=this.captainTargetEscaping(seen),longRange=fleeing&&p.integrity.engines<60;
      const cautious=p.hull<50||p.capacitor<35||p.heat>70;
      const phasers=[{weapon:'phaser',target:phaseTarget,range:longRange?1500:1000,maneuvers:[0]},
        {weapon:'phaser',target:phaseTarget,range:longRange?1500:cautious?1000:900,maneuvers:[0]}];
      const torpedo={weapon:'torpedo',target:internal,range:finishNow?700:longRange?1800:cautious?700:650,maneuvers:[0]};
      const draft=breached&&p.torpedoes>0&&p.cooldown.torpedo<=2?[torpedo,...phasers]:[...phasers,torpedo];
      if(arc)for(const order of draft)order.attackArc=arc;
      if(!this.planReady(draft,routes))return false;
      Object.assign(this.turn,{draft,draftManeuvers:routes,draftManeuver:first});this.playerMind.arc=arc;
      this.captainStatus=!seen.contact?'Restore sensors and close on the last known contact.':breached?'Exploit the '+arc+' breach; '+internal+' targeted.':'Open the '+(arc||'facing')+' shield, then hit '+internal+'.';return true;
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
      if(route==='port'||route==='starboard'){const sign=route==='port'?-1:1;point.x+=right.x*900*sign;point.z+=right.z*900*sign;}
      if(route==='above'||route==='below')point.y+=route==='above'?800:-800;
      if(route==='behind')point=this.captainArcPoint(seen,'aft',650);
      if(route==='hide'){const k=this.station,d=distance(k,seen)||1,r=k.radius+240;point={x:k.x+(k.x-seen.x)/d*r,y:k.y+(k.y-seen.y)/d*r,z:k.z+(k.z-seen.z)/d*r};}
      let score=distance(p,point)*.03+angle(p,point)*.2+(this.stationTrace(p,point,90)?180:0)+(this.planetClearance(point)<180?1000:0);
      if(arc&&facing(seen,point)!==arc)score+=55;
      if(route==='behind')score+=20;if(route==='hide')score+=p.capacitor<35||p.heat>75?-15:80;
      if(route==='direct'&&arc&&facing(seen,p)===arc)score-=25;
      if(p.integrity.engines<35&&route!=='direct')score+=35;
      score+=(this.playerMind.failedRoutes[route]||0)*35;return score;
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
      const firing=order&&seen.contact&&distance(p,seen)<=order.range+180&&angle(p,seen)<65;
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
        const arc=t.maneuver==='behind'?'aft':seen.shields[current]<25||waited>10&&seen.shields[current]<65?current:best;
        order.attackArc=arc;m.arc=arc;
        order.target=order.weapon==='phaser'&&seen.shields[arc]>=25?'shield-'+arc:this.captainInternalTarget(seen);
        this.captainStatus=seen.shields[arc]<25?'Exploit '+arc+' breach / '+order.target+'.':'Concentrate fire on '+arc+' / shields '+Math.round(seen.shields[arc])+'%.';
      }else{delete order.attackArc;if(order.target.startsWith('shield-'))order.target='hull';this.captainStatus='Reacquire contact; avoid precision targeting without sensors.';}
      if(this.captainTargetEscaping(seen)||this.time-m.waitingSince>15)order.range=Math.min(weaponSpecs[order.weapon].maxRange,Math.max(order.range,distance(p,seen)+50));
    }
    planEnemy(){
      const p=this.player,e=this.enemy,detailed=this.enemyHasContact(true),arc=detailed?this.enemyAttackArc():facing(p,e);
      const shield=detailed?p.shields[arc]:100,internal=detailed?this.enemyInternalTarget():'hull',target=detailed&&shield>=25?'shield-'+arc:internal;
      if(this.enemyHasContact())this.rememberEnemyContact();
      const phasers=[{weapon:'phaser',target,range:1000},{weapon:'phaser',target,range:750}],torpedo={weapon:'torpedo',target:internal,range:650};
      return (detailed&&shield<25?[torpedo,...phasers]:[...phasers,torpedo]).map(order=>({...order,attackArc:detailed?arc:null}));
    }
    enemyHasContact(detailed=false){return this.range<2000&&this.enemy.integrity.sensors>12&&this.output(this.enemy,'sensors')>=(detailed?10:3.5);}
    rememberEnemyContact(){const p=this.player;this.enemyMind.lastKnown={x:p.x,y:p.y,z:p.z,heading:p.heading,pitch:p.pitch,speed:p.speed,at:this.time};}
    enemyTrack(){
      if(this.enemyHasContact()){this.rememberEnemyContact();return this.player;}
      const known=this.enemyMind.lastKnown;if(known){const age=clamp(this.time-known.at,0,8),d=direction(known);return {...known,x:known.x+d.x*known.speed*age,y:known.y+d.y*known.speed*age,z:known.z+d.z*known.speed*age};}
      const e=this.enemy,d=direction(e);return {x:e.x+d.x*1000,y:e.y+d.y*1000,z:e.z+d.z*1000,heading:e.heading,pitch:e.pitch,speed:0};
    }
    enemyAttackArc(){
      const p=this.player,e=this.enemy,exposed=facing(p,e),offset={fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0};
      let best=exposed,score=Infinity;
      for(const arc of arcs){
        const a=(p.heading+offset[arc])*RAD,vertical=arc==='dorsal'||arc==='ventral';
        const point={x:p.x+(vertical?0:Math.sin(a)*650),y:p.y+(arc==='dorsal'?650:arc==='ventral'?-650:0),z:p.z-(vertical?0:Math.cos(a)*650)};
        const cost=p.shields[arc]+(arc===exposed?-18:20)+angle(e,point)*.12+(this.stationTrace(e,point,60)?35:0);
        if(cost<score){best=arc;score=cost;}
      }return best;
    }
    enemyInternalTarget(){
      const p=this.player;if(p.hull<35)return 'hull';
      const candidates=['weapons','engines','reactor','bridge','mainEngines','sensors'].filter(key=>(key==='reactor'?p.reactor:p.integrity[key])>8);
      const weak=candidates.sort((a,b)=>(a==='reactor'?p.reactor:p.integrity[a])-(b==='reactor'?p.reactor:p.integrity[b]))[0];
      return weak&&(weak==='reactor'?p.reactor:p.integrity[weak])<60?weak:'hull';
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
    thinkEnemy(){
      const e=this.enemy,p=this.player,m=this.enemyMind;if(this.time<m.nextThink)return;m.nextThink=this.time+.75;
      const contact=this.enemyHasContact(),detailed=this.enemyHasContact(true);if(contact)this.rememberEnemyContact();
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
      if(this.enemyRetreating&&e.hull>=35&&e.integrity.engines>=40&&e.integrity.weapons>=30){this.enemyRetreating=false;this.message('TACTICAL','Yorktown has stabilized and is re-engaging.');}
      let profile,stance;
      if(this.enemyRetreating){profile={engines:45,shields:35,weapons:10,sensors:10};stance='RETREATING';}
      else if(m.reengageUntil>this.time){profile={engines:34,shields:28,weapons:26,sensors:12};stance='RE-ENGAGING';}
      else if(!contact){profile={engines:25,shields:30,weapons:15,sensors:30};stance='REACQUIRING CONTACT';}
      else if(e.hull<45||e.shields[exposed]<20||m.evadeUntil>this.time){profile={engines:34,shields:38,weapons:16,sensors:12};stance='DEFENSIVE';}
      else if(order&&this.range<=order.range+120&&angle(e,p)<45){profile={engines:20,shields:24,weapons:44,sensors:12};stance='ATTACKING';}
      else{profile={engines:40,shields:22,weapons:26,sensors:12};stance='PURSUING';}
      Object.assign(e.power,profile);e.tactic=stance;
      if(order!==m.waitingOrder){m.waitingOrder=order;m.waitingSince=this.time;}
      if(detailed&&order){
        const current=facing(p,e),breached=p.shields[current]<25;
        if(order.weapon==='torpedo'||breached){order.target=this.enemyInternalTarget();if(breached)order.attackArc=current;}
        else if(order.weapon==='phaser'&&p.shields[current]<60){order.target='shield-'+current;order.attackArc=current;}
        if(order.weapon==='torpedo'){
          const d=direction(p),away=(d.x*(p.x-e.x)+d.y*(p.y-e.y)+d.z*(p.z-e.z))/(this.range||1);
          if(away>.5&&p.speed>e.speed*.9)order.range=Math.max(order.range,Math.min(1700,this.range+50));
        }
        if(this.time-m.waitingSince>10){order.attackArc=angle(e,p)<45&&this.range<=order.range+300?current:this.enemyAttackArc();if(order.target.startsWith('shield-'))order.target='shield-'+order.attackArc;}
      }
    }
    attackAssignments(step,index){return step?.maneuvers??[index];}
    defaultAttackAssignments(index){const available=this.turn.draftManeuvers.map((key,i)=>key&&key!=='flee'?i:-1).filter(i=>i>=0);return available.includes(index)?[index]:available.length?[available[available.length-1]]:[];}
    validStep(step){return !!step&&Object.hasOwn(weaponSpecs,step.weapon)&&Object.hasOwn(targets,step.target)&&Number.isFinite(step.range)&&step.range>=300&&step.range<=weaponSpecs[step.weapon].maxRange&&(!Object.hasOwn(step,'maneuvers')||Array.isArray(step.maneuvers)&&step.maneuvers.length>0&&new Set(step.maneuvers).size===step.maneuvers.length&&step.maneuvers.every(i=>Number.isInteger(i)&&i>=0&&i<3));}
    selectManeuver(key,index=null){
      if(this.result||this.maneuvering||!Object.hasOwn(maneuvers,key)||index!==null&&(!Number.isInteger(index)||index<0||index>2))return false;
      for(const i of index===null?[0,1,2]:[index]){
        this.turn.draftManeuvers[i]=key;
        if(key==='flee')this.turn.draft=this.turn.draft.map((step,j)=>step?{...step,maneuvers:this.attackAssignments(step,j).filter(m=>m!==i)}:null);
      }
      this.turn.draftManeuver=this.turn.draftManeuvers.find(Boolean)||null;return true;
    }
    deleteManeuver(index){
      if(this.result||this.maneuvering||!Number.isInteger(index)||index<0||index>2||!this.turn.draftManeuvers[index])return false;
      this.turn.draftManeuvers[index]=null;this.turn.draft=this.turn.draft.map((step,i)=>step?{...step,maneuvers:this.attackAssignments(step,i).filter(m=>m!==index)}:null);
      this.turn.draftManeuver=this.turn.draftManeuvers.find(Boolean)||null;return true;
    }
    planReady(plan=this.turn.draft,routes=this.turn.draftManeuvers){
      if(!Array.isArray(plan)||plan.length!==3)return false;
      if(!Array.isArray(routes)||routes.length!==3||!routes.some(Boolean)||routes.some(key=>key&&!Object.hasOwn(maneuvers,key)))return false;
      if(!routes.some(key=>key&&key!=='flee'))return true;
      if(this.maneuvering&&this.turn.orders?.every(order=>order.status==='unused')&&plan.every(step=>!step))return true;
      return Array.isArray(plan)&&plan.length===3&&plan.every((step,i)=>this.validStep(step)&&(this.maneuvering&&this.turn.orders?.[i]?.status!=='pending'||this.attackAssignments(step,i).every(m=>routes[m]&&routes[m]!=='flee')))&&plan.filter(s=>s.weapon==='phaser').length===2&&plan.filter(s=>s.weapon==='torpedo').length===1;
    }
    clearStep(index){if(this.result||!Number.isInteger(index)||index<0||index>2||this.maneuvering)return false;this.turn.draft[index]=null;return true;}
    updateStep(index,step){
      const t=this.turn;
      if(!this.turnBased||this.result||!Number.isInteger(index)||index<0||index>2||!this.validStep(step))return false;
      const planning=['planning','review'].includes(t.phase);
      if(!planning&&(!this.running||!['approach','attack','withdraw'].includes(t.phase)||t.revisions<=0))return false;
      if(!planning&&t.orders[index].status!=='pending')return false;
      const assigned=this.attackAssignments(step,index);
      if(assigned.some(m=>t.draftManeuvers[m]==='flee')||!planning&&(!assigned.every(m=>t.draftManeuvers[m])||!assigned.some(m=>m>=t.stageIndex)))return false;
      const plan=t.draft.map(s=>s&&({...s}));plan[index]={weapon:step.weapon,target:step.target,range:step.range,maneuvers:[...assigned].sort()};
      if(plan.filter(s=>s?.weapon==='phaser').length>2||plan.filter(s=>s?.weapon==='torpedo').length>1)return false;
      if(!planning){if(!this.planReady(plan)||JSON.stringify(t.draft[index])===JSON.stringify(plan[index]))return false;t.revisions--;t.orders[index]={...plan[index],status:'pending'};}
      t.draft=plan;return true;
    }
    canReviseManeuver(index){
      const t=this.turn;return !this.result&&['approach','attack','withdraw'].includes(t.phase)&&t.revisions>0&&Number.isInteger(index)&&!!t.maneuvers?.[index]&&index>=t.stageIndex&&(index!==t.stageIndex||t.stageCompletedAt===null);
    }
    applyRevisions(plan,routes=this.turn.draftManeuvers){
      const t=this.turn;if(this.result||!['approach','attack','withdraw'].includes(t.phase)||!this.planReady(plan,routes))return false;
      const changes=[0,1,2].filter(i=>JSON.stringify(plan[i])!==JSON.stringify(t.draft[i]));
      const routeChanges=[0,1,2].filter(i=>routes[i]!==t.maneuvers[i]),cost=changes.length+routeChanges.length;
      if(cost>t.revisions||routeChanges.some(i=>!routes[i]||!this.canReviseManeuver(i))||changes.some(i=>t.orders[i].status!=='pending'||!this.attackAssignments(plan[i],i).some(m=>m>=t.stageIndex)))return false;
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
      if(t.phase==='review')t.number++;
      t.maneuvers=[...t.draftManeuvers];const offensive=t.maneuvers.some(key=>key&&key!=='flee');
      t.orders=t.draft.map((s,i)=>offensive?{...s,maneuvers:[...this.attackAssignments(s,i)],status:'pending'}:{status:'unused',maneuvers:[]});
      t.maneuverStatus=t.maneuvers.map(key=>key?'pending':'not-selected');t.enemyOrders=this.planEnemy().map(s=>({...s,status:'pending'}));t.spent={player:{phaser:0,torpedo:0},enemy:{phaser:0,torpedo:0}};t.revisions=2;t.baseline=this.snapshot();t.report=null;t.stageHistory=[];
      t.cleanupDeadline=null;t.endedEarly=false;this.replayRecording=Replay?new Replay.Recorder(this):null;this.startStage(t.maneuvers.findIndex(Boolean));
      this.message('COMMAND',`Turn ${t.number}: ${t.maneuvers.filter(Boolean).length} maneuver(s) committed. Each attack fires once.`);this.captureReplay(true);return true;
    }
    captureReplay(force=false){
      if(!this.replayRecording)return;
      this.replayRecording.capture(this,force);
      if(this.result||this.turn.phase==='review'){this.lastReplay=this.replayRecording.finish(this);this.replayRecording=null;}
    }
    restoreFlightPower(){const t=this.turn;if(t.savedPower){Object.assign(this.player.power,t.savedPower);this.player.repair=t.savedRepair;t.savedPower=null;}}
    endPass(){
      const t=this.turn;if(!this.turnBased||this.result||!t.orders||!['approach','attack','withdraw','disengage'].includes(t.phase))return false;
      for(const order of [...t.orders,...t.enemyOrders])if(order.status==='pending')order.status='skipped';
      t.maneuverStatus=t.maneuverStatus.map(status=>status==='active'?'ended':status==='pending'?'skipped':status);
      for(const projectile of this.projectiles)if(projectile.order)projectile.order.status='cancelled';
      const cancelled=this.projectiles.length;this.projectiles=[];this.events.push({type:'pass-ended',cancelledProjectiles:cancelled});
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
      this.initNavigation();this.target=this.nextOrder()?.target||'hull';this.setPhase(t.maneuver==='flee'?'withdraw':'approach');
      if(t.maneuver==='flee'){t.savedPower={...this.player.power};t.savedRepair=this.player.repair;Object.assign(this.player.power,{engines:50,shields:30,weapons:5,sensors:15});}
      this.message('HELM',`M${index+1}: ${maneuvers[t.maneuver].name}.`);
    }
    initNavigation(){
      const t=this.turn,p=this.player,e=this.enemy,f=direction(p),right={x:-f.z,z:f.x},toward={x:p.x-e.x,z:p.z-e.z},len=Math.hypot(toward.x,toward.z)||1;
      const waypoint={x:e.x+toward.x/len*350,y:e.y,z:e.z+toward.z/len*350};
      if(t.maneuver==='port'||t.maneuver==='starboard'){const sign=t.maneuver==='port'?-1:1;waypoint.x+=right.x*900*sign;waypoint.z+=right.z*900*sign;}
      if(t.maneuver==='above'||t.maneuver==='below')waypoint.y+=t.maneuver==='above'?800:-800;
      if(t.maneuver==='hide'){const k=this.station,d=distance(k,e)||1,r=k.radius+240;waypoint.x=k.x+(k.x-e.x)/d*r;waypoint.y=k.y+(k.y-e.y)/d*r;waypoint.z=k.z+(k.z-e.z)/d*r;}
      t.navigation={stage:['direct','flee'].includes(t.maneuver)?'attack':'position',elapsed:0,wait:6,waypoint};
      if(t.maneuver==='behind'){
        const forward=direction(e),right={x:Math.cos(e.heading*RAD),z:Math.sin(e.heading*RAD)};
        t.navigation.rearSide=(p.x-e.x)*right.x+(p.z-e.z)*right.z<0?-1:1;
        t.navigation.rearPhase=facing(e,p)==='aft'?'stern':'flank';
        Object.assign(waypoint,{x:e.x-forward.x*150+right.x*850*t.navigation.rearSide,y:e.y,z:e.z-forward.z*150+right.z*850*t.navigation.rearSide});
      }
    }
    desiredFlightSpeed(ship,target,aim,{mode='attack',order=null,avoiding=false,turnRate=42,speedOverride=0}={}){
      const mobility=clamp(this.output(ship,'engines')/24,.12,1.6),maximum=125*mobility*IMPULSE_SPEED_MULTIPLIER;
      const aimDistance=distance(ship,aim),error=angle(ship,aim);let speed=maximum,reason='CLOSING FOR ATTACK';
      if(mode==='cover'){speed=MIN_IMPULSE_SPEED;reason='HOLDING COVER';}
      else if(mode==='escape'||mode==='breakaway')reason=mode==='escape'?'OPENING ESCAPE RANGE':'BREAKING AWAY';
      else if(mode==='position'){
        speed=Math.min(maximum,Math.sqrt(2*65*Math.max(0,aimDistance-120)));reason='POSITIONING FOR ATTACK';
      }else{
        const range=distance(ship,target)||1,line={x:(target.x-ship.x)/range,y:(target.y-ship.y)/range,z:(target.z-ship.z)/range},d=direction(target);
        const targetAway=(d.x*line.x+d.y*line.y+d.z*line.z)*target.speed;
        const desiredRange=order?Math.min(order.range*.82,weaponSpecs[order.weapon].optimal[1]*.95):range;
        const weaponOutput=this.output(ship,'weapons'),cost=order?.weapon==='torpedo'?24:14;
        const chargeWait=order&&ship.capacitor<cost?(cost-ship.capacitor)/Math.max(.01,weaponOutput*.42):0;
        const heatWait=order?.weapon==='phaser'?Math.max(0,(ship.heat-85)/(5+weaponOutput*.12)):0;
        const readyIn=order?Math.max(0,ship.cooldown[order.weapon]||0,chargeWait,heatWait):0;
        // Arrive slightly inside the ordered range as the weapon becomes ready,
        // matching radial target motion instead of racing past a firing window.
        speed=targetAway+(range-desiredRange)/Math.max(2.2,readyIn+.8);
        reason=order&&range>order.range?'CLOSING TO FIRING RANGE':'HOLDING FIRING SOLUTION';
      }
      if(error>12&&mode!=='cover'){
        const angular=turnRate*Math.PI/180,radius=Math.max(45,Math.min(350,aimDistance*.6));
        speed=Math.min(speed,maximum*clamp(1-error/140,.12,1),radius*angular);
        reason=mode==='escape'||mode==='breakaway'?'TURNING FOR WITHDRAWAL':'TURNING FOR ATTACK';
      }
      if(speedOverride>0){speed=maximum;reason='MANUAL SPEED UP / RELEASE W TO RESUME PLAN';}
      else if(speedOverride<0){speed=MIN_IMPULSE_SPEED;reason='MANUAL SLOW DOWN / RELEASE S TO RESUME PLAN';}
      const f=direction(ship),lookAhead=Math.max(200,Math.abs(ship.speed)*3),ahead={x:ship.x+f.x*lookAhead,y:ship.y+f.y*lookAhead,z:ship.z+f.z*lookAhead};
      const hit=this.stationTrace(ship,ahead,90);
      if(hit){speed=Math.min(speed,Math.sqrt(2*65*Math.max(0,hit.t*lookAhead-75)));reason='BRAKING FOR K7';}
      else if(avoiding&&distance(ship,this.station)<this.station.radius+450){speed=Math.min(speed,80);reason='ROUNDING K7';}
      const planetSafeSpeed=Math.abs(this.planetSpeedLimit(ship,speed));if(planetSafeSpeed<speed){speed=planetSafeSpeed;reason='BRAKING FOR PLANET';}
      return {speed:clamp(speed,MIN_IMPULSE_SPEED,maximum),reason,mobility,maximum};
    }
    adjustFlightSpeed(ship,target,aim,options,dt){
      const command=this.desiredFlightSpeed(ship,target,aim,options),acceleration=45*Math.max(.35,command.mobility),braking=65;
      ship.speedOverride=options.speedOverride||0;
      ship.flightTargetSpeed=command.speed;ship.speedIntent=command.reason;
      this.easeFlightSpeed(ship,command.speed,dt,acceleration,braking);
      ship.throttle=command.speed<=MIN_IMPULSE_SPEED+.01?0:clamp(command.speed/command.maximum*100);
    }
    easeFlightSpeed(ship,desired,dt,acceleration=45,braking=65){
      if(dt<=0)return;
      const error=desired-ship.speed,wanted=clamp(error*1.5,-braking,acceleration);
      ship.flightAcceleration=(ship.flightAcceleration||0)+clamp(wanted-(ship.flightAcceleration||0),-75*dt,75*dt);
      const change=ship.flightAcceleration*dt;
      if(error*change>=0&&Math.abs(change)>=Math.abs(error)){ship.speed=desired;ship.flightAcceleration=0;}
      else ship.speed=Math.max(MIN_IMPULSE_SPEED,ship.speed+change);
    }
    steerFlight(ship,aim,dt,maxYaw=42,maxPitch=30){
      if(dt<=0)return;
      const yawError=delta(ship.heading,bearing(ship,aim)),pitchError=clamp(elevation(ship,aim),-85,85)-ship.pitch;
      // Ease angular velocity into each command and brake before alignment.
      const desiredYaw=clamp(yawError*1.4,-maxYaw,maxYaw),desiredPitch=clamp(pitchError*1.4,-maxPitch,maxPitch);
      const yawAcceleration=clamp((desiredYaw-ship.turnRate)*3.2,-maxYaw*.9,maxYaw*.9),pitchAcceleration=clamp((desiredPitch-(ship.pitchRate||0))*3.2,-maxPitch*.9,maxPitch*.9);
      ship.yawAcceleration=(ship.yawAcceleration||0)+clamp(yawAcceleration-(ship.yawAcceleration||0),-maxYaw*3*dt,maxYaw*3*dt);
      ship.pitchAcceleration=(ship.pitchAcceleration||0)+clamp(pitchAcceleration-(ship.pitchAcceleration||0),-maxPitch*3*dt,maxPitch*3*dt);
      ship.turnRate=clamp(ship.turnRate+ship.yawAcceleration*dt,-maxYaw,maxYaw);
      ship.pitchRate=clamp((ship.pitchRate||0)+ship.pitchAcceleration*dt,-maxPitch,maxPitch);
      ship.heading=wrap(ship.heading+ship.turnRate*dt);ship.pitch=clamp(ship.pitch+ship.pitchRate*dt,-85,85);
      const bank=-clamp(ship.turnRate/maxYaw,-1,1)*MAX_BANK;
      ship.bank+=(bank-ship.bank)*(1-Math.exp(-1.8*dt));
    }
    autoHelm(dt,keys={}){
      const t=this.turn,p=this.player,e=this.enemy,n=t.navigation;if(!n)return;
      n.elapsed+=dt;let aim=e;
      n.retiring=this.nextStageIndex()<0&&t.maneuver!=='flee'&&t.stageCompletedAt!==null;
      if(t.phase==='disengage'||t.maneuver==='flee'||n.retiring){
        const d=direction(p),v={x:p.x-e.x,y:p.y-e.y,z:p.z-e.z};if(Math.hypot(v.x,v.y,v.z)<1)Object.assign(v,d);
        aim={x:p.x+v.x,y:p.y+v.y+150,z:p.z+v.z};
      }else if(t.maneuver==='behind'){
        const forward=direction(e),right={x:Math.cos(e.heading*RAD),z:Math.sin(e.heading*RAD)},order=this.nextOrder(p);
        const flank={x:e.x-forward.x*150+right.x*850*n.rearSide,y:e.y,z:e.z-forward.z*150+right.z*850*n.rearSide};
        if(n.rearPhase==='flank'&&(distance(p,flank)<250||n.elapsed>14||facing(e,p)==='aft'))n.rearPhase='stern';
        const standOff=Math.max(300,Math.min(800,(order?.range||1000)*.72));
        n.waypoint=n.rearPhase==='flank'?flank:{x:e.x-forward.x*standOff,y:e.y-forward.y*standOff,z:e.z-forward.z*standOff};
        const astern=n.rearPhase==='stern'&&facing(e,p)==='aft';
        n.stage=astern&&angle(p,e)<55?'attack':'position';aim=n.stage==='attack'?e:n.waypoint;
      }else if(t.maneuver==='hide'&&n.stage!=='attack'){
        if(n.stage==='position'&&this.stationTrace(e,p)){n.stage='hiding';this.message('HELM','K7 cover established. Holding six seconds before the assault.');}
        if(n.stage==='hiding'){n.wait-=dt;if(n.wait<=0)n.stage='attack';}
        if(n.elapsed>25&&n.stage==='position'){this.message('HELM','Cover route timed out. Beginning the direct assault.');n.stage='attack';}
        if(n.stage!=='attack')aim=n.waypoint;
      }else if(n.stage==='position'){
        aim=n.waypoint;
        if(distance(p,aim)<220||n.elapsed>18)n.stage='attack';
      }
      const order=this.nextOrder(p);
      const selectedArc=this.captainEnabled&&order?.attackArc|| (order?.target.startsWith('shield-')?order.target.slice(7):null);
      if(n.stage==='attack'&&t.phase!=='disengage'&&!['flee','behind'].includes(t.maneuver)&&!n.retiring&&selectedArc){
        const sector=selectedArc,a=(e.heading+({fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0}[sector]))*RAD,r=order.range*.7;
        if(facing(e,p)!==sector){const vertical=sector==='dorsal'||sector==='ventral';aim={x:e.x+(vertical?0:Math.sin(a)*r),y:e.y+(sector==='dorsal'?r:sector==='ventral'?-r:0),z:e.z-(vertical?0:Math.cos(a)*r)};}
      }
      if(this.captainEnabled&&this.playerMind.evadeUntil>this.time&&this.playerMind.evadeAim&&t.phase!=='disengage'&&t.maneuver!=='flee'&&!n.retiring)aim=this.playerMind.evadeAim;
      const f=direction(p),ahead={x:p.x+f.x*280,y:p.y+f.y*280,z:p.z+f.z*280};
      n.avoiding=!!(this.stationTrace(p,aim,90)||this.stationTrace(p,ahead,90));
      if(n.avoiding)aim={x:this.station.x+(p.x>=this.station.x?1:-1)*(this.station.radius+200),y:this.station.y+this.station.radius+180,z:this.station.z};
      const mobility=clamp(this.output(p,'engines')/24,.12,1.6),rate=42*mobility;
      this.steerFlight(p,aim,dt,rate,30*mobility);
      const mode=t.maneuver==='flee'?'escape':t.phase==='disengage'||n.retiring?'breakaway':n.stage==='hiding'?'cover':n.stage==='position'?'position':'attack';
      this.adjustFlightSpeed(p,e,aim,{mode,order,avoiding:n.avoiding,turnRate:rate,speedOverride:(keys.more?1:0)-(keys.less?1:0)},dt);
      if(t.maneuver==='flee'){
        p.repair=['hull','reactor',...Object.keys(p.integrity)].reduce((a,b)=>(a==='hull'?p.hull:a==='reactor'?p.reactor:p.integrity[a])<(b==='hull'?p.hull:b==='reactor'?p.reactor:p.integrity[b])?a:b);
      }
    }
    nextStageIndex(){return this.turn.maneuvers?.findIndex((key,i)=>key&&i>this.turn.stageIndex)??-1;}
    nextOrder(shooter=this.player){if(shooter!==this.player)return this.turn.enemyOrders?.find(s=>s.status==='pending');if(this.turn.maneuver==='flee')return undefined;return this.turn.orders?.find((order,i)=>order.weapon&&order.status==='pending'&&this.attackAssignments(order,i).includes(this.turn.stageIndex));}
    turnStatus(type,shooter,target){
      const t=this.turn,order=this.nextOrder(shooter);
      if(t.phase==='withdraw'&&shooter===this.player)return 'WITHDRAWING / WEAPONS HOLD';
      if(!['approach','attack','withdraw'].includes(t.phase))return t.phase.toUpperCase()+' / WEAPONS HOLD';
      if(shooter===this.player&&t.maneuver==='hide'&&t.navigation.stage!=='attack')return 'K7 COVER MANEUVER';
      if(shooter===this.player&&order&&t.maneuver==='behind'&&facing(target,shooter)!=='aft')return 'POSITIONING BEHIND YORKTOWN';
      if(shooter===this.player&&t.navigation.stage==='position')return 'POSITIONING FOR ATTACK';
      if(!order)return this.nextStageIndex()>=0?'MANEUVER COMPLETE':'TURN PLAN COMPLETE';
      if(order.weapon!==type)return 'NEXT STEP: '+order.weapon.toUpperCase();
      if((shooter===this.enemy||this.captainEnabled)&&order.attackArc&&facing(target,shooter)!==order.attackArc)return 'SEEKING EXPOSED SHIELD';
      if(!order||distance(shooter,target)>order.range)return 'CLOSE TO ORDERED RANGE';
      if(order.target.startsWith('shield-')&&facing(target,shooter)!==order.target.slice(7))return 'SELECTED SHIELD NOT EXPOSED';
      return null;
    }
    advanceTurn(dt){
      const t=this.turn;t.remaining=Math.max(0,t.remaining-dt);t.elapsed+=dt;
      if(!this.maneuvering)return false;
      if(t.phase==='approach'||t.phase==='attack'||t.phase==='withdraw'){
        for(const [shooter,target] of [[this.player,this.enemy],[this.enemy,this.player]]){
          if(this.result)break;
          if(shooter===this.enemy&&this.enemyRetreating)continue;
          if(shooter===this.player&&t.remaining<=0)continue;
          const order=this.nextOrder(shooter);if(order)this.fire(order.weapon,shooter,target);
        }
        const here=t.orders.filter((order,i)=>order.weapon&&this.attackAssignments(order,i).includes(t.stageIndex)),timedOut=t.remaining<=0;
        if(timedOut)for(const order of here)if(order.status==='pending'&&!order.maneuvers.some(m=>m>t.stageIndex&&t.maneuvers[m]))order.status='skipped';
        const fired=here.filter(order=>order.firedStage===t.stageIndex),beamEnd=Math.max(0,...fired.map(order=>order.firedAt+(order.weapon==='phaser'?PHASER_DURATION:0)));
        const emptyRouteReady=t.navigation.stage==='attack'&&t.navigation.elapsed>=2&&(this.range<=1000||t.navigation.elapsed>=8);
        const finished=t.maneuver==='flee'?timedOut:timedOut||!this.nextOrder()&&(fired.length>0||emptyRouteReady);
        if(finished&&t.stageCompletedAt===null)t.stageCompletedAt=this.time;
        const complete=finished&&this.time>=beamEnd;
        if(!this.result&&complete){
          t.maneuverStatus[t.stageIndex]=t.maneuver==='flee'?'repaired':'complete';
          const next=this.nextStageIndex();
          if(next>=0)this.startStage(next);
          else{
            if(t.cleanupDeadline===null)t.cleanupDeadline=this.time+(t.maneuver==='flee'?0:10);
            if(this.time>=t.cleanupDeadline||!this.nextOrder(this.enemy)||this.enemyRetreating){
              for(const pending of t.enemyOrders)if(pending.status==='pending')pending.status='skipped';
              const retreat=t.maneuver==='flee';this.restoreFlightPower();this.setPhase('disengage');if(retreat)t.remaining=0;
              this.message('HELM','Selected maneuvers complete. Automatic breakaway before damage review.');
            }
          }
        }
      }else if(t.phase==='disengage'&&this.projectiles.length===0&&(t.remaining<=0||t.elapsed>=3&&this.range>=1400)){
        this.finishPass();
      }
      return true;
    }
    stationTrace(from,to,padding=0){
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
      x+=n.x*.35;y+=n.y*.35;z+=n.z*.35;
      const ahead={x:x*sign,y:y*sign,z:z*sign},origin={x:0,y:0,z:0};
      s.heading=bearing(origin,ahead);s.pitch=clamp(elevation(origin,ahead),-85,85);
      s.speed=sign*MIN_IMPULSE_SPEED;if(s===this.player)s.throttle=0;
    }
    get contact(){const p=this.player;return this.output(p,'sensors')>=3.5&&p.integrity.sensors>12&&distance(p,this.enemy)<2000;}
    get detailed(){return this.contact&&(this.output(this.player,'sensors')>=10||this.scanUntil>this.time);}
    get yorktownTelemetry(){return this.player.integrity.sensors>=100;}
    get range(){return distance(this.player,this.enemy);}
    get lock(){return this.contact&&angle(this.player,this.enemy)<65&&!this.stationTrace(this.player,this.enemy);}
    status(type,shooter=this.player,target=this.enemy){
      if(this.freeFlight&&shooter!==this.player)return 'FREE FLIGHT / WEAPONS SECURED';
      if(this.result)return 'ENGAGEMENT ENDED';if(!this.running)return 'STANDING BY';
      if(this.freeFlight)return shooter.cooldown[type]>0?'RECHARGING':'READY';
      if(this.turnBased){const hold=this.turnStatus(type,shooter,target);if(hold)return hold;}
      if(shooter.integrity.weapons<10||this.output(shooter,'weapons')<3)return 'WEAPONS OFFLINE';
      if(shooter.cooldown[type]>0)return 'RECHARGING';
      if(type==='torpedo'&&shooter.torpedoes<=0)return 'MAGAZINE EMPTY';
      if(shooter.capacitor<(type==='phaser'?14:24))return 'LOW CAPACITOR';
      if(type==='phaser'&&shooter.heat>85)return 'PHASERS OVERHEATED';
      if(distance(shooter,target)>=2000||distance(shooter,target)>(type==='phaser'?1500:2000))return 'OUT OF RANGE';
      if(angle(shooter,target)>(type==='phaser'?65:28))return 'OUTSIDE FIRING ARC';
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
    fire(type,shooter=this.player,target=this.enemy){
      const status=this.status(type,shooter,target);if(status!=='READY')return false;
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
      const order=this.turnBased?this.nextOrder(shooter):null;
      if(order){order.status=type==='phaser'?'hit':'in-flight';order.firedAt=this.time;if(shooter===this.player)order.firedStage=this.turn.stageIndex;this.turn.spent[shooter===this.player?'player':'enemy'][type]++;if(this.turn.phase==='approach')this.setPhase('attack');}
      shooter.capacitor-=type==='phaser'?14:24;shooter.cooldown[type]=type==='phaser'?1.65:5.5;
      const optimal=weaponSpecs[type].optimal,inBand=distance(shooter,target)>=optimal[0]&&distance(shooter,target)<=optimal[1];
      const strength=clamp(this.output(shooter,'weapons')/25,.2,1.6)*(shooter===this.enemy?.9:1)*(order&&inBand?1.15:1);
      if(shooter===this.player)this.shots++;
      if(type==='phaser'){
        const aim=order?order.target:shooter===this.player?this.target:null,hit=this.resolveWeaponHit?.(shooter,target,aim,'phaser');
        shooter.heat+=23;this.events.push({type:'beam',from:shooter.name,to:target.name,duration:PHASER_DURATION,hit});
        this.damage(target,shooter,17*strength,'phaser',aim,hit);
      }else{
        shooter.torpedoes--;const d=direction(shooter),pos={x:shooter.x+d.x*30,y:shooter.y+d.y*30,z:shooter.z+d.z*30};
        const targetSystem=order?order.target:shooter===this.player?this.target:null,contact=this.resolveWeaponHit?.(shooter,target,targetSystem,'torpedo');
        const aim=this.torpedoAim(pos,target,contact?.worldPoint||target);
        this.projectiles.push({id:this.time+'-'+shooter.name,from:shooter.name,target:target.name,pos,life:0,maxLife:8,strength,targetSystem,order,heading:bearing(pos,aim),pitch:elevation(pos,aim)});
        this.events.push({type:'launch',from:shooter.name,to:target.name});
      }return true;
    }
    damage(target,source,amount,weapon,aim,hit=null){
      if(this.freeFlight||this.result)return;
      if(source===this.enemy)amount*=this.difficultyProfile.enemyDamage;
      const arc=facing(target,source),shield=target.shields[arc],hullBefore=target.hull;
      const shieldAim=typeof aim==='string'&&aim.startsWith('shield-');
      if(shieldAim&&aim.slice(7)===arc)amount*=1.3;
      target.shields[arc]=clamp(shield-amount*(weapon==='phaser'?2.1:1.45));target.lastHit=this.time;
      const penetration=shield<25?.58+(25-shield)/60:Math.max(0,amount-shield)/Math.max(amount,1)*.7;
      const hullDamage=amount*penetration*(weapon==='torpedo'?1.35:.65)*.18*(aim==='hull'?1.35:1);
      target.hull=clamp(target.hull-hullDamage);
      let system=null;
      if(hullDamage>0){
        const available=[...systems,'reactor','bridge','mainEngines'];system=hit&&available.includes(hit.component)?hit.component:aim&&aim!=='hull'&&!shieldAim&&Object.hasOwn(targets,aim)&&this.random()<.78?aim:available[Math.floor(this.random()*available.length)];
        if(system==='reactor')target.reactor=clamp(target.reactor-hullDamage*.5,12,100);
        else target.integrity[system]=clamp(target.integrity[system]-hullDamage*.85);
        // Damage to power conduits also cuts total available output.
        target.reactor=clamp(target.reactor-hullDamage*.08,12,100);
      }
      let scorePoints=0;
      if(source===this.player){this.hits++;scorePoints=this.scoreHit(shield-target.shields[arc],Math.min(hullDamage,hullBefore),weapon);}
      else if(target===this.player){this.battleStats.chain=0;this.battleStats.lastScoredAt=-Infinity;}
      this.events.push({type:'impact',ship:target.name,arc,hullDamage,amount,weapon,system,hit,scorePoints,chain:this.activeChain,shieldBroken:shield>0&&target.shields[arc]===0,shieldDepleted:target.shields[arc]===0});
      if(target===this.player||hullDamage>0||target.shields[arc]===0)this.message(target===this.player?'DAMAGE':'TACTICAL',`${target.name}: ${arc} shield ${Math.round(target.shields[arc])}%${hullDamage>0?`; hull hit${system?' / '+system+' damaged':''}`:'.'}`);
      if(target.hull<=0&&!this.result){this.result=target===this.enemy?'victory':'defeat';this.running=false;this.completeBattleScore();this.events.push({type:'destroyed',ship:target.name});this.message('COMMAND',target===this.enemy?'Yorktown neutralized. Stand down from red alert.':'Enterprise lost. Command signal terminated.');this.captureReplay(true);}
    }
    scan(){if(!this.running||!this.maneuvering||this.result||this.player.cooldown.scan>0||this.output(this.player,'sensors')<3.5||this.player.capacitor<12)return false;this.player.capacitor-=12;this.player.cooldown.scan=14;this.scanUntil=this.time+8;this.message('SCIENCE','Active sweep. Target subsystem telemetry resolved for eight seconds.');this.events.push({type:'scan'});return true;}
    warp(){
      if(!this.running||!this.maneuvering||this.result||this.warpUsed||this.player.hull<=0)return false;
      const p=this.player,d=direction(p),from={x:p.x,y:p.y,z:p.z};
      const destination={x:p.x+d.x*3000,y:p.y+d.y*3000,z:p.z+d.z*3000};
      if(this.stationTrace(destination,destination,45)){this.message('HELM','Warp destination obstructed by K7. Change heading before jumping.');return false;}
      if(distance(destination,this.planet)<this.planet.radius+this.planet.atmosphere+120){this.message('HELM','Warp destination inside the planet. Change heading before jumping.');return false;}
      Object.assign(p,destination);
      this.warpUsed=true;
      this.events.push({type:'warp',from,to:{x:p.x,y:p.y,z:p.z},direction:d});
      this.message('HELM','Emergency warp complete: 30 km along current heading and pitch. Warp charge spent.');
      return true;
    }
    slowAhead(){this.player.throttle=0;this.player.speed=MIN_IMPULSE_SPEED;this.player.flightAcceleration=0;}
    repair(key){if(![...systems,'reactor','bridge','mainEngines'].includes(key))return;this.player.repair=key;}
    tick(dt,keys={}){
      if(!this.running||this.result)return;dt=clamp(dt,0,.1);
      if(this.captainEnabled)this.updateCaptain();
      if(this.turnBased&&!this.advanceTurn(dt))return;
      if(this.result||!this.maneuvering){this.captureReplay(true);return;}
      this.time+=dt;
      const p=this.player,e=this.enemy;
      const previousPositions={[p.name]:{x:p.x,y:p.y,z:p.z},[e.name]:{x:e.x,y:e.y,z:e.z}};
      const turn=(keys.right?1:0)-(keys.left?1:0),tilt=(keys.down?1:0)-(keys.up?1:0);
      const mobility=clamp(this.output(p,'engines')/24,.12,1.6);
      if(this.turnBased)this.autoHelm(dt,keys);
      else{
      if(turn){
        const maxRate=42*mobility;
        p.turnRate=clamp(p.turnRate+turn*48*mobility*dt,-maxRate,maxRate);
        if(Math.abs(p.turnRate)<.05)p.turnRate=0;
        const bank=-p.turnRate/maxRate*MAX_BANK;p.bank+=(bank-p.bank)*(1-Math.exp(-2.2*dt));
      }
      // Releasing steering preserves the selected yaw rate and bank angle.
      p.heading=wrap(p.heading+p.turnRate*dt);p.pitch=clamp(p.pitch+tilt*30*mobility*dt,-85,85);
      p.throttle=clamp(p.throttle+((keys.more?1:0)-(keys.less?1:0))*30*dt,-100,100);
      if(keys.stop)this.slowAhead();
      }
      if(!this.turnBased){
      const commanded=p.throttle/100*125*mobility*IMPULSE_SPEED_MULTIPLIER;
      const desired=this.planetSpeedLimit(p,(Math.sign(commanded)||1)*Math.max(MIN_IMPULSE_SPEED,Math.abs(commanded)));
      if(p.speed*desired<0){
        p.speed=Math.abs(p.speed)<=MIN_IMPULSE_SPEED+.001?Math.sign(desired)*MIN_IMPULSE_SPEED:Math.sign(p.speed)*Math.max(MIN_IMPULSE_SPEED,Math.abs(p.speed)-Math.max(60,Math.abs(desired)*2)*dt);
        p.flightAcceleration=0;
      }else{const sign=Math.sign(desired);p.speed=Math.abs(p.speed);this.easeFlightSpeed(p,Math.abs(desired),dt,45*Math.max(.35,mobility),65);p.speed*=sign;}
      if(Math.abs(p.speed)<MIN_IMPULSE_SPEED)p.speed=Math.sign(desired)*MIN_IMPULSE_SPEED;
      }
      if(!this.freeFlight&&e.hull<25&&!this.enemyRetreating&&this.time>=(this.enemyMind.reengageUntil||0)){
        this.enemyRetreating=true;
        Object.assign(e.power,{engines:45,shields:35,weapons:10,sensors:10});
        e.repair='engines';
        this.message('TACTICAL','Yorktown is badly damaged and attempting to retreat.');
      }
      const m=this.enemyMind,runningAway=!this.freeFlight&&this.time>=(m.reengageUntil||0)&&(this.enemyRetreating||this.turnBased&&(this.turn.phase==='disengage'||!this.nextOrder(e)));
      if(runningAway){m.runAwaySince??=this.time;if(this.time-m.runAwaySince>=10-1e-8)this.reengageEnemy();}
      else m.runAwaySince=null;
      const enemyReturning=!this.freeFlight&&m.reengageUntil>this.time;
      if(this.turnBased)this.thinkEnemy();
      const enemyLocked=!this.turnBased||this.enemyHasContact(),enemyTarget=this.turnBased?this.enemyTrack():p;
      const range=this.range,weak=Object.entries(p.shields).sort((a,b)=>a[1]-b[1])[0][0];
      const flank={fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0}[weak]+p.heading;
      const waypoint=range<800?{x:p.x+Math.sin(flank*RAD)*430,y:p.y+(weak==='dorsal'?270:weak==='ventral'?-270:Math.sin(this.time*.055)*80),z:p.z-Math.cos(flank*RAD)*430}:p;
      const attackRun=range<1450&&(this.aiShot<1.5||this.aiTorp<1.5);
      const away={x:e.x+(e.x-enemyTarget.x),y:e.y+(e.y-enemyTarget.y),z:e.z+(e.z-enemyTarget.z)};
      if(distance(enemyTarget,e)<1){const d=direction(e);away.x=e.x+d.x*1000;away.y=e.y+d.y*1000;away.z=e.z+d.z*1000;}
      let aim=enemyReturning?enemyTarget:this.enemyRetreating||this.turnBased&&(this.turn.phase==='disengage'||!this.nextOrder(e))?away:this.turnBased?enemyTarget:attackRun?p:waypoint;
      if(this.freeFlight){const o=this.freeFlightOrbit,a=o.angle+.25;aim={x:this.station.x+Math.cos(a)*o.radius,y:this.station.y+o.height,z:this.station.z+Math.sin(a)*o.radius};}
      const enemyOrder=this.nextOrder(e);let enemyPositioning=!enemyLocked;
      if(this.turnBased&&enemyLocked&&this.turn.phase!=='disengage'&&!this.enemyRetreating&&enemyOrder&&(enemyOrder.attackArc||enemyOrder.target.startsWith('shield-'))){
        const sector=enemyOrder.attackArc||enemyOrder.target.slice(7),offset={fore:0,starboard:90,aft:180,port:270,dorsal:0,ventral:0}[sector],a=(p.heading+offset)*RAD;
        if(facing(p,e)!==sector){enemyPositioning=true;const vertical=sector==='dorsal'||sector==='ventral',offset=enemyOrder.range*.8;aim={x:p.x+(vertical?0:Math.sin(a)*offset),y:p.y+(sector==='dorsal'?offset:sector==='ventral'?-offset:0),z:p.z-(vertical?0:Math.cos(a)*offset)};}
      }
      if(this.turnBased&&enemyLocked&&!this.enemyRetreating&&this.turn.phase!=='disengage'){
        if(this.enemyMind.evadeUntil>this.time&&this.enemyMind.evadeAim){aim=this.enemyMind.evadeAim;enemyPositioning=true;}
        else if(!enemyPositioning&&enemyOrder?.weapon==='torpedo'){
          const lead=direction(p),seconds=Math.min(1.5,this.range/400*.3);aim={x:p.x+lead.x*p.speed*seconds,y:p.y+lead.y*p.speed*seconds,z:p.z+lead.z*p.speed*seconds};
        }
      }
      if(enemyReturning){aim=this.enemyReturnAim(enemyTarget);enemyPositioning=!m.returnLegComplete;}
      const forward=direction(e),ahead={x:e.x+forward.x*300,y:e.y+forward.y*300,z:e.z+forward.z*300};
      const enemyAvoiding=!!(this.stationTrace(e,aim,90)||this.stationTrace(e,ahead,90));
      if(enemyAvoiding){
        aim={x:this.station.x+(e.x>=this.station.x?430:-430)*this.station.scale,y:this.station.y+330*this.station.scale,z:this.station.z};
      }
      const rate=26*clamp(this.output(e,'engines')/24,.1,1.5);
      if(!this.freeFlight)this.steerFlight(e,aim,dt,rate,18);
      if(this.turnBased){
        const mode=enemyReturning?'position':this.enemyRetreating?'escape':this.turn.phase==='disengage'||!enemyOrder?'breakaway':enemyPositioning||enemyAvoiding?'position':'attack';
        this.adjustFlightSpeed(e,enemyTarget,aim,{mode,order:enemyOrder,avoiding:enemyAvoiding,turnRate:rate},dt);
      }else this.easeFlightSpeed(e,this.freeFlight?55:Math.max(MIN_IMPULSE_SPEED,(this.enemyRetreating?110:range>700?70:range<240?20:43)*clamp(this.output(e,'engines')/24,.1,1.5)*IMPULSE_SPEED_MULTIPLIER),dt);
      for(const s of [p,e]){
        const previous={x:s.x,y:s.y,z:s.z};
        if(this.freeFlight&&s===e)this.flyYorktownOrbit(dt);
        else{const d=direction(s);s.x+=d.x*s.speed*dt;s.y+=d.y*s.speed*dt;s.z+=d.z*s.speed*dt;this.moveAroundStation(s,previous);this.moveAroundPlanet(s,previous);}
        for(const key of Object.keys(s.cooldown))s.cooldown[key]=Math.max(0,s.cooldown[key]-dt);
        s.capacitor=clamp(s.capacitor+this.output(s,'weapons')*.42*dt);s.heat=Math.max(0,s.heat-dt*(5+this.output(s,'weapons')*.12));
        for(const a of arcs)s.shields[a]=clamp(s.shields[a]+this.output(s,'shields')*.045*(this.turnBased?.3:1)*(s.bias[a]/16.667)*dt*(this.time-s.lastHit>3?1:.18));
        if(s.repairBudget>0&&this.time-s.lastHit>6){const key=s.repair,current=key==='hull'?s.hull:key==='reactor'?s.reactor:s.integrity[key],gain=Math.min(100-current,dt*(key==='hull'?.35:.65),s.repairBudget);if(key==='reactor')s.reactor+=gain;else if(key==='hull')s.hull+=gain;else s.integrity[key]+=gain;s.repairBudget-=gain;}
      }
      const separation=distance(p,e);
      if(separation>120)this.shipsTouching=false;
      if(separation<100){
        if(!this.shipsTouching)this.events.push({type:'ship-collision',ship:p.name,other:e.name,pos:{x:(p.x+e.x)/2,y:(p.y+e.y)/2,z:(p.z+e.z)/2}});
        this.shipsTouching=true;
        const dx=e.x-p.x||1,dy=e.y-p.y,dz=e.z-p.z,len=Math.hypot(dx,dy,dz);
        if(this.freeFlight){p.x=e.x-dx/len*100;p.y=e.y-dy/len*100;p.z=e.z-dz/len*100;}
        else{e.x=p.x+dx/len*100;e.y=p.y+dy/len*100;e.z=p.z+dz/len*100;}
      }
      // Yorktown tracks through a low-visibility region, but needs a closer fire solution.
      this.aiShot-=dt;this.aiTorp-=dt;
      if(!this.turnBased&&!this.enemyRetreating&&this.aiShot<=0&&range<(this.environment==='nebula'?1250:1500)&&this.fire('phaser',e,p))this.aiShot=4.2;
      if(!this.turnBased&&!this.enemyRetreating&&this.aiTorp<=0&&range<1800&&this.fire('torpedo',e,p))this.aiTorp=11;
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
        const struck=near&&(!this.resolveWeaponHit||!!hit);
        const obstruction=this.stationTrace(t.pos,end,2);
        if(obstruction){if(t.order)t.order.status='intercepted';this.events.push({type:'station-impact',pos:obstruction.pos,weapon:'torpedo'});this.projectiles.splice(this.projectiles.indexOf(t),1);}
        else if(struck){if(t.order)t.order.status='hit';this.damage(target,source,38*t.strength,'torpedo',t.targetSystem,hit);this.projectiles.splice(this.projectiles.indexOf(t),1);}
        else if(t.life>t.maxLife){if(t.order)t.order.status='missed';this.projectiles.splice(this.projectiles.indexOf(t),1);}
        else{t.pos.x+=d.x*step;t.pos.y+=d.y*step;t.pos.z+=d.z*step;}
      }
      this.captureReplay();
    }
  }
  return {Simulation,TURN,PLANET,targets,weaponSpecs,maneuvers,PHASER_DURATION,DESTRUCTION_DURATION,MIN_IMPULSE_SPEED,targetingColor,makeK7,clamp,wrap,delta,direction,distance,bearing,elevation,angle,facing,redistribute,arcs,systems};
});
