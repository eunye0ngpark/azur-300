import * as THREE from 'three';
import { shoreZ } from './coast-town.js';

export const NOISE = `
float coastHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float coastNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(coastHash(i), coastHash(i + vec2(1, 0)), f.x),
             mix(coastHash(i + vec2(0, 1)), coastHash(i + vec2(1)), f.x), f.y);
}
float coastFbm(vec2 p) {
  float sum = 0., amp = .5;
  for(int i = 0; i < 4; i++) {
    sum += amp * coastNoise(p);
    p = mat2(1.62, 1.21, -1.21, 1.62) * p + 17.2;
    amp *= .5;
  }
  return sum;
}
`;
const atmosphere = `
vec3 horizonColor(float golden) {
  return mix(vec3(.72, .83, .89), vec3(.99, .72, .51), golden);
}
vec3 skyTone(vec3 d, vec3 sun, float golden) {
  float h = max(d.y, 0.);
  vec3 zenith = mix(vec3(.145, .345, .62), vec3(.22, .34, .53), golden);
  vec3 c = mix(horizonColor(golden), zenith, pow(h, .51));
  float alignment = max(dot(d, sun), 0.);
  return c + vec3(1., .77, .51) * pow(alignment, 14.) * mix(.18, .39, golden);
}`;
const worldVertex = `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export function makeSky(uniforms) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms, vertexShader: worldVertex,
    fragmentShader: `
      varying vec3 vWorld;
      uniform float uTime, uGolden;
      uniform vec3 uSun;
      ${NOISE}
      ${atmosphere}
      void main() {
        vec3 d = normalize(vWorld - cameraPosition);
        vec3 col = skyTone(d, uSun, uGolden);
        float alt = max(d.y, 0.);
        vec2 plane = d.xz / max(.028, alt + .06);
        vec2 p = mat2(.92, .39, -.39, .92) * plane + vec2(2.5, .03 * uTime / 60.);
        // Increasing cloud frequency towards the horizon gives the sky depth.
        float coarse = coastFbm(p * vec2(.50, .96));
        float wisps = coastFbm(p * vec2(.55, 4.0) + coarse * 2.);
        float cloud = smoothstep(.57, .70, coarse + .11 * (wisps - .5));
        cloud += .21 * smoothstep(.55, .74, wisps) * smoothstep(.24, .71, alt);
        cloud *= smoothstep(.004, .10, alt);
        vec3 cloudColor = mix(vec3(1.07, 1.07, 1.04), vec3(1.17, .86, .68), uGolden);
        col = mix(col, cloudColor, cloud * .73);
        float angle = acos(clamp(dot(d, uSun), -1., 1.));
        float disc = 1. - smoothstep(.0042, .0055 + fwidth(angle), angle);
        col += vec3(1., .82, .57) * (disc * 8. + exp(-angle * 60.) * .74);
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'Mediterranean_sky';
  sky.renderOrder = -1000;
  sky.frustumCulled = false;
  return sky;
}

