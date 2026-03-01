(function() {
  if (document.getElementById("__apiDifferFloat")) return;

  var STORE_KEY = "__apiDifferPos";
  var MARGIN = 8;

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch(e) {}
  var posX = saved.x != null ? saved.x : null;
  var posY = saved.y != null ? saved.y : null;
  var isHidden = !!saved.hidden;
  var isInjected = false;

  function clampToViewport() {
    if (posX == null || posY == null) return;
    var rect = wrap.getBoundingClientRect();
    var w = rect.width || 200;
    var h = rect.height || 40;
    var maxX = window.innerWidth - w - MARGIN;
    var maxY = window.innerHeight - h - MARGIN;
    var changed = false;
    if (posX > maxX) { posX = Math.max(MARGIN, maxX); changed = true; }
    if (posY > maxY) { posY = Math.max(MARGIN, maxY); changed = true; }
    if (posX < MARGIN) { posX = MARGIN; changed = true; }
    if (posY < MARGIN) { posY = MARGIN; changed = true; }
    if (changed) {
      wrap.style.left = posX + "px";
      wrap.style.top = posY + "px";
    }
  }

  var wrap = document.createElement("div");
  wrap.id = "__apiDifferFloat";
  wrap.style.cssText = "position:fixed;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,sans-serif;";
  if (posX != null && posY != null) {
    wrap.style.left = posX + "px";
    wrap.style.top = posY + "px";
  } else {
    wrap.style.top = "12px";
    wrap.style.right = "16px";
  }

  if (isHidden) wrap.style.display = "none";

  var badge = document.createElement("span");
  badge.id = "__adBadge";
  badge.style.cssText = "display:none;min-width:22px;height:22px;border-radius:5px;font-size:10px;font-weight:800;color:#1e1e2e;align-items:center;justify-content:center;flex-shrink:0;padding:0 4px;letter-spacing:-0.5px;";

  var markerNum = "";
  var markerColor = "";

  chrome.runtime.sendMessage({ type: "GET_TAB_MARKER" }, function(res) {
    if (res && res.marker) {
      markerNum = res.marker.num;
      markerColor = res.marker.color;
      badge.textContent = res.marker.label || ("#" + markerNum);
      badge.style.background = markerColor;
      badge.style.display = "flex";
    }
  });

  var eye = document.createElement("button");
  eye.id = "__adEye";
  eye.textContent = "\uD83D\uDC41";
  eye.title = "Hide API Differ";
  eye.style.cssText = "width:28px;height:28px;border-radius:50%;border:none;background:#313244;color:#89b4fa;font-size:15px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;line-height:1;";

  var btns = document.createElement("div");
  btns.id = "__adBtns";
  btns.style.cssText = "display:flex;gap:6px;align-items:center;";

  var injectBtn = document.createElement("button");
  injectBtn.id = "__adInject";
  injectBtn.textContent = "Inject Differ";
  injectBtn.style.cssText = "padding:5px 10px;border-radius:6px;border:none;background:#a6e3a1;color:#1e1e2e;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;";

  var openBtn = document.createElement("button");
  openBtn.id = "__adOpen";
  openBtn.textContent = "Open Differ";
  openBtn.style.cssText = "padding:5px 10px;border-radius:6px;border:none;background:#89b4fa;color:#1e1e2e;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;";

  btns.appendChild(injectBtn);
  btns.appendChild(openBtn);

  var inner = document.createElement("div");
  inner.style.cssText = "display:flex;gap:6px;align-items:center;padding:4px;background:rgba(30,30,46,0.85);border-radius:10px;backdrop-filter:blur(8px);border:1px solid #45475a;cursor:grab;";
  inner.appendChild(badge);
  inner.appendChild(eye);
  inner.appendChild(btns);
  wrap.appendChild(inner);
  document.body.appendChild(wrap);

  requestAnimationFrame(clampToViewport);
  window.addEventListener("resize", clampToViewport);

  function markInjected() {
    isInjected = true;
    injectBtn.textContent = "\u2713 Injected";
    injectBtn.style.background = "#f9e2af";
    injectBtn.style.cursor = "default";
  }

  function hideFloat() {
    isHidden = true;
    wrap.style.display = "none";
    savePos();
  }

  function showFloat() {
    isHidden = false;
    wrap.style.display = "";
    savePos();
    requestAnimationFrame(clampToViewport);
  }

  chrome.runtime.sendMessage({ type: "RE_INJECT_CHECK" }, function(res) {
    if (res && res.injected) markInjected();
  });

  eye.addEventListener("click", function(e) {
    e.stopPropagation();
    hideFloat();
  });

  injectBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    if (isInjected) return;
    window.postMessage({ type: "__API_DIFFER_DO_INJECT__" }, "*");
    markInjected();
  });

  openBtn.addEventListener("click", function(e) {
    e.stopPropagation();
    window.postMessage({ type: "__API_DIFFER_DO_OPEN__" }, "*");
  });

  var dragging = false, dragOffX = 0, dragOffY = 0;
  inner.addEventListener("mousedown", function(e) {
    if (e.target.tagName === "BUTTON") return;
    dragging = true;
    inner.style.cursor = "grabbing";
    var rect = wrap.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    e.preventDefault();
  });

  document.addEventListener("mousemove", function(e) {
    if (!dragging) return;
    var rect = wrap.getBoundingClientRect();
    var w = rect.width || 200;
    var h = rect.height || 40;
    var x = Math.max(MARGIN, Math.min(window.innerWidth - w - MARGIN, e.clientX - dragOffX));
    var y = Math.max(MARGIN, Math.min(window.innerHeight - h - MARGIN, e.clientY - dragOffY));
    wrap.style.left = x + "px";
    wrap.style.top = y + "px";
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
    posX = x; posY = y;
  });

  document.addEventListener("mouseup", function() {
    if (dragging) { dragging = false; inner.style.cursor = "grab"; savePos(); }
  });

  function savePos() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ x: posX, y: posY, hidden: isHidden })); } catch(e) {}
  }

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === "REMOVE_FLOAT") {
      var el = document.getElementById("__apiDifferFloat");
      if (el) el.remove();
      window.removeEventListener("resize", clampToViewport);
    } else if (msg.type === "SHOW_FLOAT") {
      showFloat();
    } else if (msg.type === "HIDE_FLOAT") {
      hideFloat();
    } else if (msg.type === "UPDATE_LABEL") {
      badge.textContent = msg.label || ("#" + markerNum);
    }
  });
})();
