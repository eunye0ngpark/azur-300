import * as THREE from 'three';
import { assetURL } from './asset-url.js';

const sampleUrls = Object.fromEntries(['oak', 'walnut', 'stone', 'linen', 'wool', 'leather', 'plaster'].map(key => {
  const ids = { oak: 'oak_veneer_01', walnut: 'natural_walnut_veneer', stone: 'Travertine001', linen: 'rough_linen', wool: 'wool_boucle', leather: 'leather_red_02', plaster: 'white_plaster_02' };
  return [key, assetURL(`./textures/interior/${ids[key]}.webp`)];
}));

// Width and height are the physical source sample dimensions in metres.
const samples = {
  oak: ['oak_veneer_01', 1.83, 1.83],
  walnut: ['natural_walnut_veneer', 1, 1],
  stone: ['Travertine001', 1.2, 1.2],
  linen: ['rough_linen', .2707, .2713],
  wool: ['wool_boucle', .3148, .3901],
  leather: ['leather_red_02', .60, .60],
  plaster: ['white_plaster_02', 1, 1],
};

// Finish tint (sRGB), relative albedo contrast, mean roughness, roughness range,
// and peak-to-peak relief in mm. Profiles share image data, but represent
// different finishes, e.g. honed limestone and an open-pore travertine.
const finishes = {
  Plaster:       ['plaster', '#e8e1d5', .10, .84, .12, .35],
  Ceiling:       ['plaster', '#efece4', .055,.89, .08, .18],
  Limestone:     ['stone',   '#cfc4b3', .23, .51, .22, .34],
  Travertine:    ['stone',   '#bfaa8f', .48, .43, .29, .90],
  OakLight:      ['oak',     '#c9a781', .48, .54, .22, .22],
  Oak:           ['oak',     '#aa835e', .52, .49, .23, .22],
  Walnut:        ['walnut',  '#73513b', .61, .44, .21, .22],
  Linen:         ['linen',   '#cdc1a9', .36, .91, .13, .78],
  LinenLight:    ['linen',   '#e1d8c5', .32, .91, .13, .78],
  Boucle:        ['wool',    '#dfd5c3', .51, .92, .12, 2.2],
  Rug:           ['wool',    '#b8ad9b', .55, .95, .09, 2.5],
  RugLine:       ['wool',    '#65736d', .45, .94, .09, 2.1],
  VelvetTeal:    ['linen',   '#456763', .18, .82, .16, .27],
  PoolFelt:      ['linen',   '#33584e', .085,.94, .07, .09],
  LeatherCognac: ['leather', '#98623f', .36, .53, .24, .70],
};

