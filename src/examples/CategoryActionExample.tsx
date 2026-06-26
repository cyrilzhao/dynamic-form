import React, { useRef } from 'react'
import { Card, Button } from '@blueprintjs/core'
import { DynamicForm, type DynamicFormRef } from '@/components/DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import type { LinkageFunction } from '@/components/DynamicForm'

/**
 * Category-Action 联动示例
 *
 * 场景说明：
 * 1. category 字段变化时，action 字段的值会被清空
 * 2. 同时根据 category 的值异步加载 action 的选项列表
 *
 * 实现方式：
 * - 使用 options 类型联动
 * - 在联动函数中通过 form.setValue() 清空 action 的值
 * - 异步请求接口获取新的选项列表
 */

// 模拟 API 请求：根据 category 获取 action 列表
const fetchActionsByCategory = async (
  category: string
): Promise<Array<{ label: string; value: string }>> => {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 500))

  // 模拟不同 category 对应的 action 列表
  const actionsMap: Record<string, Array<{ label: string; value: string }>> = {
    user: [
      { label: 'Create User', value: 'create_user' },
      { label: 'Update User', value: 'update_user' },
      { label: 'Delete User', value: 'delete_user' },
      { label: 'List Users', value: 'list_users' },
    ],
    product: [
      { label: 'Add Product', value: 'add_product' },
      { label: 'Update Product', value: 'update_product' },
      { label: 'Remove Product', value: 'remove_product' },
      { label: 'Search Products', value: 'search_products' },
    ],
    order: [
      { label: 'Create Order', value: 'create_order' },
      { label: 'Cancel Order', value: 'cancel_order' },
      { label: 'Refund Order', value: 'refund_order' },
      { label: 'Track Order', value: 'track_order' },
    ],
  }

  return actionsMap[category] || []
}

// Schema 定义
const schema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Category-Action Form',
  properties: {
    category: {
      type: 'string',
      title: 'Category',
      enum: ['user', 'product', 'order'],
      enumNames: ['User Management', 'Product Management', 'Order Management'],
      ui: {
        widget: 'select',
        placeholder: 'Please select a category',
      },
    },
    action: {
      type: 'string',
      title: 'Action',
      ui: {
        widget: 'select',
        placeholder: 'Please select an action',
        linkages: [
          {
            type: 'options',
            dependencies: ['#/properties/category'],
            enableCache: true, // 启用缓存，避免重复请求
            fulfill: {
              function: 'loadActionOptions',
            },
          },
        ],
      },
    },
    description: {
      type: 'string',
      title: 'Description',
      ui: {
        widget: 'textarea',
        placeholder: 'Optional description',
        widgetProps: {
          rows: 3,
        },
      },
    },
  },
  required: ['category', 'action'],
}

export const CategoryActionExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)

  // 联动函数：加载 action 选项并清空当前值
  const linkageFunctions: Record<string, LinkageFunction> = {
    loadActionOptions: async (formData: any) => {
      const { category } = formData

      // 如果没有选择 category，返回空选项
      if (!category) {
        return []
      }

      // 清空 action 字段的值
      // 注意：这里通过 formRef 直接访问表单方法
      if (formRef.current) {
        const currentAction = formRef.current.getValue('action')

        // 只有当 action 有值时才清空（避免不必要的更新）
        if (currentAction) {
          formRef.current.setValue('action', '', {
            shouldValidate: false, // 清空时不触发验证
            shouldDirty: true,
          })
        }
      }

      // 异步加载新的选项列表
      try {
        const options = await fetchActionsByCategory(category)
        return options
      } catch (error) {
        console.error('Failed to load actions:', error)
        return []
      }
    },
  }

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data)
    alert(
      `Submitted:\nCategory: ${data.category}\nAction: ${data.action}\nDescription: ${data.description || 'N/A'}`
    )
  }

  const handleReset = () => {
    formRef.current?.reset()
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <h2>Category-Action Linkage Example</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          This example demonstrates how to:
        </p>
        <ul style={{ color: '#666', marginBottom: '20px' }}>
          <li>
            Clear the <code>action</code> field value when <code>category</code>{' '}
            changes
          </li>
          <li>
            Dynamically load <code>action</code> options based on the selected{' '}
            <code>category</code>
          </li>
          <li>Use async API calls in linkage functions</li>
          <li>Enable caching to avoid duplicate requests</li>
        </ul>

        <DynamicForm
          ref={formRef}
          schema={schema}
          linkageFunctions={linkageFunctions}
          onSubmit={handleSubmit}
          layout="vertical"
        />

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <Button onClick={handleReset}>Reset Form</Button>
        </div>
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <h3>Implementation Notes</h3>
        <div style={{ color: '#666' }}>
          <h4>Key Points:</h4>
          <ol>
            <li>
              <strong>Single Linkage Type:</strong> DynamicForm only supports
              one linkage type per field. We use <code>options</code> type here.
            </li>
            <li>
              <strong>Manual Value Clearing:</strong> Inside the{' '}
              <code>loadActionOptions</code> function, we manually call{' '}
              <code>form.setValue('action', '')</code> to clear the value.
            </li>
            <li>
              <strong>Form Instance Access:</strong> We use{' '}
              <code>formRef.current.getFormInstance()</code>
              to access the react-hook-form instance.
            </li>
            <li>
              <strong>Async Support:</strong> The linkage function is async and
              fetches data from an API.
            </li>
            <li>
              <strong>Caching:</strong> <code>enableCache: true</code> prevents
              duplicate API calls when switching back to a previously selected
              category.
            </li>
          </ol>

          <h4>Limitations:</h4>
          <ul>
            <li>
              Cannot define both <code>value</code> and <code>options</code>{' '}
              linkage in the same config.
            </li>
            <li>
              Value clearing must be done manually inside the linkage function.
            </li>
            <li>Requires access to the form instance via ref.</li>
          </ul>

          <h4>Alternative Approach:</h4>
          <p>
            If you need more complex logic (e.g., conditional value clearing,
            multiple dependent fields), consider using a custom hook that
            watches the <code>category</code> field and handles both value
            clearing and options loading separately.
          </p>
        </div>
      </Card>
    </div>
  )
}
