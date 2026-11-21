"""Metric Cycles finishes for the Nice apartment, using the viewer's packed scans.

Call configure_finishes(project_root) after importing the GLB additions. Geometry
Position and Normal are world-space shader inputs. No UVs or applied object
scales are required. All linked images are packed into the current .blend.
"""
from pathlib import Path
import re

import bpy


# Filename, measured sample width and height in metres. See src/surfaces.js.
SAMPLES = {
    "oak": ("oak_veneer_01", 1.83, 1.83),
    "walnut": ("natural_walnut_veneer", 1, 1),
    "stone": ("Travertine001", 1.2, 1.2),
    "linen": ("rough_linen", .2707, .2713),
    "wool": ("wool_boucle", .3148, .3901),
    "leather": ("leather_red_02", .60, .60),
    "plaster": ("white_plaster_02", 1, 1),
}

# Sample, sRGB finish, relative colour contrast, roughness, roughness range,
# relief in millimetres. Web and native finishes use the same physical response.
FINISHES = {
    "Plaster": ("plaster", "e8e1d5", .10, .84, .12, .35),
    "Ceiling": ("plaster", "efece4", .055, .89, .08, .18),
    "Limestone": ("stone", "cfc4b3", .23, .51, .22, .34),
    "Travertine": ("stone", "bfaa8f", .48, .43, .29, .90),
    "OakLight": ("oak", "c9a781", .48, .54, .22, .22),
    "Oak": ("oak", "aa835e", .52, .49, .23, .22),
    "Walnut": ("walnut", "73513b", .61, .44, .21, .22),
    "Linen": ("linen", "cdc1a9", .36, .91, .13, .78),
    "LinenLight": ("linen", "e1d8c5", .32, .91, .13, .78),
    "Boucle": ("wool", "dfd5c3", .51, .92, .12, 2.2),
    "Rug": ("wool", "b8ad9b", .55, .95, .09, 2.5),
    "RugLine": ("wool", "65736d", .45, .94, .09, 2.1),
    "VelvetTeal": ("linen", "456763", .18, .82, .16, .27),
    "PoolFelt": ("linen", "33584e", .085, .94, .07, .09),
    "LeatherCognac": ("leather", "98623f", .36, .53, .24, .70),
    "LinenVoile": ("linen", "f1eadc", .23, .93, .10, .14),
}


