/* Compact aft nacelle vent: dark shallow frame and fine horizontal louvers. */
window.createAftEngineVent=(T,{x,centerY,side,radius=.087,z=.62,axialWidth=.095,namePrefix=null,solidPanel=false,surfaceMaterial=null})=>{
 const group=new T.Group(),prefix=namePrefix??(side<0?'port':'starboard');group.name=prefix+'-aft-engine-vent';
 const width=axialWidth,height=.066,face=radius+.0012,count=12;
 const frame=solidPanel&&surfaceMaterial?surfaceMaterial:new T.MeshStandardMaterial({color:0x39413d,roughness:.82,metalness:.25}),slat=solidPanel&&surfaceMaterial?surfaceMaterial:new T.MeshStandardMaterial({color:0x515a54,roughness:.72,metalness:.32}),dark=new T.MeshBasicMaterial({color:0x202723});
 function mesh(geo,mat,name){const o=new T.Mesh(geo,mat);o.name=prefix+name;group.add(o);return o;}
 // Fit the rear of the rectangular frame to the actual 64-sided tube surface.
 const positions=[],indices=[],rows=24;
 const casingX=y=>{const a=Math.asin(Math.max(-1,Math.min(1,y/radius))),step=Math.PI/32,mid=(Math.floor(a/step)+.5)*step;return radius*Math.cos(step/2)/Math.cos(a-mid)*Math.cos(a)-.0002;};
 for(let i=0;i<=rows;i++){const dy=-height/2+height*i/rows;for(const axial of [-width/2,width/2])for(const r of [casingX(dy),face])positions.push(x+side*r,centerY+dy,z+axial);}
 for(let i=0;i<rows;i++){const a=i*4,b=a+4;indices.push(a+1,a+3,b+1,a+3,b+3,b+1,a,b,a+2,a+2,b,b+2,a,a+1,b,b,a+1,b+1,a+2,b+2,a+3,a+3,b+2,b+3);}
 indices.push(0,2,1,1,2,3);const end=rows*4;indices.push(end,end+1,end+2,end+1,end+3,end+2);
 if(side>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);const flat=geometry.toNonIndexed();flat.computeVertexNormals();mesh(flat,frame,'-raised-aft-engine-vent');
 if(solidPanel&&!surfaceMaterial){frame.color.setHex(0x737d75);slat.color.setHex(0x8b958b);}
 const backing=mesh(new T.BoxGeometry(.0003,height-.0024,width-.0024),solidPanel?slat:dark,'-outer-service-grille');backing.position.set(x+side*(face+.00012),centerY,z);
 const openingHeight=height-.0032,pitch=openingHeight/count;
 for(let n=0;n<count;n++){
  const y=centerY-openingHeight/2+(n+.5)*pitch,section=solidPanel?[[0,-pitch*.35],[.0007,-pitch*.24],[.0011,-pitch*.08],[.0011,pitch*.08],[.0007,pitch*.24],[0,pitch*.35]]:[[-.00008,-pitch*.38],[.00048,-pitch*.30],[.00035,pitch*.35],[-.00008,pitch*.40]],p=[],idx=[];
  for(const axial of [-width/2+.0015,width/2-.0015])for(const [lift,dy] of section)p.push(x+side*(face+.00030+lift),y+dy,z+axial);
  const size=section.length;
  for(let j=1;j<size-1;j++)idx.push(0,j+1,j,size,size+j,size+j+1);
  for(let j=0;j<size;j++){const k=(j+1)%size;idx.push(j,k,j+size,k,k+size,j+size);}
  if(side<0)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);const flat=g.toNonIndexed();flat.computeVertexNormals();mesh(flat,slat,'-aft-engine-vent-slat-'+n);
 }
 group.userData.aftEngineVent={width,height,slats:count,ridges:solidPanel?count:0,side,solidPanel};return group;
};
