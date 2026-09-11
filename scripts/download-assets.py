import concurrent.futures
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent.parent

def download(url):
    target = ROOT / 'public' / url.lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        req = urllib.request.Request('https://motchillr.mx' + url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            target.write_bytes(response.read())
        return None
    except Exception as error:
        return url + ': ' + str(error)

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    errors = [e for e in pool.map(download, json.loads((ROOT / 'scripts/assets.json').read_text())) if e]
print('Asset download complete. Failures:', len(errors))
for error in errors:
    print(error)
