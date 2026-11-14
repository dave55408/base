/* Shared vector renderer for the editor and exported SVG. */
((root,factory)=>{if(typeof module==='object'&&module.exports)module.exports=factory();else root.WindowPlanDiagram=factory();})(typeof window==='object'?window:globalThis,()=>{
 const views={front:{cx:400,base:510,scale:470,title:'01 / FRONT',subtitle:'Looking aft · starboard appears on the left'},rear:{cx:1200,base:510,scale:470,title:'02 / REAR',subtitle:'Looking forward · starboard appears on the right'},side:{cx:70,base:1080,scale:460,title:'03 / STARBOARD SIDE',subtitle:'Forward ←   ·   Port pattern is independently traced in the editor'}};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const colors={lit:'#f5c65e',unlit:'#243b4a',hull:'#e3e9ed',line:'#748894',detail:'#c5d1d8',review:'#ba7932'};
 function project(position,view){const v=views[view],[x,y,z]=position;return view==='side'?[v.cx+(z+2.25)*v.scale,v.base-y*v.scale]:[v.cx+(view==='front'?-x:x)*v.scale,v.base-y*v.scale];}
 function unproject(point,view,original){const v=views[view],p=original.slice();p[1]=(v.base-point[1])/v.scale;if(view==='side')p[2]=(point[0]-v.cx)/v.scale-2.25;else p[0]=(point[0]-v.cx)/v.scale*(view==='front'?-1:1);return p;}
 function path(points,view,close=true){return points.map((p,i)=>(i?'L':'M')+project(p,view).map(n=>n.toFixed(2)).join(' ')).join(' ')+(close?' Z':'');}
 function poly(points,view,extra=''){return `<path d="${path(points,view)}" ${extra}/>`;}
 function ellipse(position,rx,ry,view,extra=''){const [cx,cy]=project(position,view),s=views[view].scale;return `<ellipse cx="${cx}" cy="${cy}" rx="${rx*s}" ry="${ry*s}" ${extra}/>`;}
 function hull(view){
  let s='<g class="ship-hull" fill="'+colors.hull+'" stroke="'+colors.line+'" stroke-width="1.5" stroke-linejoin="round">';
  if(view==='side'){
   s+=poly([[0,.11,-.45],[0,.49,-.30],[0,.49,-.12],[0,.10,-.23]],view,'fill="'+colors.detail+'"');
   s+=poly([[0,.14,-1.12],[0,.151,-.94],[0,.147,-.75],[0,.125,-.36],[0,.107,0],[0,-.066,0],[0,-.136,-.36],[0,-.152,-.75],[0,-.153,-1.12]],view);
   s+=ellipse([0,0,-1.15],.024,.13,view,'fill="#c8c0ac"');
   s+=poly([[0,.11,-.87],[0,.36,-1.16],[0,.36,-.82],[0,.11,-.54]],view,'fill="#d3dde3"');
   s+=poly([[0,.34,-1.83],[0,.30,-1.75],[0,.255,-1.60],[0,.255,-1.46],[0,.30,-1.32],[0,.34,-1.24]],view);
   s+=poly([[0,.40,-2.21],[0,.35,-2.17],[0,.335,-1.80],[0,.335,-1.1],[0,.35,-.85],[0,.40,-.85],[0,.405,-1.14],[0,.43,-1.27],[0,.45,-1.48],[0,.45,-1.58],[0,.43,-1.79],[0,.405,-1.93]],view);
   s+=poly([[0,.45,-1.72],[0,.487,-1.70],[0,.511,-1.62],[0,.517,-1.46],[0,.492,-1.37],[0,.45,-1.34]],view);
   s+=ellipse([0,.528,-1.53],.06,.021,view,'fill="#d8e0e6"');
   s+=poly([[0,.60,-.82],[0,.603,-.74],[0,.601,.70],[0,.584,.79],[0,.55,.82],[0,.477,.80],[0,.43,.71],[0,.428,-.82]],view);
   s+=ellipse([0,.515,-.84],.044,.087,view,'fill="#d4c7b1"');
   s+=`<path d="${path([[0,.602,-.73],[0,.428,-.73]],view,false)}" fill="none"/><path d="${path([[0,.59,.66],[0,.445,.66]],view,false)}" fill="none"/>`;
  }else{
   for(const side of [-1,1])s+=poly([[side*.09,.10,0],[side*.41,.48,0],[side*.45,.46,0],[side*.12,.06,0]],view,'fill="'+colors.detail+'"');
   s+=poly([[-.033,.11,-.9],[-.034,.39,-.9],[.034,.39,-.9],[.033,.11,-.9]],view);
   s+=ellipse([0,0,0],view==='front'?.15:.107,view==='front'?.151:.11,view);
   if(view==='front')s+=ellipse([0,0,-1.17],.118,.118,view,'fill="#d2c6ac"')+ellipse([0,0,-1.18],.09,.09,view,'fill="#b2a58c"');
   else{s+=ellipse([0,-.023,.001],.09,.062,view,'fill="#bac8d1"');s+=poly([[-.09,-.04,0],[.09,-.04,0],[.09,-.065,0],[-.09,-.065,0]],view,'fill="#aabac4"');}
   s+=poly([[-.29,.34,0],[-.22,.30,0],[-.125,.26,0],[.125,.26,0],[.22,.30,0],[.29,.34,0]],view);
   s+=poly([[-.68,.40,0],[-.65,.35,0],[-.3,.335,0],[.3,.335,0],[.65,.35,0],[.68,.40,0],[.42,.411,0],[.22,.448,0],[-.22,.448,0],[-.42,.411,0]],view);
   for(const side of [-1,1])s+=ellipse([side*.439,.515,0],.087,.087,view,'fill="'+(view==='front'?'#d9c7ab':'#c6d2d9')+'"');
   s+=poly([[-.19,.45,0],[-.17,.49,0],[-.11,.515,0],[.11,.515,0],[.17,.49,0],[.19,.45,0]],view);
   s+=ellipse([0,.533,0],.062,.022,view,'fill="#d8e0e6"');
  }
  return s+'</g>';
 }
 function facing(w,view){if(w.category==='navigation'&&w.shape==='round')return true;const [x,,z]=w.normal,n=Math.hypot(...w.normal)||1;return (view==='front'?-z:view==='rear'?z:w.side==='port'?-x:x)/n>.12;}
 function mark(w,view,selected=false){
  const [cx,cy]=project(w.position,view),scale=views[view].scale,horizontal=Math.hypot(w.normal[0],w.normal[2]),foreshorten=horizontal?Math.abs(view==='side'?w.normal[0]:w.normal[2])/horizontal:1,width=Math.max(w.width*scale*foreshorten,w.shape==='round'?3:3.5),height=Math.max(w.height*scale,3),fill=w.color||colors[w.state];
  const review=w.confidence!=='observed'||w.category==='aperture';
  const data=`id="${view}-${esc(w.id)}" inkscape:label="${esc(w.id+' '+w.state)}" class="window-mark${selected?' selected':''}" data-id="${esc(w.id)}" data-view="${view}" tabindex="0" role="button" aria-label="${esc(w.id+' · '+w.state+' · '+w.surface)}"`;
  const shape=w.shape==='round'?`<ellipse cx="${cx}" cy="${cy}" rx="${width/2}" ry="${height/2}"/>`:`<rect x="${cx-width/2}" y="${cy-height/2}" width="${width}" height="${height}" rx=".65"/>`;
  return `<g ${data} fill="${esc(fill)}" stroke="${selected?'#087b9c':review?colors.review:'#927442'}" stroke-width="${selected?2.5:.65}" ${review?'stroke-dasharray="2 1"':''}><title>${esc(w.id+' · '+w.state+' · '+w.surface+(review?' · placement/classification to review':''))}</title><rect class="hit-area" x="${cx-Math.max(7,width/2+3)}" y="${cy-Math.max(6,height/2+3)}" width="${Math.max(14,width+6)}" height="${Math.max(12,height+6)}" fill="transparent" stroke="none"/>${shape}</g>`;
 }
 function svg(data,{selected=null,showNavigation=false,side='starboard',showLabels=true}={}){
  const cabin=data.windows.filter(w=>w.category==='window'),lit=cabin.filter(w=>w.state==='lit').length,unlit=cabin.length-lit;
  let s=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 1600 1240" width="1600" height="1240" role="img" aria-labelledby="window-map-title window-map-desc"><title id="window-map-title">Enterprise window layout — front, rear and ${side} orthographic views</title><desc id="window-map-desc">Editable reference reconstruction from six supplied screenshots. Gold marks are lit windows; dark marks are unlit. Dashed outlines need review. Repeated views show the same window IDs.</desc><style>text{font-family:Arial,sans-serif;fill:#233d4b}.minor{fill:#607782;font-size:14px}.caption{font-size:17px;font-weight:600;letter-spacing:1px}.window-mark{cursor:crosshair}.selected{filter:drop-shadow(0 0 3px #109abd)}.ship-hull{pointer-events:none}.guide{stroke:#d0dce3;stroke-width:1;stroke-dasharray:5 6}</style><rect width="1600" height="1240" fill="#f8fafb"/><text x="60" y="58" font-size="29" font-weight="600">U.S.S. ENTERPRISE</text><text x="60" y="89" class="minor">WINDOW PLACEMENT / EDITABLE REFERENCE DRAFT</text><g transform="translate(950 40)"><rect width="15" height="9" y="0" fill="${colors.lit}" stroke="#927442"/><text x="25" y="10" font-size="15">Lit (${lit})</text><rect x="145" width="15" height="9" fill="${colors.unlit}"/><text x="170" y="10" font-size="15">Unlit (${unlit})</text><rect x="310" width="15" height="9" fill="none" stroke="${colors.review}" stroke-dasharray="3 2"/><text x="335" y="10" font-size="15">Review placement</text></g><text x="950" y="89" class="minor">Unique cabin windows; navigation lamps and review apertures excluded.</text><path d="M60 115 H1540 M60 625 H1540" stroke="#cfdae1" fill="none"/>`;
  for(const [view,v]of Object.entries(views)){
   const isSide=view==='side',title=isSide?'03 / '+side.toUpperCase()+' SIDE':v.title;
   s+=`<g id="view-${view}" data-view="${view}" inkscape:groupmode="layer" inkscape:label="${esc(title)}"><rect class="view-hit" data-view="${view}" x="${view==='rear'?820:40}" y="${isSide?650:135}" width="${isSide?1520:740}" height="${isSide?490:455}" fill="transparent"/><text x="${view==='rear'?850:60}" y="${isSide?681:151}" class="caption">${title}</text><text x="${view==='rear'?850:60}" y="${isSide?708:178}" class="minor">${esc(v.subtitle)}</text>`;
   if(!isSide)s+=`<line class="guide" x1="${v.cx}" y1="195" x2="${v.cx}" y2="590"/>`;
   s+=hull(view);
   s+=`<g id="${view}-windows" inkscape:groupmode="layer" inkscape:label="Cabin windows">`;
   for(const w of data.windows){
    if(w.category==='navigation'&&!showNavigation)continue;
    const candidate=isSide?({...w,side,position:[side==='port'?-Math.abs(w.position[0]):Math.abs(w.position[0]),w.position[1],w.position[2]]}):w;
    if(isSide&&w.side!==side&&w.side!=='center'&&w.side!=='both')continue;
    if(!facing(candidate,view))continue;
    s+=mark(w,view,w.id===selected);
   }
   s+='</g>';
   if(showLabels){
    if(view==='front')s+='<text x="60" y="565" class="minor">FW · three fore-rim portholes</text><text x="60" y="587" class="minor">BF · four forward bridge-deck portholes</text>';
    if(view==='rear')s+='<text x="850" y="565" class="minor">Aft-rim groups and rounded stern-side windows</text><text x="850" y="587" class="minor">Landing lamps are a separate optional layer.</text>';
    if(isSide){s+='<text x="90" y="1130" class="minor">Primary hull / rim + lower bowl</text><text x="420" y="1008" class="minor">Neck</text><path d="M465 1002 L520 1002 L690 965" fill="none" stroke="#99acb7"/><text x="1210" y="1115" class="minor">Engineering hull</text><path d="M1200 1110 L1114 1090" fill="none" stroke="#99acb7"/><text x="1090" y="784" class="minor">Nacelles: no cabin windows resolved</text>';}
   }
   s+='</g>';
  }
  s+='<path d="M60 1160 H1540" stroke="#cfdae1" fill="none"/><text x="60" y="1190" class="minor">Window states are traced from the supplied images; positions are estimated from perspective views. Hidden sectors remain unresolved.</text><text x="60" y="1214" class="minor">Every mark has a stable ID and editable 3D position. Registration to the simulation’s curved hull is a separate implementation step.</text></svg>';
  return s;
 }
 return {svg,project,unproject,views,esc};
});
