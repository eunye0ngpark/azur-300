import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

// The sun disc was measured in the source radiance map. The yaw keeps the
// horizon level and sets the sun over the apartment's southwest frontage.
export const DAY_SUN = new THREE.Vector3(-.35102518, .79997157, .48664855);
const SKY_YAW = -1.56260227;

async function loadPanorama() {
  const loader = new HDRLoader();
  if (location.hostname !== 'eunye0ngpark.github.io') {
    return loader.loadAsync('./textures/sky/pizzo_pernice_puresky_2k.hdr');
  }
  const url = 'https://cdn.jsdelivr.net/gh/eunye0ngpark/azur-300@main/optimized-assets/pizzo_pernice_puresky_2k.hdr.base64?v=full-quality';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HDR download failed: ${response.status}`);
  const base64 = await response.text();
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  const data = loader.parse(bytes.buffer);
  const texture = new THREE.DataTexture(data.data, data.width, data.height, data.format, data.type);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

export function loadPhotoSky(mesh) {
  const sunsetMaterial = mesh.material;
  let daylightMaterial;
  let isSunset = false;

  function setSunset(value) {
    isSunset = value;
    mesh.material = isSunset || !daylightMaterial ? sunsetMaterial : daylightMaterial;
  }

  const ready = loadPanorama().then(texture => {
    texture.wrapS = THREE.RepeatWrapping;
    daylightMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthTest: false, depthWrite: false,
      uniforms: {
        panorama: { value: texture },
        // Inverse world rotation for lookup. Keep this matrix identical in all
        // views, including the six directions used by the local reflection probe.
        lookupRotation: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(-SKY_YAW)) },
      },
      vertexShader: `
        varying vec3 skyPosition;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          skyPosition = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        #include <common>
        varying vec3 skyPosition;
        uniform sampler2D panorama;
        uniform mat3 lookupRotation;
        void main() {
          vec3 direction = normalize(skyPosition - cameraPosition);
          vec2 uv = equirectUv(lookupRotation * direction);
          vec3 sky = texture2D(panorama, uv).rgb * 1.55;
          // The measured sun is over 90,000 relative luminance units. Keep its
          // white disc in range in the half-float compositor. A directional
          // light supplies its direct component, including shadows on furniture.
          float luminance = dot(sky, vec3(.2126, .7152, .0722));
          sky /= 1.0 + luminance / 24.0;
          float air = .34 * (1.0 - smoothstep(-.025, .042, direction.y));
          sky = mix(sky, vec3(.72, .83, .89), air);
          gl_FragColor = vec4(sky, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    setSunset(isSunset);
  }).catch(error => {
    console.warn('The photographed sky could not be loaded. Using the analytic sky.', error);
  });
  return { ready, setSunset };
}
