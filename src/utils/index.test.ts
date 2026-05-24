/**
 * @jest-environment jsdom
 */
import {
  formatDate,
  debounce,
  throttle,
  deepClone,
  randomString,
  setStorage,
  getStorage,
  removeStorage,
} from './index';

describe('formatDate', () => {
  it('应该使用默认格式格式化日期', () => {
    const date = new Date('2024-01-15T08:30:45');
    const result = formatDate(date);
    expect(result).toBe('2024-01-15 08:30:45');
  });

  it('应该使用自定义格式格式化日期', () => {
    const date = new Date('2024-01-15T08:30:45');
    const result = formatDate(date, 'YYYY/MM/DD');
    expect(result).toBe('2024/01/15');
  });

  it('应该格式化字符串日期', () => {
    const result = formatDate('2024-01-15T08:30:45', 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });

  it('应该正确填充单数字的月份和日期', () => {
    const date = new Date('2024-01-05T03:05:09');
    const result = formatDate(date);
    expect(result).toBe('2024-01-05 03:05:09');
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  it('应该延迟函数执行', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('应该在延迟时间内多次调用时只执行一次', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('应该传递正确的参数', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn('arg1', 'arg2');
    jest.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('应该在新调用时重置计时器', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 300);

    debouncedFn();
    jest.advanceTimersByTime(200);
    debouncedFn();
    jest.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  jest.useFakeTimers();

  it('应该立即执行第一次调用', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 300);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('应该在延迟时间内忽略后续调用', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 300);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('应该在延迟时间后允许再次执行', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 300);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(300);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('应该传递正确的参数', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 300);

    throttledFn('arg1', 'arg2');
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('deepClone', () => {
  it('应该克隆基本类型', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('string')).toBe('string');
    expect(deepClone(true)).toBe(true);
  });

  it('应该克隆日期对象', () => {
    const date = new Date('2024-01-15');
    const cloned = deepClone(date);

    expect(cloned).toEqual(date);
    expect(cloned).not.toBe(date);
    expect(cloned instanceof Date).toBe(true);
  });

  it('应该克隆数组', () => {
    const arr = [1, 2, { a: 3 }];
    const cloned = deepClone(arr);

    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  it('应该克隆嵌套对象', () => {
    const obj = {
      a: 1,
      b: {
        c: 2,
        d: {
          e: 3,
        },
      },
    };
    const cloned = deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
    expect(cloned.b).not.toBe(obj.b);
    expect(cloned.b.d).not.toBe(obj.b.d);
  });

  it('应该克隆包含数组的对象', () => {
    const obj = {
      arr: [1, 2, 3],
      nested: {
        arr: [4, 5, 6],
      },
    };
    const cloned = deepClone(obj);

    expect(cloned).toEqual(obj);
    expect(cloned.arr).not.toBe(obj.arr);
    expect(cloned.nested.arr).not.toBe(obj.nested.arr);
  });

  it('克隆后修改不应影响原对象', () => {
    const obj = { a: 1, b: { c: 2 } };
    const cloned = deepClone(obj);

    cloned.a = 999;
    cloned.b.c = 888;

    expect(obj.a).toBe(1);
    expect(obj.b.c).toBe(2);
  });
});

describe('randomString', () => {
  it('应该生成默认长度为 8 的字符串', () => {
    const result = randomString();
    expect(result).toHaveLength(8);
  });

  it('应该生成指定长度的字符串', () => {
    expect(randomString(5)).toHaveLength(5);
    expect(randomString(16)).toHaveLength(16);
    expect(randomString(32)).toHaveLength(32);
  });

  it('应该只包含字母和数字', () => {
    const result = randomString(100);
    expect(result).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('应该生成不同的字符串', () => {
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(randomString(16));
    }
    // 100 次生成应该有至少 95 个不同的字符串（允许极小概率的重复）
    expect(results.size).toBeGreaterThan(95);
  });
});

describe('localStorage 工具函数', () => {
  beforeEach(() => {
    // 清空 localStorage
    localStorage.clear();
    // 清除所有 mock
    jest.clearAllMocks();
  });

  describe('setStorage', () => {
    it('应该存储字符串值', () => {
      setStorage('key1', 'value1');
      expect(localStorage.getItem('key1')).toBe('"value1"');
    });

    it('应该存储对象值', () => {
      const obj = { a: 1, b: 2 };
      setStorage('key2', obj);
      expect(localStorage.getItem('key2')).toBe(JSON.stringify(obj));
    });

    it('应该存储数组值', () => {
      const arr = [1, 2, 3];
      setStorage('key3', arr);
      expect(localStorage.getItem('key3')).toBe(JSON.stringify(arr));
    });

    it('应该处理存储错误', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockError = new Error('Storage error');

      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw mockError;
      });

      setStorage('key', 'value');
      expect(consoleErrorSpy).toHaveBeenCalledWith('存储失败:', mockError);

      consoleErrorSpy.mockRestore();
      setItemSpy.mockRestore();
    });
  });

  describe('getStorage', () => {
    it('应该获取字符串值', () => {
      localStorage.setItem('key1', JSON.stringify('value1'));
      expect(getStorage<string>('key1')).toBe('value1');
    });

    it('应该获取对象值', () => {
      const obj = { a: 1, b: 2 };
      localStorage.setItem('key2', JSON.stringify(obj));
      expect(getStorage<typeof obj>('key2')).toEqual(obj);
    });

    it('应该获取数组值', () => {
      const arr = [1, 2, 3];
      localStorage.setItem('key3', JSON.stringify(arr));
      expect(getStorage<number[]>('key3')).toEqual(arr);
    });

    it('不存在的键应该返回 null', () => {
      expect(getStorage('nonexistent')).toBe(null);
    });

    it('应该处理获取错误', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockError = new Error('Get error');

      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw mockError;
      });

      const result = getStorage('key');
      expect(result).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith('获取存储失败:', mockError);

      consoleErrorSpy.mockRestore();
      getItemSpy.mockRestore();
    });

    it('应该处理无效的 JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorage.setItem('invalid', 'not valid json');

      const result = getStorage('invalid');
      expect(result).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('removeStorage', () => {
    it('应该删除存储的值', () => {
      localStorage.setItem('key1', 'value1');
      expect(localStorage.getItem('key1')).toBe('value1');

      removeStorage('key1');
      expect(localStorage.getItem('key1')).toBe(null);
    });

    it('应该处理删除不存在的键', () => {
      removeStorage('nonexistent');
      // 不应该抛出错误
      expect(localStorage.getItem('nonexistent')).toBe(null);
    });

    it('应该处理删除错误', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockError = new Error('Remove error');

      const removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw mockError;
      });

      removeStorage('key');
      expect(consoleErrorSpy).toHaveBeenCalledWith('删除存储失败:', mockError);

      consoleErrorSpy.mockRestore();
      removeItemSpy.mockRestore();
    });
  });

  describe('集成测试', () => {
    it('应该完整地存储、获取和删除数据', () => {
      const testData = {
        name: 'Test User',
        age: 25,
        hobbies: ['reading', 'coding'],
      };

      // 存储
      setStorage('user', testData);

      // 获取
      const retrieved = getStorage<typeof testData>('user');
      expect(retrieved).toEqual(testData);

      // 删除
      removeStorage('user');
      expect(getStorage('user')).toBe(null);
    });
  });
});
