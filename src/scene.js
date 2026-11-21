import {refineBistro} from './bistro.js';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makeDaylight } from './daylight.js';
import { loadInteriorSurfaces } from './surfaces.js';
import { refineUpholstery } from './upholstery.js';
import { refineBedroomsAndPlants, hangRivieraPrint } from './interior.js';
import { installPackedAssets } from './assets.js';
installPackedAssets(THREE.DefaultLoadingManager);
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { createEnvironment } from './environment.js';
import { NAN_SCRUB, FINISH } from './shaders/post.js';
import { staticBatch } from './batching.js';
import { createQualityGovernor } from './quality.js';

const canvas=document.getElementById('scene');
const params=new URLSearchParams(location.search);
const CAPTURE=params.has('capture');
if(params.has('promo'))document.body.classList.add('clean');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:CAPTURE||params.has('debug')});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.AgXToneMapping;
renderer.toneMappingExposure=.82;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
renderer.info.autoReset=false;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb9d8df);
scene.fog=new THREE.Fog(0xa9cdd2,320,3200);
const camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.045,4000);
camera.rotation.order='YXZ';
const environment=createEnvironment(scene);

const daylight=makeDaylight(scene,renderer,environment);
RectAreaLightUniformsLib.init();
const windowLights=[];
function area(x,y,z,tx,ty,tz,w,h,intensity){
  const light=new THREE.RectAreaLight(0xe9f7f4,intensity*.78,w,h);light.position.set(x,y,z);light.lookAt(tx,ty,tz);scene.add(light);windowLights.push(light);return light;
}
for(const x of [-7,2.7,9.5])area(x,47.0,.35,x,46.1,-5,7.2,2.9,2.15);
for(const x of [-8.5,-1.5,4.5,10])area(x,47.0,-11.65,x,46.1,-8,5.2,2.9,1.75);
area(-12.1,46.9,-3,-7,46.0,-3,5,2.8,1.55);

const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:Math.min(4,renderer.capabilities.maxSamples)});
const composer=new EffectComposer(renderer,rt);
composer.addPass(new RenderPass(scene,camera));
// The AO pass draws a replacement depth material. Glass panes and the far
// water horizon would otherwise leave opaque silhouettes in a transparent view.
const aoExcluded=[environment.group];
class InteriorOcclusionPass extends GTAOPass {
  render(...args) {
    const visible=aoExcluded.filter(o=>o.visible);
    for(const object of visible)object.visible=false;
    try { super.render(...args); }
    finally { for(const object of visible)object.visible=true; }
  }
}
const gtao=new InteriorOcclusionPass(scene,camera,innerWidth,innerHeight);
gtao.updateGtaoMaterial({radius:.38,distanceExponent:1.25,thickness:1.15,distanceFallOff:.75,scale:1.18,samples:24});
gtao.updatePdMaterial({lumaPhi:8,depthPhi:2.5,normalPhi:3,radius:5});
gtao.blendIntensity=.67;composer.addPass(gtao);
composer.addPass(new ShaderPass(NAN_SCRUB));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),.09,.16,1.45);composer.addPass(bloom);
composer.addPass(new OutputPass());
// Native-resolution FXAA keeps capture edges clean without multisampling every
// post-processing target, which is especially costly in software WebGL.
const fxaa=new ShaderPass(FXAAShader);if(CAPTURE)composer.addPass(fxaa);
const finish=new ShaderPass(FINISH);finish.uniforms.uGrain.value=CAPTURE?0:.002;finish.uniforms.uVignette.value=.055;finish.uniforms.uAberration.value=0;finish.uniforms.uFade.value=0;composer.addPass(finish);

const orbit=new OrbitControls(camera,canvas);orbit.enabled=false;orbit.enableDamping=true;orbit.dampingFactor=.065;
orbit.minDistance=10;orbit.maxDistance=300;orbit.maxPolarAngle=Math.PI*.47;orbit.minPolarAngle=.20;orbit.target.set(0,45,-4);orbit.addEventListener('change',()=>requestDraw());

