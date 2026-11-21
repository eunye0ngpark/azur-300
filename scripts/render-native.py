"""Render named cameras from the .blend. Arguments after -- are dir, width, samples, camera numbers."""
import sys
from pathlib import Path
import bpy

args=sys.argv[sys.argv.index('--')+1:]
out=Path(args[0]).resolve()
out.mkdir(exist_ok=True,parents=True)
scene=bpy.context.scene
width=int(args[1])
scene.render.resolution_x=width
scene.render.resolution_y=round(width*10/16)
scene.render.resolution_percentage=100
scene.cycles.samples=int(args[2])
scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='METAL'
    prefs.refresh_devices()
    for device in prefs.devices:device.use=(device.type=='METAL')
    if any(d.use for d in prefs.devices):scene.cycles.device='GPU'
except (TypeError,RuntimeError):
    pass
labels={'01':'客厅','02':'露台','03':'主卧','04':'餐厅'}
for number in args[3:]:
    scene.camera=next(o for o in scene.objects if o.type=='CAMERA' and o.name.startswith(number+' ·'))
    scene.render.filepath=str(out/(labels[number]+'.jpg'))
    bpy.ops.render.render(write_still=True)
    print('RENDERED',scene.render.filepath,flush=True)
