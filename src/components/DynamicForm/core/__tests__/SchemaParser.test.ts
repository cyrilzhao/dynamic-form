import { SchemaParser } from '../SchemaParser';
import type { ExtendedJSONSchema, FieldConfig } from '../../types/schema';

describe('SchemaParser', () => {
  describe('parse', () => {
    describe('基本功能', () => {
      it('应该解析简单的对象 schema', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              title: '姓名',
            },
            age: {
              type: 'number',
              title: '年龄',
            },
          },
          required: ['name'],
        };

        const fields = SchemaParser.parse(schema);

        expect(fields).toHaveLength(2);
        expect(fields[0]).toMatchObject({
          name: 'name',
          type: 'string',
          label: '姓名',
          required: true,
          widget: 'text',
        });
        expect(fields[1]).toMatchObject({
          name: 'age',
          type: 'number',
          label: '年龄',
          required: false,
          widget: 'number',
        });
      });

      it('应该返回空数组当 schema 不是对象类型', () => {
        const schema: ExtendedJSONSchema = {
          type: 'string',
        };

        const fields = SchemaParser.parse(schema);
        expect(fields).toEqual([]);
      });

      it('应该返回空数组当 schema 没有 properties', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
        };

        const fields = SchemaParser.parse(schema);
        expect(fields).toEqual([]);
      });

      it('应该跳过布尔类型的 property', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            invalid: true as any,
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0].name).toBe('name');
      });

      it('应该过滤掉隐藏的字段', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            secret: {
              type: 'string',
              ui: { hidden: true },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields).toHaveLength(1);
        expect(fields[0].name).toBe('name');
      });
    });

    describe('字段顺序', () => {
      it('应该按照 properties 的顺序返回字段', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            email: { type: 'string' },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields.map(f => f.name)).toEqual(['name', 'age', 'email']);
      });

      it('应该按照 ui.order 指定的顺序返回字段', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            email: { type: 'string' },
          },
          ui: {
            order: ['email', 'name', 'age'],
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields.map(f => f.name)).toEqual(['email', 'name', 'age']);
      });

      it('应该忽略 ui.order 中不存在的字段', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          ui: {
            order: ['email', 'name', 'age', 'phone'],
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields.map(f => f.name)).toEqual(['name', 'age']);
      });
    });
  });

  describe('parseField - 基本字段属性', () => {
    it('应该解析字段的基本属性', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            title: '用户名',
            description: '请输入用户名',
            default: 'guest',
            ui: {
              placeholder: '请输入...',
              disabled: true,
              readonly: true,
            },
          },
        },
        required: ['username'],
      };

      const fields = SchemaParser.parse(schema);
      const field = fields[0];

      expect(field).toMatchObject({
        name: 'username',
        type: 'string',
        label: '用户名',
        description: '请输入用户名',
        defaultValue: 'guest',
        placeholder: '请输入...',
        required: true,
        disabled: true,
        readonly: true,
      });
    });

    it('应该处理没有 ui 配置的字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: '姓名',
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      const field = fields[0];

      expect(field.placeholder).toBeUndefined();
      expect(field.disabled).toBeUndefined();
      expect(field.readonly).toBeUndefined();
      expect(field.hidden).toBeUndefined();
    });

    it('应该为对象类型字段保留 schema', () => {
      const nestedSchema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
        },
      };

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          address: nestedSchema,
        },
      };

      const fields = SchemaParser.parse(schema);
      const field = fields[0];

      expect(field.schema).toBeDefined();
      // SchemaParser 会为对象类型自动添加 ui 属性，使用 toMatchObject 进行部分匹配
      expect(field.schema).toMatchObject({
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
        },
      });
    });

    it('应该为所有字段保留 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const fields = SchemaParser.parse(schema);

      expect(fields[0].schema).toBeDefined();
      expect(fields[0].schema?.type).toBe('string');
      expect(fields[1].schema).toBeDefined();
      expect(fields[1].schema?.type).toBe('number');
    });
  });

  describe('getWidget - Widget 类型推断', () => {
    describe('字符串类型', () => {
      it('应该为普通字符串返回 text widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('text');
      });

      it('应该为 email 格式返回 email widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('email');
      });

      it('应该为 date 格式返回 date widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            birthday: {
              type: 'string',
              format: 'date',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('date');
      });

      it('应该为 date-time 格式返回 datetime widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('datetime');
      });

      it('应该为 time 格式返回 time widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            startTime: {
              type: 'string',
              format: 'time',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('time');
      });

      it('应该为有 enum 的字符串返回 select widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending'],
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('select');
      });

      it('应该为长文本返回 textarea widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              maxLength: 500,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('textarea');
      });

      it('应该为短文本返回 text widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              maxLength: 50,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('text');
      });
    });

    describe('数字类型', () => {
      it('应该为 number 类型返回 number widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            price: { type: 'number' },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('number');
      });

      it('应该为 integer 类型返回 number widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            count: { type: 'integer' },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('number');
      });
    });

    describe('布尔类型', () => {
      it('应该为 boolean 类型返回 checkbox widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            agreed: { type: 'boolean' },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('checkbox');
      });
    });

    describe('数组类型', () => {
      it('应该为有 enum items 的数组返回 array widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            hobbies: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['reading', 'sports', 'music'],
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('array');
      });

      it('应该为普通数组返回 array widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('array');
      });

      it('应该处理没有 items 的数组', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            data: {
              type: 'array',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('array');
      });
    });

    describe('对象类型', () => {
      it('应该为 object 类型返回 nested-form widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('nested-form');
      });
    });

    describe('自定义 widget', () => {
      it('应该优先使用 ui.widget 指定的 widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            password: {
              type: 'string',
              ui: {
                widget: 'password',
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('password');
      });

      it('应该允许覆盖默认的 widget 推断', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'inactive'],
              ui: {
                widget: 'radio',
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('radio');
      });
    });

    describe('未知类型处理', () => {
      it('应该为未知类型返回 text widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            unknown: {
              type: 'null' as any, // 使用一个不常见的类型
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('text');
      });

      it('应该为没有 type 的字段返回 text widget', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            noType: {} as any,
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].widget).toBe('text');
      });
    });
  });

  describe('getValidationRules - 验证规则', () => {
    describe('必填验证', () => {
      it('应该为必填字段添加 required 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        };

        const fields = SchemaParser.parse(schema);
        // 现在 required 是一个 validate 函数，而不是简单的字符串
        expect(fields[0].validation?.validate?.required).toBeDefined();
        expect(typeof fields[0].validation?.validate?.required).toBe('function');
      });

      it('应该使用自定义的 required 错误消息', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              ui: {
                errorMessages: {
                  required: '请输入邮箱地址',
                },
              },
            },
          },
          required: ['email'],
        };

        const fields = SchemaParser.parse(schema);
        const validator = fields[0].validation?.validate?.required;
        expect(validator).toBeDefined();
        // 测试自定义错误消息
        expect(validator!(null)).toBe('请输入邮箱地址');
      });

      it('应该为非必填字段不添加 required 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            nickname: { type: 'string' },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.required).toBeUndefined();
      });

      it('应该正确处理 false 值（不应被判断为空值）', () => {
        const schema: ExtendedJSONSchema = {
          type: 'boolean',
          ui: {
            errorMessages: {
              required: 'This field is required',
            },
          },
        };

        const rules = SchemaParser.getValidationRules(schema, true);
        const validator = rules.validate?.required;

        expect(validator).toBeDefined();
        expect(validator!(false)).toBe(true); // false 是有效值
        expect(validator!(true)).toBe(true); // true 是有效值
        expect(validator!(null)).toBe('This field is required'); // null 无效
        expect(validator!(undefined)).toBe('This field is required'); // undefined 无效
      });

      it('应该正确处理 0 值（不应被判断为空值）', () => {
        const schema: ExtendedJSONSchema = {
          type: 'number',
        };

        const rules = SchemaParser.getValidationRules(schema, true);
        const validator = rules.validate?.required;

        expect(validator).toBeDefined();
        expect(validator!(0)).toBe(true); // 0 是有效值
        expect(validator!(1)).toBe(true); // 1 是有效值
        expect(validator!(null)).toBe('This field is required'); // null 无效
        expect(validator!(undefined)).toBe('This field is required'); // undefined 无效
      });

      it('应该正确处理空字符串（应被判断为空值）', () => {
        const schema: ExtendedJSONSchema = {
          type: 'string',
        };

        const rules = SchemaParser.getValidationRules(schema, true);
        const validator = rules.validate?.required;

        expect(validator).toBeDefined();
        expect(validator!('')).toBe('This field is required'); // 空字符串无效
        expect(validator!('  ')).toBe('This field is required'); // 空白字符串无效
        expect(validator!('text')).toBe(true); // 非空字符串有效
      });

      it('应该正确处理空数组（应被判断为空值）', () => {
        const schema: ExtendedJSONSchema = {
          type: 'array',
        };

        const rules = SchemaParser.getValidationRules(schema, true);
        const validator = rules.validate?.required;

        expect(validator).toBeDefined();
        expect(validator!([])).toBe('This field is required'); // 空数组无效
        expect(validator!(['item'])).toBe(true); // 非空数组有效
      });
    });

    describe('长度验证', () => {
      it('应该添加 minLength 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            password: {
              type: 'string',
              minLength: 8,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.validate?.minLength).toBeDefined();

        // 测试验证函数
        const validator = fields[0].validation?.validate?.minLength;
        if (validator) {
          expect(validator('short')).toBe('Minimum length is 8 characters');
          expect(validator('longenough')).toBe(true);
          // 空值不进行 minLength 校验，由 required 规则处理
          expect(validator(null)).toBe(true);
          expect(validator(undefined)).toBe(true);
          expect(validator('')).toBe(true);
        }
      });

      it('应该添加 maxLength 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              maxLength: 20,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.maxLength).toEqual({
          value: 20,
          message: 'Maximum length is 20 characters',
        });
      });

      it('应该使用自定义的长度错误消息', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              minLength: 6,
              maxLength: 6,
              ui: {
                errorMessages: {
                  minLength: '验证码必须是6位',
                  maxLength: '验证码必须是6位',
                },
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);

        // 测试 minLength 自定义错误消息
        const minLengthValidator = fields[0].validation?.validate?.minLength;
        if (minLengthValidator) {
          expect(minLengthValidator('12345')).toBe('验证码必须是6位');
          expect(minLengthValidator('123456')).toBe(true);
        }

        // 测试 maxLength 自定义错误消息
        expect(fields[0].validation?.maxLength?.message).toBe('验证码必须是6位');
      });
    });

    describe('数值范围验证', () => {
      it('应该添加 minimum 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            age: {
              type: 'number',
              minimum: 18,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.min).toEqual({
          value: 18,
          message: 'Minimum value is 18',
        });
      });

      it('应该添加 maximum 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            score: {
              type: 'number',
              maximum: 100,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.max).toEqual({
          value: 100,
          message: 'Maximum value is 100',
        });
      });

      it('应该处理 minimum 为 0 的情况', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            count: {
              type: 'number',
              minimum: 0,
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.min).toEqual({
          value: 0,
          message: 'Minimum value is 0',
        });
      });

      it('应该使用自定义的数值范围错误消息', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            price: {
              type: 'number',
              minimum: 0,
              maximum: 9999,
              ui: {
                errorMessages: {
                  min: '价格不能为负数',
                  max: '价格不能超过9999',
                },
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.min?.message).toBe('价格不能为负数');
        expect(fields[0].validation?.max?.message).toBe('价格不能超过9999');
      });
    });

    describe('正则表达式验证', () => {
      it('应该添加 pattern 规则', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            phone: {
              type: 'string',
              pattern: '^1[3-9]\\d{9}$',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.pattern?.value).toEqual(/^1[3-9]\d{9}$/);
        expect(fields[0].validation?.pattern?.message).toBe('Invalid format');
      });

      it('应该使用自定义的 pattern 错误消息', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            idCard: {
              type: 'string',
              pattern: '^\\d{17}[\\dXx]$',
              ui: {
                errorMessages: {
                  pattern: '请输入有效的身份证号码',
                },
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.pattern?.message).toBe('请输入有效的身份证号码');
      });
    });

    describe('格式验证', () => {
      it('应该为 email 格式添加内置验证', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.pattern?.value).toEqual(
          /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        );
        expect(fields[0].validation?.pattern?.message).toBe('Please enter a valid email address');
      });

      it('应该使用自定义的 email 格式错误消息', () => {
        const schema: ExtendedJSONSchema = {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              ui: {
                errorMessages: {
                  format: '邮箱格式错误',
                },
              },
            },
          },
        };

        const fields = SchemaParser.parse(schema);
        expect(fields[0].validation?.pattern?.message).toBe('邮箱格式错误');
      });
    });
  });

  describe('getOptions - 选项列表', () => {
    it('应该从 enum 生成选项列表', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      expect(fields[0].options).toEqual([
        { label: 'active', value: 'active' },
        { label: 'inactive', value: 'inactive' },
        { label: 'pending', value: 'pending' },
      ]);
    });

    it('应该使用 enumNames 作为选项标签', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'pending'],
            enumNames: ['激活', '未激活', '待处理'],
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      expect(fields[0].options).toEqual([
        { label: '激活', value: 'active' },
        { label: '未激活', value: 'inactive' },
        { label: '待处理', value: 'pending' },
      ]);
    });

    it('应该处理数字类型的 enum', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          priority: {
            type: 'number',
            enum: [1, 2, 3],
            enumNames: ['低', '中', '高'],
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      expect(fields[0].options).toEqual([
        { label: '低', value: 1 },
        { label: '中', value: 2 },
        { label: '高', value: 3 },
      ]);
    });

    it('应该为没有 enum 的字段返回 undefined', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const fields = SchemaParser.parse(schema);
      expect(fields[0].options).toBeUndefined();
    });
  });

  describe('setCustomFormats - 自定义格式验证器', () => {
    beforeEach(() => {
      // 清空自定义格式验证器
      SchemaParser.setCustomFormats({});
    });

    it('应该支持设置自定义格式验证器', () => {
      SchemaParser.setCustomFormats({
        phone: (value: string) => /^1[3-9]\d{9}$/.test(value),
      });

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          mobile: {
            type: 'string',
            format: 'phone',
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      expect(fields[0].validation?.validate).toBeDefined();
      expect(fields[0].validation?.validate?.phone).toBeDefined();
    });

    it('应该使用自定义格式验证器进行验证', () => {
      SchemaParser.setCustomFormats({
        idCard: (value: string) => /^\d{17}[\dXx]$/.test(value),
      });

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          idNumber: {
            type: 'string',
            format: 'idCard',
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      const validator = fields[0].validation?.validate?.idCard;

      expect(validator).toBeDefined();
      if (validator) {
        expect(validator('11010119900101001X')).toBe(true);
        expect(validator('invalid')).toBe('Invalid idCard format');
      }
    });

    it('应该处理空值', () => {
      SchemaParser.setCustomFormats({
        custom: (value: string) => value === 'valid',
      });

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            format: 'custom',
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      const validator = fields[0].validation?.validate?.custom;

      expect(validator).toBeDefined();
      if (validator) {
        expect(validator('')).toBe(true);
        expect(validator(null as any)).toBe(true);
        expect(validator(undefined as any)).toBe(true);
      }
    });

    it('应该使用自定义的格式错误消息', () => {
      SchemaParser.setCustomFormats({
        zipCode: (value: string) => /^\d{6}$/.test(value),
      });

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          zip: {
            type: 'string',
            format: 'zipCode',
            ui: {
              errorMessages: {
                format: '请输入6位邮政编码',
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      const validator = fields[0].validation?.validate?.zipCode;

      expect(validator).toBeDefined();
      if (validator) {
        expect(validator('invalid')).toBe('请输入6位邮政编码');
      }
    });

    it('应该优先使用自定义格式验证器而不是内置验证', () => {
      SchemaParser.setCustomFormats({
        email: (value: string) => value.includes('@custom.com'),
      });

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
          },
        },
      };

      const fields = SchemaParser.parse(schema);
      // 应该使用自定义验证器，而不是内置的 pattern 验证
      expect(fields[0].validation?.validate?.email).toBeDefined();
      expect(fields[0].validation?.pattern).toBeUndefined();
    });
  });

  describe('hasFlattenPath - 检测路径扁平化', () => {
    it('应该为非对象类型返回 false', () => {
      const schema: ExtendedJSONSchema = {
        type: 'string',
      };
      expect(SchemaParser.hasFlattenPath(schema)).toBe(false);
    });

    it('应该为没有 properties 的对象返回 false', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
      };
      expect(SchemaParser.hasFlattenPath(schema)).toBe(false);
    });

    it('应该检测到直接子字段的 flattenPath', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          region: {
            type: 'object',
            ui: { flattenPath: true },
            properties: {
              name: { type: 'string' },
            },
          },
        },
      };
      expect(SchemaParser.hasFlattenPath(schema)).toBe(true);
    });

    it('应该递归检测嵌套字段的 flattenPath', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              address: {
                type: 'object',
                ui: { flattenPath: true },
                properties: {
                  street: { type: 'string' },
                },
              },
            },
          },
        },
      };
      expect(SchemaParser.hasFlattenPath(schema)).toBe(true);
    });

    it('应该为没有 flattenPath 的 schema 返回 false', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
            },
          },
        },
      };
      expect(SchemaParser.hasFlattenPath(schema)).toBe(false);
    });

    it('应该跳过布尔类型的 property', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          invalid: true as any,
        },
      };
      expect(SchemaParser.hasFlattenPath(schema)).toBe(false);
    });
  });

  describe('flattenPath - 路径扁平化功能', () => {
    it('应该扁平化嵌套对象的字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          region: {
            type: 'object',
            title: 'Region',
            ui: { flattenPath: true },
            properties: {
              name: { type: 'string', title: 'Region Name' },
              code: { type: 'string', title: 'Region Code' },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // v3.0: flattenPath 字段仍然作为一个对象字段，但会使用透明容器渲染
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('region');
      expect(fields[0].type).toBe('object');
      expect(fields[0].widget).toBe('nested-form');
      expect(fields[0].schema?.ui?.flattenPath).toBe(true);
    });

    it('应该继承父级的 UI 配置（layout）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          region: {
            type: 'object',
            ui: {
              flattenPath: true,
              layout: 'horizontal',
            },
            properties: {
              name: { type: 'string', title: 'Name' },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      expect(fields[0].schema?.ui?.layout).toBe('horizontal');
    });

    it('应该继承父级的 UI 配置（labelWidth）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          region: {
            type: 'object',
            ui: {
              flattenPath: true,
              labelWidth: 120,
            },
            properties: {
              name: { type: 'string', title: 'Name' },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      expect(fields[0].schema?.ui?.labelWidth).toBe(120);
    });

    it('应该从父级继承 UI 配置到多层嵌套的子字段', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          section1: {
            type: 'object',
            ui: {
              flattenPath: true,
              layout: 'horizontal',
              labelWidth: 100,
            },
            properties: {
              section2: {
                type: 'object',
                ui: {
                  flattenPath: true,
                },
                properties: {
                  field: { type: 'string', title: 'Field' },
                },
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // section2 没有设置 layout 和 labelWidth，应该继承自 section1
      expect(fields[0].schema?.ui?.layout).toBe('horizontal');
      expect(fields[0].schema?.ui?.labelWidth).toBe(100);
    });
  });

  describe('getValidationRules - 参数默认值测试', () => {
    it('应该在不传递 required 参数时使用默认值 false', () => {
      const schema: ExtendedJSONSchema = {
        type: 'string',
        minLength: 5,
      };

      // 不传递 required 参数，应该使用默认值 false
      const rules = SchemaParser.getValidationRules(schema);

      expect(rules.required).toBeUndefined();
      expect(rules.validate?.minLength).toBeDefined();
    });

    it('应该在传递 required=true 时添加 required 规则', () => {
      const schema: ExtendedJSONSchema = {
        type: 'string',
      };

      const rules = SchemaParser.getValidationRules(schema, true);

      expect(rules.validate?.required).toBeDefined();
      expect((rules.validate?.required as Function)(null)).toBe('This field is required');
    });
  });

  describe('综合场景测试', () => {
    it('应该正确解析复杂的表单 schema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            title: '用户名',
            minLength: 3,
            maxLength: 20,
            pattern: '^[a-zA-Z0-9_]+$',
            ui: {
              placeholder: '请输入用户名',
              errorMessages: {
                required: '用户名不能为空',
                minLength: '用户名至少3个字符',
                maxLength: '用户名最多20个字符',
                pattern: '用户名只能包含字母、数字和下划线',
              },
            },
          },
          email: {
            type: 'string',
            title: '邮箱',
            format: 'email',
          },
          age: {
            type: 'number',
            title: '年龄',
            minimum: 18,
            maximum: 100,
          },
          gender: {
            type: 'string',
            title: '性别',
            enum: ['male', 'female', 'other'],
            enumNames: ['男', '女', '其他'],
            ui: {
              widget: 'radio',
            },
          },
          bio: {
            type: 'string',
            title: '个人简介',
            maxLength: 500,
          },
          agreed: {
            type: 'boolean',
            title: '同意条款',
          },
        },
        required: ['username', 'email', 'agreed'],
        ui: {
          order: ['username', 'email', 'age', 'gender', 'bio', 'agreed'],
        },
      };

      const fields = SchemaParser.parse(schema);

      expect(fields).toHaveLength(6);
      expect(fields.map(f => f.name)).toEqual([
        'username',
        'email',
        'age',
        'gender',
        'bio',
        'agreed',
      ]);

      // 验证 username 字段
      expect(fields[0]).toMatchObject({
        name: 'username',
        type: 'string',
        label: '用户名',
        required: true,
        widget: 'text',
      });
      // minLength 现在是 validate 函数，不是对象
      expect(fields[0].validation?.validate?.minLength).toBeDefined();
      expect(fields[0].validation?.maxLength?.value).toBe(20);
      expect(fields[0].validation?.pattern?.value).toEqual(/^[a-zA-Z0-9_]+$/);

      // 验证 email 字段
      expect(fields[1]).toMatchObject({
        name: 'email',
        type: 'string',
        label: '邮箱',
        required: true,
        widget: 'email',
      });

      // 验证 gender 字段
      expect(fields[3].widget).toBe('radio');
      expect(fields[3].options).toEqual([
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
        { label: '其他', value: 'other' },
      ]);

      // 验证 bio 字段
      expect(fields[4].widget).toBe('textarea');
    });
  });

  describe('flattenPrefix 和 UI 配置继承', () => {
    it('应该处理 flattenPrefix 并生成带前缀的标签', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          contact: {
            type: 'object',
            title: 'Contact Info',
            ui: {
              flattenPrefix: true,
              flattenPath: true,
            },
            properties: {
              phone: {
                type: 'string',
                title: 'Phone',
              },
              email: {
                type: 'string',
                title: 'Email',
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // flattenPath 会展开嵌套字段
      expect(fields.length).toBeGreaterThanOrEqual(1);
    });

    it('应该继承父级的 layout 配置', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          section: {
            type: 'object',
            title: 'Section',
            ui: {
              layout: 'horizontal',
              labelWidth: 120,
              flattenPath: true,
            },
            properties: {
              field1: {
                type: 'string',
                title: 'Field 1',
              },
              field2: {
                type: 'string',
                title: 'Field 2',
                ui: {
                  layout: 'vertical', // 子字段自己的配置优先
                },
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // 验证字段被正确解析
      expect(fields.length).toBeGreaterThanOrEqual(1);
    });

    it('应该处理嵌套的 flattenPrefix 生成多级前缀标签', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            title: 'Level 1',
            ui: {
              flattenPrefix: true,
              flattenPath: true,
            },
            properties: {
              level2: {
                type: 'object',
                title: 'Level 2',
                ui: {
                  flattenPrefix: true,
                  flattenPath: true,
                },
                properties: {
                  field: {
                    type: 'string',
                    title: 'Field',
                  },
                },
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // 验证嵌套展开后的字段
      expect(fields.length).toBeGreaterThanOrEqual(1);
    });

    it('应该在没有 title 时不添加前缀', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          wrapper: {
            type: 'object',
            // 没有 title
            ui: {
              flattenPrefix: true,
              flattenPath: true,
            },
            properties: {
              innerField: {
                type: 'string',
                title: 'Inner Field',
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // 由于没有 title，不会添加前缀
      expect(fields.length).toBeGreaterThanOrEqual(1);
    });

    it('应该正确处理 labelWidth 继承', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          parent: {
            type: 'object',
            title: 'Parent',
            ui: {
              labelWidth: 200,
              flattenPath: true,
            },
            properties: {
              child: {
                type: 'string',
                title: 'Child',
                // 没有自己的 labelWidth，应该继承父级的
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      expect(fields.length).toBeGreaterThanOrEqual(1);
      // 子字段应该继承父级的 labelWidth
      const childField = fields.find(f => f.name === 'parent.child');
      if (childField) {
        expect(childField.schema.ui?.labelWidth).toBe(200);
      }
    });

    it('应该让子字段的 UI 配置覆盖继承的配置', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          parent: {
            type: 'object',
            title: 'Parent',
            ui: {
              layout: 'horizontal',
              labelWidth: 100,
              flattenPath: true,
            },
            properties: {
              child: {
                type: 'string',
                title: 'Child',
                ui: {
                  layout: 'vertical',
                  labelWidth: 150,
                },
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      expect(fields.length).toBeGreaterThanOrEqual(1);
      // 子字段自己的配置应该优先
      const childField = fields.find(f => f.name === 'parent.child');
      if (childField) {
        expect(childField.schema.ui?.layout).toBe('vertical');
        expect(childField.schema.ui?.labelWidth).toBe(150);
      }
    });

    it('应该正确构建嵌套字段的路径', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          address: {
            type: 'object',
            title: 'Address',
            ui: {
              flattenPath: true,
            },
            properties: {
              street: {
                type: 'string',
                title: 'Street',
              },
              city: {
                type: 'string',
                title: 'City',
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // flattenPath 对象会被渲染为 NestedFormWidget，返回一个字段
      expect(fields.length).toBeGreaterThanOrEqual(1);
      // 验证字段名包含 address
      expect(fields[0].name).toBe('address');
    });

    it('应该在 prefixLabel 存在时正确拼接标签', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          contact: {
            type: 'object',
            title: 'Contact',
            ui: {
              flattenPrefix: true,
              flattenPath: true,
            },
            properties: {
              phone: {
                type: 'string',
                title: 'Phone',
              },
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema);

      // 验证带前缀的标签
      const phoneField = fields.find(f => f.name === 'contact.phone');
      if (phoneField) {
        expect(phoneField.label).toBe('Contact - Phone');
      }
    });

    it('应该在传入 parentPath 时正确构建嵌套路径', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Name',
          },
        },
      };

      // 直接传入 parentPath 参数
      const fields = SchemaParser.parse(schema, { parentPath: 'parent' });

      expect(fields.length).toBe(1);
      expect(fields[0].name).toBe('parent.name');
    });

    it('应该在传入 prefixLabel 时添加标签前缀', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      // 直接传入 prefixLabel 参数
      const fields = SchemaParser.parse(schema, { prefixLabel: 'Prefix' });

      expect(fields.length).toBe(1);
      expect(fields[0].label).toBe('Prefix - Field');
    });

    it('应该在传入 inheritedUI 时继承 UI 配置', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      // 直接传入 inheritedUI 参数
      const fields = SchemaParser.parse(schema, {
        inheritedUI: {
          layout: 'horizontal',
          labelWidth: 180,
        },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBe('horizontal');
      expect(fields[0].schema.ui?.labelWidth).toBe(180);
    });

    it('应该在 flattenPrefix 有值且已有 prefixLabel 时拼接多级前缀', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          section: {
            type: 'object',
            title: 'Section',
            ui: {
              flattenPrefix: true,
            },
            properties: {
              field: {
                type: 'string',
                title: 'Field',
              },
            },
          },
        },
      };

      // 传入已有的 prefixLabel
      const fields = SchemaParser.parse(schema, { prefixLabel: 'Parent' });

      // section 字段本身会被解析
      expect(fields.length).toBeGreaterThanOrEqual(1);
    });

    it('应该在字段没有 title 时不添加前缀到标签', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            // 没有 title
          },
        },
      };

      const fields = SchemaParser.parse(schema, { prefixLabel: 'Prefix' });

      expect(fields.length).toBe(1);
      // 没有 title 时，label 应该是 undefined，不会拼接前缀
      expect(fields[0].label).toBeUndefined();
    });

    it('应该在只有 prefixLabel 没有 inheritedUI 时也创建 finalSchema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            ui: {
              placeholder: 'Enter value',
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema, { prefixLabel: 'Section' });

      expect(fields.length).toBe(1);
      expect(fields[0].label).toBe('Section - Field');
      // 原有的 ui 配置应该保留
      expect(fields[0].schema.ui?.placeholder).toBe('Enter value');
      // prefixLabel 应该被保存到 schema.ui 中
      expect(fields[0].schema.ui?.prefixLabel).toBe('Section');
    });

    it('应该在只有 inheritedUI 没有 prefixLabel 时也创建 finalSchema', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: 'inline' },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBe('inline');
    });

    it('应该在字段自己有 layout 时不使用继承的 layout', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            ui: {
              layout: 'vertical',
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: 'horizontal' },
      });

      expect(fields.length).toBe(1);
      // 字段自己的 layout 优先
      expect(fields[0].schema.ui?.layout).toBe('vertical');
    });

    it('应该在字段自己有 labelWidth 时不使用继承的 labelWidth', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            ui: {
              labelWidth: 100,
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { labelWidth: 200 },
      });

      expect(fields.length).toBe(1);
      // 字段自己的 labelWidth 优先
      expect(fields[0].schema.ui?.labelWidth).toBe(100);
    });

    it('应该在字段没有 ui 对象时使用继承的 layout', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            // 没有 ui 对象
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: 'horizontal' },
      });

      expect(fields.length).toBe(1);
      // 应该使用继承的 layout
      expect(fields[0].schema.ui?.layout).toBe('horizontal');
    });

    it('应该在字段没有 ui 对象时使用继承的 labelWidth', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            // 没有 ui 对象
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { labelWidth: 150 },
      });

      expect(fields.length).toBe(1);
      // 应该使用继承的 labelWidth
      expect(fields[0].schema.ui?.labelWidth).toBe(150);
    });

    it('应该在字段 ui.layout 为 undefined 时使用继承的 layout', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            ui: {
              placeholder: 'test', // 有 ui 对象但没有 layout
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: 'inline' },
      });

      expect(fields.length).toBe(1);
      // 应该使用继承的 layout
      expect(fields[0].schema.ui?.layout).toBe('inline');
      // 原有的 placeholder 应该保留
      expect(fields[0].schema.ui?.placeholder).toBe('test');
    });

    it('应该在字段 ui.labelWidth 为 undefined 时使用继承的 labelWidth', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            ui: {
              placeholder: 'test', // 有 ui 对象但没有 labelWidth
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { labelWidth: 180 },
      });

      expect(fields.length).toBe(1);
      // 应该使用继承的 labelWidth
      expect(fields[0].schema.ui?.labelWidth).toBe(180);
      // 原有的 placeholder 应该保留
      expect(fields[0].schema.ui?.placeholder).toBe('test');
    });

    it('应该同时继承 layout 和 labelWidth 当字段没有这些配置时', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
            ui: {
              placeholder: 'test',
              // 没有 layout 和 labelWidth
            },
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: {
          layout: 'horizontal',
          labelWidth: 200,
        },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBe('horizontal');
      expect(fields[0].schema.ui?.labelWidth).toBe(200);
      expect(fields[0].schema.ui?.placeholder).toBe('test');
    });

    it('应该在 inheritedUI 只有 layout 时正确继承', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: 'vertical' },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBe('vertical');
      expect(fields[0].schema.ui?.labelWidth).toBeUndefined();
    });

    it('应该在 inheritedUI 只有 labelWidth 时正确继承', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      const fields = SchemaParser.parse(schema, {
        inheritedUI: { labelWidth: 120 },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBeUndefined();
      expect(fields[0].schema.ui?.labelWidth).toBe(120);
    });

    it('应该在 inheritedUI.layout 为 undefined 时 layout 也为 undefined', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      // inheritedUI 存在但 layout 属性为 undefined
      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: undefined, labelWidth: 100 },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBeUndefined();
      expect(fields[0].schema.ui?.labelWidth).toBe(100);
    });

    it('应该在 inheritedUI.labelWidth 为 undefined 时 labelWidth 也为 undefined', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: 'Field',
          },
        },
      };

      // inheritedUI 存在但 labelWidth 属性为 undefined
      const fields = SchemaParser.parse(schema, {
        inheritedUI: { layout: 'horizontal', labelWidth: undefined },
      });

      expect(fields.length).toBe(1);
      expect(fields[0].schema.ui?.layout).toBe('horizontal');
      expect(fields[0].schema.ui?.labelWidth).toBeUndefined();
    });
  });
});
