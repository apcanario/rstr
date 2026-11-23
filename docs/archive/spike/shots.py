import json, base64, io, urllib.parse, subprocess, os
from playwright.sync_api import sync_playwright
from PIL import Image
def st(**k): return "file:///home/claude/idkit/app.html?s="+urllib.parse.quote(json.dumps(k))
T=lambda title,sub,cap:{"title":{"on":True,"v":title},"subtitle":{"on":True,"v":sub},"info":{"on":True,"v":[{"k":"Where","v":"Lisboa"},{"k":"When","v":"23 Nov 2026"},{"k":"Seed","v":""}]},"caption":{"on":True,"v":cap}}
sd=lambda s:{"layout":s*7919+1,"colour":s*104729+3,"motif":s*1299709+5}
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=b.new_page(viewport={"width":412,"height":915},device_scale_factor=2.625)
    def shot(name,url,click=None):
        pg.goto(url); pg.wait_for_function("window.READY===1")
        for c in (click or []): pg.click(c)
        pg.wait_for_timeout(200); pg.screenshot(path=f"out/{name}.png")
        Image.open(f"out/{name}.png").convert("RGB").save(f"out/{name}.jpg",quality=90); os.remove(f"out/{name}.png")
    tx=T("Signal and noise","A modular identity system","Vol. 01 — generated, not drawn")
    shot("ui-1-style", st(style="swiss",format="3:4",seeds=sd(21),motif="topo",palette=4,text=tx,locks={"colour":True}))
    shot("ui-2-text", st(style="pomo",format="9:16",seeds=sd(16),tab="text",text=tx))
    shot("ui-3-export", st(style="swiss",format="1:1",seeds=sd(5),tab="motif",motif="bars",palette=5,text=tx), ["#exp"])
    # full-res outputs from the same engine
    def out(name,spec,q=0.93):
        u=pg.evaluate("""([spec])=>{const c=document.createElement('canvas');const d=IDK.FORMATS[spec.format];c.width=d[0];c.height=d[1];IDK.render(c.getContext('2d'),spec,null);return c.toDataURL('image/jpeg',%s)}"""%q,[spec])
        open(f"out/{name}.jpg","wb").write(base64.b64decode(u.split(",")[1]))
    tx["info"]["v"][2]["v"]="0C4F-2A19"
    # one seed, three formats (Swiss / topo / Cobalt)
    for f in ["1:1","3:4","9:16"]:
        out("swiss-topo-"+f.replace(":","x"),{"style":"swiss","format":f,"seeds":sd(21),"motif":"topo","palette":4,"layout":1,"text":tx})
    out("swiss-bars-3x4",{"style":"swiss","format":"3:4","seeds":sd(5),"motif":"bars","palette":5,"text":T("Form follows grid","Twelve posters, one rule set","Series B — bars / pine")|{"info":tx["info"]}})
    out("swiss-dots-1x1",{"style":"swiss","format":"1:1","seeds":sd(1),"motif":"dots","palette":2,"text":T("Quiet systems","Evening programme","Series C — dots / night")|{"info":tx["info"]}})
    out("swiss-blocks-9x16",{"style":"swiss","format":"9:16","seeds":sd(9),"motif":"blocks","palette":0,"text":T("Raster","Blocks, rules and one red","Series A — blocks / paper")|{"info":tx["info"]}})
    out("pomo-1x1",{"style":"pomo","format":"1:1","seeds":sd(11),"text":tx})
    out("pomo-9x16",{"style":"pomo","format":"9:16","seeds":sd(16),"text":tx})
    for st_,sds in (("brutal",[(4,"1:1"),(2,"3:4"),(6,"9:16")]),("vapor",[(4,"1:1"),(2,"3:4"),(3,"9:16")])):
        for s_,f in sds: out(f"{st_}-{f.replace(':','x')}",{"style":st_,"format":f,"seeds":sd(s_),"text":tx})
    shot("ui-4-brutal", st(style="brutal",format="3:4",seeds=sd(2),tab="colour",text=tx))
    out("swiss-notext-1x1",{"style":"swiss","format":"1:1","seeds":sd(23),"motif":"topo","palette":2,"text":{k:{"on":False,"v":v["v"]} for k,v in tx.items()}})
    # motion: 6 s story, frames from the same render() with a time argument
    os.makedirs("frames",exist_ok=True)
    spec={"style":"swiss","format":"9:16","seeds":sd(21),"motif":"topo","palette":4,"layout":1,"text":tx}
    pg.evaluate("()=>{window.MC=document.createElement('canvas');MC.width=1080;MC.height=1920}")
    for i in range(0):
        u=pg.evaluate("([spec,s])=>{IDK.render(MC.getContext('2d'),spec,{s:s,dur:6});return MC.toDataURL('image/jpeg',0.9)}",[spec,i/30])
        open(f"frames/{i:04d}.jpg","wb").write(base64.b64decode(u.split(",")[1]))
    b.close()
#subprocess.run("ffmpeg -y -loglevel error -framerate 30 -i frames/%04d.jpg -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart out/swiss-topo-9x16-motion.mp4",shell=True,check=True)
print(os.listdir("out"))
