(function attachParallax42Modules(window) {
  'use strict';

  const registry = window.P42ModuleRegistry || {};

  window.P42AppModules = {
    apiClient: registry.apiClient || {},
    appState: registry.appState || {},
    caseIntelligencePanel: registry.caseIntelligencePanel || registry.decisionRoom || {},
    chatUi: registry.chatUi || {},
    completedRunRegistry: registry.completedRunRegistry || {},
    conversationPayload: registry.conversationPayload || {},
    decisionRoom: registry.decisionRoom || {},
    evidenceIndexRestore: registry.evidenceIndexRestore || {},
    evidenceUploadPolicy: registry.evidenceUploadPolicy || {},
    evidenceUploadUi: registry.evidenceUploadUi || {},
    text: registry.text || {}
  };
})(window);
