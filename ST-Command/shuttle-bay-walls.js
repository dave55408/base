/* Wall fittings based on the supplied hangar interior reference. */
window.addShuttleBayWalls=(T,room,{rearZ,fitDoorShoulders})=>{
 const walls=new T.Group();walls.name='reference-bay-walls';room.add(walls);
 const paint=(color,emission=.12)=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:emission,roughness:.84,metalness:.08,side:T.DoubleSide});
 const gray=paint(0x66747b),bezel=paint(0x7b898e),cabinet=paint(0x535f66),tan=paint(0x746e57),lowerTan=paint(0x797057,.09),black=paint(0x101a21,.025),glass=paint(0x0b141b,.035),groove=paint(0x253039,.04);
 glass.roughness=.4;glass.metalness=.18;
 const glow=color=>new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false});
 const cyan=glow(0x8bc8cc),yellow=glow(0xd7dc68),green=glow(0x81f49b),red=glow(0xe43d36),white=glow(0xdde7df);
 const wallRear=rearZ+.00665,wallFront=-.0183,wallCenter=(wallRear+wallFront)/2,wallLength=wallFront-wallRear,floor=-.04645;
 function mesh(g,m,name){const o=new T.Mesh(g,m);o.name=name;o.receiveShadow=true;walls.add(o);return o;}
 function box(name,x,y,z,w,h,d,m){const o=mesh(new T.BoxGeometry(w,h,d),m,name);o.position.set(x,y,z);return o;}
 function quad(name,points,m){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return mesh(g,m,name);}
 function prism(name,section,z0,z1,m){
  const p=[],indices=[],n=section.length;for(const z of [z0,z1])for(const [x,y] of section)p.push(x,y,z);
  for(let i=1;i<n-1;i++)indices.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,n+i,j,n+j,n+i);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);const faces=g.toNonIndexed();g.dispose();faces.computeVertexNormals();return mesh(faces,m,name);
 }
 function panelRing(name,outer,inner,m){for(let i=0;i<outer.length;i++){const j=(i+1)%outer.length;quad(name+'-frame-'+i,[outer[i],outer[j],inner[j],inner[i]],m);}}
 for(const side of [-1,1]){
  const prefix=side<0?'port':'starboard',edgeAngle=.315,edgeY=.008+Math.sin(edgeAngle)*.069;
  const ceilingEdge=fitDoorShoulders?Math.min(Math.cos(edgeAngle)*.081,.083*Math.sqrt(1-((edgeY+.043)/.130)**2)-.002):Math.cos(edgeAngle)*.081;
  const ventX=ceilingEdge+.0005;
  // Broad khaki panels sit behind the projecting gray console cabinets.
  quad(prefix+'-bay-upper-infill',[[side*.0808,-.003,wallRear],[side*.0808,-.003,wallFront],[side*.0808,.0222,wallFront],[side*.0808,.0222,wallRear]],tan);
  box(prefix+'-bay-lower-wall',side*.0808,(floor-.016)/2,wallCenter,.0012,-.016-floor,wallLength,lowerTan);
  // Four horizontal slots in each grille module, with visible gray dividers.
  box(prefix+'-bay-vent-rail',side*(ventX+.001),.0252,wallCenter,.004,.0072,wallLength,gray);
  for(let n=0;n<8;n++){
   const z0=wallRear+n*wallLength/8+.0012,z1=wallRear+(n+1)*wallLength/8-.0012;
   for(let row=0;row<4;row++)box(prefix+'-bay-vent-'+n+'-'+row,side*(ventX-.00115),.0228+row*.00135,(z0+z1)/2,.0003,.00065,z1-z0,black);
  }
  box(prefix+'-bay-console-rail',side*.0763,-.016,wallCenter,.0087,.0035,wallLength,gray);
  const faceTop=.009,frontX=.0723;
  const facePoint=(y,z,depth=.0004)=>[side*(frontX-depth),y,z];
  function faceRect(name,yl,yh,zl,zh,m,depth=.0004){return quad(name,[facePoint(yl,zl,depth),facePoint(yl,zh,depth),facePoint(yh,zh,depth),facePoint(yh,zl,depth)],m);}
  // Build parallel wall faces here, then rake the entire fitted surface
  // inward together below, including the screens, trim and door jambs.
  for(let n=0;n<3;n++){
   const z0=-.262+n*.078,z1=z0+.066;
   prism(prefix+'-bay-console-'+n,[[side*frontX,-.017],[side*frontX,faceTop],[side*.081,faceTop],[side*.081,-.017]],z0,z1,cabinet);
   for(let screen=0;screen<2;screen++){
    const za=z0+.006+screen*.028,zb=za+.025,yl=-.0044,yh=.0065;
    const outer=[facePoint(yl,za,.00055),facePoint(yl,zb,.00055),facePoint(yh,zb,.00055),facePoint(yh,za,.00055)];
    const inner=[facePoint(yl+.0012,za+.0013,.00030),facePoint(yl+.0012,zb-.0013,.00030),facePoint(yh-.0012,zb-.0013,.00030),facePoint(yh-.0012,za+.0013,.00030)];
    panelRing(prefix+'-bay-console-bezel-'+n+'-'+screen,outer,inner,bezel);
    quad(prefix+'-bay-console-screen-'+n+'-'+screen,inner,glass);
    if((n+screen)%2===0)faceRect(prefix+'-bay-console-status-bar-'+n+'-'+screen,yl+.0015,yl+.0022,za+.003,zb-.003,groove,.00034);
   }
   const keys=[cyan,cyan,white,yellow,green,green,cyan,yellow];
   for(let k=0;k<keys.length;k++){const z=z0+.008+k*.0068;faceRect(prefix+'-bay-key-'+n+'-'+k,-.0085,-.0068,z,z+.0026,keys[k],.0007);}
   // Short vertical channels emphasize the cast cabinet end sections.
   for(let k=0;k<3;k++)box(prefix+'-bay-console-end-grille-'+n+'-'+k,side*(frontX-.0005),-.003,z0+.002+k*.0017,.0004,.013,.0007,groove);
  }
  for(let n=0;n<4;n++){
   const z0=-.262+n*.078,z1=n===3?.006:z0+.066,z=Math.min((z0+z1)/2,wallFront-.015);
   // Straight, level lintels and symmetric jambs: narrower at the top.
   const section=[[floor,z-.011],[-.0205,z-.0075],[-.0205,z+.0075],[floor,z+.011]],yc=(floor-.0205)/2;
   const outer=section.map(([y,a])=>[side*.0778,Math.max(floor,yc+(y-yc)*1.15),z+(a-z)*1.18]),inner=section.map(([y,a])=>[side*.0799,y,a]);
   panelRing(prefix+'-bay-side-door-'+n,outer,inner,gray);
   quad(prefix+'-bay-side-door-inset-'+n,inner,black);
   box(prefix+'-bay-door-header-'+n,side*.0783,-.0184,z,.003,.0018,.0205,gray);
   for(let k=0;k<2;k++)box(prefix+'-bay-door-indicator-'+n+'-'+k,side*.0766,-.0191,z-.006+k*.012,.0007,.0012,.0015,red);
   if(n<3){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#a8aea4';c.fillRect(0,0,384,96);c.fillStyle='#27343b';c.font='bold 42px Arial';c.textAlign='center';c.fillText('ACCESS 0'+(n+1),192,64);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const plate=new T.MeshStandardMaterial({color:0xffffff,map:texture,roughness:.9,side:T.DoubleSide});
    quad(prefix+'-bay-door-nameplate-'+n,[[side*.0792,-.028,z-.032],[side*.0792,-.028,z-.018],[side*.0792,-.0245,z-.018],[side*.0792,-.0245,z-.032]],plate);
   }
   if(n===1)box(prefix+'-bay-wall-utility-box',side*.077,-.039,z-.025,.005,.006,.010,gray);
  }
  // Tapered end pillars, vertical grilles, and inset status-light stacks.
  const half=createShuttleGarage.doorWidth/2;
  prism(prefix+'-bay-forward-pier',[[side*(half+.004),floor],[side*(half+.016),floor],[side*(half+.016),.018],[side*(half+.007),.036],[side*(half+.002),.036],[side*(half+.004),.018]],rearZ+.00115,rearZ+.00615,gray);
  box(prefix+'-bay-forward-status-recess',side*(half+.0015),.015,rearZ+.0065,.0038,.030,.0004,black);
  for(let n=0;n<5;n++)box(prefix+'-bay-forward-status-'+n,side*(half+.0015),.027-n*.006,rearZ+.00685,.0022,.003,.0005,n===0?red:n%2?white:green);
  for(let n=0;n<4;n++)box(prefix+'-bay-forward-pier-grille-'+n,side*(half+.005+n*.0014),.014,rearZ+.0064,.00065,.026,.0004,black);
  const wallRake=.18;
  for(const o of walls.children){
   if(!o.isMesh||!o.name.startsWith(prefix+'-')||/-bay-(vent|forward)/.test(o.name))continue;
   o.updateMatrix();o.geometry.applyMatrix4(o.matrix);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);
   const p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+side*(.0002-wallRake*(p.getY(i)-floor)));
   p.needsUpdate=true;o.geometry.computeVertexNormals();
  }
  // Close the shallow return to the existing roof grille without moving it.
  const wallTop=.081-wallRake*(.0222-floor);
  quad(prefix+'-bay-upper-wall-return',[[side*wallTop,.0222,wallRear],[side*wallTop,.0222,wallFront],[side*(ventX+.0025),.0222,wallFront],[side*(ventX+.0025),.0222,wallRear]],gray);
 }
 walls.userData.style='reference tan panels, beveled console banks, recessed service doors and louvered grilles';
 return walls;
};
