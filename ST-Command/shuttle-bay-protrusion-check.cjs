const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,sheet=document.createElement('canvas');sheet.width=1800;sheet.height=1100;const ctx=sheet.getContext('2d'),checks=[];
  for(const [row,factory]of [createMovieEnterpriseRenderer,createEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.model.updateWorldMatrix(true,true);const room=ship.model.getObjectByName('reference-bay-interior'),parts=[];
   room.traverse(o=>{if(o.isMesh&&(/-bay-console-(screen-)?3$/.test(o.name)||/-bay-key-3-\d$/.test(o.name)))parts.push(o);});
   const wallEnds=[];ship.model.traverse(o=>{if(!o.isMesh||!/-bay-(upper-infill|console-rail)$|-hangar-(upper-)?wall$/.test(o.name))return;o.updateMatrix();const p=o.geometry.attributes.position;let end=-Infinity;for(let i=0;i<p.count;i++)end=Math.max(end,new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrix).z);wallEnds.push({name:o.name,end});});
   let contained=true;for(const mesh of parts){mesh.updateMatrix();const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrix);if(p.z>.00601||(p.x/.083)**2+((p.y+.043)/.130)**2>=1)contained=false;}}
   let camera=new T.OrthographicCamera(-.13,.13,.08,-.08,.001,20);camera.position.copy(room.localToWorld(new T.Vector3(0,.025,.36)));camera.lookAt(room.localToWorld(new T.Vector3(0,.025,.018)));camera.updateWorldMatrix(true,false);ship.renderer.setSize(900,550,false);
   function frame(open,hide){ship.setBayDoorOpen(open);for(const part of parts)part.visible=!hide;ship.renderer.render(ship.scene,camera);const canvas=document.createElement('canvas');canvas.width=900;canvas.height=550;const c=canvas.getContext('2d');c.fillStyle='#01050e';c.fillRect(0,0,900,550);c.drawImage(ship.renderer.domElement,0,0);return {canvas,pixels:c.getImageData(0,0,900,550).data};}
   const closed=frame(0,false),hiddenClosed=frame(0,true);
   camera=new T.PerspectiveCamera(75,900/550,.0005,20);camera.position.copy(room.localToWorld(new T.Vector3(0,.006,-.15)));camera.lookAt(room.localToWorld(new T.Vector3(0,.006,.018)));camera.updateWorldMatrix(true,false);
   const open=frame(1,false),hiddenOpen=frame(1,true);
   function changed(a,b){let count=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>3)count++;return count;}
   ctx.drawImage(closed.canvas,0,row*550);ctx.drawImage(open.canvas,900,row*550);ctx.font='16px Consolas';ctx.fillStyle='#ffd08a';ctx.fillText((row?'ORIGINAL':'MOVIE')+' / CLOSED',14,row*550+25);ctx.fillText((row?'ORIGINAL':'MOVIE')+' / OPEN',914,row*550+25);
   checks.push({contained,parts:parts.length,wallEnds,closedLeaks:changed(closed.pixels,hiddenClosed.pixels),openVisible:changed(open.pixels,hiddenOpen.pixels),glError:ship.renderer.getContext().getError()});
  }
  return {checks,image:sheet.toDataURL('image/png')};
 });
 if(process.argv.includes('--preview')){const file=path.join(os.tmpdir(),'st-command-bay-protrusions.png');fs.writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));console.log('Preview: '+file);}
 for(const check of result.checks){assert.equal(check.parts,0,'fourth console panels, screens and keys are removed');assert(check.wallEnds.length>=4);for(const wall of check.wallEnds)assert(wall.end<=.018001,wall.name+' ends at the hangar door');assert.equal(check.closedLeaks,0);assert.equal(check.openVisible,0);assert.equal(check.glError,0);}assert.deepEqual(errors,[]);
 console.log('Passed: walls and ledges end at the hangar door; fourth console panels remain absent with doors open and closed on both models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(error=>{console.error(error);process.exitCode=1;});
