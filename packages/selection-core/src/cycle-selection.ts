export function cycleSelectionIndex(
  candidateCount: number,
  currentIndex: number,
  direction: 1 | -1 = 1,
): number {
  if (candidateCount <= 0) return -1;
  const normalizedCurrent = currentIndex >= 0 && currentIndex < candidateCount
    ? currentIndex
    : 0;
  return (normalizedCurrent + direction + candidateCount) % candidateCount;
}
