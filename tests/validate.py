from pathlib import Path
from html.parser import HTMLParser
import subprocess, tempfile
root=Path(__file__).resolve().parents[1]
pages=list(root.glob("*.html"))
assert len(pages)>=9, f"Недостатньо сторінок: {len(pages)}"
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__(); self.scripts=[]; self.links=[]; self.inline=False; self.lang=False; self.current=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=="html" and attrs.get("lang")=="uk": self.lang=True
        if tag in ("a","link","script","img"):
            u=attrs.get("href") or attrs.get("src")
            if u and not u.startswith(("https://","http://","#","mailto:","data:")):
                self.links.append(u.split("?")[0].split("#")[0])
        if tag=="script" and not attrs.get("src") and attrs.get("type") not in ("application/ld+json","application/json"):self.inline=True;self.current=[]
    def handle_data(self,data):
        if self.inline:self.current.append(data)
    def handle_endtag(self,tag):
        if tag=="script" and self.inline:self.scripts.append("".join(self.current));self.inline=False
for page in pages:
    ins=Inspect();ins.feed(page.read_text(encoding="utf-8"))
    assert ins.lang, f"{page.name}: lang uk не задано"
    for link in ins.links:
        assert (root/link).exists(), f"{page.name}: відсутній {link}"
    for script in ins.scripts:
        if script.strip():
            with tempfile.NamedTemporaryFile(mode="w",suffix=".js",encoding="utf-8") as f:
                f.write(script);f.flush()
                p=subprocess.run(["node","--check",f.name],capture_output=True,text=True)
                assert p.returncode==0, f"{page.name}: {p.stderr}"
for path in root.glob("*.js"):
    p=subprocess.run(["node","--check",str(path)],capture_output=True,text=True)
    assert p.returncode==0, f"{path.name}: {p.stderr}"
assert (root/"robots.txt").exists() and (root/"sitemap.xml").exists()
print(f"OK: {len(pages)} HTML-сторінок, перевірені локальні посилання та синтаксис JavaScript")
