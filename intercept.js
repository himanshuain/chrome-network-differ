if (!window.__apiDifferInjected) {
  window.__apiDifferInjected = true;

  const send = (data) => {
    try {
      window.postMessage({ type: "__API_DIFFER_CAPTURE__", payload: data }, "*");
    } catch (_) {}
  };

  const ts = () => new Date().toISOString();
  const safeJSON = (s) => { try { return JSON.parse(s); } catch { return s; } };
  const ORIGIN = location.origin;

  const headersToObj = (h) => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (typeof h === "object" && !Array.isArray(h)) return { ...h };
    return {};
  };

  // --- Intercept fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const [input, init = {}] = args;
    const url = typeof input === "string" ? input : (input?.url || String(input));
    const method = (init.method || (input?.method) || "GET").toUpperCase();
    let requestBody = null;
    if (init.body) {
      requestBody = typeof init.body === "string" ? safeJSON(init.body) : "[binary]";
    }
    const reqHeaders = headersToObj(init.headers);

    const startTime = performance.now();
    try {
      const response = await origFetch.apply(this, args);
      const clone = response.clone();
      const duration = Math.round(performance.now() - startTime);

      const resHeaders = {};
      response.headers.forEach((v, k) => { resHeaders[k] = v; });

      let responseBody;
      try { responseBody = await clone.json(); } catch { try { responseBody = await clone.text(); } catch { responseBody = null; } }

      send({
        id: crypto.randomUUID(),
        timestamp: ts(),
        origin: ORIGIN,
        url, method,
        status: response.status,
        statusText: response.statusText,
        duration,
        requestHeaders: reqHeaders,
        responseHeaders: resHeaders,
        requestBody,
        responseBody,
      });
      return response;
    } catch (err) {
      send({
        id: crypto.randomUUID(),
        timestamp: ts(),
        origin: ORIGIN,
        url, method,
        status: 0, statusText: "Network Error",
        duration: Math.round(performance.now() - startTime),
        requestHeaders: reqHeaders,
        responseHeaders: {},
        requestBody,
        responseBody: null,
        error: err.message,
      });
      throw err;
    }
  };

  // --- Intercept XMLHttpRequest ---
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  const XHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ad = { method: method.toUpperCase(), url, startTime: 0, reqHeaders: {} };
    return XHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__ad) this.__ad.reqHeaders[name] = value;
    return XHRSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this.__ad) {
      this.__ad.startTime = performance.now();
      this.__ad.requestBody = body ? safeJSON(body) : null;

      this.addEventListener("load", function () {
        const d = this.__ad;
        const resHeaders = {};
        (this.getAllResponseHeaders() || "").trim().split(/\r?\n/).forEach(line => {
          const idx = line.indexOf(":");
          if (idx > 0) resHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        });

        send({
          id: crypto.randomUUID(),
          timestamp: ts(),
          origin: ORIGIN,
          url: d.url,
          method: d.method,
          status: this.status,
          statusText: this.statusText,
          duration: Math.round(performance.now() - d.startTime),
          requestHeaders: d.reqHeaders,
          responseHeaders: resHeaders,
          requestBody: d.requestBody,
          responseBody: safeJSON(this.responseText),
        });
      });
    }
    return XHRSend.apply(this, arguments);
  };

  console.log(
    "%c API Differ %c Capturing requests on this tab",
    "background:#89b4fa;color:#1e1e2e;padding:2px 6px;border-radius:3px;font-weight:bold",
    "color:#a6e3a1"
  );
}
