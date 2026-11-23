import sys, json, base64
from playwright.sync_api import sync_playwright
TEXT = {"title":{"on":True,"v":"Signal and noise"},"subtitle":{"on":True,"v":"A modular identity system"},
 "info":{"on":True,"v":[{"k":"Where","v":"Lisboa"},{"k":"When","v":"23 Nov 2026"},{"k":"Seed","v":"4F2A-19"}]},
 "caption":{"on":True,"v":"Vol. 01 — generated, not drawn"}}
fonts=['800 40px "ID Sans"','400 40px "ID Sans"','500 40px "ID Sans"','700 40px "ID Sans"','800 40px "ID Display"','italic 400 40px "ID Serif"','400 40px "ID Mono"','400 40px "ID Heavy"','400 40px "ID Black"','800 40px "ID Wide"','400 40px "ID Pixel"']
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto("file:///home/claude/idkit/probe.html")
    pg.evaluate("async (f)=>{for(const x of f) await document.fonts.load(x)}",fonts)
    for a in sys.argv[1:]:
        st,s,fmt=a.split(","); s=int(s)
        spec={"style":st,"format":fmt,"seeds":{"layout":s*7919+1,"colour":s*104729+3,"motif":s*1299709+5},"text":TEXT}
        u=pg.evaluate("([spec])=>{const c=document.getElementById('c');const d=IDK.FORMATS[spec.format];c.width=d[0];c.height=d[1];IDK.render(c.getContext('2d'),spec,null);return c.toDataURL('image/jpeg',0.92)}",[spec])
        open(f"out/v2-{st}-{s}-{fmt.replace(':','x')}.jpg","wb").write(base64.b64decode(u.split(",")[1]))
    b.close()
