interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

class LazyCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>();

  /**
   * Sets value in cache
   * 
   * @param key cache value identificator
   * @param value value to save
   * @param ttlMs time to live in milliseconds
   */
  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : null;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Returns value from cache
   * 
   * @param key cache value identificator to get
   * @returns if value expired or wasn't even set 
   *  returns undefined otherwise value from cache under the key 
   */
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

   /**
   * Sets value to cache with time to live
   * 
   * @param value value to save
   * @param ttlMs time to live aka expiration time in milliseconds
   * @returns if value expired or wasn't even set 
   *  returns undefined otherwise value from cache under the key 
   */
  set(value: T, ttlMs?: number): void {
    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : null;
    this.entry = { value, expiresAt };
  }

   /**
   * Returns value from cache
   * 
   * @returns if value expired or wasn't even set 
   *  returns undefined otherwise value from cache
   */
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