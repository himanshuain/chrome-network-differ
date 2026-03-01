var allRequests = [];
var pinnedA = null;
var pinnedB = null;
var selectedReq = null;
var currentTab = "response";
var viewMode = "inspect"; // "inspect" or "diff"
var diffOnly = false;
var collapsedGroups = {};

var ORIGIN_COLORS = ["#89b4fa","#a6e3a1","#fab387","#f38ba8","#cba6f7","#94e2d5","#f9e2af","#f5c2e7","#74c7ec","#b4befe"];
var originColorMap = {};
var colorIdx = 0;
function getOriginColor(o) {
  if (!originColorMap[o]) { originColorMap[o] = ORIGIN_COLORS[colorIdx % ORIGIN_COLORS.length]; colorIdx++; }
  return originColorMap[o];
}

var $list = document.getElementById("requestList");
var $empty = document.getElementById("emptyState");
var $filter = document.getElementById("filterInput");
var $diffToolbar = document.getElementById("diffToolbar");
var $diffLabels = document.getElementById("diffLabels");
var $diffContent = document.getElementById("diffContent");
var $labelA = document.getElementById("labelA");
var $labelB = document.getElementById("labelB");
var $statsBar = document.getElementById("statsBar");
var $diffOnlyBtn = document.getElementById("diffOnlyBtn");
var $modeIndicator = document.getElementById("modeIndicator");

/* ── Resizable Panel ─────────────────────────────────── */
(function() {
  var $panel = document.getElementById("leftPanel");
  var $handle = document.getElementById("resizeHandle");
  if (!$panel || !$handle) return;
  var dragging = false;
  var PANEL_KEY = "__apiDifferPanelWidth";
  var savedW = localStorage.getItem(PANEL_KEY);
  if (savedW) $panel.style.width = savedW + "px";

  $handle.addEventListener("mousedown", function(e) {
    dragging = true;
    $handle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", function(e) {
    if (!dragging) return;
    var w = Math.max(200, Math.min(window.innerWidth * 0.7, e.clientX));
    $panel.style.width = w + "px";
  });

  document.addEventListener("mouseup", function() {
    if (!dragging) return;
    dragging = false;
    $handle.classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try { localStorage.setItem(PANEL_KEY, $panel.offsetWidth); } catch(e) {}
  });
})();

/* ── Load ─────────────────────────────────────────────── */
function loadRequests() {
  chrome.runtime.sendMessage({ type: "GET_ALL" }, function(res) {
    allRequests = (res && res.requests) || [];
    renderList();
  });
}
loadRequests();
setInterval(loadRequests, 2000);

document.getElementById("refreshBtn").addEventListener("click", loadRequests);
document.getElementById("clearBtn").addEventListener("click", function() {
  chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, function() {
    allRequests = [];
    pinnedA = pinnedB = selectedReq = null;
    viewMode = "inspect";
    renderList();
    renderRight();
  });
});
$filter.addEventListener("input", renderList);

$diffOnlyBtn.addEventListener("click", function() {
  diffOnly = !diffOnly;
  $diffOnlyBtn.classList.toggle("active", diffOnly);
  renderRight();
});

document.querySelectorAll(".density-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.body.className = "density-" + btn.dataset.density;
    document.querySelectorAll(".density-btn").forEach(function(b) { b.classList.toggle("active", b === btn); });
  });
});

$diffToolbar.addEventListener("click", function(e) {
  var tab = e.target.closest(".tab");
  if (!tab) return;
  currentTab = tab.dataset.tab;
  $diffToolbar.querySelectorAll(".tab").forEach(function(t) { t.classList.toggle("active", t === tab); });
  renderRight();
});

