// Snapshot ST-Command's Class F model as lightweight top-view component outlines.
const fs=require('fs'),path=require('path'),vm=require('vm');
const context={console,AbortController,createMovieHullSurfaceDetail:()=>({apply(){}}),document:{createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/three.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../ST-Command/class-f-shuttle.js'),'utf8'),context);
const T=context.AlpineThree,craft=context.createClassFShuttle(T);craft.updateMatrixWorld(true,true);
const geometry=craft.children[0],point=new T.Vector3();
function hull(points){
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const chain=items=>{const out=[];for(const p of items){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=1e-8)out.pop();out.push(p);}return out;};
  return [...chain(points).slice(0,-1),...chain([...points].reverse()).slice(0,-1)];
}
function outline(objects){
  const points=[];for(const object of objects)object.traverse(mesh=>{
    const vertices=mesh.geometry?.attributes.position;if(!vertices)return;
    for(let i=0;i<vertices.count;i++){point.fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld);points.push([point.x,-point.z]);}
  });return hull(points);
}
const children=geometry.children,paths=[
  outline(children.filter(o=>/class-f-body(?:$|-panel)/.test(o.name))),
  outline(children.filter(o=>o.name==='class-f-body-panel-1')),
  ...children.filter(o=>/class-f-(windshield|engine-shelf|engine-assembly)/.test(o.name)).map(o=>outline([o]))
].filter(points=>points.length>2);
const depths=paths.flatMap(points=>points.map(p=>p[1])),min=Math.min(...depths),max=Math.max(...depths),length=max-min,center=(min+max)/2;
const data={source:'ST-Command/class-f-shuttle.js',length,paths:paths.map(points=>points.map(([x,z])=>[+(x/length).toFixed(6),+((z-center)/length).toFixed(6)]))};
fs.writeFileSync(path.join(__dirname,'assets/camera-shuttle-outline.js'),'/* Class F top-view snapshot; rebuild with node build-shuttle-outline.cjs. Bow faces -Z. */\nwindow.BattleCameraShuttleOutline='+JSON.stringify(data)+';\n');
console.log(`Saved ${paths.length} Class F component outlines.`);
