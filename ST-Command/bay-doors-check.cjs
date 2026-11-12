const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));
const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.createEnterpriseRenderer);
  const result=await page.evaluate(async()=>{
    const ship=createEnterpriseRenderer();await ship.ready;
    const out=document.createElement('canvas');out.width=1800;out.height=700;const c=out.getContext('2d'),levels=[0,.5,1],brightness=[],covered=[];
    function blocksCenter(){
      const T=AlpineThree,doors=ship.model.getObjectByName('shuttle-bay-clamshell-doors'),origin=new T.Vector3(.04,.4,3),direction=new T.Vector3(0,0,-1);doors.updateWorldMatrix(true,true);
      for(const leaf of doors.children){const geometry=leaf.children[0].geometry,p=geometry.attributes.position,index=geometry.index;
        for(let i=0;i<index.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,index.getX(i)).applyMatrix4(leaf.matrix),b=new T.Vector3().fromBufferAttribute(p,index.getX(i+1)).applyMatrix4(leaf.matrix),d=new T.Vector3().fromBufferAttribute(p,index.getX(i+2)).applyMatrix4(leaf.matrix),e1=b.sub(a),e2=d.sub(a),h=direction.clone().cross(e2),det=e1.dot(h);if(Math.abs(det)<1e-10)continue;const s=origin.clone().sub(a),u=s.dot(h)/det;if(u<0||u>1)continue;const q=s.cross(e1),v=direction.dot(q)/det;if(v>=0&&u+v<=1&&e2.dot(q)/det>0)return true;}
      }return false;
    }
    for(let i=0;i<levels.length;i++){
      const tile=document.createElement('canvas');tile.width=600;tile.height=650;const tc=tile.getContext('2d');
      ship.draw(tc,600,650,{x:0,y:.28,z:110.023,bank:0},{heading:0,pitch:0,time:0,bayDoorOpen:levels[i]});
      const p=tc.getImageData(300,325,1,1).data;brightness.push((p[0]+p[1]+p[2])/3);covered.push(blocksCenter());
      c.fillStyle='#0a1218';c.fillRect(i*600,0,600,700);c.drawImage(tile,i*600,25);
      c.fillStyle='#e5d5b0';c.font='20px Arial';c.fillText(['CLOSED — CENTER SEAM','HALFWAY — FOLDING TO SIDES','OPEN — STACKED AT SIDES'][i],i*600+20,32);
    }
    const image=out.toDataURL('image/jpeg',.94);
    const doors=ship.model.getObjectByName('shuttle-bay-clamshell-doors');
    const leaves=doors.children.length;
    // Shuttle traffic must keep the opening clear; distant flight closes it.
    for(let i=0;i<30;i++)ship.draw(c,600,650,{phase:'flight',clock:10,x:0,y:10,z:110},{heading:0,pitch:0,time:i*.1});
    const far=doors.userData.open;
    for(let i=30;i<60;i++)ship.draw(c,600,650,{phase:'docking',clock:1,x:0,y:.4,z:110},{heading:0,pitch:0,time:i*.1});
    const docking=doors.userData.open;
    return {leaves,brightness,covered,far,docking,image};
  });
  assert.equal(result.leaves,6);assert(result.covered[0]&&!result.covered[2],'closed shell covers the center; open doors leave it clear');
  assert.equal(result.far,0,'doors close when traffic is distant');assert.equal(result.docking,1,'doors fully open for docking');assert.deepEqual(errors,[]);
  if(!process.argv.includes('--no-images'))fs.writeFileSync(path.join(__dirname,'preview-bay-doors.jpg'),Buffer.from(result.image.split(',')[1],'base64'));
  console.log(process.argv.includes('--image')?result.image:'Passed: clamshell center closure, clear open aperture, automatic closing and docking clearance.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