// The sea and its translucent-looking shelf are one opaque surface with a
// distance-to-shore field. Foam follows the sloped beach through every camera.
export function makeWater(uniforms) {
  const xs = [-36000, -6800, -3800];
  for (let x = -2740; x <= 2740; x += 5) xs.push(x);
  xs.push(3800, 6800, 36000);
  const depthSteps = [0, 1, 3, 8, 18, 40, 85, 180, 420, 900, 1900, 6000, 36000];
  const verts = [], depth = [], idx = [];
  for (const offset of depthSteps) {
    for (const x of xs) {
      const shore = shoreZ(THREE.MathUtils.clamp(x, -2740, 2740));
      verts.push(x, -2.50, shore + offset);
      depth.push(offset);
    }
  }
  for (let j = 0; j < depthSteps.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs.length * j + i, b = a + xs.length;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('shelf', new THREE.Float32BufferAttribute(depth, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const water = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float shelf;
      varying float vShelf;
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.);
        vWorld = w.xyz;
        vShelf = shelf;
        gl_Position = projectionMatrix * viewMatrix * w;
        // The visible sea horizon from ~47 m lies beyond the scene's 4 km clip.
        gl_Position.z = min(gl_Position.z, gl_Position.w * .999995);
      }`,
    fragmentShader: `
      varying vec3 vWorld;
      varying float vShelf;
      uniform float uTime, uGolden;
      uniform vec3 uSun;
      ${NOISE}
      ${atmosphere}
      // Gradient of non-periodic, band-limited noise. The two components form
      // the surface slope, without the parallel grooves of a sinusoidal height map.
      vec2 waveGradient(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
        vec2 du = 30. * f * f * (f * (f - 2.) + 1.);
        float a = coastHash(cell), b = coastHash(cell + vec2(1,0));
        float c = coastHash(cell + vec2(0,1)), d = coastHash(cell + 1.);
        return du * vec2(mix(b - a, d - c, u.y), mix(c - a, d - b, u.x));
      }
      void main() {
        vec3 toEye = cameraPosition - vWorld;
        vec3 V = normalize(toEye);
        float dist = length(toEye);
        vec2 p = vWorld.xz;
        float footprint = max(length(dFdx(p)), length(dFdy(p)));
        float t = uTime;
        float warp = coastNoise(p * .035 + vec2(t*.009, 0.));
        mat2 wind = mat2(.89, .46, -.46, .89);
        mat2 crossWind = mat2(.67, -.74, .74, .67);
        vec2 seaPatch = wind * p;
        vec2 chop = waveGradient(seaPatch * vec2(.16,.34) + vec2(t * .092, -t * .13) + warp * 1.76);
        vec2 ripple = waveGradient(crossWind * p * vec2(.44,.92) + vec2(-t * .11, t * .21) - warp * .84);
        vec2 wavelet = waveGradient(seaPatch * vec2(1.68,2.93) + vec2(t * .16, -t * .35));
        vec2 slope = (chop * wind) * vec2(.048,.058) / (1. + footprint * .35);
        slope += (ripple * crossWind) * vec2(.044,.056) / (1. + footprint * .92);
        slope += (wavelet * wind) * vec2(.022,.031) / (1. + footprint * footprint * 3.4);
        vec3 N = normalize(vec3(-slope.x, 1., -slope.y));
        float bottom = exp(-max(0., vShelf + (warp - .5) * 7.) / 19.);
        vec3 deep = mix(vec3(.009, .161, .265), vec3(.050, .132, .204), uGolden);
        vec3 shallow = mix(vec3(.13, .47, .45), vec3(.21, .34, .30), uGolden);
        vec3 water = mix(deep, shallow, bottom);
        float patches = coastNoise(seaPatch * vec2(.025,.055) + warp*.71);
        water *= .88 + .17 * patches + .043 * chop.y / (1. + footprint);
        vec3 reflection = reflect(-V, N);
        float fresnel = .025 + .975 * pow(1. - max(0., dot(V, N)), 5.);
        water = mix(water, skyTone(reflection, uSun, uGolden), .07 + fresnel * .47);
        vec3 H = normalize(uSun + V);
        float highlight = pow(max(dot(N, H), 0.), 410. / (1. + min(footprint, 7.) * .25));
        water += mix(vec3(.84, .92, .94), vec3(1., .69, .42), uGolden) * highlight * (.52 / (1. + footprint*.07));
        float shoreDistance = vShelf - 1.15 * sin(p.x * .038) - .64 * sin(p.x*.17 + t*.31);
        float wave = sin(shoreDistance * 1.51 - t * .85 + warp * 8.);
        float breakzone = exp(-max(0., shoreDistance) / 5.7);
        float bubbles = coastNoise(p*.84 + vec2(0., t*.08));
        float foam = breakzone * smoothstep(.50, .97, wave + bubbles * .24) * (.35 + bubbles * .45);
        foam += .14 * exp(-max(0., vShelf) * 1.8);
        water = mix(water, vec3(.86,.89,.83), clamp(foam, 0., .73));
        float haze = 1. - exp(-dist * .00018);
        water = mix(water, horizonColor(uGolden) * .83, haze * .88);
        gl_FragColor = vec4(water, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  water.name = 'Baie_des_Anges_water';
  water.renderOrder = 900;
  water.frustumCulled = false;
  return water;
}
