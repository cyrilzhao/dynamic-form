import '@testing-library/jest-dom'
import { act, waitFor } from '@testing-library/react'
import type { ExtendedJSONSchema } from '../types/schema'
import {
  getInputByName,
  refreshLinkage,
  renderDynamicForm,
  setFieldValue,
  setupDynamicFormTest,
  waitForFormReady,
} from '../__testUtils__/linkageTestHelpers'

beforeAll(setupDynamicFormTest)

describe('visibility 联动集成测试', () => {
  it('应该根据条件显示和隐藏字段，并跳过隐藏字段的必填校验', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      required: ['reason'],
      properties: {
        status: {
          type: 'string',
          title: 'Status',
          default: 'draft',
        },
        reason: {
          type: 'string',
          title: 'Reason',
          ui: {
            placeholder: 'Please enter reason',
            linkages: [
              {
                type: 'visibility',
                dependencies: ['#/properties/status'],
                when: {
                  field: 'status',
                  operator: '==',
                  value: 'rejected',
                },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    }

    const { formRef, container } = renderDynamicForm({ props: { schema } })
    await waitForFormReady({ formRef })
    await refreshLinkage({ formRef })

    await waitFor(() => {
      expect(getInputByName({ container, name: 'reason' })).not.toBeInTheDocument()
    })

    await act(async () => {
      await formRef.current!.validate()
    })
    expect(formRef.current!.getErrors().reason).toBeUndefined()

    await setFieldValue({ formRef, name: 'status', value: 'rejected' })

    await waitFor(() => {
      expect(getInputByName({ container, name: 'reason' })).toBeInTheDocument()
    })

    await act(async () => {
      await formRef.current!.validate()
    })
    expect(formRef.current!.getErrors().reason).toBeTruthy()
  })

  it('多个 visibility 联动应该使用 AND 逻辑合并', async () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        hasAccess: { type: 'boolean', title: 'Has Access', default: true },
        region: { type: 'string', title: 'Region', default: 'cn' },
        endpoint: {
          type: 'string',
          title: 'Endpoint',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['#/properties/hasAccess'],
                when: { field: 'hasAccess', operator: '==', value: true },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
              {
                type: 'visibility',
                dependencies: ['#/properties/region'],
                when: { field: 'region', operator: '==', value: 'us' },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
      },
    }

    const { formRef, container } = renderDynamicForm({ props: { schema } })
    await waitForFormReady({ formRef })
    await refreshLinkage({ formRef })

    expect(getInputByName({ container, name: 'endpoint' })).not.toBeInTheDocument()

    await setFieldValue({ formRef, name: 'region', value: 'us' })

    await waitFor(() => {
      expect(getInputByName({ container, name: 'endpoint' })).toBeInTheDocument()
    })

    await setFieldValue({ formRef, name: 'hasAccess', value: false })

    await waitFor(() => {
      expect(getInputByName({ container, name: 'endpoint' })).not.toBeInTheDocument()
    })
  })
})
