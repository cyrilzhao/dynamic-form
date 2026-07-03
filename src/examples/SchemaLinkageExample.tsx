import React, { useState } from 'react';
import { Card, Elevation, H3, Button, Callout } from '@blueprintjs/core';
import { DynamicForm } from '../components/DynamicForm';
import type { ExtendedJSONSchema } from '../components/DynamicForm/types/schema';
import type { DynamicFormRef } from '../components/DynamicForm/types';

/**
 * Schema 联动示例
 *
 * 展示如何使用 schema 联动动态改变字段的校验规则和 UI 配置
 *
 * 功能点：
 * 1. 根据验证模式（严格/宽松）动态改变字段校验规则
 * 2. String 类型：pattern, minLength, maxLength
 * 3. Number 类型：minimum, maximum, multipleOf
 * 4. 动态改变 UI 配置：placeholder, help
 */

const schema: ExtendedJSONSchema = {
  type: 'object',
  required: ['username', 'password', 'age', 'score'],
  properties: {
    validationMode: {
      type: 'string',
      title: '验证模式',
      enum: ['strict', 'normal', 'loose'],
      enumNames: ['严格模式', '普通模式', '宽松模式'],
      default: 'normal',
      ui: {
        help: '选择不同的验证模式，字段的校验规则会自动调整',
      },
    },
    username: {
      type: 'string',
      title: '用户名',
      ui: {
        linkages: [
          {
            type: 'schema',
            dependencies: ['#/properties/validationMode'],
            fulfill: { function: 'getUsernameSchema' },
          },
        ],
      },
    },
    password: {
      type: 'string',
      title: '密码',
      ui: {
        widget: 'password',
        linkages: [
          {
            type: 'schema',
            dependencies: ['#/properties/validationMode'],
            fulfill: { function: 'getPasswordSchema' },
          },
        ],
      },
    },
    age: {
      type: 'integer',
      title: '年龄',
      ui: {
        linkages: [
          {
            type: 'schema',
            dependencies: ['#/properties/validationMode'],
            fulfill: { function: 'getAgeSchema' },
          },
        ],
      },
    },
    score: {
      type: 'number',
      title: '分数',
      ui: {
        linkages: [
          {
            type: 'schema',
            dependencies: ['#/properties/validationMode'],
            fulfill: { function: 'getScoreSchema' },
          },
        ],
      },
    },
  },
};

// 联动函数：根据验证模式返回不同的 schema 配置
const linkageFunctions = {
  getUsernameSchema: (formData: any) => {
    const { validationMode } = formData || {};

    switch (validationMode) {
      case 'strict':
        return {
          minLength: 6,
          maxLength: 20,
          pattern: '^[a-zA-Z][a-zA-Z0-9_]*$', // 必须以字母开头
          ui: {
            placeholder: '6-20位，字母开头，支持字母数字下划线',
            help: '严格模式：必须以字母开头，6-20位字符',
          },
        };

      case 'normal':
        return {
          minLength: 3,
          maxLength: 30,
          pattern: '^[a-zA-Z0-9_]+$',
          ui: {
            placeholder: '3-30位，支持字母数字下划线',
            help: '普通模式：3-30位字符',
          },
        };

      case 'loose':
        return {
          minLength: 1,
          maxLength: 50,
          ui: {
            placeholder: '任意字符，1-50位',
            help: '宽松模式：任意字符均可',
          },
        };

      default:
        return {};
    }
  },

  getPasswordSchema: (formData: any) => {
    const { validationMode } = formData || {};

    switch (validationMode) {
      case 'strict':
        return {
          minLength: 12,
          pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]+$',
          ui: {
            placeholder: '至少12位，包含大小写字母、数字和特殊字符',
            help: '严格模式：必须包含大小写字母、数字和特殊字符',
          },
        };

      case 'normal':
        return {
          minLength: 8,
          pattern: '^(?=.*[a-zA-Z])(?=.*\\d)[A-Za-z\\d@$!%*?&]+$',
          ui: {
            placeholder: '至少8位，包含字母和数字',
            help: '普通模式：至少包含字母和数字',
          },
        };

      case 'loose':
        return {
          minLength: 6,
          ui: {
            placeholder: '至少6位',
            help: '宽松模式：至少6位字符即可',
          },
        };

      default:
        return {};
    }
  },

  getAgeSchema: (formData: any) => {
    const { validationMode } = formData || {};

    switch (validationMode) {
      case 'strict':
        return {
          minimum: 18,
          maximum: 60,
          ui: {
            placeholder: '18-60',
            help: '严格模式：必须在18-60岁之间',
          },
        };

      case 'normal':
        return {
          minimum: 13,
          maximum: 100,
          ui: {
            placeholder: '13-100',
            help: '普通模式：13-100岁',
          },
        };

      case 'loose':
        return {
          minimum: 0,
          maximum: 150,
          ui: {
            placeholder: '0-150',
            help: '宽松模式：0-150岁',
          },
        };

      default:
        return {};
    }
  },

  getScoreSchema: (formData: any) => {
    const { validationMode } = formData || {};

    switch (validationMode) {
      case 'strict':
        return {
          minimum: 60,
          maximum: 100,
          multipleOf: 0.5,
          ui: {
            placeholder: '60-100，精确到0.5',
            help: '严格模式：及格分数(60-100)，可输入小数',
          },
        };

      case 'normal':
        return {
          minimum: 0,
          maximum: 100,
          multipleOf: 1,
          ui: {
            placeholder: '0-100，整数',
            help: '普通模式：0-100分，必须是整数',
          },
        };

      case 'loose':
        return {
          minimum: 0,
          maximum: 150,
          ui: {
            placeholder: '0-150，任意数值',
            help: '宽松模式：0-150分，可输入任意精度',
          },
        };

      default:
        return {};
    }
  },
};

