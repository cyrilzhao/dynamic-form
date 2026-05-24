import React, { useMemo } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const ComplexFormPanel: React.FC = () => {
  // 定义不同项目类型的 schema
  const projectSchemas = useMemo(
    () => ({
      research: {
        type: 'object' as const,
        properties: {
          researchField: {
            type: 'string' as const,
            title: '研究领域',
            enum: ['ai', 'blockchain', 'iot', 'biotech'],
            enumNames: ['人工智能', '区块链', '物联网', '生物技术'],
            ui: { widget: 'select', placeholder: '请选择研究领域' },
          },
          expectedOutcome: {
            type: 'string' as const,
            title: '预期成果',
            ui: { widget: 'textarea', placeholder: '请描述预期的研究成果' },
          },
          duration: {
            type: 'integer' as const,
            title: '研究周期（月）',
            minimum: 1,
            maximum: 36,
            ui: { placeholder: '请输入研究周期' },
          },
        },
        required: ['researchField', 'expectedOutcome', 'duration'],
      },
      development: {
        type: 'object' as const,
        properties: {
          platform: {
            type: 'string' as const,
            title: '开发平台',
            enum: ['web', 'mobile', 'desktop', 'embedded'],
            enumNames: ['Web应用', '移动应用', '桌面应用', '嵌入式系统'],
            ui: { widget: 'radio' },
          },
          techStack: {
            type: 'string' as const,
            title: '技术栈',
            ui: { placeholder: '例如：React, Node.js, PostgreSQL' },
          },
          teamSize: {
            type: 'integer' as const,
            title: '团队规模',
            minimum: 1,
            maximum: 50,
            ui: { placeholder: '请输入团队人数' },
          },
          hasPrototype: {
            type: 'boolean' as const,
            title: '是否有原型',
          },
          prototypeUrl: {
            type: 'string' as const,
            title: '原型链接',
            format: 'uri',
            ui: {
              placeholder: 'https://example.com/prototype',
              linkages: [{
                type: 'visibility',
                dependencies: ['./hasPrototype'],
                when: { field: './hasPrototype', operator: '==', value: true },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              }],
            },
          },
        },
        required: ['platform', 'techStack', 'teamSize'],
      },
      marketing: {
        type: 'object' as const,
        properties: {
          targetAudience: {
            type: 'string' as const,
            title: '目标受众',
            ui: { widget: 'textarea', placeholder: '请描述目标受众群体' },
          },
          channels: {
            type: 'string' as const,
            title: '推广渠道',
            enum: ['social', 'search', 'display', 'email', 'offline'],
            enumNames: ['社交媒体', '搜索引擎', '展示广告', '邮件营销', '线下活动'],
            ui: { widget: 'select', placeholder: '请选择主要推广渠道' },
          },
          expectedROI: {
            type: 'number' as const,
            title: '预期ROI（%）',
            minimum: 0,
            maximum: 1000,
            ui: { placeholder: '请输入预期投资回报率' },
          },
          campaignDuration: {
            type: 'integer' as const,
            title: '活动周期（天）',
            minimum: 1,
            maximum: 365,
            ui: { placeholder: '请输入活动周期' },
          },
        },
        required: ['targetAudience', 'channels', 'expectedROI'],
      },
    }),
    []
  );

  // 定义联动函数
  const linkageFunctions = useMemo(
    () => ({
      loadProjectSchema: (formData: Record<string, any>) => {
        const projectType = formData?.projectType;
        if (!projectType) {
          return { type: 'object', properties: {} };
        }
        return projectSchemas[projectType as keyof typeof projectSchemas] || { type: 'object', properties: {} };
      },
    }),
    [projectSchemas]
  );

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '项目申请表',
    properties: {
      projectType: {
        type: 'string',
        title: '项目类型',
        enum: ['research', 'development', 'marketing'],
        enumNames: ['研究项目', '开发项目', '市场推广'],
        ui: {
          widget: 'select',
          placeholder: '请选择项目类型',
        },
      },
      projectName: {
        type: 'string',
        title: '项目名称',
        minLength: 3,
        maxLength: 50,
        ui: {
          placeholder: '请输入项目名称',
          errorMessages: {
            required: '项目名称不能为空',
            minLength: '项目名称至少3个字符',
          },
        },
      },
      budget: {
        type: 'number',
        title: '预算金额（万元）',
        minimum: 1,
        maximum: 1000,
        ui: {
          placeholder: '请输入预算金额',
        },
      },
      needsApproval: {
        type: 'boolean',
        title: '是否需要高层审批',
        ui: {
          widget: 'switch',
          linkages: [{
            type: 'value',
            dependencies: ['budget'],
            when: {
              field: 'budget',
              operator: '>',
              value: 100,
            },
            fulfill: {
              value: true,
            },
            otherwise: {
              value: false,
            },
          }],
        },
      },
      approver: {
        type: 'string',
        title: '审批人',
        enum: ['ceo', 'cto', 'cfo'],
        enumNames: ['CEO', 'CTO', 'CFO'],
        ui: {
          widget: 'select',
          placeholder: '请选择审批人',
          linkages: [{
            type: 'visibility',
            dependencies: ['needsApproval'],
            when: {
              field: 'needsApproval',
              operator: '==',
              value: true,
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          }],
        },
      },
      projectDetails: {
        type: 'object',
        title: '项目详情',
        properties: {},
        ui: {
          linkages: [{
            type: 'schema',
            dependencies: ['projectType'],
            when: {
              field: 'projectType',
              operator: 'isNotEmpty',
            },
            fulfill: {
              function: 'loadProjectSchema',
            },
          }],
        },
      },
      risks: {
        type: 'string',
        title: '风险评估',
        ui: {
          widget: 'textarea',
          placeholder: '请描述项目可能面临的风险及应对措施',
        },
      },
      attachments: {
        type: 'string',
        title: '附件说明',
        ui: {
          placeholder: '如有相关文档，请说明',
        },
      },
    },
    required: ['projectType', 'projectName', 'budget', 'risks'],
    if: {
      properties: { needsApproval: { const: true } },
    },
    then: {
      required: ['approver'],
    },
  };

  const handleSubmit = (data: any) => {
    console.log('复杂表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '800px' }}>
      <h3>复杂场景示例</h3>
      <p>
        综合示例：项目申请表，包含条件渲染、动态嵌套表单、字段联动等多种特性。
        <br />
        特性说明：
      </p>
      <ul style={{ fontSize: '14px', color: '#666' }}>
        <li>预算超过100万时，自动勾选"需要高层审批"并显示审批人选择</li>
        <li>根据项目类型动态显示不同的详情表单</li>
        <li>开发项目中，勾选"是否有原型"后显示原型链接输入框</li>
        <li>必填字段根据条件动态变化</li>
      </ul>
      <DynamicForm schema={schema} onSubmit={handleSubmit} linkageFunctions={linkageFunctions} />

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </Card>
  );
};
