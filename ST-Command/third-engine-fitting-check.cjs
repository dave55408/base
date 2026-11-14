const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  for(const game of STCommand.games)game.loop.stop();const T=AlpineThree,checks=[];
  const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=880;const c=sheet.getContext('2d'),reference=new Image();reference.src='assets/reference/image-1444/enterprise-orthos.png';await reference.decode();
  c.drawImage(reference,685,80,640,110,0,0,1280,220);c.drawImage(reference,685,555,640,110,0,440,1280,220);
  for(const factory of [createMovieEnterpriseRenderer,createThirdEnterpriseRenderer]){
   const ship=factory();await ship.ready;ship.model.updateWorldMatrix(true,true);
   for(const side of ['port','starboard']){
    const tube=ship.model.getObjectByName(side+'-engine-outer-tube'),parent=tube.parent,e=parent.matrixWorld.elements,sz=Math.hypot(e[8],e[9],e[10]),sr=Math.hypot(e[0],e[1],e[2]);
    const measure=name=>{const mesh=ship.model.getObjectByName(name),p=mesh.geometry.attributes.position,angle=mesh.userData.referenceDimensions.angle,rx=Math.sin(angle),ry=Math.cos(angle);let front=Infinity,rear=-Infinity,rise=0,width=0;
     for(let i=0;i<p.count;i++){const v=parent.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i))),dx=v.x-tube.position.x,dy=v.y-tube.position.y;front=Math.min(front,v.z);rear=Math.max(rear,v.z);rise=Math.max(rise,dx*rx+dy*ry-.087);width=Math.max(width,Math.abs(dx*ry-dy*rx)*2);}return {length:(rear-front)*sz,localLength:rear-front,projection:rise*sr,width:width*sr};};
    checks.push({variant:ship.model.userData.variant,side,fin:measure(side+'-aft-engine-fin'),handle:measure(side+'-inboard-engine-fin')});
    if(ship.model.userData.variant==='third'){
     const fins=[];ship.model.traverse(o=>{if(o.isMesh&&o.name.startsWith(side)&&o.name.endsWith('-aft-engine-fin'))fins.push(o);});
     if(fins.length!==2||fins.some(o=>!o.userData.sheetFitting.flatCrown))throw Error('Both aft rails must use the revised flat crown');
     for(const prefix of [side,side+'-inboard']){
      const vent=ship.model.getObjectByName(prefix+'-aft-engine-vent').userData.aftEngineVent;
      if(!vent.solidPanel||vent.ridges!==12||Math.abs(vent.width*sz-39*1.36/510)>1e-6)throw Error('Rear panels must retain their size with twelve horizontal ridges');
      const panel=ship.model.getObjectByName(prefix+'-aft-engine-vent'),cowling=ship.model.getObjectByName(side+'-rear-exhaust-hood');
      if(panel.children.filter(o=>o.name.includes('-vent-slat-')).length!==12||panel.children.some(o=>o.material!==cowling.material[0]))throw Error('Panel and all twelve ridges must share the cowling finish');
     }
     const seam=ship.model.getObjectByName(side+'-aft-engine-casing-seam'),hood=ship.model.getObjectByName(side+'-rear-exhaust-hood'),hp=hood.geometry.attributes.position;let hoodFront=Infinity;
     for(let i=0;i<hp.count;i++)hoodFront=Math.min(hoodFront,parent.worldToLocal(hood.localToWorld(new T.Vector3().fromBufferAttribute(hp,i))).z);
     if(!seam||seam.position.z>=hoodFront)throw Error('Rear casing seam must remain visible ahead of the exhaust hood');
     for(const fin of fins){
      const p=fin.geometry.attributes.position;let rear=-Infinity;
      for(let i=0;i<p.count;i++)rear=Math.max(rear,parent.worldToLocal(fin.localToWorld(new T.Vector3().fromBufferAttribute(p,i))).z);
      if(Math.abs((seam.position.z-rear)*sz-19*1.36/510)>1e-6)throw Error('Rear fins must move forward while the casing seam stays fixed');
      for(const prefix of [side,side+'-inboard']){
       const panel=ship.model.getObjectByName(prefix+'-raised-aft-engine-vent'),pp=panel.geometry.attributes.position;let panelRear=-Infinity;
       for(let i=0;i<pp.count;i++)panelRear=Math.max(panelRear,parent.worldToLocal(panel.localToWorld(new T.Vector3().fromBufferAttribute(pp,i))).z);
       if(Math.abs(panelRear-rear)>1e-6)throw Error('Square panels must move forward with the fins');
      }
     }
    }
   }
   if(ship.model.userData.variant==='third'){
    const engine=ship.model.getObjectByName('starboard-movie-nacelle'),tube=ship.model.getObjectByName('starboard-engine-outer-tube'),p=tube.geometry.attributes.position;
    let z0=Infinity,z1=-Infinity;for(let i=0;i<p.count;i++){const v=tube.localToWorld(new T.Vector3().fromBufferAttribute(p,i));z0=Math.min(z0,v.z);z1=Math.max(z1,v.z);}
    const center=engine.localToWorld(new T.Vector3(tube.position.x,tube.position.y,0));center.z=(z0+z1)/2;
    ship.model.traverse(mesh=>{if(!mesh.isMesh)return;let owner=mesh;while(owner&&owner!==engine)owner=owner.parent;mesh.visible=owner===engine;});
    for(const [row,offset,up]of [[1,[0,5,0],[-1,0,0]],[3,[5,0,0],[0,1,0]]]){
     const camera=new T.OrthographicCamera(-.854,.854,.147,-.147,.001,20);camera.up.set(...up);camera.position.copy(center).add(new T.Vector3(...offset));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setClearColor(0xffffff,1);ship.renderer.setSize(1280,220,false);ship.renderer.render(ship.scene,camera);c.drawImage(ship.renderer.domElement,0,row*220);
    }
   }
   if(ship.renderer.getContext().getError())throw Error('WebGL error');ship.dispose();
  }
  return {checks,image:sheet.toDataURL().split(',')[1]};
 });
 for(const row of result.checks){if(row.variant==='third'){
  // Independent ratios read from the source drawing, normalized by its saucer diameter.
  assert(Math.abs(row.fin.length/1.36-128/510)<1e-6);assert(Math.abs(row.handle.length/1.36-123/510)<1e-6);
  assert(Math.abs(row.fin.projection-.041958)<1e-6);assert(Math.abs(row.fin.width-.0307396)<1e-6);
 }else{assert(Math.abs(row.fin.localLength-.454141438)<1e-6);assert(Math.abs(row.handle.localLength-.327682525)<1e-6);}}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'preview-third-engine-fittings.png'),Buffer.from(result.image,'base64'));console.log(JSON.stringify(result.checks));console.log('Passed: sheet proportions on both sides of model three, unchanged second model, and top/side rendering.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
