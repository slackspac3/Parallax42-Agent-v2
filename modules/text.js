(function attachTextModule(window) {
  'use strict';

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function humanize(value) {
    return cleanText(value).replace(/[_-]+/g, ' ').replace(/\b\w/g, function upper(letter) {
      return letter.toUpperCase();
    });
  }

  function unique(values) {
    return Array.from(new Set((values || []).map(function normalize(value) {
      return String(value || '').trim();
    }).filter(Boolean)));
  }

  function compactJson(value) {
    try {
      return JSON.stringify(value || {});
    } catch {
      return '{}';
    }
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.text = {
    cleanText,
    compactJson,
    escapeHtml,
    humanize,
    unique
  };
})(window);