const rooms=[
  {id:'living',name:'海景客厅',short:'客厅',area:'84㎡',desc:'开阔会客空间 · 弧形沙发与海景咖啡露台相连',pos:[-11.58,46.56,-.76],target:[-5.22,45.99,-3.70],fov:55,bounds:[0,0,12,7]},
  {id:'wine',name:'酒廊与餐厅',short:'酒廊餐厅',area:'49㎡',desc:'八人餐桌 · 独立藏酒墙与双人品酒 lounge',pos:[.1,46.64,-5.5],target:[3.2,46.2,-1.4],bounds:[12,0,7,7]},
  {id:'kitchen',name:'开放厨房',short:'厨房',area:'42㎡',desc:'3.8 米石材中岛 · 全套嵌入式厨电与海景早餐位',pos:[7.25,46.64,-5.45],target:[9.6,46.25,-2.5],bounds:[19,0,6,7]},
  {id:'master',name:'主卧套房',short:'主卧',area:'40㎡',desc:'睡眠区与私密起居 · 独立更衣 · 双人盥洗及步入式淋浴',pos:[-5.35,46.62,-7.75],target:[-7.95,46.25,-10.15],bounds:[0,7,8,5]},
  {id:'bedroom2',name:'次卧室',short:'次卧',area:'30㎡',desc:'安静私密的套房 · 低饱和陶土色点缀',pos:[-.05,46.62,-7.85],target:[-2.0,46.25,-10.15],bounds:[8,7,6,5]},
  {id:'billiards',name:'台球室',short:'台球室',area:'30㎡',desc:'标准尺寸球台 · 四周保留完整运杆距离',pos:[4.55,46.68,-7.75],target:[4.5,45.95,-9.45],bounds:[14,7,6,5]},
  {id:'gaming',name:'电竞房',short:'电竞房',area:'25㎡',desc:'双工位设备 · 明亮空间中的石墨色与克制 RGB',pos:[10.0,46.64,-7.65],target:[10.0,46.20,-10.6],bounds:[20,7,5,5]},
  {id:'terrace',name:'海景咖啡露台',short:'咖啡露台',area:'82.5㎡',desc:'四人咖啡座与日光躺椅 · 无遮挡望向蔚蓝海岸',pos:[-9.30,46.60,.70],target:[-.5,46.05,25],fov:55,bounds:[0,-3.3,25,3.3]},
];
const overview={id:'overview',name:'17 层外观',short:'楼体外观',desc:'300㎡ 室内面积 · 20 层建筑第 17 层 · 3.4 米层高'};
let currentRoom=rooms[0],mode='panorama',golden=0,model=null,ready=false;
let yaw=0,pitch=0,dragging=false,lastX=0,lastY=0,paused=true,simT=0,toastTimer=0,dirty=true,cameraTween=null;
const clock=new THREE.Clock();


