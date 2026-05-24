import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamicForm } from '../DynamicForm';
import type { ExtendedJSONSchema } from '../types/schema';
import type { DynamicFormRef } from '../types';

/**
 * 测试 schema 默认值与联动计算的集成
 *
 * 验证：
 * 1. schema 中的 default 值在表单初始化时被正确设置
 * 2. 这些默认值会参与联动计算
 * 3. 联动规则会根据默认值正确计算字段的显示/隐藏状态
 */
describe('Schema 默认值与联动计算集成测试', () => {
  it('schema 默认值应该触发联动计算（visibility）', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        userType: {
          type: 'string',
          title: 'User Type',
          enum: ['personal', 'enterprise'],
          default: 'enterprise', // 默认值为 enterprise
        },
        companyName: {
          type: 'string',
          title: 'Company Name',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['userType'],
                when: { field: 'userType', operator: '==', value: 'enterprise' },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />);

    // 手动触发联动初始化
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 由于 userType 的默认值是 'enterprise'
    // companyName 字段应该可见
    await waitFor(() => {
      expect(screen.getByText('Company Name')).toBeInTheDocument();
    });
  });

  it('schema 默认值为触发隐藏条件时，字段应该隐藏', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        userType: {
          type: 'string',
          title: 'User Type',
          enum: ['personal', 'enterprise'],
          default: 'personal', // 默认值为 personal
        },
        companyName: {
          type: 'string',
          title: 'Company Name',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['userType'],
                when: { field: 'userType', operator: '==', value: 'enterprise' },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />);

    // 手动触发联动初始化
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 由于 userType 的默认值是 'personal'
    // companyName 字段应该隐藏
    await waitFor(
      () => {
        expect(screen.queryByText('Company Name')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('嵌套对象中的 schema 默认值应该触发联动计算', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          properties: {
            enableAdvanced: {
              type: 'boolean',
              title: 'Enable Advanced',
              default: true, // 默认启用高级设置
            },
            advancedOption: {
              type: 'string',
              title: 'Advanced Option',
              ui: {
                linkages: [
                  {
                    type: 'visibility',
                    dependencies: ['settings.enableAdvanced'],
                    when: { field: 'settings.enableAdvanced', operator: '==', value: true },
                    fulfill: { state: { visible: true } },
                    otherwise: { state: { visible: false } },
                  },
                ],
              },
            },
          },
        },
      },
    };

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />);

    // 手动触发联动初始化
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 由于 enableAdvanced 的默认值是 true
    // advancedOption 字段应该可见
    await waitFor(() => {
      expect(screen.getByText('Advanced Option')).toBeInTheDocument();
    });
  });

  it('用户提供的 defaultValues 应该覆盖 schema 默认值并触发联动', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        userType: {
          type: 'string',
          title: 'User Type',
          enum: ['personal', 'enterprise'],
          default: 'enterprise', // schema 默认值为 enterprise
        },
        companyName: {
          type: 'string',
          title: 'Company Name',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['userType'],
                when: { field: 'userType', operator: '==', value: 'enterprise' },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    // 用户提供的 defaultValues 覆盖 schema 默认值
    await act(async () => {
      render(
        <DynamicForm
          ref={formRef}
          schema={schema}
          defaultValues={{ userType: 'personal' }}
          onSubmit={jest.fn()}
        />
      );
    });

    // 等待初始渲染完成
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // 验证表单值被正确设置
    expect(formRef.current?.getValues()?.userType).toBe('personal');

    // 如果联动没有自动执行，手动触发一次刷新
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 等待联动计算完成
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // 由于 userType 是 'personal'（不是 'enterprise'），companyName 应该隐藏
    expect(screen.queryByText('Company Name')).not.toBeInTheDocument();
  });

  it('多个联动依赖同一个有默认值的字段时都应该正确计算', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        paymentMethod: {
          type: 'string',
          title: 'Payment Method',
          enum: ['credit_card', 'bank_transfer', 'cash'],
          default: 'credit_card', // 默认信用卡支付
        },
        cardNumber: {
          type: 'string',
          title: 'Card Number',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['paymentMethod'],
                when: { field: 'paymentMethod', operator: '==', value: 'credit_card' },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
        bankAccount: {
          type: 'string',
          title: 'Bank Account',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['paymentMethod'],
                when: { field: 'paymentMethod', operator: '==', value: 'bank_transfer' },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />);

    // 手动触发联动初始化
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    await waitFor(
      () => {
        // 默认 credit_card，所以 Card Number 可见
        expect(screen.getByText('Card Number')).toBeInTheDocument();
        // Bank Account 应该隐藏
        expect(screen.queryByText('Bank Account')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('schema 默认值为 false 时应该正确触发联动', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        isVIP: {
          type: 'boolean',
          title: 'Is VIP',
          default: false, // 默认非 VIP
        },
        vipBenefits: {
          type: 'string',
          title: 'VIP Benefits',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['isVIP'],
                when: { field: 'isVIP', operator: '==', value: true },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />);

    // 手动触发联动初始化
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 由于 isVIP 默认为 false，VIP Benefits 应该隐藏
    await waitFor(
      () => {
        expect(screen.queryByText('VIP Benefits')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('schema 默认值为数字 0 时应该正确触发联动', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        quantity: {
          type: 'integer',
          title: 'Quantity',
          default: 0, // 默认数量为 0
        },
        discountInfo: {
          type: 'string',
          title: 'Discount Info',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['quantity'],
                when: { field: 'quantity', operator: '>', value: 0 },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />);

    // 手动触发联动初始化
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 由于 quantity 默认为 0，不大于 0，Discount Info 应该隐藏
    await waitFor(
      () => {
        expect(screen.queryByText('Discount Info')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});

/**
 * 动态 schema 联动测试
 *
 * 验证：当通过 schema 类型联动加载新的 schema 时，
 * 新 schema 中的 default 值应该被提取并应用到表单
 */
describe('动态 schema 联动的默认值测试', () => {
  // 模拟的动态 schema，包含 default 值
  const httpRequestSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        title: 'HTTP Method',
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
        default: 'GET',
      },
      timeout: {
        type: 'number',
        title: 'Timeout',
        default: 30000,
      },
      // 包含内部联动的字段
      showAdvanced: {
        type: 'boolean',
        title: 'Show Advanced',
        default: true,
      },
      advancedOptions: {
        type: 'string',
        title: 'Advanced Options',
        ui: {
          linkages: [
            {
              type: 'visibility',
              dependencies: ['content.showAdvanced'],
              when: { field: 'content.showAdvanced', operator: '==', value: true },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            },
          ],
        },
      },
    },
  };

  it('动态加载的 schema 中的 default 值应该被应用到表单', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    // 异步加载 schema 的函数
    const loadSchema = jest.fn().mockResolvedValue(httpRequestSchema);

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        actionType: {
          type: 'string',
          title: 'Action Type',
          enum: ['httpRequest', 'sendEmail'],
        },
        content: {
          type: 'object',
          title: 'Content',
          properties: {},
          ui: {
            linkages: [
              {
                type: 'schema',
                dependencies: ['actionType'],
                when: { field: 'actionType', operator: '==', value: 'httpRequest' },
                fulfill: { function: 'loadSchema' },
              },
            ],
          },
        },
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={jest.fn()}
        linkageFunctions={{ loadSchema }}
      />
    );

    // 初始状态：content 应该为空或不存在
    await waitFor(
      () => {
        expect(screen.queryByText('HTTP Method')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // 选择 httpRequest 触发 schema 联动
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'httpRequest' } });

    // 等待动态 schema 加载完成
    await waitFor(
      () => {
        // 新 schema 的字段应该显示
        expect(screen.getByText('HTTP Method')).toBeInTheDocument();
        expect(screen.getByText('Timeout')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // 验证 default 值被正确应用
    await waitFor(() => {
      const values = formRef.current?.getValues();
      // 检查动态 schema 的 default 值
      expect(values?.content?.method).toBe('GET');
      expect(values?.content?.timeout).toBe(30000);
      expect(values?.content?.showAdvanced).toBe(true);
    });
  });

  it('动态加载的 schema 中的联动配置应该正确计算', async () => {
    const formRef = React.createRef<DynamicFormRef>();

    // 模拟的 schema，其中 showAdvanced 默认为 false
    const schemaWithHiddenAdvanced: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        showAdvanced: {
          type: 'boolean',
          title: 'Show Advanced',
          default: false, // 默认不显示高级选项
        },
        advancedOptions: {
          type: 'string',
          title: 'Advanced Options',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['content.showAdvanced'],
                when: { field: 'content.showAdvanced', operator: '==', value: true },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    };

    const loadSchema = jest.fn().mockResolvedValue(schemaWithHiddenAdvanced);

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        actionType: {
          type: 'string',
          title: 'Action Type',
          enum: ['httpRequest', 'sendEmail'],
        },
        content: {
          type: 'object',
          title: 'Content',
          properties: {},
          ui: {
            linkages: [
              {
                type: 'schema',
                dependencies: ['actionType'],
                when: { field: 'actionType', operator: '==', value: 'httpRequest' },
                fulfill: { function: 'loadSchema' },
              },
            ],
          },
        },
      },
    };

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={jest.fn()}
        linkageFunctions={{ loadSchema }}
      />
    );

    // 选择 httpRequest 触发 schema 联动
    const select = screen.getByRole('combobox');
    await act(async () => {
      fireEvent.change(select, { target: { value: 'httpRequest' } });
    });

    // 手动触发联动以加载动态 schema
    await act(async () => {
      await formRef.current?.refreshLinkage();
    });

    // 等待动态 schema 加载完成
    await waitFor(
      () => {
        // showAdvanced 字段应该显示
        expect(screen.getByText('Show Advanced')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // 由于 showAdvanced 默认为 false，advancedOptions 应该隐藏
    await waitFor(
      () => {
        expect(screen.queryByText('Advanced Options')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // 验证默认值被正确应用
    await waitFor(() => {
      const values = formRef.current?.getValues();
      expect(values?.content?.showAdvanced).toBe(false);
    });
  });
});
