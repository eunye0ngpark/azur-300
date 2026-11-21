import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Local +Z faces the table. The source model has Z-up in Blender and Y-up in glTF.
const placements = [
  ...[1.55, 2.80, 4.05].flatMap(x => [
    [x, -2.38, Math.PI, 'Linen'], [x, -4.32, 0, 'Linen'],
  ]),
  [.62, -3.35, Math.PI / 2, 'LeatherCognac'], [4.98, -3.35, -Math.PI / 2, 'LeatherCognac'],
  [-7.25, 1.70, Math.PI / 2, 'LinenLight'], [-4.95, 1.70, -Math.PI / 2, 'LinenLight'],
  [-6.10, .55, 0, 'LinenLight'], [-6.10, 2.72, Math.PI, 'LinenLight'],
];
const point = (x,y,z) => new THREE.Vector3(x,y,z);
const backWidth = .222;
const backHeight = .676;
function onBack(u, v) {
  const y = backHeight + v * (v > 0 ? .198 : .103);
  return point(backWidth * u, y, -.181 - .070 * (1-u*u) - .20 * (y-backHeight));
}
function backRim(angle) {
  return onBack(Math.cos(angle),Math.sin(angle));
}
function padEdge(angle, scale) {
  const shape = n => Math.sign(n)*Math.abs(n)**.77;
  const z = shape(Math.sin(angle));
  return [shape(Math.cos(angle)) * (.232+.014*z) * scale, z*.214*scale];
}

function woodwork() {
  const parts=[];
  function tube(points, radius, segments, closed=false) {
    const curve = new THREE.CatmullRomCurve3(points,closed,'centripetal');
    const mesh = new THREE.TubeGeometry(curve,segments,radius,8,closed);
    // A chair stands on four flat end-grain faces. Close the open tube ends.
    if(!closed){
      const position=mesh.getAttribute('position');
      const faces=Array.from(mesh.index.array);
      for(const end of [0,segments]){
        const start=end*9;
        if(points[end===0 ? 0 : points.length-1].y===0) {
          for(let n=0;n<=8;n++)position.setY(start+n,0);
        }
        for(let n=1;n<7;n++){
          if(end===0)faces.push(start,start+n+1,start+n);
          else faces.push(start,start+n,start+n+1);
        }
      }
      mesh.setIndex(faces);
    }
    parts.push(mesh);
  }
  // One steam-bent rail connects the rear feet, the two uprights and the crown.
  const crest=[];
  for(let i=0;i<=16;i++)crest.push(backRim(Math.PI*(1-i/16)));
  const upright = side => [
    point(side*.206,0,-.211), point(side*.182,.20,-.172),
    point(side*.163,.409,-.157),point(side*.183,.540,-.169),
  ];
  tube([...upright(-1),...crest,...upright(1).reverse()],.017,71);
  const lower=[];
  for(let i=0;i<=22;i++)lower.push(backRim(Math.PI+i*Math.PI/22));
  tube(lower,.0135,26);
  for(const side of [-1,1]){
    tube([point(side*.216,0,.191),point(side*.205,.149,.182),
      point(side*.183,.319,.166),point(side*.178,.417,.159)],.0165,10);
  }
  const edge=[];
  for(let i=0;i<52;i++){
    const [x,z]=padEdge(i*Math.PI/26,1);
    edge.push(point(x,.407,z));
  }
  tube(edge,.018,52,true);
  for(const side of [-1,1]){
    tube([point(side*.194,.215,.176),point(side*.176,.189,.075),
      point(side*.167,.184,-.075),point(side*.182,.216,-.173)],.009,12);
  }
  const merged=mergeGeometries(parts);
  parts.forEach(part=>part.dispose());
  return merged;
}