function requestDraw(){dirty=true;}
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800);}
function setProgress(value,text){document.getElementById('loading-bar').style.width=`${Math.min(100,value)}%`;document.getElementById('loading-value').textContent=text;}
function syncAngles(){const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');yaw=e.y;pitch=e.x;}
function applyLook(){camera.rotation.set(pitch,yaw,0,'YXZ');}
function updatePlace(){
  const item=mode==='overview'?overview:currentRoom;
  document.getElementById('place-name').textContent=item.name;
  document.getElementById('place-description').textContent=item.desc;
  document.getElementById('place-index').textContent=mode==='overview'?'01 / 09':`${String(rooms.indexOf(currentRoom)+2).padStart(2,'0')} / 09`;
  document.querySelectorAll('#room-nav button').forEach(b=>b.classList.toggle('active',b.dataset.room===(mode==='overview'?'overview':currentRoom.id)));
  document.querySelectorAll('#plan-map rect').forEach(r=>r.setAttribute('fill',r.dataset.room===currentRoom.id&&mode!=='overview'?'#4c8b9b':'#e8e5dc'));
}
const overviewOffset=new THREE.Vector3(28,12,38);
const doorX={master:-5.3,bedroom2:.75,billiards:6.85,gaming:8.55};
const privateRooms=new Set(Object.keys(doorX));
function overviewPose(){
  const target=new THREE.Vector3(0,45.05,-4.55);
  const fit=Math.max(1,1.55/camera.aspect);
  return{target,position:target.clone().addScaledVector(overviewOffset,fit)};
}
function positionOverview(){
  // Flush residual orbit damping before writing the destination, not after it.
  orbit.enableDamping=false;orbit.update();
  const pose=overviewPose();orbit.target.copy(pose.target);camera.position.copy(pose.position);
  camera.lookAt(orbit.target);orbit.update();orbit.enableDamping=true;syncAngles();
}
function quaternionLookingAt(position,target){
  const matrix=new THREE.Matrix4().lookAt(position,target,new THREE.Vector3(0,1,0));
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}
function syncModeButtons(){
  document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function applyRoomPose(room){
  camera.position.fromArray(room.pos);camera.fov=room.fov??54;camera.updateProjectionMatrix();
  camera.lookAt(new THREE.Vector3(...room.target));syncAngles();
}
function completeTween(){
  const tween=cameraTween;if(!tween)return;cameraTween=null;finish.uniforms.uFade.value=0;
  mode=tween.mode;
  if(mode==='overview'){
    camera.fov=48;camera.updateProjectionMatrix();positionOverview();orbit.enabled=true;
  }else{
    currentRoom=tween.room;applyRoomPose(currentRoom);orbit.enabled=false;
  }
  environment.group.getObjectByName('Residential_tower_below').visible=true;
  document.body.classList.toggle('overview',mode==='overview');syncModeButtons();updatePlace();requestDraw();
}
function roomRoute(room,fromMode,fromRoom){
  const points=[camera.position.clone()],destination=new THREE.Vector3(...room.pos),h=46.64;
  const add=(x,y,z)=>points.push(new THREE.Vector3(x,y,z));
  if(fromMode==='overview'){
    add(-5.3,50.6,5.0);add(-5.3,h,5.0);add(-5.3,h,1.10);
    if(room.id!=='terrace')add(-5.3,h,-1.0);
  }else{
    if(privateRooms.has(fromRoom.id)){
      const x=doorX[fromRoom.id];add(x,h,-7.70);add(x,h,-6.05);
    }else if(fromRoom.id==='terrace'&&room.id!=='terrace')add(-5.3,h,-1.0);
  }
  if(privateRooms.has(room.id)){
    const x=doorX[room.id];add(x,h,-5.95);add(x,h,-6.95);add(x,h,-7.70);
  }else if(room.id==='terrace'&&fromMode!=='overview'&&fromRoom.id!=='terrace'){
    add(-5.3,h,-1.0);add(-5.3,h,1.10);
  }else if(room.id!=='terrace'&&fromMode!=='overview'&&fromRoom.id!==room.id){
    add((camera.position.x+destination.x)*.5,h+.10,-5.65);
  }
  points.push(destination);return points;
}
function overviewRoute(fromRoom){
  const points=[camera.position.clone()],h=46.64,add=(x,y,z)=>points.push(new THREE.Vector3(x,y,z));
  if(privateRooms.has(fromRoom.id)){
    const x=doorX[fromRoom.id];add(x,h,-7.70);add(x,h,-6.05);add(-5.3,h,-1.0);
  }else if(fromRoom.id!=='terrace')add(-5.3,h,-1.0);
  add(-5.3,h,1.10);add(-5.3,h,5.0);add(-5.3,50.6,5.0);points.push(overviewPose().position);return points;
}
function beginTween(next,room,fromMode,fromRoom){
  const destination=next==='overview'?overviewPose():{position:new THREE.Vector3(...room.pos),target:new THREE.Vector3(...room.target)};
  const points=next==='overview'?overviewRoute(fromRoom):roomRoute(room,fromMode,fromRoom);
  const distance=points.reduce((sum,p,i)=>i?sum+p.distanceTo(points[i-1]):0,0);
  cameraTween={
    mode:next,room,startedAt:performance.now(),duration:next==='overview'?Math.min(3.8,2.1+distance*.016):Math.min(3.5,1.35+distance*.018),
    curve:new THREE.CatmullRomCurve3(points,false,'centripetal',.22),
    startQuaternion:camera.quaternion.clone(),endQuaternion:quaternionLookingAt(destination.position,destination.target),
    startFov:camera.fov,endFov:next==='overview'?48:(room.fov??54),
  };
  orbit.enabled=false;
}
function setMode(next,instant=true){
  if(next==='panorama'){setRoom(currentRoom,instant);return;}
  if(cameraTween)completeTween();
  const fromMode=mode,fromRoom=currentRoom;mode='overview';
  document.body.classList.add('overview');syncModeButtons();updatePlace();
  if(instant||reduced){
    cameraTween={mode:'overview'};completeTween();
  }else beginTween('overview',currentRoom,fromMode,fromRoom);
  requestDraw();
}
function setRoom(room,instant=true){
  if(cameraTween)completeTween();
  const fromMode=mode,fromRoom=currentRoom;
  currentRoom=room;mode='panorama';document.body.classList.remove('overview');orbit.enabled=false;
  environment.group.getObjectByName('Residential_tower_below').visible=true;syncModeButtons();updatePlace();
  if(instant||reduced){
    cameraTween=null;finish.uniforms.uFade.value=0;applyRoomPose(room);
  }else beginTween('panorama',room,fromMode,fromRoom);
  requestDraw();
}

// The plan uses the same metric layout as the Blender model; every region is a live preset.
function buildUI(){
  const nav=document.getElementById('room-nav');
  const all=[overview,...rooms];
  for(const room of all){
    const b=document.createElement('button');b.type='button';b.textContent=room.short;b.dataset.room=room.id;
    b.addEventListener('click',()=>room.id==='overview'?setMode('overview'):setRoom(room,false));nav.appendChild(b);
  }
  const shapes=rooms.map(r=>{
    const [x,y,w,h]=r.bounds;const sx=x*9,sy=(12-y-h)*9+8;
    return `<g><rect data-room="${r.id}" x="${sx}" y="${sy}" width="${w*9}" height="${h*9}" rx="2" fill="#e8e5dc"/><text x="${sx+w*4.5}" y="${sy+h*4.5+2}" text-anchor="middle">${r.short}</text></g>`;
  }).join('');
  document.getElementById('plan-map').innerHTML=`<svg viewBox="-4 0 235 152" role="img" aria-label="300 平方米公寓平面图">${shapes}<text x="112.5" y="145" text-anchor="middle">SEA / 蔚蓝海岸</text></svg>`;
  document.querySelectorAll('#plan-map rect').forEach(r=>r.addEventListener('click',()=>{const room=rooms.find(x=>x.id===r.dataset.room);if(room)setRoom(room,false);}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode,false)));
}
function togglePlan(force){const panel=document.getElementById('plan-panel');const show=force??panel.hidden;panel.hidden=!show;document.getElementById('plan-toggle').setAttribute('aria-expanded',String(show));}
function setLight(){
  golden=golden?0:1;

  
  daylight.update(golden);
  
  renderer.shadowMap.needsUpdate=true;
  document.getElementById('light-toggle').textContent=golden?'夕照':'日光';
  document.getElementById('light-toggle').setAttribute('aria-label',golden?'切换至明亮日光':'切换至金色夕阳');requestDraw();toast(golden?'金色夕照 · 海面与室内光线已切换':'明亮日光 · 海面与室内光线已切换');
}
function captureView(){
  composer.render();canvas.toBlob(blob=>{if(!blob){toast('当前浏览器无法保存画面');return;}const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=`AZUR-300-${mode==='overview'?'overview':currentRoom.id}.png`;a.hidden=true;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('当前视角已保存为 PNG');},'image/png');
}
async function action(name){
  if(name==='overview')setMode('overview',false);
  if(name==='light')setLight();
  if(name==='capture')captureView();
  if(name==='plan')togglePlan();
  if(name==='plan-close')togglePlan(false);
  if(name==='fullscreen'){
    try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('此浏览器暂不支持全屏');}
  }
}
buildUI();

