import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamicForm } from '../DynamicForm';
import { FieldRegistry, blueprintPreset } from '..';
import type { ExtendedJSONSchema } from '../types/schema';
import type { DynamicFormRef } from '../types';

beforeAll(() => {
  FieldRegistry.setDefaultPreset(blueprintPreset);
});

describe('菱形依赖联动测试', () => {
  it('type字段应该通过中间节点影响最终节点的可见性', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    // 场景：type → showCompany, type → showDepartment → workInfo可见性
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          title: 'Contacts',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Name' },
              type: {
                type: 'string',
                title: 'Type',
                enum: ['personal', 'work'],
              },
              showCompany: {
                type: 'boolean',
                title: 'Show Company',
                ui: {
                  linkages: [
                    {
                      type: 'value',
                      dependencies: ['./type'],
                      fulfill: { function: 'calcShowCompany' },
                    },
                  ],
                },
              },
              showDepartment: {
                type: 'boolean',
                title: 'Show Department',
                ui: {
                  linkages: [
                    {
                      type: 'value',
                      dependencies: ['./type'],
                      fulfill: { function: 'calcShowDepartment' },
                    },
                  ],
                },
              },
              workInfo: {
                type: 'string',
                title: 'Work Info',
                ui: {
                  linkages: [
                    {
                      type: 'visibility',
                      dependencies: ['./showCompany', './showDepartment'],
                      when: {
                        and: [
                          { field: './showCompany', operator: '==', value: true },
                          { field: './showDepartment', operator: '==', value: true },
                        ],
                      },
                      fulfill: { state: { visible: true } },
                      otherwise: { state: { visible: false } },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    };

    const linkageFunctions = {
      calcShowCompany: (formData: any, context?: any) => {
        if (context?.arrayPath && context.arrayIndex !== undefined) {
          const arrayData = formData[context.arrayPath];
          const elementData = arrayData?.[context.arrayIndex];
          return elementData?.type === 'work';
        }
        return formData?.type === 'work';
      },
      calcShowDepartment: (formData: any, context?: any) => {
        if (context?.arrayPath && context.arrayIndex !== undefined) {
          const arrayData = formData[context.arrayPath];
          const elementData = arrayData?.[context.arrayIndex];
          return elementData?.type === 'work';
        }
        return formData?.type === 'work';
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        linkageFunctions={linkageFunctions}
        onSubmit={jest.fn()}
      />
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    // 初始化：个人联系人
    await act(async () => {
      formRef.current?.setValue('contacts', [{ name: 'Alice', type: 'personal' }]);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // 验证：workInfo字段应该隐藏
    await waitFor(() => {
      expect(screen.queryByText('Work Info')).not.toBeInTheDocument();
    });

    // 切换为工作联系人
    await act(async () => {
      formRef.current?.setValue('contacts.0.type', 'work');
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // 验证：workInfo字段应该显示
    await waitFor(() => {
      expect(screen.getByText('Work Info')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
