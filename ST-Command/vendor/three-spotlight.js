/* Three.js MIT spotlight extension; see THREE-LICENSE.txt.
   API: https://github.com/mrdoob/three.js/tree/r180/src/lights */
(()=>{
 const T=window.AlpineThree;
 class SpotLightShadow extends T.LightShadow{
  constructor(){super(new T.PerspectiveCamera(50,1,.5,500));this.isSpotLightShadow=true;this.focus=1;}
  updateMatrices(light){const c=this.camera,fov=360/Math.PI*light.angle*this.focus,aspect=this.mapSize.width/this.mapSize.height,far=light.distance||c.far;if(c.fov!==fov||c.aspect!==aspect||c.far!==far){c.fov=fov;c.aspect=aspect;c.far=far;c.updateProjectionMatrix();}super.updateMatrices(light);}
  copy(source){super.copy(source);this.focus=source.focus;return this;}
 }
 class SpotLight extends T.Light{
  constructor(color=0xffffff,intensity=1,distance=0,angle=Math.PI/3,penumbra=0,decay=2){super(color,intensity);this.isSpotLight=true;this.type='SpotLight';this.position.copy(T.Object3D.DEFAULT_UP);this.updateMatrix();this.target=new T.Object3D();this.distance=distance;this.angle=angle;this.penumbra=penumbra;this.decay=decay;this.map=null;this.shadow=new SpotLightShadow();}
  get power(){return this.intensity*Math.PI;}
  set power(value){this.intensity=value/Math.PI;}
  copy(source,recursive){super.copy(source,recursive);for(const key of ['distance','angle','penumbra','decay','map'])this[key]=source[key];this.target=source.target.clone();this.shadow=source.shadow.clone();return this;}
  dispose(){this.shadow.dispose();}
 }
 T.SpotLight=SpotLight;
})();
