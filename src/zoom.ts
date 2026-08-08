export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 1.25
export const ZOOM_STEP = 0.1
export const ZOOM_DEFAULT = 1
export const ZOOM_STORAGE_KEY = 'heritage-tree-zoom'

export function clampZoom(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, rounded))
}

export function loadZoom(): number {
  try {
    const raw = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (!raw) return ZOOM_DEFAULT
    const n = Number(raw)
    return Number.isFinite(n) ? clampZoom(n) : ZOOM_DEFAULT
  } catch {
    return ZOOM_DEFAULT
  }
}

export function saveZoom(value: number) {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(clampZoom(value)))
  } catch {
    /* ignore */
  }
}

export function formatZoom(value: number): string {
  return `${Math.round(value * 100)} %`
}
