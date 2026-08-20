import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cycleSelectionIndex,
  getCdpNodeForLocation,
  mapEditorPointToFrame,
  rankSelectionCandidates,
} from '../dist/index.js';

function candidate(overrides = {}) {
  return {
    nodeKey: overrides.nodeKey ?? `node-${Math.random()}`,
    frameId: 'main',
    tagName: 'DIV',
    rect: { x: 0, y: 0, width: 100, height: 40 },
    paintOrder: 0,
    domDepth: 1,
    kind: 'layout-container',
    visible: true,
    locked: false,
    editorOwned: false,
    transparentWrapper: false,
    inactiveScene: false,
    effectiveOpacity: 1,
    hasLayoutBox: true,
    pointerEventsNone: false,
    reason: [],
    ...overrides,
  };
}

test('selects a text leaf before its parent container', () => {
  const result = rankSelectionCandidates([
    candidate({ nodeKey: 'text', tagName: 'SPAN', kind: 'text-owner', paintOrder: 0, domDepth: 4 }),
    candidate({ nodeKey: 'card', kind: 'painted-box', paintOrder: 1, domDepth: 2 }),
  ]);

  assert.equal(result.selected?.nodeKey, 'text');
  assert.deepEqual(result.candidates.map((item) => item.nodeKey), ['text', 'card']);
});

test('skips a transparent wrapper for the default choice but keeps it available for cycling', () => {
  const result = rankSelectionCandidates([
    candidate({ nodeKey: 'overlay', paintOrder: 0, transparentWrapper: true }),
    candidate({ nodeKey: 'image', tagName: 'IMG', kind: 'replaced-element', paintOrder: 1 }),
  ]);

  assert.equal(result.selected?.nodeKey, 'image');
  assert.deepEqual(result.candidates.map((item) => item.nodeKey), ['image', 'overlay']);
  assert.equal(result.candidates[1].selectionDisposition, 'cycle-only');
});

test('does not let a semantic object behind a visible painted front object jump the paint stack', () => {
  const result = rankSelectionCandidates([
    candidate({ nodeKey: 'front', kind: 'painted-box', paintOrder: 0, domDepth: 2 }),
    candidate({ nodeKey: 'behind-text', kind: 'text-owner', paintOrder: 1, domDepth: 8 }),
  ]);

  assert.equal(result.selected?.nodeKey, 'front');
});

test('excludes editor UI, inactive scenes, invisible elements and locked elements by default', () => {
  const result = rankSelectionCandidates([
    candidate({ nodeKey: 'editor', kind: 'painted-box', editorOwned: true }),
    candidate({ nodeKey: 'inactive', kind: 'painted-box', paintOrder: 1, inactiveScene: true }),
    candidate({ nodeKey: 'hidden', kind: 'painted-box', paintOrder: 2, visible: false }),
    candidate({ nodeKey: 'locked', kind: 'painted-box', paintOrder: 3, locked: true }),
    candidate({ nodeKey: 'target', kind: 'painted-box', paintOrder: 4 }),
  ]);

  assert.equal(result.selected?.nodeKey, 'target');
  assert.deepEqual(result.candidates.map((item) => item.nodeKey), ['target']);
});

test('keeps pointer-events none candidates selectable', () => {
  const result = rankSelectionCandidates([
    candidate({
      nodeKey: 'pointer-none-text',
      kind: 'text-owner',
      pointerEventsNone: true,
    }),
  ]);

  assert.equal(result.selected?.nodeKey, 'pointer-none-text');
});

test('uses document roots only as a fallback', () => {
  const withTarget = rankSelectionCandidates([
    candidate({ nodeKey: 'body', kind: 'document-root', tagName: 'BODY', paintOrder: 0 }),
    candidate({ nodeKey: 'target', kind: 'painted-box', paintOrder: 1 }),
  ]);
  const rootOnly = rankSelectionCandidates([
    candidate({ nodeKey: 'body', kind: 'document-root', tagName: 'BODY', paintOrder: 0 }),
  ]);

  assert.equal(withTarget.selected?.nodeKey, 'target');
  assert.equal(rootOnly.selected?.nodeKey, 'body');
});

test('cycles deterministically and wraps in both directions', () => {
  assert.equal(cycleSelectionIndex(3, 0, 1), 1);
  assert.equal(cycleSelectionIndex(3, 2, 1), 0);
  assert.equal(cycleSelectionIndex(3, 0, -1), 2);
  assert.equal(cycleSelectionIndex(0, 0, 1), -1);
});


test('maps editor coordinates into the unscaled iframe viewport', () => {
  const result = mapEditorPointToFrame(
    { x: 300, y: 200 },
    { left: 100, top: 50, width: 400, height: 200 },
    { width: 800, height: 400 },
  );

  assert.deepEqual(result, { x: 400, y: 300, inside: true });
});

test('reports points outside the iframe while preserving mapped coordinates', () => {
  const result = mapEditorPointToFrame(
    { x: 90, y: 40 },
    { left: 100, top: 50, width: 400, height: 200 },
    { width: 800, height: 400 },
  );

  assert.deepEqual(result, { x: -20, y: -20, inside: false });
});

test('requests a deep CDP hit that ignores pointer-events none', async () => {
  const calls = [];
  const session = {
    async sendCommand(method, params) {
      calls.push({ method, params });
      return { backendNodeId: 42, frameId: 'frame-main' };
    },
  };

  const result = await getCdpNodeForLocation(session, { x: 10.4, y: 20.6 });

  assert.deepEqual(calls, [{
    method: 'DOM.getNodeForLocation',
    params: {
      x: 10,
      y: 21,
      includeUserAgentShadowDOM: true,
      ignorePointerEventsNone: true,
    },
  }]);
  assert.deepEqual(result, { backendNodeId: 42, frameId: 'frame-main' });
});
