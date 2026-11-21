// Curves and cloth are drawn in metres in the GLB's Y-up apartment coordinates.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const rad = THREE.MathUtils.degToRad;
const curtainCentres = [-12.15, -10.9, -1.15, 1.0, 11.9];
const sofaOrigin = [-6.2, -1.95];
const polar = (angle, radius, y) => [
  sofaOrigin[0] + radius * Math.cos(angle), y, sofaOrigin[1] - radius * Math.sin(angle),
];
const powSigned = (n, e) => Math.sign(n) * Math.pow(Math.abs(n), e);

function surface(columns, rows, point, { reverse = false, wrapU = false, wrapV = false } = {}) {
  const vertices = [], uvs = [], indices = [];
  const stride = columns + (wrapU ? 0 : 1);
  const rings = rows + (wrapV ? 0 : 1);
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < stride; i++) {
      vertices.push(...point(i / columns, j / rows));
      uvs.push(i / columns, j / rows);
    }
  }
  for (let j = 0; j < rows; j++) {
    const top = j * stride, bottom = ((j + 1) % rings) * stride;
    for (let i = 0; i < columns; i++) {
      const k = (i + 1) % stride, a = top + i, b = top + k, c = bottom + i, d = bottom + k;
      indices.push(...(reverse ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function add(parent, name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = !material.transparent;
  mesh.receiveShadow = !material.transparent;
  parent.add(mesh);
  return mesh;
}

function piping(parent, name, points, material, radius, closed = false) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed);
  return add(parent, name, new THREE.TubeGeometry(path, Math.max(18, points.length * 2), radius, 5, closed), material);
}

// Include densely sampled crown transitions, so even long sections have round ends.
function sofaBand(parent, name, start, end, inner, outer, low, high, material, seat = false) {
  const middle = (inner + outer) / 2, midY = (low + high) / 2;
  const from = rad(start), to = rad(end), length = (to - from) * middle;
  const cap = Math.min(.10, length / 8);
  const stations = [];
  for (let k = 0; k < 7; k++) {
    const angle = k * Math.PI / 14;
    stations.push([cap * (1 - Math.cos(angle)), Math.max(.0005, Math.sin(angle))]);
  }
  const coreSteps = Math.max(10, Math.round(length / .085));
  for (let k = 0; k <= coreSteps; k++) stations.push([cap + (length - 2 * cap) * k / coreSteps, 1]);
  for (let k = 6; k >= 0; k--) {
    const angle = k * Math.PI / 14;
    stations.push([length - cap * (1 - Math.cos(angle)), Math.max(.0005, Math.sin(angle))]);
  }
  const geometry = surface(stations.length - 1, 32, (u, v) => {
    const [distance, scale] = stations[Math.round(u * (stations.length - 1))];
    const a = from + distance / middle;
    const phi = TAU * v;
    const crossX = powSigned(Math.cos(phi), .65), crossY = powSigned(Math.sin(phi), .61);
    const top = Math.max(0, Math.sin(phi));
    const sag = seat ? .022 * top * (1 - crossX ** 2) * Math.sin(Math.PI * distance / length) ** 2 : 0;
    const roll = seat ? .004 * Math.sin(23 * a + v) : .009 * Math.sin(3.3 * a + .8);
    const radius = middle + (outer - inner) * .5 * crossX * scale + roll * top;
    const height = midY + (high - low) * .5 * crossY * scale - sag;
    return polar(a, radius, height);
  }, {wrapV: true});
  add(parent, name, geometry, material);
}

function cushion(parent, name, {width, height, depth, material, phase = 0, welt = material}) {
  const outline = (u, v) => {
    const angle = u * TAU, phi = (v - .5) * Math.PI;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const round = Math.max(.0001, Math.abs(ca) ** 4 + Math.abs(sa) ** 4) ** -.25;
    const shell = Math.cos(phi), fullness = Math.max(.001, shell) ** .57;
    const x = ca * round, y = sa * round;
    const indent = .012 * Math.sin(7 * angle + phase) * (.6 + .4 * Math.sin(13 * angle + phase));
    const corner = Math.abs(x * y);
    const side = Math.sin(phi);
    const creases = .014 * Math.sin(angle * 22 + phase + shell * 4) * corner ** 1.8 * shell ** 2 * Math.sin(Math.PI * shell);
    return [width * x * fullness * .5, height * y * fullness * .5 + indent * shell ** 3,
      side * (depth * .5 * (1 - .18 * corner) + creases) + .016 * x * y * shell];
  };
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  add(group, name + '_cloth', surface(56, 18, outline, {wrapU:true}), material);
  const hem = Array.from({length:64}, (_, i) => outline(i / 64, .53));
  piping(group, name + '_welt', hem, welt, .003, true);
  return group;
}

function sofa(parent, mat) {
  sofaBand(parent, 'Inset_oak_toe', 32, 148, 1.84, 2.90, .043, .16, mat.get('Walnut'));
  sofaBand(parent, 'Upholstered_deck', 30, 150, 1.72, 3.02, .125, .35, mat.get('Boucle'));
  sofaBand(parent, 'Curved_backrest', 29.4, 150.4, 2.65, 3.09, .26, .94, mat.get('Boucle'));
  for (const [i, start, end] of [[0,30.2,69.7],[1,70,109.9],[2,110.2,149.8]]) {
    sofaBand(parent, 'Tailored_seat_' + i, start, end, 1.69, 2.79, .30, .535, mat.get('LinenLight'), true);
  }
  for (const [angle, width, h, textile, tilt] of [[42,.55,.48,'Linen',.12],[73,.56,.52,'VelvetTeal',-.095],
    [111,.60,.45,'Linen',.05],[138,.49,.47,'Boucle',-.15]]) {
    const a = rad(angle);
    const pillow = cushion(parent, 'Loose_cushion_' + angle, {
      width, height:h, depth:.21, material:mat.get(textile), phase:a * 2,
    });
    pillow.position.set(...polar(a,2.58,.50 + h * .44));
    // Local +Z faces the centre of the sofa. The top leans into the curved back.
    pillow.rotation.order = 'YXZ';
    pillow.rotation.y = a - Math.PI / 2;
    pillow.rotation.x = -.20;
    pillow.rotation.z = tilt;
  }
  // A throw follows the top crown, turns over the inside edge and hangs towards the rug.
  const throwFabric = mat.get('Linen');
  const profile = [[2.53,.534],[2.38,.538],[2.20,.529],[2.02,.533],[1.88,.526],[1.80,.514],
    [1.75,.503],[1.71,.480],[1.685,.450],[1.675,.408],[1.672,.367],[1.66,.31],[1.646,.24],[1.63,.184]];
  const cloth = (u,v) => {
    const n = Math.min(profile.length-2, Math.floor(v*(profile.length-1)));
    const f = v * (profile.length-1) - n;
    let radius = THREE.MathUtils.lerp(profile[n][0],profile[n+1][0],f);
    let y = THREE.MathUtils.lerp(profile[n][1],profile[n+1][1],f);
    const wave = .013 * Math.sin(17*u + 2*v) + .006 * Math.sin(34*u - 5*v);
    const drape = THREE.MathUtils.smoothstep(v,.45,.82);
    radius -= wave * drape;
    y += (.017 + wave) * (1-drape) + .014 * Math.sin(7*u+1) * v ** 5;
    return polar(rad(121) + (u-.5)*.56/2.1 + .077*v + .007*Math.sin(4*v), radius, y);
  };
  const twoSidedThrow = throwFabric.clone();
  twoSidedThrow.side = THREE.DoubleSide;
  add(parent, 'Woven_throw', surface(32,36,cloth), twoSidedThrow);
  for (let i=0;i<29;i++) {
    const u = (i+.5)/29, end = cloth(u,1);
    const offset = .025 + .006*Math.sin(i*1.8);
    piping(parent, 'Knotted_fringe', [end,[end[0]+.002,end[1]-offset*.55,end[2]+.002],
      [end[0]+.004*Math.sin(i),end[1]-offset,end[2]+.004]], twoSidedThrow,.0015);
  }
}

function loungeChair(parent, mat, x, z, angle, fabric) {
  const chair = new THREE.Group(); chair.position.set(x,0,z); chair.rotation.y=rad(angle); parent.add(chair);
  const material=mat.get(fabric);
  const deck = cushion(chair,'Chair_floating_base',{width:.82,height:.78,depth:.14,material:mat.get('Walnut')});
  deck.position.set(0,.245,0);deck.rotation.x=-Math.PI/2;
  const seat = cushion(chair,'Chair_seat_pad',{width:.84,height:.79,depth:.21,material,phase:x});
  seat.position.set(0,.382,.025);seat.rotation.x=-Math.PI/2-.035;
  // Continuous horseshoe shell. The rear rises above the arms, exposing a curved inner back.
  const shellPoint = (u,v) => {
    const angle = rad(-110 + u*220), ca = Math.cos(angle), sa = Math.sin(angle);
    const rear = Math.max(0,ca);
    const high = .62 + .36 * rear ** 1.45 + .043 * Math.sin(Math.PI*u);
    const low = .252 + .035*(1-rear);
    const phi = TAU*v, vertical = powSigned(Math.sin(phi),.65);
    const height = (low+high)/2 + (high-low)*.5*vertical;
    const thickness = .11 * powSigned(Math.cos(phi),.66);
    const endTaper = Math.min(1,Math.min(u,1-u)/.035);
    const taper = Math.sqrt(Math.max(.0001,1-(1-endTaper)**2));
    const lean = (height-.25) * .10;
    return [( .43 + thickness*.53*taper + lean*.40 )*sa,
      (low+high)*.5 + (height-(low+high)*.5)*taper,
      -(.35 + thickness*.52*taper + lean) * ca + .035];
  };
  add(chair,'Chair_continuous_shell',surface(64,28,shellPoint,{wrapV:true,reverse:true}),material);
}

function curtains(parent, mat) {
  const textile = new THREE.MeshStandardMaterial({name:'LinenVoile',color:0xf1eadc,roughness:1,
    transparent:true,opacity:.73,side:THREE.FrontSide,depthWrite:false});
  // Opposite windings retain the reverse view if the host uses front-face transparency.
  const count=curtainCentres.length;
  const rail = add(parent,'Recessed_curtain_track',new THREE.BoxGeometry(24.75,.026,.034),mat.get('OakLight'));
  rail.position.set(0,3.348,-.205);
  for (let panel=0;panel<count;panel++) {
    const centre = curtainCentres[panel], phase=panel*1.73;
    const point = (u,v) => {
      const loosen = 1-v, spread = .47 + .20*loosen ** .85;
      const phaseU = u*TAU*(4.45+.15*Math.sin(phase)) + phase + .22*Math.sin(4.1*v+phase) +
        .28*Math.sin(9*u+3*v+phase)*loosen;
      const hem = .036 + .012*Math.cos(phaseU) + .007*Math.cos(phaseU*.51);
      const x = centre + (u-.5)*spread + .030*loosen*Math.sin(3.5*v+phase+u);
      const z = -.215 + (.047 + .032*loosen) * Math.sin(phaseU) + .013*Math.sin(phaseU*2) -
        .032*loosen*Math.sin(v*4+phase+u*3);
      return [x,THREE.MathUtils.lerp(hem,3.337,v),z];
    };
    const sheet = surface(60,18,point);
    const positions = Array.from(sheet.attributes.position.array);
    const normals = Array.from(sheet.attributes.normal.array);
    const uvs = Array.from(sheet.attributes.uv.array);
    const index = Array.from(sheet.index.array), vertexCount = positions.length / 3;
    // Two fabric faces have opposite normals and render correctly from either side.
    sheet.setAttribute('position', new THREE.Float32BufferAttribute([...positions,...positions],3));
    sheet.setAttribute('normal', new THREE.Float32BufferAttribute([...normals,...normals.map(n=>-n)],3));
    sheet.setAttribute('uv',new THREE.Float32BufferAttribute([...uvs,...uvs],2));
    const both = [...index];
    for (let k=0;k<index.length;k+=3) both.push(vertexCount+index[k],vertexCount+index[k+2],vertexCount+index[k+1]);
    sheet.setIndex(both);
    add(parent,'Gathered_linen_panel_'+panel,sheet,textile);
    const seam=Array.from({length:60},(_,i)=>point(i/59,.011));
    piping(parent,'Curtain_weighted_hem',seam,mat.get('Linen'),.002);
  }
}

// Optimisation promoted some individual objects into shared, anonymous instance groups.
// Remove only the instances at the original trim/curtain anchors; their siblings stay in place.
function matchesInstance(material, p) {
  if(material==='LinenLight' && Math.abs(p.y-1.66)<.005 && Math.abs(p.z+.20)<.005)
    return curtainCentres.some(x=>Math.abs(p.x-x)<.18);
  const r=Math.hypot(p.x-sofaOrigin[0],p.z-sofaOrigin[1]);
  if(material==='DetailCream' && Math.abs(p.y-.526)<.003 && p.z<-2.8 && Math.abs(r-2.24)<.015)return true;
  if(material==='Bronze' && Math.abs(p.y-.948)<.004 && p.z<-3 && Math.abs(r-2.52)<.02)return true;
  return material==='DetailCream' && Math.abs(p.y-.535)<.002 && Math.abs(p.z+3.58)<.006 && p.x>-7.71 && p.x<-7.0;
}

export function refineUpholstery(model) {
  if (model.getObjectByName('Tailored_furnishings')) return;
  const living=model.getObjectByName('Living');
  if (!living || !model.getObjectByName('Curved_sofa_seat')) return;
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert(), local = new THREE.Matrix4();
  const matrix = new THREE.Matrix4(), centre = new THREE.Vector3();
  const materials = new Map(), remove = [];
  const oldLiving = /^(Curved_sofa_|Sofa_accent_pillow|Lounge_(seat|back|arm)|V2_(sofa_radial_seam|pillow_button|cashmere_throw|throw_fringe))/;
  model.traverse(object => {
    if(!object.isMesh) return;
    materials.set(object.material.name,object.material);
    if(object.isInstancedMesh) {
      local.multiplyMatrices(inverse,object.matrixWorld);
      let kept=0;
      for(let i=0;i<object.count;i++) {
        object.getMatrixAt(i,matrix);
        centre.setFromMatrixPosition(matrix).applyMatrix4(local);
        if(matchesInstance(object.material.name,centre))continue;
        if(kept!==i)object.setMatrixAt(kept,matrix);
        kept++;
      }
      if(kept===0)remove.push(object);
      else if(kept!==object.count){
        object.count=kept;object.instanceMatrix.needsUpdate=true;
        object.computeBoundingSphere();object.computeBoundingBox();
      }
    } else if(/^Linen_curtain_fold/.test(object.name) || (object.parent===living && oldLiving.test(object.name))) {
      remove.push(object);
    }
  });
  for(const object of remove)object.removeFromParent();
  const group=new THREE.Group();group.name='Tailored_furnishings';living.add(group);
  sofa(group,materials);
  loungeChair(group,materials,-10.45,-3.45,-26,'LeatherCognac');
  loungeChair(group,materials,-2.15,-3.70,28,'VelvetTeal');
  curtains(group,materials);
}
