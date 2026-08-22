interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

class LazyCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : null;
    this.store.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }
}

class LazySingleCache<T = unknown> {
  private entry: CacheEntry<T> | null = null;

  set(value: T, ttlMs?: number): void {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : null;
    this.entry = { value, expiresAt };
  }

  get(): T | undefined {
    if (!this.entry) {
      return undefined;
    }

    if (this.entry.expiresAt !== null && this.entry.expiresAt <= Date.now()) {
      this.entry = null;
      return undefined;
    }

    return this.entry.value;
  }
}

export { LazyCache, LazySingleCache };