import type { HitTestPoint } from './browser-hit-test.js';

export type CdpCommandSession = {
  sendCommand(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
};

export type CdpNodeLocation = {
  backendNodeId: number;
  frameId?: string;
  nodeId?: number;
};

export async function getCdpNodeForLocation(
  session: CdpCommandSession,
  point: HitTestPoint,
): Promise<CdpNodeLocation | null> {
  const result = await session.sendCommand('DOM.getNodeForLocation', {
    x: Math.round(point.x),
    y: Math.round(point.y),
    includeUserAgentShadowDOM: true,
    ignorePointerEventsNone: true,
  });

  const backendNodeId = result.backendNodeId;
  if (typeof backendNodeId !== 'number') return null;

  const location: CdpNodeLocation = { backendNodeId };
  if (typeof result.frameId === 'string') location.frameId = result.frameId;
  if (typeof result.nodeId === 'number') location.nodeId = result.nodeId;
  return location;
}