/* ── Render List ──────────────────────────────────────── */
function renderList() {
  var filter = $filter.value.toLowerCase();
  var filtered = allRequests.filter(function(r) { return !filter || r.url.toLowerCase().indexOf(filter) !== -1; });

  $list.querySelectorAll(".origin-group").forEach(function(el) { el.remove(); });

  if (filtered.length === 0) { $empty.style.display = ""; return; }
  $empty.style.display = "none";

  var groups = {};
  var groupOrder = [];
  filtered.forEach(function(req) {
    var tabId = req.tabId || "?";
    var origin = req.origin || "unknown";
    var groupKey = tabId + "|" + origin;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        reqs: [], tabId: tabId, origin: origin,
        tabTitle: req.tabTitle || "",
        markerNum: req.tabMarkerNum || null,
        markerColor: req.tabMarkerColor || null,
        customLabel: req.tabCustomLabel || ""
      };
      groupOrder.push(groupKey);
    }
    if (req.tabCustomLabel && !groups[groupKey].customLabel) {
      groups[groupKey].customLabel = req.tabCustomLabel;
    }
    groups[groupKey].reqs.push(req);
  });

  groupOrder.forEach(function(groupKey) {
    var group = groups[groupKey];
    var reqs = group.reqs;
    var groupEl = document.createElement("div");
    groupEl.className = "origin-group";
    var isCollapsed = !!collapsedGroups[groupKey];
    var color = group.markerColor || getOriginColor(groupKey);

    var tabLabel = group.customLabel || (group.tabTitle ? group.tabTitle.substring(0, 40) : "Tab " + group.tabId);
    var markerText = group.customLabel || (group.markerNum ? "#" + group.markerNum : "?");
    var markerHtml = '<span class="tab-marker" style="background:' + color + ';' + (markerText.length > 3 ? 'padding:0 5px;' : '') + '">' + escHtml(markerText) + '</span>';

    var headerEl = document.createElement("div");
    headerEl.className = "origin-header";
    headerEl.style.background = tintSolid(color, 0.2);
    headerEl.style.borderLeft = "3px solid " + color;
    headerEl.innerHTML =
      '<span class="origin-chevron ' + (isCollapsed ? "collapsed" : "") + '">&#x25BC;</span>' +
      markerHtml +
      '<span class="origin-label" title="' + escHtml(group.origin) + " \u2014 " + escHtml(tabLabel) + '">' +
        '<span class="origin-env">' + escHtml(group.origin) + '</span>' +
        '<span class="origin-tab-name">' + escHtml(tabLabel) + '</span>' +
      '</span>' +
      '<button class="origin-edit" title="Set label" data-tabid="' + group.tabId + '">&#x270E;</button>' +
      '<span class="origin-count">' + reqs.length + '</span>';
    headerEl.addEventListener("click", function(e) {
      if (e.target.closest(".origin-edit")) {
        e.stopPropagation();
        var tid = group.tabId;
        var current = group.customLabel || "";
        var label = prompt("Label for this tab (leave empty to reset):", current);
        if (label === null) return;
        label = label.trim();
        chrome.runtime.sendMessage({ type: "SET_TAB_LABEL", tabId: tid, label: label }, function() {
          loadRequests();
        });
        return;
      }
      collapsedGroups[groupKey] = !collapsedGroups[groupKey];
      renderList();
    });
    groupEl.appendChild(headerEl);

    var itemsContainer = document.createElement("div");
    itemsContainer.className = "origin-items" + (isCollapsed ? " collapsed" : "");
    itemsContainer.style.background = tintSolid(color, 0.1);
    itemsContainer.style.borderLeft = "3px solid " + color;

    reqs.forEach(function(req) {
      var el = document.createElement("div");
      el.className = "request-item";
      el.style.borderBottom = "1px solid " + tintSolid(color, 0.25);
      if (pinnedA === req.id) el.classList.add("pinned-a");
      if (pinnedB === req.id) el.classList.add("pinned-b");
      if (selectedReq === req.id && viewMode === "inspect") el.classList.add("selected");

      var shortUrl = req.url.replace(/^https?:\/\/[^\/]+/, "");
      var statusClass = req.status >= 200 && req.status < 400 ? "status-ok" : "status-err";
      var time = new Date(req.timestamp).toLocaleTimeString();

      el.innerHTML =
        '<span class="method ' + req.method + '">' + req.method + '</span>' +
        '<div class="req-info">' +
          '<div class="req-url" title="' + escHtml(req.url) + '">' + escHtml(shortUrl || req.url) + '</div>' +
          '<div class="req-meta">' +
            '<span class="' + statusClass + '">' + req.status + '</span>' +
            '<span>' + (req.duration || 0) + 'ms</span>' +
            '<span>' + time + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pin-btns">' +
          '<button class="pin-btn a ' + (pinnedA === req.id ? "active-a" : "") + '" data-pin="a" data-id="' + req.id + '" title="Pin as A">A</button>' +
          '<button class="pin-btn b ' + (pinnedB === req.id ? "active-b" : "") + '" data-pin="b" data-id="' + req.id + '" title="Pin as B">B</button>' +
        '</div>';

      el.addEventListener("click", function(e) {
        var btn = e.target.closest(".pin-btn");
        if (btn) {
          var pin = btn.dataset.pin;
          var id = btn.dataset.id;
          if (pin === "a") pinnedA = (pinnedA === id) ? null : id;
          else pinnedB = (pinnedB === id) ? null : id;
          if (pinnedA && pinnedB) viewMode = "diff";
          renderList();
          renderRight();
          return;
        }
        selectedReq = req.id;
        viewMode = "inspect";
        renderList();
        renderRight();
      });

      itemsContainer.appendChild(el);
    });

    groupEl.appendChild(itemsContainer);
    $list.appendChild(groupEl);
  });
}

