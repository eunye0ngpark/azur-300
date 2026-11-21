import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import bordigheraUrl from './assets/bordighera.jpg?inline';

const beds = [
  {x:-7.95, width:2.20, accent:'VelvetTeal', phase:1.2},
  {x:-1.95, width:1.80, accent:'Terracotta', phase:3.8},
];
const pots = [
  [-11.65,-5.90,1.05], [-5.15,-11.20,.70], [-3.92,-11.25,.48],
  [-11.45,1.65,.85], [10.95,1.65,.85],
];

function clothGrid(columns, rows, point) {
  const vertices=[], faces=[];
  for(let j=0;j<=rows;j++) for(let i=0;i<=columns;i++) {
    vertices.push(...point(i/columns,j/rows));
    if(i===columns || j===rows) continue;
    const a=j*(columns+1)+i,b=a+columns+1;
    faces.push(a,b,a+1,a+1,b,b+1);
  }
  const mesh=new THREE.BufferGeometry();
  mesh.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  mesh.setIndex(faces);mesh.computeVertexNormals();
  return mesh;
}

function makeBed(parent, materials, {x,width,accent,phase}) {
  // The upper face rolls over the mattress edge. Local ridges lose height near
  // the hem, so the side of the duvet hangs under its own weight.
  function cover(u,v) {
    const a=u*2-1, b=v*2-1, edge=Math.abs(a);
    const round=t=>Math.min(1,Math.max(0,t))*Math.PI*.5;
    const sideAngle=round((edge-.82)/.18), footAngle=round((v-.82)/.18);
    const side=1-Math.cos(sideAngle), foot=1-Math.cos(footAngle);
    const halfTop=width/2-.053;
    const xx=x+Math.sign(a)*(Math.min(edge/.82,1)*halfTop+.132*Math.sin(sideAngle));
    const zz=-10.86+Math.min(v/.82,1)*1.84+.164*Math.sin(footAngle)+.009*Math.sin(a*5+phase)*foot;
    const ridge=(r,w)=>Math.exp(-r*r/w);
    const folds=.030*ridge(b+.31*a+.13+.18*Math.sin(a*3.4+phase),.009)
      +.035*ridge(b-.43*a+.24+.12*Math.cos(a*4.7+phase),.015)
      +.015*Math.cos(18*a+9*b+3*Math.sin(5*b+phase))*(.20+.80*edge);
    const y=.885+.029*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)+folds-.205*side-.184*foot+.10*foot*side;
    return [xx,y,zz];
  }
  const duvet=new THREE.Mesh(clothGrid(60,48,cover),materials.get('LinenLight'));
  duvet.name='Linen_duvet';parent.add(duvet);
  const runner=new THREE.Mesh(clothGrid(60,18,(u,v)=>{
    const uv=.71+.23*v+.014*Math.sin(u*7+phase)+.018*(u-.5);
    const [px,py,pz]=cover(u,uv);
    return [px+(u-.5)*.016,py+.014+.009*Math.sin(v*8+u*9)+.013*Math.exp(-((v-.14)**2)/.012),pz];
  }),materials.get(accent));
  runner.name='Woven_bed_throw';parent.add(runner);
  for(const sign of [-1,1]) {
    const angle=sign*.067;
    const g=new THREE.SphereGeometry(1,52,32),p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const vx=p.getX(i),vy=p.getY(i),vz=p.getZ(i);
      const curve=t=>Math.sign(t)*Math.abs(t)**.55;
      const a=curve(vx),b=curve(vz),edge=Math.max(Math.abs(a),Math.abs(b));
      const crease=(.010+.008*Math.sin(12*b+phase))*Math.cos(25*a+20*b+phase)*edge**5;
      const px=a*width*.219,pz=b*.315;
      p.setXYZ(i,x+sign*width*.245+px*Math.cos(angle)-pz*Math.sin(angle),
        .897+curve(vy)*.134-pz*.09+crease,-10.74+px*Math.sin(angle)+pz*Math.cos(angle));
    }
    g.computeVertexNormals();
    const pillow=new THREE.Mesh(g,materials.get('Linen'));pillow.name='Linen_sleeping_pillow';parent.add(pillow);
  }
}

function seedRandom(seed) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}

