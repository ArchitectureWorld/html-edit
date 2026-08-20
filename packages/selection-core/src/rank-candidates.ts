import type {
  RankedSelectionCandidate,
  SelectionCandidate,
  SelectionCandidateKind,
  SelectionHitResult,
} from './types.js';

export type RankSelectionOptions = {
  includeLocked?: boolean;
  includeHidden?: boolean;
  minimumOpacity?: number;
};

const KIND_PRIORITY: Record<SelectionCandidateKind, number> = {
  'text-owner': 700,
  'replaced-element': 600,
  'svg-graphic': 550,
  'painted-box': 500,
  'component-root': 400,
  'layout-container': 300,
  'document-root': 0,
};

function isExcluded(
  candidate: SelectionCandidate,
  options: Required<RankSelectionOptions>,
): boolean {
  if (candidate.editorOwned) return true;
  if (candidate.inactiveScene && !options.includeHidden) return true;
  if (candidate.locked && !options.includeLocked) return true;
  if (!candidate.visible && !options.includeHidden) return true;
  if (!candidate.hasLayoutBox) return true;
  if (candidate.effectiveOpacity <= options.minimumOpacity && !options.includeHidden) {
    return true;
  }
  return false;
}

function dispositionOf(candidate: SelectionCandidate): 'primary' | 'cycle-only' {
  if (candidate.transparentWrapper || candidate.kind === 'document-root') {
    return 'cycle-only';
  }
  return 'primary';
}

function compareWithinDisposition(
  left: RankedSelectionCandidate,
  right: RankedSelectionCandidate,
): number {
  const paintDifference = left.paintOrder - right.paintOrder;
  if (paintDifference !== 0) return paintDifference;

  const kindDifference = KIND_PRIORITY[right.kind] - KIND_PRIORITY[left.kind];
  if (kindDifference !== 0) return kindDifference;

  const depthDifference = right.domDepth - left.domDepth;
  if (depthDifference !== 0) return depthDifference;

  return left.nodeKey.localeCompare(right.nodeKey);
}

export function rankSelectionCandidates(
  candidates: readonly SelectionCandidate[],
  options: RankSelectionOptions = {},
): SelectionHitResult {
  const resolvedOptions: Required<RankSelectionOptions> = {
    includeLocked: options.includeLocked ?? false,
    includeHidden: options.includeHidden ?? false,
    minimumOpacity: options.minimumOpacity ?? 0.01,
  };

  const seen = new Set<string>();
  const primary: RankedSelectionCandidate[] = [];
  const cycleOnly: RankedSelectionCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.nodeKey)) continue;
    seen.add(candidate.nodeKey);
    if (isExcluded(candidate, resolvedOptions)) continue;

    const ranked: RankedSelectionCandidate = {
      ...candidate,
      selectionDisposition: dispositionOf(candidate),
    };

    if (ranked.selectionDisposition === 'primary') primary.push(ranked);
    else cycleOnly.push(ranked);
  }

  primary.sort(compareWithinDisposition);
  cycleOnly.sort(compareWithinDisposition);

  const ranked = [...primary, ...cycleOnly];
  return {
    candidates: ranked,
    selectedIndex: ranked.length > 0 ? 0 : -1,
    selected: ranked[0] ?? null,
  };
}