/* ── Right Panel ──────────────────────────────────────── */
function renderRight() {
  if (viewMode === "diff" && pinnedA && pinnedB) {
    renderDiff();
  } else if (viewMode === "inspect" && selectedReq) {
    renderInspect();
  } else {
    $diffToolbar.style.display = "none";
    $diffLabels.style.display = "none";
    $statsBar.style.display = "none";
    $modeIndicator.style.display = "none";
    $diffContent.innerHTML =
      '<div class="placeholder">' +
        '<div class="ph-icon">&#x2194;</div>' +
        '<div>Click a request to inspect it</div>' +
        '<div>Pin <span class="ph-a">A</span> and <span class="ph-b">B</span> to compare side by side</div>' +
      '</div>';
  }
}

function renderInspect() {
  var req = allRequests.find(function(r) { return r.id === selectedReq; });
  if (!req) return;

  $diffToolbar.style.display = "";
  $diffLabels.style.display = "none";
  $statsBar.style.display = "none";
  $diffOnlyBtn.style.display = "none";
  document.querySelectorAll(".density-group").forEach(function(el) { el.style.display = ""; });
  document.querySelectorAll(".diff-toolbar .separator").forEach(function(el, i) { el.style.display = i === 0 ? "" : "none"; });
  $modeIndicator.style.display = "";
  $modeIndicator.innerHTML = '<span class="mode-tag inspect-tag">Inspecting</span> <span class="mode-url">' + req.method + ' ' + escHtml(req.url.replace(/^https?:\/\/[^\/]+/, "")) + '</span> <span class="mode-status ' + (req.status < 400 ? "status-ok" : "status-err") + '">' + req.status + (req.statusText ? " " + req.statusText : "") + '</span> <span class="mode-dur">' + (req.duration || 0) + 'ms</span>';

  var data;
  if (currentTab === "response") data = req.responseBody;
  else if (currentTab === "request") data = req.requestBody;
  else data = { "Request Headers": req.requestHeaders || {}, "Response Headers": req.responseHeaders || {} };

  var html = renderJsonPretty(data, 0);
  $diffContent.innerHTML = '<div class="diff-pane" style="flex:1">' + html + '</div>';
}

