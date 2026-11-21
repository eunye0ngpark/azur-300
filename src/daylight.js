import * as THREE from 'three';
import { DAY_SUN, loadPhotoSky } from './photo-sky.js';

// Angles are an illustrative clear-sky lighting study, in the apartment's
// coordinates. Sea is +Z, west is -X. Keep one sun for shadows, sky and water.
export function makeDaylight(scene, renderer, environment) {
  const photoSky = loadPhotoSky(environment.sky);
  const sunsetSun = new THREE.Vector3(-.82, .22, .54).normalize();
  const sun = new THREE.DirectionalLight();
  sun.target.position.set(0,45,-4);
  sun.castShadow = true;
  const shadow=sun.shadow;
  shadow.mapSize.set(3072,3072);
  Object.assign(shadow.camera,{left:-22,right:22,top:20,bottom:-20,near:8,far:120});
  shadow.camera.updateProjectionMatrix();
  shadow.normalBias=.007; shadow.bias=-.000045;
  const hemi=new THREE.HemisphereLight(0xcddfed,0xccb290,.64);
  scene.add(sun,sun.target,hemi);

  // Interior reflections are captured at the living/dining threshold, with the
  // roof in place. Each light state is captured once, at a modest resolution.
  const probes = new Map();
  const probePosition = new THREE.Vector3(-1.28,46.42,-2.52);
  let built=false;
  function update(golden) {
    const sunset=Boolean(golden);
    const direction = sunset ? sunsetSun : DAY_SUN;
    photoSky.setSunset(sunset);
    environment.setGolden(Number(sunset));
    environment.uniforms.uSun.value.copy(direction);
    sun.position.copy(sun.target.position).addScaledVector(direction,64);
    sun.color.set(sunset?0xffc594:0xfff2dd);
    sun.intensity=sunset?3.6:4.25;
    hemi.color.set(sunset?0xc6d4e4:0xd4e5f5);
    hemi.groundColor.set(sunset?0xc29e7b:0xd6c6b1);
    hemi.intensity=sunset?.42:.55;
    scene.fog.color.set(sunset?0xdcbba3:0xc9d8df);
    renderer.toneMappingExposure=sunset?.98:1.03;
    renderer.shadowMap.needsUpdate=true;
    if(!built)return;
    if(!probes.has(sunset)){
      scene.environment=null;
      const generator=new THREE.PMREMGenerator(renderer);
      const target=generator.fromScene(scene,.015,.04,4000,{size:128,position:probePosition});
      generator.dispose();
      probes.set(sunset,target);
    }
    scene.environment=probes.get(sunset).texture;
    scene.environmentIntensity=sunset?.60:.55;
  }
  update(0);
  return { ready:photoSky.ready, update, capture(){built=true;update(0);} };
}
