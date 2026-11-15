import * as THREE from 'three';
import { staticBatch } from './batching.js';

export function mulberry32(a){return function(){a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const rand=mulberry32(43006);
const SKY_VERT=`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const NOISE=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+17.2;a*=.5;}return v;}`;

function patchGround(m,kind){
  m.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vGroundWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vGroundWorld=(modelMatrix*vec4(transformed,1.0)).xyz;`);
    shader.fragmentShader='varying vec3 vGroundWorld;\n'+NOISE+'\n'+shader.fragmentShader;
    const detail=kind==='sand'?`
      float dune=fbm(vGroundWorld.xz*.075);
      float grain=noise(vGroundWorld.xz*21.0);
      float ripple=sin(vGroundWorld.x*.75+fbm(vGroundWorld.xz*.22)*5.0);
      diffuseColor.rgb*=.91+.13*dune+.035*grain+.018*ripple;`:kind==='wet'?`
      float grain=noise(vGroundWorld.xz*24.0);
      float tide=fbm(vGroundWorld.xz*.16);
      diffuseColor.rgb*=.80+.14*tide+.035*grain;`:kind==='shallow'?`
      vec2 p=vGroundWorld.xz;
      float ca=pow(abs(sin(p.x*.82+fbm(p*.21)*4.0)*sin(p.y*.76-fbm(p*.18)*3.0)),7.0);
      diffuseColor.rgb+=vec3(.08,.15,.13)*ca;`:`
      float macro=fbm(vGroundWorld.xz*.045);
      float detail=noise(vGroundWorld.xz*.52);
      diffuseColor.rgb*=.76+.28*macro+.10*detail;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${detail}`);
  };
  m.customProgramCacheKey=()=>`azur-coast-${kind}`;
}

export function createEnvironment(scene){
  const group=new THREE.Group();group.name='Cote_d_Azur_environment';scene.add(group);
  const uniforms={uTime:{value:0},uGolden:{value:0},uSun:{value:new THREE.Vector3(-.45,.62,.64).normalize()}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,64,32),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms,vertexShader:SKY_VERT,
    fragmentShader:`varying vec3 vWorld;uniform float uTime,uGolden;uniform vec3 uSun;${NOISE}
    void main(){vec3 d=normalize(vWorld-cameraPosition);float elevation=clamp(d.y,0.,1.);
      vec3 zen=mix(vec3(.115,.40,.65),vec3(.22,.29,.47),uGolden);
      vec3 hor=mix(vec3(.70,.87,.92),vec3(.96,.62,.37),uGolden);
      vec3 col=mix(hor,zen,pow(elevation,.46));
      if(d.y<0.)col=mix(hor,vec3(.25,.56,.63),clamp(-d.y*3.,0.,1.));
      float sun=max(dot(d,uSun),0.);
      col+=vec3(1.,.74,.43)*pow(sun,1100.)*5.5;
      col+=vec3(1.,.73,.48)*pow(sun,22.)*.19;
      vec2 cp=d.xz/max(.12,d.y+.24)*1.7;
      float clouds=smoothstep(.56,.75,fbm(cp+vec2(uTime*.0015,0.)))*smoothstep(.02,.18,d.y)*(1.-smoothstep(.52,.85,d.y));
      vec2 cirrusUV=vec2(cp.x*.38+cp.y*.12,cp.y*2.8);
      float cirrus=smoothstep(.60,.78,fbm(cirrusUV*2.1+vec2(3.7,uTime*.0007)))*smoothstep(.16,.42,d.y)*(1.-smoothstep(.72,.95,d.y));
      col=mix(col,mix(vec3(.95,.97,.96),vec3(1.,.74,.53),uGolden),clouds*.58+cirrus*.24);
      col=mix(col,hor,pow(1.-elevation,12.)*.22);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>}`
  }));sky.name='Procedural_Mediterranean_sky';sky.renderOrder=-1000;sky.material.depthTest=false;sky.frustumCulled=false;group.add(sky);

  // Three spatial frequencies drive colour, normal and specular response independently.
  // The water begins at the real shoreline instead of continuing beneath the
  // city. This removes the land/sea depth conflict at its geometric source.
  const seaXs=[-2200,-1600,-1100,-900,-800];
  for(let x=-720;x<=720;x+=6)seaXs.push(x);
  seaXs.push(800,900,1100,1600,2200);
  const seaVerts=[],seaIdx=[],seaBands=8;
  for(let j=0;j<=seaBands;j++)for(const x of seaXs){
    const cx=THREE.MathUtils.clamp(x,-720,720),inner=shoreZ(cx)+2;
    seaVerts.push(x,0,THREE.MathUtils.lerp(inner,2200,j/seaBands));
  }
  for(let j=0;j<seaBands;j++)for(let i=0;i<seaXs.length-1;i++){
    const a=j*seaXs.length+i,b=a+seaXs.length;seaIdx.push(a,b,a+1,b,b+1,a+1);
  }
  const seaGeometry=new THREE.BufferGeometry();
  seaGeometry.setAttribute('position',new THREE.Float32BufferAttribute(seaVerts,3));seaGeometry.setIndex(seaIdx);seaGeometry.computeVertexNormals();
  const sea=new THREE.Mesh(seaGeometry,new THREE.ShaderMaterial({
    uniforms,vertexShader:SKY_VERT,
    fragmentShader:`varying vec3 vWorld;uniform float uTime,uGolden;uniform vec3 uSun;${NOISE}
    void main(){vec3 V=normalize(cameraPosition-vWorld);vec2 p=vWorld.xz;float t=uTime;
      float sa=dot(p,vec2(.024,.016))+t*.24;
      float sb=dot(p,vec2(-.017,.031))-t*.19;
      float swell=sin(sa)*.62+sin(sb)*.38;
      float ma=dot(p,vec2(.21,-.13))+swell*.72+fbm(p*.045)*3.1+t*.66;
      float mb=dot(p,vec2(-.16,.27))-swell*.44-fbm(p*.052)*2.7-t*.51;
      float mid=sin(ma)*.55+sin(mb)*.45;
      float fine=fbm(p*.48+vec2(t*.012,-t*.009));
      float micro=noise(p*1.35+vec2(-t*.025,t*.018));
      float dist=length(vWorld.xz-cameraPosition.xz);
      // Filter sub-pixel wave detail with distance. Unfiltered high-frequency normals
      // were the source of the opening-shot specular shimmer.
      float detailFade=1.-smoothstep(75.,520.,dist);
      float dx=.024*cos(sa)-.017*cos(sb)+.060*cos(ma)-.040*cos(mb);
      float dz=.016*cos(sa)+.031*cos(sb)-.035*cos(ma)+.065*cos(mb);
      vec3 N=normalize(vec3(-dx*1.32-(fine-.5)*.085*detailFade,1.,-dz*1.32-(micro-.5)*.060*detailFade));
      vec3 deep=mix(vec3(.004,.155,.29),vec3(.045,.19,.29),uGolden);
      vec3 azure=mix(vec3(.012,.34,.49),vec3(.12,.29,.36),uGolden);
      vec3 farC=mix(vec3(.035,.38,.58),vec3(.31,.34,.42),uGolden);
      vec3 col=mix(deep,azure,clamp(.46+swell*.055,0.,1.));
      col=mix(col,farC,clamp(dist/1250.,0.,.72));
      col+=vec3(.025,.090,.085)*(mid*.10+(fine-.5)*.62*detailFade+(micro-.5)*.12*detailFade);
      float fres=pow(1.-max(dot(N,V),0.),3.);
      col=mix(col,mix(vec3(.28,.57,.68),vec3(.63,.40,.29),uGolden),fres*.12);
      vec3 H=normalize(V+uSun);
      // Use a stable geometric up-normal for the sun sheen. Animated micro-normals
      // made the whole reflection band pump between adjacent frames during the dolly.
      // The water still moves through colour and low-frequency swell, not flashing glints.
      vec3 sheenN=vec3(0.,1.,0.);
      float glint=pow(max(dot(sheenN,H),0.),58.)*.28;
      col+=mix(vec3(.77,.94,1.),vec3(1.,.65,.30),uGolden)*glint;
      float fog=smoothstep(680.,1780.,dist);
      col=mix(col,mix(vec3(.65,.82,.85),vec3(.82,.56,.39),uGolden),fog);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>}`
  }));sea.position.y=-.12;sea.name='Azure_sea_three_scale_shader';
  // Draw after opaque architecture so early depth rejection avoids shading water
  // hidden by the tower. No water geometry exists below the beach or roadway.
  sea.renderOrder=900;sea.material.depthWrite=false;group.add(sea);

  const mats={
    green:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:true,emissive:0x263a29,emissiveIntensity:.16}),
    sand:new THREE.MeshStandardMaterial({color:0xe3c28c,roughness:.94,side:THREE.DoubleSide}),
    wet:new THREE.MeshStandardMaterial({color:0xa8916b,roughness:.48,metalness:.04,side:THREE.DoubleSide}),
    shallow:new THREE.MeshStandardMaterial({color:0x3baaa5,roughness:.22,metalness:.08,transparent:true,opacity:.64,depthWrite:false,vertexColors:true}),
    foam:new THREE.MeshBasicMaterial({color:0xe8f3ec,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide}),
    foam2:new THREE.MeshBasicMaterial({color:0xd9eeea,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}),
    foam3:new THREE.MeshBasicMaterial({color:0xc8e7e4,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide}),
    white:new THREE.MeshStandardMaterial({color:0xe9e5da,roughness:.72}),
    roof:new THREE.MeshStandardMaterial({color:0xb9ad99,roughness:.9}),
    villaRoof:new THREE.MeshStandardMaterial({color:0xb98769,roughness:.88}),
    trunk:new THREE.MeshStandardMaterial({color:0x745538,roughness:1}),
    leaf:new THREE.MeshStandardMaterial({color:0x315e47,roughness:.95,side:THREE.DoubleSide}),
    glass:new THREE.MeshStandardMaterial({color:0x668b96,roughness:.24,metalness:.18}),
    hull:new THREE.MeshStandardMaterial({color:0x153f52,roughness:.32,metalness:.12}),
    sail:new THREE.MeshStandardMaterial({color:0xf1eee2,roughness:.82,side:THREE.DoubleSide}),
    land:new THREE.MeshStandardMaterial({color:0xbab3a3,roughness:.96}),
    asphalt:new THREE.MeshStandardMaterial({color:0x444b4d,roughness:.94}),
    promenade:new THREE.MeshStandardMaterial({color:0xcac2b1,roughness:.88}),
    roadLine:new THREE.MeshStandardMaterial({color:0xf0ead8,roughness:.78}),
    bronze:new THREE.MeshStandardMaterial({color:0x7c684c,roughness:.38,metalness:.55}),
    terracotta:new THREE.MeshStandardMaterial({color:0xb97452,roughness:.82}),
  };
  patchGround(mats.sand,'sand');patchGround(mats.wet,'wet');patchGround(mats.shallow,'shallow');patchGround(mats.green,'terrain');

  function coastalFactor(a,seed){return 1+.040*Math.sin(a*3+seed)+.025*Math.sin(a*7-seed*.7)+.012*Math.sin(a*13+seed*1.3);}
  function coastRing(cx,cz,rx,rz,inner,outer,y,material,seed){
    const seg=160,bands=material===mats.shallow?10:4,verts=[],uv=[],idx=[],colors=[];
    for(let j=0;j<=bands;j++){
      const r=inner+(outer-inner)*j/bands;
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2,f=coastalFactor(a,seed),rr=r*f;
        verts.push(cx+Math.cos(a)*rx*rr,y+Math.sin(a*5+seed)*.003,cz+Math.sin(a)*rz*rr);
        uv.push(i/seg,j/bands);
        if(material===mats.shallow){const alpha=Math.pow(1-j/bands,.72);colors.push(1,1,1,alpha);}
      }
    }
    for(let j=0;j<bands;j++)for(let i=0;i<seg;i++){
      const a=j*(seg+1)+i,b=a+seg+1;idx.push(a,a+1,b,b,a+1,b+1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    if(colors.length)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.setIndex(idx);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function foamRibbon(cx,cz,rx,rz,r,y,material,seed,band){
    const verts=[],idx=[],seg=220;
    for(let i=0;i<seg;i++){
      const a=i/seg*Math.PI*2,a2=(i+1)/seg*Math.PI*2;
      const broken=Math.sin(a*17+seed)+Math.sin(a*31-seed*.4)+Math.sin(a*7+band);
      if(broken<.15)continue;
      for(const [ang,rr] of [[a,r-.004],[a,r+.004],[a2,r-.004],[a2,r+.004]]){
        const f=coastalFactor(ang,seed),wave=.004*Math.sin(ang*23+band);
        verts.push(cx+Math.cos(ang)*rx*(rr+wave)*f,y,cz+Math.sin(ang)*rz*(rr+wave)*f);
      }
      const n=verts.length/3-4;idx.push(n,n+2,n+1,n+1,n+2,n+3);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.renderOrder=3;group.add(mesh);
  }
  function headland(cx,cz,rx,rz,h,light,seed){
    coastRing(cx,cz,rx,rz,1.11,1.38,-.074,mats.shallow,seed);
    coastRing(cx,cz,rx,rz,1.06,1.15,.018,mats.wet,seed);
    coastRing(cx,cz,rx,rz,.995,1.09,.072,mats.sand,seed);
    foamRibbon(cx,cz,rx,rz,1.105,-.042,mats.foam,seed,0);
    foamRibbon(cx,cz,rx,rz,1.175,-.037,mats.foam2,seed,1);
    foamRibbon(cx,cz,rx,rz,1.245,-.032,mats.foam3,seed,2);
    const seg=160,rings=32,verts=[],colors=[],idx=[];
    const base=new THREE.Color(light?0x8b9d70:0x708b64);
    for(let j=0;j<=rings;j++){
      const r=j/rings;
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2,f=coastalFactor(a,seed),height=Math.pow(Math.max(0,Math.cos(r*Math.PI*.5)),1.5);
        verts.push(Math.cos(a)*r*f,height,Math.sin(a)*r*f);
        const c=base.clone().multiplyScalar(.91+.15*height+.055*Math.sin(a*6+r*17+seed));colors.push(c.r,c.g,c.b);
      }
    }
    for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){
      const a=j*(seg+1)+i,b=a+seg+1;idx.push(a,a+1,b,b,a+1,b+1);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();
    const hill=new THREE.Mesh(geo,mats.green);hill.scale.set(rx,h,rz);hill.position.set(cx,.06,cz);hill.receiveShadow=true;group.add(hill);
  }
  function palm(x,z,s=1,y=.08){
    const g=new THREE.Group();g.position.set(x,y,z);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12*s,.20*s,5.2*s,7),mats.trunk);trunk.position.y=2.6*s;g.add(trunk);
    for(let j=0;j<7;j++){
      const a=j*Math.PI*2/7,leaf=new THREE.Mesh(new THREE.ConeGeometry(.48*s,3.4*s,5),mats.leaf);
      leaf.position.set(Math.cos(a)*1.15*s,5.25*s,Math.sin(a)*1.15*s);leaf.rotation.z=Math.PI/2.7;leaf.rotation.y=-a;g.add(leaf);
    }
    group.add(g);
  }
  // A continuous Promenade des Anglais-inspired edge: land, road, promenade,
  // golden beach, wet sand, shallow water and three broken lines of surf.
  function shoreZ(x){return 96+.00042*x*x+3*Math.sin(x*.008);}
  const shoreSlope=x=>.00084*x+.024*Math.cos(x*.008);
  function coastalStrip(a,b,ya,yb,material,bands=1){
    const seg=240,verts=[],idx=[],colors=[];
    for(let j=0;j<=bands;j++)for(let i=0;i<=seg;i++){
      const x=-720+1440*i/seg,v=j/bands;
      verts.push(x,THREE.MathUtils.lerp(ya,yb,v),shoreZ(x)+THREE.MathUtils.lerp(a,b,v));
      if(material===mats.shallow)colors.push(1,1,1,Math.pow(1-v,.74));
    }
    for(let j=0;j<bands;j++)for(let i=0;i<seg;i++){
      const a=j*(seg+1)+i,b=a+seg+1;idx.push(a,b,a+1,b,b+1,a+1);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    if(colors.length)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
    g.setIndex(idx);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function surfLine(offset,width,y,material,band){
    const seg=500,verts=[],idx=[];
    for(let i=0;i<seg;i++){
      const x=-650+1300*i/seg,x2=-650+1300*(i+1)/seg;
      if(Math.sin(x*.31+band*2)+Math.sin(x*.79-band)<-.25)continue;
      for(const [xx,side] of [[x,-1],[x,1],[x2,-1],[x2,1]]){
        const wave=.42*Math.sin(xx*.16+band)+.18*Math.sin(xx*.53);
        verts.push(xx,y,shoreZ(xx)+offset+wave+side*width*.5);
      }
      const n=verts.length/3-4;idx.push(n,n+1,n+2,n+1,n+3,n+2);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);mesh.renderOrder=3;group.add(mesh);
  }
  coastalStrip(-520,-88,.02,.02,mats.land,2);
  coastalStrip(-88,-76,.065,.065,mats.asphalt,2);
  coastalStrip(-76,-68,.09,.09,mats.promenade,2);
  coastalStrip(-68,-7,.12,-.025,mats.sand,20);
  coastalStrip(-7,2,-.025,-.065,mats.wet,4);
  coastalStrip(2,32,-.065,-.09,mats.shallow,12);
  surfLine(1.5,.95,-.035,mats.foam,0);
  surfLine(5.5,.68,-.032,mats.foam2,1);
  surfLine(10.5,.48,-.029,mats.foam3,2);
  coastalStrip(-87.55,-87.38,.078,.078,mats.roadLine);
  coastalStrip(-76.62,-76.45,.078,.078,mats.roadLine);
  coastalStrip(-82.07,-81.93,.079,.079,mats.roadLine);
  for(const lane of [-85,-79])for(let x=-420;x<420;x+=9){
    const dash=new THREE.Mesh(new THREE.BoxGeometry(4.2,.012,.13),mats.roadLine);
    dash.position.set(x,.085,shoreZ(x)+lane);dash.rotation.y=-Math.atan(shoreSlope(x));group.add(dash);
  }
  for(let x=-4.8;x<=4.8;x+=1.2){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.62,.014,9.2),mats.roadLine);
    stripe.position.set(x,.088,shoreZ(x)-82);group.add(stripe);
  }
  const carColors=[mats.white,mats.glass,mats.terracotta,mats.hull];
  for(let i=0;i<22;i++){
    const x=-330+i*31+rand()*8,lane=[-85.7,-83.3,-80.7,-78.3][i%4];
    const car=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(3.8,.85,1.65),carColors[i%carColors.length]);
    body.position.y=.62;car.add(body);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.95,.62,1.48),i%3===0?mats.glass:carColors[i%carColors.length]);cabin.position.set(-.25,1.28,0);car.add(cabin);
    car.position.set(x,.08,shoreZ(x)+lane);car.rotation.y=-Math.atan(shoreSlope(x));group.add(car);
  }
  for(let x=-378;x<=378;x+=18)palm(x,shoreZ(x)-72,.82+rand()*.18,.10);
  for(let x=-360;x<=360;x+=36){
    const z=shoreZ(x)-74.5,pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.08,5.6,7),mats.bronze);pole.position.set(x,2.9,z);group.add(pole);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,10,6),mats.white);lamp.position.set(x,5.72,z);group.add(lamp);
  }
  const beachHeight=off=>off<=-7?.12+(off+68)/61*(-.145):-.025+(off+7)/9*(-.04);
  for(let i=0;i<46;i++){
    const x=-360+rand()*720,off=-56+rand()*41,z=shoreZ(x)+off,y=beachHeight(off);
    const umbrella=new THREE.Group(),pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1.55,6),mats.bronze);pole.position.y=.775;umbrella.add(pole);
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(1.35,.42,12),i%4===0?mats.terracotta:(i%3===0?mats.hull:mats.white));canopy.position.y=1.62;umbrella.add(canopy);
    const bed=new THREE.Mesh(new THREE.BoxGeometry(.68,.13,1.85),mats.white);bed.position.set(1.6,.18,0);umbrella.add(bed);
    umbrella.position.set(x,y,z);umbrella.rotation.y=rand()*Math.PI;group.add(umbrella);
  }

  const sailGeo=new THREE.BufferGeometry();
  sailGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,.9,0,0,5.7,.2,0,.9,3.0],3));sailGeo.setIndex([0,1,2]);sailGeo.computeVertexNormals();
  for(let i=0;i<9;i++){
    const yacht=new THREE.Group();
    const hull=new THREE.Mesh(new THREE.SphereGeometry(1,20,10),mats.white);hull.scale.set(2.0,.38,5.2);hull.position.y=.22;yacht.add(hull);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(3.5,.16,5.8),mats.hull);stripe.position.set(0,.22,.1);yacht.add(stripe);
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(2.2,.7,2.6),mats.white);cabin.position.set(0,.75,-.3);yacht.add(cabin);
    const windows=new THREE.Mesh(new THREE.BoxGeometry(2.24,.28,1.8),mats.glass);windows.position.set(0,.85,-.35);yacht.add(windows);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,6,6),mats.roof);mast.position.set(0,3.4,.2);yacht.add(mast);
    const sail=new THREE.Mesh(sailGeo,mats.sail);sail.position.set(.03,.2,.1);yacht.add(sail);
    yacht.position.set((rand()-.5)*360,0,150+rand()*250);yacht.rotation.y=rand()*Math.PI;const s=.55+rand()*.65;yacht.scale.setScalar(s);group.add(yacht);
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
      const rail=new THREE.Mesh(new THREE.BoxGeometry(25.1,.065,.07),mats.bronze);rail.position.set(0,y+.68,.17);section.add(rail);
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
  const batchInfo=staticBatch(group,{animatedNodes:[sky,sea,upperTower],cellSize:90});
  group.userData.batchInfo=batchInfo;
  return {group,sky,sea,uniforms,update(t){uniforms.uTime.value=t;},setGolden(v){uniforms.uGolden.value=v;}};
}
