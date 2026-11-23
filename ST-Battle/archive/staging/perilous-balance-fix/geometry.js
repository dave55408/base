/* Small geometry/particle helpers for ST Command's trimmed Three.js bundle. */
(()=>{
  const T=window.AlpineThree;
  T.LatheGeometry=class extends T.BufferGeometry{
    constructor(profile,segments=64){
      super();const p=[],uv=[],indices=[];
      for(const point of profile)for(let i=0;i<=segments;i++){
        const a=i/segments*Math.PI*2,x=Math.sin(a)*point.x,z=Math.cos(a)*point.x;
        p.push(x,point.y,z);uv.push(.5+x/1.38,.5-z/1.38);
      }
      for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
        const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);
      }
      this.setAttribute('position',new T.Float32BufferAttribute(p,3));this.setAttribute('uv',new T.Float32BufferAttribute(uv,2));this.setIndex(indices);this.computeVertexNormals();
    }
  };
  T.PointsMaterial=class extends T.ShaderMaterial{
    constructor(options={}){
      super({transparent:true,depthWrite:false,vertexColors:!!options.vertexColors,blending:options.blending??1,
        uniforms:{pointSize:{value:options.size??1},pointTint:{value:new T.Color(options.color??0xffffff)},pointOpacity:{value:options.opacity??1}},
        vertexShader:`uniform float pointSize;
          varying vec3 particleColor;
          void main(){
            particleColor=vec3(1.);
            #ifdef USE_COLOR
              particleColor=color;
            #endif
            vec4 mv=modelViewMatrix*vec4(position,1.);
            gl_PointSize=clamp(pointSize*500./max(1.,-mv.z),1.,90.);
            gl_Position=projectionMatrix*mv;
          }`,
        fragmentShader:`uniform vec3 pointTint;uniform float pointOpacity;varying vec3 particleColor;
          void main(){float r=length(gl_PointCoord-vec2(.5))*2.;if(r>1.)discard;gl_FragColor=vec4(pointTint*particleColor,pointOpacity*(1.-smoothstep(.08,1.,r)));}`
      });
      this.color=this.uniforms.pointTint.value;this.size=options.size??1;this.opacity=options.opacity??1;
    }
  };
  T.Points=class extends T.Object3D{
    constructor(geometry,material){super();this.isPoints=true;this.type='Points';this.geometry=geometry;this.material=material;}
    onBeforeRender(){const u=this.material.uniforms;u.pointOpacity.value=this.material.opacity;u.pointSize.value=this.material.size;}
  };
})();
