/* Optional Three.js adapter. This file does not modify the live simulation.
 * const layer=createWindowPlanLayer(T,layout,{mapWindow(record){
 *   // Register schematic position/normal to the selected model's actual hull.
 *   return {...record,position:surfacePoint,normal:surfaceNormal};
 * }}); model.add(layer);
 * Exported JSON keeps the same stable IDs used in the SVG and editor.
 */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory;else root.createWindowPlanLayer=factory;})(typeof window==='object'?window:globalThis,(T,data,{mapWindow=w=>w,includeEstimated=true,includeNavigation=false}={})=>{
 const layer=new T.Group();layer.name='reference-window-plan';const batches=new Map(),ids=[];
 for(const original of data.windows){
  if(original.category==='aperture'||original.category==='navigation'&&!includeNavigation||original.confidence!=='observed'&&!includeEstimated)continue;
  const w=mapWindow(original);if(!w)continue;const key=w.state+':'+(w.color||'');let batch=batches.get(key);if(!batch)batches.set(key,batch={vertices:[],indices:[],state:w.state,color:w.color,ids:[]});
  const normal=new T.Vector3(...w.normal).normalize(),q=new T.Group().quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal),center=new T.Vector3(...w.position).addScaledVector(normal,.0004),offset=batch.vertices.length/3;
  const points=w.shape==='round'?[[0,0],...Array.from({length:17},(_,i)=>[Math.cos(i*Math.PI/8)*w.width/2,Math.sin(i*Math.PI/8)*w.height/2])]:[[-w.width/2,-w.height/2],[w.width/2,-w.height/2],[w.width/2,w.height/2],[-w.width/2,w.height/2]];
  for(const [x,y]of points)batch.vertices.push(...new T.Vector3(x,y,0).applyQuaternion(q).add(center).toArray());
  if(w.shape==='round')for(let n=1;n<17;n++)batch.indices.push(offset,offset+n,offset+n+1);else batch.indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  batch.ids.push(w.id);ids.push(w.id);
 }
 for(const [key,batch]of batches){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(batch.vertices,3));geometry.setIndex(batch.indices);geometry.computeVertexNormals();
  const lit=batch.state==='lit',color=batch.color||(lit?0xffdfac:0x18262e),material=new T.MeshStandardMaterial({color,emissive:lit?color:0x000000,emissiveIntensity:lit?1.4:0,roughness:.8,metalness:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const mesh=new T.Mesh(geometry,material);mesh.name='window-plan-'+key;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.windowIds=batch.ids;layer.add(mesh);
 }
 layer.userData={schemaVersion:1,revision:data.revision,windowIds:ids,registrationRequired:true};return layer;
});
