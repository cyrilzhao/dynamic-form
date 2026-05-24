import { extractSchemaDefaults, mergeDefaults } from '../extractSchemaDefaults';
import type { ExtendedJSONSchema } from '../../types/schema';

describe('extractSchemaDefaults', () => {
  describe('基本类型场景', () => {
    it('应该从简单 schema 中提取 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string', default: 'guest' },
          age: { type: 'number', default: 18 },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        username: 'guest',
        age: 18,
      });
    });

    it('应该只提取有 default 值的字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string', default: 'guest' },
          email: { type: 'string' }, // 没有 default
          age: { type: 'number' }, // 没有 default
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        username: 'guest',
      });
    });

    it('应该处理布尔类型的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          isActive: { type: 'boolean', default: true },
          isAdmin: { type: 'boolean', default: false },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        isActive: true,
        isAdmin: false,
      });
    });

    it('应该处理数组类型的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            default: ['tag1', 'tag2'],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        tags: ['tag1', 'tag2'],
      });
    });

    it('应该处理对象类型的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            default: { key: 'value', count: 10 },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        config: { key: 'value', count: 10 },
      });
    });
  });

  describe('嵌套对象', () => {
    it('应该递归提取嵌套对象中的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', default: 'John' },
              settings: {
                type: 'object',
                properties: {
                  theme: { type: 'string', default: 'dark' },
                  language: { type: 'string', default: 'en' },
                },
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            language: 'en',
          },
        },
      });
    });

    it('应该处理部分嵌套字段有 default 值的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' }, // 没有 default
              role: { type: 'string', default: 'user' },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        user: {
          role: 'user',
        },
      });
    });

    it('应该不包含没有任何 default 值的嵌套对象', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string', default: 'guest' },
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' }, // 没有 default
              avatar: { type: 'string' }, // 没有 default
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        username: 'guest',
      });
      expect(result.profile).toBeUndefined();
    });
  });

  describe('边界情况', () => {
    it('应该处理 null schema', () => {
      const result = extractSchemaDefaults(null as any);
      expect(result).toEqual({});
    });

    it('应该处理 undefined schema', () => {
      const result = extractSchemaDefaults(undefined as any);
      expect(result).toEqual({});
    });

    it('应该处理非 object 类型的 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'string',
        default: 'test',
      };

      const result = extractSchemaDefaults(schema);
      expect(result).toEqual({});
    });

    it('应该处理没有 properties 的 object schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
      };

      const result = extractSchemaDefaults(schema);
      expect(result).toEqual({});
    });

    it('应该处理空 properties 的 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {},
      };

      const result = extractSchemaDefaults(schema);
      expect(result).toEqual({});
    });

    it('应该处理 default 值为 null 的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          nullableField: { type: 'string', default: null },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        nullableField: null,
      });
    });

    it('应该处理 default 值为空字符串的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          emptyString: { type: 'string', default: '' },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        emptyString: '',
      });
    });

    it('应该处理 default 值为 0 的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          zeroValue: { type: 'number', default: 0 },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        zeroValue: 0,
      });
    });

    it('应该处理 integer 类型的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          count: { type: 'integer', default: 100 },
          negative: { type: 'integer', default: -5 },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        count: 100,
        negative: -5,
      });
    });

    it('应该处理带有 enum 的字段的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
            default: 'pending',
          },
          priority: {
            type: 'number',
            enum: [1, 2, 3],
            default: 2,
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        status: 'pending',
        priority: 2,
      });
    });

    it('应该处理带有 ui 配置的 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            default: 'guest',
            ui: {
              placeholder: '请输入用户名',
              widget: 'text',
            },
          },
          password: {
            type: 'string',
            ui: {
              widget: 'password',
            },
            // 没有 default
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        username: 'guest',
      });
    });

    it('应该处理 default 值为 undefined 的情况（不提取）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field1: { type: 'string', default: undefined },
          field2: { type: 'string', default: 'value' },
        },
      };

      const result = extractSchemaDefaults(schema);

      // default: undefined 不应该被提取
      expect(result).toEqual({
        field2: 'value',
      });
    });

    it('应该处理 default 值为 false 的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          disabled: { type: 'boolean', default: false },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        disabled: false,
      });
    });

    it('应该处理 type 为数组形式的 schema（如 ["string", "null"]）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          nullable: {
            type: ['string', 'null'] as any,
            default: 'default-value',
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        nullable: 'default-value',
      });
    });

    it('应该处理没有 type 字段的 property', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          anyField: {
            default: 'any-value',
          } as ExtendedJSONSchema,
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        anyField: 'any-value',
      });
    });
  });

  describe('数组类型场景', () => {
    it('应该处理数组类型的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            default: ['tag1', 'tag2'],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        tags: ['tag1', 'tag2'],
      });
    });

    it('应该处理数组没有 default 值的情况（不提取）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            // 没有 default
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({});
    });

    it('应该处理空数组作为 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          emptyList: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        emptyList: [],
      });
    });

    it('应该处理对象数组作为 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                age: { type: 'number' },
              },
            },
            default: [
              { name: 'Alice', age: 25 },
              { name: 'Bob', age: 30 },
            ],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 },
        ],
      });
    });

    it('应该处理嵌套数组作为 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          matrix: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
            },
            default: [
              [1, 2, 3],
              [4, 5, 6],
            ],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
    });

    it('数组 items 内对象属性有 default 但数组本身没有 default 时不提取', () => {
      // 这是设计行为：数组元素的默认值由 ArrayFieldWidget 在添加新元素时处理
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', default: 'Anonymous' },
                role: { type: 'string', default: 'user' },
                active: { type: 'boolean', default: true },
              },
            },
            // 注意：数组本身没有 default
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      // 数组本身没有 default，所以不提取
      // items 内部的 default 由 ArrayFieldWidget 在添加元素时使用
      expect(result).toEqual({});
    });

    it('数组有整体 default 时应该使用整体 default 而不是提取 items 内的 default', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', default: 'Anonymous' },
                role: { type: 'string', default: 'user' },
              },
            },
            // 数组有整体的 default 值
            default: [
              { name: 'Admin', role: 'admin' },
            ],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      // 应该使用数组的整体 default，而不是从 items 中提取
      expect(result).toEqual({
        users: [{ name: 'Admin', role: 'admin' }],
      });
    });
  });

  describe('复杂嵌套场景', () => {
    it('对象 → 数组 → 对象 的多层嵌套结构', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          company: {
            type: 'object',
            properties: {
              name: { type: 'string', default: 'Acme Inc' },
              departments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    deptName: { type: 'string', default: 'Engineering' },
                    headCount: { type: 'number', default: 10 },
                  },
                },
                // 部门列表有整体默认值
                default: [
                  { deptName: 'HR', headCount: 5 },
                ],
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        company: {
          name: 'Acme Inc',
          departments: [{ deptName: 'HR', headCount: 5 }],
        },
      });
    });

    it('对象 → 数组（无 default）→ 对象 的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          company: {
            type: 'object',
            properties: {
              name: { type: 'string', default: 'Acme Inc' },
              employees: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', default: 'John Doe' },
                    email: { type: 'string' },
                  },
                },
                // 数组没有整体 default
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      // employees 数组没有 default，所以不会出现在结果中
      // 但 company.name 有 default
      expect(result).toEqual({
        company: {
          name: 'Acme Inc',
        },
      });
    });

    it('数组 → 对象 → 数组 的交叉嵌套（都有 default）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          projects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                projectName: { type: 'string' },
                tasks: {
                  type: 'array',
                  items: { type: 'string' },
                  default: ['Task 1', 'Task 2'],
                },
              },
            },
            default: [
              {
                projectName: 'Project A',
                tasks: ['Design', 'Development'],
              },
            ],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      // 使用数组的整体 default
      expect(result).toEqual({
        projects: [
          {
            projectName: 'Project A',
            tasks: ['Design', 'Development'],
          },
        ],
      });
    });

    it('多个数组字段混合有无 default 的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            items: { type: 'string' },
            default: ['important', 'urgent'],
          },
          categories: {
            type: 'array',
            items: { type: 'string' },
            // 没有 default
          },
          labels: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', default: 'Label' },
                color: { type: 'string', default: '#000000' },
              },
            },
            default: [{ name: 'Priority', color: '#FF0000' }],
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        tags: ['important', 'urgent'],
        // categories 没有 default，不出现
        labels: [{ name: 'Priority', color: '#FF0000' }],
      });
    });

    it('深层嵌套对象内的数组字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  host: { type: 'string', default: 'localhost' },
                  ports: {
                    type: 'array',
                    items: { type: 'number' },
                    default: [5432, 5433],
                  },
                  replicas: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        host: { type: 'string', default: 'replica-host' },
                        port: { type: 'number', default: 5432 },
                      },
                    },
                    // replicas 没有整体 default
                  },
                },
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        config: {
          database: {
            host: 'localhost',
            ports: [5432, 5433],
            // replicas 没有出现，因为数组本身没有 default
          },
        },
      });
    });

    it('混合场景：部分对象有 default，部分只有 properties', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          // 对象有整体 default
          theme: {
            type: 'object',
            default: { mode: 'dark', accent: 'blue' },
            properties: {
              mode: { type: 'string', default: 'light' },
              accent: { type: 'string', default: 'green' },
            },
          },
          // 对象没有整体 default，需要递归提取
          layout: {
            type: 'object',
            properties: {
              sidebar: { type: 'boolean', default: true },
              header: { type: 'boolean', default: true },
              footer: { type: 'boolean' }, // 没有 default
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        // theme 使用整体 default
        theme: { mode: 'dark', accent: 'blue' },
        // layout 递归提取有 default 的属性
        layout: {
          sidebar: true,
          header: true,
          // footer 没有 default，不出现
        },
      });
    });
  });

  describe('对象类型场景', () => {
    it('应该处理对象类型的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          config: {
            type: 'object',
            default: { key: 'value', count: 10 },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        config: { key: 'value', count: 10 },
      });
    });

    it('对象字段同时有 default 和 properties 时应该优先使用 default', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          settings: {
            type: 'object',
            default: { theme: 'custom', lang: 'zh' },
            properties: {
              theme: { type: 'string', default: 'light' },
              lang: { type: 'string', default: 'en' },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      // 应该使用字段级别的 default，而不是递归提取 properties 中的 default
      expect(result).toEqual({
        settings: { theme: 'custom', lang: 'zh' },
      });
    });

    it('应该处理空对象作为 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          emptyConfig: {
            type: 'object',
            default: {},
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        emptyConfig: {},
      });
    });
  });

  describe('嵌套对象场景', () => {
    it('应该递归提取嵌套对象中的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', default: 'John' },
              settings: {
                type: 'object',
                properties: {
                  theme: { type: 'string', default: 'dark' },
                  language: { type: 'string', default: 'en' },
                },
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            language: 'en',
          },
        },
      });
    });

    it('应该处理部分嵌套字段有 default 值的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' }, // 没有 default
              role: { type: 'string', default: 'user' },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        user: {
          role: 'user',
        },
      });
    });

    it('应该不包含没有任何 default 值的嵌套对象', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string', default: 'guest' },
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string' }, // 没有 default
              avatar: { type: 'string' }, // 没有 default
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        username: 'guest',
      });
      expect(result.profile).toBeUndefined();
    });

    it('应该处理深度嵌套（4层）的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: { type: 'string', default: 'deep-value' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              level4: 'deep-value',
            },
          },
        },
      });
    });

    it('应该处理混合深度的 default 值', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          shallow: { type: 'string', default: 'shallow-value' },
          nested: {
            type: 'object',
            properties: {
              middle: { type: 'number', default: 42 },
              deeper: {
                type: 'object',
                properties: {
                  deep: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        shallow: 'shallow-value',
        nested: {
          middle: 42,
          deeper: {
            deep: true,
          },
        },
      });
    });

    it('应该处理嵌套对象中包含数组 default 的情况', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string', default: 'John' },
              roles: {
                type: 'array',
                items: { type: 'string' },
                default: ['admin', 'user'],
              },
            },
          },
        },
      };

      const result = extractSchemaDefaults(schema);

      expect(result).toEqual({
        user: {
          name: 'John',
          roles: ['admin', 'user'],
        },
      });
    });
  });
});

