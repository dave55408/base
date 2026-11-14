/* The four white atlas markings become shallow plates following the saucer skin. */
window.addRaisedSaucerPanels=(T,saucer)=>{
 const p=saucer.geometry.attributes.position,index=saucer.geometry.index,triangles=[];
 for(let i=0;i<(index?index.count:p.count);i+=3){
  const v=[0,1,2].map(k=>{const j=index?index.getX(i+k):i+k;return [p.getX(j),p.getY(j),p.getZ(j)];});
  const [a,b,c]=v,det=(b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]);
  if(Math.abs(det)>1e-12)triangles.push({a,b,c,det});
 }
 function surface(x,z){let y=-Infinity;for(const {a,b,c,det}of triangles){const dx=x-a[0],dz=z-a[2],u=(dx*(c[2]-a[2])-(c[0]-a[0])*dz)/det,v=((b[0]-a[0])*dz-dx*(b[2]-a[2]))/det;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)y=Math.max(y,a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]));}if(!Number.isFinite(y))throw Error('Raised saucer panel must lie on the saucer');return y;}
 const white=new T.MeshStandardMaterial({color:0xedf1e4,roughness:.72,metalness:.12});
 // Grid ink at its atlas opacity over the surrounding hull gray.
 const edge=new T.MeshStandardMaterial({color:0x94a296,roughness:.76,metalness:.12,side:T.DoubleSide});
 for(let n=0;n<4;n++){
  const angle=Math.PI/4+n*Math.PI/2,positions=[],indices=[],steps=6;
  function point(u,v,lift){const x=(Math.sin(angle)*.455+u*Math.cos(angle)+v*Math.sin(angle))*1.38,z=(Math.cos(angle)*.455-u*Math.sin(angle)+v*Math.cos(angle))*1.38;return [x,surface(x,z)+lift,z];}
  for(let row=0;row<=steps;row++)for(let col=0;col<=steps;col++)positions.push(...point(-.009+.018*col/steps,-.012+.024*row/steps,.0003));
  for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){const a=row*(steps+1)+col,b=a+steps+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const topCount=indices.length;
  for(const [a,b]of [[[-.009,-.012],[.009,-.012]],[[.009,-.012],[.009,.012]],[[.009,.012],[-.009,.012]],[[-.009,.012],[-.009,-.012]]])for(let i=0;i<steps;i++){
   const uv=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],u=uv(i/steps),v=uv((i+1)/steps),start=positions.length/3;
   positions.push(...point(...u,-.00015),...point(...v,-.00015),...point(...u,.0003),...point(...v,.0003));indices.push(start,start+1,start+2,start+1,start+3,start+2);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.addGroup(0,topCount,0);g.addGroup(topCount,indices.length-topCount,1);g.computeVertexNormals();
  const plate=new T.Mesh(g,[white,edge]);plate.name='saucer-raised-white-panel-'+n;plate.userData={rise:.0003,gridEdgeColor:0x94a296};saucer.add(plate);
 }
};
