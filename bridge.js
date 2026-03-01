if (!window.__apiDifferBridge) {
  window.__apiDifferBridge = true;

  window.addEventListener("message", function(event) {
    if (event.source !== window) return;

    if (event.data && event.data.type === "__API_DIFFER_CAPTURE__") {
      chrome.runtime.sendMessage({
        type: "CAPTURED_REQUEST",
        data: event.data.payload,
      });
    }

    if (event.data && event.data.type === "__API_DIFFER_DO_INJECT__") {
      chrome.runtime.sendMessage({ type: "DO_INJECT" });
    }

    if (event.data && event.data.type === "__API_DIFFER_DO_OPEN__") {
      chrome.runtime.sendMessage({ type: "DO_OPEN" });
    }
  });
}
