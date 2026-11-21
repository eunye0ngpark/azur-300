"""Build the editable Cycles scene from the original .blend and web refinements.
blender -b azur-300-v002.blend -P scripts/build-native.py -- additions.glb output.blend
"""
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir / 'scripts'))
from native_finishes import configure_finishes

additions_path, blend_path = [Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:][:2]]
scene = bpy.context.scene
original = bpy.data.objects['Residence']
original.location.z = 45

# Remove the old geometry only where a new upholstered form, curtain, tree,
# artwork or bed cover takes its place. Keep original cabinetry and architecture.
for ob in list(bpy.data.objects):
    name = ob.name
    living = ob.parent and ob.parent.name == 'Living'
    replaced = name.startswith(('Linen_curtain_fold', 'Plant_leaf', 'Plant_stem', 'Bed_duvet', 'Bed_throw', 'Bed_pillow', 'V2_duvet_stitch'))
    if ob.parent and ob.parent.name in ('WineDining','Terrace'):
        replaced |= bool(re.fullmatch(r'Chair_(seat|back|leg)(?:\.\d+)?',name))
    if living:
        replaced |= name.startswith(('Curved_sofa_', 'Sofa_accent_pillow', 'Lounge_seat', 'Lounge_back', 'Lounge_arm',
                   'V2_sofa_radial_seam','V2_pillow_button','V2_cashmere_throw','Art_canvas','Art_shape','V2_art_frame'))
    if ob.parent and ob.parent.name in ('Master','Bedroom2','Living'):
        replaced |= name.startswith('V2_throw_fringe')
    if replaced:
        bpy.data.objects.remove(ob,do_unlink=True)

bpy.ops.import_scene.gltf(filepath=str(additions_path))
print('Interior finishes',configure_finishes(root_dir))
scene.render.engine='CYCLES'
scene.cycles.samples=96
scene.cycles.use_denoising=True
scene.cycles.adaptive_threshold=.025
scene.cycles.max_bounces=10
scene.cycles.transparent_max_bounces=12
scene.cycles.sample_clamp_indirect=8
scene.render.resolution_x=1800
scene.render.resolution_y=1125
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=.64
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=95

# A sun and the atmosphere share the same direction. Camera rays use the same
# world as diffuse and glossy rays, so sky colours also reach shadowed surfaces.
sun_vec=Vector((-.351025,-.486649,.799972)).normalized()
scene.world=bpy.data.worlds.new('Baie des Anges · daylight')
world=scene.world
world.use_nodes=True
tree=world.node_tree
bg=tree.nodes.get('Background')
env=tree.nodes.new('ShaderNodeTexEnvironment')
env.image=bpy.data.images.load(str(root_dir/'public/textures/sky/pizzo_pernice_puresky_2k.hdr'))
env.image.pack()
coord=tree.nodes.new('ShaderNodeTexCoord')
rotation=tree.nodes.new('ShaderNodeVectorRotate')
rotation.rotation_type='Z_AXIS'
rotation.inputs['Angle'].default_value=1.56260227
tree.links.new(coord.outputs['Generated'],rotation.inputs['Vector'])
tree.links.new(rotation.outputs[0],env.inputs['Vector'])
tree.links.new(env.outputs['Color'],bg.inputs[0])
bg.inputs['Strength'].default_value=.82

def light(name,typ,energy,position,direction,colour,size):
    data=bpy.data.lights.new(name,typ);data.energy=energy;data.color=colour
    ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.location=position
    ob.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
    if typ=='SUN':data.angle=size
    elif typ=='AREA':
        data.shape='DISK';data.size=size
        ob.visible_camera=False;ob.visible_glossy=False;ob.visible_transmission=False
        data.transmission_factor=0.0;data.specular_factor=0.0
    return ob

light('Sun · Mediterranean afternoon','SUN',1.20,(0,0,60),-sun_vec,(1,.91,.77),math.radians(.65))
# Low-intensity diffuse window fill represents the broad reflected light of
# the terrace and coastal city just outside the glazing. Rectangles follow each facade.
for x in (-8.4,0.0,8.4):
    panel=light('South glazing · diffuse fill','AREA',145,(x,-.16,46.55),(0,1,-.07),(.84,.91,1),2)
    panel.data.shape='RECTANGLE';panel.data.size=7.6;panel.data.size_y=2.65
    panel.data.specular_factor=0
