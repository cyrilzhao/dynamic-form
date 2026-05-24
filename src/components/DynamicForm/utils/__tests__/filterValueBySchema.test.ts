import { filterValueBySchema } from '../filterValueBySchema';
import type { ExtendedJSONSchema } from '../../types/schema';

describe('filterValueBySchema', () => {
  describe('基本类型处理', () => {
    it('应该处理 null 值', () => {
      const schema: ExtendedJSONSchema = { type: 'string' };
      const result = filterValueBySchema(null, schema);
      expect(result).toBeNull();
    });

    it('应该处理 undefined 值', () => {
      const schema: ExtendedJSONSchema = { type: 'string' };
      const result = filterValueBySchema(undefined, schema);
      expect(result).toBeUndefined();
    });

    it('应该直接返回字符串类型', () => {
      const schema: ExtendedJSONSchema = { type: 'string' };
      const value = 'test string';
      const result = filterValueBySchema(value, schema);
      expect(result).toBe('test string');
    });

    it('应该直接返回数字类型', () => {
      const schema: ExtendedJSONSchema = { type: 'number' };
      const value = 42;
      const result = filterValueBySchema(value, schema);
      expect(result).toBe(42);
    });

    it('应该直接返回布尔类型', () => {
      const schema: ExtendedJSONSchema = { type: 'boolean' };
      const value = true;
      const result = filterValueBySchema(value, schema);
      expect(result).toBe(true);
    });
  });

  describe('对象类型处理', () => {
    it('应该过滤掉不在 schema 中定义的字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const value = {
        name: 'John',
        age: 30,
        extraField: 'should be removed',
        anotherExtra: 123,
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({ name: 'John', age: 30 });
      expect(result).not.toHaveProperty('extraField');
      expect(result).not.toHaveProperty('anotherExtra');
    });

    it('应该保留所有在 schema 中定义的字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
      };

      const value = {
        name: 'Jane',
        age: 25,
        email: 'jane@example.com',
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({
        name: 'Jane',
        age: 25,
        email: 'jane@example.com',
      });
    });

    it('应该处理部分字段缺失的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
      };

      const value = {
        name: 'Bob',
        extraField: 'will be removed',
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({ name: 'Bob' });
      expect(result).not.toHaveProperty('age');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('extraField');
    });

    it('应该处理没有 properties 的对象 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
      };

      const value = {
        name: 'Test',
        age: 30,
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual(value);
    });

    it('应该处理空对象', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const value = {};

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({});
    });
  });

  describe('数组类型处理', () => {
    it('应该处理基本类型数组', () => {
      const schema: ExtendedJSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const value = ['apple', 'banana', 'cherry'];

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual(['apple', 'banana', 'cherry']);
    });

    it('应该处理对象数组并过滤每个元素', () => {
      const schema: ExtendedJSONSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
        },
      };

      const value = [
        { id: 1, name: 'Item 1', extra: 'remove' },
        { id: 2, name: 'Item 2', another: 'remove' },
      ];

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]);
    });

    it('应该处理空数组', () => {
      const schema: ExtendedJSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const value: string[] = [];

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual([]);
    });

    it('应该处理没有 items 的数组 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'array',
      };

      const value = [1, 2, 3, 'test'];

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual(value);
    });
  });

  describe('嵌套对象处理', () => {
    it('应该递归过滤嵌套对象', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
          },
        },
      };

      const value = {
        user: {
          name: 'Alice',
          age: 28,
          password: 'should be removed',
        },
        extraField: 'remove',
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({
        user: {
          name: 'Alice',
          age: 28,
        },
      });
    });

    it('应该处理多层嵌套对象', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          company: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              address: {
                type: 'object',
                properties: {
                  street: { type: 'string' },
                  city: { type: 'string' },
                },
              },
            },
          },
        },
      };

      const value = {
        company: {
          name: 'Tech Corp',
          address: {
            street: '123 Main St',
            city: 'New York',
            zipCode: '10001',
          },
          employees: 100,
        },
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({
        company: {
          name: 'Tech Corp',
          address: {
            street: '123 Main St',
            city: 'New York',
          },
        },
      });
    });
  });

  describe('复杂场景处理', () => {
    it('应该处理嵌套数组中的对象', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const value = {
        users: [
          { id: 1, name: 'User 1', password: 'secret' },
          { id: 2, name: 'User 2', email: 'user2@example.com' },
        ],
        extraField: 'remove',
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({
        users: [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' },
        ],
      });
    });

    it('应该处理对象中的嵌套数组', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          profile: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      };

      const value = {
        profile: {
          name: 'John',
          tags: ['developer', 'designer'],
          age: 30,
        },
        extra: 'remove',
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({
        profile: {
          name: 'John',
          tags: ['developer', 'designer'],
        },
      });
    });
  });

  describe('边界情况处理', () => {
    it('应该处理值为 null 的对象字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const value = {
        name: null,
        age: 30,
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({ name: null, age: 30 });
    });

    it('应该处理值为 undefined 的对象字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const value = {
        name: undefined,
        age: 30,
      };

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual({ name: undefined, age: 30 });
    });

    it('应该处理数组中包含 null 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'array',
        items: { type: 'string' },
      };

      const value = ['a', null, 'b', undefined, 'c'];

      const result = filterValueBySchema(value, schema);
      expect(result).toEqual(['a', null, 'b', undefined, 'c']);
    });
  });

  describe('实际使用场景', () => {
    it('应该模拟动态表单 schema 切换场景', () => {
      // 模拟用户填写了多个表单版本的数据
      const allFormData = {
        // 表单版本 1 的字段
        name: 'John Doe',
        email: 'john@example.com',
        // 表单版本 2 的字段
        firstName: 'John',
        lastName: 'Doe',
        phone: '123-456-7890',
        // 表单版本 3 的字段
        fullName: 'John Doe',
        contactInfo: {
          email: 'john@example.com',
          phone: '123-456-7890',
        },
      };

      // 当前激活的是表单版本 2
      const currentSchema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
        },
      };

      const result = filterValueBySchema(allFormData, currentSchema);

      // 只保留当前 schema 需要的字段
      expect(result).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        phone: '123-456-7890',
      });
    });

    it('应该处理表单提交时的数据清理', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string' },
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' },
              avatar: { type: 'string' },
            },
          },
        },
      };

      // 表单数据可能包含 UI 状态或临时字段
      const formData = {
        username: 'johndoe',
        profile: {
          bio: 'Software Developer',
          avatar: 'avatar.jpg',
          _isEditing: true, // UI 状态
        },
        _formVersion: 2, // 内部字段
        _lastModified: '2024-01-01', // 元数据
      };

      const result = filterValueBySchema(formData, schema);

      // 提交时只包含 schema 定义的字段
      expect(result).toEqual({
        username: 'johndoe',
        profile: {
          bio: 'Software Developer',
          avatar: 'avatar.jpg',
        },
      });
    });
  });
});
