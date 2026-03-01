var statusEl = document.getElementById("status");
var countEl = document.getElementById("count");
var toggleBtn = document.getElementById("toggleFloatBtn");
var toggleLabel = document.getElementById("toggleLabel");
var eyeIcon = document.getElementById("eyeIcon");

var floatVisible = true;

var EYE_OPEN = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
var EYE_CLOSED = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';

chrome.runtime.sendMessage({ type: "GET_ALL" }, function(res) {
  var n = (res && res.requests && res.requests.length) || 0;
  countEl.innerHTML = "Captured: <strong>" + n + "</strong> requests";
});

(async function checkFloatState() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];
  if (!tab) return;
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        var el = document.getElementById("__apiDifferFloat");
        if (!el) return "none";
        return el.style.display === "none" ? "hidden" : "visible";
      }
    });
    var state = results && results[0] && results[0].result;
    if (state === "visible") {
      floatVisible = true;
      toggleLabel.textContent = "Hide Floating Buttons";
      eyeIcon.innerHTML = EYE_OPEN;
    } else {
      floatVisible = false;
      toggleLabel.textContent = "Show Floating Buttons";
      eyeIcon.innerHTML = EYE_CLOSED;
    }
  } catch(e) {}
})();

document.getElementById("injectBtn").addEventListener("click", async function() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];
  if (!tab) return;

  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["bridge.js"], world: "ISOLATED" }, function() {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["intercept.js"], world: "MAIN" }, function() {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["float.js"], world: "ISOLATED" }, function() {
        statusEl.innerHTML = 'Status: <span class="on">Capturing + Float added</span>';
      });
    });
  });
});

document.getElementById("openBtn").addEventListener("click", function() {
  chrome.tabs.create({ url: chrome.runtime.getURL("differ.html") });
  window.close();
});

toggleBtn.addEventListener("click", async function() {
  var tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];
  if (!tab) return;
  if (floatVisible) {
    chrome.tabs.sendMessage(tab.id, { type: "HIDE_FLOAT" });
    floatVisible = false;
    toggleLabel.textContent = "Show Floating Buttons";
    eyeIcon.innerHTML = EYE_CLOSED;
  } else {
    chrome.tabs.sendMessage(tab.id, { type: "SHOW_FLOAT" });
    floatVisible = true;
    toggleLabel.textContent = "Hide Floating Buttons";
    eyeIcon.innerHTML = EYE_OPEN;
  }
});

document.getElementById("clearBtn").addEventListener("click", function() {
  chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, function() {
    countEl.innerHTML = "Captured: <strong>0</strong> requests";
  });
});
