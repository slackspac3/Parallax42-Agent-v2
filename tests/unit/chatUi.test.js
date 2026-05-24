'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadChatUiModule() {
  const window = {
    P42ModuleRegistry: {
      text: {
        cleanText: (value = '') => String(value || '').replace(/\s+/g, ' ').trim(),
        escapeHtml: (value = '') => String(value || '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;')
      }
    }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'modules', 'chatUi.js'), 'utf8');
  vm.runInNewContext(source, { window });
  return window.P42ModuleRegistry.chatUi;
}

test('isFlowingProse accepts complete natural prose and rejects deterministic labels', () => {
  const chatUi = loadChatUiModule();

  assert.equal(chatUi.isFlowingProse('I reviewed the uploaded agreement and will focus on data protection, privileged access, and continuity. Which area should I prioritize first?'), true);
  assert.equal(chatUi.isFlowingProse('Next question: Which geography should I apply?'), false);
  assert.equal(chatUi.isFlowingProse('Gateway fallback: I could not reach Compass, so I used deterministic intake.'), false);
  assert.equal(chatUi.isFlowingProse('Short but complete.'), false);
});

test('renderAssistantTurn keeps flowing prose intact in the latest assistant card', () => {
  const chatUi = loadChatUiModule();
  const prose = 'I reviewed the Managed Platform Integration Services Agreement context and will focus the review on data protection, privileged access, and continuity. Which of those should I prioritize first?';

  const html = chatUi.renderAssistantTurn({ text: prose }, {
    canRun: true,
    chatMessageCount: 4,
    hasChatContext: true,
    isLatest: true,
    responseText: prose,
    source: 'compass_gateway'
  });

  assert.match(html, /advisor-prose-response/);
  assert.match(html, /data protection, privileged access, and continuity/);
  assert.match(html, /data-chat-action="run-council"/);
  assert.doesNotMatch(html, /advisor-next-question/);
});

test('renderAssistantTurn prefers supplied latest hint chips with chat handlers', () => {
  const chatUi = loadChatUiModule();
  const html = chatUi.renderAssistantTurn({ text: 'I updated the review context.' }, {
    canRun: true,
    chatMessageCount: 4,
    hasChatContext: true,
    hintChips: [
      { label: 'Add owner', prompt: 'The accountable owner is ' },
      { label: 'Run council', action: 'run-council' }
    ],
    isLatest: true,
    question: 'Which geography or regulatory perimeter should I apply?',
    responseText: 'I updated the review context.'
  });

  assert.match(html, /advisor-hint-chips/);
  assert.match(html, /data-hint-chip="The accountable owner is "/);
  assert.match(html, /data-chat-action="run-council"/);
  assert.doesNotMatch(html, /data-intel-prompt/);
  assert.doesNotMatch(html, /UAE and India/);
});
