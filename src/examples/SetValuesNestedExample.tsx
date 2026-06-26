import React, { useRef, useMemo, useState } from 'react'
import { DynamicForm } from '@/components/DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import type { DynamicFormRef } from '@/components/DynamicForm'
import { Button, Card, Pre } from '@blueprintjs/core'

/**
 * 测试通过 ref.current.setValues 设置嵌套表单值的场景
 *
 * 覆盖场景：
 * - 嵌套对象（nested-form）
 * - 深层嵌套（nested-form 内的 nested-form）
 * - 基本类型数组（string[]）
 * - 对象数组（table-array）
 */
export const SetValuesNestedExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)
  const [currentValues, setCurrentValues] = useState<Record<string, any>>({})

  const schema: ExtendedJSONSchema = useMemo(
    () => ({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          ui: { placeholder: 'Enter name' },
        },
        email: {
          type: 'string',
          title: 'Email',
          format: 'email',
          ui: { placeholder: 'Enter email' },
        },
        // 场景1：静态嵌套表单
        address: {
          type: 'object',
          title: 'Address (nested-form)',
          properties: {
            street: {
              type: 'string',
              title: 'Street',
              ui: { placeholder: 'Enter street' },
            },
            city: {
              type: 'string',
              title: 'City',
              ui: { placeholder: 'Enter city' },
            },
            zipCode: {
              type: 'string',
              title: 'Zip Code',
              ui: { placeholder: 'Enter zip code' },
            },
          },
          required: ['city'],
          ui: { widget: 'nested-form' },
        },
        // 场景2：多层嵌套
        company: {
          type: 'object',
          title: 'Company (deep nested)',
          properties: {
            companyName: {
              type: 'string',
              title: 'Company Name',
              ui: { placeholder: 'Enter company name' },
            },
            location: {
              type: 'object',
              title: 'Location',
              properties: {
                country: {
                  type: 'string',
                  title: 'Country',
                  ui: { placeholder: 'Enter country' },
                },
                city: {
                  type: 'string',
                  title: 'City',
                  ui: { placeholder: 'Enter city' },
                },
              },
              ui: { widget: 'nested-form' },
            },
          },
          ui: { widget: 'nested-form' },
        },
        // 场景3：基本类型数组
        tags: {
          type: 'array',
          title: 'Tags (string[])',
          items: { type: 'string' },
          ui: { arrayMode: 'dynamic' },
        },
        // 场景4：对象数组（表格）
        contacts: {
          type: 'array',
          title: 'Contacts (table-array)',
          items: {
            type: 'object',
            properties: {
              contactName: {
                type: 'string',
                title: 'Contact Name',
              },
              phone: {
                type: 'string',
                title: 'Phone',
              },
            },
          },
          ui: { widget: 'table-array' },
        },
      },
      required: ['name'],
    }),
    []
  )

  // 模拟从 API 获取的完整数据
  const mockFullData: Record<string, any> = {
    name: 'John Doe',
    email: 'john@example.com',
    address: {
      street: '123 Main St',
      city: 'New York',
      zipCode: '10001',
    },
    company: {
      companyName: 'Acme Inc',
      location: {
        country: 'USA',
        city: 'San Francisco',
      },
    },
    tags: ['frontend', 'react', 'typescript'],
    contacts: [
      { contactName: 'Alice', phone: '123-4567' },
      { contactName: 'Bob', phone: '890-1234' },
    ],
  }

  // 测试1：设置全部数据
  const handleSetAllValues = () => {
    formRef.current?.setValues(mockFullData)
  }

  // 测试2：只设置顶层字段
  const handleSetTopLevelOnly = () => {
    formRef.current?.setValues({
      name: 'Jane Smith',
      email: 'jane@example.com',
    })
  }

  // 测试3：设置嵌套对象
  const handleSetNestedObject = () => {
    formRef.current?.setValues({
      address: {
        street: '456 Oak Ave',
        city: 'Los Angeles',
        zipCode: '90001',
      },
    })
  }

  // 测试4：使用点路径设置嵌套字段
  const handleSetNestedDotPath = () => {
    formRef.current?.setValues({
      'address.street': '789 Pine Rd',
      'address.city': 'Chicago',
      'address.zipCode': '60601',
    })
  }

  // 测试5：设置深层嵌套字段
  const handleSetDeepNested = () => {
    formRef.current?.setValues({
      company: {
        companyName: 'Tech Corp',
        location: {
          country: 'Canada',
          city: 'Toronto',
        },
      },
    })
  }

  // 测试6：设置基本类型数组
  const handleSetPrimitiveArray = () => {
    formRef.current?.setValues({
      tags: ['vue', 'angular', 'svelte'],
    })
  }

  // 测试7：设置对象数组
  const handleSetObjectArray = () => {
    formRef.current?.setValues({
      contacts: [
        { contactName: 'Charlie', phone: '555-0001' },
        { contactName: 'Diana', phone: '555-0002' },
        { contactName: 'Eve', phone: '555-0003' },
      ],
    })
  }

  // 测试8：reset 完整数据
  const handleResetWithValues = () => {
    formRef.current?.reset(mockFullData)
  }

  // 读取当前表单值
  const handleReadValues = () => {
    const values = formRef.current?.getValues()
    setCurrentValues(values ?? {})
  }

  // 清空表单
  const handleClear = () => {
    formRef.current?.reset({})
    setCurrentValues({})
  }

  const handleSubmit = (data: Record<string, any>) => {
    setCurrentValues(data)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>setValues 嵌套表单测试</h2>
      <p>
        测试通过 ref.current.setValues
        设置嵌套表单值时，内部字段是否能正确显示。
      </p>

      <Card style={{ marginBottom: '16px', padding: '16px' }}>
        <h4>嵌套对象测试</h4>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <Button intent="primary" onClick={handleSetAllValues}>
            setValues: 设置全部数据
          </Button>
          <Button intent="primary" onClick={handleSetTopLevelOnly}>
            setValues: 仅顶层字段
          </Button>
          <Button intent="warning" onClick={handleSetNestedObject}>
            setValues: 嵌套对象（address）
          </Button>
          <Button intent="warning" onClick={handleSetNestedDotPath}>
            setValues: 点路径（address.city）
          </Button>
          <Button intent="warning" onClick={handleSetDeepNested}>
            setValues: 深层嵌套（company.location）
          </Button>
        </div>

        <h4>数组测试</h4>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <Button intent="primary" onClick={handleSetPrimitiveArray}>
            setValues: 基本类型数组（tags）
          </Button>
          <Button intent="primary" onClick={handleSetObjectArray}>
            setValues: 对象数组（contacts）
          </Button>
        </div>

        <h4>其他</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <Button intent="success" onClick={handleResetWithValues}>
            reset: 用完整数据重置
          </Button>
          <Button onClick={handleReadValues}>读取当前值</Button>
          <Button intent="danger" onClick={handleClear}>
            清空表单
          </Button>
        </div>
      </Card>

      <Card style={{ marginBottom: '16px' }}>
        <DynamicForm ref={formRef} schema={schema} onSubmit={handleSubmit} />
      </Card>

      {Object.keys(currentValues).length > 0 && (
        <Card>
          <h4>当前表单值</h4>
          <Pre>{JSON.stringify(currentValues, null, 2)}</Pre>
        </Card>
      )}
    </div>
  )
}