for x in (-8.5,-1.7,5.4,10.1):
    panel=light('North glazing · diffuse fill','AREA',90,(x,12.1,46.60),(0,-1,-.05),(.88,.93,1),2)
    panel.data.shape='RECTANGLE';panel.data.size=4.9;panel.data.size_y=2.60
    panel.data.specular_factor=0
# Soft reflected light reaches the front of the north-facing beds from the
# light plaster partition opposite, and through their open doors.
for x in (-7.9,-1.95):
    bounce=light('Bedroom · plaster bounce','AREA',54,(x,7.25,47.02),(0,1,-.36),(1,.946,.868),2.6)
# Pendant bulbs emit locally. Broad daylight arrives through the actual openings.
for x in (8.25,9.4,10.55,1.45,2.8,4.15):
    light('Pendant pool','AREA',10,(x,3.60,47.42),(0,0,-1),(1,.80,.58),.26)
# Layered wind-driven ripples at two physical scales, normal amplitude in metres.
water=bpy.data.materials.get('Mediterranean_sea')
if water:
    water.use_nodes=True;nodes=water.node_tree.nodes;links=water.node_tree.links
    bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value=(.014,.135,.21,1)
    bs.inputs['Roughness'].default_value=.22
    bs.inputs['IOR'].default_value=1.333
    bs.inputs['Metallic'].default_value=.23
    geo=nodes.new('ShaderNodeNewGeometry')
    vec=nodes.new('ShaderNodeVectorMath');vec.operation='MULTIPLY';vec.inputs[1].default_value=(1.4,.52,1)
    links.new(geo.outputs['Position'],vec.inputs[0])
    noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=2.9;noise.inputs['Detail'].default_value=3.0
    links.new(vec.outputs[0],noise.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.27;bump.inputs['Distance'].default_value=.037
    links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bs.inputs['Normal'])

# Reproduce the perspective through the coastal air on distant terrain, water
# and architecture. The local apartment, its glazing and the sky keep their light.
coast=bpy.data.objects.get('Cote_d_Azur_environment')
if coast:
    coastal_materials={m for o in coast.children_recursive if o.type=='MESH' for m in o.data.materials if m}
    for material in coastal_materials:
        graph=material.node_tree
        if not graph:continue
        socket=next(n for n in graph.nodes if n.type=='OUTPUT_MATERIAL').inputs['Surface']
        if not socket.is_linked:continue
        original_shader=socket.links[0].from_socket
        distance=graph.nodes.new('ShaderNodeCameraData')
        haze=graph.nodes.new('ShaderNodeMapRange')
        haze.clamp=True
        for key,val in [('From Min',85.),('From Max',2600.),('To Min',0.),('To Max',.68)]:
            haze.inputs[key].default_value=val
        graph.links.new(distance.outputs['View Distance'],haze.inputs['Value'])
        airborne=graph.nodes.new('ShaderNodeEmission')
        airborne.inputs['Color'].default_value=(.44,.59,.71,1)
        blend=graph.nodes.new('ShaderNodeMixShader')
        graph.links.new(haze.outputs[0],blend.inputs[0])
        graph.links.new(original_shader,blend.inputs[1])
        graph.links.new(airborne.outputs[0],blend.inputs[2])
        graph.links.new(blend.outputs[0],socket)

def camera(name,position,target,field):
    def to_blender(p):return Vector((p[0],-p[2],p[1]))
    data=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
    ob.location=to_blender(position)
    ob.rotation_euler=(to_blender(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=12/math.tan(math.radians(field)/2)
    data.clip_start=.035;data.clip_end=60000
    return ob

scene.camera=camera('01 · Salon',(-11.58,46.56,-.76),(-5.22,45.99,-3.70),55)
camera('02 · Terrasse',(-9.30,46.60,.70),(-.5,46.05,25),55)
camera('03 · Chambre',(-5.35,46.62,-7.75),(-7.95,46.25,-10.15),54)
camera('04 · Salle à manger',(.1,46.64,-5.5),(3.2,46.2,-1.4),54)
for scr in bpy.data.screens:
    for area in scr.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
scene.render.filepath='//Salon.jpg'
scene['site_note']='Design study with an open sea frontage requested by the client. Illustrative site geometry.'
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path),compress=True)
print('SAVED',len(scene.objects),'objects',blend_path)
