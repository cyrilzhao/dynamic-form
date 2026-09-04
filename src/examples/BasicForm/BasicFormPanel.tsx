import React, { useEffect, useRef } from 'react'
import { DynamicForm, type DynamicFormRef } from '@/components/DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import { Card } from '@blueprintjs/core'
import { CodeEditorWidget } from '@/components/DynamicForm'
import { ObjectEditorWidget } from '@/components/DynamicForm'
import { SchemaBuilderWidget } from '@/components/DynamicForm/widgets/SchemaBuilderWidget'
import type { CallbackFunction } from '@/components/DynamicForm/types'

export const BasicFormPanel: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)
  // 保存延迟初始化写入的定时器，确保 StrictMode 开发检查和组件卸载时都能取消旧任务，
  // React 18 StrictMode 会在开发环境重复执行一次 effect；若不清理，setValues 会执行两次，
  // 第二次写入因值已相同而被正确去重，从而让示例看起来像“setValues 没有触发 onChange”。
  const initialValuesTimerRef = useRef<number | null>(null)

  useEffect(() => {
    // 将示例表单引用暴露给浏览器调试工具，但必须在 effect 中修改 window，
    // 避免渲染阶段产生副作用并触发 React Compiler 的不可变性检查。
    const debugWindow = window as Window & {
      __formRef?: typeof formRef
    }
    debugWindow.__formRef = formRef

    return () => {
      // 仅清理仍指向当前组件的引用，避免 StrictMode 重挂载时误删新实例引用。
      if (debugWindow.__formRef === formRef) {
        delete debugWindow.__formRef
      }
    }
  }, [])

  // const schema: ExtendedJSONSchema = {
  //   type: 'object',
  //   title: '用户注册表单',
  //   properties: {
  //     username: {
  //       type: 'string',
  //       title: '用户名',
  //       minLength: 3,
  //       maxLength: 20,
  //       default: 'aaa',
  //       ui: {
  //         placeholder: '请输入用户名',
  //         errorMessages: {
  //           required: '用户名不能为空',
  //           minLength: '用户名至少3个字符',
  //           maxLength: '用户名最多20个字符',
  //         },
  //       },
  //     },
  //     hiddenUsername: {
  //       type: 'string',
  //       title: '用户名',
  //       minLength: 3,
  //       maxLength: 20,
  //       default: 'bbb',
  //       ui: {
  //         hidden: true,
  //         placeholder: '请输入用户名',
  //         errorMessages: {
  //           required: '用户名不能为空',
  //           minLength: '用户名至少3个字符',
  //           maxLength: '用户名最多20个字符',
  //         },
  //       },
  //     },
  //     email: {
  //       type: 'string',
  //       title: '邮箱',
  //       format: 'email',
  //       ui: {
  //         placeholder: 'example@email.com',
  //       },
  //     },
  //     website: {
  //       type: 'string',
  //       title: '个人网站',
  //       format: 'uri',
  //       ui: {
  //         widget: 'url',
  //         placeholder: 'https://example.com',
  //         errorMessages: {
  //           format: '请输入有效的 URL 地址',
  //         },
  //       },
  //     },
  //     phone: {
  //       type: 'string',
  //       title: '手机号',
  //       format: 'phone',
  //       ui: {
  //         placeholder: '请输入手机号',
  //         errorMessages: {
  //           format: '请输入有效的手机号码',
  //         },
  //       },
  //     },
  //     password: {
  //       type: 'string',
  //       title: '密码',
  //       minLength: 6,
  //       ui: {
  //         widget: 'password',
  //         placeholder: '至少6位字符',
  //       },
  //     },
  //     age: {
  //       type: 'integer',
  //       title: '年龄',
  //       minimum: 18,
  //       maximum: 100,
  //     },
  //     country: {
  //       type: 'string',
  //       title: '国家',
  //       enum: ['china', 'usa', 'japan', 'uk', 'other'],
  //       enumNames: ['中国', '美国', '日本', '英国', '其他'],
  //       ui: {
  //         widget: 'select',
  //         placeholder: '请选择国家',
  //       },
  //     },
  //     countrySearchable: {
  //       type: 'string',
  //       title: '国家（本地搜索）',
  //       enum: ['china', 'usa', 'japan', 'uk', 'other'],
  //       enumNames: ['中国', '美国', '日本', '英国', '其他'],
  //       ui: {
  //         widget: 'select',
  //         placeholder: '输入关键词搜索国家',
  //         widgetProps: {
  //           searchable: true,
  //           clearable: true,
  //         },
  //       },
  //     },
  //     asyncLanguage: {
  //       type: 'string',
  //       title: '编程语言（异步搜索）',
  //       ui: {
  //         widget: 'select',
  //         placeholder: '输入关键词异步搜索',
  //         widgetProps: {
  //           searchable: true,
  //           clearable: true,
  //           onSearch: async (term: string) => {
  //             const all = [
  //               { label: 'TypeScript', value: 'ts' },
  //               { label: 'JavaScript', value: 'js' },
  //               { label: 'Python', value: 'py' },
  //               { label: 'Rust', value: 'rs' },
  //               { label: 'Go', value: 'go' },
  //               { label: 'Java', value: 'java' },
  //               { label: 'C++', value: 'cpp' },
  //               { label: 'Swift', value: 'swift' },
  //             ]
  //             await new Promise((r) => setTimeout(r, 400))
  //             if (!term) return all
  //             return all.filter((o) =>
  //               o.label.toLowerCase().includes(term.toLowerCase())
  //             )
  //           },
  //         },
  //       },
  //     },
  //     techStack: {
  //       type: 'array',
  //       title: '技术栈（多选 + 搜索）',
  //       items: { type: 'string' },
  //       ui: {
  //         widget: 'select',
  //         placeholder: '选择或搜索技术栈',
  //         widgetProps: {
  //           multiple: true,
  //           searchable: true,
  //           clearable: true,
  //           onSearch: async (term: string) => {
  //             const all = [
  //               { label: 'TypeScript', value: 'ts' },
  //               { label: 'JavaScript', value: 'js' },
  //               { label: 'React', value: 'react' },
  //               { label: 'Vue', value: 'vue' },
  //               { label: 'Node.js', value: 'node' },
  //               { label: 'Python', value: 'py' },
  //               { label: 'Go', value: 'go' },
  //               { label: 'Rust', value: 'rs' },
  //               { label: 'Docker', value: 'docker' },
  //               { label: 'Kubernetes', value: 'k8s' },
  //             ]
  //             await new Promise((r) => setTimeout(r, 300))
  //             if (!term) return all
  //             return all.filter((o) =>
  //               o.label.toLowerCase().includes(term.toLowerCase())
  //             )
  //           },
  //         },
  //       },
  //     },
  //     gender: {
  //       type: 'string',
  //       title: '性别',
  //       enum: ['male', 'female', 'other'],
  //       enumNames: ['男', '女', '其他'],
  //       ui: {
  //         widget: 'radio',
  //       },
  //     },
  //     introduction: {
  //       type: 'string',
  //       title: '个人简介',
  //       maxLength: 500,
  //       ui: {
  //         widget: 'textarea',
  //         placeholder: '介绍一下自己...',
  //       },
  //     },
  //     config: {
  //       type: 'string',
  //       title: '配置信息 (JSON)',
  //       ui: {
  //         widget: 'code-editor',
  //         widgetProps: {
  //           language: 'json',
  //           config: {
  //             previewLines: 5,
  //             previewMaxHeight: 150,
  //           },
  //         },
  //       },
  //     },
  //     authScript: {
  //       type: 'string',
  //       title: '鉴权脚本',
  //       ui: {
  //         widget: 'code-editor',
  //         widgetProps: {
  //           language: 'javascript',
  //           config: {
  //             previewLines: 5,
  //             previewMaxHeight: 150,
  //           },
  //         },
  //       },
  //     },
  //     metadata: {
  //       type: 'object',
  //       title: '元数据 (Object)',
  //       ui: {
  //         widget: 'object-editor',
  //         widgetProps: {
  //           config: {
  //             previewLines: 5,
  //             previewMaxHeight: 150,
  //           },
  //         },
  //       },
  //     },
  //     receiveNewsletter: {
  //       type: 'boolean',
  //       title: '订阅新闻邮件',
  //       ui: {
  //         widget: 'switch',
  //       },
  //     },
  //     agreeTerms: {
  //       type: 'boolean',
  //       title: '同意用户协议',
  //     },
  //     dynamicFormSchema: {
  //       type: 'object',
  //       title: '动态表单 Schema',
  //       ui: {
  //         widget: 'schema-builder',
  //       },
  //     },
  //     rate: {
  //       type: 'number',
  //       title: '利率（百分比输入，小数存储）',
  //       default: 50,
  //       maximum: 100,
  //       ui: {
  //         widget: 'number',
  //         placeholder: '请输入百分比，如 96',
  //         transform: {
  //           callback: 'percentToDecimal',
  //           reverseCallback: 'decimalToPercent',
  //         },
  //       },
  //     },
  //     ocr: {
  //       type: 'object',
  //       title: 'OCR',
  //       properties: {
  //         model: {
  //           title: 'Model',
  //           type: 'string',
  //           enum: ['azure-layout', 'azure-read', 'mistral'],
  //           enumNames: ['Azure-Layout', 'Azure-Read', 'Mistral'],
  //           ui: {
  //             widget: 'select',
  //           },
  //         },
  //         format: {
  //           title: 'Format',
  //           type: 'string',
  //           ui: {
  //             widget: 'select',
  //             linkages: [
  //               {
  //                 type: 'options',
  //                 dependencies: ['#/properties/ocr/properties/model'],
  //                 when: {
  //                   field: '#/properties/ocr/properties/model',
  //                   operator: '==',
  //                   value: 'azure-layout',
  //                 },
  //                 fulfill: {
  //                   options: [
  //                     { label: 'Markdown', value: 'markdown' },
  //                     { label: 'Text', value: 'text' },
  //                   ],
  //                 },
  //               },
  //               {
  //                 type: 'options',
  //                 dependencies: ['#/properties/ocr/properties/model'],
  //                 when: {
  //                   field: '#/properties/ocr/properties/model',
  //                   operator: '==',
  //                   value: 'azure-read',
  //                 },
  //                 fulfill: {
  //                   options: [{ label: 'Text', value: 'text' }],
  //                 },
  //               },
  //               {
  //                 type: 'options',
  //                 dependencies: ['#/properties/ocr/properties/model'],
  //                 when: {
  //                   field: '#/properties/ocr/properties/model',
  //                   operator: '==',
  //                   value: 'mistral',
  //                 },
  //                 fulfill: {
  //                   options: [{ label: 'Markdown', value: 'markdown' }],
  //                 },
  //               },
  //             ],
  //           },
  //         },
  //       },
  //       required: ['format'],
  //     },
  //   },
  //   required: ['username', 'email', 'password', 'agreeTerms', 'rate'],
  // }

  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      users: {
        type: 'array',
        title: 'Users',
        items: {
          type: 'string',
        },
      },
      actions: {
        type: 'array',
        title: 'Actions',
        description: 'actions',
        items: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              title: 'Code',
              description: 'action code',
            },
            label: {
              type: 'string',
              title: 'Label',
              description: 'action label',
            },
          },
        },
      },
      permissions: {
        type: 'array',
        title: 'Permissions',
        items: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              title: 'Users',
              items: {
                title: 'User',
                type: 'string',
              },
              ui: {
                widget: 'select',
                widgetProps: {
                  multiple: true,
                },
                linkages: [
                  {
                    type: 'options',
                    dependencies: [],
                    fulfill: {
                      function: {
                        type: 'script',
                        code: "/**\n * Generate dynamic options\n * @param {object} params - Parameters object\n * @param {object} params.formData - Current form values\n * @param {object} params.context - Linkage context\n * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)\n * @returns {Array<{label: string, value: any}>} - Options array\n */\nasync function({ formData, context, helpers }) {\n  // Example: fetch from API or calculate based on other fields\n  console.info('formData.users: ', formData.users)\n  return formData.users.map((user) => {\n    return {\n      label: user.value,\n      value: user.value,\n    }\n  })\n}",
                      },
                    },
                  },
                ],
              },
            },
            actions: {
              type: 'array',
              title: 'Actions',
              items: {
                title: 'Action',
                type: 'string',
              },
              ui: {
                widget: 'select',
                widgetProps: {
                  multiple: true,
                },
                linkages: [
                  {
                    type: 'options',
                    dependencies: [],
                    fulfill: {
                      function: {
                        type: 'script',
                        code: '/**\n * Generate dynamic options\n * @param {object} params - Parameters object\n * @param {object} params.formData - Current form values\n * @param {object} params.context - Linkage context\n * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)\n * @returns {Array<{label: string, value: any}>} - Options array\n */\nasync function({ formData, context, helpers }) {\n  // Example: fetch from API or calculate based on other fields\n  return formData.actions.map((action) => {\n    return {\n      label: action.label,\n      value: action.code\n    }\n  })\n}',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  }

  const handleSubmit = (data: any) => {
    console.log('基础表单数据:', data)
    alert('提交成功！请查看控制台输出')
  }

  // 自定义格式验证器
  const customFormats = {
    phone: (value: string) => /^1[3-9]\d{9}$/.test(value),
  }

  useEffect(() => {
    initialValuesTimerRef.current = window.setTimeout(() => {
      // formRef.current?.setValue('rate', 0.6)
      // formRef.current?.setValues({
      //   rate: 0.7,
      // })

      formRef.current?.setValues({
        users: ['Alan Zhao', 'Leo Huang', 'Carmen Zhu'],
        actions: [
          {
            code: 'approve',
            label: 'Approve',
          },
          {
            code: 'reject',
            label: 'Reject',
          },
        ],
        permissions: [
          {
            users: ['Alan Zhao', 'Leo Huang'],
            actions: ['approve', 'reject'],
          },
          {
            users: ['Carmen Zhu'],
            actions: ['approve'],
          },
        ],
      })
    }, 3000)

    return () => {
      if (initialValuesTimerRef.current !== null) {
        window.clearTimeout(initialValuesTimerRef.current)
        initialValuesTimerRef.current = null
      }
    }
  }, [])

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>基础表单示例</h3>
      <p>
        包含常见的表单字段类型：文本、邮箱、手机号、密码、数字、下拉选择、单选、多行文本、开关、复选框等。
      </p>
      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={handleSubmit}
        onChange={(data: any, meta) => {
          console.info('cyril data: ', data)
          console.info('cyril meta: ', JSON.stringify(meta, null, 4))
        }}
        customFormats={customFormats}
        callbacks={{
          percentToDecimal: (({ value }: { value: number }) =>
            value != null ? value / 100 : value) as CallbackFunction,
          decimalToPercent: (({ value }: { value: number }) =>
            value != null ? value * 100 : value) as CallbackFunction,
        }}
        widgets={{
          'code-editor': CodeEditorWidget,
          'object-editor': ObjectEditorWidget,
          'schema-builder': SchemaBuilderWidget,
        }}
      />
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', color: '#5c7080', fontSize: 13 }}>
          查看 Schema
        </summary>
        <pre
          style={{
            marginTop: 8,
            padding: 12,
            background: '#f6f8fa',
            borderRadius: 4,
            fontSize: 12,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(schema, null, 2)}
        </pre>
      </details>
    </Card>
  )
}
