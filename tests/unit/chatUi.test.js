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

test('renderAssistantTurn keeps short Compass natural responses when explicitly flagged', () => {
  const chatUi = loadChatUiModule();
  const prose = 'Owner recorded.';

  const html = chatUi.renderAssistantTurn({ text: prose }, {
    canRun: false,
    chatMessageCount: 4,
    hasChatContext: true,
    isLatest: true,
    preferNaturalResponse: true,
    responseText: prose,
    source: 'compass_gateway'
  });

  assert.match(html, /advisor-prose-response/);
  assert.match(html, /Owner recorded\./);
  assert.doesNotMatch(html, /Got it/);
});

test('renderAssistantTurn keeps short Compass prose and still shows structured next question', () => {
  const chatUi = loadChatUiModule();
  const prose = 'I understand this as a managed integration partner review.';

  const html = chatUi.renderAssistantTurn({ text: prose }, {
    canRun: false,
    chatMessageCount: 4,
    hasChatContext: true,
    isLatest: true,
    preferNaturalResponse: true,
    question: 'Who is the accountable business owner for this case?',
    responseText: prose,
    source: 'compass_gateway'
  });

  assert.match(html, /I understand this as a managed integration partner review\./);
  assert.match(html, /Who is the accountable business owner/);
  assert.match(html, /Short answer is fine/);
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

test('renderAssistantTurn shows structured smart-intake diagnostics without hiding prose', () => {
  const chatUi = loadChatUiModule();
  const prose = 'I captured the managed integration partner context and will continue with deterministic intake while Compass structured parsing is reviewed. Who is the accountable owner for this review?';

  const html = chatUi.renderAssistantTurn({ text: prose }, {
    canRun: false,
    chatMessageCount: 3,
    hasChatContext: true,
    isLatest: true,
    responseText: prose,
    smartIntakeDegraded: true,
    smartIntakeDiagnostic: true,
    degradedMessage: 'Compass returned a malformed structured response; deterministic intake handled this turn.'
  });

  assert.match(html, /Smart intake diagnostic/);
  assert.match(html, /malformed structured response/);
  assert.match(html, /managed integration partner context/);
});

test('renderThinkingLoader does not invent retry progress before backend metadata returns', () => {
  const chatUi = loadChatUiModule();
  const html = chatUi.renderThinkingLoader({
    text: 'Reading the request, updating the case draft, and planning the next agent step...',
    retried: true,
    attemptCount: 2,
    pending: true
  });

  assert.match(html, /Waiting for the intake response from the API/);
  assert.doesNotMatch(html, /Retrying smart intake/);
  assert.doesNotMatch(html, /compact recovery prompt/);
});
