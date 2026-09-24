export function readStorage(key, fallback, legacyKeys = []) {
  try {
    for (const storageKey of [key, ...legacyKeys]) {
      const raw = window.localStorage.getItem(storageKey)
      if (raw == null) continue
      return JSON.parse(raw)
    }
  } catch {
    return fallback
  }

  return fallback
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local persistence is optional.
  }
}
