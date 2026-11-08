"""Keep one spoken entry for each comment text, allowing case and punctuation variants."""

import json
import unicodedata
from pathlib import Path

source = Path('data/comments-raw.json')
target = Path('public/comments.json')


def key(text):
    normalized = unicodedata.normalize('NFKC', text).casefold()
    return ''.join(char for char in normalized if char.isalnum())


comments = json.loads(source.read_text(encoding='utf-8-sig'))
seen = set()
unique = []
for comment in comments:
    identity = key(comment['text'])
    if not identity or identity in seen:
        continue
    seen.add(identity)
    unique.append(comment)

target.write_text(json.dumps(unique, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(unique)} playable comments; {len(comments) - len(unique)} repeated entries removed')
