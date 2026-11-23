/* State changes and confirmed Enterprise impacts drive Erica's damage reports. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BattleBridgeWarnings=factory();})(typeof window==='object'?window:globalThis,()=>class{
  constructor(){this.reset();}
  reset(){this.player=null;this.latched=new Set();this.recent=new Map();this.hits=[];this.rangeArmed=false;this.rangeInitialized=false;this.rangeDeparted=false;}
  update(sim,events=[],maxRange=1900){
    const p=sim.player;
    if(this.player!==p){this.reset();this.player=p;}
    if(!sim.running||sim.freeFlight||sim.result)return [];
    const lines=[],now=sim.time;
    const emit=(key,text,priority,valid=()=>true,cooldown=20,speaker='helm')=>{
      if(now-(this.recent.get(key)??-Infinity)<cooldown)return;
      this.recent.set(key,now);lines.push({key:'erica-'+key,text,priority,valid,speaker});
    };
    const transition=(key,active,recovered,text,priority)=>{
      if(active&&!this.latched.has(key)){this.latched.add(key);emit(key,text,priority,()=>this.conditions(sim)[key]);}
      else if(recovered)this.latched.delete(key);
    };
    const range=sim.range;
    if(!this.rangeInitialized){this.rangeArmed=range<=maxRange;this.rangeInitialized=true;}
    if(range<=maxRange-50){
      this.rangeArmed=true;
      if(this.rangeDeparted){this.rangeDeparted=false;emit('yorktown-back-in-range',"They're back in range.",2,()=>sim.range<=maxRange&&sim.enemy.hull>0,20,'allison');}
    }
    if(this.rangeArmed&&range>maxRange&&sim.enemy.hull>0){
      this.rangeArmed=false;this.rangeDeparted=true;
      emit('yorktown-out-of-range',"They're out of range.",2,()=>sim.range>maxRange&&sim.enemy.hull>0,20,'allison');
    }
    const state=this.conditions(sim),shieldValues=Object.values(p.shields);
    const average=shieldValues.reduce((a,b)=>a+b,0)/shieldValues.length;
    for(const [key,label] of [['sensors','Sensors'],['shields','Shields'],['engines','Engines'],['weapons','Weapons']]){
      const output=sim.output(p,key);
      const restored=key==='sensors'?p.integrity.sensors>18&&output>=4.5:
        key==='weapons'?p.integrity.weapons>=15&&output>=4:
        key==='engines'?output>=1:p.integrity.shields>=5&&shieldValues.some(value=>value>5);
      transition(key+'-offline',state[key+'-offline'],restored,label+' are offline',3.5);
    }
    transition('shields-critical',state['shields-critical'],average>=35,'Shields at critical level',3);
    const labels={fore:'Foreward',aft:'Aft',starboard:'Starboard',port:'Port',dorsal:'Dorsal',ventral:'Ventral'};
    for(const [arc,label] of Object.entries(labels))transition(arc+'-critical',state[arc+'-critical'],p.shields[arc]>=35,label+' shields at critical',2.8);
    transition('hull-critical',state['hull-critical'],p.hull>=35,"We're not going to last long",3.2);
    transition('uneasy',state.uneasy,p.hull>=60,"I've got a bad feeling about this",1.5);
    const hits=events.filter(event=>event.type==='impact'&&event.ship===p.name&&!event.practice&&event.amount>0&&event.amount>(event.hullDamage||0)&&Object.hasOwn(labels,event.arc));
    this.hits=this.hits.filter(at=>now-at<8);this.hits.push(...hits.map(()=>now));
    if(hits.length){
      if(new Set(hits.map(event=>event.arc)).size>1||this.hits.length>=3)emit('shield-damage','The shields are taking damage',2,()=>true,12);
      else{
        const arc=hits[0].arc;
        // The critical warning takes precedence when this hit crosses its threshold.
        if(!state[arc+'-critical']&&!state['shields-offline'])emit(arc+'-hit',labels[arc]+' shields took a hit',2,()=>true,12);
      }
    }
    return lines.sort((a,b)=>b.priority-a.priority);
  }
  conditions(sim){
    const p=sim.player,values=Object.values(p.shields),average=values.reduce((a,b)=>a+b,0)/values.length;
    const offline=p.integrity.shields<=0||values.every(value=>value<=0);
    return {
      'sensors-offline':p.integrity.sensors<=12||sim.output(p,'sensors')<3.5,
      'shields-offline':offline,
      'engines-offline':sim.output(p,'engines')<=0,
      'weapons-offline':p.integrity.weapons<10||sim.output(p,'weapons')<3,
      'shields-critical':!offline&&average<=25,
      ...Object.fromEntries(Object.entries(p.shields).map(([arc,value])=>[arc+'-critical',!offline&&value<=25])),
      'hull-critical':p.hull>0&&p.hull<25,
      uneasy:p.hull>=25&&p.hull<50
    };
  }
});
