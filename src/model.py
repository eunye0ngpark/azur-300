"""AZUR 300 — a reproducible, metric Blender model of a Nice seafront residence.
Run: /usr/local/bin/3dpy src/model.py
All dimensions are metres. Interior footprint: 25 x 12 = 300 m².
"""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector

ROOT = Path('/mnt/agents/output/app')
PUBLIC = ROOT / 'public' / 'models'
PUBLIC.mkdir(parents=True, exist_ok=True)
BLEND = ROOT / 'azur-300-v002.blend'
RAW = PUBLIC / 'azur-300-raw-v002.glb'
random.seed(300)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.materials): bpy.data.materials.remove(d)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene['project'] = 'AZUR 300 — Nice, Côte d’Azur'
scene['interior_area_m2'] = 300.0
scene['model_version'] = 4

# ---------- materials: constant Principled values survive glTF without texture loss ----------
def material(name, color, rough=.5, metal=0, alpha=1, emission=None, strength=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if alpha < 1:
        bs.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    if emission:
        bs.inputs['Emission Color'].default_value = (*emission, 1)
        bs.inputs['Emission Strength'].default_value = strength
    return m

M = {}
def mat(name, *args, **kwargs):
    M[name] = material(name, *args, **kwargs)
    return M[name]

mat('Limestone', (0.72, 0.68, 0.59), .28)
mat('Travertine', (0.64, 0.54, 0.42), .38)
mat('Plaster', (0.88, 0.86, 0.79), .82)
mat('Ceiling', (0.93, 0.92, 0.87), .86)
mat('Oak', (0.43, 0.27, 0.14), .48)
mat('OakLight', (0.63, 0.45, 0.27), .52)
mat('Walnut', (0.19, 0.095, 0.045), .42)
mat('Bronze', (0.48, 0.32, 0.14), .26, .78)
mat('BrushedSteel', (0.42, 0.46, 0.47), .24, .82)
mat('Graphite', (0.035, 0.043, 0.048), .38, .25)
mat('ShadowGap', (0.018, 0.022, 0.024), .75)
mat('Linen', (0.82, 0.79, 0.70), .92)
mat('LinenLight', (0.94, 0.91, 0.83), .96)
mat('Boucle', (0.76, 0.72, 0.64), .98)
mat('LeatherCognac', (0.34, 0.13, 0.055), .56)
mat('VelvetTeal', (0.025, 0.19, 0.20), .8)
mat('SeaAccent', (0.025, 0.36, 0.47), .48)
mat('Terracotta', (0.53, 0.16, 0.075), .72)
mat('Ochre', (0.72, 0.40, 0.09), .68)
mat('Rug', (0.58, 0.60, 0.55), .98)
mat('RugLine', (0.045, 0.22, 0.24), .95)
mat('Glass', (0.73, 0.91, 0.94), .08, .05, .14)
mat('GlassBalustrade', (0.72, 0.91, 0.94), .1, .05, .20)
mat('Mirror', (0.68, 0.75, 0.76), .05, .95)
mat('Water', (0.025, 0.30, 0.40), .12, .25, .72)
mat('Leaf', (0.055, 0.20, 0.09), .78)
mat('LeafLight', (0.14, 0.31, 0.14), .8)
mat('Soil', (0.055, 0.035, 0.022), 1)
mat('WhiteCeramic', (0.91, 0.91, 0.86), .22)
mat('Coffee', (0.055, 0.022, 0.01), .3)
mat('WineGlass', (0.82, 0.91, 0.92), .08, .0, .28)
mat('BottleGreen', (0.018, 0.07, 0.04), .2, .1)
mat('CoveLight', (1.0, .83, .58), .35, 0, 1, (1.0, .76, .43), 3.0)
mat('Screen', (.008, .025, .035), .2, .1, 1, (.02, .32, .48), 1.6)
mat('ScreenViolet', (.02, .008, .035), .25, .1, 1, (.20, .06, .42), 1.2)
mat('PoolFelt', (.018, .15, .115), .92)
mat('BallWhite', (.91, .89, .80), .2)
mat('BallRed', (.55, .025, .015), .2)
mat('BallYellow', (.92, .58, .025), .2)
mat('BallBlue', (.015, .12, .48), .2)
mat('BallBlack', (.012, .014, .015), .2)
# V2 detail palette: small, functional accents rather than visual noise.
mat('DetailInk', (.025, .045, .055), .58)
mat('DetailCream', (.86, .81, .69), .74)
mat('LeafSage', (.18, .31, .22), .86)
mat('FruitCitrus', (.95, .42, .035), .48)
mat('FruitRed', (.48, .025, .018), .42)
mat('Pastry', (.62, .31, .095), .72)
mat('Soap', (.64, .78, .72), .32)
mat('LEDWhite', (.78, .93, .96), .25, 0, 1, (.55, .86, 1.0), 1.5)

# ---------- scene graph and reusable geometry ----------
root = bpy.data.objects.new('Residence', None)
scene.collection.objects.link(root)
roots = {}
for name in ['Architecture', 'Living', 'WineDining', 'Kitchen', 'Master', 'Bedroom2', 'Billiards', 'Gaming', 'Terrace']:
    ob = bpy.data.objects.new(name, None)
    scene.collection.objects.link(ob)
    ob.parent = root
    roots[name] = ob

def finish(ob, name, material_name, parent, bevel=0):
    ob.name = name
    for c in list(ob.users_collection): c.objects.unlink(ob)
    scene.collection.objects.link(ob)
    ob.parent = roots[parent] if isinstance(parent, str) else parent
    if material_name:
        ob.data.materials.append(M[material_name] if isinstance(material_name, str) else material_name)
    if bevel and ob.type == 'MESH':
        mod = ob.modifiers.new('Soft crafted edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod = ob.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    ob['managed'] = True
    return ob

def box(name, loc, size, material_name, parent='Architecture', bevel=.02, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.rotation_euler.z = rot
    return finish(ob, name, material_name, parent, bevel)

def cyl(name, loc, radius, depth, material_name, parent='Architecture', vertices=32, bevel=.008, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    ob = bpy.context.object
    if rot: ob.rotation_euler = rot
    for p in ob.data.polygons: p.use_smooth = True
    return finish(ob, name, material_name, parent, bevel)

def sphere(name, loc, scale, material_name, parent, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=loc)
    ob = bpy.context.object
    ob.scale = scale
    for p in ob.data.polygons: p.use_smooth = True
    return finish(ob, name, material_name, parent)

def rod(name, a, b, radius, material_name, parent, vertices=16):
    a, b = Vector(a), Vector(b)
    ob = cyl(name, (a+b)/2, radius, (b-a).length, material_name, parent, vertices, 0)
    ob.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return ob

def annular(name, center, r0, r1, a0, a1, z0, z1, material_name, parent, steps=48):
    verts, faces = [], []
    for z in [z0, z1]:
        for r in [r0, r1]:
            for i in range(steps+1):
                a = math.radians(a0 + (a1-a0)*i/steps)
                verts.append((center[0]+r*math.cos(a), center[1]+r*math.sin(a), z))
    n = steps+1
    for i in range(steps):
        faces += [(i, i+1, n+i+1, n+i), (2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1),
                  (i, 2*n+i, 2*n+i+1, i+1), (n+i, n+i+1, 3*n+i+1, 3*n+i)]
    faces += [(0, n, 3*n, 2*n), (steps, 2*n+steps, 3*n+steps, n+steps)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return finish(ob, name, material_name, parent, .035)

def frame_rect(name, center, width, height, bar, depth, material_name, parent, plane='XZ'):
    x,y,z = center
    if plane == 'XZ':
        box(name+'_top', (x,y,z+height/2-bar/2), (width,depth,bar), material_name,parent,bar/4)
        box(name+'_bottom', (x,y,z-height/2+bar/2), (width,depth,bar), material_name,parent,bar/4)
        box(name+'_left', (x-width/2+bar/2,y,z), (bar,depth,height-2*bar), material_name,parent,bar/4)
        box(name+'_right', (x+width/2-bar/2,y,z), (bar,depth,height-2*bar), material_name,parent,bar/4)
    elif plane == 'YZ':
        box(name+'_top', (x,y,z+height/2-bar/2), (depth,width,bar), material_name,parent,bar/4)
        box(name+'_bottom', (x,y,z-height/2+bar/2), (depth,width,bar), material_name,parent,bar/4)
        box(name+'_left', (x,y-width/2+bar/2,z), (depth,bar,height-2*bar), material_name,parent,bar/4)
        box(name+'_right', (x,y+width/2-bar/2,z), (depth,bar,height-2*bar), material_name,parent,bar/4)

# ---------- architecture: 25m sea frontage, 12m deep, 3.4m clear height ----------
box('Interior_300sqm_floor', (0,6,-.12), (25,12,.24), 'Limestone', bevel=.02)
box('Terrace_floor', (0,-1.65,-.10), (25,3.3,.20), 'Limestone', 'Terrace', .02)
# fine stone joints, physically above the structural slab but below finish surface
for x in range(-12,13,2): box('Stone_joint_x', (x,6,.002), (.009,12,.004), 'ShadowGap', bevel=0)
for y in range(0,13,2): box('Stone_joint_y', (0,y,.002), (25,.009,.004), 'ShadowGap', bevel=0)
# warm timber in private and entertainment rooms
for xa,xb,label in [(-12.5,-4.5,'Master'),(-4.5,1.5,'Bedroom2'),(1.5,7.5,'Billiards'),(7.5,12.5,'Gaming')]:
    box(label+'_oak_floor', ((xa+xb)/2,9.5,.018), (xb-xa-.12,4.86,.035), 'OakLight' if label in ['Master','Bedroom2'] else 'Oak', label, .005)
    for i in range(int((xb-xa)/.55)):
        x = xa+.3+i*.55
        box(label+'_board_joint', (x,9.5,.038), (.008,4.8,.004), 'Walnut', label, 0)

# ceiling is separately named/materialled so the web bird's-eye can hide it cleanly
box('Ceiling_main', (0,6,3.48), (25,12,.16), 'Ceiling', bevel=.01)
box('Ceiling_terrace_overhang', (0,-.55,3.48), (25,1.1,.16), 'Ceiling', 'Terrace', .01)
# recessed ceiling perimeter and cove lines
for y in [.22,6.78,11.78]:
    box('Ceiling_recess', (0,y,3.375), (24.5,.09,.035), 'ShadowGap', bevel=.005)
    box('Cove_linear', (0,y-.035,3.365), (24.2,.025,.018), 'CoveLight', bevel=.003)
for x in [-12.25,-.5,6.5,12.25]: box('Cove_vertical', (x,6,3.36), (.025,11.5,.02), 'CoveLight', bevel=.003)

# partitions with genuine open doorways, not boolean intersections
def wall_y(y, xa, xb, doors, parent='Architecture'):
    cursor = xa
    for i,(dc,dw) in enumerate(sorted(doors)):
        left,right = dc-dw/2,dc+dw/2
        if left > cursor: box('Wall_segment', ((cursor+left)/2,y,1.7), (left-cursor,.16,3.4), 'Plaster',parent,.008)
        box('Door_lintel', (dc,y,2.97), (dw,.16,.86), 'Plaster',parent,.008)
        for sx in [-1,1]: box('Door_reveal', (dc+sx*(dw/2+.025),y,1.27), (.05,.22,2.54), 'OakLight',parent,.006)
        box('Door_header', (dc,y,2.54), (dw+.10,.22,.05), 'OakLight',parent,.006)
        cursor = right
    if cursor < xb: box('Wall_segment', ((cursor+xb)/2,y,1.7), (xb-cursor,.16,3.4), 'Plaster',parent,.008)

wall_y(7,-12.5,12.5,[(-5.3,1.15),(.75,1.1),(6.85,1.1),(8.55,1.1)])
for x,ya,yb in [(-.5,0,7),(6.5,0,7),(-4.5,7,12),(1.5,7,12),(7.5,7,12)]:
    # public divisions stop short of the glazing to retain an open, broad living/dining/kitchen sequence
    if ya == 0:
        box('Public_low_portal', (x,6.7,1.7), (.16,.6,3.4), 'Plaster', bevel=.01)
        box('Public_portal_column', (x,.25,1.7), (.16,.5,3.4), 'Plaster', bevel=.01)
    else:
        box('Private_partition', (x,(ya+yb)/2,1.7), (.16,yb-ya,3.4), 'Plaster', bevel=.008)

# floor-to-ceiling glazing; central living slider is physically open to the terrace
def south_glazing():
    bays = 10
    for i in range(bays):
        x0=-12.5+i*2.5; xc=x0+1.25
        if i in [2,3]:
            # stacked sliding panels parked at the sides leave a 2.35m clear coffee/terrace route
            if i == 2: box('Open_slider_stacked', (x0+.13,.03,1.65), (.22,.035,3.12), 'Glass', bevel=.002)
            else: box('Open_slider_stacked', (x0+2.37,.03,1.65), (.22,.035,3.12), 'Glass', bevel=.002)
        else:
            box('Sea_window', (xc,0,1.65), (2.40,.028,3.12), 'Glass', bevel=.002)
        box('Window_mullion', (x0,0,1.68), (.055,.11,3.30), 'Bronze', bevel=.007)
    box('Window_head', (0,0,3.32), (25,.14,.09), 'Bronze', bevel=.008)
    box('Window_sill', (0,0,.075), (25,.16,.10), 'Bronze', bevel=.008)
south_glazing()
# northern and side glazing with solid piers; east retains a proper 1.2m entry door near the foyer
for i in range(10):
    x0=-12.5+i*2.5
    box('North_window', (x0+1.25,12,1.65), (2.38,.028,3.12), 'Glass', bevel=.002)
    box('North_mullion', (x0,12,1.68), (.06,.12,3.30), 'Bronze', bevel=.006)
box('North_head',(0,12,3.32),(25,.14,.09),'Bronze',bevel=.006)
box('North_sill',(0,12,.075),(25,.14,.10),'Bronze',bevel=.006)
for side in [-1,1]:
    x=side*12.5
    for i in range(6):
        ya=i*2
        if side==1 and i==3:
            box('Main_entry_door',(x,ya+1,1.28),(.12,1.25,2.56),'Walnut',bevel=.015)
            box('Entry_pull',(x-.09,ya+.65,1.15),(.06,.035,.65),'Bronze',bevel=.008)
            continue
        box('Side_window',(x,ya+1,1.65),(.028,1.88,3.12),'Glass',bevel=.002)
        box('Side_mullion',(x,ya,1.68),(.12,.055,3.30),'Bronze',bevel=.006)
    box('Side_head',(x,6,3.32),(.14,12,.09),'Bronze',bevel=.006)
    box('Side_sill',(x,6,.075),(.14,12,.10),'Bronze',bevel=.006)

# sheer curtains are grouped at the ends, never covering the principal sea view
for x in [-12.15,-10.9,-1.15,1.0,11.9]:
    for j in range(7):
        box('Linen_curtain_fold',(x+(j-3)*.055,.20,1.66),(.045,.10,3.18),'LinenLight','Living' if x<0 else 'Kitchen',.018)

# ---------- furniture generators ----------
def pillow(name, loc, size, material_name, parent, rot=0):
    ob=box(name,loc,size,material_name,parent,min(size)*.32,rot)
    return ob

def dining_chair(x,y,parent,rot=0,material_name='Linen'):
    # local chair faces -Y; rotate the complete set around its floor centre
    def p(dx,dy,z): return (x+dx*math.cos(rot)-dy*math.sin(rot),y+dx*math.sin(rot)+dy*math.cos(rot),z)
    box('Chair_seat',p(0,0,.47),(.53,.52,.14),material_name,parent,.065,rot)
    box('Chair_back',p(0,.225,.78),(.54,.13,.58),material_name,parent,.06,rot)
    for dx in [-.20,.20]:
        for dy in [-.18,.18]: rod('Chair_leg',p(dx*1.12,dy*1.12,.04),p(dx,dy,.43),.024,'Oak',parent)

def lounge_chair(x,y,parent,rot=0,matname='LeatherCognac'):
    def p(dx,dy,z): return (x+dx*math.cos(rot)-dy*math.sin(rot),y+dx*math.sin(rot)+dy*math.cos(rot),z)
    box('Lounge_seat',p(0,0,.43),(.88,.86,.20),matname,parent,.10,rot)
    box('Lounge_back',p(0,.33,.82),(.90,.22,.78),matname,parent,.11,rot)
    for dx in [-.42,.42]: box('Lounge_arm',p(dx,.02,.64),(.18,.82,.40),matname,parent,.085,rot)
    for dx in [-.32,.32]:
        for dy in [-.28,.28]: cyl('Lounge_foot',p(dx,dy,.12),.035,.20,'Bronze',parent,16,.004)

def round_table(name,x,y,r,h,topmat,parent,base_mat='Bronze'):
    cyl(name+'_top',(x,y,h),r,.09,topmat,parent,64,.025)
    cyl(name+'_stem',(x,y,h/2),.075,h-.05,base_mat,parent,24,.008)
    cyl(name+'_base',(x,y,.055),r*.46,.07,base_mat,parent,48,.012)

def vase(x,y,z,parent,color='SeaAccent',scale=1):
    cyl('Vase_foot',(x,y,z+.07*scale),.10*scale,.14*scale,color,parent,32,.025)
    sphere('Vase_body',(x,y,z+.23*scale),(.15*scale,.15*scale,.21*scale),color,parent)
    cyl('Vase_neck',(x,y,z+.42*scale),.055*scale,.17*scale,color,parent,32,.015)

def book(x,y,z,parent,color='SeaAccent',rot=0,scale=1):
    box('Book_pages',(x,y,z),(.26*scale,.34*scale,.035*scale),'LinenLight',parent,.004,rot)
    for dz in [-.020*scale,.020*scale]: box('Book_cover',(x,y,z+dz),(.275*scale,.35*scale,.006*scale),color,parent,.002,rot)

def plant(x,y,parent,scale=1):
    cyl('Planter',(x,y,.24*scale),.28*scale,.48*scale,'Travertine',parent,48,.035)
    cyl('Plant_soil',(x,y,.485*scale),.245*scale,.018*scale,'Soil',parent,40,0)
    for i in range(11):
        a=i*2.399; h=(1.15+.42*random.random())*scale
        end=(x+math.cos(a)*.36*scale,y+math.sin(a)*.36*scale,.48*scale+h*.70)
        rod('Plant_stem',(x,y,.47*scale),end,.013*scale,'Leaf',parent,10)
        ob=sphere('Plant_leaf',(end[0]+math.cos(a)*.15*scale,end[1]+math.sin(a)*.15*scale,end[2]+.22*scale),(.16*scale,.055*scale,.43*scale),'LeafLight' if i%3==0 else 'Leaf',parent,16,8)
        ob.rotation_euler=(math.sin(a)*.5,math.cos(a)*.5,a)

def downlight(x,y,parent='Architecture'):
    cyl('Downlight_trim',(x,y,3.375),.065,.018,'Bronze',parent,24,.002)
    cyl('Downlight_lens',(x,y,3.362),.045,.012,'CoveLight',parent,24,.002)

def pendant(x,y,z,parent,r=.22):
    rod('Pendant_cord',(x,y,z+r),(x,y,3.38),.009,'Graphite',parent,12)
    sphere('Pendant_globe',(x,y,z),(r,r,r),'CoveLight',parent,24,12)
    cyl('Pendant_cap',(x,y,3.37),.07,.035,'Bronze',parent,24,.006)

# ---------- 84m² great room: conversation, art, reading, uninterrupted sea route ----------
box('Living_rug',(-6.4,3.65,.025),(7.8,4.8,.035),'Rug','Living',.08)
for x in [-10.1,-2.7]: box('Rug_border',(x,3.65,.047),(.045,4.45,.009),'RugLine','Living',.008)
for y in [1.45,5.85]: box('Rug_border',(-6.4,y,.047),(7.45,.045,.009),'RugLine','Living',.008)
# curved sofa faces the sea; concentric upholstery sections share exact arc radii
annular('Curved_sofa_plinth',(-6.2,1.95),1.70,2.92,30,150,.08,.27,'Oak','Living')
annular('Curved_sofa_seat',(-6.2,1.95),1.72,2.83,30,150,.27,.52,'LinenLight','Living')
annular('Curved_sofa_back',(-6.2,1.95),2.77,3.10,30,150,.30,.92,'Boucle','Living')
for a in [43,76,109,142]:
    ar=math.radians(a); x=-6.2+2.52*math.cos(ar); y=1.95+2.52*math.sin(ar)
    pillow('Sofa_accent_pillow',(x,y,.73),(.48,.20,.43),'VelvetTeal' if a in [76,142] else 'Linen','Living',-ar+math.pi/2)
# nested sculptural coffee tables
cyl('Coffee_table_large',(-6.45,2.40,.36),.90,.16,'Travertine','Living',64,.06)
cyl('Coffee_table_large_base',(-6.45,2.40,.17),.52,.28,'Travertine','Living',64,.035)
cyl('Coffee_table_small',(-5.05,2.05,.46),.48,.11,'Walnut','Living',64,.045)
cyl('Coffee_table_small_base',(-5.05,2.05,.22),.24,.40,'Bronze','Living',40,.02)
vase(-6.45,2.84,.45,'Living','WhiteCeramic',.75)
book(-5.95,2.85,.46,'Living','SeaAccent',.2)
# two independent lounge chairs leave 1.1m+ side aisles
lounge_chair(-10.45,3.45,'Living',math.radians(-26),'LeatherCognac')
lounge_chair(-2.15,3.70,'Living',math.radians(28),'VelvetTeal')
round_table('Reading_side',-10.15,2.25,.32,.55,'Travertine','Living')
# low sideboard and original geometric art on the solid rear pier
box('Living_sideboard',(-9.65,6.63,.43),(3.25,.52,.82),'OakLight','Living',.045)
for x in [-10.72,-9.65,-8.58]: box('Sideboard_door',(x,6.355,.44),(1.01,.025,.69),'Oak','Living',.008)
vase(-10.65,6.60,.86,'Living','SeaAccent',1.05)
vase(-8.75,6.60,.86,'Living','WhiteCeramic',.75)
box('Art_canvas',(-7.35,6.89,1.92),(2.65,.07,1.36),'LinenLight','Living',.008)
for x,z,w,h,c,r in [(-8.05,2.10,.68,.62,'SeaAccent',.2),(-7.35,1.73,.83,.38,'Terracotta',-.12),(-6.72,2.20,.61,.55,'Ochre',.1),(-7.28,2.42,.54,.24,'VelvetTeal',-.2)]:
    ob=box('Art_shape',(x,6.84,z),(w,.022,h),c,'Living',.04)
    ob.rotation_euler.y=r
plant(-11.65,5.90,'Living',1.05)
for x in [-10.8,-8.2,-5.6,-3.0]:
    for y in [1.0,5.9]: downlight(x,y)
# reusable library arc lamp, appended with its editable source hierarchy
LAMP=Path('/mnt/agents/design_assets/27fcb90a-b0f3-486c-9b50-3aeebacfae02/lamp_on.blend')
if LAMP.exists():
    with bpy.data.libraries.load(str(LAMP),link=False) as (src,dst):
        dst.collections=['LGT-FLR-001']
    col=dst.collections[0]
    if col:
        scene.collection.children.link(col)
        lamp_root=bpy.data.objects.get('LGT-FLR-001_ROOT')
        if lamp_root:
            lamp_root.parent=roots['Living']; lamp_root.location=(-11.30,5.90,0)
            lamp_root.rotation_euler.z=math.radians(-25)

# ---------- wine lounge + 49m² dining room ----------
box('Dining_rug',(2.85,3.30,.022),(5.6,4.25,.032),'Linen','WineDining',.06)
box('Dining_table_top',(2.80,3.35,.77),(3.55,1.22,.14),'Travertine','WineDining',.13)
for x in [1.55,4.05]:
    box('Dining_table_leg',(x,3.35,.38),(.22,.82,.72),'Bronze','WineDining',.05)
for x in [1.55,2.80,4.05]:
    dining_chair(x,2.38,'WineDining',math.pi,'Linen')
    dining_chair(x,4.32,'WineDining',0,'Linen')
dining_chair(.62,3.35,'WineDining',math.pi/2,'LeatherCognac')
dining_chair(4.98,3.35,'WineDining',-math.pi/2,'LeatherCognac')
for x in [1.55,2.80,4.05]: pendant(x,3.35,2.52,'WineDining',.19)
# wine wall: bronze frame, glass, illuminated shelves and real bottle silhouettes
box('Wine_wall_back',(1.60,6.78,1.48),(3.90,.24,2.86),'Walnut','WineDining',.035)
for x in [-.28,3.48]: box('Wine_case_side',(x,6.54,1.48),(.075,.52,2.86),'Bronze','WineDining',.01)
for z in [.12,.70,1.28,1.86,2.44,2.91]:
    box('Wine_shelf',(1.60,6.49,z),(3.78,.48,.045),'Bronze','WineDining',.008)
    if z<2.9: box('Wine_shelf_light',(1.60,6.28,z+.035),(3.55,.018,.018),'CoveLight','WineDining',.002)
for row in range(5):
    for col in range(10):
        x=-.05+col*.36; z=.25+row*.58
        ob=cyl('Wine_bottle',(x,6.44,z),.052,.34,'BottleGreen','WineDining',16,.006,rot=(math.pi/2,0,0))
        cyl('Wine_capsule',(x,6.25,z),.035,.045,'Bronze','WineDining',12,.003,rot=(math.pi/2,0,0))
box('Wine_case_glass',(1.60,6.245,1.48),(3.72,.022,2.75),'Glass','WineDining',.003)
# intimate wine tasting lounge near the open kitchen transition
lounge_chair(5.58,5.48,'WineDining',math.radians(160),'LeatherCognac')
lounge_chair(3.78,5.72,'WineDining',math.radians(195),'Linen')
round_table('Wine_tasting_table',4.65,5.00,.40,.52,'Walnut','WineDining')
vase(2.75,3.35,.85,'WineDining','WhiteCeramic',.65)
for x in [.6,3.3,5.8]:
    for y in [1.0,5.8]: downlight(x,y)

# ---------- 42m² kitchen: full-height storage, working wall and a 3.6m island ----------
box('Kitchen_back_cabinets',(9.48,6.60,1.48),(5.55,.68,2.90),'OakLight','Kitchen',.035)
for x in [7.12,8.30,9.48,10.66,11.84]:
    box('Kitchen_cabinet_front',(x,6.235,1.43),(1.10,.035,2.70),'Linen','Kitchen',.012)
    box('Cabinet_pull',(x+.42,6.205,1.42),(.018,.035,.72),'Bronze','Kitchen',.004)
# appliance composition sits proud of cabinet faces by millimetres, not inside the timber
for x in [8.28,9.48]:
    box('Oven_frame',(x,6.19,1.34),(.91,.10,.68),'Graphite','Kitchen',.025)
    box('Oven_glass',(x,6.125,1.31),(.75,.025,.43),'Mirror','Kitchen',.015)
    box('Oven_handle',(x,6.09,1.58),(.62,.055,.035),'BrushedSteel','Kitchen',.008)
box('Kitchen_worktop',(11.98,3.90,.91),(.72,4.60,.10),'Travertine','Kitchen',.025)
for y in [2.1,3.25,4.4,5.55]: box('Kitchen_base_unit',(12.04,y,.46),(.64,1.08,.82),'OakLight','Kitchen',.018)
box('Kitchen_island',(9.40,3.65,.48),(3.60,1.16,.90),'Oak','Kitchen',.055)
box('Kitchen_island_top',(9.40,3.65,.98),(3.82,1.30,.12),'Travertine','Kitchen',.06)
for x in [8.05,8.85,9.65,10.45,10.95]: box('Island_flute',(x,3.045,.49),(.045,.035,.78),'Bronze','Kitchen',.008)
# dark inset and rim read as a real undermount sink; tap rises clear of the slab
box('Sink_rim',(10.38,3.66,1.047),(.74,.52,.018),'BrushedSteel','Kitchen',.045)
box('Sink_basin',(10.38,3.66,1.058),(.62,.40,.018),'Graphite','Kitchen',.055)
rod('Faucet_upright',(10.86,3.82,1.04),(10.86,3.82,1.47),.025,'Bronze','Kitchen')
rod('Faucet_spout',(10.86,3.82,1.47),(10.52,3.82,1.47),.025,'Bronze','Kitchen')
rod('Faucet_drop',(10.52,3.82,1.47),(10.52,3.82,1.37),.025,'Bronze','Kitchen')
for x in [8.15,9.20,10.25]:
    cyl('Counter_stool_seat',(x,2.56,.68),.28,.12,'LeatherCognac','Kitchen',40,.04)
    for dx,dy in [(-.18,-.18),(.18,-.18),(-.18,.18),(.18,.18)]: rod('Stool_leg',(x+dx*1.15,2.56+dy*1.15,.04),(x+dx,2.56+dy,.64),.023,'Bronze','Kitchen')
    rod('Stool_footrest',(x-.21,2.36,.27),(x+.21,2.36,.27),.018,'Bronze','Kitchen')
for x in [8.25,9.40,10.55]: pendant(x,3.65,2.55,'Kitchen',.17)
vase(7.95,3.66,1.05,'Kitchen','SeaAccent',.60)
box('Foyer_console',(11.95,.92,.48),(.52,1.20,.90),'Walnut','Kitchen',.04)
vase(11.88,.92,.94,'Kitchen','WhiteCeramic',.70)
for x in [7.35,9.45,11.55]:
    for y in [1.0,5.75]: downlight(x,y)

# ---------- bedrooms with integrated ensuite volumes and generous clearances ----------
def bed_suite(cx,cy,parent,accent='VelvetTeal',width=2.10):
    # bed faces south; every textile layer has its own z clearance
    box('Bed_frame',(cx,cy,.30),(width+0.22,2.45,.48),'Oak',parent,.10)
    box('Bed_headboard',(cx,cy+1.18,1.00),(width+0.52,.20,1.76),'Boucle',parent,.10)
    box('Bed_mattress',(cx,cy,.63),(width,2.20,.30),'LinenLight',parent,.12)
    box('Bed_duvet',(cx,cy-.22,.83),(width-.06,1.64,.16),'LinenLight',parent,.09)
    box('Bed_throw',(cx,cy-.82,.93),(width+.02,.54,.075),accent,parent,.045)
    for dx in [-width*.25,width*.25]: pillow('Bed_pillow',(cx+dx,cy+.64,.91),(width*.43,.58,.18),'Linen',parent,0)
    box('Bed_bench',(cx,cy-1.62,.39),(width*.82,.48,.40),'LeatherCognac',parent,.09)
    for dx in [-width*.34,width*.34]: box('Bench_leg',(cx+dx,cy-1.62,.16),(.06,.35,.28),'Bronze',parent,.015)
    for side in [-1,1]:
        nx=cx+side*(width/2+.55)
        box('Nightstand',(nx,cy+.77,.38),(.56,.52,.68),'OakLight',parent,.055)
        cyl('Bedside_lamp_base',(nx-.10,cy+.90,.77),.12,.08,'Bronze',parent,32,.015)
        rod('Bedside_lamp_stem',(nx-.10,cy+.90,.79),(nx-.10,cy+.90,1.10),.018,'Bronze',parent)
        cyl('Bedside_lamp_shade',(nx-.10,cy+.90,1.13),.20,.24,'LinenLight',parent,40,.035)
    box('Bedroom_rug',(cx,cy-.22,.055),(width+2.0,3.65,.025),'Rug',parent,.07)

bed_suite(-7.95,10.05,'Master','VelvetTeal',2.20)
bed_suite(-1.95,10.05,'Bedroom2','Terracotta',1.80)
# master wardrobe and second-bedroom wardrobe sit off the window line
box('Master_wardrobe',(-4.86,9.15,1.45),(.62,2.50,2.78),'OakLight','Master',.035)
for y in [8.32,9.15,9.98]: box('Wardrobe_door',(-5.188,y,1.45),(.035,.78,2.66),'Linen','Master',.009)
box('Bedroom2_wardrobe',(-4.10,9.15,1.42),(.64,2.10,2.70),'OakLight','Bedroom2',.035)
# Master suite: a 6.1m² bath with a real 0.85m south entry, double vanity,
# walk-in rain shower and wall-hung WC. No camera or wall trick closes the doorway.
box('Master_ensuite_south_left',(-12.2375,9.45,1.375),(.525,.12,2.75),'Plaster','Master',.01)
box('Master_ensuite_south_right',(-10.5825,9.45,1.375),(1.085,.12,2.75),'Plaster','Master',.01)
box('Master_ensuite_door_header',(-11.55,9.45,2.655),(.85,.12,.19),'Plaster','Master',.008)
for x in [-11.975,-11.125]: box('Master_ensuite_door_reveal',(x,9.45,1.28),(.035,.16,2.56),'OakLight','Master',.006)
box('Master_ensuite_east',(-10.10,10.725,1.375),(.12,2.55,2.75),'Plaster','Master',.01)
box('Master_ensuite_floor',(-11.30,10.725,.045),(2.28,2.43,.055),'Travertine','Master',.012)
# Double stone vanity on the west wall; two independent basins, taps and mirrors.
box('Master_vanity',(-12.105,10.80,.47),(.55,1.82,.84),'Travertine','Master',.035)
box('Master_vanity_top',(-12.085,10.80,.915),(.59,1.88,.05),'Travertine','Master',.018)
for yy in [10.34,11.26]:
    box('Master_vanity_basin',(-12.06,yy,.975),(.38,.50,.09),'WhiteCeramic','Master',.055)
    cyl('Master_basin_drain',(-12.06,yy,1.023),.028,.006,'Bronze','Master',20,.002)
    rod('Master_tap_up',(-12.36,yy,.94),(-12.36,yy,1.23),.014,'Bronze','Master',12)
    rod('Master_tap_spout',(-12.36,yy,1.23),(-12.19,yy,1.23),.014,'Bronze','Master',12)
    box('Master_mirror',(-12.435,yy,1.69),(.025,.76,1.08),'Mirror','Master',.018)
    frame_rect('Master_mirror_frame',(-12.414,yy,1.69),.80,1.12,.022,.022,'Bronze','Master','YZ')
    cyl('Master_sconce',(-12.38,yy,2.36),.055,.08,'CoveLight','Master',24,.008,(0,math.pi/2,0))
for yy in [10.02,10.80,11.58]:
    box('Master_vanity_front',(-11.812,yy,.50),(.025,.72,.68),'OakLight','Master',.008)
    box('Master_vanity_pull',(-11.792,yy,.57),(.018,.26,.018),'Bronze','Master',.004)
# Fixed fluted-glass shower screen leaves the south side open for entry.
box('Master_shower_glass',(-11.02,11.25,1.18),(.025,1.34,2.30),'Glass','Master',.003)
rod('Master_shower_arm',(-10.16,11.48,2.30),(-10.43,11.48,2.30),.018,'Bronze','Master',12)
cyl('Master_rain_head',(-10.43,11.48,2.265),.15,.025,'BrushedSteel','Master',32,.006)
for yy in [10.90,11.12]:
    cyl('Master_shower_control',(-10.175,yy,1.08),.035,.025,'Bronze','Master',20,.003,(0,math.pi/2,0))
box('Master_shower_drain',(-10.42,11.50,.079),(.42,.12,.008),'BrushedSteel','Master',.008)
for i in range(7): box('Master_drain_slot',(-10.59+i*.055,11.50,.084),(.018,.085,.004),'ShadowGap','Master',.002)
box('Master_shower_niche',(-10.175,11.47,1.48),(.035,.48,.32),'ShadowGap','Master',.015)
# Compact wall-hung WC is outside the entry and shower circulation.
box('Master_WC_cistern',(-10.16,9.96,.64),(.12,.48,.88),'Plaster','Master',.025)
box('Master_WC_bowl',(-10.40,9.96,.43),(.48,.36,.30),'WhiteCeramic','Master',.10)
box('Master_WC_seat',(-10.43,9.96,.595),(.45,.35,.045),'WhiteCeramic','Master',.09)
box('Master_WC_flush',(-10.225,9.96,.92),(.018,.16,.09),'Bronze','Master',.012)
rod('Master_towel_rail',(-10.18,10.02,1.28),(-10.18,10.42,1.28),.014,'Bronze','Master',12)
for i in range(3): box('Master_bath_towel',(-10.20,10.22,1.18-i*.07),(.055,.32,.065),'LinenLight','Master',.018)
# Private morning sitting corner, separate dressing bench and full-length mirror.
lounge_chair(-11.55,8.12,'Master',math.radians(-32),'Linen')
lounge_chair(-10.12,8.12,'Master',math.radians(32),'VelvetTeal')
round_table('Master_sitting_table',-10.84,7.43,.32,.52,'Travertine','Master')
book(-10.86,7.43,.575,'Master','SeaAccent',.08)
box('Master_dressing_bench',(-6.35,8.10,.34),(.72,1.22,.56),'Boucle','Master',.08)
for yy in [7.66,8.54]:
    for xx in [-6.61,-6.09]: box('Master_dressing_bench_leg',(xx,yy,.14),(.055,.055,.25),'Bronze','Master',.012)
box('Master_full_length_mirror',(-4.586,11.12,1.35),(.025,.78,2.10),'Mirror','Master',.018)
for yy in [10.71,11.53]: box('Master_mirror_side',(-4.568,yy,1.35),(.035,.035,2.18),'Bronze','Master',.006)
for zz in [.26,2.44]: box('Master_mirror_rail',(-4.568,11.12,zz),(.035,.85,.035),'Bronze','Master',.006)
# guest ensuite tucked at the east-north corner, clear of the bed and wardrobe
box('Bedroom2_ensuite_wall',(.90,10.80,1.35),(1.10,.12,2.70),'Plaster','Bedroom2',.01)
box('Bedroom2_vanity',(.88,11.60,.46),(.90,.48,.82),'Travertine','Bedroom2',.035)
box('Bedroom2_basin',(.88,11.57,.91),(.58,.34,.10),'WhiteCeramic','Bedroom2',.06)
box('Bedroom2_mirror',(.88,11.925,1.58),(.78,.025,1.00),'Mirror','Bedroom2',.025)
for x,y,parent in [(-7.1,8.0,'Master'),(-2.0,8.0,'Bedroom2')]: downlight(x,y,parent)
plant(-5.15,11.20,'Master',.70)

# ---------- 30m² billiard room: full-size table + real cue clearance ----------
box('Billiard_rug',(4.50,9.48,.055),(5.35,4.30,.035),'Rug','Billiards',.06)
box('Pool_table_body',(4.50,9.45,.61),(3.10,1.78,.55),'Walnut','Billiards',.10)
box('Pool_table_felt',(4.50,9.45,.915),(2.84,1.52,.075),'PoolFelt','Billiards',.045)
for x in [3.15,5.85]:
    for y in [8.80,10.10]: box('Pool_table_leg',(x,y,.31),(.20,.20,.58),'Graphite','Billiards',.04)
# rails are four independent solids, with visible pocket inserts on the felt
for y in [8.64,10.26]: box('Pool_rail',(4.50,y,.94),(3.15,.16,.16),'OakLight','Billiards',.04)
for x in [2.99,6.01]: box('Pool_rail',(x,9.45,.94),(.16,1.55,.16),'OakLight','Billiards',.04)
for x,y in [(3.04,8.70),(4.50,8.67),(5.96,8.70),(3.04,10.20),(4.50,10.23),(5.96,10.20)]:
    cyl('Pool_pocket',(x,y,.966),.092,.012,'ShadowGap','Billiards',24,.004)
ballm=['BallWhite','BallRed','BallYellow','BallBlue','BallBlack']
for row in range(4):
    for j in range(row+1):
        i=row*(row+1)//2+j
        x=3.85+row*.052; y=9.45+(j-row/2)*.060
        sphere('Pool_ball',(x,y,.982),(.0285,.0285,.0285),ballm[i%len(ballm)],'Billiards',20,12)
# two cues lie diagonally without entering a rail or a ball
rod('Pool_cue',(5.10,9.00,.965),(5.70,9.80,.965),.012,'OakLight','Billiards',12)
rod('Pool_cue',(5.25,8.98,.965),(5.83,9.75,.965),.012,'OakLight','Billiards',12)
box('Cue_rack',(2.05,11.82,1.25),(.60,.16,1.85),'Walnut','Billiards',.035)
for x in [1.88,2.05,2.22]: rod('Cue_stick',(x,11.70,.38),(x,11.70,2.02),.014,'OakLight','Billiards',12)
box('Billiard_console',(6.65,11.62,.48),(1.10,.42,.88),'OakLight','Billiards',.045)
vase(6.65,11.62,.94,'Billiards','SeaAccent',.60)
for x in [3.55,5.45]:
    rod('Billiard_lamp_cord',(x,9.45,2.55),(x,9.45,3.37),.012,'Bronze','Billiards')
    box('Billiard_pendant',(x,9.45,2.48),(.82,.38,.16),'Bronze','Billiards',.07)
    box('Billiard_pendant_light',(x,9.45,2.385),(.66,.28,.018),'CoveLight','Billiards',.01)

# ---------- 25m² gaming room: bright shell, focused graphite/cyan workstations ----------
box('Gaming_area_rug',(10.0,9.50,.055),(4.35,4.25,.03),'Graphite','Gaming',.05)
box('Gaming_desk_top',(10.0,11.25,.77),(4.20,.82,.10),'Graphite','Gaming',.055)
for x in [8.15,11.85]:
    box('Gaming_desk_leg',(x,11.25,.39),(.10,.66,.72),'Graphite','Gaming',.025)
    box('Gaming_desk_foot',(x,11.15,.07),(.38,.90,.08),'Graphite','Gaming',.02)
box('Gaming_RGB_edge',(10.0,10.825,.76),(4.02,.018,.025),'Screen','Gaming',.006)
# dual stations, monitors tilted toward the room rather than intersecting the glazing
for cx,matname in [(9.05,'Screen'),(10.95,'ScreenViolet')]:
    for dx in [-.42,.42]:
        box('Monitor_screen',(cx+dx,11.36,1.35),(.78,.065,.49),matname,'Gaming',.025)
        box('Monitor_frame',(cx+dx,11.40,1.35),(.84,.045,.55),'Graphite','Gaming',.025)
        rod('Monitor_neck',(cx+dx,11.34,.84),(cx+dx,11.34,1.10),.025,'Graphite','Gaming')
        cyl('Monitor_base',(cx+dx,11.28,.84),.17,.025,'Graphite','Gaming',24,.006)
    box('Keyboard',(cx,10.99,.845),(.58,.20,.035),'Graphite','Gaming',.018)
    for k in range(12): box('Key_row',(cx-.25+k*.045,10.99,.866),(.032,.15,.008),'Screen' if k%4==0 else 'BrushedSteel','Gaming',.002)
    sphere('Mouse',(cx+.48,10.97,.875),(.055,.085,.035),'Graphite','Gaming',16,8)
    box('PC_tower',(cx+.60,11.22,.37),(.28,.48,.60),'Graphite','Gaming',.03)
    box('PC_glass',(cx+.60,10.968,.39),(.22,.015,.48),'Glass','Gaming',.01)
    for z in [.23,.47]: cyl('PC_fan',(cx+.60,10.95,z),.085,.025,'Screen','Gaming',24,.004,rot=(math.pi/2,0,0))
# ergonomic chairs with separate seat, back, headrest, arms and five-star feet
for cx in [9.05,10.95]:
    box('Gaming_chair_seat',(cx,10.05,.53),(.58,.57,.16),'Graphite','Gaming',.075)
    ob=box('Gaming_chair_back',(cx,9.82,1.02),(.60,.17,.91),'Graphite','Gaming',.08)
    ob.rotation_euler.x=math.radians(8)
    box('Gaming_headrest',(cx,9.80,1.47),(.38,.18,.20),'VelvetTeal','Gaming',.06)
    for dx in [-.37,.37]: box('Gaming_armrest',(cx+dx,10.04,.72),(.10,.44,.09),'Graphite','Gaming',.035)
    rod('Gaming_gaslift',(cx,10.05,.15),(cx,10.05,.47),.045,'BrushedSteel','Gaming')
    for i in range(5):
        a=i*math.tau/5
        rod('Gaming_star_foot',(cx,10.05,.15),(cx+math.cos(a)*.39,10.05+math.sin(a)*.39,.09),.025,'Graphite','Gaming')
        sphere('Gaming_caster',(cx+math.cos(a)*.39,10.05+math.sin(a)*.39,.065),(.045,.045,.055),'Graphite','Gaming',12,6)
# acoustic slats and restrained coloured grazing light on the east wall
for i in range(16): box('Acoustic_slat',(12.36,8.0+i*.19,1.65),(.10,.09,2.45),'Oak','Gaming',.012)
box('Gaming_light_bar',(12.28,9.45,2.88),(.025,2.95,.035),'ScreenViolet','Gaming',.006)
lounge_chair(8.25,8.15,'Gaming',math.radians(-25),'VelvetTeal')
round_table('Gaming_side',9.25,8.10,.30,.52,'Travertine','Gaming')

# ---------- 82.5m² sea terrace: coffee, lounging, glass balustrade, no obstructed sightlines ----------
for x in [-12.35+i*1.3 for i in range(20)]:
    box('Terrace_balustrade_post',(x,-3.22,.57),(.035,.055,1.10),'Bronze','Terrace',.005)
for i in range(10):
    box('Terrace_balustrade_glass',(-11.25+i*2.5,-3.22,.58),(2.42,.024,1.04),'GlassBalustrade','Terrace',.003)
box('Terrace_handrail',(0,-3.22,1.13),(25,.065,.045),'Bronze','Terrace',.012)
for side in [-1,1]:
    x=side*12.43
    box('Terrace_side_glass',(x,-1.62,.58),(.024,3.16,1.04),'GlassBalustrade','Terrace',.003)
    box('Terrace_side_rail',(x,-1.62,1.13),(.055,3.25,.045),'Bronze','Terrace',.01)
# café for four, positioned on the open living-room axis
cyl('Terrace_cafe_top',(-6.10,-1.70,.75),.78,.085,'Travertine','Terrace',64,.035)
cyl('Terrace_cafe_pedestal',(-6.10,-1.70,.39),.15,.68,'Bronze','Terrace',32,.015)
cyl('Terrace_cafe_base',(-6.10,-1.70,.055),.44,.07,'Bronze','Terrace',48,.015)
for x,y,r in [(-7.25,-1.70,math.pi/2),(-4.95,-1.70,-math.pi/2),(-6.10,-.55,0),(-6.10,-2.72,math.pi)]:
    dining_chair(x,y,'Terrace',r,'LinenLight')
# espresso cups, saucers and a small cafetière are all grounded on the table
for x,y in [(-6.38,-1.55),(-5.83,-1.88)]:
    cyl('Coffee_saucer',(x,y,.805),.105,.018,'WhiteCeramic','Terrace',32,.008)
    cyl('Coffee_cup',(x,y,.86),.058,.10,'WhiteCeramic','Terrace',32,.012)
    cyl('Coffee_surface',(x,y,.913),.047,.006,'Coffee','Terrace',32,.002)
cyl('Cafetiere',(-6.08,-1.53,.89),.075,.19,'BrushedSteel','Terrace',32,.015)
# two chaise lounges with space between them and the rail
for x in [4.25,6.20]:
    box('Chaise_base',(x,-1.70,.30),(1.02,2.05,.20),'OakLight','Terrace',.08)
    box('Chaise_cushion',(x,-1.85,.46),(.94,1.48,.18),'LinenLight','Terrace',.09)
    ob=box('Chaise_back',(x,-.90,.68),(.94,.68,.18),'LinenLight','Terrace',.09)
    ob.rotation_euler.x=math.radians(24)
    pillow('Chaise_pillow',(x,-.70,.87),(.62,.28,.16),'VelvetTeal','Terrace')
round_table('Terrace_lounge_table',5.22,-1.72,.36,.52,'Travertine','Terrace')
vase(5.22,-1.72,.57,'Terrace','WhiteCeramic',.48)
for x in [-11.45,10.95]: plant(x,-1.65,'Terrace',.85)
# slim outdoor rug defines the lounge without narrowing the main path
box('Terrace_lounge_rug',(5.25,-1.62,.025),(4.25,2.55,.028),'Linen','Terrace',.06)

# ---------- V2 detail pass: 50+ visible, functional additions in every space ----------
def root_mesh_count(name):
    return sum(1 for o in roots[name].children_recursive if o.type == 'MESH')

detail_baseline = {name: root_mesh_count(name) for name in roots if name != 'Architecture'}

def torus(name, loc, radius, tube, material_name, parent, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=28, minor_segments=8,
        location=loc, major_radius=radius, minor_radius=tube)
    ob = bpy.context.object
    if rot: ob.rotation_euler = rot
    for p in ob.data.polygons: p.use_smooth = True
    return finish(ob, name, material_name, parent)

def plate(name, x, y, z, parent, radius=.18):
    cyl(name+'_charger', (x,y,z), radius, .018, 'Bronze', parent, 32, .005)
    cyl(name+'_porcelain', (x,y,z+.014), radius*.84, .018, 'WhiteCeramic', parent, 32, .007)

def cup(name, x, y, z, parent, scale=1):
    cyl(name+'_saucer',(x,y,z),.105*scale,.018*scale,'WhiteCeramic',parent,28,.006)
    cyl(name+'_cup',(x,y,z+.055*scale),.058*scale,.10*scale,'WhiteCeramic',parent,28,.010)
    cyl(name+'_coffee',(x,y,z+.107*scale),.047*scale,.005*scale,'Coffee',parent,28,.001)
    torus(name+'_handle',(x+.067*scale,y,z+.060*scale),.035*scale,.008*scale,
        'WhiteCeramic',parent,(math.pi/2,0,0))

def tumbler(name, x, y, z, parent):
    cyl(name+'_glass',(x,y,z+.065),.052,.13,'WineGlass',parent,24,.006)
    cyl(name+'_water',(x,y,z+.070),.043,.065,'Water',parent,24,.002)

def wineglass(name, x, y, z, parent):
    cyl(name+'_foot',(x,y,z+.006),.060,.012,'WineGlass',parent,24,.003)
    cyl(name+'_stem',(x,y,z+.082),.010,.15,'WineGlass',parent,12,.001)
    sphere(name+'_bowl',(x,y,z+.195),(.067,.067,.088),'WineGlass',parent,16,8)

def bottle(name, x, y, z, parent, color='BottleGreen', scale=1):
    cyl(name+'_body',(x,y,z+.14*scale),.055*scale,.28*scale,color,parent,20,.010)
    cyl(name+'_neck',(x,y,z+.32*scale),.025*scale,.10*scale,color,parent,16,.005)
    cyl(name+'_label',(x,y,z+.15*scale),.056*scale,.095*scale,'DetailCream',parent,20,.002)
    cyl(name+'_cap',(x,y,z+.38*scale),.027*scale,.035*scale,'Bronze',parent,16,.003)

def bookstack(name, x, y, z, parent, color='SeaAccent'):
    book(x,y,z+.022,parent,color,.08)
    book(x+.025,y-.015,z+.067,parent,'DetailCream',-.05)

def upright_books(x, y, z, parent, count=8):
    for i in range(count):
        bx=x+i*.075; h=.27+(i%3)*.045; c=['SeaAccent','DetailCream','Terracotta','Linen'][i%4]
        box('V2_book_pages',(bx,y,z+h/2),(.058,.19,h),'DetailCream',parent,.004)
        for dx in [-.033,.033]: box('V2_book_spine',(bx+dx,y,z+h/2),(.008,.205,h+.012),c,parent,.002)
        box('V2_book_title',(bx,y-.104,z+h*.70),(.035,.006,.018),'Bronze',parent,.001)

def spoon(name, x, y, z, parent):
    rod(name+'_stem',(x,y-.065,z),(x,y+.055,z),.006,'BrushedSteel',parent,10)
    sphere(name+'_bowl',(x,y+.075,z),(.018,.030,.006),'BrushedSteel',parent,12,6)

# Three physical floor layers: structural slab, finished stone/timber, joints/inlays/thresholds.
for x in [-12.25,-.5,6.5,12.25]:
    box('V2_stone_perimeter_inlay',(x,3.5,.009),(.018,6.75,.008),'Bronze','Architecture',.002)
for y in [.28,6.72]:
    box('V2_stone_perimeter_inlay',(0,y,.009),(24.5,.018,.008),'Bronze','Architecture',.002)
for dc,dw,parent in [(-5.3,1.15,'Master'),(.75,1.1,'Bedroom2'),(6.85,1.1,'Billiards'),(8.55,1.1,'Gaming')]:
    box('V2_threshold_stone',(dc,7,.044),(dw,.24,.020),'Travertine',parent,.006)
    for yy in [6.90,7.10]: box('V2_threshold_bronze',(dc,yy,.057),(dw-.08,.016,.008),'Bronze',parent,.002)
for xa,xb,parent in [(-12.5,-4.5,'Master'),(-4.5,1.5,'Bedroom2'),(1.5,7.5,'Billiards'),(7.5,12.5,'Gaming')]:
    rows=int((xb-xa)/.55)
    for i in range(rows):
        x=xa+.3+i*.55
        for j in range(2):
            y=8.15+j*2.35+(i%3)*.34
            if y<11.75: box('V2_staggered_board_end',(x+.265,y,.040),(.52,.007,.003),'Walnut',parent,0)
# Shadow-gap skirting is split at every real doorway, never extruded across the opening.
for xa,xb in [(-12.5,-5.875),(-4.725,.20),(1.30,6.30),(7.40,8.00),(9.10,12.5)]:
    box('V2_rear_skirting',((xa+xb)/2,6.895,.095),(xb-xa,.028,.15),'OakLight','Architecture',.006)
for x in [-4.5,1.5,7.5]:
    for side in [-1,1]: box('V2_private_skirting',(x+side*.092,9.65,.095),(.025,4.55,.15),'OakLight','Architecture',.005)

# Living: tailored upholstery, hand-stitched rug, reading collection and coffee ritual.
for i in range(14):
    x=-9.75+i*.51
    for y in [1.53,5.77]: box('V2_living_rug_stitch',(x,y,.053),(.20,.016,.008),'DetailCream','Living',.003)
for a in [43,62,81,100,119,138]:
    ar=math.radians(a); r=2.24
    box('V2_sofa_radial_seam',(-6.2+r*math.cos(ar),1.95+r*math.sin(ar),.526),
        (.012,.66,.008),'DetailCream','Living',.002,ar-math.pi/2)
for a in [43,76,109,142]:
    ar=math.radians(a)
    sphere('V2_pillow_button',(-6.2+2.52*math.cos(ar),1.95+2.52*math.sin(ar),.948),(.022,.022,.009),'Bronze','Living',12,6)
box('V2_cashmere_throw',(-7.35,3.83,.575),(.78,.58,.055),'Linen','Living',.025,.52)
for i in range(10):
    box('V2_throw_fringe',(-7.69+i*.065,3.58,.535),(.018,.16,.018),'DetailCream','Living',.005,.52)
bookstack('V2_coffee_books',-6.00,2.43,.455,'Living','SeaAccent')
box('V2_coffee_tray',(-6.55,3.18,.462),(.62,.38,.035),'Walnut','Living',.035)
for x,y in [(-6.70,3.18),(-6.40,3.18)]: cup('V2_living_espresso',x,y,.49,'Living',.82)
upright_books(-10.15,6.53,.865,'Living',9)
frame_rect('V2_art_frame',(-7.35,6.805,1.92),2.79,1.49,.035,.045,'Bronze','Living')
cyl('V2_reading_coaster',(-10.15,2.25,.606),.11,.014,'Bronze','Living',28,.004)
cup('V2_reading_cup',-10.15,2.25,.62,'Living',.82)
for i in range(6):
    book(-9.95+i*.12,6.48,.88,'Living',['SeaAccent','Terracotta','DetailCream'][i%3],.02*i)

# Wine and dining: six complete settings, two end settings, decanting and shelf labels.
box('V2_dining_runner',(2.80,3.35,.849),(3.26,.30,.012),'Linen','WineDining',.018)
for x in [1.55,2.80,4.05]:
    for y in [2.94,3.76]:
        plate('V2_dining_plate',x,y,.855,'WineDining',.19)
        box('V2_folded_napkin',(x,y,.893),(.15,.20,.028),'LinenLight','WineDining',.012)
        torus('V2_napkin_ring',(x,y,.913),.038,.008,'Bronze','WineDining')
        rod('V2_fork_handle',(x-.245,y-.09,.869),(x-.245,y+.075,.869),.006,'BrushedSteel','WineDining',10)
        box('V2_fork_head',(x-.245,y+.10,.869),(.032,.055,.008),'BrushedSteel','WineDining',.003)
        rod('V2_knife',(x+.245,y-.10,.869),(x+.245,y+.12,.869),.008,'BrushedSteel','WineDining',10)
        spoon('V2_dining_spoon',x+.30,y,.871,'WineDining')
        gy=y+(.18 if y<3.35 else -.18)
        wineglass('V2_dining_wineglass',x+.34,gy,.86,'WineDining')
for x in [1.23,4.37]:
    plate('V2_end_plate',x,3.35,.855,'WineDining',.17)
    box('V2_end_napkin',(x,3.35,.893),(.14,.18,.028),'VelvetTeal','WineDining',.012)
    wineglass('V2_end_wineglass',x,3.62,.86,'WineDining')
sphere('V2_decanter_body',(4.65,5.00,.75),(.12,.12,.17),'WineGlass','WineDining',20,12)
cyl('V2_decanter_neck',(4.65,5.00,.94),.035,.20,'WineGlass','WineDining',20,.004)
cyl('V2_decanter_wine',(4.65,5.00,.70),.095,.09,'BallRed','WineDining',24,.006)
sphere('V2_decanter_stop',(4.65,5.00,1.055),(.045,.045,.035),'WineGlass','WineDining',16,8)
for x in [4.38,4.91]: wineglass('V2_tasting_glass',x,4.93,.575,'WineDining')
bookstack('V2_wine_notes',4.83,5.18,.570,'WineDining','Terracotta')
for row in range(5):
    for col in [0,4,8]:
        box('V2_wine_shelf_label',(-.05+col*.36,6.224,.16+row*.58),(.13,.012,.035),'Bronze','WineDining',.003)

# Kitchen: coffee station, prep zone, fresh produce, herbs, appliance controls and fine fluting.
box('V2_coffee_machine',(11.94,4.83,1.19),(.48,.42,.42),'Graphite','Kitchen',.045)
box('V2_coffee_machine_front',(11.94,4.605,1.20),(.39,.035,.28),'BrushedSteel','Kitchen',.018)
box('V2_coffee_machine_recess',(11.94,4.58,1.13),(.28,.025,.16),'ShadowGap','Kitchen',.010)
for x in [11.84,12.04]:
    cyl('V2_coffee_control',(x,4.575,1.31),.026,.020,'Bronze','Kitchen',20,.003,(math.pi/2,0,0))
    rod('V2_coffee_spout',(x,4.56,1.20),(x,4.56,1.10),.012,'BrushedSteel','Kitchen',10)
box('V2_coffee_drip_tray',(11.94,4.54,1.00),(.38,.22,.025),'BrushedSteel','Kitchen',.008)
for x,y in [(8.12,3.84),(8.42,3.84)]: cup('V2_kitchen_cup',x,y,1.055,'Kitchen',.85)
box('V2_prep_board',(8.83,3.38,1.065),(.68,.43,.035),'OakLight','Kitchen',.025,.10)
box('V2_chef_knife_blade',(8.86,3.36,1.092),(.32,.045,.012),'BrushedSteel','Kitchen',.008,.10)
box('V2_chef_knife_handle',(9.08,3.39,1.097),(.15,.055,.030),'Walnut','Kitchen',.010,.10)
for i in range(5):
    sphere('V2_prep_vegetable',(8.63+i*.085,3.49,1.12),(.035,.055,.032),'LeafSage' if i%2 else 'FruitRed','Kitchen',16,8)
sphere('V2_fruit_bowl',(9.52,3.50,1.135),(.31,.31,.095),'WhiteCeramic','Kitchen',28,12)
for i in range(7):
    a=i*2.399; r=.17*(.45+(i%3)*.25)
    sphere('V2_citrus',(9.52+math.cos(a)*r,3.50+math.sin(a)*r,1.21+(i%2)*.045),(.070,.068,.068),'FruitCitrus' if i%3 else 'FruitRed','Kitchen',16,8)
for x in [8.28,9.48]:
    for dx in [-.28,-.09,.09,.28]: cyl('V2_oven_knob',(x+dx,6.115,1.60),.033,.025,'BrushedSteel','Kitchen',20,.004,(math.pi/2,0,0))
    box('V2_oven_display',(x,6.105,1.50),(.27,.012,.055),'Screen','Kitchen',.004)
for i in range(30):
    box('V2_island_fine_flute',(7.69+i*.117,3.038,.49),(.025,.022,.77),'OakLight','Kitchen',.005)
for x in [7.12,8.30,9.48,10.66,11.84]:
    for z in [.42,2.42]: box('V2_cabinet_hinge',(x-.48,6.20,z),(.045,.018,.10),'Bronze','Kitchen',.004)
for y in [2.05,3.05,5.55]:
    cyl('V2_herb_pot',(11.96,y,1.055),.11,.18,'Terracotta','Kitchen',24,.015)
    cyl('V2_herb_soil',(11.96,y,1.15),.095,.015,'Soil','Kitchen',20,.002)
    for i in range(5):
        a=i*2.399
        rod('V2_herb_stem',(11.96,y,1.15),(11.96+math.cos(a)*.08,y+math.sin(a)*.08,1.32),.006,'Leaf','Kitchen',8)
        sphere('V2_herb_leaf',(11.96+math.cos(a)*.09,y+math.sin(a)*.09,1.32),(.035,.018,.075),'LeafSage','Kitchen',12,6)
rod('V2_faucet_lever',(10.86,3.82,1.27),(10.98,3.82,1.30),.012,'Bronze','Kitchen',12)
cyl('V2_sink_drain',(10.38,3.66,1.071),.055,.008,'BrushedSteel','Kitchen',24,.002)
bookstack('V2_kitchen_recipes',11.94,2.62,.975,'Kitchen','Terracotta')

# Bedrooms: tailored bed linen, personal objects, joinery hardware and ensuite amenities.
def bedroom_details(cx, cy, parent, accent, width):
    for i in range(11):
        x=cx-width*.50+i*width/10
        box('V2_headboard_channel',(x,cy+1.071,1.02),(.014,.012,1.43),'Linen',parent,.003)
    for yy in [cy-.65,cy-.28,cy+.09,cy+.46]:
        box('V2_duvet_stitch',(cx,yy,.914),(width-.16,.012,.007),'DetailCream',parent,.002)
    for i in range(12):
        x=cx-width*.46+i*width*.92/11
        rod('V2_throw_fringe',(x,cy-1.085,.93),(x,cy-1.12,.82),.006,accent,parent,8)
    for dx in [-width*.27,0,width*.27]:
        # Keep the upholstery buttons just below the bench crown; raised studs
        # used to pierce the books placed on the same surface.
        for dy in [-.12,.12]: sphere('V2_bench_button',(cx+dx,cy-1.62+dy,.586),(.022,.022,.003),'Bronze',parent,12,6)
    for side in [-1,1]:
        nx=cx+side*(width/2+.55); ny=cy+.77
        # Smaller bedside books sit forward of the lamp base, with a physical
        # 1 mm separation between the stacked volumes.
        book(nx-.105,ny-.17,.739,parent,'SeaAccent' if side<0 else 'Terracotta',math.pi/2,scale=.78)
        book(nx-.105,ny-.17,.776,parent,'DetailCream',math.pi/2,scale=.78)
        box('V2_nightstand_tray',(nx+.17,ny-.10,.738),(.18,.25,.022),'Walnut',parent,.018)
        tumbler('V2_bedside_water',nx+.17,ny-.10,.755,parent)
        box('V2_nightstand_pull',(nx,ny-.272,.44),(.22,.025,.018),'Bronze',parent,.005)
        for zz in [1.015,1.245]: torus('V2_lampshade_rim',(nx-.10,ny+.13,zz),.198,.006,'Bronze',parent)
    for i in range(3):
        # Centre the three books and leave visible gaps between their covers.
        book(cx+(i-1)*width*.17,cy-1.62,.615,parent,['SeaAccent','DetailCream','Terracotta'][i],.03*i)
    # Guest ensuite accessories; the master has its own double-vanity layout above.
    if parent!='Master':
        vx,vy=.88,11.60
        for i,x in enumerate([vx-.53,vx-.43,vx+.48]):
            bottle('V2_vanity_toiletry',x,vy,.92,parent,'Soap' if i==1 else 'WhiteCeramic',.46)
        box('V2_soap_dish',(vx+.43,vy-.16,.955),(.20,.12,.025),'WhiteCeramic',parent,.018)
        box('V2_soap',(vx+.43,vy-.16,.982),(.13,.075,.035),'Soap',parent,.018)
        rod('V2_vanity_tap_up',(vx,vy+.20,.94),(vx,vy+.20,1.20),.016,'Bronze',parent,12)
        rod('V2_vanity_tap_spout',(vx,vy+.20,1.20),(vx,vy+.06,1.20),.016,'Bronze',parent,12)
        for i in range(3): box('V2_folded_towel',(vx+.48,vy-.02,.98+i*.035),(.25,.28,.032),'LinenLight',parent,.018)
        frame_rect('V2_vanity_mirror_frame',(vx,11.905,1.58),.84,1.10,.025,.025,'Bronze',parent)
    if parent=='Master':
        for y in [8.32,9.15,9.98]:
            box('V2_master_wardrobe_pull',(-5.222,y,1.45),(.035,.025,.48),'Bronze',parent,.005)
            for z in [.48,2.40]: box('V2_master_wardrobe_hinge',(-5.222,y+.31,z),(.025,.065,.10),'Bronze',parent,.004)
        for y in [10.88,11.58]:
            rod('V2_shower_handle',(-10.99,y,1.02),(-10.99,y,1.30),.015,'Bronze',parent,12)
        for yy in [11.37,11.53]: bottle('Master_shower_toiletry',-10.20,yy,1.34,'Master','Soap',.45)
        for yy in [9.99,10.80,11.61]:
            bottle('V2_master_vanity_toiletry',-12.02,yy,.945,'Master','WhiteCeramic',.40)
        for i in range(4):
            box('V2_master_folded_towel',(-11.99,10.80,.956+i*.035),(.28,.34,.032),'LinenLight','Master',.018)
    else:
        for y in [8.48,9.15,9.82]:
            box('V2_guest_wardrobe_door',(-3.765,y,1.42),(.035,.63,2.58),'Linen',parent,.008)
            box('V2_guest_wardrobe_pull',(-3.73,y,1.43),(.035,.022,.44),'Bronze',parent,.005)
            for z in [.46,2.36]: box('V2_guest_wardrobe_hinge',(-3.73,y+.24,z),(.025,.060,.10),'Bronze',parent,.004)

bedroom_details(-7.95,10.05,'Master','VelvetTeal',2.20)
bedroom_details(-1.95,10.05,'Bedroom2','Terracotta',1.80)
plant(-3.92,11.25,'Bedroom2',.48)

# Billiards: inlaid rail sights, pocket rims, ball markings, scoring and a stocked console.
for y in [8.64,10.26]:
    for x in [3.43,3.96,4.50,5.04,5.57]:
        box('V2_pool_diamond',(x,y,1.024),(.045,.045,.009),'DetailCream','Billiards',.004,math.pi/4)
for x in [2.99,6.01]:
    for y in [9.05,9.45,9.85]: box('V2_pool_diamond',(x,y,1.024),(.045,.045,.009),'DetailCream','Billiards',.004,math.pi/4)
for x,y in [(3.04,8.70),(4.50,8.67),(5.96,8.70),(3.04,10.20),(4.50,10.23),(5.96,10.20)]:
    torus('V2_pocket_rim',(x,y,.975),.091,.006,'Bronze','Billiards')
for row in range(4):
    for j in range(row+1):
        i=row*(row+1)//2+j; x=3.85+row*.052; y=9.45+(j-row/2)*.060
        cyl('V2_ball_number',(x,y,1.011),.009,.003,'BallWhite','Billiards',12,.001)
for i in range(12):
    x=2.30+i*.38
    for y in [7.43,11.53]: box('V2_billiard_rug_stitch',(x,y,.077),(.16,.014,.007),'DetailCream','Billiards',.002)
for x in [1.88,2.05,2.22]:
    for z in [.78,1.62]: rod('V2_cue_hook',(x,11.78,z),(x,11.66,z),.012,'Bronze','Billiards',10)
    cyl('V2_cue_tip',(x,11.70,2.035),.015,.025,'SeaAccent','Billiards',12,.002)
box('V2_scoreboard',(7.405,10.60,1.79),(.075,1.65,.72),'Walnut','Billiards',.025)
for z in [1.65,1.93]:
    rod('V2_score_rod',(7.35,9.92,z),(7.35,11.28,z),.012,'Bronze','Billiards',12)
    for i in range(6):
        cyl('V2_score_bead',(7.35,10.00+i*.20,z),.045,.075,'BallRed' if i<2 else 'DetailCream','Billiards',16,.005,(0,math.pi/2,0))
for i in range(4):
    box('V2_score_marker',(7.355,10.00+i*.34,1.79),(.018,.10,.045),'Bronze','Billiards',.004)
bottle('V2_billiard_whisky',6.30,11.62,.94,'Billiards','BottleGreen',.85)
for x in [6.86,7.05]: tumbler('V2_billiard_tumbler',x,11.60,.94,'Billiards')
for x,y in [(6.40,11.42),(6.62,11.42),(6.84,11.42),(7.04,11.42)]:
    cyl('V2_billiard_coaster',(x,y,.938),.075,.012,'Bronze','Billiards',24,.003)
    box('V2_cue_chalk',(x,y,.981),(.045,.045,.055),'SeaAccent','Billiards',.006)
bookstack('V2_billiard_rules',6.42,11.82,.94,'Billiards','DetailCream')
for x in [3.25,3.85,5.15,5.75]: cyl('V2_pendant_fastener',(x,9.45,2.57),.022,.035,'BrushedSteel','Billiards',16,.003)

# Gaming: individual sculpted keycaps, screen UI, audio, headsets, cabling and PC hardware.
for cx,matname in [(9.05,'Screen'),(10.95,'ScreenViolet')]:
    box('V2_keyboard_mat',(cx,10.99,.824),(.72,.29,.007),'DetailInk','Gaming',.018)
    box('V2_mouse_mat',(cx+.48,10.97,.829),(.25,.29,.012),'DetailInk','Gaming',.018)
    for row in range(4):
        for k in range(12):
            box('V2_keycap',(cx-.25+k*.045,10.93+row*.04,.876),(.034,.032,.010),
                'LEDWhite' if (row+k)%11==0 else 'BrushedSteel','Gaming',.003)
    for dx in [-.42,.42]:
        mx=cx+dx
        for j in range(3):
            box('V2_screen_sidebar',(mx-.25+j*.20,11.322,1.43),(.15,.006,.025),
                'LEDWhite' if j==0 else matname,'Gaming',.002)
            box('V2_screen_timeline',(mx-.20+j*.18,11.321,1.24),(.12,.006,.018),'SeaAccent','Gaming',.002)
    for dx in [-.84]:
        box('V2_desk_speaker',(cx+dx,11.18,1.00),(.18,.20,.34),'Graphite','Gaming',.025)
        for z in [.94,1.09]: cyl('V2_speaker_driver',(cx+dx,11.072,z),.050,.018,'BrushedSteel','Gaming',24,.003,(math.pi/2,0,0))
    box('V2_soundbar',(cx,11.20,.89),(.66,.10,.075),'Graphite','Gaming',.018)
    for i in range(8): box('V2_soundbar_grille',(cx-.26+i*.075,11.145,.89),(.025,.012,.032),'BrushedSteel','Gaming',.003)
    cyl('V2_headset_base',(cx-.82,10.70,.84),.11,.025,'Graphite','Gaming',24,.004)
    rod('V2_headset_stand',(cx-.82,10.70,.85),(cx-.82,10.70,1.20),.015,'BrushedSteel','Gaming',12)
    torus('V2_headset_band',(cx-.82,10.70,1.22),.11,.018,'Graphite','Gaming',(math.pi/2,0,0))
    for dx in [-.10,.10]: sphere('V2_headset_earcup',(cx-.82+dx,10.70,1.19),(.040,.055,.070),'Graphite','Gaming',16,8)
    rod('V2_keyboard_cable',(cx,11.10,.85),(cx,11.29,.85),.007,'DetailInk','Gaming',8)
    rod('V2_monitor_cable',(cx,11.29,.85),(cx+.18,11.34,.85),.007,'DetailInk','Gaming',8)
    for z in [.34,.64]: torus('V2_pc_fan_ring',(cx+.78,10.932,z),.085,.009,'LEDWhite','Gaming',(math.pi/2,0,0))
    for i in range(6): box('V2_pc_vent',(cx+.67+i*.043,10.96,.91),(.018,.012,.10),'BrushedSteel','Gaming',.003)
    for z in [.76,.90,1.04,1.18,1.32]:
        for dx in [-.19,.19]: box('V2_chair_stitch',(cx+dx,9.728,z),(.12,.009,.012),'VelvetTeal','Gaming',.003)
bookstack('V2_gaming_notebook',9.25,8.10,.575,'Gaming','SeaAccent')
cup('V2_gaming_cup',9.25,8.10,.58,'Gaming',.72)

# Terrace: laid stone, four-person coffee service, lantern light, grounded chaises and hardware.
box('V2_terrace_finish',(0,-1.65,.006),(24.92,3.22,.012),'Limestone','Terrace',.006)
for x in range(-12,13,2): box('V2_terrace_joint',(x,-1.65,.014),(.008,3.18,.003),'ShadowGap','Terrace',0)
for y in [-.55,-1.65,-2.75]: box('V2_terrace_joint',(0,y,.014),(24.85,.008,.003),'ShadowGap','Terrace',0)
for x in [-12.35+i*1.3 for i in range(20)]:
    for z in [.18,.92]: sphere('V2_balustrade_bolt',(x,-3.255,z),(.024,.012,.024),'BrushedSteel','Terrace',12,6)
for x,y in [(-6.63,-1.93),(-5.58,-1.52)]: cup('V2_terrace_coffee',x,y,.805,'Terrace',.90)
for x,y in [(-6.38,-1.55),(-5.83,-1.88),(-6.63,-1.93),(-5.58,-1.52)]:
    spoon('V2_coffee_spoon',x+.13,y,.817,'Terrace')
    box('V2_linen_napkin',(x-.14,y,.812),(.11,.16,.020),'Linen','Terrace',.010)
for x,y in [(-6.48,-1.24),(-5.77,-2.10)]:
    plate('V2_pastry_plate',x,y,.807,'Terrace',.14)
    for dx in [-.045,.045]: sphere('V2_croissant',(x+dx,y,.858),(.065,.038,.035),'Pastry','Terrace',16,8)
cyl('V2_cafetiere_lid',(-6.08,-1.53,.994),.078,.018,'BrushedSteel','Terrace',28,.004)
sphere('V2_cafetiere_knob',(-6.08,-1.53,1.017),(.025,.025,.025),'Walnut','Terrace',16,8)
torus('V2_cafetiere_handle',(-5.98,-1.53,.90),.065,.012,'BrushedSteel','Terrace',(math.pi/2,0,0))
cyl('V2_sugar_bowl',(-6.08,-1.91,.855),.065,.10,'WhiteCeramic','Terrace',24,.010)
cyl('V2_sugar_lid',(-6.08,-1.91,.913),.070,.018,'Bronze','Terrace',24,.004)
for x in [4.25,6.20]:
    for dx in [-.38,.38]:
        for yy in [-2.43,-.98]: cyl('V2_chaise_foot',(x+dx,yy,.13),.035,.18,'Bronze','Terrace',16,.004)
    for yy in [-2.38,-2.05,-1.72,-1.39]: box('V2_chaise_stitch',(x,yy,.555),(.82,.012,.008),'DetailCream','Terrace',.002)
    sphere('V2_chaise_pillow_button',(x,-.70,.956),(.020,.020,.008),'Bronze','Terrace',12,6)
bookstack('V2_terrace_reading',5.22,-1.60,.575,'Terrace','Terracotta')
for x,y in [(-10.15,-1.00),(9.80,-1.05)]:
    box('V2_lantern_base',(x,y,.065),(.32,.32,.09),'Bronze','Terrace',.025)
    box('V2_lantern_glass',(x,y,.33),(.25,.25,.45),'GlassBalustrade','Terrace',.012)
    box('V2_lantern_top',(x,y,.59),(.32,.32,.09),'Bronze','Terrace',.025)
    cyl('V2_lantern_candle',(x,y,.24),.055,.25,'CoveLight','Terrace',20,.006)
    for dx in [-.13,.13]:
        for dy in [-.13,.13]: rod('V2_lantern_frame',(x+dx,y+dy,.10),(x+dx,y+dy,.56),.012,'Bronze','Terrace',10)
    torus('V2_lantern_handle',(x,y,.69),.11,.012,'Bronze','Terrace',(math.pi/2,0,0))
for i in range(12):
    x=3.35+i*.34
    for y in [-.42,-2.82]: box('V2_terrace_rug_stitch',(x,y,.043),(.14,.014,.007),'DetailCream','Terrace',.002)
for px in [-11.45,10.95]:
    for i in range(8):
        a=i*2.399; r=.08+(i%3)*.035
        sphere('V2_planter_pebble',(px+math.cos(a)*r,-1.65+math.sin(a)*r,.425),(.025,.020,.015),'DetailCream','Terrace',12,6)

# Verify actual mesh deltas, not a textual promise of detail density.
bpy.context.view_layer.update()
detail_added = {name: root_mesh_count(name)-detail_baseline[name] for name in detail_baseline}
for name,count in detail_added.items():
    assert count >= 50, f'{name} needs 50 visible additions, got {count}'
scene['v2_detail_counts'] = json.dumps(detail_added, sort_keys=True)
root['v2_detail_counts'] = scene['v2_detail_counts']

# ---------- validation, editable source and scoped raw glTF ----------
bpy.context.view_layer.update()
mesh_objects=[o for o in scene.objects if o.type=='MESH']
assert len(mesh_objects)>300, 'Scene is unexpectedly empty'
assert scene['interior_area_m2']==300.0
assert all(math.isfinite(v) for o in mesh_objects for v in o.location), 'Non-finite transform'
scene['mesh_object_count']=len(mesh_objects)
scene['room_program']='84 living / 49 wine+dining / 42 kitchen / 40 master / 30 bedroom / 30 billiards / 25 gaming'
# cameras and lights are authoring-only; only the residence hierarchy is exported
for ob in scene.objects: ob.select_set(False)
def belongs(ob):
    p=ob
    while p:
        if p==root: return True
        p=p.parent
    return False
for ob in scene.objects:
    if belongs(ob) and ob.type in {'MESH','EMPTY'}: ob.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
bpy.ops.export_scene.gltf(filepath=str(RAW),export_format='GLB',use_selection=True,
    export_apply=True,export_animations=False,export_cameras=False,export_lights=False,
    export_extras=True,export_image_format='AUTO',export_draco_mesh_compression_enable=False)
print(json.dumps({'status':'built','blend':str(BLEND),'raw_glb':str(RAW),
    'mesh_objects':len(mesh_objects),'interior_area_m2':300,'terrace_area_m2':82.5,
    'ceiling_height_m':3.4,'v2_detail_counts':detail_added,'raw_bytes':RAW.stat().st_size},indent=2))
