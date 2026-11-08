let collecting = false;
let relayToReader = false;
const player = {items: [], index: 0, playing: false, paused: false, waiting: false, autoPlay: false, token: 0, status: 'Open a Facebook post to begin.'};
let controls;
const layoutKey = 'fbcr-mini-player-layout-v1';

function setLayout(left, top, width, height) {
  const margin = 8;
  const maxWidth = Math.max(180, window.innerWidth - margin * 2);
  const maxHeight = Math.max(180, window.innerHeight - margin * 2);
  width = Math.min(maxWidth, Math.max(Math.min(260, maxWidth), width));
  height = Math.min(maxHeight, Math.max(Math.min(260, maxHeight), height));
  controls.panel.style.width = `${width}px`;
  controls.panel.style.height = `${height}px`;
  controls.host.style.right = 'auto';
  controls.host.style.bottom = 'auto';
  controls.host.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
  controls.host.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
}

function saveLayout() {
  const {left, top, width, height} = controls.panel.getBoundingClientRect();
  try { localStorage.setItem(layoutKey, JSON.stringify({left, top, width, height})); } catch {}
}

function restoreLayout() {
  try {
    const layout = JSON.parse(localStorage.getItem(layoutKey) || 'null');
    if (layout && [layout.left, layout.top, layout.width, layout.height].every(Number.isFinite))
      setLayout(layout.left, layout.top, layout.width, layout.height);
  } catch {}
}

function enableLayoutControls(header, resize) {
  const begin = (event, resizing) => {
    if (event.button !== 0 || (!resizing && event.target.closest('button'))) return;
    event.preventDefault();
    const rect = controls.panel.getBoundingClientRect();
    setLayout(rect.left, rect.top, rect.width, rect.height);
    const originX = event.clientX;
    const originY = event.clientY;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = next => {
      if (resizing) setLayout(rect.left, rect.top, rect.width + next.clientX - originX, rect.height + next.clientY - originY);
      else setLayout(rect.left + next.clientX - originX, rect.top + next.clientY - originY, rect.width, rect.height);
    };
    const finish = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', finish);
      target.removeEventListener('pointercancel', finish);
      saveLayout();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', finish);
    target.addEventListener('pointercancel', finish);
  };
  header.addEventListener('pointerdown', event => begin(event, false));
  resize.addEventListener('pointerdown', event => begin(event, true));
  window.addEventListener('resize', () => {
    if (!controls.host.style.left || controls.panel.hidden) return;
    const {left, top, width, height} = controls.panel.getBoundingClientRect();
    setLayout(left, top, width, height);
    saveLayout();
  });
}

function clean(text) {
  return String(text || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}]/gu, '').replace(/[\uFE0F\u200D\uFFFC]/g, '').replace(/\s+/g, ' ').trim();
}

function onPost() {
  return /\/(?:posts\/|reel\/|photo\/|videos\/|permalink\.php)/.test(location.pathname) ||
    !!document.querySelector('[role="article"][aria-label^="Comment by"]');
}

function renderControls() {
  if (!controls) return;
  const {items, index} = player;
  controls.count.textContent = `${items.length} unique ${items.length === 1 ? 'comment' : 'comments'} loaded${collecting ? ' · collecting' : ''}`;
  controls.position.textContent = items.length ? `Comment ${index + 1} of ${items.length}` : 'No comments loaded';
  controls.comment.textContent = items[index] || 'Press Collect and play to start.';
  controls.status.textContent = player.status;
  controls.previous.disabled = !items.length || index === 0;
  controls.next.disabled = !items.length || index >= items.length - 1;
  controls.play.disabled = !items.length;
  controls.play.textContent = player.paused ? 'Resume' : player.playing ? 'Pause' : 'Play';
  controls.collect.disabled = collecting;
  controls.collect.textContent = collecting ? 'Collecting comments' : 'Collect and play';
}

function setStatus(message) { player.status = message; renderControls(); }

function stopSpeech() {
  player.token++;
  speechSynthesis.cancel();
  player.playing = false;
  player.paused = false;
  player.waiting = false;
  player.autoPlay = false;
  setStatus(collecting ? 'Playback stopped. Comments are still loading.' : 'Playback stopped.');
}

