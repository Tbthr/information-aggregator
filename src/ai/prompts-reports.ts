// ============================================================
// Quadrant Classification
// ============================================================

export function parseQuadrantResult(raw: string): { quadrant: '尝试' | '深度' | '地图感'; reason: string } | null {
  try {
    const parsed = JSON.parse(raw)
    if (['尝试', '深度', '地图感'].includes(parsed.quadrant)) {
      return parsed
    }
  } catch { /* ignore */ }
  return null
}
