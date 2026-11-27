from pathlib import Path
import requests, fitz
URL="https://hsc.gov.ua/wp-content/uploads/2025/11/POLOTNO-NAKAZ_04_09_2025%20%281%29.pdf"
u="https://hsc.gov.ua/wp-content/uploads/2025/11/Numer_-vidpovidej-do-nakazu.pdf"
for name,url in [("questions",URL),("answers",u)]:
 r=requests.get(url,timeout=150,headers={"User-Agent":"Mozilla/5.0"},stream=True)
 print(name,"http",r.status_code,"len",r.headers.get("Content-Length"),"type",r.headers.get("Content-Type"),flush=True)
 r.raise_for_status()
 p=Path("/tmp/drive-"+name+".pdf")
 with p.open("wb") as f:
  for b in r.iter_content(1<<20):f.write(b)
 print(name,"size",p.stat().st_size,flush=True)
 doc=fitz.open(p)
 print(name,"pages",len(doc),"metadata",doc.metadata,flush=True)
 for i in range(min(4,len(doc))):
  page=doc[i]
  txt=page.get_text("text")
  print(name,"PAGE",i,"images",len(page.get_images()),"text_chars",len(txt),"size",page.rect,flush=True)
  print(txt[:6500],flush=True)
 print("End",name,flush=True)
