(function attachStateModule(window) {
  'use strict';

  function createSessionState() {
    return {
      caseDraft: {},
      uploadedEvidence: [],
      chatMessages: [{ role: 'assistant', text: 'What do you need reviewed?' }],
      lastRun: null,
      readiness: null
    };
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.appState = { createSessionState };
})(window);

