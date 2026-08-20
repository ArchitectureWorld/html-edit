import { rankSelectionCandidates } from './rank-candidates.js';
import type {
  SelectionCandidate,
  SelectionCandidateKind,
  SelectionHitResult,
  SelectionRect,
} from './types.js';

export type HitTestPoint = {
  x: number;
  y: number;
};

export type HitTestDocumentOptions = {
  deep?: boolean;
  frameId?: string;
  includeLocked?: boolean;
  includeHidden?: boolean;
};

const REPLACED_OR_CONTROL_TAGS = new Set([
  'IMG',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'IFRAME',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'BUTTON',
  'OBJECT',
  'EMBED',
]);

function pointInsideRect(point: HitTestPoint, rect: DOMRectReadOnly): boolean {
  return rect.width > 0
    && rect.height > 0
    && point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom;
}

function rectOf(element: Element): SelectionRect {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function hasLayoutBox(element: Element): boolean {
  return Array.from(element.getClientRects()).some(
    (rect) => rect.width > 0 && rect.height > 0,
  );
}

function domDepth(element: Element): number {
  let depth = 0;
  let current: Element | null = element;
  while (current.parentElement) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}

function directTextHit(element: Element, point: HitTestPoint): boolean {
  let ownsText = false;
  for (const child of element.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
    ownsText = true;
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(child);
    const hit = Array.from(range.getClientRects()).some((rect) => pointInsideRect(point, rect));
    range.detach();
    if (hit) return true;
  }

  return ownsText && Array.from(element.getClientRects()).some(
    (rect) => pointInsideRect(point, rect),
  );
}

function alphaFromColor(color: string): number {
  const normalized = color.trim().toLowerCase();
  if (normalized === 'transparent') return 0;
  const match = normalized.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return 1;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (normalized.startsWith('rgba') && parts.length >= 4) {
    const alpha = Number(parts[3]);
    return Number.isFinite(alpha) ? alpha : 1;
  }
  return 1;
}

function hasVisibleBorder(style: CSSStyleDeclaration): boolean {
  const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
  return sides.some((side) => {
    const width = Number.parseFloat(style[`border${side}Width`]);
    const borderStyle = style[`border${side}Style`];
    const color = style[`border${side}Color`];
    return width > 0 && borderStyle !== 'none' && alphaFromColor(color) > 0;
  });
}

function hasOwnPaint(
  element: Element,
  style: CSSStyleDeclaration,
  textHit: boolean,
): boolean {
  if (textHit) return true;
  if (REPLACED_OR_CONTROL_TAGS.has(element.tagName)) return true;
  if (element instanceof SVGGraphicsElement) return true;
  if (alphaFromColor(style.backgroundColor) > 0) return true;
  if (style.backgroundImage !== 'none') return true;
  if (hasVisibleBorder(style)) return true;
  if (style.boxShadow !== 'none' || style.textShadow !== 'none') return true;
  if (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) return true;
  return false;
}

function effectiveOpacity(element: Element): number {
  let opacity = 1;
  let current: Element | null = element;
  while (current) {
    const value = Number.parseFloat(current.ownerDocument.defaultView?.getComputedStyle(current).opacity ?? '1');
    opacity *= Number.isFinite(value) ? value : 1;
    current = current.parentElement;
  }
  return opacity;
}

function classifyKind(
  element: Element,
  textHit: boolean,
  painted: boolean,
): SelectionCandidateKind {
  if (element.tagName === 'HTML' || element.tagName === 'BODY') return 'document-root';
  if (textHit) return 'text-owner';
  if (REPLACED_OR_CONTROL_TAGS.has(element.tagName)) return 'replaced-element';
  if (element instanceof SVGGraphicsElement && element.tagName.toLowerCase() !== 'svg') {
    return 'svg-graphic';
  }
  if (painted) return 'painted-box';
  if (element.tagName.includes('-') || element.hasAttribute('data-he-component')) {
    return 'component-root';
  }
  return 'layout-container';
}

function nodeKeyOf(element: Element): string {
  const targetId = element.getAttribute('data-he-id');
  if (targetId) return `target:${targetId}`;
  if (element.id) return `id:${element.id}`;

  const segments: string[] = [];
  let current: Element | null = element;
  while (current) {
    const tag = current.tagName.toLowerCase();
    if (!current.parentElement) {
      segments.push(tag);
      break;
    }
    const sameTagSiblings = Array.from(current.parentElement.children)
      .filter((sibling) => sibling.tagName === current?.tagName);
    const index = sameTagSiblings.indexOf(current) + 1;
    segments.push(`${tag}:nth-of-type(${index})`);
    current = current.parentElement;
  }
  return `path:${segments.reverse().join('>')}`;
}

function closestPaintOrder(
  element: Element,
  directOrders: ReadonlyMap<Element, number>,
  fallback: number,
): number {
  let current: Element | null = element;
  while (current) {
    const order = directOrders.get(current);
    if (order !== undefined) return order;
    current = current.parentElement;
  }
  return fallback;
}

function candidateFromElement(
  element: Element,
  point: HitTestPoint,
  paintOrder: number,
  frameId: string,
): SelectionCandidate {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('Document does not have a defaultView.');
  const style = view.getComputedStyle(element);
  const textHit = directTextHit(element, point);
  const painted = hasOwnPaint(element, style, textHit);
  const kind = classifyKind(element, textHit, painted);
  const opacity = effectiveOpacity(element);
  const displayVisible = style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.visibility !== 'collapse'
    && style.contentVisibility !== 'hidden';

  const reasons = [
    textHit ? 'text-hit' : null,
    REPLACED_OR_CONTROL_TAGS.has(element.tagName) ? 'replaced-element' : null,
    element instanceof SVGGraphicsElement ? 'svg-element' : null,
    painted ? 'painted-box' : 'unpainted-box',
    style.pointerEvents === 'none' ? 'pointer-events-none' : null,
  ].filter((reason): reason is string => reason !== null);

  return {
    nodeKey: nodeKeyOf(element),
    targetId: element.getAttribute('data-he-id') ?? undefined,
    frameId,
    tagName: element.tagName,
    rect: rectOf(element),
    paintOrder,
    domDepth: domDepth(element),
    kind,
    visible: displayVisible,
    locked: element.closest('[data-he-locked="true"]') !== null,
    editorOwned: element.closest('[data-he-editor-ui]') !== null,
    transparentWrapper: kind === 'layout-container' && !painted,
    inactiveScene: element.closest('[data-he-scene-inactive="true"]') !== null,
    effectiveOpacity: opacity,
    hasLayoutBox: hasLayoutBox(element),
    pointerEventsNone: style.pointerEvents === 'none',
    reason: reasons,
  };
}

function elementsContainingPoint(document: Document, point: HitTestPoint): Element[] {
  return Array.from(document.querySelectorAll('*')).filter((element) =>
    Array.from(element.getClientRects()).some((rect) => pointInsideRect(point, rect)),
  );
}

export function hitTestDocument(
  document: Document,
  point: HitTestPoint,
  options: HitTestDocumentOptions = {},
): SelectionHitResult {
  const direct = document.elementsFromPoint(point.x, point.y);
  const directOrders = new Map<Element, number>(
    direct.map((element, index) => [element, index]),
  );
  const elements = options.deep
    ? [...direct, ...elementsContainingPoint(document, point)]
    : direct;

  const candidates = elements.map((element, index) => candidateFromElement(
    element,
    point,
    closestPaintOrder(element, directOrders, direct.length + index),
    options.frameId ?? 'main',
  ));

  return rankSelectionCandidates(candidates, {
    includeHidden: options.includeHidden,
    includeLocked: options.includeLocked,
  });
}
