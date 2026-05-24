import type { LinkageResult } from '../types/linkage';

/**
 * 联动结果缓存管理器
 * 使用 LRU 策略管理缓存大小
 */
export class LinkageResultCache {
  private cache = new Map<string, LinkageResult>();
  private maxSize = 1000; // 最大缓存条目数
  private hits = 0; // 缓存命中次数
  private misses = 0; // 缓存未命中次数

  /**
   * 获取缓存结果
   */
  get(key: string): LinkageResult | undefined {
    const result = this.cache.get(key);
    if (result) {
      this.hits++;
      // LRU: 将访问的项移到最后
      this.cache.delete(key);
      this.cache.set(key, result);
    } else {
      this.misses++;
    }
    return result;
  }

  /**
   * 设置缓存结果
   */
  set(key: string, result: LinkageResult): void {
    // LRU 策略：如果缓存已满，删除最早的条目
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, result);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; maxSize: number; hitRate: number; hits: number; misses: number } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * 设置最大缓存大小
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    // 如果当前缓存大小超过新的最大值，删除最早的条目
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }
}
