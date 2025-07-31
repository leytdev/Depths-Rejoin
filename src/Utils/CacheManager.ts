/**
 * Generic cache manager for improved performance
 * Stores data in memory with configurable TTL and max size
 */
export class CacheManager<K, V> {
  private cache: Map<K, { value: V, expires: number }>;
  private maxSize: number;
  private defaultTTL: number;

  /**
   * Create a new cache manager
   * @param options Cache configuration options
   */
  constructor(options?: { maxSize?: number, defaultTTL?: number }) {
    this.cache = new Map();
    this.maxSize = options?.maxSize || 1000; // Default max size
    this.defaultTTL = options?.defaultTTL || 5 * 60 * 1000; // Default 5 minutes TTL
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional TTL in ms, defaults to the constructor's defaultTTL
   */
  set(key: K, value: V, ttl?: number): void {
    // Clear space if cache is full
    if (this.cache.size >= this.maxSize) {
      this.prune();
    }

    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expires });
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);

    // If item doesn't exist or is expired
    if (!item || Date.now() > item.expires) {
      if (item) this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  /**
   * Check if a key exists in the cache and is not expired
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      if (item) this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Remove a key from the cache
   * @param key Cache key
   */
  delete(key: K): void {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired items from the cache
   */
  prune(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get or set a value in the cache using a factory function
   * @param key Cache key
   * @param factory Function to generate value if not in cache
   * @param ttl Optional TTL in ms
   * @returns The cached or newly generated value
   */
  async getOrSet(key: K, factory: () => Promise<V>, ttl?: number): Promise<V> {
    const cachedValue = this.get(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Get the number of items in the cache
   */
  get size(): number {
    return this.cache.size;
  }
}

// Export singleton instances for common cache types
export const userCache = new CacheManager<string, any>({ maxSize: 500, defaultTTL: 10 * 60 * 1000 }); // User data - 10 min TTL
export const guildCache = new CacheManager<string, any>({ maxSize: 100, defaultTTL: 30 * 60 * 1000 }); // Guild data - 30 min TTL
export const levelCache = new CacheManager<string, any>({ maxSize: 1000, defaultTTL: 5 * 60 * 1000 }); // Level data - 5 min TTL
export const economyCache = new CacheManager<string, any>({ maxSize: 1000, defaultTTL: 2 * 60 * 1000 }); // Economy data - 2 min TTL
