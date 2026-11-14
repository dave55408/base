const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]})),{createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 assert.equal(digest(path.join(__dirname,'assets/reference/bridge-room.png')),'41fda665f452187a52671b3ac39d5362e05d0e7ae4a8261e83a8e2e8cf5e58cf');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>STCommand?.games.every(g=>g.isBooted));await page.evaluate(()=>{for(const g of STCommand.games)g.loop.stop();});
 await page.keyboard.press('h');assert.equal(await page.evaluate(()=>BridgeHatch.open),true);await page.keyboard.press('h');assert.equal(await page.evaluate(()=>BridgeHatch.open),false);
 await page.locator('#pitch').focus();await page.keyboard.press('h');assert.equal(await page.evaluate(()=>BridgeHatch.open),false);await page.locator('#pitch').evaluate(e=>e.blur());
 await page.locator('#help-link').click();await page.keyboard.press('h');assert.equal(await page.evaluate(()=>BridgeHatch.open),false);await page.keyboard.press('Escape');
 const result=await page.evaluate(async()=>{
  const T=AlpineThree,sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1500;const out=sheet.getContext('2d'),checks=[];
  for(const [row,factory]of [createMovieEnterpriseRenderer,createThirdEnterpriseRenderer,createEnterpriseRenderer].entries()){
   const ship=factory();await ship.ready;ship.model.updateWorldMatrix(true,true);
   const port=ship.model.getObjectByName('aft-bridge-docking-port'),room=port.getObjectByName('bridge-hatch-y-room'),dome=ship.model.getObjectByName('bridge-dome'),picture=room.getObjectByName('bridge-room-back-wall-picture');
   if(!dome.geometry.userData.bridgeHatchOpening||room.userData.layout.branches!==2||!(picture.material.map.image.width>1000))throw Error('Room, entrance and original picture must be loaded');
   room.traverse(object=>{
    if(object.isLight||object.name.startsWith('bridge-room-ceiling-light'))throw Error('Passage lighting must be removed');
    if(object.material?.emissive?.getHex())throw Error('Passage surfaces must not emit light');
   });
   const backWall=room.getObjectByName('bridge-room-back-wall');if(backWall.material.color.getHex()!==0x000000)throw Error('Back wall must be black');
   const bounds=mesh=>{mesh.updateMatrix();const p=mesh.geometry.attributes.position,min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);for(const [k,n]of [v.x,v.y].entries()){min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);}}return {min,max};};
   const wallBounds=bounds(backWall),pictureBounds=bounds(picture);if(Math.abs(wallBounds.max[0]-wallBounds.min[0]-.0243)>1e-8)throw Error('Back wall must use the narrower width');
   if(Math.abs(pictureBounds.min[1]-wallBounds.min[1])>1e-8)throw Error('Picture must align with the floor');
   for(let axis=0;axis<2;axis++)if(pictureBounds.min[axis]<wallBounds.min[axis]-1e-8||pictureBounds.max[axis]>wallBounds.max[axis]+1e-8)throw Error('Complete picture must fit on the back wall');
   const map=picture.material.map,aspect=(pictureBounds.max[0]-pictureBounds.min[0])/(pictureBounds.max[1]-pictureBounds.min[1]);
   if(Math.abs(aspect-1384/1002)>1e-6||map.repeat.x!==1||map.repeat.y!==1||map.offset.x!==0||map.offset.y!==0)throw Error('Picture must preserve its aspect ratio without cropping');
   const p=dome.geometry.attributes.position,levels=new Map();
   for(let i=0;i<p.count;i++){const y=Math.round(p.getY(i)*1e7)/1e7,r=Math.hypot(p.getX(i),p.getZ(i));levels.set(y,Math.max(levels.get(y)||0,r));}
   const profile=[...levels].sort((a,b)=>a[0]-b[0]);
   function radiusAt(y){for(let i=1;i<profile.length;i++){const [a,ra]=profile[i-1],[b,rb]=profile[i];if(y>=a&&y<=b)return ra+(rb-ra)*(y-a)/(b-a);}return -1;}
   let vertices=0;const leaks=[];
   room.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
    const world=mesh.localToWorld(new T.Vector3().fromBufferAttribute(p,i)),v=port.worldToLocal(world.clone());vertices++;
    if(Math.abs(v.x)<=.0105&&v.y>=-.0185&&v.y<=.0155&&v.z>=-.0175&&v.z<=.0175)continue;
    dome.worldToLocal(world);
    // The lowered floor extends into the enclosed deck immediately below the dome.
    const radius=world.y>=profile[0][0] ? radiusAt(world.y) : world.y>=profile[0][0]-.0035 ? profile[0][1] : -1;
    if(Math.hypot(world.x,world.z)>radius+.0003&&leaks.length<8)leaks.push({name:mesh.name,position:world.toArray()});
   }});
   const center=port.localToWorld(new T.Vector3(0,0,.0165)),camera=new T.PerspectiveCamera(38,1.6,.0001,10);camera.position.copy(center).add(new T.Vector3(0,.001,.036));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(800,500,false);
   const sample=document.createElement('canvas');sample.width=800;sample.height=500;const c=sample.getContext('2d'),red=[];
   for(const col of [0,1]){
    BridgeHatch.open=!!col;port.updateHatch(col*2);for(let n=1;n<=15;n++)port.updateHatch(col*2+n*.1);
    if(Math.abs(port.userData.hatchOpen-col)>1e-8)throw Error('Hatch must reach requested position');
    if(room.visible!==!!col)throw Error('Room and picture must be hidden behind the closed doors');
    const backing=port.getObjectByName('docking-closed-hatch-black-backing');
    if(!backing||backing.visible!==!col||backing.material.color.getHex()!==0)throw Error('Black backing must seal the closed hatch and clear the open hatch');
    ship.renderer.render(ship.scene,camera);c.clearRect(0,0,800,500);c.drawImage(ship.renderer.domElement,0,0);out.drawImage(sample,col*800,row*500);
    const data=c.getImageData(250,140,300,220).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]>data[i+1]*1.6&&data[i]>data[i+2]*1.4&&data[i]>45)count++;red.push(count);
   }
   const left=port.getObjectByName('docking-hatch-left'),right=port.getObjectByName('docking-hatch-right');if(Math.abs(left.position.x+.00801*.9)>1e-8||Math.abs(right.position.x-.00801*.9)>1e-8)throw Error('Doors must stop at ninety percent travel');
   BridgeHatch.open=false;for(let n=0;n<16;n++)port.updateHatch(4+n*.1);if(port.userData.hatchOpen!==0)throw Error('Doors must close again');
   checks.push({model:ship.model.userData.variant||'original',vertices,leaks,closedRed:red[0],openRed:red[1],glError:ship.renderer.getContext().getError()});ship.dispose();
  }return {checks,image:sheet.toDataURL().split(',')[1]};
 });
 const preview=path.join(__dirname,'preview-bridge-hatch-room.png');fs.writeFileSync(preview,Buffer.from(result.image,'base64'));console.log(JSON.stringify(result.checks));
 for(const check of result.checks){assert.deepEqual(check.leaks,[],check.model+' room stays inside the dome and hatch block');assert(check.openRed>check.closedRed+40,'Original picture must be visible through the open hatch');assert.equal(check.glError,0);}assert.deepEqual(errors,[]);
 console.log('Passed: exact image, H keyboard control, input/dialog guards, sliding doors, picture visibility and dome containment on all models.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
