/* Perspective-projected 3D scene rendered by Phaser; no remote assets. */
window.createGalaxyScene=({state,systems,selectTarget,line})=>class GalaxyScene extends Phaser.Scene{
  constructor(){super('Map');this.yaw=-25;this.tilt=52;this.zoom=1;}
  camera(){return SpaceMath.camera(this.scale.width,this.scale.height,this.yaw,this.tilt,this.zoom);}
  project(point){return this.camera().project(point);}
  create(){
    this.g=this.add.graphics();this.labels=systems.map(()=>this.add.text(0,0,'',{fontFamily:'Consolas, monospace',fontSize:'9px',color:'#cba26e'}));
    this.coords=this.add.text(12,12,'',{fontFamily:'Consolas, monospace',fontSize:'8px',color:'#9f7547'});
    this.shipLabel=this.add.text(0,0,'ENTERPRISE',{fontFamily:'Consolas, monospace',fontSize:'8px',color:'#ffbc5b'}).setOrigin(.5,0);
    let seed=1701;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    this.dust=Array.from({length:850},(_,i)=>{const arm=i%3,a=random()*Math.PI*3,r=45+random()*480,angle=a+arm*Math.PI*2/3;return {x:500+Math.cos(angle)*r,y:450+Math.sin(angle)*r*.82,z:(random()-.5)*(80+100*(1-r/530)),a:.15+random()*.5,color:random()>.6?0xc59e6e:0xc78c42};});
    this.input.on('pointerdown',p=>{this.drag={x:p.x,y:p.y,yaw:this.yaw,tilt:this.tilt,moved:false};});
    this.input.on('pointermove',p=>{if(!this.drag||!p.isDown)return;const dx=p.x-this.drag.x,dy=p.y-this.drag.y;if(Math.hypot(dx,dy)>5)this.drag.moved=true;if(this.drag.moved){this.yaw=this.drag.yaw+dx*.4;this.tilt=Phaser.Math.Clamp(this.drag.tilt+dy*.3,-82,82);}});
    this.input.on('pointerup',p=>{const drag=this.drag;this.drag=null;if(drag&&!drag.moved)this.selectAt(p.x,p.y);});
    this.input.on('pointerupoutside',()=>{this.drag=null;});
    this.input.on('wheel',(_p,_objects,_x,dy)=>this.setZoom(this.zoom-dy*.001));
    document.getElementById('map-zoom-in').onclick=()=>this.setZoom(this.zoom+.15);
    document.getElementById('map-zoom-out').onclick=()=>this.setZoom(this.zoom-.15);
    document.getElementById('map-home').onclick=()=>{this.yaw=-25;this.tilt=52;this.zoom=1;};
    this.game.canvas.style.touchAction='none';
  }
  setZoom(value){this.zoom=Phaser.Math.Clamp(value,.65,1.8);}
  selectAt(x,y){
    if(window.STCommand?.away.active())return;
    const camera=this.camera(),nearest=systems.map(p=>({system:p,point:camera.project(p)})).sort((a,b)=>Math.hypot(a.point.x-x,a.point.y-y)-Math.hypot(b.point.x-x,b.point.y-y))[0];
    if(Math.hypot(nearest.point.x-x,nearest.point.y-y)<17){selectTarget(nearest.system);return;}
    const point=camera.unproject(x,y,state.z);if(!point||point.x<15||point.x>985||point.y<15||point.y>885)return;
    let option=document.getElementById('waypoint-option');if(!option){option=document.createElement('option');option.id='waypoint-option';option.value='waypoint';document.getElementById('destination').append(option);}option.textContent=`Waypoint ${point.x.toFixed(0)} / ${point.y.toFixed(0)} / ${point.z.toFixed(0)}`;
    selectTarget({...point,id:'waypoint',name:'Custom waypoint',color:0xecbc79});
  }
  update(){
    if(window.STCommand?.away.renderNav(this,this.scale.width,this.scale.height,'map'))return;
    const w=this.scale.width,h=this.scale.height,g=this.g,{project}=this.camera();g.clear();g.fillStyle(0x080503);g.fillRect(0,0,w,h);
    const segment=(a,b,color,alpha=.5,width=1)=>{const p=project(a),q=project(b);line(g,p.x,p.y,q.x,q.y,color,alpha,width);};
    // A faint volume box and reference plane make elevation visible from every orbit angle.
    for(const z of [-200,0,200]){
      for(let x=0;x<=1000;x+=100)segment({x,y:0,z},{x,y:900,z},0x72441d,z===0?.22:.055);
      for(let y=0;y<=900;y+=100)segment({x:0,y,z},{x:1000,y,z},0x72441d,z===0?.22:.055);
    }
    for(const x of [0,1000])for(const y of [0,900])segment({x,y,z:-200},{x,y,z:200},0xa66a2c,.25);
    const core=project({x:500,y:450,z:0});
    for(let i=10;i>0;i--){g.fillStyle(0x874917,.012);g.fillEllipse(core.x,core.y,w*.65*i/10,h*.6*i/10);}
    for(const p of this.dust){const q=project(p);g.fillStyle(p.color,p.a);g.fillCircle(q.x,q.y,Math.max(.45,q.scale*2.3));}
    // Drop lines connect systems to their positions on the galactic reference plane.
    systems.forEach(p=>{segment({...p,z:0},p,p.color,.32);const q=project({...p,z:0});g.lineStyle(1,p.color,.2);g.strokeEllipse(q.x,q.y,8,3);});
    if(state.trail.length>1)for(let i=1;i<state.trail.length;i++)segment(state.trail[i-1],state.trail[i],0xffb44f,.5,1.3);
    const a=project(state),b=project(state.target),dist=Math.hypot(b.x-a.x,b.y-a.y);
    for(let d=0;d<dist;d+=9){const f=d/dist,k=Math.min(d+4,dist)/dist;line(g,a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,a.x+(b.x-a.x)*k,a.y+(b.y-a.y)*k,0xecbc79,.75);}
    systems.map((p,i)=>({p,i,q:project(p)})).sort((a,b)=>a.q.depth-b.q.depth).forEach(({p,i,q})=>{
      const r=Math.max(3,Math.min(7,q.scale*15));for(let n=3;n>0;n--){g.fillStyle(p.color,.04);g.fillCircle(q.x,q.y,r+n*2);}
      g.fillStyle(p.color,.95);g.fillCircle(q.x,q.y,r);g.fillStyle(0x030a15,.55);g.fillCircle(q.x+r*.42,q.y+r*.1,r*.84);g.fillStyle(0xffffff,.65);g.fillCircle(q.x-r*.35,q.y-r*.35,r*.2);
      this.labels[i].setPosition(q.x+r+4,q.y-6).setText(p.name.toUpperCase()).setAlpha(.72+q.scale*.3);
    });
    g.lineStyle(1,0xecbc79,.9);g.strokeEllipse(b.x,b.y,23,12);segment({...state,z:0},state,0xffb44f,.7);
    // An exaggerated Enterprise model: saucer, engineering hull, and two nacelles.
    const hdg=state.heading*Math.PI/180,pitch=state.pitch*Math.PI/180;
    const local=(x,y,z=0)=>project({x:state.x+x*Math.cos(hdg)+y*Math.sin(hdg)*Math.cos(pitch)-z*Math.sin(hdg)*Math.sin(pitch),y:state.y+x*Math.sin(hdg)-y*Math.cos(hdg)*Math.cos(pitch)+z*Math.cos(hdg)*Math.sin(pitch),z:state.z+y*Math.sin(pitch)+z*Math.cos(pitch)});
    const polygon=(points,color)=>{const q=points.map(p=>local(...p));g.fillStyle(color);g.fillPoints(q,true);g.lineStyle(1,0xffdda0,.7);g.strokePoints(q,true);};
    const saucer=Array.from({length:24},(_,i)=>{const t=i*Math.PI/12;return [Math.cos(t)*22,15+Math.sin(t)*22,5];});
    polygon([[-6,-30,0],[6,-30,0],[5,13,0],[-5,13,0]],0x9a6225);
    for(const side of [-1,1]){polygon([[side*7,-14,0],[side*28,-22,3],[side*28,-10,3],[side*7,-5,0]],0x84501d);polygon([[side*25,-38,5],[side*31,-38,5],[side*31,4,5],[side*25,4,5]],0xe5b76d);}
    polygon(saucer,0xe1aa59);const center=local(0,15,8);g.fillStyle(0xffe5ac);g.fillCircle(center.x,center.y,2);
    this.shipLabel.setPosition(a.x,a.y+20);this.coords.setText(`3D VOLUME  /  Z ${state.z>=0?'+':''}${state.z.toFixed(1)} LY\nORBIT ${Math.round(this.yaw)}°  ·  TILT ${Math.round(this.tilt)}°`);
  }
};
