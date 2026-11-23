import sys, json, base64, io
from playwright.sync_api import sync_playwright
from PIL import Image
style, n, start = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
TEXT = {"title":{"on":True,"v":"Signal and noise"},"subtitle":{"on":True,"v":"A modular identity system"},
 "info":{"on":True,"v":[{"k":"Where","v":"Lisboa"},{"k":"When","v":"23 Nov 2026"},{"k":"Seed","v":"4F2A-19"}]},
 "caption":{"on":True,"v":"Vol. 01 — generated, not drawn"}}
js = """async ([spec])=>{await document.fonts.load('800 40px "ID Sans"');await document.fonts.load('400 40px "ID Sans"');await document.fonts.load('500 40px "ID Sans"');await document.fonts.load('700 40px "ID Sans"');await document.fonts.load('800 40px "ID Display"');await document.fonts.load('italic 400 40px "ID Serif"');await document.fonts.load('400 40px "ID Mono"');await document.fonts.load('400 40px "ID Heavy"');await document.fonts.load('400 40px "ID Black"');await document.fonts.load('800 40px "ID Wide"');await document.fonts.load('400 40px "ID Pixel"');
const c=document.getElementById('c');const d=IDK.FORMATS[spec.format];c.width=d[0];c.height=d[1];IDK.render(c.getContext('2d'),spec,null);return c.toDataURL('image/jpeg',0.9)}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto("file:///home/claude/idkit/probe.html")
    ims=[]
    for i in range(n):
        s=start+i; fmt=["1:1","3:4","9:16"][i%3]
        spec={"style":style,"format":fmt,"seeds":{"layout":s*7919+1,"colour":s*104729+3,"motif":s*1299709+5},"text":TEXT}
        if len(sys.argv)>4: spec["motif"]=sys.argv[4]
        u=pg.evaluate(js,[spec]); ims.append(Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))))
    b.close()
h=600; ims=[im.resize((int(im.width*h/im.height),h)) for im in ims]
W=sum(i.width for i in ims)+10*(len(ims)+1); sh=Image.new("RGB",(W,h+20),(40,40,44)); x=10
for im in ims: sh.paste(im,(x,10)); x+=im.width+10
sh.save(f"sheet_{style}_{start}.jpg",quality=85); print(sh.size)
