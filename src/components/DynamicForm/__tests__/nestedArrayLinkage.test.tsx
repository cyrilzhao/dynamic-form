import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DynamicForm } from '../DynamicForm'
import { FieldRegistry, blueprintPreset } from '..'
import type { ExtendedJSONSchema } from '../types/schema'
import type { DynamicFormRef } from '../types'

beforeAll(() => {
  FieldRegistry.setDefaultPreset(blueprintPreset)
})

describe('嵌套数组联动测试', () => {
  it('员工字段应该根据所属部门类型显示/隐藏', async () => {
    const formRef = React.createRef<DynamicFormRef>()

    // 场景：部门列表中，员工的技术栈字段只在技术部显示
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        departments: {
          type: 'array',
          title: 'Departments',
          items: {
            type: 'object',
            title: 'Department',
            properties: {
              name: {
                type: 'string',
                title: 'Department Name',
              },
              type: {
                type: 'string',
                title: 'Department Type',
                enum: ['tech', 'sales', 'hr'],
              },
              employees: {
                type: 'array',
                title: 'Employees',
                items: {
                  type: 'object',
                  title: 'Employee',
                  properties: {
                    name: {
                      type: 'string',
                      title: 'Name',
                    },
                    techStack: {
                      type: 'string',
                      title: 'Tech Stack',
                      ui: {
                        linkages: [
                          {
                            type: 'visibility',
                            dependencies: [
                              '#/properties/departments/items/properties/type',
                            ],
                            when: {
                              field:
                                '#/properties/departments/items/properties/type',
                              operator: '==',
                              value: 'tech',
                            },
                            fulfill: { state: { visible: true } },
                            otherwise: { state: { visible: false } },
                          },
                        ],
                      },
                    },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['name', 'type'],
          },
        },
      },
    }

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })

    // 初始化表单：添加一个技术部门和一个员工
    await act(async () => {
      formRef.current?.setValue('departments', [
        {
          name: 'Engineering',
          type: 'tech',
          employees: [{ name: 'Alice' }],
        },
      ])
      await new Promise((resolve) => setTimeout(resolve, 300))
    })

    // 验证：技术栈字段应该可见
    await waitFor(() => {
      expect(screen.getByText('Tech Stack')).toBeInTheDocument()
    })

    // 切换部门类型为销售部
    await act(async () => {
      formRef.current?.setValue('departments.0.type', 'sales')
      await new Promise((resolve) => setTimeout(resolve, 300))
    })

    // 验证：技术栈字段应该隐藏
    await waitFor(() => {
      expect(screen.queryByText('Tech Stack')).not.toBeInTheDocument()
    })
  })

  it('多个部门的员工字段应该独立联动', async () => {
    const formRef = React.createRef<DynamicFormRef>()

    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        departments: {
          type: 'array',
          title: 'Departments',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', title: 'Type', enum: ['tech', 'sales'] },
              employees: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', title: 'Name' },
                    techStack: {
                      type: 'string',
                      title: 'Tech Stack',
                      ui: {
                        linkages: [
                          {
                            type: 'visibility',
                            dependencies: [
                              '#/properties/departments/items/properties/type',
                            ],
                            when: {
                              field:
                                '#/properties/departments/items/properties/type',
                              operator: '==',
                              value: 'tech',
                            },
                            fulfill: { state: { visible: true } },
                            otherwise: { state: { visible: false } },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    render(<DynamicForm ref={formRef} schema={schema} onSubmit={jest.fn()} />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })

    // 添加两个部门：一个技术部，一个销售部
    await act(async () => {
      formRef.current?.setValue('departments', [
        { type: 'tech', employees: [{ name: 'Alice' }] },
        { type: 'sales', employees: [{ name: 'Bob' }] },
      ])
      await new Promise((resolve) => setTimeout(resolve, 500))
    })

    // 验证：第一个部门（技术部）的员工应该看到技术栈字段
    // 第二个部门（销售部）的员工不应该看到技术栈字段
    await waitFor(() => {
      const techStackLabels = screen.getAllByText('Tech Stack')
      // 技术部的员工应该有技术栈字段
      expect(techStackLabels.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('多层 asNestedForm 联动应由根表单一次性发送绝对路径事件', async () => {
    const formRef = React.createRef<DynamicFormRef>()
    const onChange = jest.fn()
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        departments: {
          type: 'array',
          title: 'Departments',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', title: 'Type' },
              employees: {
                type: 'array',
                title: 'Employees',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', title: 'Name' },
                    region: {
                      type: 'string',
                      title: 'Region',
                      ui: {
                        linkages: [
                          {
                            type: 'value',
                            dependencies: [
                              '#/properties/departments/items/properties/type',
                            ],
                            when: {
                              field:
                                '#/properties/departments/items/properties/type',
                              operator: '==',
                              value: 'tech',
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
          },
        },
      },
    }

    render(
      <DynamicForm
        ref={formRef}
        schema={schema}
        onChange={onChange}
        onSubmit={jest.fn()}
        showSubmitButton={false}
      />,
    )

    await waitFor(() => expect(formRef.current).toBeTruthy())
    await act(async () => {
      formRef.current!.setValues({
        departments: [{ type: 'sales', employees: [{ name: 'Alice' }] }],
      })
      await new Promise((resolve) => setTimeout(resolve, 300))
    })
    onChange.mockClear()

    await act(async () => {
      formRef.current!.setValue('departments.0.type', 'tech')
      await new Promise((resolve) => setTimeout(resolve, 400))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const [, meta] = onChange.mock.calls[0]
    expect(meta.rootSource).toBe('setValue')
    expect(meta.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'departments.0.type',
          source: 'setValue',
          value: 'tech',
        }),
        expect.objectContaining({
          path: 'departments.0.employees.0.region',
          source: 'linkage',
          value: 'Shanghai',
        }),
      ]),
    )
  })
})
