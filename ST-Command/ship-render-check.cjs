const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
    const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.STCommand?.games.every(g=>g.isBooted));
    const result=await page.evaluate(async()=>{
      const ship=createEnterpriseRenderer();await ship.ready;if(!ship)throw Error('Ship WebGL renderer unavailable');
      const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=1500;const c=canvas.getContext('2d');
      const undersideFill=new AlpineThree.DirectionalLight(0xdce8df,1.3);undersideFill.position.set(0,-4,2);ship.scene.add(undersideFill);
      const views=[['AFT / SHUTTLE BAY',[0,.25,2.7],[0,.25,-.7]],['FRONT',[0,.55,-4],[0,.25,-.7]],['TOP',[0,4.3,-.7],[0,.25,-.71]],['STARBOARD',[3.4,.25,-.7],[0,.25,-.7]],['UNDERSIDE',[0,-3.7,-.7],[0,.25,-.71]],['PERSPECTIVE',[2.7,1.9,2.8],[0,.25,-.7]]];
      const counts=views.map(([name,position,aim],i)=>{
        const tile=document.createElement('canvas');tile.width=900;tile.height=500;const tc=tile.getContext('2d');
        const dx=aim[0]-position[0],dy=aim[1]-position[1],dz=aim[2]-position[2];
        undersideFill.visible=name==='UNDERSIDE';
        ship.draw(tc,900,500,{x:position[0],y:position[2],z:110+position[1],bank:0},{heading:Math.atan2(dx,-dz)*180/Math.PI,pitch:Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI});
        if(name!=='PERSPECTIVE'){
          const halfWidth=(name==='FRONT'||name.startsWith('AFT'))?.88:1.76,cam=new AlpineThree.OrthographicCamera(-halfWidth,halfWidth,halfWidth/1.8,-halfWidth/1.8,.01,100);
          if(name==='TOP'){cam.position.set(0,5,-.66);cam.up.set(-1,0,0);}else if(name==='UNDERSIDE'){cam.position.set(0,-5,-.66);cam.up.set(1,0,0);}else if(name==='FRONT')cam.position.set(0,.25,-5);else if(name.startsWith('AFT'))cam.position.set(0,.25,5);else cam.position.set(5,.25,-.66);
          cam.lookAt(0,.25,-.66);ship.renderer.render(ship.scene,cam);tc.clearRect(0,0,900,500);tc.drawImage(ship.renderer.domElement,0,0,900,500);
        }
        const data=tc.getImageData(0,0,900,500).data;let pixels=0;for(let n=3;n<data.length;n+=4)if(data[n]>128)pixels++;
        c.fillStyle='#071017';c.fillRect(i%2*900,Math.floor(i/2)*500,900,500);c.drawImage(tile,i%2*900,Math.floor(i/2)*500);c.fillStyle='#dbc29a';c.font='16px Consolas';c.fillText(name,i%2*900+24,Math.floor(i/2)*500+32);return pixels;
      });
      const triangles=ship.renderer.info.render.triangles,previewImage=canvas.toDataURL('image/jpeg',.92);
      const point=rotor=>new AlpineThree.Vector3(0,.06,-.045).applyMatrix4(rotor.matrixWorld).project(ship.camera);
      const front={heading:180,pitch:0,time:0},position={x:0,y:-3,z:110.535,bank:0};
      ship.draw(c,750,500,position,front);
      const port=ship.model.getObjectByName('port-cap-lines'),starboard=ship.model.getObjectByName('starboard-cap-lines'),before=[point(port).x,point(starboard).x];
      ship.draw(c,750,500,position,{...front,time:.2});const after=[point(port).x,point(starboard).x],angles=[port.rotation.z,starboard.rotation.z];
      ship.draw(c,750,500,position,{...front,time:.2});const pausedAngles=[port.rotation.z,starboard.rotation.z];
      const capColor=ship.model.getObjectByName('port-engine-cap').material.color;
      const redLight=ship.model.getObjectByName('port-red-navigation-light'),greenLight=ship.model.getObjectByName('starboard-green-navigation-light');
      const navigationFrames=[0,.25,.75,5,5.25,5.75].map(time=>{ship.draw(c,750,500,position,{...front,time});return [redLight.material.color.getHex(),greenLight.material.color.getHex()];});
      const lightCenters=[redLight,greenLight].map(light=>{light.geometry.computeBoundingBox();const center=light.geometry.boundingBox.getCenter(new AlpineThree.Vector3()).add(light.position);return center.toArray();});
      const housing=ship.model.getObjectByName('upper-saucer-teardrop'),marker=ship.model.getObjectByName('top-yellow-service-panel');housing.geometry.computeBoundingBox();const hb=housing.geometry.boundingBox;
      const cowlingRatios=['port','starboard'].map(side=>{const hood=ship.model.getObjectByName(side+'-rear-exhaust-hood'),dome=ship.model.getObjectByName(side+'-engine-cap');hood.geometry.computeBoundingBox();dome.geometry.computeBoundingBox();const h=hood.geometry.boundingBox,frontTip=dome.position.z+dome.geometry.boundingBox.min.z;return (h.max.z-h.min.z)/(h.max.z-frontTip);});
      const proportions={width:(hb.max.x-hb.min.x)/1.36,length:(hb.max.z-hb.min.z)/1.36,yellowAft:(marker.position.z-housing.position.z)/1.36,cowlingRatios};
      return {counts,triangles,before,after,angles,pausedAngles,navigationFrames,lightCenters,proportions,redder:capColor.r>capColor.g*3,image:previewImage};
    });
    assert(result.triangles>15000,'ship is rendered from detailed 3D geometry');for(const count of result.counts)assert(count>5000,'ship visible from every reference view');assert.deepEqual(errors,[]);
    assert(result.redder,'engine caps use a stronger red');assert(result.after[0]>result.before[0]&&result.after[1]<result.before[1],'head-on, port lines rotate clockwise and starboard counterclockwise');assert.deepEqual(result.pausedAngles,result.angles,'rotor animation holds when simulation time is unchanged');
    const [on,onQuarter,off,onFive,onFiveQuarter,offFive]=result.navigationFrames;assert.deepEqual(on,onQuarter);assert.deepEqual(on,onFive);assert.deepEqual(on,onFiveQuarter);assert.deepEqual(off,offFive);assert(on.every((color,i)=>color!==off[i]),'both lights flash together every five seconds');
    const [port,starboard]=result.lightCenters;assert(Math.abs(port[0]+starboard[0])<1e-6&&Math.abs(port[1]-starboard[1])<1e-6&&Math.abs(port[2]+1.53)<1e-6&&Math.abs(starboard[2]+1.53)<1e-6,'navigation lights sit symmetrically at the saucer midpoint');
    const p=result.proportions;assert(Math.abs(p.width-129/636)<.015&&Math.abs(p.length-180/636)<.015,'teardrop proportions match the top reference');assert(Math.abs(p.yellowAft-59/636)<.005,'yellow panel sits at the reference distance behind the bridge');assert(p.cowlingRatios.every(ratio=>Math.abs(ratio-56/779)<.01),'rear cowling length matches the reference proportion');
    if(process.argv.includes('--save'))require('node:fs').writeFileSync(path.join(__dirname,'preview-refined-model.jpg'),Buffer.from(result.image.split(',')[1],'base64'));
    if(process.argv.includes('--image'))console.log(result.image);else console.log('Passed: detailed 3D ship renders from aft, front, top, starboard, underside and perspective views.');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
