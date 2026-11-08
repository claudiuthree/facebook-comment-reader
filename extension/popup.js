const button = document.getElementById('start');
const status = document.getElementById('status');

button.addEventListener('click', async () => {
  button.disabled = true;
  status.textContent = 'Opening controls on this page.';
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab || new URL(tab.url).hostname !== 'www.facebook.com') throw new Error('Open a Facebook post in this tab first.');
    const result = await chrome.tabs.sendMessage(tab.id, {type: 'collect-and-play'});
    if (!result?.ok) throw new Error(result?.error || 'The collector could not start.');
    status.textContent = 'Collection started. Use the mini controls on the Facebook page.';
    window.close();
  } catch (error) {
    status.textContent = error.message.includes('Receiving end') ? 'Refresh this Facebook tab after updating the extension, then try again.' : error.message;
    button.disabled = false;
  }
});
