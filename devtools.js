var tabId = chrome.devtools.inspectedWindow.tabId;

var port = chrome.runtime.connect({ name: "devtools-" + tabId });

port.postMessage({ type: "INJECT_FLOAT", tabId: tabId });

chrome.devtools.network.onNavigated.addListener(function() {
  setTimeout(function() {
    port.postMessage({ type: "INJECT_FLOAT", tabId: tabId });
  }, 300);
});
