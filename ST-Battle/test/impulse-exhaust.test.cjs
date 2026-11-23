const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('impulse rear face has one orange inset and a gold border without overlapping surfaces',()=>{
  const c={window:{},console,AbortController};vm.createContext(c);for(const p of ['vendor/three.js','scene.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
  const T=c.window.AlpineThree,scene=Object.create(c.window.BattleScene.prototype);scene.T=T;
  const gold=new T.MeshStandardMaterial({color:0x946c40}),orange=new T.MeshBasicMaterial({color:0xff6746}),width=.27,height=.05,depth=.055;
  const mesh=new T.Mesh(new T.BoxGeometry(width,height,depth),gold);scene.insetImpulseExhaust(mesh,width,height,depth,gold,orange);
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,triangles=[];let total=0,orangeArea=0;
  for(const group of mesh.geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3){
    if(n.getZ(i)<.99)continue;
    const vertices=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)]);assert(vertices.every(v=>Math.abs(v[2]-depth/2)<1e-7));
    const [a,b,c]=vertices,area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;total+=area;if(group.materialIndex===1)orangeArea+=area;triangles.push(vertices);
  }
  assert(Math.abs(total-width*height)<1e-8,'rear triangles cover exactly one face');assert(Math.abs(orangeArea-(width-.032)*(height-.016))<1e-8,'orange center preserves the gold rim');
  const cross=(a,b,x,y)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
  for(let i=0;i<20;i++)for(let j=0;j<10;j++){
    const x=-width/2+(i+.37)/20*width,y=-height/2+(j+.23)/10*height;
    const count=triangles.filter(([a,b,c])=>[cross(a,b,x,y),cross(b,c,x,y),cross(c,a,x,y)].every(v=>v>0)).length;
    assert.equal(count,1,'each rear-face sample has exactly one surface');
  }
  assert.equal(mesh.children.length,0,'no floating exhaust overlay remains');assert.equal(mesh.material[1],orange);
});
