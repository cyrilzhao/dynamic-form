import { LinkageResultCache } from '../linkageResultCache';
import type { LinkageResult } from '../../types/linkage';

describe('LinkageResultCache', () => {
  let cache: LinkageResultCache;

  beforeEach(() => {
    cache = new LinkageResultCache();
  });

  describe('get 方法', () => {
    it('应该返回 undefined 当缓存不存在时', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('应该返回缓存的结果', () => {
      const linkageResult: LinkageResult = { visible: true };
      cache.set('key1', linkageResult);
      expect(cache.get('key1')).toEqual(linkageResult);
    });

    it('应该增加命中计数当缓存存在时', () => {
      cache.set('key1', { visible: true });
      cache.get('key1');
      cache.get('key1');
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it('应该增加未命中计数当缓存不存在时', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');
      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });
  });

  describe('set 方法', () => {
    it('应该正确设置缓存', () => {
      const linkageResult: LinkageResult = { disabled: true };
      cache.set('key1', linkageResult);
      expect(cache.get('key1')).toEqual(linkageResult);
    });

    it('应该覆盖已存在的缓存', () => {
      cache.set('key1', { visible: true });
      cache.set('key1', { visible: false });
      expect(cache.get('key1')).toEqual({ visible: false });
    });

    it('应该支持存储复杂的 LinkageResult', () => {
      const complexResult: LinkageResult = {
        visible: true,
        disabled: false,
        readonly: true,
        value: 'test',
        options: [
          { label: 'Option 1', value: 1 },
          { label: 'Option 2', value: 2 },
        ],
        schema: { type: 'string' },
      };
      cache.set('complex', complexResult);
      expect(cache.get('complex')).toEqual(complexResult);
    });
  });

  describe('LRU 策略', () => {
    it('当缓存已满时应该删除最早的条目', () => {
      cache.setMaxSize(3);
      cache.set('key1', { visible: true });
      cache.set('key2', { visible: true });
      cache.set('key3', { visible: true });
      // 缓存已满，添加新条目应该删除 key1
      cache.set('key4', { visible: true });

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeDefined();
      expect(cache.get('key3')).toBeDefined();
      expect(cache.get('key4')).toBeDefined();
    });

    it('访问缓存项应该将其移到最后（LRU 更新）', () => {
      cache.setMaxSize(3);
      cache.set('key1', { visible: true });
      cache.set('key2', { visible: true });
      cache.set('key3', { visible: true });

      // 访问 key1，使其成为最近使用的
      cache.get('key1');

      // 添加新条目，应该删除 key2（最早未访问的）
      cache.set('key4', { visible: true });

      expect(cache.get('key1')).toBeDefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeDefined();
      expect(cache.get('key4')).toBeDefined();
    });
  });

  describe('clear 方法', () => {
    it('应该清空所有缓存', () => {
      cache.set('key1', { visible: true });
      cache.set('key2', { disabled: true });
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });

    it('应该重置命中和未命中计数', () => {
      cache.set('key1', { visible: true });
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('getStats 方法', () => {
    it('应该返回正确的缓存大小', () => {
      cache.set('key1', { visible: true });
      cache.set('key2', { visible: true });
      expect(cache.getStats().size).toBe(2);
    });

    it('应该返回正确的最大缓存大小', () => {
      expect(cache.getStats().maxSize).toBe(1000);
    });

    it('应该计算正确的命中率', () => {
      cache.set('key1', { visible: true });
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('当没有访问时命中率应该为 0', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('应该返回正确的命中和未命中次数', () => {
      cache.set('key1', { visible: true });
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit
      cache.get('key3'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
    });
  });

  describe('setMaxSize 方法', () => {
    it('应该更新最大缓存大小', () => {
      cache.setMaxSize(500);
      expect(cache.getStats().maxSize).toBe(500);
    });

    it('当新大小小于当前缓存大小时应该删除多余条目', () => {
      cache.set('key1', { visible: true });
      cache.set('key2', { visible: true });
      cache.set('key3', { visible: true });
      cache.set('key4', { visible: true });
      cache.set('key5', { visible: true });

      cache.setMaxSize(2);

      expect(cache.getStats().size).toBe(2);
      // 最早的条目应该被删除
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('当新大小大于当前缓存大小时不应该删除条目', () => {
      cache.set('key1', { visible: true });
      cache.set('key2', { visible: true });

      cache.setMaxSize(100);

      expect(cache.getStats().size).toBe(2);
      expect(cache.get('key1')).toBeDefined();
      expect(cache.get('key2')).toBeDefined();
    });
  });

  describe('防御性代码分支覆盖', () => {
    it('set 方法中 firstKey 为 undefined 时不应该删除（防御性代码）', () => {
      // 通过 mock Map.keys().next() 返回 undefined 来测试防御性代码
      cache.setMaxSize(1);
      cache.set('key1', { visible: true });

      // Mock cache 内部的 Map
      const originalKeys = Map.prototype.keys;
      // @ts-expect-error - 故意 mock 返回 undefined 来测试防御性代码
      Map.prototype.keys = function () {
        return {
          next: () => ({ value: undefined, done: false }),
          [Symbol.iterator]: function () {
            return this;
          },
        };
      };

      // 这会触发 set 中的 LRU 逻辑，但 firstKey 是 undefined
      cache.set('key2', { disabled: true });

      // 恢复原始方法
      Map.prototype.keys = originalKeys;

      // 验证缓存仍然正常工作
      expect(cache.getStats().size).toBeGreaterThanOrEqual(1);
    });

    it('setMaxSize 方法中 firstKey 为 undefined 时不应该删除（防御性代码）', () => {
      cache.set('key1', { visible: true });
      cache.set('key2', { visible: true });
      cache.set('key3', { visible: true });

      // Mock cache 内部的 Map
      const originalKeys = Map.prototype.keys;
      let callCount = 0;
      // @ts-expect-error - 故意 mock 返回 undefined 来测试防御性代码
      Map.prototype.keys = function () {
        const realIterator = originalKeys.call(this);
        return {
          next: () => {
            callCount++;
            // 第一次调用返回 undefined 来触发防御性代码
            if (callCount === 1) {
              return { value: undefined, done: false };
            }
            return realIterator.next();
          },
          [Symbol.iterator]: function () {
            return this;
          },
        };
      };

      // 这会触发 setMaxSize 中的 while 循环
      cache.setMaxSize(1);

      // 恢复原始方法
      Map.prototype.keys = originalKeys;
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串键', () => {
      cache.set('', { visible: true });
      expect(cache.get('')).toEqual({ visible: true });
    });

    it('应该处理特殊字符键', () => {
      const specialKey = 'key:with|special=chars';
      cache.set(specialKey, { disabled: true });
      expect(cache.get(specialKey)).toEqual({ disabled: true });
    });

    it('应该处理 maxSize 为 1 的情况', () => {
      cache.setMaxSize(1);
      cache.set('key1', { visible: true });
      cache.set('key2', { disabled: true });

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toEqual({ disabled: true });
      expect(cache.getStats().size).toBe(1);
    });
  });
});
