import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';
import { CodeEditorWidget } from '@/components/DynamicForm/widgets/CodeEditorWidget';

export const NestedArrayExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      departments: {
        type: 'array',
        title: '部门列表',
        items: {
          type: 'object',
          title: '部门',
          properties: {
            name: {
              type: 'string',
              title: '部门名称',
            },
            config: {
              type: 'string',
              title: '部门配置 (JSON)',
              ui: {
                widget: 'code-editor',
                widgetProps: {
                  language: 'json',
                  config: {
                    previewLines: 3,
                    previewMaxHeight: 100,
                  },
                },
              },
            },
            employees: {
              type: 'array',
              title: '员工列表',
              items: {
                type: 'object',
                title: '员工',
                properties: {
                  name: { type: 'string', title: '姓名' },
                  position: { type: 'string', title: '职位' },
                  script: {
                    type: 'string',
                    title: '个人脚本 (JavaScript)',
                    ui: {
                      widget: 'code-editor',
                      widgetProps: {
                        language: 'javascript',
                        config: {
                          previewLines: 2,
                          previewMaxHeight: 80,
                        },
                      },
                    },
                  },
                },
              },
              ui: {
                flattenPath: true,
                arrayMode: 'dynamic',
                addButtonText: '添加员工',
              },
            },
          },
        },
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加部门',
        },
      },
    },
  };

  const defaultValues = {
    departments: [
      {
        name: '技术部',
        config: '{\n  "budget": 1000000,\n  "location": "Building A"\n}',
        employees: [
          {
            name: '张三',
            position: '前端工程师',
            script: 'function greet() {\n  console.log("Hello!");\n}',
          },
          {
            name: '李四',
            position: '后端工程师',
            script: 'function process() {\n  return "Processing...";\n}',
          },
        ],
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('嵌套数组数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>嵌套数组 + 代码编辑器</h3>
      <p>数组中的对象包含另一个数组，并使用 CodeEditor Widget 展示 widgetProps 的用法。</p>
      <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        <li>支持数组嵌套数组</li>
        <li>每层都可以独立增删</li>
        <li>演示 widgetProps 在数组字段中的使用</li>
        <li>部门配置使用 JSON 编辑器</li>
        <li>员工脚本使用 JavaScript 编辑器</li>
      </ul>
      <DynamicForm
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        widgets={{
          'code-editor': CodeEditorWidget,
        }}
      />
      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </Card>
  );
};
