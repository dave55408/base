/* Lightweight wireframe attitude monitor for the Enterprise remote helm. */
(()=>{
 const panel=document.createElement('aside');panel.id='enterprise-inset';panel.hidden=true;panel.setAttribute('aria-label','Enterprise remote helm and tactical attitude monitor');
 panel.innerHTML='<div class="enterprise-inset-title">ENTERPRISE · REMOTE HELM</div><canvas id="enterprise-inset-canvas" width="440" height="300" role="img" aria-label="Forward-facing Enterprise wireframe with three-dimensional yaw, pitch and roll reference rings"></canvas><output id="enterprise-inset-readout"></output><div class="enterprise-inset-keys">NUMPAD 1 / 3 YAW · 5 / 2 PITCH<br>7 / 4 POWER · 8 ALL STOP · 0 / . ROLL<br>− RETURN TO NEUTRAL</div>';
 document.querySelector('.tactical').append(panel);
 const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d'),readout=panel.querySelector('output'),rad=Math.PI/180;
 const paths=[],rings=[];let last=-Infinity,previous=null,camera,pivot;
 const circle=(center,r1,r2,plane,segments=48)=>Array.from({length:segments+1},(_,n)=>{
  const a=n/segments*Math.PI*2,p=[...center],axes=plane==='xz'?[0,2]:plane==='yz'?[1,2]:[0,1];p[axes[0]]+=Math.cos(a)*r1;p[axes[1]]+=Math.sin(a)*r2;return p;
 });
 const hull=points=>paths.push(points);
 // Sparse outlines describe the saucer, bridge, engineering hull and nacelles.
 for(const y of [.14,.20])hull(circle([0,y,-.42],.63,.52,'xz'));
 for(let n=0;n<8;n++){const a=n*Math.PI/4;hull([[Math.cos(a)*.63,.14,-.42+Math.sin(a)*.52],[Math.cos(a)*.63,.20,-.42+Math.sin(a)*.52]]);}
 hull(circle([0,.235,-.42],.15,.13,'xz'));hull(circle([0,.26,-.42],.07,.06,'xz'));
 hull([[-.06,.14,-.08],[-.06,-.16,.35],[.06,-.16,.35],[.06,.14,-.08],[-.06,.14,-.08]]);
 for(const z of [-.08,.36,.84])hull(circle([0,-.18,z],.14,.15,'xy',24));
 for(let n=0;n<8;n++){const a=n*Math.PI/4;hull([-.08,.36,.84].map(z=>[Math.cos(a)*.14,-.18+Math.sin(a)*.15,z]));}
 hull(circle([0,-.18,-.10],.10,.10,'xy',24));
 for(const side of [-1,1]){
  for(const z of [.04,1.02])hull(circle([side*.64,.27,z],.075,.075,'xy',24));
  for(let n=0;n<4;n++){const a=n*Math.PI/2;hull([[side*.64+Math.cos(a)*.075,.27+Math.sin(a)*.075,.04],[side*.64+Math.cos(a)*.075,.27+Math.sin(a)*.075,1.02]]);}
  hull([[side*.10,-.13,.35],[side*.60,.23,.54],[side*.60,.23,.66],[side*.10,-.13,.47],[side*.10,-.13,.35]]);
 }
 for(const radius of [.65,1.08,1.44])rings.push({points:circle([0,0,0],radius,radius,'xz',96),color:'#ffe16b88'});
 rings.push({points:circle([0,0,0],1.44,1.44,'yz',96),color:'#ffe16b88'},{points:circle([0,0,0],1.44,1.44,'xy',96),color:'#ffe16baa'});
 function signed(value,digits=2){return (value<-.5?'−':'+')+Math.abs(Math.round(value)).toString().padStart(digits,'0')+'°';}
 function project(point,rotated=false){const p=new AlpineThree.Vector3(...point);if(rotated)p.multiplyScalar(1.15).applyQuaternion(pivot.quaternion);p.project(camera);return [(p.x+1)*canvas.width/2,(1-p.y)*canvas.height/2];}
 function stroke(points,color,width=1,rotated=false){ctx.beginPath();for(const [n,p]of points.entries()){const [x,y]=project(p,rotated);n?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 window.EnterpriseInset={render(m,s){
  const visible=!!m.freeSpace&&!!m.carrier&&!['bridge','orbit'].includes(m.phase);panel.hidden=!visible;if(!visible){previous=null;return;}
  const now=performance.now();if(now-last<50)return;last=now;
  const c=m.carrier,b=m.bridgeState,T=AlpineThree,yaw=((c.heading+180)%360+360)%360-180,values={yaw,pitch:c.pitch,roll:c.roll/rad};
  readout.innerHTML=Object.entries(values).map(([axis,value])=>'<span data-axis="'+axis+'" data-active="'+(!!previous&&Math.abs(value-previous[axis])>.05)+'">'+axis.toUpperCase()+'<strong>'+signed(value,axis==='yaw'?3:2)+'</strong></span>').join('')+'<small>HDG '+Math.round(b.heading).toString().padStart(3,'0')+'° · '+(c.speed*1000).toFixed(0)+' M/S · '+Math.round(b.throttle)+'%</small>';
  previous=values;
  // Look straight ahead so zero pitch puts the compass horizon flat and
  // the ship level in the same reference frame.
  if(!camera){camera=new T.OrthographicCamera(-2.42,2.42,1.65,-1.65,.1,20);camera.position.set(0,0,-3.5);camera.lookAt(0,0,0);camera.updateWorldMatrix(true,false);pivot=new T.Group();}
  // The front-facing camera reverses screen X. Mirror yaw and bank together
  // so the nose and hull lean toward the same commanded screen direction.
  pivot.rotation.set(c.pitch*rad,c.heading*rad,c.roll,'YXZ');
  ctx.fillStyle='#090603';ctx.fillRect(0,0,canvas.width,canvas.height);
  stroke([[-1.6,0,0],[1.6,0,0]],'#ffe16b44');stroke([[0,-1.55,0],[0,1.55,0]],'#ffe16b44');
  for(const ring of rings)stroke(ring.points,ring.color);
  for(let n=0;n<24;n++){const a=n*Math.PI/12;stroke([[Math.cos(a)*1.44,Math.sin(a)*1.44,0],[Math.cos(a)*1.50,Math.sin(a)*1.50,0]],'#ffe16b');}
  ctx.save();ctx.shadowColor='#40a9ff';ctx.shadowBlur=3;
  for(const points of paths)stroke(points,'#69c5ff',1.35,true);
  ctx.restore();
  stroke([[0,0,0],[0,0,-1.27]],'#ffe16b',1.4,true);
  const nose=project([0,0,-1.27],true);ctx.fillStyle='#ffe16b';ctx.beginPath();ctx.arc(nose[0],nose[1],2.6,0,Math.PI*2);ctx.fill();
  ctx.font='10px Consolas, monospace';ctx.fillStyle='#ffe16b';ctx.fillText('YAW',canvas.width-59,canvas.height/2+42);ctx.fillText('PITCH',canvas.width/2+8,19);ctx.fillText('ROLL',13,canvas.height/2-10);
  ctx.fillText('NCC-1701',12,canvas.height-12);
 }};
})();
