// An interpretive model of the Baie des Anges. Coordinates and heights are metres.
// The waterfront is a single curve shared by the water mesh, beach, road and streets.
import * as THREE from 'three';

// A straight frontage leaves the complete sea-facing hemisphere open.
export function shoreZ() { return 66; }
export function shoreSlope() { return 0; }
function terrainHeight() { return .01; }
function ramp(a,b,v) { return THREE.MathUtils.smoothstep(v,a,b); }

// Small, measured facade motifs, painted once. Mipmaps filter rails and shutters
// as they recede. Facades farther down the bay all use these same three textures.
function facadeTexture(style, random) {
  const canvas = document.createElement('canvas');
  const s = 128, count = 4;
  canvas.width = canvas.height = s * count;
  const ctx = canvas.getContext('2d');
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      ctx.save();
      ctx.translate(col * s, row * s);
      ctx.fillStyle = ['#eee6d8', '#e7e2d4', '#e2e0d6'][style];
      ctx.fillRect(0, 0, s, s);
      const v = Math.floor(random() * 200);
      ctx.fillStyle = 'rgba(77,62,51,.045)';
      for (let k = 0; k < 9; k++) ctx.fillRect(random() * s, 0, random() * 10, s);
      ctx.fillStyle = '#b5ada1';
      ctx.fillRect(0, 117, s, 3);
      ctx.fillStyle = '#f7f1e1';
      ctx.fillRect(0, 114, s, 3);
      const x = style === 2 ? 20 : 37;
      const w = s - x * 2, y = style === 2 ? 22 : 18, h = 82;
      ctx.fillStyle = '#c3bcaf';
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.fillStyle = '#606466';
      ctx.fillRect(x, y, w, h);
      const glass = ctx.createLinearGradient(x, y, x + w, y + h);
      glass.addColorStop(0, v > 90 ? '#809395' : '#535b5e');
      glass.addColorStop(1, v > 130 ? '#c2bfb6' : '#353e40');
      ctx.fillStyle = glass;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = '#c7c3b6';
      ctx.fillRect(63, y + 2, 2, h - 4);
      ctx.fillRect(x + 2, y + 20, w - 4, 2);
      if (style < 2) {
        const shutter = ['#7d8880', '#909b91', '#89908a', '#999488'][(v + style) % 4];
        const closed = v < 30;
        for (const sx of closed ? [x, 64] : [x - 22, x + w + 3]) {
          ctx.fillStyle = '#aaa69c';
          ctx.fillRect(sx + 2, y + 2, 20, h);
          ctx.fillStyle = shutter;
          ctx.fillRect(sx, y, closed ? w / 2 : 19, h);
          ctx.fillStyle = 'rgba(47,58,55,.36)';
          for (let slat = y + 5; slat < y + h - 3; slat += 4) ctx.fillRect(sx + 2, slat, closed ? w / 2 - 4 : 15, 1);
        }
      } else if (v < 115) {
        ctx.fillStyle = '#d5c3a8';
        ctx.fillRect(x, y, w, 9 + v / 4);
      }
      const balcony = style !== 1 || v < 120;
      if (balcony) {
        const left = style === 2 ? 2 : x - 8, right = s - left;
        ctx.fillStyle = '#5d6261';
        ctx.fillRect(left, 77, right - left, 3);
        ctx.fillRect(left, 96, right - left, 2);
        for (let bar = left; bar < right; bar += 5) ctx.fillRect(bar, 79, 1.6, 18);
        ctx.fillStyle = '#a09c94';
        ctx.fillRect(left - 2, 102, right - left + 4, 5);
        ctx.fillStyle = '#f0e8db';
        ctx.fillRect(left - 2, 99, right - left + 4, 3);
      }
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function geometryWriter() {
  const positions = [], colors = [], uvs = [], indices = [];
  return {
    quad(a, b, c, d, color, uv = [0, 0, 1, 1]) {
      const start = positions.length / 3;
      positions.push(...a, ...b, ...c, ...d);
      for (let i = 0; i < 4; i++) colors.push(color.r, color.g, color.b);
      uvs.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    },
    make(name, material, parent) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = name;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    },
  };
}

