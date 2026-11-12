const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createMovieEnterpriseRenderer);
 const result=await page.evaluate(async()=>{
  const ship=createMovieEnterpriseRenderer();await ship.ready;const T=AlpineThree;
  function triangles(geometry){const out=[];for(const group of geometry.groups)for(let i=group.start;i<group.start+group.count;i+=3)out.push(group.materialIndex+':'+[0,1,2].map(k=>geometry.index.getX(i+k)).join(','));return out.sort();}
  const hoods=['port','starboard'].map(side=>{
   const mesh=ship.model.getObjectByName(side+'-rear-exhaust-hood'),batched=mesh.geometry,legacy=batched.clone(),indices=[];
   for(let n=0;n<96;n++){const i=n*4;indices.push(i,i+4,i+1,i+1,i+4,i+5,i+2,i+3,i+6,i+3,i+7,i+6,i+1,i+5,i+3,i+3,i+5,i+7);}
   legacy.setIndex(indices);legacy.clearGroups();legacy.computeVertexNormals();for(let n=0;n<96;n++){legacy.addGroup(n*18,6,0);legacy.addGroup(n*18+6,6,1);legacy.addGroup(n*18+12,6,0);}
   if(batched.groups.length!==2||JSON.stringify(triangles(batched))!==JSON.stringify(triangles(legacy)))throw new Error('Batching must preserve every triangle and its material');
   const a=batched.attributes.normal.array,b=legacy.attributes.normal.array;if(a.some((v,i)=>v!==b[i]))throw new Error('Original vertex normals must remain unchanged');return {mesh,batched,legacy};
  });
  const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const ctx=canvas.getContext('2d'),sheet=document.createElement('canvas');sheet.width=1920;sheet.height=1920;const c=sheet.getContext('2d'),views=[];
  const angles=[{position:[-2.4,-.45,2.7],aim:[0,.23,-.65]},{position:[-.90,.43,1.22],aim:[-.439,.49,.54]},{position:[.90,.43,1.22],aim:[.439,.49,.54]}];
  function draw(view,legacy){for(const hood of hoods)hood.mesh.geometry=legacy?hood.legacy:hood.batched;ctx.clearRect(0,0,960,640);const [x,y,z]=view.position,dx=view.aim[0]-x,dy=view.aim[1]-y,dz=view.aim[2]-z;ship.draw(ctx,960,640,{x,y:z,z:110+y,bank:0},{heading:Math.atan2(dx,-dz)*180/Math.PI,pitch:Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI,time:0,cameraZoom:1.45});return {pixels:ctx.getImageData(0,0,960,640).data,calls:ship.renderer.info.render.calls,triangles:ship.renderer.info.render.triangles};}
  for(const [i,view] of angles.entries()){
   const before=draw(view,true);c.drawImage(canvas,0,i*640);const after=draw(view,false);c.drawImage(canvas,960,i*640);let differences=0,maxDifference=0;for(let j=0;j<after.pixels.length;j++){const d=Math.abs(after.pixels[j]-before.pixels[j]);if(d)differences++;maxDifference=Math.max(maxDifference,d);}views.push({before:{calls:before.calls,triangles:before.triangles},after:{calls:after.calls,triangles:after.triangles},differences,maxDifference});
  }
  return {groups:hoods.map(h=>({before:h.legacy.groups.length,after:h.batched.groups.length})),views,glError:ship.renderer.getContext().getError(),image:sheet.toDataURL('image/png')};
 });
 // Reordered opaque draws may round a shared antialiased edge by one byte.
 for(const view of result.views){assert.equal(view.after.triangles,view.before.triangles);assert(view.maxDifference<=1,'renders match within one color level');assert(view.before.calls-view.after.calls>=286,'visible cowling draw calls are reduced');}assert.equal(result.glError,0);assert.deepEqual(errors,[]);
 fs.writeFileSync('preview-engine-batching.png',Buffer.from(result.image.split(',')[1],'base64'));console.log(JSON.stringify({groups:result.groups,views:result.views}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
