const el = id => document.getElementById(id);
let tabId;

function render(state) {
  el('count').textContent = `${state.count} unique comments loaded${state.collecting ? ' · collecting' : ''}`;
  el('position').textContent = state.count ? `Comment ${state.index + 1} of ${state.count}` : '';
  el('comment').hidden = !state.count;
  el('comment').textContent = state.comment;
  el('status').textContent = state.status || '';
  el('start').disabled = state.collecting;
  el('play').disabled = !state.count;
  el('play').textContent = state.paused ? 'Resume' : state.playing ? 'Pause' : 'Play';
  el('previous').disabled = !state.count || state.index === 0;
  el('next').disabled = !state.count || state.index >= state.count - 1;
  el('stop').disabled = !state.count && !state.collecting;
  el('clear').disabled = !state.count && !state.collecting;
}

async function send(message) {
  try {
    if (!tabId) throw new Error('Open a Facebook post first.');
    const state = await chrome.tabs.sendMessage(tabId, message);
    if (!state?.ok) throw new Error(state?.error || 'Could not connect to the post.');
    render(state);
    return true;
  } catch (error) {
    el('status').textContent = error.message.includes('Receiving end') ? 'Refresh the Facebook tab and try again.' : error.message;
    return false;
  }
}

for (const action of ['previous', 'play', 'next', 'stop', 'clear']) {
  el(action).addEventListener('click', () => send({type:'reader-control', action}));
}
el('start').addEventListener('click', () => send({type:'collect-and-play'}));
el('show').addEventListener('click', async () => {
  if (await send({type:'reader-control', action:'show'})) window.close();
});

(async () => {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.url?.startsWith('https://www.facebook.com/')) return;
  tabId = tab.id;
  el('show').disabled = false;
  await send({type:'reader-state'});
  setInterval(() => send({type:'reader-state'}), 1000);
})();
