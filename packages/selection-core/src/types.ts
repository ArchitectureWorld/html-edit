export type SelectionCandidateKind =
  | 'text-owner'
  | 'replaced-element'
  | 'svg-graphic'
  | 'painted-box'
  | 'component-root'
  | 'layout-container'
  | 'document-root';

export type SelectionDisposition = 'primary' | 'cycle-only';

export type SelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectionCandidate = {
  nodeKey: string;
  targetId?: string;
  frameId: string;
  tagName: string;
  rect: SelectionRect;
  paintOrder: number;
  domDepth: number;
  kind: SelectionCandidateKind;
  visible: boolean;
  locked: boolean;
  editorOwned: boolean;
  transparentWrapper: boolean;
  inactiveScene: boolean;
  effectiveOpacity: number;
  hasLayoutBox: boolean;
  pointerEventsNone: boolean;
  reason: string[];
};

export type RankedSelectionCandidate = SelectionCandidate & {
  selectionDisposition: SelectionDisposition;
};

export type SelectionHitResult = {
  candidates: RankedSelectionCandidate[];
  selectedIndex: number;
  selected: RankedSelectionCandidate | null;
};
