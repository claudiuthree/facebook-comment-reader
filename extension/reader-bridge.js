const origin = location.origin;

function tellPage(message) {
  window.postMessage({...message, source: 'fbcr-extension'}, origin);
}

window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== origin || event.data?.source !== 'fbcr-page') return;
  if (event.data.type === 'ping') {
    tellPage({type: 'ready'});
  } else if (event.data.type === 'start') {
    chrome.runtime.sendMessage({type: 'start', url: event.data.url});
  }
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.source === 'fbcr-background') tellPage(message);
});

tellPage({type: 'ready'});
