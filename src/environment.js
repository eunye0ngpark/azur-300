import * as THREE from 'three';
import { staticBatch } from './batching.js';
import { addCoastalTown, shoreZ, shoreSlope } from './coast-town.js';
import { makeSky, makeWater, NOISE } from './coast-water.js';

export function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function coastSurface(material, kind) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vBeach;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBeach = (modelMatrix * vec4(transformed,1.)).xyz;`);
    shader.fragmentShader = 'varying vec3 vBeach;\n' + NOISE + shader.fragmentShader;
    const detail = kind === 'shingle' ? `
      vec2 p = vBeach.xz;
      float patches = coastFbm(p * .13);
      float grain = coastNoise(p * vec2(14., 20.));
      float filterWeight = 1. / (1. + max(length(dFdx(p)), length(dFdy(p))) * 14.);
      float wet = (1. - smoothstep(-2.40, -1.73, vBeach.y + (patches - .48) * .32));
      diffuseColor.rgb *= .75 + .39 * patches + (grain - .5) * .58 * filterWeight;
      diffuseColor.rgb *= mix(vec3(1.), vec3(.61,.64,.66), wet);
    ` : kind === 'paving' ? `
      vec2 p = vBeach.xz;
      float aggregate = coastNoise(p * 4.);
      float grout = min(abs(fract(p.x / 2.45) - .50), abs(fract(p.y / 2.45) - .5));
      diffuseColor.rgb *= ( .94 + .1 * aggregate ) * mix(.84, 1., smoothstep(.001, .017 + fwidth(grout), grout));
    ` : `
      vec2 p = vBeach.xz;
      diffuseColor.rgb *= .79 + .21 * coastNoise(p*.07) + .15*coastNoise(p*.76);
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + detail);
  };
  material.customProgramCacheKey = () => 'nice-coastal-' + kind;
}

