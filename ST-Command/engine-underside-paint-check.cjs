const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[__dirname,path.resolve(__dirname,'../elf-adventure')]}));const {createServer}=require('./server.cjs');
(async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});await page.goto('http://127.0.0.1:'+server.address().port);
const result=await page.evaluate(async()=>{const T=AlpineThree,checks=[],canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1500;const ctx=canvas.getContext('2d');
for(const [row,factory] of [createEnterpriseRenderer,createMovieEnterpriseRenderer,createThirdEnterpriseRenderer].entries()){
const ship=factory();await ship.ready;const scratch=document.createElement('canvas').getContext('2d');ship.draw(scratch,2,2,{x:0,y:-2,z:110.49},{heading:180,pitch:0,time:0});ship.model.updateWorldMatrix(true,true);
const tubes=['port','starboard'].map(side=>ship.model.getObjectByName(side+'-engine-outer-tube'));let painted=0,upper=0,lower=0,wrong=0;
for(const tube of tubes){const g=tube.geometry,p=g.attributes.position;for(const group of g.groups){for(let i=group.start;i<group.start+group.count;i+=3){let down=0;for(let k=0;k<3;k++)down+=p.getZ(g.index.getX(i+k));const paint=!!tube.material[group.materialIndex].userData.engineUndersidePaint;if(paint){painted++;if(down<0)wrong++;}else if(group.materialIndex===0){if(down>1e-8)lower++;else upper++;}}}}
const tube=tubes[1],center=tube.localToWorld(new T.Vector3(0,-.12,0));
for(let col=0;col<2;col++){const camera=new T.PerspectiveCamera(32,1.6,.001,10);camera.position.copy(center).add(new T.Vector3(col?-1.6:1.6,-.35,.10));camera.lookAt(center);camera.updateWorldMatrix(true,false);ship.renderer.setSize(800,500,false);ship.renderer.render(ship.scene,camera);ctx.drawImage(ship.renderer.domElement,col*800,row*500);}
checks.push({variant:ship.model.userData.variant||'original',painted,upper,lower,wrong,glError:ship.renderer.getContext().getError()});ship.dispose();}
return {checks,image:canvas.toDataURL('image/png')};});
for(const c of result.checks){assert.equal(c.painted,0);assert(c.upper>0&&c.lower>0);assert.equal(c.upper,c.lower);assert.equal(c.wrong,0);assert.equal(c.glError,0);}assert.deepEqual(errors,[]);const file=path.join(require('node:os').tmpdir(),'st-command-engine-undersides.png');fs.writeFileSync(file,Buffer.from(result.image.split(',')[1],'base64'));console.log(JSON.stringify(result.checks));console.log(file);
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
