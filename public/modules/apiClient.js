(function attachApiClientModule(window) {
  'use strict';

  async function fetchJson(url, options) {
    const response = await fetch(url, options || {});
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    if (!response.ok) {
      const error = new Error((body && (body.message || body.detail || body.error)) || `Request failed: ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.apiClient = { fetchJson };
})(window);

