import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicForm } from '../DynamicForm';
import type { ExtendedJSONSchema } from '../types/schema';
import type { LinkageFunction } from '../types/linkage';

describe('LinkageContext', () => {
  describe('基本功能', () => {
    it('应该将 linkageContext 传递给联动函数', async () => {
      const mockLinkageFn = vi.fn().mockResolvedValue([
        { label: '选项1', value: '1' },
        { label: '选项2', value: '2' },
      ]);

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          trigger: {
            type: 'string',
            title: '触发字段',
          },
          target: {
            type: 'string',
            title: '目标字段',
          },
        },
        linkages: {
          target: [
            {
              type: 'options',
              dependencies: ['trigger'],
              function: 'loadOptions',
            },
          ],
        },
      };

      const externalData = { apiKey: 'test-key', userId: 123 };

      render(
        <DynamicForm
          schema={schema}
          linkageFunctions={{ loadOptions: mockLinkageFn }}
          linkageContext={externalData}
        />
      );

      // 输入触发字段，触发联动
      const input = screen.getByLabelText('触发字段');
      await userEvent.type(input, 'test');

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalled();
      });

      // 验证 context 参数包含 linkageContext 的数据
      const callArgs = mockLinkageFn.mock.calls[0];
      const context = callArgs[1];
      expect(context).toMatchObject(externalData);
    });
  });

  describe('自动刷新机制', () => {
    it('应该在 linkageContext 变化时自动触发联动刷新', async () => {
      const mockLinkageFn = vi.fn().mockResolvedValue([]);

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: '字段',
          },
        },
        linkages: {
          field: [
            {
              type: 'options',
              dependencies: [],
              function: 'loadOptions',
            },
          ],
        },
      };

      const TestComponent = () => {
        const [apiData, setApiData] = useState({ count: 0 });

        return (
          <div>
            <button onClick={() => setApiData({ count: apiData.count + 1 })}>
              更新数据
            </button>
            <DynamicForm
              schema={schema}
              linkageFunctions={{ loadOptions: mockLinkageFn }}
              linkageContext={apiData}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // 等待初始联动执行
      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalledTimes(1);
      });

      const initialContext = mockLinkageFn.mock.calls[0][1];
      expect(initialContext).toMatchObject({ count: 0 });

      // 更新 linkageContext
      const button = screen.getByText('更新数据');
      await userEvent.click(button);

      // 验证联动被重新执行
      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalledTimes(2);
      });

      const updatedContext = mockLinkageFn.mock.calls[1][1];
      expect(updatedContext).toMatchObject({ count: 1 });
    });

    it('应该使用 shallow compare 避免不必要的刷新', async () => {
      const mockLinkageFn = vi.fn().mockResolvedValue([]);

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: '字段',
          },
        },
        linkages: {
          field: [
            {
              type: 'options',
              dependencies: [],
              function: 'loadOptions',
            },
          ],
        },
      };

      const apiData = { userId: 123 };

      const TestComponent = () => {
        const [, setCount] = useState(0);

        return (
          <div>
            <button onClick={() => setCount(c => c + 1)}>
              触发重新渲染
            </button>
            <DynamicForm
              schema={schema}
              linkageFunctions={{ loadOptions: mockLinkageFn }}
              linkageContext={apiData}
            />
          </div>
        );
      };

      render(<TestComponent />);

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalledTimes(1);
      });

      // 触发组件重新渲染，但 linkageContext 的引用和内容都没变
      const button = screen.getByText('触发重新渲染');
      await userEvent.click(button);

      // 等待一段时间，确保不会触发新的联动
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证联动没有被重新执行
      expect(mockLinkageFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('边界情况', () => {
    it('应该正确处理 linkageContext 为 undefined', async () => {
      const mockLinkageFn = vi.fn().mockResolvedValue([]);

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: '字段',
          },
        },
        linkages: {
          field: [
            {
              type: 'options',
              dependencies: [],
              function: 'loadOptions',
            },
          ],
        },
      };

      render(
        <DynamicForm
          schema={schema}
          linkageFunctions={{ loadOptions: mockLinkageFn }}
        />
      );

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalled();
      });

      // 验证 context 参数仍然包含基本字段
      const context = mockLinkageFn.mock.calls[0][1];
      expect(context).toHaveProperty('fieldPath');
    });

    it('应该正确处理空对象 linkageContext', async () => {
      const mockLinkageFn = vi.fn().mockResolvedValue([]);

      const schema: ExtendedJSONSchema = {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            title: '字段',
          },
        },
        linkages: {
          field: [
            {
              type: 'options',
              dependencies: [],
              function: 'loadOptions',
            },
          ],
        },
      };

      render(
        <DynamicForm
          schema={schema}
          linkageFunctions={{ loadOptions: mockLinkageFn }}
          linkageContext={{}}
        />
      );

      await waitFor(() => {
        expect(mockLinkageFn).toHaveBeenCalled();
      });

      const context = mockLinkageFn.mock.calls[0][1];
      expect(context).toHaveProperty('fieldPath');
    });
  });
});
