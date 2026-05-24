import { renderHook, act, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { useArrayLinkageManager } from '../useArrayLinkageManager';
import type { LinkageConfig } from '../../types/linkage';
import type { ExtendedJSONSchema } from '../../types/schema';

describe('useArrayLinkageManager', () => {
  describe('基础功能', () => {
    it('应该在没有联动配置时返回空状态', async () => {
      const { result } = renderHook(() => {
        const form = useForm({ defaultValues: { name: 'test' } });
        return useArrayLinkageManager({
          form,
          baseLinkages: {},
        });
      });

      await waitFor(() => {
        expect(result.current.linkageStates).toEqual({});
      });
    });

    it('应该处理非数组字段的联动', async () => {
      const baseLinkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: 'visibility',
            dependencies: ['userType'],
            when: { field: 'userType', operator: '==', value: 'enterprise' },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          },
        ],
      };

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          userType: { type: 'string' },
          companyName: { type: 'string' },
        },
      };

      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: { userType: 'enterprise', companyName: '' },
        });
        return useArrayLinkageManager({ form, baseLinkages, schema });
      });

      await waitFor(() => {
        console.info('cyril result: ', result);
        expect(result.current.linkageStates.companyName?.visible).toBe(true);
      });
    });
  });

  describe('数组元素联动', () => {
    it('应该为数组元素生成动态联动配置', async () => {
      const baseLinkages: Record<string, LinkageConfig[]> = {
        'contacts.companyName': [
          {
            type: 'visibility',
            dependencies: ['./type'],
            when: { field: './type', operator: '==', value: 'business' },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          },
        ],
      };

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

      let formRef: any;
      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: {
            contacts: [
              { type: 'business', companyName: '' },
              { type: 'personal', companyName: '' },
            ],
          },
        });
        formRef = form;
        return useArrayLinkageManager({ form, baseLinkages, schema });
      });

      // 触发表单变化以激活 watch 回调
      await act(async () => {
        formRef.setValue('contacts.0.type', 'business');
      });

      await waitFor(() => {
        // 第一个元素应该显示（type === 'business'）
        expect(result.current.linkageStates['contacts.0.companyName']?.visible).toBe(true);
        // 第二个元素应该隐藏（type === 'personal'）
        expect(result.current.linkageStates['contacts.1.companyName']?.visible).toBe(false);
      });
    });

    it('应该处理已实例化的数组元素路径', async () => {
      const baseLinkages: Record<string, LinkageConfig[]> = {
        'contacts.0.companyName': [
          {
            type: 'visibility',
            dependencies: ['contacts.0.type'],
            when: { field: 'contacts.0.type', operator: '==', value: 'business' },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          },
        ],
      };

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

      let formRef: any;
      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: {
            contacts: [{ type: 'business', companyName: '' }],
          },
        });
        formRef = form;
        return useArrayLinkageManager({ form, baseLinkages, schema });
      });

      // 触发表单变化以激活 watch 回调
      await act(async () => {
        formRef.setValue('contacts.0.type', 'business');
      });

      await waitFor(() => {
        expect(result.current.linkageStates['contacts.0.companyName']?.visible).toBe(true);
      });
    });

    it('应该处理非数组值的情况', async () => {
      const baseLinkages: Record<string, LinkageConfig[]> = {
        'contacts.companyName': [
          {
            type: 'visibility',
            dependencies: ['./type'],
            when: { field: './type', operator: '==', value: 'business' },
            fulfill: { state: { visible: true } },
          },
        ],
      };

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

      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: {
            contacts: null, // 非数组值
          },
        });
        return useArrayLinkageManager({ form, baseLinkages, schema });
      });

      await waitFor(() => {
        // 不应该生成任何数组元素的联动
        expect(result.current.linkageStates['contacts.0.companyName']).toBeUndefined();
      });
    });

    it('应该处理 schema 中找不到数组的路径', async () => {
      // 这个测试覆盖第 77-78 行：当 findArrayInPath 返回 null 时
      const baseLinkages: Record<string, LinkageConfig[]> = {
        'nonArrayField.subField': [
          {
            type: 'visibility',
            dependencies: ['trigger'],
            when: { field: 'trigger', operator: '==', value: 'show' },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          },
        ],
      };

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          trigger: { type: 'string' },
          nonArrayField: {
            type: 'object',
            properties: {
              subField: { type: 'string' },
            },
          },
        },
      };

      let formRef: any;
      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: {
            trigger: 'show',
            nonArrayField: { subField: '' },
          },
        });
        formRef = form;
        return useArrayLinkageManager({ form, baseLinkages, schema });
      });

      // 触发表单变化以激活 watch 回调
      await act(async () => {
        formRef.setValue('trigger', 'show');
      });

      await waitFor(() => {
        // 非数组字段的联动应该被直接添加
        expect(result.current.linkageStates['nonArrayField.subField']?.visible).toBe(true);
      });
    });

    it('应该处理数组值为 undefined 的情况', async () => {
      // 这个测试覆盖第 87 行：当数组值不是数组时
      const baseLinkages: Record<string, LinkageConfig[]> = {
        'items.name': [
          {
            type: 'visibility',
            dependencies: ['./type'],
            fulfill: { state: { visible: true } },
          },
        ],
      };

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      };

      let formRef: any;
      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: {
            items: undefined, // undefined 值
          },
        });
        formRef = form;
        return useArrayLinkageManager({ form, baseLinkages, schema });
      });

      // 触发表单变化
      await act(async () => {
        formRef.setValue('items', 'not-an-array');
      });

      await waitFor(() => {
        // 不应该生成数组元素的联动
        expect(result.current.linkageStates['items.0.name']).toBeUndefined();
      });
    });
  });

  describe('循环依赖检测', () => {
    it('应该检测并警告循环依赖', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const baseLinkages: Record<string, LinkageConfig[]> = {
        fieldA: [{ type: 'value', dependencies: ['fieldB'], fulfill: { value: 1 } }],
        fieldB: [{ type: 'value', dependencies: ['fieldA'], fulfill: { value: 2 } }],
      };

      renderHook(() => {
        const form = useForm({ defaultValues: { fieldA: 0, fieldB: 0 } });
        return useArrayLinkageManager({ form, baseLinkages });
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('检测到循环依赖'),
          expect.any(String)
        );
      });

      consoleSpy.mockRestore();
    });

    it('应该调用 onCycleDetected 回调', async () => {
      const onCycleDetected = jest.fn();
      jest.spyOn(console, 'error').mockImplementation();

      const baseLinkages: Record<string, LinkageConfig[]> = {
        a: [{ type: 'value', dependencies: ['b'], fulfill: { value: 1 } }],
        b: [{ type: 'value', dependencies: ['a'], fulfill: { value: 2 } }],
      };

      renderHook(() => {
        const form = useForm({ defaultValues: { a: 0, b: 0 } });
        return useArrayLinkageManager({ form, baseLinkages, onCycleDetected });
      });

      await waitFor(() => {
        expect(onCycleDetected).toHaveBeenCalled();
      });
    });

    it('应该在 throwOnCycle 为 true 时抛出错误', async () => {
      jest.spyOn(console, 'error').mockImplementation();

      const baseLinkages: Record<string, LinkageConfig[]> = {
        x: [{ type: 'value', dependencies: ['y'], fulfill: { value: 1 } }],
        y: [{ type: 'value', dependencies: ['x'], fulfill: { value: 2 } }],
      };

      expect(() => {
        renderHook(() => {
          const form = useForm({ defaultValues: { x: 0, y: 0 } });
          return useArrayLinkageManager({ form, baseLinkages, throwOnCycle: true });
        });
      }).toThrow('循环依赖');
    });
  });

  describe('refresh 功能', () => {
    it('应该提供 refresh 方法重新计算联动', async () => {
      const baseLinkages: Record<string, LinkageConfig[]> = {
        output: [
          {
            type: 'value',
            dependencies: ['input'],
            fulfill: { function: 'calculate' },
          },
        ],
      };

      let multiplier = 2;
      const linkageFunctions = {
        calculate: (formData: Record<string, any>) => formData.input * multiplier,
      };

      const { result } = renderHook(() => {
        const form = useForm({ defaultValues: { input: 5, output: 0 } });
        return useArrayLinkageManager({ form, baseLinkages, linkageFunctions });
      });

      await waitFor(() => {
        expect(result.current.linkageStates.output?.value).toBe(10);
      });

      // 修改外部变量并刷新
      multiplier = 3;
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.linkageStates.output?.value).toBe(15);
      });
    });
  });

  describe('无 schema 情况', () => {
    it('应该在没有 schema 时返回空动态联动', async () => {
      const baseLinkages: Record<string, LinkageConfig[]> = {
        'contacts.companyName': [
          {
            type: 'visibility',
            dependencies: ['./type'],
            fulfill: { state: { visible: true } },
          },
        ],
      };

      const { result } = renderHook(() => {
        const form = useForm({
          defaultValues: { contacts: [{ type: 'business' }] },
        });
        // 不传 schema
        return useArrayLinkageManager({ form, baseLinkages });
      });

      await waitFor(() => {
        // 没有 schema 时不会生成动态联动
        expect(result.current.linkageStates['contacts.0.companyName']).toBeUndefined();
      });
    });
  });
});