function renderDiff() {
  var reqA = allRequests.find(function(r) { return r.id === pinnedA; });
  var reqB = allRequests.find(function(r) { return r.id === pinnedB; });
  if (!reqA || !reqB) { viewMode = "inspect"; renderRight(); return; }

  $diffToolbar.style.display = "";
  $diffLabels.style.display = "";
  $statsBar.style.display = "";
  $diffOnlyBtn.style.display = "";
  document.querySelectorAll(".density-group").forEach(function(el) { el.style.display = ""; });
  document.querySelectorAll(".diff-toolbar .separator").forEach(function(el) { el.style.display = ""; });
  $modeIndicator.style.display = "none";
  $modeIndicator.innerHTML = "";

  var shortA = reqA.url.replace(/^https?:\/\/[^\/]+/, "") || reqA.url;
  var shortB = reqB.url.replace(/^https?:\/\/[^\/]+/, "") || reqB.url;
  $labelA.textContent = "A \u2014 [" + (reqA.origin || "?") + "] " + reqA.method + " " + shortA;
  $labelB.textContent = "B \u2014 [" + (reqB.origin || "?") + "] " + reqB.method + " " + shortB;

  var dataA, dataB;
  if (currentTab === "response") { dataA = reqA.responseBody; dataB = reqB.responseBody; }
  else if (currentTab === "request") { dataA = reqA.requestBody; dataB = reqB.requestBody; }
  else { dataA = Object.assign({}, reqA.requestHeaders, reqA.responseHeaders); dataB = Object.assign({}, reqB.requestHeaders, reqB.responseHeaders); }

  var diffs = deepDiff(dataA, dataB, "");
  var cp = {};
  diffs.forEach(function(d) { cp[d.path] = true; });

  var linesA = [], linesB = [];
  emitValue(linesA, dataA, dataB, "", cp, 0, diffOnly, "");
  emitValue(linesB, dataB, dataA, "", cp, 0, diffOnly, "");

  $diffContent.innerHTML =
    '<div class="diff-pane" id="paneA">' + linesA.join("") + '</div>' +
    '<div class="diff-pane" id="paneB">' + linesB.join("") + '</div>';
  syncScroll("paneA", "paneB");
  syncScroll("paneB", "paneA");

  var added = 0, removed = 0, changed = 0;
  diffs.forEach(function(d) { if (d.type === "added") added++; else if (d.type === "removed") removed++; else changed++; });
  $statsBar.innerHTML =
    '<span>Differences: ' + diffs.length + '</span>' +
    '<span class="added">+' + added + ' added</span>' +
    '<span class="removed">-' + removed + ' removed</span>' +
    '<span class="changed">~' + changed + ' changed</span>' +
    (diffOnly ? ' <span style="color:var(--yellow)">Diffs only</span>' : '');
}

/* ── Inspect: Pretty Print JSON ───────────────────────── */
function renderJsonPretty(val, indent) {
  if (val === null || val === undefined) return ln("same", indent, '<span class="json-null">null</span>');
  if (typeof val !== "object") return ln("same", indent, fmtPrim(val));

  var isArr = Array.isArray(val);
  var keys = isArr ? null : Object.keys(val);
  var len = isArr ? val.length : keys.length;
  var out = ln("same", indent, isArr ? "[" : "{");
  for (var i = 0; i < len; i++) {
    var k = isArr ? i : keys[i];
    var v = isArr ? val[k] : val[k];
    var prefix = isArr ? "" : '<span class="json-key">"' + escHtml(k) + '"</span>: ';
    if (v !== null && v !== undefined && typeof v === "object") {
      var inner = renderJsonPretty(v, indent + 1);
      var first = inner.indexOf("\n");
      out += ln("same", indent + 1, prefix + (Array.isArray(v) ? "[" : "{"));
      var childKeys = Array.isArray(v) ? v : Object.keys(v);
      var childLen = Array.isArray(v) ? v.length : childKeys.length;
      for (var j = 0; j < childLen; j++) {
        var ck = Array.isArray(v) ? j : childKeys[j];
        var cv = Array.isArray(v) ? v[ck] : v[ck];
        var cp = Array.isArray(v) ? "" : '<span class="json-key">"' + escHtml(ck) + '"</span>: ';
        if (cv !== null && cv !== undefined && typeof cv === "object") {
          out += renderJsonPretty({ [ck]: cv }, indent + 1);
        } else {
          out += ln("same", indent + 2, cp + fmtPrim(cv));
        }
      }
      out += ln("same", indent + 1, Array.isArray(v) ? "]" : "}");
    } else {
      out += ln("same", indent + 1, prefix + fmtPrim(v));
    }
  }
  out += ln("same", indent, isArr ? "]" : "}");
  return out;
}

/* ── Diff Engine ──────────────────────────────────────── */
function deepDiff(a, b, path) {
  var diffs = [];
  if (a === b) return diffs;
  var aNull = a === undefined || a === null;
  var bNull = b === undefined || b === null;
  if (aNull || bNull || typeof a !== typeof b) {
    diffs.push({ path: path, type: aNull ? "added" : bNull ? "removed" : "changed" });
    return diffs;
  }
  if (typeof a !== "object") {
    if (a !== b) diffs.push({ path: path, type: "changed" });
    return diffs;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var cp = path + "[" + i + "]";
      diffs = diffs.concat(deepDiff(a[i], b[i], cp));
    }
    return diffs;
  }
  var allKeys = Object.keys(Object.assign({}, a, b));
  for (var j = 0; j < allKeys.length; j++) {
    var k = allKeys[j];
    var cp2 = path ? path + "." + k : k;
    diffs = diffs.concat(deepDiff(a ? a[k] : undefined, b ? b[k] : undefined, cp2));
  }
  return diffs;
}

