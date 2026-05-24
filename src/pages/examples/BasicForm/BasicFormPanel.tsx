import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';
import { CodeEditorWidget } from '@/components/DynamicForm/widgets/CodeEditorWidget';
import { ObjectEditorWidget } from '@/components/DynamicForm/widgets/ObjectEditorWidget';

export const BasicFormPanel: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '用户注册表单',
    properties: {
      username: {
        type: 'string',
        title: '用户名',
        minLength: 3,
        maxLength: 20,
        default: 'aaa',
        ui: {
          placeholder: '请输入用户名',
          errorMessages: {
            required: '用户名不能为空',
            minLength: '用户名至少3个字符',
            maxLength: '用户名最多20个字符',
          },
        },
      },
      hiddenUsername: {
        type: 'string',
        title: '用户名',
        minLength: 3,
        maxLength: 20,
        default: 'bbb',
        ui: {
          hidden: true,
          placeholder: '请输入用户名',
          errorMessages: {
            required: '用户名不能为空',
            minLength: '用户名至少3个字符',
            maxLength: '用户名最多20个字符',
          },
        },
      },
      email: {
        type: 'string',
        title: '邮箱',
        format: 'email',
        ui: {
          placeholder: 'example@email.com',
        },
      },
      website: {
        type: 'string',
        title: '个人网站',
        format: 'uri',
        ui: {
          widget: 'url',
          placeholder: 'https://example.com',
          errorMessages: {
            format: '请输入有效的 URL 地址',
          },
        },
      },
      phone: {
        type: 'string',
        title: '手机号',
        format: 'phone',
        ui: {
          placeholder: '请输入手机号',
          errorMessages: {
            format: '请输入有效的手机号码',
          },
        },
      },
      password: {
        type: 'string',
        title: '密码',
        minLength: 6,
        ui: {
          widget: 'password',
          placeholder: '至少6位字符',
        },
      },
      age: {
        type: 'integer',
        title: '年龄',
        minimum: 18,
        maximum: 100,
      },
      country: {
        type: 'string',
        title: '国家',
        enum: ['china', 'usa', 'japan', 'uk', 'other'],
        enumNames: ['中国', '美国', '日本', '英国', '其他'],
        ui: {
          widget: 'select',
          placeholder: '请选择国家',
        },
      },
      gender: {
        type: 'string',
        title: '性别',
        enum: ['male', 'female', 'other'],
        enumNames: ['男', '女', '其他'],
        ui: {
          widget: 'radio',
        },
      },
      introduction: {
        type: 'string',
        title: '个人简介',
        maxLength: 500,
        ui: {
          widget: 'textarea',
          placeholder: '介绍一下自己...',
        },
      },
      config: {
        type: 'string',
        title: '配置信息 (JSON)',
        ui: {
          widget: 'code-editor',
          widgetProps: {
            language: 'json',
            config: {
              previewLines: 5,
              previewMaxHeight: 150,
            },
          },
        },
      },
      authScript: {
        type: 'string',
        title: '鉴权脚本',
        ui: {
          widget: 'code-editor',
          widgetProps: {
            language: 'javascript',
            config: {
              previewLines: 5,
              previewMaxHeight: 150,
            },
          },
        },
      },
      metadata: {
        type: 'object',
        title: '元数据 (Object)',
        ui: {
          widget: 'object-editor',
          widgetProps: {
            config: {
              previewLines: 5,
              previewMaxHeight: 150,
            },
          },
        },
      },
      receiveNewsletter: {
        type: 'boolean',
        title: '订阅新闻邮件',
        ui: {
          widget: 'switch',
        },
      },
      agreeTerms: {
        type: 'boolean',
        title: '同意用户协议',
      },
    },
    required: ['username', 'email', 'password', 'agreeTerms'],
  };

  const handleSubmit = (data: any) => {
    console.log('基础表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  // 自定义格式验证器
  const customFormats = {
    phone: (value: string) => /^1[3-9]\d{9}$/.test(value),
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>基础表单示例</h3>
      <p>
        包含常见的表单字段类型：文本、邮箱、手机号、密码、数字、下拉选择、单选、多行文本、开关、复选框等。
      </p>
      <DynamicForm
        schema={schema}
        onSubmit={handleSubmit}
        customFormats={customFormats}
        widgets={{
          'code-editor': CodeEditorWidget,
          'object-editor': ObjectEditorWidget,
        }}
      />
    </Card>
  );
};
