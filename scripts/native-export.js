import {refineBistro} from '../src/bistro.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {refineUpholstery} from '../src/upholstery.js';
import {refineBedroomsAndPlants,hangRivieraPrint} from '../src/interior.js';
import {createEnvironment} from '../src/environment.js';

export async function exportAdditions(){
  // The export page lives under /scripts; runtime assets live at the viewer root.
  THREE.DefaultLoadingManager.setURLModifier(url=>url.startsWith('./textures/')?url.replace('./','../'):url);
  const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('../models/azur-300-v002.glb')).scene;
  refineUpholstery(model);
    refineBistro(model);refineBedroomsAndPlants(model);await hangRivieraPrint(model);
  const scene=new THREE.Scene();
  const additions=new THREE.Group();additions.name='Apartment_detail_refinements';additions.position.y=45;scene.add(additions);
  for(const name of ['Tailored_furnishings','Residence_details','Riviera_chairs'])additions.add(model.getObjectByName(name));
  const {sky,sea,group}=createEnvironment(scene);sky.removeFromParent();
  // Blender's importer does not carry per-instance foliage colour through
  // EXT_mesh_gpu_instancing. Set its average linear albedo on the shared leaves.
  const crowns=group.getObjectByName('Pines_and_cypress_on_the_hillside');
  if(crowns){
    crowns.material=crowns.material.clone();
    crowns.material.color.set(0x465e48);
    crowns.instanceColor=null;
  }
  const distances=sea.geometry.getAttribute('shelf');
  const tones=[], near=new THREE.Color(.12,.43,.40), deep=new THREE.Color(.015,.125,.205);
  for(let i=0;i<distances.count;i++){
    const value=deep.clone().lerp(near,Math.exp(-distances.getX(i)/17));
    tones.push(value.r,value.g,value.b);
  }
  sea.geometry.setAttribute('color',new THREE.Float32BufferAttribute(tones,3));
  sea.material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.18,name:'Mediterranean_sea'});
  sea.geometry.computeVertexNormals();
  return new GLTFExporter().parseAsync(scene,{binary:true});
}
