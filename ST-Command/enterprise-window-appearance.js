/* Surface-conforming window relief and glass, shared by the lit/unlit batches. */
window.createEnterpriseWindowMaterial=(T,{lit,color,appearance})=>{
 const material=new T.MeshStandardMaterial({color,emissive:lit?color:0x000000,emissiveIntensity:lit?1.4:0,roughness:.72,metalness:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,depthWrite:false});
 material.userData.windowAppearance={revision:1,recessedFrame:true,glassReflections:true,softLighting:true};
 material.onBeforeCompile=shader=>{
  shader.uniforms.windowAppearanceStrength=appearance.strength;
  shader.uniforms.windowReflectionStrength=appearance.reflections;
  shader.uniforms.windowLit={value:lit?1:0};
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
   attribute vec2 windowProfile;
   varying vec2 vWindowProfile;
   varying vec2 vWindowUv;`);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vWindowProfile=windowProfile;vWindowUv=uv;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   uniform float windowAppearanceStrength;
   uniform float windowReflectionStrength;
   uniform float windowLit;
   varying vec2 vWindowProfile;
   varying vec2 vWindowUv;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec2 windowP=abs(vWindowUv-0.5)*vec2(vWindowProfile.y,1.0);
   vec2 windowQ=windowP-(0.5*vec2(vWindowProfile.y,1.0)-vec2(0.045));
   float windowRectEdge=0.045-length(max(windowQ,0.0))-min(max(windowQ.x,windowQ.y),0.0);
   float windowRoundEdge=0.5-length(vWindowUv-0.5);
   float windowEdge=mix(windowRectEdge,windowRoundEdge,vWindowProfile.x);
   // Resolve the frame only when the opening is large enough on screen.
   // Distant portholes retain their outline and a clear point of interior light.
   float windowPixelHeight=1.0/max(fwidth(vWindowUv.y),0.0001);
   float windowDetail=windowAppearanceStrength*smoothstep(3.0,12.0,windowPixelHeight);
   if(windowEdge<0.0&&windowDetail>0.5)discard;
   float windowGlass=smoothstep(0.070,0.105,windowEdge);
   float windowBevel=smoothstep(0.012,0.035,windowEdge)*(1.0-smoothstep(0.050,0.078,windowEdge));
   float windowEdgeLight=clamp(0.55+0.45*(vWindowUv.y-vWindowUv.x),0.15,1.0);
   vec3 windowFrame=mix(vec3(0.005,0.009,0.009),vec3(0.075,0.090,0.083),windowBevel*windowEdgeLight);
   vec3 windowPane=diffuseColor.rgb*mix(0.55,0.22,windowLit);
   vec3 windowFinish=mix(windowFrame,windowPane,windowGlass);
   diffuseColor.rgb=mix(diffuseColor.rgb,windowFinish,windowAppearanceStrength);
   // Suppress the subpixel frame without changing a window's outer dimensions.
   diffuseColor.rgb=mix(diffuseColor.rgb,windowPane,(1.0-windowDetail)*windowAppearanceStrength);
   vec2 windowSoftPosition=(vWindowUv-0.5)*vec2(1.1,1.6);
   float windowSoftLight=0.62+0.30*exp(-3.0*dot(windowSoftPosition,windowSoftPosition));
   windowSoftLight*=mix(0.78,1.0,smoothstep(0.085,0.20,windowEdge));
   float windowPaneMask=mix(1.0,windowGlass,windowDetail);
   float windowRelief=windowDetail*(0.6*windowBevel-0.4*windowGlass);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,mix(0.68,0.20,windowPaneMask),windowAppearanceStrength);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   // A thin bevel surrounding a shaded inner reveal gives depth without
   // cutting extra holes or adding raised boxes to the finished ship skin.
   vec3 windowQ0=dFdx(-vViewPosition),windowQ1=dFdy(-vViewPosition);
   vec3 windowR1=cross(windowQ1,normal),windowR2=cross(normal,windowQ0);
   float windowDet=dot(windowQ0,windowR1);
   normal=normalize(abs(windowDet)*normal-sign(windowDet)*(dFdx(windowRelief)*windowR1+dFdy(windowRelief)*windowR2)*0.00007);
   vec3 windowView=normalize(vViewPosition);
   float windowFresnel=0.04+0.22*pow(1.0-clamp(dot(normal,windowView),0.0,1.0),5.0);
   vec3 windowRay=inverseTransformDirection(reflect(-windowView,normal),viewMatrix);
   // A restrained cool environment wash and broad glint move with the view.
   vec3 windowSky=mix(vec3(0.006,0.012,0.021),vec3(0.10,0.15,0.20),smoothstep(-0.2,0.8,windowRay.y));
   float windowGlint=pow(max(0.0,dot(windowRay,normalize(vec3(-0.35,0.8,0.45)))),32.0);
   vec3 windowReflection=(windowSky*(0.20+windowFresnel)+vec3(0.30,0.34,0.37)*windowGlint*0.08)*windowPaneMask*windowAppearanceStrength*windowReflectionStrength;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   totalEmissiveRadiance*=mix(1.0,0.55*windowSoftLight*windowPaneMask,windowAppearanceStrength);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=windowReflection;
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'enterprise-window-recessed-glass-v1';
 return material;
};
