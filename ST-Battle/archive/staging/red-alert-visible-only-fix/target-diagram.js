/* Perspective 3D wireframe, rendered locally without another WebGL context. */
(()=>{
  const anchors={hull:[0,.3,-1.12],bridge:[0,.57,-1.12],engines:[0,.38,-.44],mainEngines:[.56,.53,.1],reactor:[0,.02,-.02],shields:[0,.1,-.58],weapons:[-.4,.31,-1.3],sensors:[0,.13,-1.12],
    'shield-fore':[0,.2,-2],'shield-aft':[0,.1,.9],'shield-port':[-1,.2,-.5],'shield-starboard':[1,.2,-.5],'shield-dorsal':[0,1,-.5],'shield-ventral':[0,-.7,-.5]};
  const TAU=Math.PI*2;
  class TargetDiagram{
    constructor(host,onSelect){
      this.host=host;this.onSelect=onSelect;this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Rotatable 3D Yorktown target diagram. Drag to rotate; arrow keys rotate; plus and minus zoom.');
      this.canvas.tabIndex=0;this.canvas.setAttribute('role','img');host.prepend(this.canvas);this.context=this.canvas.getContext('2d');this.yaw=.65;this.pitch=.65;this.zoom=1.15;this.layer='systems';this.target=null;
      this.lines=[];this.points={};this.build();let drag=null;
      this.canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch,moved:false};this.canvas.setPointerCapture(e.pointerId);});
      this.canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=drag.moved||Math.hypot(dx,dy)>4;this.yaw=drag.yaw+dx*.012;this.pitch=Battle.clamp(drag.pitch+dy*.01,-1.5,1.5);this.draw();});
      this.canvas.addEventListener('pointerup',e=>{
        if(drag&&!drag.moved){const rect=this.canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;let found=null,nearest=20;
          for(const [key,p] of Object.entries(this.points)){const d=Math.hypot(p.x-x,p.y-y);if(d<nearest){nearest=d;found=key;}}if(found)this.onSelect(found);
        }drag=null;
      });
      for(const event of ['pointercancel','lostpointercapture'])this.canvas.addEventListener(event,()=>drag=null);
      this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Battle.clamp(this.zoom*Math.exp(-e.deltaY*.001),.65,1.8);this.draw();},{passive:false});
      this.canvas.addEventListener('keydown',e=>{const k=e.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(k))return;e.preventDefault();if(k==='Home'){this.yaw=.65;this.pitch=.65;this.zoom=1.15;}if(k==='ArrowLeft')this.yaw-=.15;if(k==='ArrowRight')this.yaw+=.15;if(k==='ArrowUp')this.pitch=Battle.clamp(this.pitch-.15,-1.5,1.5);if(k==='ArrowDown')this.pitch=Battle.clamp(this.pitch+.15,-1.5,1.5);if(k==='+'||k==='=')this.zoom=Math.min(1.8,this.zoom+.1);if(k==='-')this.zoom=Math.max(.65,this.zoom-.1);this.draw();});
      if(typeof ResizeObserver!=='undefined'){this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(host);}
    }
    add(key,points){this.lines.push({key,points});}
    ring(key,c,r,axis='y'){
      const points=[];for(let i=0;i<=48;i++){const a=i/48*TAU;points.push(axis==='y'?[c[0]+r[0]*Math.cos(a),c[1],c[2]+r[2]*Math.sin(a)]:axis==='z'?[c[0]+r[0]*Math.cos(a),c[1]+r[1]*Math.sin(a),c[2]]:[c[0],c[1]+r[1]*Math.cos(a),c[2]+r[2]*Math.sin(a)]);}this.add(key,points);
    }
    ellipsoid(key,c,r){for(const axis of ['x','y','z'])this.ring(key,c,r,axis);}
    build(){
      for(const [r,y] of [[.69,.32],[.64,.4],[.48,.44],[.25,.49]])this.ring('hull',[0,y,-1.12],[r,0,r]);
      for(let i=0;i<12;i++){const a=i/12*TAU;this.add('hull',[[.25*Math.cos(a),.49,-1.12+.25*Math.sin(a)],[.69*Math.cos(a),.32,-1.12+.69*Math.sin(a)]]);}
      this.ellipsoid('bridge',[0,.54,-1.12],[.11,.07,.11]);this.ellipsoid('sensors',[0,.18,-1.12],[.22,.09,.22]);
      this.add('shields',[[0,.34,-.85],[0,.03,-.55],[0,.03,-.2]]);
      for(const z of [-.7,-.5,-.2,.2,.45])this.ring('reactor',[0,.02,z],[.14,.14,0],'z');
      for(let i=0;i<8;i++){const a=i/8*TAU;this.add('reactor',[[-.7,-.5,-.2,.2,.45].map(z=>[.14*Math.cos(a),.02+.14*Math.sin(a),z])].flat());}
      this.ring('engines',[0,.38,-.44],[.16,.04,0],'z');this.ring('weapons',[-.4,.31,-1.3],[.07,.03,.07]);
      for(const side of [-1,1]){
        this.add('mainEngines',[[side*.08,.02,-.1],[side*.56,.53,.15]]);
        for(const z of [-.8,-.65,0,.68])this.ring('mainEngines',[side*.56,.53,z],[.085,.085,0],'z');
        for(let i=0;i<8;i++){const a=i/8*TAU;this.add('mainEngines',[[side*.56+.085*Math.cos(a),.53+.085*Math.sin(a),-.8],[side*.56+.085*Math.cos(a),.53+.085*Math.sin(a),.68]]);}
      }
      this.ellipsoid('envelope',[0,.15,-.55],[1.02,.85,1.52]);
    }
    project(point,width,height){
      const x=point[0],y=point[1]-.2,z=point[2]+.55,c=Math.cos(this.yaw),s=Math.sin(this.yaw),u=x*c+z*s,v=-x*s+z*c;
      const ry=y*Math.cos(this.pitch)-v*Math.sin(this.pitch),depth=y*Math.sin(this.pitch)+v*Math.cos(this.pitch),scale=Math.min(width/3.8,height/3.1)*this.zoom*4/(4+depth);
      return {x:width/2+u*scale,y:height/2-ry*scale,depth};
    }
    draw(){
      const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
      const dpr=Math.min(globalThis.devicePixelRatio||1,2),c=this.context;this.canvas.width=w*dpr;this.canvas.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
      c.fillStyle='#091923';c.fillRect(0,0,w,h);c.strokeStyle='#17313d';c.lineWidth=.5;
      for(let x=0;x<w;x+=30){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=0;y<h;y+=30){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
      for(const line of this.lines){if(line.key==='envelope'&&this.layer!=='shields')continue;const selected=line.key===this.target||line.key==='envelope'&&this.target?.startsWith('shield-');c.strokeStyle=selected?'#ffd094':line.key==='envelope'?'#7786c6':'#659db0';c.lineWidth=selected?2:1;c.beginPath();line.points.forEach((v,i)=>{const p=this.project(v,w,h);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();}
      this.points={};const keys=Object.keys(anchors).filter(k=>k.startsWith('shield-')===(this.layer==='shields'));
      const groups=[[],[]];keys.forEach((key,i)=>{const point=this.project(anchors[key],w,h);this.points[key]=point;groups[i%2].push({key,point});});
      for(let side=0;side<2;side++){
        const list=groups[side].sort((a,b)=>a.point.y-b.point.y);
        list.forEach(({key,point},i)=>{
          const labelX=side?w-74:74,labelY=32+i*(h-64)/Math.max(1,list.length-1),button=document.getElementById('target-'+key);
          button.style.left=labelX+'px';button.style.top=labelY+'px';
          c.strokeStyle=key===this.target?'#ffd094':'#476373';c.lineWidth=1;c.beginPath();c.moveTo(labelX, labelY);c.lineTo(point.x,point.y);c.stroke();c.beginPath();c.arc(point.x,point.y,key===this.target?6:3,0,TAU);c.fillStyle=key===this.target?'#ffd094':'#8bbacb';c.fill();
        });
      }
      c.fillStyle='#85a3b5';c.font='10px Consolas';c.textAlign='center';c.fillText('YORKTOWN / DRAG TO ROTATE / SCROLL TO ZOOM',w/2,h-8);
    }
    setSelection(target,layer){this.target=target;this.layer=layer;this.draw();}
    reset(){this.yaw=.65;this.pitch=.65;this.zoom=1.15;this.draw();}
  }
  TargetDiagram.anchors=anchors;window.BattleTargetDiagram=TargetDiagram;
})();
