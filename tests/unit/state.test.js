'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadStateModule() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'state.js'), 'utf8');
  const window = { P42ModuleRegistry: {} };
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.appState;
}

function fakeTab() {
  const attributes = {};
  const classes = new Set();
  return {
    attributes,
    classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
    classes,
    dataset: {},
    disabled: false,
    focus() { this.focused = true; },
    hidden: false,
    setAttribute(name, value) { attributes[name] = String(value); },
    tabIndex: -1
  };
}

test('tab helpers expose semantic state and move focus with arrow keys', () => {
  const state = loadStateModule();
  const first = fakeTab();
  const second = fakeTab();
  state.setTabSelection(first, true);
  state.setTabSelection(second, false);

  assert.equal(first.dataset.slot, 'tab');
  assert.equal(first.dataset.state, 'active');
  assert.equal(first.attributes['aria-selected'], 'true');
  assert.equal(first.tabIndex, 0);

  let activated = null;
  const handled = state.handleRovingTabKey({
    currentTarget: first,
    key: 'ArrowRight',
    preventDefault() { this.defaultPrevented = true; }
  }, [first, second], (next) => { activated = next; });

  assert.equal(handled, true);
  assert.equal(activated, second);
  assert.equal(second.focused, true);
});
