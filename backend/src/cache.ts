// ─── Simple in-memory cache with TTL ─────────────────────────────────────────

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>()
  private ttlMs: number

  constructor(ttlMinutes: number) {
    this.ttlMs = ttlMinutes * 60 * 1000
  }

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    // Prune old entries if cache grows large
    if (this.store.size > 500) this.prune()
  }

  private prune(): void {
    const now = Date.now()
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }

  stats() {
    return { size: this.store.size, ttlMinutes: this.ttlMs / 60000 }
  }
}