describe('mergeDefaults', () => {
  describe('基本合并', () => {
    it('应该合并两个简单对象', () => {
      const schemaDefaults = { username: 'guest', theme: 'light' };
      const userDefaults = { email: 'test@example.com' };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        username: 'guest',
        theme: 'light',
        email: 'test@example.com',
      });
    });

    it('用户提供的值应该覆盖 schema 默认值', () => {
      const schemaDefaults = { username: 'guest', theme: 'light' };
      const userDefaults = { username: 'admin', theme: 'dark' };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        username: 'admin',
        theme: 'dark',
      });
    });

    it('应该处理部分覆盖的情况', () => {
      const schemaDefaults = { username: 'guest', theme: 'light', language: 'en' };
      const userDefaults = { theme: 'dark' };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        username: 'guest',
        theme: 'dark',
        language: 'en',
      });
    });
  });

  describe('嵌套对象合并', () => {
    it('应该深度合并嵌套对象', () => {
      const schemaDefaults = {
        user: {
          name: 'John',
          settings: {
            theme: 'light',
            language: 'en',
          },
        },
      };
      const userDefaults = {
        user: {
          settings: {
            theme: 'dark',
          },
        },
      };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            language: 'en',
          },
        },
      });
    });

    it('用户提供的嵌套对象应该与 schema 嵌套对象合并', () => {
      const schemaDefaults = {
        config: {
          api: {
            timeout: 5000,
            retries: 3,
          },
        },
      };
      const userDefaults = {
        config: {
          api: {
            retries: 5,
            baseUrl: 'https://api.example.com',
          },
        },
      };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        config: {
          api: {
            timeout: 5000,
            retries: 5,
            baseUrl: 'https://api.example.com',
          },
        },
      });
    });
  });

  describe('特殊类型处理', () => {
    it('用户提供的数组应该完全覆盖 schema 数组', () => {
      const schemaDefaults = { tags: ['tag1', 'tag2'] };
      const userDefaults = { tags: ['custom1', 'custom2', 'custom3'] };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        tags: ['custom1', 'custom2', 'custom3'],
      });
    });

    it('用户提供的 null 应该覆盖 schema 默认值', () => {
      const schemaDefaults = { username: 'guest' };
      const userDefaults = { username: null };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        username: null,
      });
    });

    it('用户提供的基本类型应该覆盖 schema 中的对象', () => {
      const schemaDefaults = { config: { key: 'value' } };
      const userDefaults = { config: 'simple-value' };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        config: 'simple-value',
      });
    });

    it('用户提供的对象应该覆盖 schema 中的基本类型', () => {
      const schemaDefaults = { config: 'simple-value' };
      const userDefaults = { config: { key: 'value' } };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        config: { key: 'value' },
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理空的 schemaDefaults', () => {
      const schemaDefaults = {};
      const userDefaults = { username: 'admin' };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        username: 'admin',
      });
    });

    it('应该处理空的 userDefaults', () => {
      const schemaDefaults = { username: 'guest' };
      const userDefaults = {};

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        username: 'guest',
      });
    });

    it('应该处理两者都为空的情况', () => {
      const result = mergeDefaults({}, {});
      expect(result).toEqual({});
    });

    it('应该处理用户提供 undefined 值的情况', () => {
      const schemaDefaults = { username: 'guest', theme: 'light' };
      const userDefaults = { username: undefined, theme: 'dark' };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      // undefined 也是有效的覆盖值
      expect(result).toEqual({
        username: undefined,
        theme: 'dark',
      });
    });

    it('应该处理空数组覆盖非空数组', () => {
      const schemaDefaults = { tags: ['tag1', 'tag2'] };
      const userDefaults = { tags: [] };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        tags: [],
      });
    });

    it('应该处理空对象覆盖非空对象', () => {
      const schemaDefaults = { config: { key: 'value' } };
      const userDefaults = { config: {} };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      // 空对象与非空对象合并，结果是保留原对象的内容
      expect(result).toEqual({
        config: { key: 'value' },
      });
    });
  });

  describe('深度嵌套合并', () => {
    it('应该处理 4 层深度嵌套合并', () => {
      const schemaDefaults = {
        level1: {
          level2: {
            level3: {
              level4: 'schema-value',
              keepThis: 'original',
            },
          },
        },
      };
      const userDefaults = {
        level1: {
          level2: {
            level3: {
              level4: 'user-value',
              addThis: 'new',
            },
          },
        },
      };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              level4: 'user-value',
              keepThis: 'original',
              addThis: 'new',
            },
          },
        },
      });
    });

    it('应该处理多分支嵌套合并', () => {
      const schemaDefaults = {
        branch1: {
          a: 1,
          b: 2,
        },
        branch2: {
          c: 3,
          d: 4,
        },
      };
      const userDefaults = {
        branch1: {
          a: 10,
        },
        branch3: {
          e: 5,
        },
      };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        branch1: {
          a: 10,
          b: 2,
        },
        branch2: {
          c: 3,
          d: 4,
        },
        branch3: {
          e: 5,
        },
      });
    });
  });

  describe('不可变性测试', () => {
    it('合并不应该修改原始 schemaDefaults', () => {
      const schemaDefaults = { username: 'guest', nested: { value: 1 } };
      const originalSchemaDefaults = JSON.parse(JSON.stringify(schemaDefaults));
      const userDefaults = { username: 'admin', nested: { value: 2 } };

      mergeDefaults(schemaDefaults, userDefaults);

      expect(schemaDefaults).toEqual(originalSchemaDefaults);
    });

    it('合并不应该修改原始 userDefaults', () => {
      const schemaDefaults = { username: 'guest' };
      const userDefaults = { username: 'admin', extra: 'value' };
      const originalUserDefaults = JSON.parse(JSON.stringify(userDefaults));

      mergeDefaults(schemaDefaults, userDefaults);

      expect(userDefaults).toEqual(originalUserDefaults);
    });
  });

  describe('isPlainObject 内部函数间接测试', () => {
    it('数组应该覆盖对象而不是合并', () => {
      const schemaDefaults = { data: { key: 'value' } };
      const userDefaults = { data: [1, 2, 3] };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        data: [1, 2, 3],
      });
    });

    it('对象应该覆盖数组而不是合并', () => {
      const schemaDefaults = { data: [1, 2, 3] };
      const userDefaults = { data: { key: 'value' } };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        data: { key: 'value' },
      });
    });

    it('Date 对象应该被当作普通对象处理（深度合并）', () => {
      // 注意：isPlainObject 使用 typeof 检查，Date 对象会被视为普通对象
      // 这意味着两个 Date 对象会被合并而不是覆盖
      const date1 = new Date('2020-01-01');
      const date2 = new Date('2025-01-01');
      const schemaDefaults = { createdAt: date1 };
      const userDefaults = { createdAt: date2 };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      // Date 对象被当作普通对象合并，合并两个 Date 会产生空对象
      // 因为 Date 对象没有可枚举的属性
      expect(result.createdAt).toEqual({});
    });

    it('null 应该被当作非普通对象处理（完全覆盖）', () => {
      const schemaDefaults = { config: { key: 'value' } };
      const userDefaults = { config: null };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        config: null,
      });
    });

    it('普通对象覆盖 null 值', () => {
      const schemaDefaults = { config: null };
      const userDefaults = { config: { key: 'value' } };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      expect(result).toEqual({
        config: { key: 'value' },
      });
    });

    it('RegExp 对象应该被当作普通对象处理（深度合并）', () => {
      // 注意：isPlainObject 使用 typeof 检查，RegExp 对象会被视为普通对象
      // 这意味着两个 RegExp 对象会被合并而不是覆盖
      const regex1 = /test1/;
      const regex2 = /test2/;
      const schemaDefaults = { pattern: regex1 };
      const userDefaults = { pattern: regex2 };

      const result = mergeDefaults(schemaDefaults, userDefaults);

      // RegExp 对象被当作普通对象合并，合并两个 RegExp 会产生空对象
      // 因为 RegExp 对象没有可枚举的自有属性
      expect(result.pattern).toEqual({});
    });
  });
});

