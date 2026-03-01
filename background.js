const captured = [];
const injectedTabs = new Set();
const devtoolsTabs = new Set();

const TAB_COLORS = ["#89b4fa","#a6e3a1","#fab387","#f38ba8","#cba6f7","#94e2d5","#f9e2af","#f5c2e7","#74c7ec","#b4befe"];
const tabMarkers = {};

function getTabMarker(tabId) {
  if (!tabMarkers[tabId]) {
    const usedNums = new Set(Object.values(tabMarkers).map(m => m.num));
    let num = 1;
    while (usedNums.has(num)) num++;
    tabMarkers[tabId] = { num: num, color: TAB_COLORS[(num - 1) % TAB_COLORS.length] };
  }
  return tabMarkers[tabId];
}

function updateBadge(tabId) {
  if (devtoolsTabs.has(tabId) && tabMarkers[tabId]) {
    const m = tabMarkers[tabId];
    const text = m.label ? m.label.substring(0, 4) : ("#" + m.num);
    chrome.action.setBadgeText({ text: text, tabId: tabId });
    chrome.action.setBadgeBackgroundColor({ color: m.color, tabId: tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId: tabId });
  }
}

function injectFloatIntoTab(tid) {
  chrome.scripting.executeScript({
    target: { tabId: tid },
    files: ["bridge.js"],
    world: "ISOLATED",
  }).then(() => {
    return chrome.scripting.executeScript({
      target: { tabId: tid },
      files: ["float.js"],
      world: "ISOLATED",
    });
  }).catch(() => {});

  if (injectedTabs.has(tid)) {
    chrome.scripting.executeScript({
      target: { tabId: tid },
      files: ["intercept.js"],
      world: "MAIN",
    }).catch(() => {});
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith("devtools-")) return;
  const tid = parseInt(port.name.replace("devtools-", ""), 10);
  if (tid) {
    devtoolsTabs.add(tid);
    getTabMarker(tid);
    updateBadge(tid);
    injectFloatIntoTab(tid);
  }

  port.onMessage.addListener((msg) => {
    if (msg.type === "INJECT_FLOAT" && msg.tabId) {
      injectFloatIntoTab(msg.tabId);
    }
  });

  port.onDisconnect.addListener(() => {
    devtoolsTabs.delete(tid);
    if (tid) {
      updateBadge(tid);
      chrome.tabs.sendMessage(tid, { type: "REMOVE_FLOAT" }).catch(() => {});
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "CAPTURED_REQUEST") {
    const tid = sender.tab && sender.tab.id;
    if (tid && !devtoolsTabs.has(tid)) {
      sendResponse({ ok: false, reason: "devtools_closed" });
      return true;
    }
    if (sender.tab) {
      msg.data.tabId = tid;
      msg.data.tabTitle = sender.tab.title || "";
      const marker = getTabMarker(tid);
      msg.data.tabMarkerNum = marker.num;
      msg.data.tabMarkerColor = marker.color;
      msg.data.tabCustomLabel = marker.label || "";
    }
    captured.push(msg.data);
    if (captured.length > 500) captured.shift();
    sendResponse({ ok: true });

  } else if (msg.type === "GET_ALL") {
    sendResponse({ requests: captured });

  } else if (msg.type === "CLEAR_ALL") {
    captured.length = 0;
    sendResponse({ ok: true });

  } else if (msg.type === "DO_INJECT") {
    const tid = sender.tab ? sender.tab.id : msg.tabId;
    if (tid) {
      injectedTabs.add(tid);
      chrome.scripting.executeScript({
        target: { tabId: tid },
        files: ["bridge.js"],
        world: "ISOLATED",
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tid },
          files: ["intercept.js"],
          world: "MAIN",
        });
      });
    }
    sendResponse({ ok: true });

  } else if (msg.type === "DO_OPEN") {
    chrome.tabs.create({ url: chrome.runtime.getURL("differ.html") });
    sendResponse({ ok: true });

  } else if (msg.type === "INJECT_FLOAT") {
    const tid = msg.tabId;
    if (tid) {
      chrome.scripting.executeScript({
        target: { tabId: tid },
        files: ["bridge.js"],
        world: "ISOLATED",
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tid },
          files: ["float.js"],
          world: "ISOLATED",
        });
      });
    }
    sendResponse({ ok: true });

  } else if (msg.type === "DEVTOOLS_OPENED") {
    if (msg.tabId) {
      devtoolsTabs.add(msg.tabId);
      getTabMarker(msg.tabId);
    }
    sendResponse({ ok: true });

  } else if (msg.type === "CHECK_INJECTED") {
    const tid = msg.tabId;
    sendResponse({ injected: injectedTabs.has(tid) });

  } else if (msg.type === "GET_TAB_MARKER") {
    const tid = msg.tabId || (sender.tab && sender.tab.id);
    if (tid) {
      const marker = getTabMarker(tid);
      sendResponse({ marker: marker });
    } else {
      sendResponse({ marker: null });
    }

  } else if (msg.type === "SET_TAB_LABEL") {
    const tid = parseInt(msg.tabId, 10);
    if (tid) {
      const marker = getTabMarker(tid);
      marker.label = msg.label || "";
      captured.forEach(r => { if (r.tabId === tid) r.tabCustomLabel = marker.label; });
      chrome.tabs.sendMessage(tid, { type: "UPDATE_LABEL", label: marker.label }).catch(() => {});
      const badgeText = marker.label || ("#" + marker.num);
      chrome.action.setBadgeText({ text: badgeText.substring(0, 4), tabId: tid }).catch(() => {});
      chrome.action.setBadgeBackgroundColor({ color: marker.color, tabId: tid }).catch(() => {});
    }
    sendResponse({ ok: true });

  } else if (msg.type === "RE_INJECT_CHECK") {
    const tid = msg.tabId || (sender.tab && sender.tab.id);
    if (tid && injectedTabs.has(tid)) {
      chrome.scripting.executeScript({
        target: { tabId: tid },
        files: ["bridge.js"],
        world: "ISOLATED",
      }, () => {
        chrome.scripting.executeScript({
          target: { tabId: tid },
          files: ["intercept.js"],
          world: "MAIN",
        });
      });
    }
    sendResponse({ injected: tid ? injectedTabs.has(tid) : false });
  }
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
  devtoolsTabs.delete(tabId);
  delete tabMarkers[tabId];
});