function mainland(group) {
  const columns = 264, rows = 108, verts = [], colors = [], indices = [];
  const olive = new THREE.Color(0x435a48), rock = new THREE.Color(0x858879);
  const plain = new THREE.Color(0xa6a497), c = new THREE.Color();
  for (let j = 0; j <= rows; j++) {
    const inland = 59 + (1950 - 59) * j / rows;
    for (let i = 0; i <= columns; i++) {
      const x = -2740 + 5480 * i / columns, z = shoreZ(x) - inland;
      const height = terrainHeight(x, inland);
      verts.push(x, height, z);
      const mosaic = .45 + .26 * Math.sin(x / 56 + z / 30) + .21 * Math.cos(x / 83 - z / 47)
        + .16 * Math.sin(x / 22 + Math.sin(z / 37)) * Math.cos(z / 13);
      c.copy(olive).lerp(rock, Math.max(0, mosaic - .29)).lerp(plain, 1 - ramp(190, 430, inland));
      colors.push(c.r, c.g, c.b);
      if (i === columns || j === rows) continue;
      const a = j * (columns + 1) + i;
      indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 1}));
  terrain.name = 'Inland_ground';
  terrain.receiveShadow = true;
  group.add(terrain);
}

export function addCoastalTown(group, random) {
  mainland(group);
  const facades = [geometryWriter(), geometryWriter(), geometryWriter()];
  const roofSurfaces = geometryWriter();
  const trim = geometryWriter();
  const terracottas = [0xa56d55, 0xac7460, 0x8c6456, 0xaf7f65, 0x997462];
  const stuccos = [0xf2e6cf, 0xe3d2bc, 0xe5c3b2, 0xf0eae0, 0xdecfb9, 0xd9bf9f];
  const stone = new THREE.Color(0xcac4b9);
  const foundations = new THREE.Color(0xa69e8e);
  const groves = [];
  function groundAt(x,z) {
    return terrainHeight(x,shoreZ(x)-z);
  }

  function building(cx, inland, w, depth, floors, style) {
    const z = shoreZ(cx) - inland;
    const rotation = Math.atan(shoreSlope(cx)) + (random() - .5) * (inland < 175 ? .13 : .34);
    const cs = Math.cos(rotation), sn = Math.sin(rotation);
    const W = w / 2, D = depth / 2;
    const corners = [[-W,D],[W,D],[W,-D],[-W,-D]];
    const sampledHeights = corners.map(([x,dz]) => groundAt(cx+x*cs-dz*sn,z+x*sn+dz*cs));
    const ground = Math.max(...sampledHeights) + .08;
    const point = (x, y, dz) => [cx + x * cs - dz * sn, ground + y, z + x * sn + dz * cs];
    if (inland > 114 && random() > .26) {
      // Courtyards and small gardens provide scale and break up the street wall.
      for(let k=0;k<2+Math.floor(random()*3);k++){
        const localX = (random()-.5)*w*1.07;
        const localZ = -D-2.5-random()*3.5;
        const [gx,,gz] = point(localX,0,localZ);
        groves.push([gx,gz,3.3+random()*4.4,random()<.26]);
      }
    }
    const height = floors * (style === 2 ? 2.88 : 3.15);
    const wall = new THREE.Color(stuccos[Math.floor(random() * stuccos.length)]);
    const roof = new THREE.Color(terracottas[Math.floor(random() * terracottas.length)]);
    // Counterclockwise in the outward-facing direction.
    for (let i = 0; i < 4; i++) {
      const [a, b] = corners[i], [e, f] = corners[(i + 1) % 4];
      const numBays = Math.max(2, Math.round((i % 2 ? depth : w) / (style === 2 ? 3.65 : 3.05)));
      const origin = Math.floor(random() * 4) / 4;
      facades[style].quad(point(a, 0, b), point(e, 0, f), point(e, height, f), point(a, height, b),
        wall, [origin, 0, origin + numBays / 4, floors / 4]);
      // Each corner enters the hillside individually; the window courses stay level.
      const baseA = sampledHeights[i] - ground - 2.2;
      const baseB = sampledHeights[(i+1)%4] - ground - 2.2;
      trim.quad(point(a, baseA, b), point(e, baseB, f), point(e, 0, f), point(a, 0, b), foundations);
      trim.quad(point(a * 1.015, height - .32, b * 1.025), point(e * 1.015, height - .32, f * 1.025),
        point(e * 1.015, height, f * 1.025), point(a * 1.015, height, b * 1.025), stone);
    }
    if (style === 2) {
      roofSurfaces.quad(point(-W, height, D), point(W, height, D), point(W, height, -D), point(-W, height, -D), stone);
      // Small roof plant rooms and parapets soften the silhouette.
      const size = Math.min(depth, w) * .22;
      const color = new THREE.Color(0xb6ada3);
      trim.quad(point(-size, height, size), point(size, height, size), point(size, height + 1.45, size), point(-size, height + 1.45, size), color);
      trim.quad(point(size, height, size), point(size, height, -size), point(size, height + 1.45, -size), point(size, height + 1.45, size), color);
      trim.quad(point(-size, height + 1.45, size), point(size, height + 1.45, size), point(size, height + 1.45, -size), point(-size, height + 1.45, -size), color);
    } else {
      const ridge = Math.min(D * .42, height * .24), hip = Math.min(W * .78, D * .90);
      const r1 = point(-W + hip, height + ridge, 0), r2 = point(W - hip, height + ridge, 0);
      const a = point(-W - .22, height, D + .24), b = point(W + .22, height, D + .24);
      const c = point(W + .22, height, -D - .24), d = point(-W - .22, height, -D - .24);
      roofSurfaces.quad(a, b, r2, r1, roof);
      roofSurfaces.quad(b, c, r2, r2, roof);
      roofSurfaces.quad(c, d, r1, r2, roof);
      roofSurfaces.quad(d, a, r1, r1, roof);
    }
  }

  for (const [row, inland] of [77, 122, 177, 243, 325, 435].entries()) {
    let x = -2100;
    while (x < 2110) {
      const width = 13 + random() * (row < 2 ? 25 : 15), depth = 12 + random() * 7;
      const cx = x + width * .5;
      // The residence is one address on the front row. Keep realistic gaps beside
      // it and a courtyard behind, so that the upper floors look into the town.
      if (!(Math.abs(cx) < width * .5 + 24 && row < 2)) {
        const style = Math.floor(random() * 3);
        const floors = Math.max(2, Math.round((row < 2 ? 5 : 3) + random() * (row < 3 ? 4 : 2) - (Math.abs(cx) > 880 ? 2 : 0)));
        building(cx, inland + random() * (row < 2 ? 3 : 13), width, depth, floors, style);
      }
      x += width + 3.5 + random() * (row < 2 ? 9 : 24);
    }
  }
  const crownGeo = new THREE.IcosahedronGeometry(1,0);
  const color = new THREE.Color(), dummy = new THREE.Object3D();
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({roughness:1}), groves.length);
  crowns.name='Pines_and_cypress_on_the_hillside';
  const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(.8,1,1,5,1,true),
    new THREE.MeshStandardMaterial({color:0x6b5e50,roughness:1}),groves.length);
  stems.name='Hillside_trunks';
  for(const [i,[x,z,height,spire]] of groves.entries()){
    const breadth=height*(spire ? .19 : .57),depth=height*(spire ? .52 : .31);
    const soil=groundAt(x,z), stemHeight=height-depth;
    dummy.position.set(x,soil+stemHeight*.5-.18,z);
    dummy.rotation.set(0,0,0);dummy.scale.set(height*.030,stemHeight+.5,height*.030);dummy.updateMatrix();
    stems.setMatrixAt(i,dummy.matrix);
    dummy.position.set(x,soil+height-depth*.8,z);
    dummy.rotation.set(random()*.11,random()*Math.PI,random()*.13);
    dummy.scale.set(breadth,depth,breadth*(.75+random()*.36));dummy.updateMatrix();
    crowns.setMatrixAt(i,dummy.matrix);
    color.setHex(spire ? 0x334d3c : 0x4e644c).multiplyScalar(.76+.38*random());
    crowns.setColorAt(i,color);
  }
  crowns.receiveShadow=true;
  group.add(crowns,stems);
  const solid = new THREE.MeshStandardMaterial({roughness: .89, vertexColors: true, side: THREE.DoubleSide});
  roofSurfaces.make('Terracotta_roofscapes', solid, group);
  trim.make('Cornices_and_parapets', solid, group);
  for (let style = 0; style < 3; style++) {
    facades[style].make('Seafront_streets_' + style, new THREE.MeshStandardMaterial({
      vertexColors: true, map: facadeTexture(style, random), roughness: .88,
    }), group);
  }
}
