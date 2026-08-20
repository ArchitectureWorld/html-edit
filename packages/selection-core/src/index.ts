export { getCdpNodeForLocation } from './cdp-deep-hit-test.js';
export { mapEditorPointToFrame } from './coordinate-mapper.js';
export { hitTestDocument } from './browser-hit-test.js';
export { cycleSelectionIndex } from './cycle-selection.js';
export { rankSelectionCandidates } from './rank-candidates.js';
export type {
  RankedSelectionCandidate,
  SelectionCandidate,
  SelectionCandidateKind,
  SelectionDisposition,
  SelectionHitResult,
  SelectionRect,
} from './types.js';

export type { HitTestDocumentOptions, HitTestPoint } from './browser-hit-test.js';

export type { CdpCommandSession, CdpNodeLocation } from './cdp-deep-hit-test.js';
export type { EditorPoint, FrameClientRect, FrameViewportSize, MappedFramePoint } from './coordinate-mapper.js';
