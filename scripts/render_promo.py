#!/usr/bin/env python3
import argparse,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser()
p.add_argument('--url',default='http://127.0.0.1:4174/?capture&promo')
p.add_argument('--out',default='/mnt/agents/output/app/renders/frames30')
p.add_argument('--fps',type=int,default=30);p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=959)
p.add_argument('--width',type=int,default=1280);p.add_argument('--height',type=int,default=720)
p.add_argument('--format',choices=['png','jpeg'],default='png')
p.add_argument('--reverse',action='store_true')
a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':a.width,'height':a.height},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(a.url,wait_until='load',timeout=120000)
    page.wait_for_function('window.__SCENE_READY__===true',timeout=180000)
    page.wait_for_function('!!window.promo && window.promo.duration===32',timeout=30000)
    print(f'READY {a.start}-{a.end} {a.width}x{a.height} {a.fps}fps',flush=True)
    began=time.time()
    indices=range(a.start,a.end+1) if not a.reverse else range(a.end,a.start-1,-1)
    for i in indices:
        dest=out/f'frame_{i:04d}.{a.format}'
        if dest.exists() and dest.stat().st_size>1000:continue
        t=i/a.fps
        mime='image/png' if a.format=='png' else 'image/jpeg'
        data=page.evaluate('''({t,mime})=>{window.promo.renderAt(t);return document.querySelector('#scene').toDataURL(mime,0.98);}''',{'t':t,'mime':mime})
        import base64
        dest.write_bytes(base64.b64decode(data.split(',',1)[1]))
        if i%6==0 or i==a.end:print(f'FRAME {i} TIME {t:.2f} ELAPSED {time.time()-began:.1f}',flush=True)
        if errors:raise RuntimeError('; '.join(errors))
    browser.close()
print('DONE',flush=True)