canvas.addEventListener('pointerdown',e=>{if(mode!=='panorama'||cameraTween)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging||mode!=='panorama'||cameraTween)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.0032;pitch=THREE.MathUtils.clamp(pitch-dy*.0030,-1.30,1.30);applyLook();requestDraw();});
canvas.addEventListener('pointerup',e=>{dragging=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('wheel',e=>{if(mode!=='panorama'||cameraTween)return;e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.025,44,86);camera.updateProjectionMatrix();requestDraw();},{passive:false});
addEventListener('keydown',e=>{
  if(e.key==='Escape')togglePlan(false);
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
    const dir=e.key==='ArrowRight'?1:-1;const i=(rooms.indexOf(currentRoom)+dir+rooms.length)%rooms.length;setRoom(rooms[i],false);
  }
  if(e.key.toLowerCase()==='h')document.body.classList.toggle('clean');
});
document.addEventListener('fullscreenchange',()=>{const b=document.querySelector('[data-action="fullscreen"]');b.textContent=document.fullscreenElement?'退出全屏':'全屏';b.setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');});

const governor=createQualityGovernor({initial:2,locked:true,onChange:q=>applyQuality(q)});
function sizeAO(){
  const ratio=renderer.getPixelRatio(),scale=governor?.settings.name==='High'?1:.75;
  gtao.setSize(Math.max(1,Math.floor(innerWidth*ratio*scale)),Math.max(1,Math.floor(innerHeight*ratio*scale)));
}
function applyQuality(q){
  const ratio=CAPTURE?1:Math.min(devicePixelRatio,q.pixelRatio,2);renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);
  renderer.shadowMap.enabled=q.shadows;bloom.enabled=q.bloom;gtao.enabled=q.name!=='Eco';
  renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);sizeAO();
  fxaa.material.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));requestDraw();
}
applyQuality(governor.settings);