// Silvery olive leaves grow in opposite pairs on flexible twigs. Trunks and
// branches taper into the same joints, including on the reverse of each crown.
function makeOlive(group,x,z,scale,seed,bark,foliage) {
  const rand=seedRandom(seed), twigs=[], vertices=[],colours=[],indices=[];
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  const up=v(0,1,0), tint=new THREE.Color();
  function branch(a,b,r0,r1){
    const d=b.clone().sub(a),g=new THREE.CylinderGeometry(r1,r0,d.length(),6,1,true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,d.normalize()));
    g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);twigs.push(g);
  }
  function leaf(base,angle,size,tilt){
    const dir=v(Math.cos(angle),tilt,Math.sin(angle)).normalize();
    const side=v(-Math.sin(angle),.22*Math.cos(angle*3),Math.cos(angle));
    const shade=.76+rand()*.38;
    tint.setHSL(.216+rand()*.048,.15+rand()*.12,.24+rand()*.14,THREE.SRGBColorSpace);
    const start=vertices.length/3;
    for(const [t,w,fold,light] of [[0,0,0,.74],[.48,-.155,.02,.82],[.55,0,.105,1.18],[.49,.155,.035,.99],[1,0,-.09,1.08]]){
      const p=base.clone().addScaledVector(dir,t*size).addScaledVector(side,w*size);
      vertices.push(p.x,p.y+fold*size,p.z);
      colours.push(tint.r*light*shade,tint.g*light*shade,tint.b*light*shade);
    }
    for(const i of [0,1,2,0,2,3,1,4,2,2,4,3])indices.push(start+i);
  }
  const root=v(0,.474,0),fork=v(.015,.83,-.01);
  branch(root,fork,.027,.021);
  for(let i=0;i<8;i++){
    const angle=i*2.40+rand()*.4,h=.28+rand()*.42;
    const start=fork.clone().addScaledVector(up,i*.026);
    if(i>0)branch(fork,start,.019,.012);
    const elbow=start.clone().add(v(.18*Math.cos(angle),h*.46,.18*Math.sin(angle)));
    const end=elbow.clone().add(v(.10*Math.cos(angle+.3),h*.54,.10*Math.sin(angle+.3)));
    branch(start,elbow,.015,.009);branch(elbow,end,.010,.004);
    for(let k=0;k<8;k++){
      const stem=elbow.clone().lerp(end,k/8);
      const a=angle+(k%2?1:-1)*(.5+rand()*.9),len=.17+rand()*.20;
      const tip=stem.clone().add(v(len*Math.cos(a),.11+rand()*.21,len*Math.sin(a)));
      branch(stem,tip,.004,.0011);
      for(let n=0;n<7;n++){
        const node=stem.clone().lerp(tip,(n+.5)/7);
        for(const sign of [-1,1])leaf(node,a+sign*(.57+rand()*.59),.066+rand()*.038,rand()*.78-.16);
      }
    }
  }
  const crown=new THREE.Group();crown.name='Olea_europaea';crown.position.set(x,0,z);crown.scale.setScalar(scale);group.add(crown);
  const wood=new THREE.Mesh(mergeGeometries(twigs),bark);wood.name='Olive_branches';crown.add(wood);
  twigs.forEach(g=>g.dispose());
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));g.setIndex(indices);g.computeVertexNormals();
  const leaves=new THREE.Mesh(g,foliage);leaves.name='Olive_leaves';crown.add(leaves);
}

function oldPiece(m,p) {
  if(m==='Leaf'||m==='LeafLight')return pots.some(([x,z,s])=>Math.hypot(p.x-x,p.z-z)<.72*s);
  if(p.z>-8.7||p.z<-11.1)return false;
  return beds.some(({x,width,accent})=>Math.abs(p.x-x)<width*.52 &&
    ((m==='DetailCream'&&Math.abs(p.y-.914)<.006)||
    (m===accent&&Math.abs(p.y-.875)<.018&&Math.abs(p.z+8.95)<.09)));
}

export function refineBedroomsAndPlants(model) {
  model.updateMatrixWorld(true);
  const materials=new Map(),remove=[],matrix=new THREE.Matrix4(),p=new THREE.Vector3();
  const inverse=model.matrixWorld.clone().invert(),local=new THREE.Matrix4();
  model.traverse(o=>{
    if(!o.isMesh)return;
    materials.set(o.material.name,o.material);
    local.multiplyMatrices(inverse,o.matrixWorld);
    if(o.isInstancedMesh) {
      let keep=0;
      for(let i=0;i<o.count;i++){
        o.getMatrixAt(i,matrix);
        p.setFromMatrixPosition(matrix).applyMatrix4(local);
        if(oldPiece(o.material.name,p))continue;
        if(i!==keep)o.setMatrixAt(keep,matrix);
        keep++;
      }
      if(!keep)remove.push(o);
      else if(keep!==o.count){
        o.count=keep;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();o.computeBoundingBox();
      }
    }else if(/^(Bed_(duvet|throw|pillow)|V2_duvet_stitch|Plant_(stem|leaf))/.test(o.name)||
      oldPiece(o.material.name,p.setFromMatrixPosition(local))) remove.push(o);
  });
  remove.forEach(o=>o.removeFromParent());
  const group=new THREE.Group();group.name='Residence_details';model.add(group);
  beds.forEach(b=>makeBed(group,materials,b));
  const bark=new THREE.MeshStandardMaterial({color:0x695d48,roughness:.92});bark.name='Olive_bark';
  const foliage=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.77});foliage.name='Olive_foliage';
  pots.forEach(([x,z,s],i)=>makeOlive(group,x,z,s,628+i*37,bark,foliage));
}

export async function hangRivieraPrint(model) {
  const texture=await new THREE.TextureLoader().loadAsync(bordigheraUrl);
  texture.colorSpace=THREE.SRGBColorSpace;
  const living=model.getObjectByName('Living');
  if(!living)return;
  for(const child of [...living.children]){
    if(/^(Art_(canvas|shape)|V2_art_frame)/.test(child.name))child.removeFromParent();
  }
  const group=new THREE.Group();group.name='Bordighera_print';group.position.set(-7.35,1.90,-6.845);
  model.getObjectByName('Residence_details').add(group);
  const oak=new THREE.MeshStandardMaterial({name:'Walnut',color:0x72513b,roughness:.54});
  const mount=new THREE.MeshStandardMaterial({name:'Museum_board',color:0xeee6d4,roughness:.96});
  const print=new THREE.MeshStandardMaterial({name:'Bordighera_reproduction',map:texture,roughness:.85});
  const width=1.80,height=1.47,edge=.024;
  function bar(name,w,h,d,x,y,z,material){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.name=name;m.position.set(x,y,z);group.add(m);
  }
  bar('Window_mat',width,height,.025,0,0,0,mount);
  for(const sign of [-1,1]){
    bar('Frame_rail',width+edge*2,edge,.056,0,sign*(height+edge)/2,.014,oak);
    bar('Frame_stile',edge,height,.056,sign*(width+edge)/2,0,.014,oak);
  }
  const paper=new THREE.Mesh(new THREE.PlaneGeometry(1.57,1.57*644/800),print);
  paper.name='Monet_Bordighera_1884';paper.position.z=.0135;group.add(paper);
}
