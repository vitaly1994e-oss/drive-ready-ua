#!/usr/bin/env python3
"""Синхронізація з відкритим каталогом схем ГСЦ МВС України.

Не домислює маршрутів: бере лише зображення, що є посиланнями на
публічних сторінках ТСЦ МВС. Не обходить обмеження доступу.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = "https://hsc.gov.ua"
INDEX = ROOT + "/index/poslugi/vidacha-posvidchennya-vodiya/marshruti/"
OUTPUT = Path(__file__).resolve().parents[1] / "routes-catalog.json"
CODE = re.compile(r"ТСЦ\s*(?:МВС)?\s*№\s*(\d{4})", re.I)
IMAGE = re.compile(r"\.(?:png|jpe?g|webp)(?:\?.*)?$", re.I)
BLOCKED = {"8041"}  # Переїзд у вересні 2026; стара сторінка неактуальна.
HEADER = {"User-Agent": "DriveReadyUA-educational-route-catalog/1.0 (public data, low frequency)"}

session = requests.Session()
session.headers.update(HEADER)


def fetch(url: str) -> BeautifulSoup:
    response = session.get(url, timeout=27)
    response.raise_for_status()
    if "html" not in response.headers.get("Content-Type", "text/html"):
        raise ValueError("Не HTML: " + url)
    return BeautifulSoup(response.text, "html.parser")


def images_in_page(soup: BeautifulSoup) -> list[str]:
    # WordPress gallery: linked full-resolution image wraps thumbnail.
    candidates = soup.select(".entry-content, .post-content, .page-content, article, main")
    containers = candidates[:1] if candidates else [soup]
    results: list[str] = []
    seen: set[str] = set()
    for container in containers:
        for a in container.find_all("a", href=True):
            img = a.find("img")
            if img is None:
                continue
            raw = a["href"].strip()
            url = urljoin(ROOT, raw)
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.hostname != "hsc.gov.ua":
                continue
            if "/wp-content/uploads/" not in parsed.path or not IMAGE.search(parsed.path):
                continue
            if url in seen:
                continue
            name = parsed.path.rsplit("/", 1)[-1].lower()
            if any(word in name for word in ("logo", "favicon", "facebook", "banner", "icon")):
                continue
            seen.add(url)
            results.append(url)
    return results


def main() -> None:
    try:
        index_soup = fetch(INDEX)
    except Exception as exc:
        print("ПОМИЛКА: офіційний каталог недоступний:", exc, file=sys.stderr)
        sys.exit(1)
    links = {}
    for a in index_soup.find_all("a", href=True):
        match = CODE.search(a.get_text(" ", strip=True))
        if not match:
            continue
        code = match.group(1)
        url = urljoin(INDEX, a["href"])
        if code in BLOCKED or urlparse(url).hostname != "hsc.gov.ua":
            continue
        links[code] = {"source": url, "title": a.get_text(" ", strip=True)}
    print("Центрів у відкритому каталозі МВС:", len(links), flush=True)
    centers = {}
    failed = []
    total = 0
    for idx, (code, center) in enumerate(sorted(links.items()), 1):
        try:
            soup = fetch(center["source"])
            images = images_in_page(soup)
            if images:
                centers[code] = {"source": center["source"], "title": center["title"], "images": images}
                total += len(images)
            print(f"{idx}/{len(links)} ТСЦ {code}: {len(images)} схем", flush=True)
        except Exception as exc:
            failed.append(code)
            print(f"ПОМИЛКА {code}: {exc}", file=sys.stderr, flush=True)
        time.sleep(0.25)
    # Fail closed. Never overwrite the previous catalog with an empty/partial result.
    if len(centers) < 10 or total < 40 or len(failed) > len(links) // 3:
        print(f"СИНХРОНІЗАЦІЮ СКАСОВАНО: {len(centers)} центрів, {total} схем; помилок {len(failed)}", file=sys.stderr)
        sys.exit(2)
    payload = {
        "source": INDEX,
        "verifiedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "method": "official-site-gallery-links",
        "note": "Порядкові номери схем не обов'язково збігаються з номерами маршрутів. Актуальність перевіряйте перед іспитом.",
        "centers": centers,
        "failedCenters": failed,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ОК: {len(centers)} ТСЦ, {total} офіційних зображень, {len(failed)} помилок")


if __name__ == "__main__":
    main()
