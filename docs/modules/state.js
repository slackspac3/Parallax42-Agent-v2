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

  function dataToken(value, fallback) {
    const token = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    return token || fallback;
  }

  function componentAttributes(slot, state) {
    return `data-slot="${dataToken(slot, 'component')}" data-state="${dataToken(state, 'idle')}"`;
  }

  function setComponentState(node, slot, state) {
    if (!node) return;
    node.dataset.slot = dataToken(slot, 'component');
    node.dataset.state = dataToken(state, 'idle');
  }

  function setTabSelection(button, selected) {
    if (!button) return;
    const active = Boolean(selected);
    setComponentState(button, 'tab', active ? 'active' : 'inactive');
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }

  function handleRovingTabKey(event, buttons, activate) {
    const tabs = Array.from(buttons || []).filter((button) => !button.disabled && !button.hidden);
    const index = tabs.indexOf(event.currentTarget);
    if (index < 0) return false;
    let nextIndex = index;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return false;
    event.preventDefault();
    const next = tabs[nextIndex];
    activate(next);
    next.focus();
    return true;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.appState = {
    componentAttributes,
    createSessionState,
    handleRovingTabKey,
    setComponentState,
    setTabSelection
  };
})(window);