function speakCurrent() {
  if (!player.items.length) { player.waiting = true; setStatus('Waiting for the first comments.'); return; }
  if (!('speechSynthesis' in window)) { setStatus('Speech playback is unavailable in this browser.'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(player.items[player.index]);
  const token = ++player.token;
  utterance.lang = 'en-GB';
  utterance.onend = () => {
    if (token !== player.token) return;
    if (player.index < player.items.length - 1) { player.index++; speakCurrent(); }
    else if (collecting) { player.playing = false; player.waiting = true; setStatus('Waiting for more comments to load.'); }
    else { player.playing = false; player.autoPlay = false; setStatus('Finished all loaded comments.'); }
  };
  utterance.onerror = () => { if (token === player.token) { player.playing = false; player.autoPlay = false; setStatus('Audio could not play in this tab.'); } };
  player.playing = true;
  player.paused = false;
  player.waiting = false;
  player.autoPlay = true;
  setStatus(`Reading comment ${player.index + 1} of ${player.items.length}.`);
  speechSynthesis.speak(utterance);
}

function toggleSpeech() {
  if (player.paused) { speechSynthesis.resume(); player.paused = false; player.playing = true; setStatus(`Reading comment ${player.index + 1} of ${player.items.length}.`); }
  else if (player.playing) { speechSynthesis.pause(); player.paused = true; player.playing = false; setStatus('Paused.'); }
  else speakCurrent();
}

function move(delta) {
  const next = Math.max(0, Math.min(player.items.length - 1, player.index + delta));
  if (!player.items.length || next === player.index) return;
  player.index = next;
  if (player.playing || player.paused || player.autoPlay) speakCurrent();
  else { speechSynthesis.cancel(); setStatus(`Comment ${next + 1} selected.`); }
}

async function copyComments() {
  if (!player.items.length) { setStatus('Collect comments before copying.'); return; }
  try {
    await navigator.clipboard.writeText(JSON.stringify(player.items));
    setStatus(`Copied ${player.items.length} comments. Paste them into the reader to share with your phone.`);
  } catch { setStatus('Could not copy comments. Check Chrome clipboard permission.'); }
}

function showControls() {
  if (controls) {
    controls.panel.hidden = false;
    controls.launcher.hidden = true;
    if (controls.host.style.left) {
      const {left, top, width, height} = controls.panel.getBoundingClientRect();
      setLayout(left, top, width, height);
    }
    renderControls();
    return;
  }
  const host = document.createElement('div');
  host.id = 'fbcr-overlay-host';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;font:14px system-ui,sans-serif';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box}button{font:inherit;cursor:pointer}button:disabled{opacity:.48;cursor:default}
    #launcher{background:#182536;color:#fff;border:1px solid #8cb4e8;border-radius:999px;padding:10px 16px;box-shadow:0 8px 28px #0008}
    #panel{position:relative;display:flex;flex-direction:column;width:min(340px,calc(100vw - 32px));height:min(315px,calc(100vh - 32px));min-width:min(260px,calc(100vw - 16px));min-height:min(260px,calc(100vh - 16px));padding:14px;border:1px solid #8ba5c5;border-radius:14px;background:#111b2a;color:#f5f8fc;box-shadow:0 16px 40px #0009;line-height:1.4;overflow:auto}
    #panel[hidden],#launcher[hidden]{display:none}header{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:15px;cursor:move;touch-action:none;user-select:none}#hide{background:none;color:#c6d6ec;border:0;padding:4px 6px;cursor:pointer}
    #count{margin:10px 0 2px;color:#b9d4fa}#position{font-size:12px;color:#b8c5d6}#comment{flex:1;min-height:40px;overflow:auto;margin:5px 0 10px;white-space:pre-wrap}
    #collect{width:100%;padding:10px;border:0;border-radius:8px;background:#9fc7ff;color:#10203a;font-weight:700}#copy{margin-top:7px;padding:5px;border:0;background:none;color:#b9d4fa;text-align:left}
    nav{display:flex;gap:6px;margin-top:9px}nav button{flex:1;min-width:0;padding:7px 4px;border:1px solid #627996;border-radius:7px;background:#24364e;color:#fff}
    #status{min-height:18px;margin:10px 0 0;font-size:12px;color:#c6d6ec}#resize{position:absolute;right:3px;bottom:3px;width:20px;height:20px;padding:0;border:0;background:linear-gradient(135deg,transparent 46%,#8ba5c5 47%,#8ba5c5 56%,transparent 57%);cursor:nwse-resize;touch-action:none}
  </style><button id="launcher" type="button" hidden>Comment reader</button><section id="panel" aria-label="Comment reader controls"><header title="Drag to move"><span>Comment reader</span><button id="hide" type="button">Hide</button></header><p id="count"></p><div id="position"></div><div id="comment"></div><button id="collect" type="button">Collect and play</button><button id="copy" type="button">Copy comments for phone</button><nav><button id="previous" type="button">Previous</button><button id="play" type="button">Play</button><button id="next" type="button">Next</button><button id="stop" type="button">Stop</button></nav><p id="status" role="status"></p><button id="resize" type="button" aria-label="Drag to resize player" title="Drag to resize"></button></section>`;
  document.documentElement.append(host);
  const get = id => shadow.getElementById(id);
  controls = {host, panel: get('panel'), launcher: get('launcher'), count: get('count'), position: get('position'), comment: get('comment'), status: get('status'), collect: get('collect'), previous: get('previous'), play: get('play'), next: get('next')};
  get('hide').addEventListener('click', () => { controls.panel.hidden = true; controls.launcher.hidden = false; });
  get('launcher').addEventListener('click', showControls);
  controls.collect.addEventListener('click', startLocal);
  get('copy').addEventListener('click', copyComments);
  controls.previous.addEventListener('click', () => move(-1));
  controls.next.addEventListener('click', () => move(1));
  controls.play.addEventListener('click', toggleSpeech);
  get('stop').addEventListener('click', stopSpeech);
  enableLayoutControls(get('panel').querySelector('header'), get('resize'));
  restoreLayout();
  renderControls();
}

function addToPlayer(items) {
  if (!items.length) return;
  player.items.push(...items);
  renderControls();
  if (player.autoPlay && !player.playing && !player.paused) speakCurrent();
}

function startLocal() {
  showControls();
  if (!onPost()) { setStatus('Open a Facebook post first.'); return; }
  player.autoPlay = true;
  if (collecting) { if (!player.playing && !player.paused) speakCurrent(); return; }
  collect(false, true);
}

function commentsOnPage() {
  return [...document.querySelectorAll('[role="article"][aria-label^="Comment by"]')]
    .filter(article => article.getClientRects().length)
    .filter(article => !commentExpandButtons(article).length)
    .map(article => clean([...article.querySelectorAll('div[dir="auto"]')].map(element => element.innerText.trim()).filter(Boolean).join(' ')))
    .filter(Boolean);
}

function commentExpandButtons(article) {
  return [...article.querySelectorAll('button,[role="button"]')]
    .filter(button => button.getClientRects().length && clean(button.innerText) === 'See more');
}

function expandCommentText() {
  const buttons = new Set([...document.querySelectorAll('[role="article"][aria-label^="Comment by"]')]
    .filter(article => article.getClientRects().length)
    .flatMap(commentExpandButtons));
  for (const button of buttons) if (button.isConnected) button.click();
  return buttons.size;
}

function clickMore() {
  const candidates = [...document.querySelectorAll('button,[role="button"]')]
    .filter(button => button.getClientRects().length)
    .filter(button => /^(?:View more comments|View \d+ repl(?:y|ies))$/i.test(clean(button.innerText)));
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

async function collect(fromReader = false, play = false) {
  if (fromReader) relayToReader = true;
  if (collecting) {
    if (fromReader && player.items.length) chrome.runtime.sendMessage({type: 'batch', items: player.items.map(text => ({text}))});
    if (play) { player.autoPlay = true; if (!player.playing && !player.paused) speakCurrent(); }
    return;
  }
  stopSpeech();
  player.items = [];
  player.index = 0;
  player.autoPlay = play;
  collecting = true;
  renderControls();
  setStatus('Collecting comments from this post.');
  const seen = new Set();
  let idle = 0;
  const started = Date.now();
  try {
    await showAllComments();
    while (Date.now() - started < 65000 && idle < 10) {
      const expanded = expandCommentText();
      if (expanded) await new Promise(resolve => setTimeout(resolve, 100));
      const comments = commentsOnPage();
      const fresh = comments.filter(text => {
        const key = text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      });
      addToPlayer(fresh);
      if (relayToReader) for (let i = 0; i < fresh.length; i += 100)
        chrome.runtime.sendMessage({type: 'batch', items: fresh.slice(i, i + 100).map(text => ({text}))});
      const more = clickMore();
      const advanced = advanceComments();
      if (!comments.length) window.scrollTo(0, document.body.scrollHeight);
      idle = fresh.length || expanded || more || advanced ? 0 : idle + 1;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!seen.size) {
      const error = 'No visible comments were found. Facebook may require sign-in or a different page layout.';
      setStatus(error);
      if (relayToReader) chrome.runtime.sendMessage({type: 'error', error});
    } else {
      setStatus(`${player.items.length} unique comments loaded. ${player.playing ? 'Reading now.' : 'Press Play to listen.'}`);
      if (relayToReader) chrome.runtime.sendMessage({type: 'done'});
    }
  } catch (error) {
    setStatus(`Collection stopped: ${error.message}`);
    if (relayToReader) chrome.runtime.sendMessage({type: 'error', error: error.message});
  } finally { collecting = false; relayToReader = false; renderControls(); }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'collect') collect(true, false);
  else if (message?.type === 'collect-and-play') {
    if (!onPost()) { sendResponse({ok: false, error: 'Open a Facebook post first.'}); return; }
    startLocal();
    sendResponse({ok: true});
  }
});

setInterval(() => {
  if (!controls && onPost()) {
    showControls();
    controls.panel.hidden = true;
    controls.launcher.hidden = false;
  }
}, 1200);