export const SchemaLinkageExample: React.FC = () => {
  const formRef = React.createRef<DynamicFormRef>();
  const [submittedData, setSubmittedData] = useState<any>(null);

  const handleSubmit = async (data: Record<string, any>) => {
    console.log('表单提交:', data);
    setSubmittedData(data);
  };

  const handleValidate = async () => {
    const isValid = await formRef.current?.validate();
    if (isValid) {
      alert('表单验证通过！');
    } else {
      const errors = formRef.current?.getErrors();
      console.log('验证错误:', errors);
      alert('表单验证失败，请检查输入');
    }
  };

  const handleReset = () => {
    formRef.current?.reset();
    setSubmittedData(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <H3>Schema 联动示例</H3>

      <Callout intent="primary" style={{ marginBottom: 20 }}>
        <strong>功能说明：</strong>
        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
          <li>选择不同的验证模式，各字段的校验规则会自动调整</li>
          <li>展示了 string、number 类型字段的动态校验</li>
          <li>包括 pattern（正则）、minLength/maxLength、minimum/maximum、multipleOf 等规则</li>
          <li>同时动态改变字段的 placeholder 和 help 提示</li>
        </ul>
      </Callout>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card elevation={Elevation.TWO}>
          <H3>表单</H3>
          <DynamicForm
            ref={formRef}
            schema={schema}
            linkageFunctions={linkageFunctions}
            onSubmit={handleSubmit}
            defaultValues={{
              validationMode: 'normal',
            }}
          />

          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <Button onClick={handleValidate} intent="primary">
              手动验证
            </Button>
            <Button onClick={handleReset}>
              重置表单
            </Button>
          </div>
        </Card>

        <Card elevation={Elevation.TWO}>
          <H3>提交数据</H3>
          {submittedData ? (
            <pre style={{
              background: '#f5f5f5',
              padding: 15,
              borderRadius: 4,
              overflow: 'auto',
              maxHeight: 400,
            }}>
              {JSON.stringify(submittedData, null, 2)}
            </pre>
          ) : (
            <p style={{ color: '#999' }}>提交表单后，数据将显示在这里</p>
          )}

          <div style={{ marginTop: 20 }}>
            <H3>验证规则说明</H3>
            <div style={{ fontSize: 14 }}>
              <h4>严格模式：</h4>
              <ul>
                <li>用户名：6-20位，字母开头</li>
                <li>密码：12位+，大小写字母+数字+特殊字符</li>
                <li>年龄：18-60岁</li>
                <li>分数：60-100，可输入0.5倍数</li>
              </ul>

              <h4>普通模式：</h4>
              <ul>
                <li>用户名：3-30位，字母数字下划线</li>
                <li>密码：8位+，字母+数字</li>
                <li>年龄：13-100岁</li>
                <li>分数：0-100，必须整数</li>
              </ul>

              <h4>宽松模式：</h4>
              <ul>
                <li>用户名：1-50位，任意字符</li>
                <li>密码：6位+，任意字符</li>
                <li>年龄：0-150岁</li>
                <li>分数：0-150，任意精度</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
