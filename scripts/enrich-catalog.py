import concurrent.futures
import json
import re
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
movies = json.loads((ROOT / 'server/catalog.json').read_text(encoding='utf-8'))

def enrich(movie):
    try:
        req = urllib.request.Request('https://motchillr.mx/phim/' + movie['slug'], headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            soup = BeautifulSoup(response.read(), 'html.parser')
        desc = soup.find('meta', attrs={'name': 'description'})
        if desc:
            movie['description'] = desc.get('content', '')
        chunks = []
        for script in soup.find_all('script'):
            text = script.string or ''
            if text.startswith('self.__next_f.push('):
                try:
                    value = json.loads(text[len('self.__next_f.push('):-1])
                    if isinstance(value[1], str):
                        chunks.append(value[1])
                except (ValueError, IndexError):
                    pass
        text = ''.join(chunks)
        for match in re.finditer(r'"movieId":"' + movie['id'] + r'","episodes":', text):
            episodes, _ = json.JSONDecoder().raw_decode(text[match.end():])
            if isinstance(episodes, list):
                movie['episodes'] = episodes
                break
        for episode in movie['episodes']:
            episode['slug'] = episode['id']
        for key, prefix in [('actor', '/dien-vien/'), ('director', '/dao-dien/')]:
            names = list(dict.fromkeys(a.get_text(strip=True) for a in soup.select('a[href^="' + prefix + '"]')))
            if names:
                movie[key] = ', '.join(names)
        return movie, None
    except Exception as error:
        return movie, movie['slug'] + ': ' + str(error)

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(enrich, movies))
(ROOT / 'server/catalog.json').write_text(json.dumps([m for m, _ in results], ensure_ascii=False, indent=2), encoding='utf-8')
print('Movies:', len(results), 'Episode sources:', sum(len(m['episodes']) for m, _ in results))
for _, error in results:
    if error:
        print(error)