def rgb(hex_value):
    encoded = [int(hex_value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in encoded)


def node(tree, node_type, x, y, label=None):
    result = tree.nodes.new(node_type)
    result.location = (x, y)
    if label:
        result.label = label
    return result


def feed(tree, value, target):
    if isinstance(value, bpy.types.NodeSocket):
        tree.links.new(value, target)
    else:
        target.default_value = value


def vector(tree, operation, a, b, x, y, label):
    n = node(tree, "ShaderNodeVectorMath", x, y, label)
    n.operation = operation
    feed(tree, a, n.inputs[0])
    if b is not None:
        feed(tree, b, n.inputs["Scale"] if operation == "SCALE" else n.inputs[1])
    return n.outputs["Value" if operation == "DOT_PRODUCT" else "Vector"]


def scalar(tree, operation, values, x, y, label):
    n = node(tree, "ShaderNodeMath", x, y, label)
    n.operation = operation
    for i, value in enumerate(values):
        feed(tree, value, n.inputs[i])
    return n.outputs[0]


def combine(tree, values, x, y, label):
    n = node(tree, "ShaderNodeCombineXYZ", x, y, label)
    for i, value in enumerate(values):
        feed(tree, value, n.inputs[i])
    return n.outputs[0]


def projection_group(sample, image):
    filename, width, height = SAMPLES[sample]
    name = "AZUR · metric projection · " + filename
    existing = bpy.data.node_groups.get(name)
    if existing:
        return existing
    tree = bpy.data.node_groups.new(name, "ShaderNodeTree")
    tree.interface.new_socket(name="Scan RGB", in_out="OUTPUT", socket_type="NodeSocketColor")
    geometry = node(tree, "ShaderNodeNewGeometry", -1250, 70, "World position (metres) and normal")
    axes = node(tree, "ShaderNodeSeparateXYZ", -1050, 470, "Blender Z is vertical")
    feed(tree, geometry.outputs["Position"], axes.inputs[0])
    x, y, z = axes.outputs
    reverse_y = scalar(tree, "MULTIPLY", (y, -1), -860, 650, "Match the viewer's sea axis")
    magnitude = vector(tree, "ABSOLUTE", geometry.outputs["Normal"], None, -1050, -290, "Unsigned normal")
    squared = vector(tree, "MULTIPLY", magnitude, magnitude, -915, -330, "Square")
    cubed = vector(tree, "MULTIPLY", squared, magnitude, -810, -340, "Cube")
    weights = vector(tree, "MULTIPLY", cubed, cubed, -705, -330, "Blend across bevels")
    total = vector(tree, "DOT_PRODUCT", weights, (1, 1, 1), -650, -510, "Sum of three weights")
    axes_weight = node(tree, "ShaderNodeSeparateXYZ", -420, -330, "Axis contribution")
    feed(tree, weights, axes_weight.inputs[0])
    layers = []
    for index, (uv, h, label) in enumerate([
        ((reverse_y, z, 0), 800, "Side walls"),
        ((x, z, 0), 420, "Front walls"),
        ((x, reverse_y, 0), 40, "Horizontal surfaces"),
    ]):
        coords = combine(tree, uv, -650, h, label)
        tex_coords = vector(tree, "MULTIPLY", coords, (1/width, 1/height, 1), -440, h,
                            f"{width:g} × {height:g} m")
        tex = node(tree, "ShaderNodeTexImage", -220, h, label + " · raw channels")
        tex.image = image
        tex.interpolation = "Linear"
        tex.extension = "REPEAT"
        feed(tree, tex_coords, tex.inputs["Vector"])
        layers.append(vector(tree, "SCALE", tex.outputs["Color"], axes_weight.outputs[index],
                             60, h, label + " weight"))
    summed = vector(tree, "ADD", layers[0], layers[1], 270, 580, "Vertical faces")
    summed = vector(tree, "ADD", summed, layers[2], 470, 420, "All three planes")
    reciprocal = scalar(tree, "DIVIDE", (1, total), 280, -170, "Normalize transitions")
    packed = vector(tree, "SCALE", summed, reciprocal, 690, 420, "Packed scan")
    output = node(tree, "NodeGroupOutput", 910, 420)
    feed(tree, packed, output.inputs["Scan RGB"])
    return tree


def new_surface(material):
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = node(tree, "ShaderNodeOutputMaterial", 860, 180)
    return tree, output


def scanned_material(material, kind, group):
    sample, colour, contrast, roughness, rough_range, mm = FINISHES[kind]
    tree, output = new_surface(material)
    measured = node(tree, "ShaderNodeGroup", -920, 150, "Measured surface in world metres")
    measured.node_tree = group
    measured.width = 220
    channels = node(tree, "ShaderNodeSeparateColor", -640, 150, "R colour · G roughness · B height")
    feed(tree, measured.outputs[0], channels.inputs[0])
    colour_factor = scalar(tree, "MULTIPLY_ADD", (channels.outputs["Red"], contrast, 1-.5*contrast),
                           -410, 320, "Colour variation around the sample median")
    tint = rgb(colour)
    base = vector(tree, "SCALE", tint, colour_factor, -170, 320, "Finish tint")
    rough = scalar(tree, "MULTIPLY_ADD", (channels.outputs["Green"], rough_range, roughness-.5*rough_range),
                   -410, 80, "Measured roughness")
    bump = node(tree, "ShaderNodeBump", -170, -140, "Physical relief in metres")
    bump.inputs["Distance"].default_value = mm / 1000
    bump.inputs["Strength"].default_value = 1
    feed(tree, channels.outputs["Blue"], bump.inputs["Height"])
    bs = node(tree, "ShaderNodeBsdfPrincipled", 100, 300, kind)
    feed(tree, base, bs.inputs["Base Color"])
    feed(tree, rough, bs.inputs["Roughness"])
    feed(tree, bump.outputs[0], bs.inputs["Normal"])
    bs.inputs["IOR"].default_value = 1.48
    if sample in ("linen", "wool"):
        bs.inputs["Sheen Weight"].default_value = .38 if kind == "VelvetTeal" else .17
        bs.inputs["Sheen Roughness"].default_value = .64
    elif sample in ("oak", "walnut", "leather"):
        bs.inputs["Coat Weight"].default_value = .12 if sample == "leather" else .055
        bs.inputs["Coat Roughness"].default_value = .37
    material.diffuse_color = (*tint, 1)
    shader = bs.outputs[0]
    if kind == "LinenVoile":
        # The exported fabric has coincident opposing windings. The backface
        # passes through, so one physical layer only scatters once.
        material.use_backface_culling = False
        translucent = node(tree, "ShaderNodeBsdfTranslucent", 100, -410, "Linen fibres in backlight")
        translucent.inputs[0].default_value = (*tint, 1)
        scatter = node(tree, "ShaderNodeMixShader", 350, 100, "Thin woven cloth")
        scatter.inputs[0].default_value = .38
        feed(tree, shader, scatter.inputs[1])
        feed(tree, translucent.outputs[0], scatter.inputs[2])
        geometry = node(tree, "ShaderNodeNewGeometry", 80, -610)
        clear = node(tree, "ShaderNodeBsdfTransparent", 350, -440, "Open weave")
        opacity = scalar(tree, "MULTIPLY_ADD", (geometry.outputs["Backfacing"], .64, .36),
                         350, -170, "One fabric face and its open weave")
        mixed = node(tree, "ShaderNodeMixShader", 590, 180)
        feed(tree, opacity, mixed.inputs[0])
        feed(tree, scatter.outputs[0], mixed.inputs[1])
        feed(tree, clear.outputs[0], mixed.inputs[2])
        shader = mixed.outputs[0]
    feed(tree, shader, output.inputs["Surface"])


def glazing(material, kind):
    tree, output = new_surface(material)
    tint = rgb("e2eee8" if kind == "GlassBalustrade" else "fcfefd")
    glass = node(tree, "ShaderNodeBsdfGlass", 50, 250, "Clear dielectric glass")
    glass.inputs["Color"].default_value = (*tint, 1)
    glass.inputs["IOR"].default_value = 1.50
    glass.inputs["Roughness"].default_value = .018 if kind == "WineGlass" else .009
    clear = node(tree, "ShaderNodeBsdfTransparent", 50, 30, "Transmit direct daylight")
    rays = node(tree, "ShaderNodeLightPath", -180, -160)
    mix = node(tree, "ShaderNodeMixShader", 380, 180, "Clear daylight through closed panes")
    feed(tree, rays.outputs["Is Shadow Ray"], mix.inputs[0])
    feed(tree, glass.outputs[0], mix.inputs[1])
    feed(tree, clear.outputs[0], mix.inputs[2])
    feed(tree, mix.outputs[0], output.inputs["Surface"])
    material.diffuse_color = (*tint, .12)


METALS = {
    "Mirror": ("f1f3f2", 1.0, .021),
    "Bronze": ("a98b62", .9, .31),
    "BrushedSteel": ("a9b0ae", .94, .30),
    "WhiteCeramic": ("eeece4", 0, .20),
}
GLASS = {"Glass", "GlassBalustrade", "WineGlass"}


def configure_finishes(project_root):
    """Configure known interior materials and pack their seven scanned images."""
    texture_dir = Path(project_root).resolve() / "public" / "textures" / "interior"
    groups = {}
    for sample, (filename, *_dims) in SAMPLES.items():
        path = texture_dir / (filename + ".webp")
        if not path.is_file():
            raise FileNotFoundError(f"Missing interior scan: {path}")
        image = bpy.data.images.load(str(path), check_existing=True)
        image.colorspace_settings.name = "Non-Color"
        if not image.packed_file:
            image.pack()
        groups[sample] = projection_group(sample, image)

    changed = 0
    for material in bpy.data.materials:
        kind = re.sub(r"(?:\.\d{3})+$", "", material.name)
        if kind in FINISHES:
            scanned_material(material, kind, groups[FINISHES[kind][0]])
        elif kind in GLASS:
            glazing(material, kind)
        elif kind in METALS:
            colour, metal, rough = METALS[kind]
            tree, output = new_surface(material)
            bs = node(tree, "ShaderNodeBsdfPrincipled", 420, 200, kind)
            tint = (*rgb(colour), 1)
            bs.inputs["Base Color"].default_value = tint
            bs.inputs["Metallic"].default_value = metal
            bs.inputs["Roughness"].default_value = rough
            feed(tree, bs.outputs[0], output.inputs["Surface"])
            material.diffuse_color = tint
        else:
            continue
        changed += 1
    return {"materials": changed, "packed_scans": len(groups)}
