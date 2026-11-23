/* Recorded state playback: no combat rules are re-run during a replay. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BattleReplay=factory();})(globalThis,()=>{
  const copy=value=>JSON.parse(JSON.stringify(value));
  const DESTRUCTION_DURATION=5;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const actionTypes=new Set(['beam','launch','nacelle-detached','torpedo-missed','impact','destroyed','warp','station-impact','station-collision','ship-collision','shield-disrupted']);
  class Recorder{
    constructor(sim){
      this.start=sim.time;this.last=-1;this.seen=new WeakSet(sim.events);
      this.record={pass:sim.turn.number,maneuvers:[...sim.turn.maneuvers],environment:sim.environment,station:copy(sim.station),planet:copy(sim.planet),startTime:sim.time,duration:0,result:null,frames:[],events:[]};
    }
    capture(sim,force=false){
      const at=Math.max(0,sim.time-this.start),r=this.record;let action=false;
      for(const event of sim.events){
        if(this.seen.has(event))continue;this.seen.add(event);
        if(event.type==='message')continue;
        r.events.push({at,event:copy(event)});if(actionTypes.has(event.type))action=true;
      }
      if(!force&&!action&&at-this.last<.1-1e-6)return;
      const frame={at,player:copy(sim.player),enemy:copy(sim.enemy),enemyRetreating:!!sim.enemyRetreating,stageIndex:sim.turn.stageIndex,maneuver:sim.turn.maneuver,phase:sim.turn.phase,
        projectiles:sim.projectiles.map(p=>({id:p.id,from:p.from,target:p.target,heading:p.heading,pitch:p.pitch,pos:{...p.pos}})),result:sim.result};
      const previous=r.frames[r.frames.length-1];if(previous&&Math.abs(previous.at-at)<1e-8)r.frames[r.frames.length-1]=frame;else r.frames.push(frame);
      this.last=at;r.duration=at;r.result=sim.result;r.endedEarly=!!sim.turn.endedEarly;r.endHold=sim.result?DESTRUCTION_DURATION:2;
    }
    finish(sim){this.capture(sim,true);return this.record;}
  }
  function interpolate(a,b,t){
    const out={...a};
    for(const key of Object.keys(a)){
      if(typeof a[key]==='number'&&typeof b[key]==='number')out[key]=key==='heading'?((a[key]+(((b[key]-a[key]+540)%360)-180)*t)%360+360)%360:a[key]+(b[key]-a[key])*t;
      else if(a[key]&&b[key]&&typeof a[key]==='object'&&!Array.isArray(a[key]))out[key]=interpolate(a[key],b[key],t);
    }return out;
  }
  // Edit around complete actions rather than playing every second of travel.
  function highlights(record){
    const duration=record.duration,frames=record.frames,candidates=[];
    const add=(start,end,score,kind)=>candidates.push({start:Math.max(0,start),end:Math.min(duration,end),score,kind});
    for(const {at,event} of record.events){
      if(!actionTypes.has(event.type))continue;
      let end=at+2.5,score=1;
      if(event.type==='launch'){
        const first=frames.find(f=>f.at>=at-1e-6&&f.projectiles.some(p=>p.from===event.from));
        const before=frames.findLast(f=>f.at<at-1e-6),existing=new Set(before?.projectiles.map(p=>p.id)||[]);
        const projectile=first?.projectiles.find(p=>p.from===event.from&&!existing.has(p.id))||first?.projectiles.findLast(p=>p.from===event.from);
        if(projectile){
          const gone=frames.find(f=>f.at>first.at&&!f.projectiles.some(p=>p.id===projectile.id));
          end=(gone?.at??duration)+2.5;
        }
        score=4;
      }else if(event.type==='beam'){end=at+(event.duration||1.4)+2;score=3;}
      else if(event.type==='destroyed'){score=100;end=duration;}
      else if(event.type==='impact')score=event.hullDamage>0?6+Math.min(12,event.hullDamage/3):2;
      else if(event.type.includes('collision')||event.type==='station-impact')score=9;
      else if(event.type==='nacelle-detached'){score=15;end=at+4;}
      else if(event.type==='warp')score=5;
      add(at-1.5,end,score,'action');
    }
    // A close pass and a withdrawal are interesting even without weapons fire.
    let close=null,withdraw=null;
    const finish=(span,kind)=>{if(span&&span.end-span.start>=1)add(span.start-1,span.end+1,kind==='withdrawal'?5:4,kind);};
    for(const f of frames){
      const range=Math.hypot(f.player.x-f.enemy.x,f.player.y-f.enemy.y,f.player.z-f.enemy.z);
      const turning=Math.max(...[f.player,f.enemy].map(s=>Math.max(Math.abs(s.turnRate||0),Math.abs(s.pitchRate||0))));
      const near=range<950&&turning>2&&turning<35;
      const retreat=f.enemyRetreating||['withdraw','disengage'].includes(f.phase)||f.maneuver==='flee';
      if(near){if(!close)close={start:f.at,end:f.at};close.end=Math.min(f.at,close.start+8);}else{finish(close,'duel');close=null;}
      if(retreat){if(!withdraw)withdraw={start:f.at,end:f.at};withdraw.end=Math.min(f.at,withdraw.start+8);}else{finish(withdraw,'withdrawal');withdraw=null;}
    }
    finish(close,'duel');finish(withdraw,'withdrawal');
    const merge=list=>{
      const out=[];
      for(const item of list.sort((a,b)=>a.start-b.start)){
        const previous=out.at(-1);
        if(previous&&item.start<=previous.end+.75){previous.end=Math.max(previous.end,item.end);previous.score=Math.max(previous.score,item.score);}
        else out.push({...item});
      }return out;
    };
    const selected=merge(candidates).sort((a,b)=>b.score-a.score||a.start-b.start).slice(0,5);
    const scenes=merge([{start:0,end:Math.min(4.5,duration),score:0,kind:'opening'},...selected]);
    return scenes.map((scene,index)=>({...scene,key:'sequence-'+index}));
  }
  class Player{
    constructor(record,base,{fullTurn=false}={}){
      if(!record?.frames?.length)throw new Error('No recorded turn available');
      this.record=record;this.position=0;this.screenTime=0;this.cursor=0;this.paused=false;this.ended=false;this.hold=0;this.playbackRate=1;
      this.state=Object.create(base);Object.assign(this.state,{station:copy(record.station),planet:copy(record.planet||base.planet),environment:record.environment,running:false,replayShot:null,projectiles:[],events:[]});
      this.fullTurn=fullTurn;this.sequences=fullTurn?[{start:0,end:record.duration,key:'full-turn'}]:highlights(record);this.sequenceIndex=0;this.sequenceRevision=0;this.sequenceScreenStart=0;this.lastInterestingScreen=0;
      // A centered filter softens helm corrections without adding chase lag to the replay.
      this.poseFrames=record.frames.map((frame,index,frames)=>{
        const result={};for(const role of ['player','enemy']){
          const base=frame[role];let weight=0,heading=0,pitch=0,bank=0;
          let first=index;while(first>0&&frame.at-frames[first-1].at<=.65)first--;
          for(let j=first;j<frames.length&&frames[j].at-frame.at<=.65;j++){
            const other=frames[j],delta=other.at-frame.at;
            if(record.events.some(e=>e.event.type==='warp'&&e.at>Math.min(frame.at,other.at)&&e.at<=Math.max(frame.at,other.at)))continue;
            const w=Math.exp(-.5*(delta/.28)**2),pose=other[role];weight+=w;
            heading+=(((pose.heading-base.heading+540)%360)-180)*w;
            pitch+=((pose.pitch||0)-(base.pitch||0))*w;bank+=(pose.bank||0)*w;
          }
          const strength=record.duration>0?smooth(0,.6,frame.at)*(1-smooth(Math.max(0,record.duration-.6),record.duration,frame.at)):0;
          result[role]={heading:((base.heading+heading/(weight||1)*strength)%360+360)%360,pitch:(base.pitch||0)+pitch/(weight||1)*strength,bank:bank/(weight||1)*.55};
        }return result;
      });
      this.actions=record.events.map((v,i)=>({...v,index:i})).filter(v=>actionTypes.has(v.event.type));this.sample(0);
    }
    nearestAction(at){
      let best=null,distance=Infinity;
      for(const action of this.actions){const d=Math.abs(action.at-at);if(d<distance||d===distance&&['impact','destroyed'].includes(action.event.type)){best=action;distance=d;}}
      return distance<2?best:null;
    }
    rate(){
      if(this.fullTurn)return 1;
      const at=this.position;let rate=1+5*smooth(2,4,at)*(1-smooth(Math.max(2,this.record.duration-4),Math.max(3,this.record.duration-1),at));
      for(const action of this.actions){
        const impact=['impact','destroyed','station-impact','station-collision','ship-collision'].includes(action.event.type),weapon=['beam','launch'].includes(action.event.type);if(!impact&&!weapon)continue;
        const offset=at-action.at,weight=smooth(-2.5,-.3,offset)*(1-smooth(impact ? .65 : 1.3,2.5,offset));
        rate=Math.min(rate,6+((impact ? .4 : .65)-6)*weight);
      }
      if(this.record.events.some(entry=>entry.event.type==='bridge-dialogue'&&at>=entry.at-.5&&at<entry.at+2.5))rate=Math.min(rate,1);
      // Keep a traveling torpedo legible instead of compressing its flight.
      if(this.state.projectiles.length)rate=Math.min(rate,1.1);
      // Fast-forwarding a turn makes a controlled maneuver look like a spin.
      const turning=Math.max(...[this.state.player,this.state.enemy].map(ship=>Math.max(Math.abs(ship.turnRate||0),Math.abs(ship.pitchRate||0))));
      if(turning>6)rate=Math.min(rate,turning>20?.65:1);
      return Math.max(.4,rate);
    }
    sample(at){
      const frames=this.record.frames;let lo=0,hi=frames.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].at<=at)lo=mid;else hi=mid-1;}
      const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],t=b.at>a.at?Math.min(1,(at-a.at)/(b.at-a.at)):0;
      this.state.player=interpolate(a.player,b.player,t);this.state.enemy=interpolate(a.enemy,b.enemy,t);
      this.state.replayPoses={Enterprise:interpolate(this.poseFrames[lo].player,this.poseFrames[Math.min(lo+1,frames.length-1)].player,t),Yorktown:interpolate(this.poseFrames[lo].enemy,this.poseFrames[Math.min(lo+1,frames.length-1)].enemy,t)};
      this.state.projectiles=a.projectiles.map(p=>{const next=b.projectiles.find(v=>v.id===p.id);return {...p,pos:next?interpolate(p.pos,next.pos,t):{...p.pos}};});
      this.state.time=this.record.startTime+at;this.state.result=at>=this.record.duration?this.record.result:null;
      this.state.turn={number:this.record.pass,stageIndex:a.stageIndex,maneuver:a.maneuver,phase:a.phase};
      this.state.enemyRetreating=!!a.enemyRetreating;
      const recent=this.actions.filter(action=>action.at<=at),destroyed=recent.findLast(action=>action.event.type==='destroyed');
      const beam=this.actions.find(action=>action.event.type==='beam'&&at>=action.at-.25&&at<action.at+Math.min(1.1,action.event.duration||1.4));
      const impact=recent.findLast(action=>['impact','station-impact','station-collision','ship-collision'].includes(action.event.type)&&at-action.at<1.25);
      const projectile=this.state.projectiles[0],action=this.nearestAction(at),focus=action?.event.ship||action?.event.from||'Enterprise';
      if(destroyed)this.state.replayShot={kind:'destruction',focus:destroyed.event.ship,key:'destruction-'+destroyed.index,destructionElapsed:Math.min(DESTRUCTION_DURATION,this.hold),at};
      else if(at<4.5&&this.screenTime<4.5)this.state.replayShot={kind:'establishing',focus:'Enterprise',key:'intro',at};
      else if(impact)this.state.replayShot={kind:'impact',focus:impact.event.ship||(impact.event.from==='Enterprise'?'Yorktown':'Enterprise'),event:copy(impact.event),key:'impact-'+impact.index,at};
      else if(beam)this.state.replayShot={kind:'phaser',focus:beam.event.from,event:copy(beam.event),key:'beam-'+beam.index,at};
      else if(projectile)this.state.replayShot={kind:'torpedo',focus:projectile.from,projectileId:projectile.id,key:'torpedo-'+projectile.id,at};
      else if(this.state.enemyRetreating||['withdraw','disengage'].includes(a.phase)||a.maneuver==='flee')this.state.replayShot={kind:'withdrawal',focus:this.state.enemyRetreating?'Yorktown':'Enterprise',key:'withdrawal-'+a.stageIndex+'-'+Math.floor(this.screenTime/7),at};
      else {
        this.state.replayShot=action?{kind:action.event.type==='launch'?'launch':'weapons',focus,key:'event-'+action.index,at}:{kind:'duel',focus:'Enterprise',key:'maneuver',at};
      }
      const damage=this.actions.findLast(action=>action.event.type==='impact'&&action.event.hullDamage>0&&action.event.hit&&at>=action.at-.35&&at<action.at+3);
      if(!destroyed&&this.screenTime>=4.5&&damage)this.state.replayShot={kind:'component',focus:damage.event.ship,event:copy(damage.event),key:'damage-insert-'+damage.index,damageInsert:true,at};
      const sequence=this.sequences.find(s=>at>=s.start-1e-6&&at<=s.end+1e-6);
      if(sequence&&!this.fullTurn){
        this.state.replayShot.sequenceKey=sequence.key+'-edit-'+this.sequenceRevision;
        this.state.replayShot.sequenceEnd=sequence.end;
        if(this.state.replayShot.kind!=='establishing'&&this.state.replayShot.kind!=='destruction'&&!this.state.replayShot.damageInsert)this.state.replayShot.key=this.state.replayShot.sequenceKey;
      }
      this.state.replayShot.screenAt=this.screenTime;
    }
    sceneIsQuiet(){
      if(this.fullTurn)return false;
      if(this.dialogueBusy||this.position<4.5||this.state.projectiles.length||this.state.result)return false;
      const activeBeam=this.actions.some(a=>a.event.type==='beam'&&this.position>=a.at&&this.position<a.at+(a.event.duration||1.4));
      const p=this.state.player,e=this.state.enemy,range=Math.hypot(p.x-e.x,p.y-e.y,p.z-e.z);
      const velocity=ship=>{const yaw=(ship.heading||0)*Math.PI/180,pitch=(ship.pitch||0)*Math.PI/180,speed=ship.speed||0;return [Math.sin(yaw)*Math.cos(pitch)*speed,Math.sin(pitch)*speed,-Math.cos(yaw)*Math.cos(pitch)*speed];};
      const pv=velocity(p),ev=velocity(e),relative=Math.hypot(...pv.map((v,i)=>v-ev[i]));
      const turning=Math.max(Math.abs(p.turnRate||0),Math.abs(e.turnRate||0),Math.abs(p.pitchRate||0),Math.abs(e.pitchRate||0));
      const maneuver=range<950&&relative>25&&turning>3;
      if(activeBeam||maneuver){this.lastInterestingScreen=this.screenTime;return false;}
      return this.screenTime-this.sequenceScreenStart>=3.5&&this.screenTime-this.lastInterestingScreen>=1.6;
    }
    advance(dt){
      if(this.paused||this.ended)return {events:[],dt:0};
      let cut=false;
      if(this.sceneIsQuiet()){
        const current=this.sequences[this.sequenceIndex],next=this.actions.find(a=>a.at>this.position&&a.at<=current.end);
        const destination=next?Math.max(this.position,next.at-1.25):current.end;
        if(destination-this.position>.35){
          this.position=destination;this.sequenceRevision++;cut=true;
          this.sequenceScreenStart=this.screenTime;this.lastInterestingScreen=this.screenTime;
          while(this.cursor<this.record.events.length&&this.record.events[this.cursor].at<this.position)this.cursor++;
          this.sample(this.position);
        }
      }
      const sequence=this.sequences[this.sequenceIndex];
      if(this.position>=sequence.end-1e-6&&this.sequenceIndex<this.sequences.length-1&&!this.dialogueBusy){
        this.sequenceIndex++;this.position=this.sequences[this.sequenceIndex].start;cut=true;this.playbackRate=1;
        this.sequenceScreenStart=this.screenTime;this.lastInterestingScreen=this.screenTime;
        while(this.cursor<this.record.events.length&&this.record.events[this.cursor].at<this.position)this.cursor++;
        this.sample(this.position);
      }
      const previous=this.position,step=Math.max(0,dt),desired=this.rate();
      this.playbackRate+=(desired-this.playbackRate)*(1-Math.exp(-step*7));
      const turning=[this.state.player,this.state.enemy].some(ship=>Math.abs(ship.turnRate||0)>6||Math.abs(ship.pitchRate||0)>6);
      const rate=turning?Math.min(this.playbackRate,desired):this.playbackRate;
      this.screenTime+=step;this.position=Math.min(this.sequences[this.sequenceIndex].end,this.position+step*rate);this.sample(this.position);
      const events=[];while(this.cursor<this.record.events.length&&this.record.events[this.cursor].at<=this.position)events.push(copy(this.record.events[this.cursor++].event));
      if(events.some(event=>actionTypes.has(event.type)))this.lastInterestingScreen=this.screenTime;
      if(!this.dialogueBusy&&this.sequenceIndex===this.sequences.length-1&&this.position>=this.sequences.at(-1).end){if(previous>=this.sequences.at(-1).end)this.hold+=step;if(this.hold>=(this.record.endHold??(this.record.result?DESTRUCTION_DURATION:2)))this.ended=true;}
      return {events,dt:this.position-previous,rate,cut};
    }
  }
  return {Recorder,Player,interpolate,highlights,DESTRUCTION_DURATION};
});