function updateCameraTween(){
  const tween=cameraTween;if(!tween)return;
  const elapsed=(performance.now()-tween.startedAt)/1000,r=Math.min(1,elapsed/tween.duration),e=r*r*r*(r*(r*6-15)+10);
  camera.position.copy(tween.curve.getPoint(e));
  camera.quaternion.slerpQuaternions(tween.startQuaternion,tween.endQuaternion,e);
  camera.fov=THREE.MathUtils.lerp(tween.startFov,tween.endFov,e);camera.updateProjectionMatrix();
  finish.uniforms.uFade.value=0;dirty=true;
  if(r>=1)completeTween();
}
function renderSample(t){environment.update(t);finish.uniforms.uTime.value=t;if(mode==='overview'&&!cameraTween)orbit.update();renderer.info.reset();composer.render();dirty=false;}
function frame(){const dt=Math.min(clock.getDelta(),.05);updateCameraTween(dt);if(!paused){simT+=dt;dirty=true;}if(dirty){renderSample(simT);if(!paused||cameraTween||dragging)governor.sample(dt*1000);}}

async function init(){
  try{
    setProgress(8,'正在读取整层模型');
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const surfacesReady=loadInteriorSurfaces(renderer);
    const gltf=await loader.loadAsync('./models/azur-300-v002.glb',event=>{
      const p=event.total?event.loaded/event.total:Math.min(.85,event.loaded/1100000);setProgress(10+p*58,'正在布置家具与落地窗');
    });
    model=gltf.scene;model.name='AZUR_300_residence';model.position.y=45;scene.add(model);
    model.updateMatrixWorld(true);
    refineUpholstery(model);
    refineBistro(model);
    refineBedroomsAndPlants(model);
    await hangRivieraPrint(model);
    const patchSurface=await surfacesReady;
    const batchInfo=staticBatch(model,{animatedNodes:[],cellSize:7});
    model.traverse(o=>{
      if(!o.isMesh)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      const transparent=materials.some(m=>m.transparent||m.transmission>0);
      if(transparent)aoExcluded.push(o);
      o.castShadow=!transparent;o.receiveShadow=!transparent;
      o.frustumCulled=true;
      for(const m of materials){
        if(!m)continue;m.envMapIntensity=m.metalness>.5?.58:.25;patchSurface(m);
        if(m.transparent){m.depthWrite=false;m.side=THREE.FrontSide;}
        if(m.name==='Glass'){m.opacity=.032;m.color.set(0xe1e8e6);m.roughness=.035;m.metalness=0;}
        if(m.name==='GlassBalustrade'){m.opacity=.062;m.color.set(0xd3e1dd);m.roughness=.04;m.metalness=0;}
        if(m.name==='Screen'||m.name==='ScreenViolet')m.emissiveIntensity=.85;
        if(m.name==='CoveLight')m.emissiveIntensity=.80;
      }

    });

    await daylight.ready;
    daylight.capture();
    setProgress(76,'正在校准日光与海岸反射');
    const requested=params.get('room');
    const initial=rooms.find(r=>r.id===requested)||rooms[0];currentRoom=initial;
    if(params.has('golden'))setLight();
    if(params.get('mode')==='overview')setMode('overview');else setRoom(initial);
    await renderer.compileAsync(scene,camera);
    setProgress(94,'正在呈现第一帧');
    renderSample(0);
    ready=true;window.__SCENE_READY__=true;
    setProgress(100,'欢迎来到蔚蓝海岸');
    document.getElementById('loading').classList.add('done');setTimeout(()=>document.getElementById('loading')?.remove(),650);
    if(!CAPTURE)renderer.setAnimationLoop(frame);
    if(params.has('t'))window.__seek(Number(params.get('t'))||0);
    console.info('AZUR scene ready',JSON.stringify({batchInfo,quality:governor.settings.name,meshes:renderer.info.render.calls,triangles:renderer.info.render.triangles}));
  }catch(error){
    setProgress(100,'空间加载失败，请刷新重试');document.getElementById('loading-bar').style.background='#9b5142';
    console.error('AZUR initialization failed',error);
  }
}

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
  if(mode==='overview'&&!cameraTween)positionOverview();
  bloom.resolution.set(innerWidth/2,innerHeight/2);sizeAO();
  fxaa.material.uniforms.resolution.value.set(1/(innerWidth*renderer.getPixelRatio()),1/(innerHeight*renderer.getPixelRatio()));requestDraw();if(ready&&paused)renderSample(simT);
});
document.addEventListener('visibilitychange',()=>{clock.getDelta();governor.reset();});

