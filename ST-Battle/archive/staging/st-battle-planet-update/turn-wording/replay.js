/* Recorded state playback: no combat rules are re-run during a replay. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BattleReplay=factory();})(globalThis,()=>{
  const copy=value=>JSON.parse(JSON.stringify(value));
  const DESTRUCTION_DURATION=5;
  const actionTypes=new Set(['beam','launch','impact','destroyed','warp','station-impact']);
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
      const frame={at,player:copy(sim.player),enemy:copy(sim.enemy),stageIndex:sim.turn.stageIndex,maneuver:sim.turn.maneuver,phase:sim.turn.phase,
        projectiles:sim.projectiles.map(p=>({id:p.id,from:p.from,target:p.target,pos:{...p.pos}})),result:sim.result};
      const previous=r.frames[r.frames.length-1];if(previous&&Math.abs(previous.at-at)<1e-8)r.frames[r.frames.length-1]=frame;else r.frames.push(frame);
      this.last=at;r.duration=at;r.result=sim.result;r.endedEarly=!!sim.turn.endedEarly;r.endHold=sim.result?DESTRUCTION_DURATION+2:2;
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
  class Player{
    constructor(record,base){
      if(!record?.frames?.length)throw new Error('No recorded turn available');
      this.record=record;this.position=0;this.screenTime=0;this.cursor=0;this.paused=false;this.ended=false;this.hold=0;
      this.state=Object.create(base);Object.assign(this.state,{station:copy(record.station),planet:copy(record.planet||base.planet),environment:record.environment,running:false,replayShot:null,projectiles:[],events:[]});
      this.actions=record.events.map((v,i)=>({...v,index:i})).filter(v=>actionTypes.has(v.event.type));this.sample(0);
    }
    nearestAction(at){
      let best=null,distance=Infinity;
      for(const action of this.actions){const d=Math.abs(action.at-at);if(d<distance||d===distance&&['impact','destroyed'].includes(action.event.type)){best=action;distance=d;}}
      return distance<2?best:null;
    }
    rate(){const action=this.nearestAction(this.position);if(['impact','destroyed'].includes(action?.event.type))return .4;if(['beam','launch'].includes(action?.event.type))return .65;return this.position<2||this.position>this.record.duration-1?1:6;}
    sample(at){
      const frames=this.record.frames;let lo=0,hi=frames.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].at<=at)lo=mid;else hi=mid-1;}
      const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],t=b.at>a.at?Math.min(1,(at-a.at)/(b.at-a.at)):0;
      this.state.player=interpolate(a.player,b.player,t);this.state.enemy=interpolate(a.enemy,b.enemy,t);
      this.state.projectiles=a.projectiles.map(p=>{const next=b.projectiles.find(v=>v.id===p.id);return {...p,pos:next?interpolate(p.pos,next.pos,t):{...p.pos}};});
      this.state.time=this.record.startTime+at;this.state.result=at>=this.record.duration?this.record.result:null;
      this.state.turn={number:this.record.pass,stageIndex:a.stageIndex,maneuver:a.maneuver,phase:a.phase};
      const action=this.nearestAction(at),kind=action?.event.type,focus=action?.event.ship||action?.event.from||'Enterprise';
      const cameraKind=kind==='destroyed'||kind==='impact'&&at>=action.at+.12?'impact':kind==='launch'?'launch':'weapons';
      this.state.replayShot=action?{kind:cameraKind,focus,key:'event-'+action.index+'-'+cameraKind,at}:at<2?{kind:'wide',focus:'Enterprise',key:'intro',at}:{kind:Math.floor(at/8)%3===0?'wide':'hero',focus:Math.floor(at/8)%2?'Yorktown':'Enterprise',key:'travel-'+Math.floor(at/8),at};
      this.state.replayShot.screenAt=this.screenTime;
    }
    advance(dt){
      if(this.paused||this.ended)return {events:[],dt:0};
      const previous=this.position,rate=this.rate();this.screenTime+=Math.max(0,dt);this.position=Math.min(this.record.duration,this.position+Math.max(0,dt)*rate);this.sample(this.position);
      const events=[];while(this.cursor<this.record.events.length&&this.record.events[this.cursor].at<=this.position)events.push(copy(this.record.events[this.cursor++].event));
      if(this.position>=this.record.duration){this.hold+=dt;if(this.hold>=(this.record.endHold??(this.record.result?DESTRUCTION_DURATION+2:2)))this.ended=true;}
      return {events,dt:this.position-previous,rate};
    }
  }
  return {Recorder,Player,interpolate,DESTRUCTION_DURATION};
});