describe('extractSchemaDefaults 和 mergeDefaults 集成测试', () => {
  it('应该正确处理典型的表单场景', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        username: { type: 'string', default: 'guest' },
        email: { type: 'string' },
        settings: {
          type: 'object',
          properties: {
            theme: { type: 'string', default: 'light' },
            notifications: { type: 'boolean', default: true },
          },
        },
      },
    };

    const userDefaults = {
      email: 'user@example.com',
      settings: {
        theme: 'dark',
      },
    };

    const schemaDefaults = extractSchemaDefaults(schema);
    const merged = mergeDefaults(schemaDefaults, userDefaults);

    expect(merged).toEqual({
      username: 'guest',
      email: 'user@example.com',
      settings: {
        theme: 'dark',
        notifications: true,
      },
    });
  });

  it('应该处理 BasicFormPanel 中的实际场景', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          title: '用户名',
          minLength: 3,
          maxLength: 20,
          default: 'aaa',
        },
        email: {
          type: 'string',
          title: '邮箱',
          format: 'email',
        },
        country: {
          type: 'string',
          title: '国家',
          enum: ['china', 'usa', 'japan', 'uk', 'other'],
        },
      },
    };

    const schemaDefaults = extractSchemaDefaults(schema);

    expect(schemaDefaults).toEqual({
      username: 'aaa',
    });
  });

  it('应该处理复杂的嵌套表单场景', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        personalInfo: {
          type: 'object',
          properties: {
            firstName: { type: 'string', default: 'John' },
            lastName: { type: 'string' },
            age: { type: 'integer', default: 18 },
          },
        },
        preferences: {
          type: 'object',
          properties: {
            theme: { type: 'string', default: 'light' },
            language: { type: 'string', default: 'en' },
            notifications: {
              type: 'object',
              properties: {
                email: { type: 'boolean', default: true },
                sms: { type: 'boolean', default: false },
              },
            },
          },
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          default: ['default-tag'],
        },
      },
    };

    const userDefaults = {
      personalInfo: {
        lastName: 'Doe',
      },
      preferences: {
        theme: 'dark',
        notifications: {
          email: false,
        },
      },
    };

    const schemaDefaults = extractSchemaDefaults(schema);
    const merged = mergeDefaults(schemaDefaults, userDefaults);

    expect(merged).toEqual({
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        age: 18,
      },
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: {
          email: false,
          sms: false,
        },
      },
      tags: ['default-tag'],
    });
  });

  it('应该处理没有任何 default 值的 schema', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        profile: {
          type: 'object',
          properties: {
            bio: { type: 'string' },
            website: { type: 'string', format: 'uri' },
          },
        },
      },
    };

    const schemaDefaults = extractSchemaDefaults(schema);

    expect(schemaDefaults).toEqual({});
  });

  it('应该处理全部字段都有 default 值的 schema', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', default: 'Guest' },
        role: { type: 'string', default: 'user' },
        isActive: { type: 'boolean', default: true },
        score: { type: 'number', default: 0 },
      },
    };

    const schemaDefaults = extractSchemaDefaults(schema);

    expect(schemaDefaults).toEqual({
      name: 'Guest',
      role: 'user',
      isActive: true,
      score: 0,
    });
  });

  it('应该处理用户提供的 defaultValues 完全覆盖 schema defaults 的场景', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        username: { type: 'string', default: 'guest' },
        theme: { type: 'string', default: 'light' },
      },
    };

    const userDefaults = {
      username: 'admin',
      theme: 'dark',
      extraField: 'extra-value',
    };

    const schemaDefaults = extractSchemaDefaults(schema);
    const merged = mergeDefaults(schemaDefaults, userDefaults);

    expect(merged).toEqual({
      username: 'admin',
      theme: 'dark',
      extraField: 'extra-value',
    });
  });

  it('应该处理真实的工作流节点配置 schema', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        nodeId: { type: 'string' },
        nodeType: { type: 'string', default: 'default' },
        config: {
          type: 'object',
          properties: {
            timeout: { type: 'number', default: 30000 },
            retries: { type: 'integer', default: 3 },
            enabled: { type: 'boolean', default: true },
          },
        },
        inputs: {
          type: 'array',
          items: { type: 'string' },
          // 数组没有 default，应该不被提取
        },
        metadata: {
          type: 'object',
          default: { version: '1.0' },
        },
      },
    };

    const schemaDefaults = extractSchemaDefaults(schema);

    expect(schemaDefaults).toEqual({
      nodeType: 'default',
      config: {
        timeout: 30000,
        retries: 3,
        enabled: true,
      },
      metadata: { version: '1.0' },
    });
  });
});
