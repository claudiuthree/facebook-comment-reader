"""Build the phone page and in-chat reader from one playback script."""

import json
import os
import re
from pathlib import Path

page = Path('public/index.html')
inline_path = os.environ.get('INLINE_READER_PATH')
data = json.loads(Path('public/comments.json').read_text(encoding='utf-8-sig'))
script = Path('reader.js').read_text(encoding='utf-8')


def js_data(items):
    return json.dumps([[item['name'], item['text']] for item in items], ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


def make_script(items, remote):
    remote_load = '''fetch('./comments.json')
      .then(response=>{if(!response.ok)throw new Error('Fetch failed');return response.json()})
      .then(items=>{const added=add(items);finishLoad();status(`${comments.length} comments ready. ${added} loaded in the background.`)})
      .catch(()=>{finishLoad();status('Saved comments are ready. More comments could not be loaded.')});''' if remote else ''
    return (script.replace('__INITIAL_COMMENTS__', js_data(items))
                  .replace('__PENDING_LOADS__', '1' if remote else '0')
                  .replace('__REMOTE_LOAD__', remote_load))


html = page.read_text(encoding='utf-8-sig')
if 'id="cr-paste"' not in html:
    html = html.replace('    #comment-reader .status{',
        '    #comment-reader textarea{width:100%;min-height:96px;resize:vertical;font:inherit;border-radius:10px;border:1px solid light-dark(#cad4e0,#556174);background:light-dark(#fff,#263242);color:inherit;padding:10px}\n'
        '    #comment-reader .import{margin:16px 0}\n'
        '    #comment-reader .import label{display:block;margin-bottom:6px;font-weight:600}\n'
        '    #comment-reader .import button{margin-top:8px}\n'
        '    #comment-reader .status{')
    html = html.replace('  <div class="listhead">',
        '  <div class="import"><label for="cr-paste">Add copied comments</label><textarea id="cr-paste" placeholder="One comment per line, or paste a JSON array"></textarea><button type="button" id="cr-add">Add to listening queue</button></div>\n'
        '  <div class="listhead">')
html = re.sub(r'<script>.*?</script>', lambda _: '<script>\n' + make_script(data[:30], True) + '\n  </script>', html, count=1, flags=re.S)
html = re.sub(r'\d+ unique text comments and replies · 8 Nov 2026', '30 comments ready · buffering more', html, count=1)
page.write_text(html, encoding='utf-8')

fragment = re.search(r'(<div id="comment-reader">.*</div>)\s*</body></html>', html, re.S).group(1)
fragment = re.sub(r'<script>.*?</script>', lambda _: '<script>\n' + make_script(data, False) + '\n  </script>', fragment, count=1, flags=re.S)
fragment = fragment.replace('30 comments ready · buffering more', f'{len(data)} unique comments ready')
if inline_path:
    Path(inline_path).write_text(fragment + '\n', encoding='utf-8')
print(f'Built phone page (30 immediate + {len(data)-30} background) and in-chat reader ({len(data)} immediate)')
