import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamicForm } from '../DynamicForm';
import { FieldRegistry, blueprintPreset } from '..';
import type { ExtendedJSONSchema } from '../types/schema';
import type { DynamicFormRef } from '../types';

beforeAll(() => {
  FieldRegistry.setDefaultPreset(blueprintPreset);
});

describe('Schema 联动在 DynamicForm 中的集成测试', () => {
  it('应该能通过 formRef API 验证 schema 联动改变了校验规则', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          title: 'Mode',
          enum: ['strict', 'loose'],
          default: 'strict',
        },
        value: {
          type: 'string',
          title: 'Value',
          ui: {
            linkages: [
              {
                type: 'schema',
                dependencies: ['#/properties/mode'],
                fulfill: { function: 'getValueSchema' },
              },
            ],
          },
        },
      },
    };

    const linkageFunctions = {
      getValueSchema: (formData: any) => {
        const { mode } = formData || {};

        if (mode === 'strict') {
          return {
            minLength: 10,
            pattern: '^[A-Z]+$', // 只允许大写字母
          };
        }

        if (mode === 'loose') {
          return {
            minLength: 3,
            // 没有 pattern 限制
          };
        }

        return {};
      },
    };

    const { container } = render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        linkageFunctions={linkageFunctions}
        onSubmit={jest.fn()}
      />
    );

    // 等待表单初始化
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // 验证 formRef 已经正确绑定
    expect(formRef.current).toBeTruthy();

    // 场景1：mode = 'strict'（默认值），输入不符合规则的值
    const valueInput = container.querySelector('input[name="value"]') as HTMLInputElement;
    expect(valueInput).toBeTruthy();

    // 输入小写字母（违反 pattern: '^[A-Z]+$'）
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: 'abcdefghij' } });
      await formRef.current!.validate('value');
    });

    // 验证有错误
    let errors = formRef.current!.getErrors();
    expect(errors.value).toBeTruthy();

    // 输入大写字母但长度不足（违反 minLength: 10）
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: 'ABC' } });
      await formRef.current!.validate('value');
    });

    errors = formRef.current!.getErrors();
    expect(errors.value).toBeTruthy();

    // 输入符合规则的值（10个大写字母）
    await act(async () => {
      fireEvent.change(valueInput, { target: { value: 'ABCDEFGHIJ' } });
      await formRef.current!.validate('value');
    });

    errors = formRef.current!.getErrors();
    expect(errors.value).toBeUndefined();
  });
});
