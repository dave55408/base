/* Recorded state playback: no combat rules are re-run during a replay. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BattleReplay=factory();})(globalThis,()=>{
  const copy=value=>JSON.parse(JSON.stringify(value));
  const DESTRUCTION_DURATION=5;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const actionTypes=new Set(['beam','launch','impact','destroyed','warp','station-impact','station-collision','ship-collision']);
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
        projectiles:sim.projectiles.map(p=>({id:p.id,from:p.from,target:p.target,heading:p.heading,pitch:p.pitch,pos:{...p.pos}})),result:sim.result};
      const previous=r.frames[r.frames.length-1];if(previous&&Math.abs(previous.at-at)<1e-8)r.frames[r.frames.length-1]=frame;else r.frames.push(frame);
      this.last=at;r.duration=at;r.result=sim.result;r.endedEarly=!!sim.turn.endedEarly;r.endHold=sim.result?DESTRUCTION_DURATION+10:2;
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
      this.record=record;this.position=0;this.screenTime=0;this.cursor=0;this.paused=false;this.ended=false;this.hold=0;this.playbackRate=1;
      this.state=Object.create(base);Object.assign(this.state,{station:copy(record.station),planet:copy(record.planet||base.planet),environment:record.environment,running:false,replayShot:null,projectiles:[],events:[]});
      this.actions=record.events.map((v,i)=>({...v,index:i})).filter(v=>actionTypes.has(v.event.type));this.sample(0);
    }
    nearestAction(at){
      let best=null,distance=Infinity;
      for(const action of this.actions){const d=Math.abs(action.at-at);if(d<distance||d===distance&&['impact','destroyed'].includes(action.event.type)){best=action;distance=d;}}
      return distance<2?best:null;
    }
    rate(){
      const at=this.position;let rate=1+5*smooth(2,4,at)*(1-smooth(Math.max(2,this.record.duration-4),Math.max(3,this.record.duration-1),at));
      for(const action of this.actions){
        const impact=['impact','destroyed','station-impact','station-collision','ship-collision'].includes(action.event.type),weapon=['beam','launch'].includes(action.event.type);if(!impact&&!weapon)continue;
        const offset=at-action.at,weight=smooth(-2.5,-.3,offset)*(1-smooth(impact ? .65 : 1.3,2.5,offset));
        rate=Math.min(rate,6+((impact ? .4 : .65)-6)*weight);
      }
      // Keep a traveling torpedo legible instead of compressing its flight.
      if(this.state.projectiles.length)rate=Math.min(rate,1.1);
      return Math.max(.4,rate);
    }
    sample(at){
      const frames=this.record.frames;let lo=0,hi=frames.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].at<=at)lo=mid;else hi=mid-1;}
      const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)],t=b.at>a.at?Math.min(1,(at-a.at)/(b.at-a.at)):0;
      this.state.player=interpolate(a.player,b.player,t);this.state.enemy=interpolate(a.enemy,b.enemy,t);
      this.state.projectiles=a.projectiles.map(p=>{const next=b.projectiles.find(v=>v.id===p.id);return {...p,pos:next?interpolate(p.pos,next.pos,t):{...p.pos}};});
      this.state.time=this.record.startTime+at;this.state.result=at>=this.record.duration?this.record.result:null;
      this.state.turn={number:this.record.pass,stageIndex:a.stageIndex,maneuver:a.maneuver,phase:a.phase};
      const recent=this.actions.filter(action=>action.at<=at),destroyed=recent.findLast(action=>action.event.type==='destroyed');
      const beam=this.actions.find(action=>action.event.type==='beam'&&at>=action.at-.25&&at<action.at+Math.min(1.1,action.event.duration||1.4));
      const impact=recent.findLast(action=>['impact','station-impact','station-collision','ship-collision'].includes(action.event.type)&&at-action.at<1.25);
      const projectile=this.state.projectiles[0],action=this.nearestAction(at),focus=action?.event.ship||action?.event.from||'Enterprise';
      if(destroyed)this.state.replayShot={kind:'destruction',focus:destroyed.event.ship,key:'destruction-'+destroyed.index,destructionElapsed:Math.min(DESTRUCTION_DURATION,this.hold),at};
      else if(this.screenTime<4.5)this.state.replayShot={kind:'establishing',focus:'Enterprise',key:'intro',at};
      else if(beam)this.state.replayShot={kind:'phaser',focus:beam.event.from,event:copy(beam.event),key:'beam-'+beam.index,at};
      else if(impact)this.state.replayShot={kind:'impact',focus:impact.event.ship||(impact.event.from==='Enterprise'?'Yorktown':'Enterprise'),event:copy(impact.event),key:'impact-'+impact.index,at};
      else if(projectile)this.state.replayShot={kind:'torpedo',focus:projectile.from,projectileId:projectile.id,key:'torpedo-'+projectile.id,at};
      else {
        const beat=Math.floor(this.screenTime/7),types=['wide','tracking','trailing','flyby'];
        this.state.replayShot=action?{kind:action.event.type==='launch'?'launch':'weapons',focus,key:'event-'+action.index,at}:{kind:types[beat%types.length],focus:beat%2?'Yorktown':'Enterprise',key:'travel-'+beat,at};
      }
      this.state.replayShot.screenAt=this.screenTime;
    }
    advance(dt){
      if(this.paused||this.ended)return {events:[],dt:0};
      const previous=this.position,step=Math.max(0,dt),desired=this.rate();
      this.playbackRate+=(desired-this.playbackRate)*(1-Math.exp(-step*7));const rate=this.playbackRate;
      this.screenTime+=step;this.position=Math.min(this.record.duration,this.position+step*rate);this.sample(this.position);
      const events=[];while(this.cursor<this.record.events.length&&this.record.events[this.cursor].at<=this.position)events.push(copy(this.record.events[this.cursor++].event));
      if(this.position>=this.record.duration){this.hold+=dt;if(this.hold>=(this.record.endHold??(this.record.result?DESTRUCTION_DURATION+10:2)))this.ended=true;}
      return {events,dt:this.position-previous,rate};
    }
  }
  return {Recorder,Player,interpolate,DESTRUCTION_DURATION};
});