const varyings = `
  varying vec3 vInteriorWorld;
  varying vec3 vInteriorNormal;
`;
const positionAndNormal = `
  vec4 interiorP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    interiorP = batchingMatrix * interiorP;
  #endif
  #ifdef USE_INSTANCING
    interiorP = instanceMatrix * interiorP;
  #endif
  vInteriorWorld = (modelMatrix * interiorP).xyz;
  vInteriorNormal = inverseTransformDirection(transformedNormal, viewMatrix);
`;
const surfaceFunctions = `
  uniform sampler2D interiorSurface;
  uniform vec2 interiorScale;
  uniform vec3 interiorResponse;
  uniform int interiorLayout;

  // Physical joint locations from model.py. Offset each real slab or plank's
  // texture origin at its joint so two different pieces don't share one vein.
  vec2 pieceOffset(vec3 p) {
    if (abs(p.y - 45.0) > .065) return vec2(0.0);
    vec2 piece;
    if (interiorLayout == 1) {
      float row = p.z > 0.0 ? floor((p.z + .55) / 1.10) : floor(p.z / 2.0);
      piece = vec2(floor(p.x / 2.0), row);
    } else if (interiorLayout == 2 && p.z < -7.0) {
      float firstEdge = p.x < -4.5 ? -12.20 : p.x < 1.5 ? -4.20 : p.x < 7.5 ? 1.80 : 7.80;
      float board = floor((p.x - firstEdge) / .55);
      float length = floor((-p.z - 8.15 - mod(board, 3.0) * .34) / 2.35);
      piece = vec2(board + firstEdge, length);
    } else {
      return vec2(0.0);
    }
    return fract(piece * mat2(.61803,.41973,.73205,.31831));
  }

  vec3 readSurface() {
    vec3 p = vInteriorWorld;
    vec3 dpX = dFdx(p), dpY = dFdy(p);
    vec3 w = pow(abs(normalize(vInteriorNormal)), vec3(6.0));
    // Clip tiny bevel weights. Most pixels on walls/floors need one texture lookup.
    w = max(w - .006, vec3(0.0));
    w /= max(dot(w, vec3(1.0)), .00001);
    vec3 sampleValue = vec3(0.0);
    if (w.x > 0.0) sampleValue += w.x * textureGrad(interiorSurface, p.zy * interiorScale,
        dpX.zy * interiorScale, dpY.zy * interiorScale).rgb;
    if (w.y > 0.0) sampleValue += w.y * textureGrad(interiorSurface, p.xz * interiorScale + pieceOffset(p),
        dpX.xz * interiorScale, dpY.xz * interiorScale).rgb;
    if (w.z > 0.0) sampleValue += w.z * textureGrad(interiorSurface, p.xy * interiorScale,
        dpX.xy * interiorScale, dpY.xy * interiorScale).rgb;
    return sampleValue;
  }

  vec3 reliefNormal(vec3 pos, vec3 n, float height) {
    vec3 sx = dFdx(pos), sy = dFdy(pos);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
    return normalize(max(abs(det), 1e-10) * n - gradient);
  }
`;

function configureSurface(material, texture, sample, finish) {
  const [, color, contrast, roughness, roughRange, millimetres] = finish;
  material.color.set(color);
  material.roughness = roughness;
  material.metalness = 0;
  if (!texture) return;
  const layout = material.name === 'Limestone' ? 1 : sample === samples.oak ? 2 : 0;
  const scale = new THREE.Vector2(1 / sample[1], 1 / sample[2]);
  const response = new THREE.Vector3(contrast, roughRange, millimetres / 1000);
  material.onBeforeCompile = shader => {
    shader.uniforms.interiorSurface = { value: texture };
    shader.uniforms.interiorScale = { value: scale };
    shader.uniforms.interiorResponse = { value: response };
    shader.uniforms.interiorLayout = { value: layout };
    shader.vertexShader = varyings + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n' + positionAndNormal);
    shader.fragmentShader = varyings + surfaceFunctions + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 relief = readSurface() - 0.5;
        diffuseColor.rgb *= 1.0 + relief.r * interiorResponse.x;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + relief.g * interiorResponse.y, 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = reliefNormal(-vViewPosition, normal, relief.b * interiorResponse.z);`);
  };
  // All profiles use the same program with independent uniforms. Cutaway
  // clones can keep these two callbacks directly without duplicating textures.
  material.customProgramCacheKey = () => 'azur-metric-interior-v1';
}

export async function loadInteriorSurfaces(renderer) {
  const loader = new THREE.TextureLoader();
  const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const textures = new Map();
  await Promise.all(Object.entries(samples).map(async ([key, [id]]) => {
    try {
      const texture = await loader.loadAsync(sampleUrls[key]);
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = maxAnisotropy;
      textures.set(key, texture);
    } catch (error) {
      console.warn(`Could not load the interior finish ${id}.`, error);
    }
  }));
  const patched = new WeakSet();
  return material => {
    const finish = finishes[material.name];
    if (!finish || patched.has(material)) return;
    patched.add(material);
    const key = finish[0];
    configureSurface(material, textures.get(key), samples[key], finish);
  };
}
