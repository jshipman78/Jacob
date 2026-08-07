/**
 * Small deterministic string hash (djb2 variant) used to derive a stable,
 * per-image "random" pan angle for the Ken Burns effect — same imageId
 * always produces the same motion, but different images look varied.
 */
export function hashStringToUnitFloat(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Force unsigned, then normalize to [0, 1).
  return (hash >>> 0) / 4294967295;
}
