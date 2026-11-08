(() => {
  const layoutKey = 'fbcr-mini-player-layout-v1';
  const queue = [];
  const seen = new Set();
  let index = 0, collecting = false, playing = false, paused = false, autoPlay = false, timer, speechToken = 0;
  let host, panel, shadow, statusText = '';
  const clean = text => String(text || '').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
  const keyOf = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const postPage = () => /\/(?:posts\/|reel\/|photo\/?|videos\/|permalink\.php)/.test(location.pathname) || !!document.querySelector('[role="article"][aria-label^="Comment by"]');
  const button = id => shadow.getElementById(id);
  const status = message => { statusText = message; if (shadow) button('status').textContent = message; };
  const state = () => ({ok:true, count:queue.length, index, comment:queue[index] || '', collecting, playing, paused, status:statusText});

  function render() {
    if (!shadow) return;
    button('count').textContent = `${queue.length} unique comments loaded${collecting ? ' · collecting' : ''}`;
    button('position').textContent = queue.length ? `Comment ${index + 1} of ${queue.length}` : 'No comments loaded';
    button('comment').textContent = queue[index] || 'Press Collect and play to start.';
    button('play').textContent = paused ? 'Resume' : playing ? 'Pause' : 'Play';
    button('play').disabled = !queue.length;
    button('previous').disabled = !queue.length || index === 0;
    button('next').disabled = !queue.length || index === queue.length - 1;
    button('collect').disabled = collecting;
    button('clear').disabled = !queue.length && !collecting;
  }

  function stop() {
    if (collecting) { clearInterval(timer?.id); collecting = false; }
    speechToken++;
    speechSynthesis.cancel();
    playing = paused = autoPlay = false;
    status('Playback stopped.');
    render();
  }

  function clearCollection() {
    stop();
    queue.length = 0;
    seen.clear();
    index = 0;
    render();
    status('Collection cleared. Press Collect and play to start again.');
  }

  function speak() {
    if (!queue.length) { status('Waiting for comments.'); return; }
    if (!('speechSynthesis' in window)) { status('Speech playback is unavailable.'); return; }
    speechSynthesis.cancel();
    const token = ++speechToken;
    const utterance = new SpeechSynthesisUtterance(queue[index]);
    utterance.lang = 'en-GB';
    utterance.onend = () => {
      if (token !== speechToken) return;
      if (index < queue.length - 1) { index++; speak(); }
      else { playing = false; render(); status(collecting ? 'Waiting for more comments.' : 'Finished loaded comments.'); }
    };
    utterance.onerror = () => { if (token === speechToken) { playing = autoPlay = false; render(); status('Audio could not play.'); } };
    playing = autoPlay = true;
    paused = false;
    render();
    status(`Reading comment ${index + 1} of ${queue.length}.`);
    speechSynthesis.speak(utterance);
  }

  function toggle() {
    if (paused) { speechSynthesis.resume(); paused = false; playing = true; status(`Reading comment ${index + 1} of ${queue.length}.`); }
    else if (playing) { speechSynthesis.pause(); playing = false; paused = true; status('Paused.'); }
    else speak();
    render();
  }

  function step(direction) {
    if (!queue.length) return;
    index = Math.max(0, Math.min(queue.length - 1, index + direction));
    if (playing || paused || autoPlay) speak();
    else { render(); status(`Comment ${index + 1} selected.`); }
  }

  function layout(left, top, width, height) {
    const margin = 8;
    width = Math.min(window.innerWidth - margin * 2, Math.max(260, width));
    height = Math.min(window.innerHeight - margin * 2, Math.max(260, height));
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;
    host.style.right = host.style.bottom = 'auto';
    host.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - width - margin))}px`;
    host.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
  }

  function saveLayout() {
    const {left, top, width, height} = panel.getBoundingClientRect();
    try { localStorage.setItem(layoutKey, JSON.stringify({left, top, width, height})); } catch {}
  }

  function gesture(element, resize) {
    element.addEventListener('pointerdown', event => {
      if (event.button !== 0 || (!resize && event.target.closest('button'))) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect(), startX = event.clientX, startY = event.clientY;
      layout(rect.left, rect.top, rect.width, rect.height);
      element.setPointerCapture(event.pointerId);
      const move = next => resize
        ? layout(rect.left, rect.top, rect.width + next.clientX - startX, rect.height + next.clientY - startY)
        : layout(rect.left + next.clientX - startX, rect.top + next.clientY - startY, rect.width, rect.height);
      const finish = () => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', finish);
        element.removeEventListener('pointercancel', finish);
        saveLayout();
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', finish);
      element.addEventListener('pointercancel', finish);
    });
  }

  function show() {
    if (!host) createPanel();
    host.hidden = false;
    panel.hidden = false;
    render();
  }

  function createPanel() {
    host = document.createElement('div');
    host.id = 'fbcr-mini-player';
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;font:14px system-ui,sans-serif';
    shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = `<style>
      *{box-sizing:border-box}button{font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}[hidden]{display:none!important}
      #panel{position:relative;display:flex;flex-direction:column;width:min(340px,calc(100vw - 32px));height:min(315px,calc(100vh - 32px));min-width:260px;min-height:260px;padding:14px;border:1px solid #8ba5c5;border-radius:14px;background:#111b2a;color:#f5f8fc;box-shadow:0 16px 40px #0009;overflow:auto;line-height:1.4}
      header{display:flex;align-items:center;justify-content:space-between;cursor:move;touch-action:none;user-select:none;font-weight:700}#hide{border:0;background:none;color:#c6d6ec}
      #count{margin:10px 0 2px;color:#b9d4fa}#position,#status{font-size:12px;color:#b8c5d6}#comment{flex:1;min-height:40px;overflow:auto;margin:5px 0 10px;white-space:pre-wrap}
      #actions{display:flex;gap:7px}#collect{flex:1;padding:9px;border:0;border-radius:8px;background:#9fc7ff;color:#10203a;font-weight:700}#clear{padding:9px;border:1px solid #627996;border-radius:8px;background:#24364e;color:#fff}#copy{margin-top:7px;padding:5px;border:0;background:none;color:#b9d4fa;text-align:left}
      nav{display:flex;gap:6px;margin-top:8px}nav button{flex:1;min-width:0;padding:6px 3px;border:1px solid #627996;border-radius:7px;background:#24364e;color:#fff}
      #status{min-height:17px;margin:9px 0 0}#resize{position:absolute;right:3px;bottom:3px;width:20px;height:20px;border:0;background:linear-gradient(135deg,transparent 46%,#8ba5c5 47%,#8ba5c5 56%,transparent 57%);cursor:nwse-resize;touch-action:none}
    </style><section id="panel" aria-label="Comment reader controls"><header title="Drag to move"><span>Comment reader</span><button id="hide">Hide</button></header><p id="count"></p><div id="position"></div><div id="comment"></div><div id="actions"><button id="collect">Collect and play</button><button id="clear">Clear collection</button></div><button id="copy">Copy comments for phone</button><nav><button id="previous">Previous</button><button id="play">Play</button><button id="next">Next</button><button id="stop">Stop</button></nav><p id="status" role="status"></p><button id="resize" aria-label="Drag to resize player" title="Drag to resize"></button></section>`;
    document.documentElement.append(host);
    panel = button('panel');
    host.hidden = true;
    button('hide').onclick = () => { host.hidden = true; };
    button('collect').onclick = () => collect(true);
    button('clear').onclick = clearCollection;
    button('play').onclick = toggle;
    button('previous').onclick = () => step(-1);
    button('next').onclick = () => step(1);
    button('stop').onclick = stop;
    button('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(queue)); status(`Copied ${queue.length} comments. Paste them into the reader.`); }
      catch { status('Could not copy comments in this tab.'); }
    };
    gesture(shadow.querySelector('header'), false);
    gesture(button('resize'), true);
    try {
      const saved = JSON.parse(localStorage.getItem(layoutKey) || 'null');
      if (saved && [saved.left, saved.top, saved.width, saved.height].every(Number.isFinite)) layout(saved.left, saved.top, saved.width, saved.height);
    } catch {}
    render();
  }

  function tick() {
    const articles = [...document.querySelectorAll('[role="article"][aria-label^="Comment by"]')].filter(node => node.getClientRects().length);
    let fresh = 0;
    for (const article of articles) {
      const more = [...article.querySelectorAll('button,[role="button"]')].filter(node => node.getClientRects().length && clean(node.innerText) === 'See more');
      if (more.length) { more.forEach(node => node.click()); continue; }
      const text = clean([...article.querySelectorAll('div[dir="auto"]')].map(node => node.innerText).filter(Boolean).join(' '));
      const key = keyOf(text);
      if (key && !seen.has(key)) { seen.add(key); queue.push(text); fresh++; }
    }
    if (fresh) { timer.idle = 0; render(); if (autoPlay && !playing && !paused) speak(); }
    else timer.idle++;
    if (timer.clicks < 20) {
      const more = [...document.querySelectorAll('button,[role="button"]')]
        .find(node => node.getClientRects().length && /^(?:View more comments|View \d+ repl(?:y|ies))$/i.test(clean(node.innerText)));
      if (more) { more.click(); timer.clicks++; }
    }
    if (timer.moves < 8 && timer.idle < 5) {
      const last = articles.at(-1);
      for (let pane = last?.parentElement; pane && pane !== document.body; pane = pane.parentElement) {
        if (pane === document.documentElement || pane === document.scrollingElement) break;
        if (pane.scrollHeight <= pane.clientHeight + 100 || !/auto|scroll/.test(getComputedStyle(pane).overflowY)) continue;
        const before = pane.scrollTop;
        pane.scrollTop = Math.min(pane.scrollHeight, before + pane.clientHeight * .8);
        if (pane.scrollTop > before) timer.moves++;
        break;
      }
    }
    if (timer.idle >= 8 || Date.now() - timer.started > 40000 || (timer.clicks >= 20 && timer.moves >= 8)) finish();
  }

  function finish() {
    clearInterval(timer.id);
    collecting = false;
    render();
    status(queue.length ? `${queue.length} comments loaded. ${playing ? 'Reading now.' : 'Press Play to listen.'}` : 'No visible comments found on this post.');
  }

  async function selectNewest() {
    const visible = node => node.getClientRects().length;
    const sort = [...document.querySelectorAll('button,[role="button"]')]
      .find(node => visible(node) && /^(Most relevant|Newest|All comments)$/i.test(clean(node.innerText)));
    if (!sort) return false;
    if (clean(sort.innerText) === 'Newest') return true;
    sort.click();
    let option;
    for (let attempt = 0; attempt < 15; attempt++) {
      if (!collecting) return false;
      option = [...document.querySelectorAll('[role="menuitem"]')]
        .find(node => visible(node) && /^Newest(?:\s|$)/i.test(clean(node.innerText)));
      if (option) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!option) return false;
    option.click();
    for (let attempt = 0; attempt < 30; attempt++) {
      if (!collecting) return false;
      if (clean(sort.innerText) === 'Newest' || [...document.querySelectorAll('button,[role="button"]')]
        .some(node => visible(node) && clean(node.innerText) === 'Newest')) {
        await new Promise(resolve => setTimeout(resolve, 600));
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  async function collect(showPanel = true) {
    if (showPanel) show();
    if (!postPage()) { status('Open a Facebook post first.'); return; }
    if (collecting) return;
    stop();
    queue.length = 0; seen.clear(); index = 0;
    collecting = autoPlay = true;
    render();
    status('Sorting comments by newest.');
    const newest = await selectNewest();
    if (!collecting) return;
    status(newest ? 'Newest selected. Collecting comments.' : 'Newest sort unavailable. Collecting visible comments.');
    timer = {started:Date.now(), idle:0, clicks:0, moves:0, id:setInterval(tick, 1000)};
    tick();
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === 'reader-state') { respond(state()); return; }
    if (message?.type === 'collect-and-play') {
      if (!postPage()) { respond({ok:false,error:'Open a Facebook post first.'}); return; }
      collect(false); respond(state()); return;
    }
    if (message?.type === 'reader-control') {
      if (message.action === 'clear') clearCollection();
      else if (message.action === 'play') toggle();
      else if (message.action === 'previous') step(-1);
      else if (message.action === 'next') step(1);
      else if (message.action === 'stop') stop();
      else if (message.action === 'show') show();
      else { respond({ok:false,error:'Unknown control.'}); return; }
      respond(state());
    }
  });
  setInterval(() => {
    if (!host && postPage()) createPanel();
  }, 1200);
})();
