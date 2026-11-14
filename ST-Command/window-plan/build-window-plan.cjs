/* Authored traces from the six supplied screenshots; no random windows. */
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,windows=[],groups=[];
const round=n=>Math.round(n*100000)/100000;
function group(id,label,surface,side,source,notes=''){const g={id,label,surface,side,source,notes};groups.push(g);return g;}
function add(g,position,{state='lit',shape='rect',width=.017,height=.006,normal=[g.side==='port'?-1:1,0,0],pixel=null,confidence='estimated',category='window',color=null}={}){
 const id=g.id+'-'+String(windows.filter(w=>w.group===g.id).length+1).padStart(2,'0');
 windows.push({id,group:g.id,surface:g.surface,side:g.side,position:position.map(round),normal:normal.map(round),width,height,shape,state,category,confidence,source:g.source,sourcePixel:pixel,color,notes:''});
}
function sideTrace(g,points,{fore,aft,centerY,scale=525,flip=false}){
 for(const [px,py,form='r',state='lit']of points){
  const u=flip?(fore-px)/(fore-aft):(px-fore)/(aft-fore),z=-1.12+u*1.12,y=(centerY-py)/scale;
  const radius=.151-.049*Math.max(0,Math.min(1,u)),x=(g.side==='port'?-1:1)*radius*Math.sqrt(Math.max(.05,1-(y/.15)**2));
  add(g,[x,y,z],{state,shape:form==='o'?'round':'rect',width:form==='o'?.005:.018,height:form==='o'?.005:.007,normal:[Math.sign(x)*.90,y/.15,u>.86?.65:.02],pixel:[px,py],confidence:'observed'});
 }
}
const starHull=group('SH','Engineering hull · starboard','engineering','starboard','image-1457','Observed states; positions reprojected from a perspective side view.');
sideTrace(starHull,[
 [1176,816,'o'],[1183,840,'o'],[1195,840,'o'],[1236,840,'o'],[1253,840],
 [1220,856],[1299,855],[1239,868,'o'],[1254,868],[1273,868],[1293,868],[1309,868],[1325,868,'r','unlit'],
 [1289,885],[1309,903],[1323,903,'r','unlit'],[1246,919,'o'],[1267,919],[1242,937],[1343,918,'o'],
 [1411,883,'r','unlit'],[1379,901,'r','unlit'],[1396,901,'r','unlit'],[1422,901,'r','unlit'],[1462,900,'r','unlit'],[1480,899,'r','unlit'],
 [1549,859,'o'],[1558,859,'o'],[1571,852,'o'],[1556,876,'o'],[1566,876],
 [1549,897,'o'],[1565,898,'o'],[1581,896,'r','unlit']
],{fore:1060,aft:1630,centerY:878});
const portHull=group('PH','Engineering hull · port','engineering','port','image-1459','Traced independently; the port and starboard patterns are not assumed identical.');
sideTrace(portHull,[
 [1013,847,'o'],[1026,852,'o'],[1036,852,'o'],[1016,866],[1026,867,'o'],[1013,886,'o'],[1027,887,'o'],
 [1100,889,'r','unlit'],[1115,889,'r','unlit'],[1151,891,'r','unlit'],[1174,891,'r','unlit'],[1188,891,'r','unlit'],[1158,874,'r','unlit'],
 [1253,860],[1271,859],[1287,860],[1304,859],[1240,860,'r','unlit'],[1262,847],[1304,833],[1319,835,'o'],[1335,848],[1359,834,'o'],[1371,833,'o'],[1375,811,'o'],
 [1252,876,'o'],[1270,876],[1240,891],[1253,892],[1291,907],[1312,906,'o'],[1313,924],[1222,906,'o'],[1329,861,'o']
],{fore:1485,aft:960,centerY:870,flip:true,scale:500});
function neckTrace(side,points,source){
 const g=group(side==='port'?'PN':'SN','Neck · '+side,'neck',side,source,'Dark upper apertures may be windows or service openings; review their classification.');
 const star=side==='starboard';
 for(const [px,py,form='r',state='lit']of points){
  const y=.11+(810-py)/100*.25,t=Math.max(0,Math.min(1,(y-.11)/.25)),front=-.87-.29*t,back=-.54-.28*t;
  const u=star?Math.max(0,Math.min(1,(px-(1015+(py-705)*1.05))/160)):Math.max(0,Math.min(1,((1450-(py-705)*1.10)-px)/160));
  add(g,[(star?1:-1)*.035,y,front+(back-front)*u],{state,shape:form==='o'?'round':'rect',width:form==='o'?.005:.016,height:form==='o'?.005:.007,pixel:[px,py],confidence:'observed'});
 }
}
neckTrace('starboard',[[1071,717,'r','unlit'],[1085,717,'r','unlit'],[1167,717,'r','unlit'],[1119,731,'o','unlit'],[1130,731,'o','unlit'],[1143,731,'o','unlit'],[1195,731],[1100,742],[1115,742],[1130,742],[1146,742],[1167,742],[1145,759,'o'],[1168,759],[1168,776],[1186,776,'r','unlit'],[1219,760],[1236,761,'o']],'image-1457');
neckTrace('port',[[1381,718,'r','unlit'],[1382,734,'r','unlit'],[1367,726,'o','unlit'],[1357,734],[1382,745],[1399,746],[1411,746],[1424,745],[1438,745],[1320,760,'o'],[1337,760],[1383,760],[1404,760,'o'],[1366,775,'r','unlit'],[1383,775]],'image-1459');
function polar(g,angle,y,{r=.68,zCenter=-1.53,...options}={}){const a=angle*Math.PI/180;add(g,[Math.sin(a)*r,y,zCenter-Math.cos(a)*r],{normal:[Math.sin(a),g.surface==='bowl'?-.7:.15,-Math.cos(a)],...options});}
for(const side of ['starboard','port']){
 const sign=side==='starboard'?1:-1,source=sign===1?'image-1457':'image-1459';
 const rim=group(sign===1?'SR':'PR','Saucer rim · aft flank · '+side,'rim',side,source,'Angular spacing is estimated; states and cluster order are visible.');
 [112,115,118,121].forEach(a=>polar(rim,sign*a,.382,{width:.018,height:.006,confidence:'observed'}));
 [[108,.378],[111,.363],[120,.365],[124,.373]].forEach(([a,y])=>polar(rim,sign*a,y,{shape:'round',width:.005,height:.005,confidence:'observed'}));
 const flank=group(sign===1?'SF':'PF','Saucer rim · forward flank · '+side,'rim',side,'image-1460','Visible in the front screenshot. Circumferential placement needs review against the side views.');
 [59,64,69,74].forEach(a=>polar(flank,sign*a,.379,{width:.015,height:.006}));
 polar(flank,sign*62,.360,{width:.014,height:.006});polar(flank,sign*77,.365,{shape:'round',width:.005,height:.005});
 const bridge=group(sign===1?'SB':'PB','Bridge deck · side row · '+side,'bridge',side,source,'Side-row angles are estimated; do not merge with the four front portholes until reviewed.');
 [104,116,128,140].forEach(a=>polar(bridge,sign*a,.492,{r:.177,width:.011,height:.0045}));
 const pylons=group(sign===1?'SP':'PP','Pylon dark apertures · '+side,'pylon',side,source,'These three dark slots may be vents rather than cabin windows. Kept separately for review.');
 [[-.31,.39],[-.30,.36],[-.25,.16]].forEach(([z,y])=>add(pylons,[sign*.27,y,z],{state:'unlit',width:.017,height:.006,category:'aperture'}));
}
const forward=group('FW','Three forward saucer portholes','rim','center','image-1460','Front-facing triple round windows, distinct from navigation beacons.');
[-4.5,0,4.5].forEach(a=>polar(forward,a,.357,{shape:'round',width:.012,height:.012,confidence:'observed'}));
const bridgeFront=group('BF','Bridge deck · four forward portholes','bridge','center','image-1460','Four visible points; the upper white dome is a light, not a cabin window.');
[-61,-8,8,61].forEach(a=>polar(bridgeFront,a,.494,{r:.177,shape:'round',width:.006,height:.006,confidence:'observed'}));
for(const [id,label,angle]of [['BU1','Lower saucer · forward bank',0],['BU2','Lower saucer · starboard bank',90],['BU3','Lower saucer · port bank',-90]]){
 const g=group(id,label,'bowl',angle===0?'center':angle>0?'starboard':'port','image-1461','Bank visible in underside screenshot; angular registration is estimated. The aft sector is obscured by the neck.');
 [-18,-9,0,9,18].forEach(a=>polar(g,angle+a,.287,{r:.20,width:.013,height:.005}));
}
const bowlDark=group('BU4','Lower saucer · dark pair','bowl','starboard','image-1461','Two dark openings beside the visible upper bank; exact angle is uncertain.');
[77,87].forEach(a=>polar(bowlDark,a,.307,{r:.255,width:.011,height:.004,state:'unlit'}));
// Beacons and landing lights are separate from the cabin-window inventory.
const nav=group('NAV','Navigation and landing lights','beacon','both','image-1458','Context only; not counted as cabin windows. Engine collectors and sensor domes are omitted.');
for(const side of [-1,1]){
 add(nav,[side*.56,.414,-1.53],{category:'navigation',shape:'round',width:.012,height:.012,color:side>0?'#4fbd80':'#dc665b',normal:[0,1,0],confidence:'observed'});
 windows.at(-1).side=side>0?'starboard':'port';
 add(nav,[side*.078,-.055,.002],{category:'navigation',width:.014,height:.006,normal:[0,0,1],color:'#f6cb7a',confidence:'observed'});
}
add(nav,[0,.121,.002],{category:'navigation',shape:'round',width:.014,height:.014,color:'#78b9a0',normal:[0,0,1],confidence:'observed'});
const layout={schemaVersion:1,title:'USS Enterprise · editable window plan',revision:'reference-draft-1',
 coordinateFrame:{units:'schematic model units; saucer diameter 1.36',x:'positive to starboard',y:'up',z:'positive aft; saucer center z = -1.53',registration:'Reference reconstruction, not a direct copy of any current renderer. Fit the surface adapter before applying to live geometry.'},
 sources:[1457,1458,1459,1460,1461,1462].map((n,i)=>({id:'image-'+n,file:'references/image-'+n+'.png',label:['Starboard side','Rear perspective','Port side','Front perspective','Underside','Top'][i]})),
 coverage:{basis:'The six supplied Roddenberry Archive screenshots, manually traced. Existing suppressed photo-window code was not used as the source.',stateMeaning:'Observed means the lit/unlit state is visible. All 3D positions remain estimates reconstructed from perspective screenshots.',unresolved:['Exact front-to-side registration of the forward rim clusters','Side bridge rows versus forward portholes','The obscured aft sector of the lower saucer','Whether the three dark pylon slots are windows or vents','Rear-face windows not resolved in the rear screenshot; do not invent extras'],nacelles:'No cabin windows are resolved on the nacelles; collectors, grilles, sensor domes and navigation lamps are not cabin windows.'},groups,windows};
const jsonPath=path.join(root,'window-layout.json'),useAuthored=process.argv.includes('--reset-source')||!fs.existsSync(jsonPath),published=useAuthored?layout:JSON.parse(fs.readFileSync(jsonPath,'utf8'));
if(useAuthored)fs.writeFileSync(jsonPath,JSON.stringify(layout,null,2));
fs.writeFileSync(path.join(root,'window-layout.js'),'/* Generated from window-layout.json. Edit in the browser or the JSON source. */\nwindow.WINDOW_PLAN_DATA='+JSON.stringify(published)+';\n');
const diagram=require('./window-plan-diagram.js');fs.writeFileSync(path.join(root,'enterprise-window-map.svg'),diagram.svg(published));
console.log(JSON.stringify({windows:published.windows.filter(w=>w.category==='window').length,unlit:published.windows.filter(w=>w.category==='window'&&w.state==='unlit').length,reviewApertures:published.windows.filter(w=>w.category==='aperture').length,groups:published.groups.length}));