function palmCrown(random) {
  const positions = [], idx = [];
  const triangle = (a,b,c) => {
    const n=positions.length/3;
    positions.push(...a,...b,...c); idx.push(n,n+1,n+2);
  };
  for (let j = 0; j < 15; j++) {
    const young = j > 9;
    const angle = j * 2.39996 + random() * .24, cs = Math.cos(angle), sn = Math.sin(angle);
    const len = young ? 1.5 + random()*.5 : 2.2 + random() * .68;
    const droop = young ? .33 : 1.2 + random()*.5;
    function point(t, side, down = 0) {
      const r = t * len;
      return [r*cs-side*sn, t*(young ? 2.4 : 2.1) - t*t*(2.0+droop) + down, r*sn+side*cs];
    }
    for (let k = 1; k < 14; k++) {
      const t=k/14, next=(k+1)/14;
      const width=(young ? .32 : .54) * Math.sin(Math.PI*t) ** .48;
      triangle(point(t-.05,-.025), point(next,.015), point(t-.05,.025));
      for(const side of [-1,1]){
        triangle(point(t-.06,side*.01), point(t+.078,width*side,-width*.40), point(t+.028,side*.015));
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(idx);geo.computeVertexNormals();
  return geo;
}

export function createEnvironment(scene) {
  const random = mulberry32(43006);
  const group = new THREE.Group(); group.name = 'Cote_d_Azur_environment'; scene.add(group);
  const uniforms = {uTime: {value:0}, uGolden: {value:0}, uSun:{value:new THREE.Vector3(-65,80,110).normalize()}};
  const sky = makeSky(uniforms), sea = makeWater(uniforms);
  group.add(sky,sea);
  const standard = (color, roughness = .81, extra = {}) => new THREE.MeshStandardMaterial({color, roughness, ...extra});
  const mats = {
    shingle:standard(0xbab7ad,.92), white:standard(0xe5dfd2,.76), roof:standard(0xada99e,.87),
    trunk:standard(0x716454), leaf:standard(0x546d45,.94,{side:THREE.DoubleSide}),
    glass:standard(0x607d85,.25,{metalness:.22}), hull:standard(0x284554,.42),
    sail:standard(0xe8e5d9,.85,{side:THREE.DoubleSide}),
    asphalt:standard(0x656568,.95), promenade:standard(0xbdb9b1,.89),
    roadLine:standard(0xd8d4c7), bronze:standard(0x646460,.47,{metalness:.45}),
    terracotta:standard(0xb2806e,.83), blue:standard(0x647e90,.88),
  };
  coastSurface(mats.shingle,'shingle');coastSurface(mats.promenade,'paving');coastSurface(mats.asphalt,'road');
  addCoastalTown(group, random);
  function strip(left,right,yLeft,yRight,material) {
    const positions=[],indices=[];
    const edges = [-2740];
    for(let x=-2736;x<2740;x+=6)edges.push(x);
    edges.push(2740);
    for(const x of edges){
      const shore=shoreZ(x);
      positions.push(x,yLeft,shore+left,x,yRight,shore+right);
    }
    for(let i=0;i<edges.length-1;i++){
      const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;group.add(mesh);
  }
  // Ordered from street to sea, with a proper quay drop and a gently sloping beach.
  strip(-61,-58,.035,.035,mats.promenade);
  strip(-58,-45,.052,.052,mats.asphalt);
  strip(-45,-32,.12,.12,mats.promenade);
  strip(-32,-31.75,.12,-.66,mats.white);
  strip(-31.75,-10,-.66,-1.65,mats.shingle);
  strip(-10,1.5,-1.65,-2.64,mats.shingle);
  strip(-57.7,-57.54,.064,.064,mats.roadLine);
  strip(-45.45,-45.3,.064,.064,mats.roadLine);
  strip(-51.58,-51.43,.064,.064,mats.roadLine);
  const cube=new THREE.BoxGeometry(1,1,1);
  function box(parent,material,x,y,z,w,h,d){
    const m=new THREE.Mesh(cube,material);m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;
  }
  const place=(x,offset)=>{
    const g=new THREE.Group();
    g.position.set(x,0,shoreZ(x)+offset);g.rotation.y=-Math.atan(shoreSlope(x));group.add(g);return g;
  };
  for(const lane of [-54.75,-48.25])for(let x=-500;x<505;x+=11){
    const laneMark=box(group,mats.roadLine,x,.067,shoreZ(x)+lane,3.8,.008,.11);
    laneMark.rotation.y=-Math.atan(shoreSlope(x));
  }
  for(let x=-3.5;x<4;x+=1.1)box(group,mats.roadLine,x,.069,shoreZ(x)-51.5,.52,.012,10);
  const cars=[mats.white,mats.blue,mats.hull,mats.terracotta,mats.glass];
  const wheelShape=new THREE.CylinderGeometry(.31,.31,.18,10), tyre=standard(0x343536,.91);
  for(let i=0;i<38;i++){
    const x=-435+i*23+random()*13, lane=[-56.1,-52.9,-50.0,-46.9][i%4];
    const g=place(x,lane),body=cars[i%5]; if(i%4<2)g.rotation.y+=Math.PI;
    box(g,body,0,.61,0,3.96,.60,1.70);
    box(g,mats.glass,-.11,1.12,0,2.14,.48,1.48);
    box(g,body,-.15,1.39,0,1.77,.08,1.41);
    for(const dx of [-1.22,1.20])for(const dz of [-.82,.82]){
      const wheel=new THREE.Mesh(wheelShape,tyre);wheel.position.set(dx,.36,dz);wheel.rotation.x=Math.PI/2;g.add(wheel);
    }
  }
  const fronds=[palmCrown(random),palmCrown(random),palmCrown(random)];
  const trunk=new THREE.CylinderGeometry(.14,.24,1,9), palmBases=[];
  for(let x=-590;x<=590;x+=12.8){
    const offset=-42.8+random()*.45,z=shoreZ(x)+offset;
    const g=place(x,offset),h=4.9+random()*1.9;
    const stem=new THREE.Mesh(trunk,mats.trunk);stem.scale.y=h;stem.position.y=h/2+.12;g.add(stem);
    const top=new THREE.Mesh(fronds[Math.floor(random()*3)],mats.leaf);top.position.y=h+.06;top.rotation.y=random()*Math.PI*2;g.add(top);
    palmBases.push([x,.136,z,2.8,2.8]);
  }
  const poleGeo=new THREE.CylinderGeometry(.055,.085,5.65,8),bulbGeo=new THREE.SphereGeometry(.23,10,7);
  for(let x=-475;x<475;x+=28){
    const z=shoreZ(x)-44.3;
    const pole=new THREE.Mesh(poleGeo,mats.bronze);pole.position.set(x,2.95,z);group.add(pole);
    const globe=new THREE.Mesh(bulbGeo,mats.white);globe.position.set(x,5.87,z);group.add(globe);
  }
  const chairGeo=new THREE.ConeGeometry(1.23,.46,12), sandShade=[];
  const shingleY=off=>off<-10?-.66-(off+31.75)*.99/21.75:-1.65-(off+10)*.99/11.5;
  // Beach clubs form small groups with open stretches of public beach between.
  for(const center of [-182,-68,78,194,348]){
    const rows=2+Math.floor(random()*2);
    for(let row=0;row<rows;row++)for(let k=0;k<5;k++){
      if(random()<.17)continue;
      const x=center+5.0*k+row*.35+random()*.6,off=-22.5+row*4.7+random()*.4;
      const g=place(x,off),y=shingleY(off);g.position.y=y;g.rotation.y+=random()*.18;
      const canopy=new THREE.Mesh(chairGeo, k%4===2?mats.blue:mats.white);
      canopy.position.y=1.82;g.add(canopy);box(g,mats.bronze,0,.82,0,.055,1.64,.055);
      box(g,mats.white,1.1,.19,.18,.59,.13,1.69);box(g,mats.blue,1.1,.34,-.43,.59,.37,.12).rotation.x=-.33;
      sandShade.push([x,y+.04,shoreZ(x)+off,2.8,2.8]);
    }
  }
  // Small-scale contact darkening visible even beyond the building shadow map.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const ctx=shadowCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(32,32,1,32,32,32);
  gradient.addColorStop(0,'rgba(40,37,34,.30)');gradient.addColorStop(.43,'rgba(43,40,38,.14)');gradient.addColorStop(1,'rgba(43,40,38,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const blob=new THREE.CanvasTexture(shadowCanvas);blob.colorSpace=THREE.SRGBColorSpace;
  const dots=[...palmBases,...sandShade],shade=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:blob,transparent:true,depthWrite:false}),dots.length);
  const dummy=new THREE.Object3D();
  for(let i=0;i<dots.length;i++){
    const [x,y,z,w,d]=dots[i];dummy.position.set(x,y,z);dummy.rotation.x=-Math.PI/2+(i<palmBases.length?0:.05);dummy.scale.set(w,d,1);dummy.updateMatrix();shade.setMatrixAt(i,dummy.matrix);
  }
  group.add(shade);
  const sail=new THREE.BufferGeometry();
  sail.setAttribute('position',new THREE.Float32BufferAttribute([0,.8,0,0,5.7,0,0,1.1,2.5, .02,1.1,-.2,.02,4.8,-.2,.02,1.0,-2.6],3));
  sail.computeVertexNormals();
  const hullGeo=new THREE.SphereGeometry(1,18,9);
  for(let i=0;i<7;i++){
    const x=-560+random()*940,offset=105+random()*480;
    const yacht=new THREE.Group();yacht.position.set(x,-2.50,shoreZ(x)+offset);yacht.rotation.y=random()*Math.PI;group.add(yacht);
    const hull=new THREE.Mesh(hullGeo,mats.white);hull.scale.set(1.14,.42,3.65);hull.position.y=.13;yacht.add(hull);
    box(yacht,mats.white,0,.54,-.24,1.35,.32,1.90);
    box(yacht,mats.glass,0,.62,-.23,1.38,.14,1.40);
    box(yacht,mats.bronze,0,2.95,0,.043,5.70,.043);yacht.add(new THREE.Mesh(sail,mats.sail));
  }
  function towerSection(name,floors,startY){
    const section=new THREE.Group();section.name=name;
    const height=floors*2.8,core=new THREE.Mesh(new THREE.BoxGeometry(24.7,height,11.7),mats.white);core.position.set(0,startY+height/2,-6);section.add(core);
    for(let f=0;f<floors;f++){
      const y=startY+f*2.8,slab=new THREE.Mesh(new THREE.BoxGeometry(25.25,.16,12.25),mats.roof);slab.position.set(0,y+2.70,-6);section.add(slab);
      for(let i=0;i<10;i++)for(const z of [-12.04,.04]){
        const win=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.72,.04),mats.glass);win.position.set(-11.25+i*2.5,y+1.38,z);section.add(win);
      }
      for(const x of [-12.38,12.38])for(let i=0;i<4;i++){
        const win=new THREE.Mesh(new THREE.BoxGeometry(.04,1.72,1.65),mats.glass);win.position.set(x,y+1.38,-10.25+i*2.55);section.add(win);
      }
      if(f>0 || startY>0){
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(25.10,.18,1.26),mats.white);
        balcony.position.set(0,y+.035,.68); section.add(balcony);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(24.85,.055,.065),mats.bronze);
        rail.position.set(0,y+1.10,1.25); section.add(rail);
        const fascia = new THREE.Mesh(new THREE.BoxGeometry(25,.37,.065),mats.white);
        fascia.position.set(0,y+.30,1.25); section.add(fascia);
        for(let post=-12.25; post<12.4; post+=2.45){
          const upright=new THREE.Mesh(new THREE.BoxGeometry(.046,.98,.055),mats.bronze);
          upright.position.set(post,y+.61,1.25);section.add(upright);
        }
      }
    }
    for(const x of [-12.48,0,12.48]){
      const fin=new THREE.Mesh(new THREE.BoxGeometry(.12,height,.20),mats.bronze);fin.position.set(x,startY+height/2,.13);section.add(fin);
    }
    section.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    group.add(section);return section;
  }
  const tower=towerSection('Residential_tower_below',16,0);
  const upperTower=towerSection('Residential_tower_above_18_20',3,48.4);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(25.6,.28,12.6),mats.roof);roof.position.set(0,56.9,-6);upperTower.add(roof);
  const plaza=new THREE.Mesh(new THREE.BoxGeometry(28,.14,8.1),mats.promenade);plaza.position.set(0,.10,4.0);group.add(plaza);
  const lobby=new THREE.Mesh(new THREE.BoxGeometry(8.4,2.5,.08),mats.glass);lobby.position.set(0,1.4,.14);group.add(lobby);
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(7.2,.18,2.8),mats.bronze);canopy.position.set(0,3.15,1.45);group.add(canopy);
  tower.userData={buildingFloors:20,apartmentFloor:17,apartmentElevation:45};
  const batchInfo=staticBatch(group,{animatedNodes:[sky,sea,tower,upperTower],cellSize:90});
  group.userData.batchInfo=batchInfo;
  return {group,sky,sea,uniforms,update(t){uniforms.uTime.value=t;},setGolden(v){uniforms.uGolden.value=v;}};
}
