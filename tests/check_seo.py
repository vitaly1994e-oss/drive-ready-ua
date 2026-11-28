"""Validate deployed public SEO and availability, or check the checkout."""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
SITES = {
    'https://drive-ready-ua.onrender.com': ROOT,
    'https://drive-time-booking-ov62.onrender.com': ROOT / 'booking/public',
}
NS = '{http://www.sitemaps.org/schemas/sitemap/0.9}'


class Metadata(HTMLParser):
    def __init__(self, document):
        super().__init__()
        self.canonicals = []
        self.noindex = False
        self.feed(document)

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == 'link' and fields.get('rel') == 'canonical':
            self.canonicals.append(fields.get('href'))
        if tag == 'meta' and fields.get('name', '').lower() == 'robots':
            self.noindex |= 'noindex' in fields.get('content', '').lower()


def download(url):
    with urlopen(url, timeout=45) as response:
        assert response.status == 200 and response.url == url, (url, response.status, response.url)
        return response.read().decode(), response.headers.get('X-Robots-Tag', '')


def check(origin, directory, live):
    def get(path):
        if live:
            return download(origin + path)
        return (directory / (path.lstrip('/') or 'index.html')).read_text(encoding='utf-8'), ''

    robots, _ = get('/robots.txt')
    assert f'Sitemap: {origin}/sitemap.xml' in robots.splitlines()
    assert 'Disallow: /' not in robots.splitlines()
    sitemap, _ = get('/sitemap.xml')
    urls = [item.text for item in ElementTree.fromstring(sitemap).findall(f'{NS}url/{NS}loc')]
    assert urls and len(urls) == len(set(urls))
    for url in urls:
        path = urlsplit(url).path
        assert url == origin + path and path.startswith('/') and '..' not in path, url
        document, robots_tag = get(path)
        metadata = Metadata(document)
        assert metadata.canonicals == [url], (url, metadata.canonicals)
        assert not metadata.noindex and 'noindex' not in robots_tag.lower(), url
    print(f'OK: {origin} — {len(urls)} canonical pages')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true')
    args = parser.parse_args()
    if args.live:
        booking = next(reversed(SITES))
        assert json.loads(download(booking + '/health')[0])['ok'] is True
    for origin, directory in SITES.items():
        check(origin, directory, args.live)
