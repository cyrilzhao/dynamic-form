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
    expect(meta.rootSource).toBe('setValues')
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

  it('setValues 后仍应继续触发当前批次和后续用户修改的 onChange', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
        users: { type: 'array', title: 'Users', items: { type: 'string' } },
      },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('name', 'before')
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValues({ users: ['Alan', 'Leo'] })
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1].rootSource).toBe('setValues')
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('name', 'after')
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1].changes).toEqual([
      expect.objectContaining({
        path: 'name',
        previousValue: 'before',
        value: 'after',
      }),
    ])
  })

  it('setValues 触发异步 options 联动失败时也不能阻塞后续 onChange', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        users: { type: 'array', title: 'Users', items: { type: 'string' } },
        actions: {
          type: 'array',
          title: 'Actions',
          items: { type: 'string' },
          ui: {
            widget: 'select',
            widgetProps: { multiple: true },
            linkages: [
              {
                type: 'options',
                dependencies: [],
                fulfill: {
                  function: {
                    type: 'script',
                    code: 'async function({ formData }) { return formData.users.map((user) => ({ label: user.value, value: user.value })) }',
                  },
                },
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
      formRef.current!.setValues({ users: ['Alan'], actions: [] })
      await new Promise((resolve) => setTimeout(resolve, 80))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('users', ['Leo'])
      await new Promise((resolve) => setTimeout(resolve, 80))
    })
    expect(onChange).toHaveBeenCalledTimes(1)
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

  it('紧接着的 setValue 应淘汰旧 batch，且不串用字段来源', async () => {
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
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('first', 'old')
      formRef.current!.setValue('second', 'new')
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual({
      rootSource: 'setValue',
      changes: [
        expect.objectContaining({
          path: 'second',
          previousValue: undefined,
          value: 'new',
          source: 'setValue',
        }),
      ],
    })
  })

  it('根表单应采集嵌套对象的直接路径变化', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          title: 'Profile',
          properties: { name: { type: 'string', title: 'Name' } },
        },
      },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('profile.name', 'Ada')
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1].changes).toEqual([
      expect.objectContaining({ path: 'profile.name', value: 'Ada' }),
    ])
  })

  it('数组项 asNestedForm 的联动应归属根表单同一批次', async () => {
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
              source: { type: 'string', title: 'Source' },
              derived: {
                type: 'string',
                title: 'Derived',
                ui: {
                  linkages: [
                    {
                      type: 'value',
                      dependencies: ['./source'],
                      when: {
                        field: './source',
                        operator: '==',
                        value: 'CN',
                      },
                      fulfill: { value: 'Shanghai' },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValues({ contacts: [{ source: '' }] })
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('contacts.0.source', 'CN')
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        rootSource: 'setValue',
        changes: expect.arrayContaining([
          expect.objectContaining({
            path: 'contacts.0.source',
            source: 'setValue',
          }),
          expect.objectContaining({
            path: 'contacts.0.derived',
            value: 'Shanghai',
            source: 'linkage',
          }),
        ]),
      }),
    )
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
      expect(meta.rootSource).toBe('setValue')
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

  it('refreshLinkage 真实写入时应产生 linkage 根批次', async () => {
    const onChange = jest.fn()
    let nextProvince = 'Manual'
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
                fulfill: { function: 'deriveProvince' },
              },
            ],
          },
        },
      },
    }
    const { formRef } = renderDynamicForm({
      props: {
        schema,
        defaultValues: { country: 'CN', province: 'Manual' },
        onChange,
        linkageFunctions: { deriveProvince: () => nextProvince },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    nextProvince = 'Shanghai'
    await act(async () => {
      await formRef.current!.refreshLinkage()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(formRef.current!.getValues().province).toBe('Shanghai')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual({
      rootSource: 'linkage',
      changes: [
        expect.objectContaining({
          path: 'province',
          value: 'Shanghai',
          source: 'linkage',
        }),
      ],
    })
  })

  it('refreshLinkage 无实际值变化时不应发送空批次', async () => {
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
                fulfill: { value: 'Shanghai' },
              },
            ],
          },
        },
      },
    }
    const { formRef } = renderDynamicForm({
      props: {
        schema,
        defaultValues: { country: 'CN', province: 'Shanghai' },
        onChange,
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      await formRef.current!.refreshLinkage()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('linkageContext 变化导致真实联动写入时应产生 linkage 根批次', async () => {
    const onChange = jest.fn()
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
    const linkageFunctions = {
      derive: ({
        context,
      }: {
        context: { externalData: Record<string, any> }
      }) => context.externalData.suffix,
    }
    const { formRef, rerender } = renderDynamicForm({
      props: {
        schema,
        defaultValues: { source: 'value', derived: 'A' },
        linkageFunctions,
        linkageContext: { suffix: 'A' },
        onChange,
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    rerender(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={jest.fn()}
        onChange={onChange}
        linkageFunctions={linkageFunctions}
        linkageContext={{ suffix: 'B' }}
      />,
    )
    await waitFor(() => expect(formRef.current!.getValues().derived).toBe('B'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        rootSource: 'linkage',
        changes: [
          expect.objectContaining({
            path: 'derived',
            previousValue: 'A',
            value: 'B',
            source: 'linkage',
          }),
        ],
      }),
    )
  })

  it('linkageFunctions 变化导致真实联动写入时应产生 linkage 根批次', async () => {
    const onChange = jest.fn()
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
    const { formRef, rerender } = renderDynamicForm({
      props: {
        schema,
        defaultValues: { source: 'value', derived: 'A' },
        linkageFunctions: { derive: () => 'A' },
        onChange,
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    rerender(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={jest.fn()}
        onChange={onChange}
        linkageFunctions={{ derive: () => 'B' }}
      />,
    )
    await waitFor(() => expect(formRef.current!.getValues().derived).toBe('B'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        rootSource: 'linkage',
        changes: [
          expect.objectContaining({
            path: 'derived',
            previousValue: 'A',
            value: 'B',
            source: 'linkage',
          }),
        ],
      }),
    )
  })

  it('reset 直接字段标记为 reset，触发的联动目标标记为 linkage', async () => {
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
    const { formRef } = renderDynamicForm({
      props: {
        schema,
        onChange,
        defaultValues: { country: 'US', province: 'New York' },
      },
    })
    await waitForFormReady({ formRef })
    await act(async () => {
      formRef.current!.setValue('province', 'Manual')
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.reset({ country: 'CN', province: 'New York' })
      await new Promise((resolve) => setTimeout(resolve, 150))
    })

    const changes = onChange.mock.calls.flatMap(
      (call) => call[1]?.changes ?? [],
    )
    expect(
      onChange.mock.calls[onChange.mock.calls.length - 1][1].rootSource,
    ).toBe('reset')
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'country', source: 'reset' }),
        expect.objectContaining({
          path: 'province',
          value: 'Shanghai',
          source: 'linkage',
        }),
      ]),
    )
  })

  it('setValues 与联动覆盖发生在同一稳定批次时按首次位置去重并保留最终值来源', async () => {
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
      formRef.current!.setValues({ country: 'CN', province: 'Beijing' })
      await new Promise((resolve) => setTimeout(resolve, 250))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const changes = onChange.mock.calls[0][1].changes
    expect(changes.map((change: { path: string }) => change.path)).toEqual([
      'country',
      'province',
    ])
    expect(changes[0]).toEqual(
      expect.objectContaining({ path: 'country', source: 'setValues' }),
    )
    expect(changes[1]).toEqual(
      expect.objectContaining({
        path: 'province',
        value: 'Shanghai',
        source: 'linkage',
      }),
    )
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

  it('数组结构操作后编辑元素字段应创建独立字段事件且不复用 arrayAction', async () => {
    const onChange = jest.fn()
    const { formRef, container } = renderDynamicForm({
      props: {
        schema: contactsSchema,
        onChange,
        defaultValues: { contacts: [{ name: 'A' }] },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    fireEvent.click(
      container.querySelector('.array-field-widget button.bp6-intent-primary')!,
    )
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    onChange.mockClear()

    const firstName = container.querySelector(
      '[name="contacts.0.name"]',
    ) as HTMLInputElement
    fireEvent.change(firstName, { target: { value: 'Edited' } })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

    const change = onChange.mock.calls[0][1].changes.find(
      (item: { path: string }) => item.path === 'contacts.0.name',
    )
    expect(change).toEqual(
      expect.objectContaining({ path: 'contacts.0.name', value: 'Edited' }),
    )
    expect(change).not.toHaveProperty('arrayAction')
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

  it('连续下移再上移同一元素时应报告最后一次 move 的实际 fromIndex', async () => {
    const onChange = jest.fn()
    const { formRef, container } = renderDynamicForm({
      props: {
        schema: contactsSchema,
        onChange,
        defaultValues: { contacts: [{ name: 'a' }, { name: '张三a' }] },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    const moveDown = () =>
      fireEvent.click(
        container.querySelector('[title="Move down"]:not([disabled])')!,
      )
    const moveUp = () =>
      fireEvent.click(
        container.querySelector('[title="Move up"]:not([disabled])')!,
      )

    moveDown()
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    onChange.mockClear()
    moveUp()
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

    const change = onChange.mock.calls[0][1].changes.find(
      (item: { path: string }) => item.path === 'contacts',
    )
    expect(change.arrayAction).toEqual({
      action: 'move',
      fromIndex: 1,
      toIndex: 0,
      value: { name: 'a' },
    })
  })

  it('基本类型数组第一个元素下移应报告 fromIndex 0', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          title: 'Tags',
          items: { type: 'string' },
          ui: { arrayMode: 'dynamic' },
        },
      },
    }
    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        onChange,
        defaultValues: { tags: ['React', 'TypeScript'] },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    const moveDownButtons = Array.from(
      container.querySelectorAll('[title="Move down"]'),
    ) as HTMLButtonElement[]
    fireEvent.click(moveDownButtons[0])
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    const action = onChange.mock.calls[0][1].changes[0].arrayAction
    expect(action).toEqual({
      action: 'move',
      fromIndex: 0,
      toIndex: 1,
      value: 'React',
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

  it('数组插入触发联动时应合并结构事件和联动字段变化', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          title: 'Contacts',
          items: {
            type: 'object',
            properties: { name: { type: 'string', title: 'Name' } },
          },
        },
        contactCount: {
          type: 'number',
          title: 'Contact count',
          ui: {
            linkages: [
              {
                type: 'value',
                dependencies: ['contacts'],
                fulfill: { function: 'deriveContactCount' },
              },
            ],
          },
        },
      },
    }
    const { container, formRef } = renderDynamicForm({
      props: {
        schema,
        onChange,
        // 给初始联动目标同值，排除初始化 refresh 的独立回调，只观察本次插入链路。
        defaultValues: { contacts: [], contactCount: 0 },
        linkageFunctions: {
          deriveContactCount: ({
            formData,
          }: {
            formData: { contacts?: unknown[] }
          }) => formData.contacts?.length ?? 0,
        },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      const addButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Add',
      ) as HTMLButtonElement
      fireEvent.click(addButton)
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        changes: expect.arrayContaining([
          expect.objectContaining({
            path: 'contacts',
            arrayAction: {
              action: 'insert',
              index: 0,
              value: expect.anything(),
            },
          }),
          expect.objectContaining({
            path: 'contactCount',
            value: 1,
            source: 'linkage',
          }),
        ]),
      }),
    )
    expect(
      onChange.mock.calls[0][1].changes.filter(
        (change: { path: string }) => change.path === 'contacts',
      ),
    ).toHaveLength(1)
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

  it('onChange 回调内的 setValues 应创建独立下一批次', async () => {
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
      formRef.current!.setValues({ second: 'B' }),
    )

    await act(async () => {
      formRef.current!.setValue('first', 'A')
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(onChange.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        rootSource: 'setValues',
        changes: [expect.objectContaining({ path: 'second', value: 'B' })],
      }),
    )
  })

  it('onChange 回调内的 reset 应创建独立下一批次', async () => {
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: { first: { type: 'string', title: 'First' } },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    onChange.mockImplementationOnce(() =>
      formRef.current!.reset({ first: 'B' }),
    )

    await act(async () => {
      formRef.current!.setValue('first', 'A')
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(onChange.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        rootSource: 'reset',
        changes: [expect.objectContaining({ path: 'first', value: 'B' })],
      }),
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

  it('reset 应淘汰尚未完成的异步联动结果', async () => {
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
      formRef.current!.reset({ source: 'reset' })
      await new Promise((resolve) => setTimeout(resolve, 5))
    })
    resolvers[0]?.('stale-result')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    expect(formRef.current!.getValues().derived).not.toBe('stale-result')
    expect(
      onChange.mock.calls.flatMap((call) => call[1]?.changes ?? []),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'derived', value: 'stale-result' }),
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

  it('更新 schema 中的联动规则后应自动刷新并以 linkage 根来源报告变化', async () => {
    const onChange = jest.fn()
    const initialSchema: ExtendedJSONSchema = {
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
                when: { field: 'source', operator: '==', value: 'on' },
                fulfill: { value: 'A' },
              },
            ],
          },
        },
      },
    }
    const updatedSchema: ExtendedJSONSchema = {
      ...initialSchema,
      properties: {
        ...initialSchema.properties,
        derived: {
          ...initialSchema.properties!.derived,
          ui: {
            linkages: [
              {
                type: 'value',
                dependencies: ['source'],
                when: { field: 'source', operator: '==', value: 'on' },
                fulfill: { value: 'B' },
              },
            ],
          },
        },
      },
    }

    const { formRef, rerender } = renderDynamicForm({
      props: {
        schema: initialSchema,
        onChange,
        defaultValues: { source: 'on' },
      },
    })
    await waitForFormReady({ formRef })
    await waitFor(() => expect(formRef.current!.getValues().derived).toBe('A'))
    onChange.mockClear()

    rerender(
      <DynamicForm
        ref={formRef}
        schema={updatedSchema}
        onChange={onChange}
        onSubmit={jest.fn()}
        defaultValues={{ source: 'on' }}
      />,
    )

    await waitFor(() => expect(formRef.current!.getValues().derived).toBe('B'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        rootSource: 'linkage',
        changes: [
          expect.objectContaining({
            path: 'derived',
            value: 'B',
            source: 'linkage',
          }),
        ],
      }),
    )
  })

  it('更新 schema 但联动计算结果不变时不应发送空事件', async () => {
    const onChange = jest.fn()
    const initialSchema: ExtendedJSONSchema = {
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
                fulfill: { value: 'unchanged' },
              },
            ],
          },
        },
      },
    }
    const updatedSchema: ExtendedJSONSchema = {
      ...initialSchema,
      // 使用新对象模拟调用方替换 schema，但保留等价联动输出。
      properties: { ...initialSchema.properties },
    }
    const { formRef, rerender } = renderDynamicForm({
      props: { schema: initialSchema, onChange },
    })
    await waitForFormReady({ formRef })
    await waitFor(() =>
      expect(formRef.current!.getValues().derived).toBe('unchanged'),
    )
    // 等待初始化联动批次真正 flush，再清理历史回调，避免把初始化事件误判为 schema 更新事件。
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    onChange.mockClear()

    rerender(
      <DynamicForm
        ref={formRef}
        schema={updatedSchema}
        onChange={onChange}
        onSubmit={jest.fn()}
      />,
    )
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('onChange 引用变化时应调用最新回调而不依赖函数身份重建订阅', async () => {
    const firstOnChange = jest.fn()
    const secondOnChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
    }
    const { formRef, rerender } = renderDynamicForm({
      props: { schema, onChange: firstOnChange },
    })
    await waitForFormReady({ formRef })

    rerender(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onChange={secondOnChange}
        onSubmit={jest.fn()}
      />,
    )
    await act(async () => {
      formRef.current!.setValue('name', 'Ada')
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(firstOnChange).not.toHaveBeenCalled()
    expect(secondOnChange).toHaveBeenCalled()
  })

  it('并行异步联动逆序完成时应在同一批次保持配置顺序', async () => {
    const onChange = jest.fn()
    const resolvers = new Map<string, (value: string) => void>()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        source: { type: 'string', title: 'Source' },
        firstTarget: {
          type: 'string',
          title: 'First target',
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
        secondTarget: {
          type: 'string',
          title: 'Second target',
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
          derive: ({
            formData,
            context,
          }: {
            formData: { source?: string }
            context: { fieldPath: string }
          }) => {
            // 初始化 refresh 的 source 为空，必须同步结束，避免它阻塞本次用户输入的队列。
            if (formData.source !== 'trigger') {
              return ''
            }
            return new Promise<string>((resolve) => {
              resolvers.set(context.fieldPath, resolve)
            })
          },
        },
      },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()
    await act(async () => {
      formRef.current!.setValue('source', 'trigger')
      await waitFor(() => expect(resolvers.size).toBe(2))
      // 故意让第二个目标先完成，验证事件顺序不依赖 Promise settle 顺序。
      resolvers.get('secondTarget')!('second')
      resolvers.get('firstTarget')!('first')
      await new Promise((resolve) => setTimeout(resolve, 40))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        changes: [
          expect.objectContaining({ path: 'source', value: 'trigger' }),
          expect.objectContaining({ path: 'firstTarget', value: 'first' }),
          expect.objectContaining({ path: 'secondTarget', value: 'second' }),
        ],
      }),
    )
  })

  it('多层联动应在一次稳定回调中按级联顺序返回所有变化', async () => {
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
        city: {
          type: 'string',
          title: 'City',
          ui: {
            linkages: [
              {
                type: 'value',
                dependencies: ['province'],
                when: { field: 'province', operator: '==', value: 'Shanghai' },
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
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        rootSource: 'setValue',
        changes: [
          expect.objectContaining({ path: 'country', source: 'setValue' }),
          expect.objectContaining({ path: 'province', source: 'linkage' }),
          expect.objectContaining({ path: 'city', source: 'linkage' }),
        ],
      }),
    )
  })

  it('静默 setValues 应淘汰旧异步联动且不泄露旧结果事件', async () => {
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
      await new Promise((resolve) => setTimeout(resolve, 10))
      formRef.current!.setValues({ source: 'new' }, { silence: true })
      resolvers.forEach((resolve) => resolve('old-result'))
      await new Promise((resolve) => setTimeout(resolve, 40))
    })

    expect(
      onChange.mock.calls.flatMap((call) => call[1]?.changes ?? []),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'old-result' }),
      ]),
    )
  })

  it('onChange 抛错后下一次批次仍应正常发送', async () => {
    const onChange = jest.fn().mockImplementationOnce(() => {
      throw new Error('consumer failure')
    })
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
    }
    const { formRef } = renderDynamicForm({ props: { schema, onChange } })
    await waitForFormReady({ formRef })
    const uncaughtErrors: Error[] = []
    const handleWindowError = (event: ErrorEvent) => {
      uncaughtErrors.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', handleWindowError)

    try {
      await act(async () => {
        formRef.current!.setValue('name', 'Ada')
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
      await act(async () => {
        formRef.current!.setValue('name', 'Grace')
        await new Promise((resolve) => setTimeout(resolve, 10))
      })
    } finally {
      window.removeEventListener('error', handleWindowError)
    }

    expect(uncaughtErrors[0]).toEqual(expect.any(Error))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange.mock.calls[1][0]).toEqual({ name: 'Grace' })
  })

  it('onChangeError 应接收异步 onChange 异常且不阻塞后续批次', async () => {
    const onChange = jest.fn(() => {
      throw new Error('change failed')
    })
    const onChangeError = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: { name: { type: 'string', title: 'Name' } },
    }
    const { formRef } = renderDynamicForm({
      props: { schema, onChange, onChangeError },
    })
    await waitForFormReady({ formRef })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('name', 'Ada')
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChangeError).toHaveBeenCalledTimes(1)
    expect(onChangeError.mock.calls[0][0]).toEqual(
      expect.objectContaining({ message: 'change failed' }),
    )
  })
})