function seatPad() {
  const positions=[],indices=[],n=48;
  // Full top and bottom are joined to a small rolled edge, with a shallow saddle.
  const rings=[[.002,.418],[.89,.418],[.978,.425],[1,.439],[.995,.453],
    [.974,.466],[.907,.475],[.71,.480],[.46,.478],[.20,.473],[.002,.472]];
  for(const [scale,y] of rings){
    for(let j=0;j<n;j++){
      const angle=j*2*Math.PI/n,[x,z]=padEdge(angle,scale);
      positions.push(x,y-.014*z,z);
    }
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){
    const a=i*n+j,b=i*n+(j+1)%n;
    indices.push(a,a+n,b,b,a+n,b+n);
  }
  const bottom=positions.length/3;
  positions.push(0,.418,0,0,.472,0);
  const last=(rings.length-1)*n;
  for(let j=0;j<n;j++){
    indices.push(bottom,j,(j+1)%n,bottom+1,last+(j+1)%n,last+j);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}

function canePanel() {
  const positions=[],colors=[],indices=[];
  // Warp, weft and two binders. Each strip crosses a curved oval in 3D and ends
  // inside its wooden rim. Empty space between the strands is actual geometry.
  const span=.150;
  function strand(angle, offset, width, family, index){
    const sn=Math.sin(angle),cs=Math.cos(angle);
    const extent=Math.sqrt(Math.max(0,1-offset*offset));
    const n=Math.max(4,Math.ceil(extent*21)),start=positions.length/3;
    const tint=.85+.14*((index*17+family*29)%13)/12;
    for(let i=0;i<=n;i++){
      const t=(i/n*2-1)*extent;
      for(const side of [-1,1]){
        const lane=offset+side*width/2;
        const u=cs*t-sn*lane,v=sn*t+cs*lane;
        const p=onBack(u,v);
        p.z += family>=2 ? -.0019 : .0014*Math.cos((family===0 ? u : v)*Math.PI/span+(index+family)*Math.PI);
        positions.push(p.x,p.y,p.z);colors.push(tint,tint*.983,tint*.940);
      }
      if(i<n){const a=start+i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
    }
  }
  [0,Math.PI/2,Math.PI*.25,-Math.PI*.25].forEach((angle,family)=>{
    const spacing=family<2 ? span : span*Math.SQRT2;
    const count=Math.floor(.99/spacing);
    for(let i=-count;i<=count;i++)strand(angle,i*spacing,family<2?.026:.020,family,i+count);
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}

function previousPieces(){
  const anchors=[];
  for(const [x,z,rotation,fabric] of placements){
    const sn=Math.sin(rotation),cs=Math.cos(rotation);
    const add=(material,dx,y,dz)=>anchors.push({material,p:point(x+cs*dx+sn*dz,y,z-sn*dx+cs*dz)});
    add(fabric,0,.470,0);
    add(fabric,0,.780,-.225);
    for(const side of [-1,1])for(const end of [-1,1])add('Oak',side*.212,.235,end*.1908);
  }
  return anchors;
}

export function refineBistro(model) {
  if(model.getObjectByName('Riviera_chairs'))return;
  const anchors=previousPieces(),materials=new Map(),remove=[];
  model.updateMatrixWorld(true);
  const inverse=model.matrixWorld.clone().invert();
  const local=new THREE.Matrix4(),matrix=new THREE.Matrix4(),centre=new THREE.Vector3();
  model.traverse(o=>{
    if(!o.isMesh)return;
    materials.set(o.material.name,o.material);
    if(!o.isInstancedMesh){
      if(/^(Chair_seat|Chair_back|Chair_leg)(\d+|\.\d+)?$/.test(o.name)
        && ['WineDining','Terrace'].includes(o.parent?.name))remove.push(o);
      return;
    }
    // The GLB optimizer promotes shared chair parts into anonymous scene-level
    // instance batches. Filter only the original 12 chairs by material and anchor.
    local.multiplyMatrices(inverse,o.matrixWorld);
    let kept=0;
    for(let i=0;i<o.count;i++){
      o.getMatrixAt(i,matrix);
      centre.setFromMatrixPosition(matrix).applyMatrix4(local);
      if(anchors.some(({material,p})=>material===o.material.name&&p.distanceToSquared(centre)<.000016))continue;
      if(kept!==i)o.setMatrixAt(kept,matrix);
      kept++;
    }
    if(!kept)remove.push(o);
    else if(kept!==o.count){
      o.count=kept;o.instanceMatrix.needsUpdate=true;o.computeBoundingBox();o.computeBoundingSphere();
    }
  });
  for(const o of remove)o.removeFromParent();
  const group=new THREE.Group();group.name='Riviera_chairs';model.add(group);
  const frame=woodwork(),pad=seatPad(),panel=canePanel();
  const cane=new THREE.MeshStandardMaterial({name:'Honey_cane',color:0xbe956c,vertexColors:true,roughness:.65,side:THREE.DoubleSide});
  placements.forEach(([x,z,angle,fabric],i)=>{
    const chair=new THREE.Group();chair.name='Bentwood_chair_'+String(i+1).padStart(2,'0');
    chair.position.set(x,i<8?.038:.012,z);chair.rotation.y=angle;group.add(chair);
    for(const [name,geo,mat] of [
      ['Bent_oak_frame',frame,materials.get('Oak')],['Tailored_seat',pad,materials.get(fabric)],['Open_cane_back',panel,cane],
    ]){
      const part=new THREE.Mesh(geo,mat);part.name=name;part.castShadow=true;part.receiveShadow=true;chair.add(part);
    }
  });
  return group;
}
