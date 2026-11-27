#!/usr/bin/env python3
"""Завантажує тільки ідентифіковані ілюстрації маршрутів Харківщини з pdr.infotech.gov.ua.

Джерела: Харків 6341/6342, Лозова 6348, Пісочин 6350.
Заборона вгадування номерів або URL: публікує лише якщо всі сторінки прочитано повністю.
"""
import json
import re
import sys
from html import unescape
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlsplit

import requests
from bs4 import BeautifulSoup

PAGES = [
    ("https://pdr.infotech.gov.ua/instructions/28", [("6341", 20), ("6342", 20)]),
    ("https://pdr.infotech.gov.ua/instructions/130", [("6348", 5)]),
    ("https://pdr.infotech.gov.ua/instructions/167", [("6350", 10)]),
]
OUT = Path(__file__).resolve().parent.parent / "kharkiv-schemes.js"
UA = "Mozilla/5.0 (compatible; DriveReadyUA/1.0; +https://drive-ready-ua.onrender.com/)"
result = {}
references = {}

def extract_image(url):
    url = unescape(url.strip())
    if url.startswith("//"):
        url = "https:" + url
    if url.startswith("/"):
        url = urljoin("https://pdr.infotech.gov.ua/", url)
    if "/_next/image?" in url:
        query = parse_qs(urlsplit(url).query)
        raw = query.get("url", [""])[0]
        url = unquote(raw)
    if not url.startswith("https://"):
        return None
    host = urlsplit(url).hostname
    if host not in ("web.testpdr.com", "pdr.infotech.gov.ua"):
        return None
    if "markdown-images/" not in url or not re.search(r"\.(png|jpe?g|webp)$", url, re.I):
        return None
    return url

for page_url, centers in PAGES:
    response = requests.get(page_url, headers={"User-Agent": UA}, timeout=35)
    print("FETCH", page_url, response.status_code, len(response.content), flush=True)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    # Next image optimization contains original high-quality image URL.
    seen = set()
    found = []
    for el in soup.find_all("img"):
        candidates = [el.get("src", ""), el.get("data-src", "")]
        srcset = el.get("srcset", "") or ""
        candidates += [item.strip().split(" ")[0] for item in srcset.split(",")]
        for candidate in candidates:
            original = extract_image(candidate)
            if original and original not in seen:
                seen.add(original)
                found.append(original)
    expected = sum(count for _, count in centers)
    print("EXTRACTED", len(found), "EXPECTED", expected, flush=True)
    if len(found) != expected:
        raise RuntimeError("Кількість схем не збігається з опублікованими: %s, %s" % (len(found), expected))
    offset = 0
    for code, count in centers:
        images = found[offset:offset+count]
        result[code] = [[str(i+1), img] for i, img in enumerate(images)]
        references[code] = page_url
        offset += count

if sum(len(x) for x in result.values()) != 55:
    raise RuntimeError("Не всі 55 маршрутів знайдено")
content = (
  "/* Джерело: https://pdr.infotech.gov.ua/instructions/28, /130, /167\n"
  " * Схеми дзеркально публікує інший ресурс. Права на зображення залишаються власникам.\n"
  " * Маршрути потребують перевірки на актуальність перед іспитом.\n"
  " */\n"
  "window.DRU_KHARKIV_SCHEMAS=" + json.dumps(result, ensure_ascii=False, indent=2) + ";\n"
  "window.DRU_KHARKIV_SOURCES=" + json.dumps(references, ensure_ascii=False, indent=2) + ";\n"
)
OUT.write_text(content, encoding="utf-8")
print("OK", len(result), "ТСЦ, 55 схем. Файл:", OUT, flush=True)
