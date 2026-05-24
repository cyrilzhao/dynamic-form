import {
  findArrayInPath,
  isArrayElementPath,
  extractArrayInfo,
  parseJsonPointer,
  resolveDependencyPath,
  resolveArrayElementLinkage,
} from '../arrayLinkageHelper';
import type { ExtendedJSONSchema } from '../../types/schema';
import type { LinkageConfig } from '../../types/linkage';

describe('arrayLinkageHelper', () => {
  describe('isArrayElementPath', () => {
    it('应该识别包含数字索引的路径', () => {
      expect(isArrayElementPath('contacts.0.name')).toBe(true);
      expect(isArrayElementPath('departments.0.employees.1.name')).toBe(true);
    });

    it('应该识别包含标准 . 分隔符和数字索引的路径 (v3.0)', () => {
      expect(isArrayElementPath('group.category.contacts.0.name')).toBe(true);
      expect(isArrayElementPath('group.category.0.field')).toBe(true);
    });

    it('应该识别不包含数字索引的路径', () => {
      expect(isArrayElementPath('contacts.name')).toBe(false);
      expect(isArrayElementPath('group.category.contacts.name')).toBe(false);
      expect(isArrayElementPath('simpleField')).toBe(false);
    });
  });

  describe('parseJsonPointer', () => {
    it('应该解析简单的 JSON Pointer', () => {
      const result = parseJsonPointer('#/properties/name');
      expect(result).toBe('name');
    });

    it('应该解析嵌套对象的 JSON Pointer', () => {
      const result = parseJsonPointer('#/properties/user/properties/email');
      expect(result).toBe('user.email');
    });

    it('应该解析数组元素的 JSON Pointer', () => {
      const result = parseJsonPointer('#/properties/contacts/items/properties/type');
      expect(result).toBe('contacts.type');
    });

    it('应该解析嵌套数组的 JSON Pointer', () => {
      const result = parseJsonPointer(
        '#/properties/departments/items/properties/employees/items/properties/name'
      );
      expect(result).toBe('departments.employees.name');
    });

    it('应该对无效的 JSON Pointer 抛出错误', () => {
      expect(() => parseJsonPointer('invalid/pointer')).toThrow('无效的 JSON Pointer');
      expect(() => parseJsonPointer('/properties/name')).toThrow('无效的 JSON Pointer');
    });
  });

  describe('resolveDependencyPath', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              companyName: { type: 'string' },
            },
          },
        },
        departments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              employees: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    techStack: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    it('应该解析相对路径（同级字段）', () => {
      const result = resolveDependencyPath({
        depPath: './type',
        currentPath: 'contacts.0.companyName',
      });

      expect(result).toBe('contacts.0.type');
    });

    it('应该解析 JSON Pointer（子数组到父数组）', () => {
      const result = resolveDependencyPath({
        depPath: '#/properties/departments/items/properties/type',
        currentPath: 'departments.0.employees.1.techStack',
        schema,
      });

      expect(result).toBe('departments.0.type');
    });

    it('应该直接返回运行时绝对路径', () => {
      const result = resolveDependencyPath({
        depPath: 'contacts.0.type',
        currentPath: 'contacts.0.companyName',
      });

      expect(result).toBe('contacts.0.type');
    });

    it('应该解析 JSON Pointer（父数组到子数组）', () => {
      const result = resolveDependencyPath({
        depPath: '#/properties/departments/items/properties/employees',
        currentPath: 'departments.0.totalSalary',
        schema,
      });

      expect(result).toBe('departments.0.employees');
    });

    it('应该解析 JSON Pointer（顶层字段，不需要索引匹配）', () => {
      const result = resolveDependencyPath({
        depPath: '#/properties/globalSetting',
        currentPath: 'departments.0.name',
        schema,
      });

      expect(result).toBe('globalSetting');
    });

    it('应该解析 JSON Pointer（same-level 关系）', () => {
      const result = resolveDependencyPath({
        depPath: '#/properties/departments/items/properties/type',
        currentPath: 'departments.0.name',
        schema,
      });

      // same-level 关系会插入当前元素的索引
      expect(result).toBe('departments.0.type');
    });

    it('应该处理子数组到父数组的依赖（无索引的情况）', () => {
      const result = resolveDependencyPath({
        depPath: '#/properties/departments/items/properties/type',
        currentPath: 'departments.name',
        schema,
      });

      // 当前路径没有索引时，返回逻辑路径
      expect(result).toBe('departments.type');
    });

    it('应该解析 JSON Pointer（父数组到子数组，无索引的情况）', () => {
      const result = resolveDependencyPath({
        depPath: '#/properties/departments/items/properties/employees',
        currentPath: 'departments.name',
        schema,
      });

      // 当前路径没有索引时，返回逻辑路径
      expect(result).toBe('departments.employees');
    });

    it('应该解析 JSON Pointer（父数组到子数组，有索引的情况）', () => {
      const schemaWithNested: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          departments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                totalSalary: { type: 'number' },
                employees: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      salary: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = resolveDependencyPath({
        depPath: '#/properties/departments/items/properties/employees',
        currentPath: 'departments.0.totalSalary',
        schema: schemaWithNested,
      });

      expect(result).toBe('departments.0.employees');
    });

    it('应该处理父数组到子数组的关系（覆盖第 117 行和 173-192 行）', () => {
      // 构造真正的 parent-to-child 关系：
      // depSegments.length > currentSegments.length && commonPrefix.length > 0
      const schemaParentToChild: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nested: {
                  type: 'object',
                  properties: {
                    detail: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      // depPath 解析后: 'data.nested.detail' (3 段)
      // currentPath: 'data.0' (2 段)
      // 3 > 2 且有共同前缀 'data'，所以是 parent-to-child
      const result = resolveDependencyPath({
        depPath: '#/properties/data/items/properties/nested/properties/detail',
        currentPath: 'data.0',
        schema: schemaParentToChild,
      });

      // resolveParentToChild: ['data', 'nested'] + '0' + 'detail' = 'data.nested.0.detail'
      expect(result).toBe('data.nested.0.detail');
    });

    it('应该处理子数组到父数组的关系且当前路径无索引时返回逻辑路径（覆盖第 145 行）', () => {
      // 构造 child-to-parent 关系但当前路径无索引
      // currentSegments.length > depSegments.length && commonPrefix.length > 0
      // depPath 逻辑路径: 'data.type' (2 段)
      // currentPath: 'data.nested.value' (3 段，无索引)
      const schemaNoIndex: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                nested: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const result = resolveDependencyPath({
        depPath: '#/properties/data/items/properties/type',
        currentPath: 'data.nested.value', // 3 段，无索引
        schema: schemaNoIndex,
      });

      // 无索引时直接返回逻辑路径
      expect(result).toBe('data.type');
    });

    it('应该处理父数组到子数组的关系且当前路径无索引时返回逻辑路径（覆盖第 180 行）', () => {
      // 构造 parent-to-child 关系但当前路径无索引
      const schemaParentNoIndex: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nested: {
                  type: 'object',
                  properties: {
                    detail: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      // depPath 逻辑路径: 'data.nested.detail' (3 段)
      // currentPath: 'data' (1 段，无索引)
      const result = resolveDependencyPath({
        depPath: '#/properties/data/items/properties/nested/properties/detail',
        currentPath: 'data', // 1 段，无索引
        schema: schemaParentNoIndex,
      });

      // 无索引时直接返回逻辑路径
      expect(result).toBe('data.nested.detail');
    });

    it('应该处理同级数组元素关系（覆盖第 226-228 行 default 分支）', () => {
      // 当 depLogicalPath 和 currentPath 没有共同前缀时，返回 other 类型
      // parseJsonPointer('#/properties/items/items/properties/name') => 'name'
      // 'name' 和 'items.0.value' 没有共同前缀，所以返回 other 类型
      const schemaWithSameLevel: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
              },
            },
          },
        },
      };

      const result = resolveDependencyPath({
        depPath: '#/properties/items/items/properties/name',
        currentPath: 'items.0.value',
        schema: schemaWithSameLevel,
      });

      // other 类型直接返回逻辑路径
      expect(result).toBe('name');
    });

    it('应该处理 same-level 类型的路径关系（覆盖第 228 行）', () => {
      // 构造 same-level 关系：depSegments.length === currentSegments.length && commonPrefix.length > 0
      // 但不是 child-to-parent 也不是 parent-to-child
      // 这需要两个路径长度相同且有共同前缀
      const schemaForSameLevel: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fieldA: { type: 'string' },
                fieldB: { type: 'string' },
              },
            },
          },
        },
      };

      // depPath 解析后: 'data.fieldA' (2 段)
      // currentPath: 'data.fieldB' (2 段，无索引)
      // 长度相同，有共同前缀 'data'，所以是 same-level
      // 但由于 currentPath 没有索引，会返回逻辑路径
      const result = resolveDependencyPath({
        depPath: '#/properties/data/items/properties/fieldA',
        currentPath: 'data.fieldB',
        schema: schemaForSameLevel,
      });

      // same-level 类型直接返回逻辑路径
      expect(result).toBe('data.fieldA');
    });
  });

  describe('resolveArrayElementLinkage', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              companyName: { type: 'string' },
            },
          },
        },
      },
    };

    it('应该解析 dependencies 中的相对路径', () => {
      const linkage: LinkageConfig = {
        type: 'visibility',
        dependencies: ['./type'],
        when: {
          field: './type',
          operator: '==',
          value: 'company',
        },
        fulfill: { state: { visible: true } },
      };

      const result = resolveArrayElementLinkage(linkage, 'contacts.0.companyName', schema);

      expect(result.dependencies).toEqual(['contacts.0.type']);
      expect(result.when).toEqual({
        field: 'contacts.0.type',
        operator: '==',
        value: 'company',
      });
    });

    it('应该解析 when 条件中的 and/or 嵌套路径', () => {
      const linkage: LinkageConfig = {
        type: 'visibility',
        dependencies: [],
        when: {
          and: [
            { field: './type', operator: '==', value: 'company' },
            { field: './companyName', operator: 'isNotEmpty' },
          ],
        },
        fulfill: { state: { visible: true } },
      };

      const result = resolveArrayElementLinkage(linkage, 'contacts.0.companyName', schema);

      expect(result.when).toEqual({
        and: [
          { field: 'contacts.0.type', operator: '==', value: 'company' },
          { field: 'contacts.0.companyName', operator: 'isNotEmpty' },
        ],
      });
    });

    it('应该解析 when 条件中的 or 嵌套路径', () => {
      const linkage: LinkageConfig = {
        type: 'visibility',
        dependencies: [],
        when: {
          or: [
            { field: './type', operator: '==', value: 'company' },
            { field: './type', operator: '==', value: 'personal' },
          ],
        },
        fulfill: { state: { visible: true } },
      };

      const result = resolveArrayElementLinkage(linkage, 'contacts.0.companyName', schema);

      expect(result.when).toEqual({
        or: [
          { field: 'contacts.0.type', operator: '==', value: 'company' },
          { field: 'contacts.0.type', operator: '==', value: 'personal' },
        ],
      });
    });

    it('应该在没有 schema 时解析相对路径', () => {
      const linkage: LinkageConfig = {
        type: 'visibility',
        dependencies: ['./type'],
        when: {
          field: './type',
          operator: '==',
          value: 'company',
        },
        fulfill: { state: { visible: true } },
      };

      const result = resolveArrayElementLinkage(linkage, 'contacts.0.companyName');

      expect(result.dependencies).toEqual(['contacts.0.type']);
      expect(result.when).toEqual({
        field: 'contacts.0.type',
        operator: '==',
        value: 'company',
      });
    });
  });

  describe('extractArrayInfo', () => {
    it('应该从简单数组路径中提取信息', () => {
      const result = extractArrayInfo('contacts.0.name');

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('contacts');
      expect(result?.index).toBe(0);
      expect(result?.fieldPath).toBe('name');
    });

    it('应该从包含标准 . 分隔符的路径中提取信息 (v3.0)', () => {
      const result = extractArrayInfo('group.category.contacts.0.name');

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('group.category.contacts');
      expect(result?.index).toBe(0);
      expect(result?.fieldPath).toBe('name');
    });

    it('应该正确处理多层嵌套路径 (v3.0)', () => {
      const result = extractArrayInfo('group.category.contacts.items.0.name');

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('group.category.contacts.items');
      expect(result?.index).toBe(0);
      expect(result?.fieldPath).toBe('name');
    });

    it('应该正确处理索引前是标准 . 分隔符的路径 (v3.0)', () => {
      const result = extractArrayInfo('group.category.0.name');

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('group.category');
      expect(result?.index).toBe(0);
      expect(result?.fieldPath).toBe('name');
    });

    it('应该从嵌套数组路径中提取第一个数组信息', () => {
      const result = extractArrayInfo('departments.0.employees.1.techStack');

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('departments');
      expect(result?.index).toBe(0);
      expect(result?.fieldPath).toBe('employees.1.techStack');
    });

    it('应该对不包含索引的路径返回 null', () => {
      const result = extractArrayInfo('contacts.name');

      expect(result).toBeNull();
    });
  });

  describe('findArrayInPath', () => {
    it('应该正确识别数组字段路径', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                companyName: { type: 'string' },
              },
            },
          },
        },
      };

      const result = findArrayInPath('contacts.companyName', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('contacts');
      expect(result?.fieldPathInArray).toBe('companyName');
    });

    it('应该识别嵌套数组路径', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          departments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                employees: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = findArrayInPath('departments.employees.name', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('departments');
      expect(result?.fieldPathInArray).toBe('employees.name');
    });

    it('应该对非数组路径返回 null', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
      };

      const result = findArrayInPath('name', schema);

      expect(result).toBeNull();
    });

    it('应该识别包含 flattenPath 的数组路径（v3.0 - 使用标准 . 分隔符）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          group: {
            type: 'object',
            ui: { flattenPath: true },
            properties: {
              category: {
                type: 'object',
                ui: { flattenPath: true },
                properties: {
                  contacts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = findArrayInPath('group.category.contacts.name', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('group.category.contacts');
      expect(result?.fieldPathInArray).toBe('name');
    });

    it('应该对没有 properties 的 schema 返回 null', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
      };

      const result = findArrayInPath('contacts.name', schema);

      expect(result).toBeNull();
    });

    it('应该识别嵌套对象中的数组路径（非 flattenPath）', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          company: {
            type: 'object',
            properties: {
              departments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const result = findArrayInPath('company.departments.name', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('company.departments');
      expect(result?.fieldPathInArray).toBe('name');
    });

    it('应该识别数组元素内部使用标准 . 分隔符的路径 (v3.0)', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                address: {
                  type: 'object',
                  ui: { flattenPath: true },
                  properties: {
                    city: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      };

      const result = findArrayInPath('contacts.address.city', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('contacts');
      expect(result?.fieldPathInArray).toBe('address.city');
    });

    it('应该递归处理数组元素内部的嵌套数组', () => {
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          departments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                employees: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      skills: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = findArrayInPath('departments.employees.skills.name', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('departments');
      expect(result?.fieldPathInArray).toBe('employees.skills.name');
    });

    it('应该递归处理数组元素内部的嵌套数组并返回结果（覆盖第 395-398 行）', () => {
      // 构造场景：targetPath 等于数组字段名，触发第 394-400 行的递归
      // 当 targetPath === newLogicalPath 时，第 381 行检查失败
      // 然后进入第 394-400 行递归进入数组元素内部
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          container: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nested: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // targetPath = 'container' 等于数组字段名
      // 第 381 行检查失败（'container' 不以 'container.' 开头）
      // 进入第 394-400 行递归
      const result = findArrayInPath('container', schema);

      // 由于 targetPath 就是数组本身，没有内部字段，返回 null
      expect(result).toBeNull();
    });

    it('应该跳过 boolean 类型的 fieldSchema（覆盖第 365 行）', () => {
      // JSON Schema 允许 properties 中的值为 boolean
      // true 表示允许任何值，false 表示不允许该属性
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          allowed: true as any, // boolean schema
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
          },
        },
      };

      const result = findArrayInPath('contacts.name', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('contacts');
      expect(result?.fieldPathInArray).toBe('name');
    });

    it('应该在数组 items 内部递归找到嵌套数组并返回结果（覆盖第 396-398 行）', () => {
      // 构造场景：在数组的 items 内部有嵌套数组，且能找到匹配的路径
      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          outer: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                inner: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      // 查找 'outer.inner.value'，应该在 outer 的 items 内部找到 inner 数组
      const result = findArrayInPath('outer.inner.value', schema);

      expect(result).not.toBeNull();
      expect(result?.arrayPath).toBe('outer');
      expect(result?.fieldPathInArray).toBe('inner.value');
    });

  });

  describe('resolveArrayElementLinkage 边界情况', () => {
    it('应该处理 field 不以 ./ 开头且没有 schema 的情况（覆盖第 311 行 false 分支）', () => {
      const linkage: LinkageConfig = {
        type: 'visibility',
        dependencies: [],
        when: {
          field: 'globalField', // 不以 ./ 开头的绝对路径
          operator: '==',
          value: 'test',
        },
        fulfill: { state: { visible: true } },
      };

      // 不传 schema
      const result = resolveArrayElementLinkage(linkage, 'contacts.0.companyName');

      // field 应该保持不变（既不是相对路径，也没有 schema 来解析）
      expect(result.when).toEqual({
        field: 'globalField',
        operator: '==',
        value: 'test',
      });
    });
  });
});
