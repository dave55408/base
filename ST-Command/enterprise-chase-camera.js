/* Transparent aft-view ship overlay over the normal forward viewscreen. */
(() => {
 const button=document.getElementById('enterprise-chase'),controls=document.getElementById('bridge-camera-controls');
 let enabled=false;
 const grain=document.createElement('canvas');grain.width=grain.height=128;
 const grainContext=grain.getContext('2d'),pixels=grainContext.createImageData(128,128);let grainSeed=1701;
 for(let i=0;i<pixels.data.length;i+=4){grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;const value=32+(grainSeed>>>24)*.75;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}
 grainContext.putImageData(pixels,0,0);
 button.addEventListener('click',()=>{enabled=!enabled;button.textContent=enabled?'FORWARD VIEW':'CHASE CAMERA';button.setAttribute('aria-pressed',String(enabled));});
 function render(scene,w,h,state){
  if(!enabled){scene.enterpriseChaseImage?.setVisible(false);return false;}
  if(!scene.enterpriseChaseTexture){scene.enterpriseChaseTexture=scene.textures.createCanvas('enterprise-chase-view',w,h);scene.enterpriseChaseImage=scene.add.image(0,0,'enterprise-chase-view').setOrigin(0).setDepth(1).setAlpha(.4);}
  const texture=scene.enterpriseChaseTexture;if(texture.width!==w||texture.height!==h)texture.setSize(w,h);scene.enterpriseChaseImage.setVisible(true);
  const ship=EnterpriseModels.rendererFor(scene),T=AlpineThree;
  scene.enterpriseChaseCamera??=new T.PerspectiveCamera(45,w/h,.001,1000);const camera=scene.enterpriseChaseCamera;
  camera.aspect=w/h;camera.fov=w/h>1.3?28:45;camera.position.set(.20,.23,1.6);camera.up.set(0,1,0);camera.lookAt(0,.405,-1.478);camera.updateProjectionMatrix();camera.updateWorldMatrix(true,false);
  const ctx=texture.getContext();ctx.clearRect(0,0,w,h);
  // Updating the same selected renderer preserves lights, domes and hull details.
  const sink=scene.enterpriseChaseSink??=document.createElement('canvas').getContext('2d');
  ship.draw(sink,w,h,{x:.20,y:1.35,z:110.23,phase:'bridge',bank:0},{heading:0,pitch:0,time:state.time,bayDoorOpen:0});
  ship.renderer.render(ship.scene,camera);ctx.save();ctx.filter='contrast(1.3)';ctx.drawImage(ship.renderer.domElement,0,0,w,h);ctx.restore();
  ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle='rgba(98,160,235,.18)';ctx.fillRect(0,0,w,h);ctx.restore();
  // Clip the grain to the ship; simulation time holds it still while paused.
  scene.enterpriseChaseGrain??=ctx.createPattern(grain,'repeat');
  const frame=Math.floor(state.time*12),gx=frame*37%128,gy=frame*61%128;
  ctx.save();ctx.globalCompositeOperation='source-atop';ctx.globalAlpha=.12;ctx.fillStyle=scene.enterpriseChaseGrain;ctx.translate(-gx,-gy);ctx.fillRect(gx,gy,w,h);ctx.restore();
  texture.refresh();
  return true;
 }
 window.EnterpriseChaseCamera={get enabled(){return enabled;},sync(phase){controls.hidden=phase!=='bridge';},render};
})();
