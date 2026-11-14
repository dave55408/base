/* Dim outside illumination at render time without changing onboard lighting. */
(()=>{
 const button=document.getElementById('night-mode-toggle'),attached=new WeakSet(),factor=.025;
 let enabled=false;try{enabled=localStorage.getItem('st-command-night-mode')==='true';}catch{}
 function sync(){button.setAttribute('aria-pressed',String(enabled));document.body.classList.toggle('night-mode',enabled);button.title=enabled?'Restore normal external lighting':'Dim external lighting; keep stars and onboard illumination';}
 function belongsTo(light,root){for(let node=light;node;node=node.parent)if(node===root)return true;return false;}
 function outsideLight(light,ship){
  if(light.isDirectionalLight||light.isHemisphereLight||light.isAmbientLight)return true;
  return !belongsTo(light,ship.model)&&!belongsTo(light,ship.excursionShuttle);
 }
 const api={
  get enabled(){return enabled;},
  set enabled(value){enabled=!!value;try{localStorage.setItem('st-command-night-mode',String(enabled));}catch{}sync();},
  attach(ship){
   if(!ship||attached.has(ship.renderer))return ship;
   const renderer=ship.renderer,render=renderer.render;attached.add(renderer);
   renderer.render=function(scene,...args){
    if(!enabled)return render.call(this,scene,...args);
    const lights=[],reflections=new Map();
    scene.traverseVisible(object=>{
     if(object.isLight&&outsideLight(object,ship)){lights.push([object,object.intensity]);object.intensity*=factor;}
     // These painted reflections represent outside illumination, not onboard lamps.
     for(const material of (Array.isArray(object.material)?object.material:[object.material])){
      if(material?.userData.externalReflection&&!reflections.has(material)){
       reflections.set(material,material.envMapIntensity);material.envMapIntensity*=factor;
      }
     }
    });
    try{return render.call(this,scene,...args);}
    finally{for(const [light,intensity]of lights)light.intensity=intensity;for(const [material,intensity]of reflections)material.envMapIntensity=intensity;}
   };
   return ship;
  }
 };
 button.addEventListener('click',()=>{api.enabled=!enabled;button.blur();});
 button.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter')event.stopPropagation();});
 window.NightMode=api;sync();
})();
