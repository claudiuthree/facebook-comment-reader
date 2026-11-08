let collecting = false;

function clean(text) {
  return String(text || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}]/gu, '').replace(/[\uFE0F\u200D\uFFFC]/g, '').replace(/\s+/g, ' ').trim();
}

function commentsOnPage() {
  return [...document.querySelectorAll('[role="article"][aria-label^="Comment by"]')]
    .filter(article => article.getClientRects().length)
    .map(article => clean([...article.querySelectorAll('div[dir="auto"]')].map(element => element.innerText.trim()).filter(Boolean).join(' ')))
    .filter(Boolean);
}

function clickMore() {
  const candidates = [...document.querySelectorAll('button,[role="button"]')]
    .filter(button => button.getClientRects().length)
    .filter(button => /^(?:View more comments|See more|View \d+ repl(?:y|ies))$/i.test(clean(button.innerText)));
  for (const button of candidates.slice(0, 3)) button.click();
  return candidates.length;
}

function advanceComments() {
  const articles = [...document.querySelectorAll('[role="article"][aria-label^="Comment by"]')]
    .filter(article => article.getClientRects().length);
  const last = articles.at(-1);
  if (!last) return false;
  for (let container = last.parentElement; container; container = container.parentElement) {
    if (container.scrollHeight <= container.clientHeight + 100) continue;
    if (!/auto|scroll/.test(getComputedStyle(container).overflowY)) continue;
    const before = container.scrollTop;
    container.scrollTop = container.scrollHeight;
    return container.scrollTop > before;
  }
  last.scrollIntoView({block: 'end', behavior: 'instant'});
  return false;
}

async function showAllComments() {
  const button = [...document.querySelectorAll('button,[role="button"]')]
    .find(element => element.getClientRects().length && /^(Most relevant|Newest)$/i.test(clean(element.innerText)));
  if (!button) return;
  button.click();
  await new Promise(resolve => setTimeout(resolve, 250));
  const option = [...document.querySelectorAll('[role="menuitem"],[role="menu"] *')]
    .find(element => element.getClientRects().length && clean(element.innerText).startsWith('All comments'));
  option?.click();
}

async function collect() {
  if (collecting) return;
  collecting = true;
  const seen = new Set();
  let idle = 0;
  const started = Date.now();
  try {
    await showAllComments();
    while (Date.now() - started < 65000 && idle < 10) {
      const comments = commentsOnPage();
      const fresh = comments.filter(text => {
        const key = text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      });
      for (let i = 0; i < fresh.length; i += 100) {
        chrome.runtime.sendMessage({type: 'batch', items: fresh.slice(i, i + 100).map(text => ({text}))});
      }
      const more = clickMore();
      const advanced = advanceComments();
      if (!comments.length) window.scrollTo(0, document.body.scrollHeight);
      idle = fresh.length || more || advanced ? 0 : idle + 1;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!seen.size) chrome.runtime.sendMessage({type: 'error', error: 'No visible comments were found. Facebook may require sign-in or a different page layout.'});
    else chrome.runtime.sendMessage({type: 'done'});
  } catch (error) {
    chrome.runtime.sendMessage({type: 'error', error: error.message});
  } finally { collecting = false; }
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'collect') collect();
});