function hasChangedChild(prefix, cp) {
  if (prefix === "") {
    for (var k in cp) return true;
    return false;
  }
  for (var p in cp) {
    if (p === prefix || p.indexOf(prefix + ".") === 0 || p.indexOf(prefix + "[") === 0) return true;
  }
  return false;
}

/* ── Diff Renderer ────────────────────────────────────── */
function emitValue(out, val, otherVal, path, cp, indent, od, prefix) {
  var isChanged = !!cp[path];

  if (val === null || val === undefined) {
    if (od && !isChanged) return;
    out.push(ln(isChanged ? "changed" : "same", indent, prefix + '<span class="json-null">null</span>'));
    return;
  }
  if (typeof val !== "object") {
    if (od && !isChanged) return;
    out.push(ln(isChanged ? "changed" : "same", indent, prefix + fmtPrim(val)));
    return;
  }

  if (od && !hasChangedChild(path, cp)) return;

  var isArr = Array.isArray(val);
  var keys = isArr ? null : Object.keys(val);
  var len = isArr ? val.length : keys.length;

  out.push(ln("same", indent, prefix + (isArr ? "[" : "{")));
  var skipped = 0;

  for (var i = 0; i < len; i++) {
    var key = isArr ? i : keys[i];
    var childPath = isArr ? (path + "[" + key + "]") : (path ? path + "." + key : "" + key);
    var childVal = isArr ? val[key] : val[key];
    var childOther;
    if (isArr) childOther = Array.isArray(otherVal) ? otherVal[key] : undefined;
    else childOther = (otherVal && typeof otherVal === "object") ? otherVal[key] : undefined;

    var childIsObj = childVal !== null && childVal !== undefined && typeof childVal === "object";
    var childHas = childIsObj ? hasChangedChild(childPath, cp) : !!cp[childPath];

    if (od && !childHas) { skipped++; continue; }

    if (od && skipped > 0) {
      out.push(ln("context-sep", indent + 1, "--- " + skipped + " unchanged ---"));
      skipped = 0;
    }

    var kp = isArr ? "" : '<span class="json-key">"' + escHtml(key) + '"</span>: ';
    emitValue(out, childVal, childOther, childPath, cp, indent + 1, od, kp);
  }

  if (od && skipped > 0) {
    out.push(ln("context-sep", indent + 1, "--- " + skipped + " unchanged ---"));
  }
  out.push(ln("same", indent, isArr ? "]" : "}"));
}

function syncScroll(srcId, tgtId) {
  var src = document.getElementById(srcId), tgt = document.getElementById(tgtId);
  if (!src || !tgt) return;
  var syncing = false;
  src.addEventListener("scroll", function() {
    if (syncing) return; syncing = true;
    tgt.scrollTop = src.scrollTop; tgt.scrollLeft = src.scrollLeft;
    syncing = false;
  });
}

function ln(cls, indent, content) {
  var p = ""; for (var i = 0; i < indent; i++) p += "  ";
  return '<div class="diff-line ' + cls + '">' + p + content + '</div>\n';
}

function fmtPrim(val) {
  if (val === null || val === undefined) return '<span class="json-null">null</span>';
  if (typeof val === "string") return '<span class="json-str">"' + escHtml(val) + '"</span>';
  if (typeof val === "number") return '<span class="json-num">' + val + '</span>';
  if (typeof val === "boolean") return '<span class="json-bool">' + val + '</span>';
  return escHtml(String(val));
}

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function tintSolid(hex, amount) {
  var br = 0x1e, bg = 0x1e, bb = 0x2e;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  var mr = Math.round(br + (r - br) * amount);
  var mg = Math.round(bg + (g - bg) * amount);
  var mb = Math.round(bb + (b - bb) * amount);
  return "rgb(" + mr + "," + mg + "," + mb + ")";
}
