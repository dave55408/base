const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createEnterpriseRenderer);
  const result=await page.evaluate(async({movie,close,domes})=>{
    const ship=movie?createMovieEnterpriseRenderer():createEnterpriseRenderer(),canvas=document.createElement('canvas');canvas.width=1400;canvas.height=900;const c=canvas.getContext('2d');c.fillStyle='#111a20';c.fillRect(0,0,1400,900);
    await ship.ready;
    const position=domes?[-.80,.58,-1.10]:close?[-.90,.43,1.22]:[-2.4,-.45,2.7],aim=domes?[-.439,.49,-.69]:close?[-.439,.49,.54]:[0,.23,-.65],dx=aim[0]-position[0],dy=aim[1]-position[1],dz=aim[2]-position[2];
    ship.draw(c,1400,900,{x:position[0],y:position[2],z:110+position[1],bank:0},{heading:Math.atan2(dx,-dz)*180/Math.PI,pitch:Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI,time:0,cameraZoom:1.45});
    const present=['port-rear-exhaust-hood','starboard-rear-exhaust-hood','port-rear-exhaust-insert','starboard-rear-exhaust-insert','port-dark-inboard-channel','starboard-dark-inboard-channel'].every(name=>ship.model.getObjectByName(name));
    const ridgeAxialRatios=[];
    ship.model.updateWorldMatrix(true,true);
    const hoodCoverage=movie?['port','starboard'].map(side=>{const o=ship.model.getObjectByName(side+'-rear-exhaust-hood'),p=o.geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){const v=new AlpineThree.Vector3().fromBufferAttribute(p,i);o.localToWorld(v);o.parent.worldToLocal(v);min=Math.min(min,v.y);max=Math.max(max,v.y);}return {min,max};}):[];
    const ridgeCounts=['port','starboard'].map(side=>{let count=0;ship.model.traverse(o=>{if(o.name.startsWith(side+'-rear-cowling-ridge-')){
      count++;const p=o.geometry.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];for(let k=0;k<3;k++){min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);}}
      ridgeAxialRatios.push((max[2]-min[2])/Math.hypot(max[0]-min[0],max[1]-min[1]));
    }});return count;});
    return {present,ridgeCounts,ridgeAxialRatios,hoodCoverage,image:canvas.toDataURL('image/jpeg',.94)};
  },{movie:process.argv.includes('--movie'),close:process.argv.includes('--close'),domes:process.argv.includes('--domes')});assert(result.present,'both engines have the corrected rear assemblies and inboard channels');
  if(process.argv.includes('--movie'))assert.deepEqual(result.ridgeCounts,[12,12],'ridges continue around both extended cowlings');
  if(process.argv.includes('--movie'))assert(result.hoodCoverage.every(h=>h.min<-.085&&h.max>.085),'both cowlings extend fully to the underside');
  if(process.argv.includes('--movie'))assert(result.ridgeAxialRatios.every(r=>r>4),'all cowling ridges run lengthwise along the engine axis');
  fs.writeFileSync(path.join(__dirname,process.argv.includes('--domes')?'preview-movie-dome-lines.jpg':process.argv.includes('--close')?'preview-movie-cowling-ridges.jpg':process.argv.includes('--movie')?'preview-movie-engine-colors.jpg':'preview-reference-angle.jpg'),Buffer.from(result.image.split(',')[1],'base64'));
  console.log(process.argv.includes('--image')?result.image:'Passed: corrected rear nacelle assemblies and inboard channels; reference-angle preview saved.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
