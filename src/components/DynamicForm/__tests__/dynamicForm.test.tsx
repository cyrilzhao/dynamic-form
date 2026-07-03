import '@testing-library/jest-dom'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ExtendedJSONSchema } from '../types/schema'
import {
  getInputByName,
  renderDynamicForm,
  setFieldValue,
  setupDynamicFormTest,
  waitForFormReady,
} from '../__testUtils__/linkageTestHelpers'

beforeAll(setupDynamicFormTest)

describe('DynamicForm', () => {
  it('应该合并 schema default 和 defaultValues，并在 getValues 时解包基本类型数组赋值', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          title: 'Username',
          default: 'schema-user',
        },
        tags: {
          type: 'array',
          title: 'Tags',
          default: ['alpha', 'beta'],
          items: {
            type: 'string',
            enum: ['alpha', 'beta', 'gamma'],
          },
          ui: {
            arrayMode: 'static',
          },
        },
      },
    }

    const { formRef } = renderDynamicForm({
      props: {
        schema,
        defaultValues: {
          username: 'custom-user',
        },
      },
    })

    await waitForFormReady({ formRef })

    expect(formRef.current!.getValue('username')).toBe('custom-user')

    await act(async () => {
      formRef.current!.setValues({
        tags: ['gamma'],
      })
    })

    expect(formRef.current!.getValues()).toEqual({
      username: 'custom-user',
      tags: ['gamma'],
    })
  })

  it('setValues 应该递归更新嵌套对象字段的 Controller', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        address: {
          type: 'object',
          title: 'Address',
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
    }

    const { formRef, container } = renderDynamicForm({ props: { schema } })
    await waitForFormReady({ formRef })

    await act(async () => {
      formRef.current!.setValues({
        address: {
          street: 'Main Street',
          city: 'Paris',
        },
      })
    })

    expect(getInputByName({ container, name: 'address.street' })).toHaveValue(
      'Main Street'
    )
    expect(getInputByName({ container, name: 'address.city' })).toHaveValue(
      'Paris'
    )
  })

  it('reset 空值时应该按 schema 类型清空字段', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          title: 'Title',
        },
        enabled: {
          type: 'boolean',
          title: 'Enabled',
        },
        address: {
          type: 'object',
          title: 'Address',
          properties: {
            street: {
              type: 'string',
              title: 'Street',
            },
          },
        },
      },
    }

    const { formRef, container } = renderDynamicForm({ props: { schema } })
    await waitForFormReady({ formRef })

    await act(async () => {
      formRef.current!.setValues({
        title: 'Draft',
        enabled: true,
        address: { street: 'Main Street' },
      })
      formRef.current!.reset()
    })

    expect(getInputByName({ container, name: 'title' })).toHaveValue('')
    expect(getInputByName({ container, name: 'enabled' })).not.toBeChecked()
    expect(getInputByName({ container, name: 'address.street' })).toHaveValue(
      ''
    )
  })

  it('ref API 应该对 setValue/getValue/getValues 应用字段 transform', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        rate: {
          type: 'number',
          title: 'Rate',
          ui: {
            transform: {
              callback: 'toStorageRate',
              reverseCallback: 'toDisplayRate',
            },
          },
        },
      },
    }

    const callbacks = {
      toStorageRate: (value: number) => value / 100,
      toDisplayRate: (value: number) => value * 100,
    }

    const { formRef, container } = renderDynamicForm({
      props: { schema, callbacks },
    })
    await waitForFormReady({ formRef })

    await setFieldValue({ formRef, name: 'rate', value: 0.45 })

    await waitFor(() => {
      expect(getInputByName({ container, name: 'rate' })).toHaveValue('45')
    })
    expect(formRef.current!.getValue('rate')).toBe(0.45)
    expect(formRef.current!.getValues()).toEqual({ rate: 0.45 })
  })

  it('onChange 和 onSubmit 应该返回转换并按 schema 过滤后的数据', async () => {
    const handleChange = jest.fn()
    const handleSubmit = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        percent: {
          type: 'number',
          title: 'Percent',
          ui: {
            transform: {
              callback: 'toRatio',
              reverseCallback: 'toPercent',
            },
          },
        },
        note: {
          type: 'string',
          title: 'Note',
        },
      },
    }

    const callbacks = {
      toRatio: (value: number) => value / 100,
      toPercent: (value: number) => value * 100,
    }

    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        callbacks,
        onChange: handleChange,
        onSubmit: handleSubmit,
      },
    })
    await waitForFormReady({ formRef })

    await act(async () => {
      formRef.current!.setValues({
        percent: 0.2,
        note: 'Ready',
        extra: 'should be filtered',
      })
    })

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          percent: 0.2,
          note: 'Ready',
        })
      )
    })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        percent: 0.2,
        note: 'Ready',
      })
    })
  })

  it('应该支持 validate、getErrors、setError 和 clearErrors', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          title: 'Email',
          format: 'email',
        },
      },
    }

    const { formRef } = renderDynamicForm({
      props: { schema, validateMode: 'onSubmit' },
    })
    await waitForFormReady({ formRef })

    await act(async () => {
      await formRef.current!.validate()
    })
    expect(formRef.current!.getErrors().email).toBeTruthy()

    act(() => {
      formRef.current!.clearErrors('email')
    })
    expect(formRef.current!.getErrors().email).toBeUndefined()

    act(() => {
      formRef.current!.setError('email', {
        type: 'manual',
        message: 'Manual error',
      })
    })
    expect(formRef.current!.getErrors().email).toBeTruthy()
  })

  it('应该根据 renderAsForm 和 showSubmitButton 控制外层标签和提交按钮', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
      },
    }

    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        renderAsForm: false,
        showSubmitButton: false,
        className: 'custom-form',
        style: { padding: 12 },
      },
    })
    await waitForFormReady({ formRef })

    expect(container.querySelector('form')).not.toBeInTheDocument()
    expect(container.querySelector('.dynamic-form.custom-form')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
  })

  it('loading 状态下应该禁用提交按钮并显示提交中状态', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
      },
    }

    const { formRef } = renderDynamicForm({
      props: {
        schema,
        loading: true,
      },
    })
    await waitForFormReady({ formRef })

    const button = screen.getByRole('button', { name: 'Submitting...' })
    expect(button).toBeDisabled()
  })

  it('showErrorList 开启后应该渲染表单级错误列表', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
      },
    }

    const { formRef, container } = renderDynamicForm({
      props: {
        schema,
        showErrorList: true,
      },
    })
    await waitForFormReady({ formRef })

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })

    await waitFor(() => {
      expect(screen.getAllByText('Name is required').length).toBeGreaterThan(0)
    })
  })
})
