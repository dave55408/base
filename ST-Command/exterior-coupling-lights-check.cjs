const path=require('path'),assert=require('assert/strict'),fs=require('fs'),os=require('os'),{chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createThirdEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  STCommand.games.forEach(g=>g.loop.stop());const T=AlpineThree,ship=NightMode.attach(createThirdEnterpriseRenderer());await ship.ready;ship.model.updateWorldMatrix(true,true);
  const lamps=ship.model.userData.exteriorLights.lamps.filter(l=>l.id.endsWith('nacelle-forward'));
  const results=lamps.map(l=>{
   const fixture=ship.model.getObjectByName('hull-spotlight-'+l.id),mesh=ship.model.getObjectByName(fixture.userData.mount),p=mesh.geometry.attributes.position,index=mesh.geometry.index,origin=l.light.position,direction=l.light.target.position.clone().sub(origin),distance=direction.length();direction.normalize();let intersections=0;
   const vertex=i=>ship.model.worldToLocal(mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,index?index.getX(i):i)));
   // Double-sided segment/triangle checks catch a beam starting inside the
   // raised coupling even when the rendered light does not cast shadows.
   for(let i=0;i<(index?index.count:p.count);i+=3){
    const a=vertex(i),b=vertex(i+1),c=vertex(i+2),e1=b.clone().sub(a),e2=c.clone().sub(a),cross=direction.clone().cross(e2),det=e1.dot(cross);if(Math.abs(det)<1e-10)continue;
    const s=origin.clone().sub(a),u=s.dot(cross)/det;if(u<0||u>1)continue;const q=s.clone().cross(e1),v=direction.dot(q)/det;if(v<0||u+v>1)continue;const t=e2.dot(q)/det;if(t>.00001&&t<distance)intersections++;
   }
   return {id:l.id,mount:fixture.userData.mount,source:origin.toArray(),fixture:fixture.position.toArray(),intersections};
  });
  NightMode.enabled=true;ExteriorLights.enabled=true;const camera=new T.PerspectiveCamera(45,1.5,.001,10);camera.position.set(0,.9,-1.25);camera.lookAt(new T.Vector3(0,.47,-.55));ship.renderer.setSize(1200,800,false);ship.renderer.setClearColor(0x03070b,1);ship.renderer.render(ship.scene,camera);
  const darkFixtures=['port','starboard'].map(side=>ship.model.getObjectByName('hull-spotlight-'+side+'-nacelle-forward-lens')?.material.emissiveIntensity===0);
  return {results,darkFixtures,gl:ship.renderer.getContext().getError(),image:ship.renderer.domElement.toDataURL().split(',')[1]};
 });
 const preview=path.join(os.tmpdir(),'st-command-coupling-lights.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));delete result.image;console.log(JSON.stringify(result));console.log(preview);
 assert.deepEqual(errors,[]);assert.equal(result.gl,0);assert.equal(result.results.length,0);assert(result.darkFixtures.every(Boolean));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
