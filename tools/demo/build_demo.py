"""Builds the click-through demo of the Natraj Jewels Management System (sample data, no real database).

Output: a folder with app/ (every page, loading demo-backend.js first) and a
small shell page that shows app/index.html. Usage: python3 build_demo.py OUT_DIR
"""
import os, re, shutil, sys

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # tools/
OUT = sys.argv[1]
APP = os.path.join(OUT, 'app')
shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(SRC, APP, ignore=shutil.ignore_patterns('supabase', 'demo', 'README.txt'))
shutil.copy(os.path.join(SRC, 'demo', 'demo-backend.js'), os.path.join(APP, 'shared', 'demo-backend.js'))

PAGES = sorted(d for d in os.listdir(APP) if os.path.isfile(os.path.join(APP, d, 'index.html')))
NAMES = '|'.join(map(re.escape, PAGES))

def fix_links(text):
    # folder links ("attendance/", "../rates/#x") become explicit index.html files
    return re.sub(r'(href=")((?:\.\./)?(?:' + NAMES + r')/)(#[a-z]*)?"',
                  lambda m: m.group(1) + m.group(2) + 'index.html' + (m.group(3) or '') + '"', text)

for root, _, files in os.walk(APP):
    for f in files:
        path = os.path.join(root, f)
        if f.endswith('.html'):
            s = open(path).read()
            prefix = '' if os.path.dirname(path) == APP else '../'
            s = s.replace('<script src="https://cdn.jsdelivr.net',
                          '<script src="' + prefix + 'shared/demo-backend.js"></script>\n<script src="https://cdn.jsdelivr.net', 1)
            s = fix_links(s)
            s = re.sub(r"tile\('(" + NAMES + r")/", lambda m: "tile('" + m.group(1) + "/index.html", s)
            open(path, 'w').write(s)
js = os.path.join(APP, 'shared', 'natraj.js')
s = open(js).read()
s = s.replace("href=\"' + ROOT + '\">All apps", "href=\"' + ROOT + 'index.html\">All apps")
s = s.replace("link.href = ROOT || './';", "link.href = ROOT + 'index.html';")
s = s.replace("new URL(ROOT + n.link, location.href)", "new URL(ROOT + n.link.replace(/\\/(#|$)/, '/index.html$1'), location.href)")
s = re.sub(r"path: '(" + NAMES + r")/'", lambda m: "path: '" + m.group(1) + "/index.html'", s)
open(js, 'w').write(s)

open(os.path.join(OUT, 'demo.html'), 'w').write('''<title>Natraj Management System Demo</title>
<style>
:root{--bg:#F5F5F7}
html,body{height:100%}
body{margin:0;background:var(--bg)}
iframe{display:block;border:0;width:100%;height:100%;background:#fff}
</style>
<iframe src="app/index.html" title="Natraj Jewels Management System demo"></iframe>
''')
print('built', OUT)
