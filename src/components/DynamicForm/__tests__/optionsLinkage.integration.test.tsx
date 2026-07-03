import '@testing-library/jest-dom'
import { screen, waitFor } from '@testing-library/react'
import type { ExtendedJSONSchema } from '../types/schema'
import {
  refreshLinkage,
  renderDynamicForm,
  setFieldValue,
  setupDynamicFormTest,
  waitForFormReady,
} from '../__testUtils__/linkageTestHelpers'

beforeAll(setupDynamicFormTest)

describe('options 联动集成测试', () => {
  it('应该通过静态配置切换选项并清空不合法旧值', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        plan: { type: 'string', title: 'Plan', default: 'basic' },
        addOn: {
          type: 'string',
          title: 'Add-on',
          ui: {
            widget: 'radio',
            linkages: [
              {
                type: 'options',
                dependencies: ['#/properties/plan'],
                when: { field: 'plan', operator: '==', value: 'enterprise' },
                fulfill: {
                  options: [
                    { label: 'Email Support', value: 'email' },
                    { label: 'API Access', value: 'api' },
                  ],
                },
                otherwise: {
                  options: [
                    { label: 'Email Support', value: 'email' },
                    { label: 'SMS Support', value: 'sms' },
                  ],
                },
              },
            ],
          },
        },
      },
    }

    const { formRef } = renderDynamicForm({
      props: { schema, defaultValues: { addOn: 'sms' } },
    })
    await waitForFormReady({ formRef })
    await refreshLinkage({ formRef })

    expect(screen.getByLabelText('SMS Support')).toBeInTheDocument()
    expect(formRef.current!.getValue('addOn')).toBe('sms')

    await setFieldValue({ formRef, name: 'plan', value: 'enterprise' })

    await waitFor(() => {
      expect(screen.getByLabelText('API Access')).toBeInTheDocument()
      expect(screen.queryByLabelText('SMS Support')).not.toBeInTheDocument()
      expect(formRef.current!.getValue('addOn')).toBeUndefined()
    })
  })

  it('应该支持通过函数动态返回选项', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        country: { type: 'string', title: 'Country', default: 'cn' },
        city: {
          type: 'string',
          title: 'City',
          ui: {
            widget: 'radio',
            linkages: [
              {
                type: 'options',
                dependencies: ['#/properties/country'],
                fulfill: { function: 'getCities' },
              },
            ],
          },
        },
      },
    }

    const linkageFunctions = {
      getCities: (formData: Record<string, unknown>) =>
        formData.country === 'us'
          ? [
              { label: 'New York', value: 'ny' },
              { label: 'Seattle', value: 'sea' },
            ]
          : [
              { label: 'Beijing', value: 'bj' },
              { label: 'Shanghai', value: 'sh' },
            ],
    }

    const { formRef } = renderDynamicForm({
      props: { schema, linkageFunctions },
    })
    await waitForFormReady({ formRef })
    await refreshLinkage({ formRef })

    expect(screen.getByLabelText('Beijing')).toBeInTheDocument()

    await setFieldValue({ formRef, name: 'country', value: 'us' })

    await waitFor(() => {
      expect(screen.getByLabelText('Seattle')).toBeInTheDocument()
      expect(screen.queryByLabelText('Shanghai')).not.toBeInTheDocument()
    })
  })
})
