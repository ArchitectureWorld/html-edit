export type EditorPoint = {
  x: number;
  y: number;
};

export type FrameClientRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FrameViewportSize = {
  width: number;
  height: number;
};

export type MappedFramePoint = EditorPoint & {
  inside: boolean;
};

export function mapEditorPointToFrame(
  point: EditorPoint,
  frameRect: FrameClientRect,
  frameViewport: FrameViewportSize,
): MappedFramePoint {
  if (frameRect.width <= 0 || frameRect.height <= 0) {
    throw new RangeError('Frame rectangle must have a positive width and height.');
  }
  if (frameViewport.width <= 0 || frameViewport.height <= 0) {
    throw new RangeError('Frame viewport must have a positive width and height.');
  }

  const x = (point.x - frameRect.left) * (frameViewport.width / frameRect.width);
  const y = (point.y - frameRect.top) * (frameViewport.height / frameRect.height);

  return {
    x,
    y,
    inside: x >= 0
      && y >= 0
      && x <= frameViewport.width
      && y <= frameViewport.height,
  };
}
