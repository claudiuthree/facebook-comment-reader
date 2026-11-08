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
    remote_load = '''const requestVersion=version;
    fetch('./comments.json')
      .then(response=>{if(!response.ok)throw new Error('Fetch failed');return response.json()})
      .then(items=>{if(requestVersion!==version)return;const added=add(items);savedLoaded=knownTotal;finishLoad();status(`${comments.length} comments ready. ${added} loaded in the background.`)})
      .catch(()=>{if(requestVersion!==version)return;finishLoad();status('Saved comments are ready. More comments could not be loaded.')});''' if remote else ''
    return (script.replace('__INITIAL_COMMENTS__', js_data(items))
                  .replace('__PENDING_LOADS__', '1' if remote else '0')
                  .replace('__KNOWN_TOTAL__', str(len(data)))
                  .replace('__REMOTE_LOAD__', remote_load))


html = page.read_text(encoding='utf-8-sig')
html = html.replace('<p class="author" id="cr-author"></p>', '')
html = html.replace('    #comment-reader .author{font-weight:600;margin-bottom:8px}\n', '')
html = html.replace('<p class="sub">Paintwitheroy', '<p class="sub" id="cr-sub">Paintwitheroy')
html = html.replace('<a href="https://www.facebook.com/61591138393698/posts/122127670083371279/"', '<a id="cr-openpost" href="https://www.facebook.com/61591138393698/posts/122127670083371279/"')
if 'id="cr-form"' not in html:
    html = html.replace('    #comment-reader .import{',
        '    #comment-reader .postform{margin:16px 0}\n'
        '    #comment-reader .postform label{display:block;margin-bottom:6px;font-weight:600}\n'
        '    #comment-reader .postform div{display:flex;gap:8px;flex-wrap:wrap}\n'
        '    #comment-reader .postform input{flex:1 1 260px;min-width:0;font:inherit;border-radius:10px;border:1px solid light-dark(#cad4e0,#556174);background:light-dark(#fff,#263242);color:inherit;padding:9px 13px;min-height:42px}\n'
        '    #comment-reader .import{')
    html = html.replace('  <div class="now"',
        '  <form id="cr-form" class="postform"><label for="cr-post-url">Facebook post link</label><div><input id="cr-post-url" type="url" value="https://www.facebook.com/61591138393698/posts/122127670083371279/" placeholder="Paste or drop a Facebook post link" required><button type="submit">Use this post</button></div></form>\n'
        '  <div class="now"')
if 'id="cr-progress"' not in html:
    html = html.replace('    #comment-reader .import{',
        '    #comment-reader .load-progress{margin:0 0 14px}\n'
        '    #comment-reader .load-progress progress{display:block;width:100%;height:12px;accent-color:light-dark(#265fb9,#8ab3ff)}\n'
        '    #comment-reader .load-progress p{margin:6px 0 0;font-size:.88rem;color:light-dark(#526072,#b7c1cf)}\n'
        '    #comment-reader .import{')
    html = html.replace('  <div class="now"',
        f'  <div class="load-progress"><progress id="cr-progress" max="{len(data)}" value="30" aria-label="Comments loaded"></progress><p id="cr-progress-text" role="status">30 of {len(data)} saved comments loaded. You can start listening now.</p></div>\n'
        '  <div class="now"')
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
fragment = fragment.replace(f'max="{len(data)}" value="30"', f'max="{len(data)}" value="{len(data)}"')
fragment = fragment.replace(f'30 of {len(data)} saved comments loaded. You can start listening now.', f'{len(data)} comments ready for this post.')
if inline_path:
    Path(inline_path).write_text(fragment + '\n', encoding='utf-8')
print(f'Built phone page (30 immediate + {len(data)-30} background) and in-chat reader ({len(data)} immediate)')