// Deterministic one-take camera. Timed Hermite tangents keep both position and
// look-target continuous through every doorway; no cuts, dissolves or image cards.
const promoKeys=[
  {t:0,p:[72,66,-64],q:[0,29,24],f:48},
  {t:3.2,p:[43,58,-28],q:[0,39,12],f:48},
  {t:5.8,p:[22,50,8],q:[0,46,-4],f:50},
  {t:7.2,p:[-5.3,47.0,2.2],q:[-6,46.3,-4],f:55},
  {t:8.6,p:[-5.3,46.66,-1.0],q:[-6,46.2,-4.5],f:62},
  {t:10.5,p:[-10.4,46.65,-4.7],q:[-5.8,46.2,1.8],f:66},
  {t:13.0,p:[-2.5,46.65,-5.6],q:[2.8,46.2,-2.0],f:66},
  {t:15.2,p:[3.6,46.64,-4.9],q:[3.4,46.2,-1.7],f:64},
  {t:17.0,p:[-1.0,46.64,-5.9],q:[-5.3,46.3,-8.0],f:64},
  {t:18.5,p:[-5.3,46.64,-6.05],q:[-5.3,46.3,-9.8],f:62},
  {t:19.5,p:[-5.3,46.64,-7.70],q:[-7.6,46.3,-10.1],f:62},
  {t:21.5,p:[-5.65,46.64,-8.2],q:[-7.95,46.3,-10.15],f:64},
  {t:23.5,p:[-7.0,46.64,-8.0],q:[-11.55,46.35,-9.45],f:66},
  {t:24.2,p:[-5.3,46.64,-7.70],q:[-5.3,46.3,-2.0],f:62},
  {t:25.0,p:[-5.3,46.64,-6.05],q:[-5.3,46.3,-2.0],f:62},
  {t:27.0,p:[-5.3,46.64,1.10],q:[-7.0,46.2,2.4],f:60},
  {t:28.5,p:[-5.3,47.10,-.65],q:[-7.0,46.2,2.4],f:60},
  {t:30.0,p:[-9.6,46.62,1.28],q:[-.5,46.05,25],f:55},
  {t:32.0,p:[-10.25,46.62,1.40],q:[-.5,46.05,25],f:56},
];
function promoSample(t,key){
  const last=promoKeys.length-1;
  if(t<=0)return key==='f'?promoKeys[0].f:new THREE.Vector3(...promoKeys[0][key]);
  if(t>=32)return key==='f'?promoKeys[last].f:new THREE.Vector3(...promoKeys[last][key]);
  let i=0;while(i<last-1&&t>promoKeys[i+1].t)i++;
  const a=promoKeys[i],b=promoKeys[i+1],prev=promoKeys[Math.max(0,i-1)],next=promoKeys[Math.min(last,i+2)];
  const dt=b.t-a.t,u=(t-a.t)/dt,u2=u*u,u3=u2*u;
  const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
  if(key==='f'){
    const m0=(b.f-prev.f)/(b.t-prev.t),m1=(next.f-a.f)/(next.t-a.t);
    return h00*a.f+h10*dt*m0+h01*b.f+h11*dt*m1;
  }
  const av=new THREE.Vector3(...a[key]),bv=new THREE.Vector3(...b[key]);
  const m0=bv.clone().sub(new THREE.Vector3(...prev[key])).divideScalar(b.t-prev.t);
  const m1=new THREE.Vector3(...next[key]).sub(av).divideScalar(next.t-a.t);
  return av.multiplyScalar(h00).add(m0.multiplyScalar(h10*dt)).add(bv.multiplyScalar(h01)).add(m1.multiplyScalar(h11*dt));
}
window.promo={
  duration:32,
  renderAt(value,draw=true){
    const t=THREE.MathUtils.clamp(Number(value)||0,0,32);paused=true;cameraTween=null;orbit.enabled=false;mode='panorama';
    environment.group.getObjectByName('Residential_tower_below').visible=true;
    camera.position.copy(promoSample(t,'p'));camera.lookAt(promoSample(t,'q'));camera.fov=promoSample(t,'f');camera.updateProjectionMatrix();syncAngles();
    if(draw)renderSample(t);else{environment.update(t);camera.updateMatrixWorld(true);}
    return{t,position:camera.position.toArray()};
  },
};
window.__seek=t=>{paused=true;simT=Number.isFinite(Number(t))&&Number(t)>0?Number(t):0;renderSample(simT);};
window.__play=()=>{paused=false;clock.getDelta();};
window.__viewer={
  frame(n=1){for(let i=0;i<n;i++){simT+=1/60;renderSample(simT);}},
  setRoom(id,instant=true){const room=rooms.find(r=>r.id===id);if(room)setRoom(room,instant);renderSample(simT);},
  setMode(value,instant=true){setMode(value,instant);renderSample(simT);},
  setLight(value){if(Boolean(value)!==Boolean(golden))setLight();renderSample(simT);},
  seekTransition(r){if(!cameraTween)return false;cameraTween.startedAt=performance.now()-THREE.MathUtils.clamp(r,0,1)*cameraTween.duration*1000;updateCameraTween();renderSample(simT);return true;},
  getStats(){return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,quality:governor.settings.name,room:currentRoom.id,mode,golden,transitioning:Boolean(cameraTween)};},
  raycastCenter(){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);return ray.intersectObjects(scene.children,true).slice(0,8).map(h=>({name:h.object.name,distance:h.distance,point:h.point.toArray()}));},
  renderer,scene,camera,composer,gtao,bloom,
};
init();
