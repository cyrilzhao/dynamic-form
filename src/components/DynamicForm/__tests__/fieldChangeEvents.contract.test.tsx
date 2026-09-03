import '@testing-library/jest-dom'
import React from 'react'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { DynamicForm } from '../DynamicForm'
import type { ExtendedJSONSchema } from '../types/schema'
import {
  renderDynamicForm,
  setupDynamicFormTest,
  waitForFormReady,
} from '../__testUtils__/linkageTestHelpers'

beforeAll(setupDynamicFormTest)

describe('DynamicForm 字段变更事件契约', () => {
  const contactsSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        title: 'Contacts',
        items: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
  }

  const getLastArrayChange = (onChange: jest.Mock) =>
    onChange.mock.calls[onChange.mock.calls.length - 1][1].changes.find(
      (change: { path: string }) => change.path === 'contacts',
    )

  const confirmDelete = async (container: HTMLElement, index: number) => {
    const deleteButtons = Array.from(
      container.querySelectorAll('[title="Delete"]'),
    ) as HTMLButtonElement[]
    fireEvent.click(deleteButtons[index])
    await waitFor(() => {
      const confirmButton = Array.from(
        document.querySelectorAll('button'),
      ).find((button) => button.textContent === 'Delete' && !button.title) as
        | HTMLButtonElement
        | undefined
      expect(confirmButton).toBeDefined()
      fireEvent.click(confirmButton!)
    })
  }

  it('setValues 应在一次稳定回调中按输入顺序聚合字段变化，且不包含 action 占位字段', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        firstName: { type: 'string', title: 'First name' },
        lastName: { type: 'string', title: 'Last name' },
      },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValues({ firstName: 'Ada', lastName: 'Lovelace' })
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const [, meta] = onChange.mock.calls[0]
    expect(meta.changes).toEqual([
      {
        path: 'firstName',
        previousValue: undefined,
        value: 'Ada',
        source: 'setValues',
      },
      {
        path: 'lastName',
        previousValue: undefined,
        value: 'Lovelace',
        source: 'setValues',
      },
    ])
  })

  it('相同内容的对象重新赋值不应产生字段变化事件', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          properties: { name: { type: 'string', title: 'Name' } },
        },
      },
    }
    const { formRef } = renderDynamicForm({
      props: { schema, onChange, defaultValues: { profile: { name: 'Ada' } } },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValue('profile.name', 'Ada')
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('profile', { name: 'Ada' })
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('联动写入的字段应标记为 linkage 来源，并与直接字段变化合并到同一批次', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        country: { type: 'string', title: 'Country' },
        province: {
          type: 'string',
          title: 'Province',
          ui: {
            linkages: [
              {
                type: 'value',
                dependencies: ['country'],
                when: { field: 'country', operator: '==', value: 'CN' },
                fulfill: { value: 'Shanghai' },
              },
            ],
          },
        },
      },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('country', 'CN')
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      const [, meta] = onChange.mock.calls[onChange.mock.calls.length - 1]
      expect(meta.changes).toEqual([
        expect.objectContaining({ path: 'country' }),
        expect.objectContaining({
          path: 'province',
          value: 'Shanghai',
          source: 'linkage',
        }),
      ])
    })
  })

  it('数组插入应使用结构化 insert 动作并指向数组路径', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          title: 'Tags',
          items: { type: 'string' },
        },
      },
    }
    const { formRef, container } = renderDynamicForm({
      props: { schema, onChange },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValue('name', 'Ada')
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    onChange.mockClear()

    fireEvent.click(
      container.querySelector('.array-field-widget button.bp6-intent-primary')!,
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())

    const [, meta] = onChange.mock.calls[onChange.mock.calls.length - 1]
    expect(meta.changes).toEqual([
      expect.objectContaining({
        path: 'tags',
        arrayAction: {
          action: 'insert',
          index: 0,
          value: '',
        },
      }),
    ])
  })

  it('已有数组元素时追加应报告新元素索引和值，而不是首元素', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          title: 'Contacts',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              phone: { type: 'string' },
              email: { type: 'string' },
              type: { type: 'string' },
            },
          },
        },
      },
    }
    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        onChange,
        defaultValues: {
          contacts: [
            {
              name: '张三',
              phone: '13800138000',
              email: 'zhang@example.com',
              type: 'personal',
            },
          ],
        },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    fireEvent.click(
      container.querySelector('.array-field-widget button.bp6-intent-primary')!,
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const change =
      onChange.mock.calls[onChange.mock.calls.length - 1][1].changes[0]
    expect(change.path).toBe('contacts')
    expect(change.arrayAction).toEqual({
      action: 'insert',
      index: 1,
      value: { name: '', phone: '', email: '', type: '' },
    })
  })

  it('追加后移动元素不应复用上一次 insert 动作', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          title: 'Contacts',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    }
    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        onChange,
        defaultValues: { contacts: [{ name: '张三' }] },
      },
    })
    await waitForFormReady({ formRef })
    fireEvent.click(
      container.querySelector('.array-field-widget button.bp6-intent-primary')!,
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    onChange.mockClear()
    fireEvent.click(
      container.querySelector('[title="Move down"]:not([disabled])')!,
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const change =
      onChange.mock.calls[onChange.mock.calls.length - 1][1].changes[0]
    expect(change.arrayAction).toEqual({
      action: 'move',
      fromIndex: 0,
      toIndex: 1,
      value: { name: '张三' },
    })
  })

  it('第二个元素上移到第一位应报告 fromIndex 1 到 toIndex 0', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          title: 'Contacts',
          items: { type: 'object', properties: { name: { type: 'string' } } },
        },
      },
    }
    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        onChange,
        defaultValues: { contacts: [{ name: '张三' }, { name: '李四' }] },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    const moveUpButtons = Array.from(
      container.querySelectorAll('[title="Move up"]'),
    ) as HTMLButtonElement[]
    expect(moveUpButtons).toHaveLength(2)
    fireEvent.click(moveUpButtons[1])
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const change =
      onChange.mock.calls[onChange.mock.calls.length - 1][1].changes[0]
    expect(change.arrayAction).toEqual({
      action: 'move',
      fromIndex: 1,
      toIndex: 0,
      value: { name: '李四' },
    })
  })

  it.each([
    {
      description: '删除唯一元素后数组为空',
      contacts: [{ name: 'A' }],
      index: 0,
      expectedValue: { name: 'A' },
    },
    {
      description: '删除多个元素中的第一个后数组不为空',
      contacts: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      index: 0,
      expectedValue: { name: 'A' },
    },
    {
      description: '删除多个元素中的最后一个后数组不为空',
      contacts: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      index: 2,
      expectedValue: { name: 'C' },
    },
    {
      description: '删除多个元素中的中间元素后数组不为空',
      contacts: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      index: 1,
      expectedValue: { name: 'B' },
    },
  ])(
    '$description 应报告正确的 remove metadata',
    async ({ contacts, index, expectedValue }) => {
      const onChange = jest.fn()
      const { formRef, container } = renderDynamicForm({
        props: {
          schema: contactsSchema,
          onChange,
          defaultValues: { contacts },
        },
      })
      await waitForFormReady({ formRef })
      onChange.mockClear()

      await confirmDelete(container, index)
      await waitFor(() => expect(onChange).toHaveBeenCalled())

      expect(getLastArrayChange(onChange)).toMatchObject({
        path: 'contacts',
        arrayAction: { action: 'remove', index, value: expectedValue },
      })
    },
  )

  it.each([
    {
      description: '第一个元素下移',
      buttonTitle: 'Move down',
      buttonIndex: 0,
      expected: { fromIndex: 0, toIndex: 1, value: { name: 'A' } },
    },
    {
      description: '最后一个元素上移',
      buttonTitle: 'Move up',
      buttonIndex: 3,
      expected: { fromIndex: 3, toIndex: 2, value: { name: 'D' } },
    },
    {
      description: '中间元素上移',
      buttonTitle: 'Move up',
      buttonIndex: 1,
      expected: { fromIndex: 1, toIndex: 0, value: { name: 'B' } },
    },
    {
      description: '中间元素下移',
      buttonTitle: 'Move down',
      buttonIndex: 1,
      expected: { fromIndex: 1, toIndex: 2, value: { name: 'B' } },
    },
  ])(
    '四元素数组中 $description 应报告正确的 move metadata',
    async ({ buttonTitle, buttonIndex, expected }) => {
      const onChange = jest.fn()
      const { formRef, container } = renderDynamicForm({
        props: {
          schema: contactsSchema,
          onChange,
          defaultValues: {
            contacts: [
              { name: 'A' },
              { name: 'B' },
              { name: 'C' },
              { name: 'D' },
            ],
          },
        },
      })
      await waitForFormReady({ formRef })
      onChange.mockClear()

      const buttons = Array.from(
        container.querySelectorAll(`[title="${buttonTitle}"]`),
      ) as HTMLButtonElement[]
      fireEvent.click(buttons[buttonIndex])
      await waitFor(() => expect(onChange).toHaveBeenCalled())

      expect(getLastArrayChange(onChange)).toMatchObject({
        path: 'contacts',
        arrayAction: { action: 'move', ...expected },
      })
    },
  )

  it('数组删除和对象元素移动应携带 remove/move 结构信息', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          title: 'Items',
          items: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    }
    const { formRef } = renderDynamicForm({
      props: {
        schema,
        onChange,
        defaultValues: { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
      },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValue('items', [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ])
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('items', [{ id: 'a' }, { id: 'c' }])
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(onChange.mock.calls[0][1].changes[0].arrayAction).toEqual({
      action: 'remove',
      index: 1,
      value: { id: 'b' },
    })

    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('items', [{ id: 'c' }, { id: 'a' }])
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(onChange.mock.calls[0][1].changes[0].arrayAction).toEqual({
      action: 'move',
      fromIndex: 1,
      toIndex: 0,
      value: { id: 'c' },
    })
  })

  it('仅凭包含重复值的快照无法可靠判断数组动作时应省略 arrayAction', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        tags: { type: 'array', title: 'Tags', items: { type: 'string' } },
      },
    }
    const { formRef } = renderDynamicForm({
      props: { schema, onChange, defaultValues: { tags: ['A', 'A', 'B'] } },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValue('tags', ['A', 'A', 'B'])
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('tags', ['A', 'B'])
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(onChange.mock.calls[0][1].changes[0]).not.toHaveProperty(
      'arrayAction',
    )
  })

  it('reset 应报告实际变化并标记 reset 来源', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
    }
    const { formRef } = renderDynamicForm({
      props: { schema, onChange, defaultValues: { name: 'Ada' } },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValue('name', 'Grace')
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.reset({ name: 'Ada' })
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1].changes).toEqual([
      expect.objectContaining({
        path: 'name',
        previousValue: 'Grace',
        value: 'Ada',
        source: 'reset',
      }),
    ])
  })

  it('无参数 reset 应按 schema 空值报告所有实际变化字段', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        first: { type: 'string', title: 'First' },
        count: { type: 'number', title: 'Count' },
      },
    }
    const { formRef } = renderDynamicForm({
      props: { schema, onChange, defaultValues: { first: 'Ada', count: 3 } },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValues({ first: 'Grace', count: 4 })
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.reset()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'first', value: '', source: 'reset' }),
        expect.objectContaining({
          path: 'count',
          value: undefined,
          source: 'reset',
        }),
      ]),
    )
  })

  it('onChange 回调期间产生的新修改应进入下一批次而不被清空', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        first: { type: 'string', title: 'First' },
        second: { type: 'string', title: 'Second' },
      },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    onChange.mockImplementationOnce(() =>
      formRef.current!.setValue('second', 'B'),
    )
    await act(async () => {
      formRef.current!.setValue('first', 'A')
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(onChange.mock.calls[1][1].changes[0]).toEqual(
      expect.objectContaining({ path: 'second', value: 'B' }),
    )
  })

  it('异步联动旧结果被新修改淘汰时不应产生过期字段事件', async () => {
    const onChange = jest.fn()
    const resolvers: Array<(value: string) => void> = []
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        source: { type: 'string', title: 'Source' },
        derived: {
          type: 'string',
          title: 'Derived',
          ui: {
            linkages: [
              {
                type: 'value',
                dependencies: ['source'],
                fulfill: { function: 'derive' },
              },
            ],
          },
        },
      },
    }
    const { formRef } = renderDynamicForm({
      props: {
        schema,
        onChange,
        linkageFunctions: {
          derive: () =>
            new Promise<string>((resolve) => resolvers.push(resolve)),
        },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('source', 'old')
      await new Promise((resolve) => setTimeout(resolve, 5))
      formRef.current!.setValue('source', 'new')
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    resolvers[0]?.('old-result')
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(
      onChange.mock.calls.flatMap((call) => call[1]?.changes ?? []),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'old-result' }),
      ]),
    )
  })

  it('组件卸载后不应 flush 已排队的字段变更回调', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
    }
    const { formRef, unmount } = renderDynamicForm({
      props: { schema, onChange },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    act(() => {
      formRef.current!.setValue('name', 'Ada')
      unmount()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('更新 schema 后应继续使用原订阅并按最新 transform 输出变更数据', async () => {
    const onChange = jest.fn()
    const initialSchema: ExtendedJSONSchema = {
      type: 'object',
      properties: { score: { type: 'number', title: 'Score' } },
    }
    const transformedSchema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          title: 'Score',
          ui: { transform: { callback: 'toDecimal' } },
        },
      },
    }
    const callbacks = {
      toDecimal: ({ value }: { value: number }) => value / 100,
    }
    const { formRef, rerender } = renderDynamicForm({
      props: { schema: initialSchema, onChange, callbacks },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    rerender(
      <DynamicForm
        ref={formRef}
        schema={transformedSchema}
        onChange={onChange}
        onSubmit={jest.fn()}
        callbacks={callbacks}
      />,
    )

    await act(async () => {
      formRef.current!.setValue('score', 50)
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(onChange).toHaveBeenCalledWith(
      { score: 0.5 },
      expect.objectContaining({
        changes: [expect.objectContaining({ path: 'score', value: 0.5 })],
      }),
    )
  })
})
