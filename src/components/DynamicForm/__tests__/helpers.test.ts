/**
 * Helpers 系统测试
 */
import { builtInHelpers } from '../utils/builtInHelpers';
import { executeInlineScript } from '../utils/executeInlineScript';

describe('Helpers 系统', () => {
  describe('内置 Helpers', () => {
    it('应该包含 ofetch', () => {
      expect(builtInHelpers.ofetch).toBeDefined();
    });

    it('应该包含 lodash', () => {
      expect(builtInHelpers._).toBeDefined();
      expect(typeof builtInHelpers._.map).toBe('function');
    });

    it('应该包含 valibot', () => {
      expect(builtInHelpers.v).toBeDefined();
      expect(typeof builtInHelpers.v.string).toBe('function');
    });
  });

  describe('executeInlineScript', () => {
    it('应该能够执行简单的 inline script', () => {
      const result = executeInlineScript({
        code: 'function({ formData }) { return formData.a + formData.b; }',
        params: { formData: { a: 1, b: 2 } },
        helpers: {},
      });

      expect(result).toBe(3);
    });

    it('应该能够在 inline script 中使用 helpers', () => {
      const result = executeInlineScript({
        code: 'function({ formData, helpers }) { return helpers._.sum([formData.a, formData.b]); }',
        params: { formData: { a: 1, b: 2 } },
        helpers: builtInHelpers,
      });

      expect(result).toBe(3);
    });

    it('应该能够在 inline script 中使用 lodash', () => {
      const result = executeInlineScript({
        code: 'function({ formData, helpers }) { return helpers._.map(formData.items, "name"); }',
        params: {
          formData: {
            items: [{ name: 'a' }, { name: 'b' }]
          }
        },
        helpers: builtInHelpers,
      });

      expect(result).toEqual(['a', 'b']);
    });

    it('应该支持异步 inline script', async () => {
      const result = await executeInlineScript({
        code: 'async function({ formData, helpers }) { return Promise.resolve(formData.value * 2); }',
        params: { formData: { value: 5 } },
        helpers: {},
      });

      expect(result).toBe(10);
    });
  });
});
