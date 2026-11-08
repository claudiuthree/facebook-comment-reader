let collecting = false;
let relayToReader = false;
const player = {items: [], index: 0, playing: false, paused: false, waiting: false, autoPlay: false, token: 0, status: 'Open a Facebook post to begin.'};
let controls;

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

function showControls() {
  if (controls) { controls.panel.hidden = false; controls.launcher.hidden = true; renderControls(); return; }
  const host = document.createElement('div');
  host.id = 'fbcr-overlay-host';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;font:14px system-ui,sans-serif';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box}button{font:inherit;cursor:pointer}button:disabled{opacity:.48;cursor:default}
    #launcher{background:#182536;color:#fff;border:1px solid #8cb4e8;border-radius:999px;padding:10px 16px;box-shadow:0 8px 28px #0008}
    #panel{width:min(340px,calc(100vw - 32px));padding:14px;border:1px solid #8ba5c5;border-radius:14px;background:#111b2a;color:#f5f8fc;box-shadow:0 16px 40px #0009;line-height:1.4}
    header{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:15px}#hide{background:none;color:#c6d6ec;border:0;padding:4px 6px}
    #count{margin:10px 0 2px;color:#b9d4fa}#position{font-size:12px;color:#b8c5d6}#comment{min-height:48px;max-height:90px;overflow:auto;margin:5px 0 10px;white-space:pre-wrap}
    #collect{width:100%;padding:10px;border:0;border-radius:8px;background:#9fc7ff;color:#10203a;font-weight:700}
    nav{display:flex;gap:6px;margin-top:9px}nav button{flex:1;min-width:0;padding:7px 4px;border:1px solid #627996;border-radius:7px;background:#24364e;color:#fff}
    #status{min-height:18px;margin:10px 0 0;font-size:12px;color:#c6d6ec}
  </style><button id="launcher" type="button" hidden>Comment reader</button><section id="panel" aria-label="Comment reader controls"><header><span>Comment reader</span><button id="hide" type="button">Hide</button></header><p id="count"></p><div id="position"></div><div id="comment"></div><button id="collect" type="button">Collect and play</button><nav><button id="previous" type="button">Previous</button><button id="play" type="button">Play</button><button id="next" type="button">Next</button><button id="stop" type="button">Stop</button></nav><p id="status" role="status"></p></section>`;
  document.documentElement.append(host);
  const get = id => shadow.getElementById(id);
  controls = {host, panel: get('panel'), launcher: get('launcher'), count: get('count'), position: get('position'), comment: get('comment'), status: get('status'), collect: get('collect'), previous: get('previous'), play: get('play'), next: get('next')};
  get('hide').addEventListener('click', () => { controls.panel.hidden = true; controls.launcher.hidden = false; });
  get('launcher').addEventListener('click', showControls);
  controls.collect.addEventListener('click', startLocal);
  controls.previous.addEventListener('click', () => move(-1));
  controls.next.addEventListener('click', () => move(1));
  controls.play.addEventListener('click', toggleSpeech);
  get('stop').addEventListener('click', stopSpeech);
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
      idle = fresh.length || more || advanced ? 0 : idle + 1;
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
