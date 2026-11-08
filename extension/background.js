const jobs = new Map();

function validPost(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && ((url.hostname === 'fb.watch' && url.pathname.length > 1) || (url.hostname === 'facebook.com' && /^\/(?:[^/]+\/posts\/|reel\/|permalink\.php)/.test(url.pathname)));
  } catch { return false; }
}

async function tellReader(job, message) {
  try { await chrome.tabs.sendMessage(job.readerTabId, {source: 'fbcr-background', url: job.url, ...message}); }
  catch { /* Reader tab may have closed. */ }
}

async function finish(job, error) {
  if (!jobs.has(job.facebookTabId)) return;
  jobs.delete(job.facebookTabId);
  clearTimeout(job.timer);
  await job.delivery;
  await tellReader(job, error ? {type: 'error', error} : {type: 'done'});
  try { await chrome.tabs.remove(job.facebookTabId); } catch { /* Already closed. */ }
}

async function beginCollection(job) {
  for (let attempt = 0; attempt < 8 && jobs.has(job.facebookTabId); attempt++) {
    try {
      await chrome.tabs.sendMessage(job.facebookTabId, {type: 'collect'});
      return;
    } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  await finish(job, 'The Facebook page did not allow the collector to start.');
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'start') {
    const readerUrl = sender.tab?.url || '';
    if (!readerUrl.startsWith('https://facebook-comment-reader.claudiuone.workers.dev/') || !validPost(message.url)) return;
    (async () => {
      for (const job of [...jobs.values()]) if (job.readerTabId === sender.tab.id) await finish(job, 'A different post was selected.');
      const facebookTab = await chrome.tabs.create({url: message.url, active: true});
      const job = {readerTabId: sender.tab.id, facebookTabId: facebookTab.id, url: message.url, timer: null, delivery: Promise.resolve()};
      jobs.set(facebookTab.id, job);
      job.timer = setTimeout(() => finish(job, 'Collection stopped after 75 seconds.'), 75000);
      await tellReader(job, {type: 'opened'});
      if (facebookTab.status === 'complete') await beginCollection(job);
    })().catch(error => {
      chrome.tabs.sendMessage(sender.tab.id, {source: 'fbcr-background', type: 'error', url: message.url, error: error.message}).catch(() => {});
    });
    return;
  }
  const job = jobs.get(sender.tab?.id);
  if (!job) return;
  if (message?.type === 'batch') {
    const items = Array.isArray(message.items) ? message.items.slice(0, 100).map(item => ({text: String(item.text || '').slice(0, 5000)})).filter(item => item.text) : [];
    if (items.length) job.delivery = job.delivery.then(() => tellReader(job, {type: 'batch', items}));
  } else if (message?.type === 'done') {
    finish(job);
  } else if (message?.type === 'error') {
    finish(job, String(message.error || 'Facebook collection failed.'));
  }
});

chrome.tabs.onUpdated.addListener((tabId, change) => {
  const job = jobs.get(tabId);
  if (job && change.status === 'complete') beginCollection(job);
});

chrome.tabs.onRemoved.addListener(tabId => {
  const job = jobs.get(tabId);
  if (job) finish(job, 'The Facebook tab was closed before collection finished.');
});
