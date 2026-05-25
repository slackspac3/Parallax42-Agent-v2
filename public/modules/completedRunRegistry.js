(function attachCompletedRunRegistryModule(window) {
  'use strict';

  function isCompletedRun(run) {
    return Boolean(run && typeof run === 'object' && run.ok);
  }

  function selectLatestCompletedRun(state = {}, preferredMode = '') {
    const lastRuns = state.lastRuns && typeof state.lastRuns === 'object' ? state.lastRuns : {};
    if (preferredMode && isCompletedRun(lastRuns[preferredMode])) return lastRuns[preferredMode];
    if (isCompletedRun(state.latestCompletedRun)) return state.latestCompletedRun;
    if (isCompletedRun(lastRuns.chat)) return lastRuns.chat;
    if (isCompletedRun(lastRuns.live)) return lastRuns.live;
    if (isCompletedRun(lastRuns.demo)) return lastRuns.demo;
    if (isCompletedRun(state.lastRun)) return state.lastRun;
    return null;
  }

  window.P42ModuleRegistry = window.P42ModuleRegistry || {};
  window.P42ModuleRegistry.completedRunRegistry = {
    isCompletedRun,
    selectLatestCompletedRun
  };
})(window);
