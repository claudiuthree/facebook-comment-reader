document.getElementById('start').addEventListener('click', async () => {
  const status = document.getElementById('status');
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.url?.startsWith('https://www.facebook.com/')) throw new Error('Open a Facebook post first.');
    const result = await chrome.tabs.sendMessage(tab.id, {type: 'collect-and-play'});
    if (!result?.ok) throw new Error(result?.error || 'Could not start.');
    window.close();
  } catch (error) {
    status.textContent = error.message.includes('Receiving end') ? 'Refresh the Facebook tab and try again.' : error.message;
  }
});
