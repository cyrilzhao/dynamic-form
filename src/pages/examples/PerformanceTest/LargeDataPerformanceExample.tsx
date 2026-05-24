import React, { useState, useMemo } from 'react';
import { Card, Elevation, FormGroup, NumericInput, Switch } from '@blueprintjs/core';
import { DynamicForm } from '../../../components/DynamicForm/DynamicForm';
import type { ExtendedJSONSchema } from '../../../components/DynamicForm/types/schema';

/**
 * 大量数据性能测试示例
 *
 * 测试场景：
 * 1. 大量嵌套对象字段
 * 2. 大量数组项（可配置）
 * 3. 复杂的字段联动关系
 * 4. 路径透明化
 * 5. 多层级验证规则
 */
export const LargeDataPerformanceExample: React.FC = () => {
  const [arrayItemCount, setArrayItemCount] = useState(50);
  const [nestedLevel, setNestedLevel] = useState(3);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [renderTime, setRenderTime] = useState<number>(0);
  const [enableVirtualScroll, setEnableVirtualScroll] = useState(true);
  const [virtualScrollHeight, setVirtualScrollHeight] = useState(600);

  // 生成复杂的 Schema
  const schema = useMemo(() => {
    const startTime = performance.now();
    const generatedSchema = generateComplexSchema(arrayItemCount, nestedLevel);
    const endTime = performance.now();
    setRenderTime(endTime - startTime);
    return generatedSchema;
  }, [arrayItemCount, nestedLevel]);

  // 生成默认值
  const defaultValues = useMemo(() => {
    return generateDefaultValues(arrayItemCount, nestedLevel);
  }, [arrayItemCount, nestedLevel]);

  const handleSubmit = (data: Record<string, any>) => {
    console.log('提交的表单数据:', data);
    setFormData(data);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Large Data Performance Test</h2>
      <p>This example tests the performance of dynamic forms with large amounts of complex data.</p>

      <Card elevation={Elevation.TWO} style={{ marginBottom: '20px', padding: '15px' }}>
        <h3>Configuration</h3>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <FormGroup label="Array Item Count" inline>
            <NumericInput
              value={arrayItemCount}
              onValueChange={value => setArrayItemCount(value)}
              min={1}
              max={100}
              stepSize={5}
              style={{ width: '100px' }}
            />
          </FormGroup>

          <FormGroup label="Nested Level" inline>
            <NumericInput
              value={nestedLevel}
              onValueChange={value => setNestedLevel(value)}
              min={1}
              max={5}
              stepSize={1}
              style={{ width: '100px' }}
            />
          </FormGroup>

          <div>
            <Switch
              checked={enableVirtualScroll}
              label="Enable Virtual Scroll"
              onChange={(e) => setEnableVirtualScroll(e.currentTarget.checked)}
            />
          </div>

          {enableVirtualScroll && (
            <FormGroup label="Scroll Height (px)" inline>
              <NumericInput
                value={virtualScrollHeight}
                onValueChange={value => setVirtualScrollHeight(value)}
                min={300}
                max={1000}
                stepSize={50}
                style={{ width: '100px' }}
              />
            </FormGroup>
          )}

          <div>
            <strong>Schema Generation Time:</strong> {renderTime.toFixed(2)}ms
          </div>
        </div>

        <div style={{ marginTop: '10px', color: '#666' }}>
          <p>
            <strong>Total Fields (including hidden):</strong> ~
            {calculateTotalFields(arrayItemCount, nestedLevel)}
          </p>
          <p>
            <strong>Visible Fields (estimated):</strong> ~
            {calculateVisibleFields(arrayItemCount, nestedLevel)}
          </p>
          <p style={{ fontSize: '12px', fontStyle: 'italic', marginTop: '5px' }}>
            Note: Hidden fields still affect form state management and linkage calculation performance.
          </p>
        </div>
      </Card>

      <DynamicForm
        schema={schema}
        onSubmit={handleSubmit}
        defaultValues={defaultValues}
        enableVirtualScroll={enableVirtualScroll}
        virtualScrollHeight={virtualScrollHeight}
      />

      {Object.keys(formData).length > 0 && (
        <Card elevation={Elevation.TWO} style={{ marginTop: '20px', padding: '15px' }}>
          <h3>Submitted Data</h3>
          <pre style={{ maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(formData, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

/**
 * 生成复杂的测试 Schema
 */
function generateComplexSchema(arrayItemCount: number, nestedLevel: number): ExtendedJSONSchema {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: 'Performance Test Form',
    properties: {
      // 基础信息部分
      basicInfo: {
        type: 'object',
        title: 'Basic Information',
        ui: { flatten: true },
        properties: {
          formType: {
            type: 'string',
            title: 'Form Type',
            enum: ['type_a', 'type_b', 'type_c'],
            enumNames: ['Type A - Simple', 'Type B - Medium', 'Type C - Complex'],
            default: 'type_a',
          },
          priority: {
            type: 'string',
            title: 'Priority',
            enum: ['low', 'medium', 'high', 'urgent'],
            enumNames: ['Low', 'Medium', 'High', 'Urgent'],
            default: 'medium',
          },
          description: {
            type: 'string',
            title: 'Description',
            ui: { widget: 'textarea' },
          },
        },
        required: ['formType', 'priority'],
      },

      // 动态配置数组
      configurations: generateConfigurationArray(arrayItemCount),

      // 嵌套对象结构
      nestedData: generateNestedStructure(nestedLevel, 1),

      // 条件字段（基于 formType）
      typeAConfig: {
        type: 'object',
        title: 'Type A Configuration',
        ui: {
          linkages: [{
            type: 'visibility',
            dependencies: ['formType'],
            when: {
              field: 'formType',
              operator: '==',
              value: 'type_a',
            },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          }],
        },
        properties: generateTypeSpecificFields('A', 10),
      },

      typeBConfig: {
        type: 'object',
        title: 'Type B Configuration',
        ui: {
          linkages: [{
            type: 'visibility',
            dependencies: ['formType'],
            when: {
              field: 'formType',
              operator: '==',
              value: 'type_b',
            },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          }],
        },
        properties: generateTypeSpecificFields('B', 15),
      },

      typeCConfig: {
        type: 'object',
        title: 'Type C Configuration',
        ui: {
          linkages: [{
            type: 'visibility',
            dependencies: ['formType'],
            when: {
              field: 'formType',
              operator: '==',
              value: 'type_c',
            },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          }],
        },
        properties: generateTypeSpecificFields('C', 20),
      },
    },
    required: ['basicInfo'],
  };

  return schema;
}

/**
 * 生成配置数组字段
 * 每个数组项包含 50+ 个字段
 */
function generateConfigurationArray(itemCount: number): ExtendedJSONSchema {
  // 生成通用字段（30个）
  const commonFields: Record<string, ExtendedJSONSchema> = {};
  for (let i = 1; i <= 30; i++) {
    const fieldType = ['string', 'number', 'boolean'][i % 3];
    if (fieldType === 'string') {
      commonFields[`field${i}`] = {
        type: 'string',
        title: `Field ${i}`,
      };
    } else if (fieldType === 'number') {
      commonFields[`field${i}`] = {
        type: 'number',
        title: `Field ${i}`,
      };
    } else {
      commonFields[`field${i}`] = {
        type: 'boolean',
        title: `Field ${i}`,
      };
    }
  }

  return {
    type: 'array',
    title: 'Configurations',
    items: {
      type: 'object',
      properties: {
        configName: {
          type: 'string',
          title: 'Config Name',
        },
        configType: {
          type: 'string',
          title: 'Config Type',
          enum: ['database', 'api', 'cache', 'queue'],
          enumNames: ['Database', 'API', 'Cache', 'Queue'],
        },
        enabled: {
          type: 'boolean',
          title: 'Enabled',
          default: true,
        },
        // 添加30个通用字段
        ...commonFields,
        // 数据库配置
        databaseConfig: {
          type: 'object',
          title: 'Database Config',
          ui: {
            flatten: true,
            linkages: [{
              type: 'visibility',
              dependencies: ['./configType'],
              when: {
                field: './configType',
                operator: '==',
                value: 'database',
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            }],
          },
          properties: {
            host: { type: 'string', title: 'Host' },
            port: { type: 'number', title: 'Port', default: 5432 },
            database: { type: 'string', title: 'Database' },
            username: { type: 'string', title: 'Username' },
            password: { type: 'string', title: 'Password', ui: { widget: 'password' } },
          },
        },
        // API 配置
        apiConfig: {
          type: 'object',
          title: 'API Config',
          ui: {
            flatten: true,
            linkages: [{
              type: 'visibility',
              dependencies: ['./configType'],
              when: {
                field: './configType',
                operator: '==',
                value: 'api',
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            }],
          },
          properties: {
            endpoint: { type: 'string', title: 'Endpoint' },
            method: {
              type: 'string',
              title: 'Method',
              enum: ['GET', 'POST', 'PUT', 'DELETE'],
            },
            timeout: { type: 'number', title: 'Timeout (ms)', default: 5000 },
            retryCount: { type: 'number', title: 'Retry Count', default: 3 },
          },
        },
        // 缓存配置
        cacheConfig: {
          type: 'object',
          title: 'Cache Config',
          ui: {
            flatten: true,
            linkages: [{
              type: 'visibility',
              dependencies: ['./configType'],
              when: {
                field: './configType',
                operator: '==',
                value: 'cache',
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            }],
          },
          properties: {
            ttl: { type: 'number', title: 'TTL (seconds)', default: 3600 },
            maxSize: { type: 'number', title: 'Max Size (MB)', default: 100 },
            strategy: {
              type: 'string',
              title: 'Strategy',
              enum: ['lru', 'lfu', 'fifo'],
              enumNames: ['LRU', 'LFU', 'FIFO'],
            },
          },
        },
        // 队列配置
        queueConfig: {
          type: 'object',
          title: 'Queue Config',
          ui: {
            flatten: true,
            linkages: [{
              type: 'visibility',
              dependencies: ['./configType'],
              when: {
                field: './configType',
                operator: '==',
                value: 'queue',
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            }],
          },
          properties: {
            queueName: { type: 'string', title: 'Queue Name' },
            concurrency: { type: 'number', title: 'Concurrency', default: 5 },
            maxRetries: { type: 'number', title: 'Max Retries', default: 3 },
          },
        },
      },
      required: ['configName', 'configType'],
    },
    default: Array.from({ length: Math.min(itemCount, 5) }, (_, i) => ({
      configName: `Config ${i + 1}`,
      configType: ['database', 'api', 'cache', 'queue'][i % 4],
      enabled: true,
    })),
  };
}

/**
 * 生成嵌套结构
 */
function generateNestedStructure(maxLevel: number, currentLevel: number): ExtendedJSONSchema {
  if (currentLevel > maxLevel) {
    return {
      type: 'string',
      title: `Level ${currentLevel} Value`,
    };
  }

  const properties: Record<string, ExtendedJSONSchema> = {
    [`level${currentLevel}Name`]: {
      type: 'string',
      title: `Level ${currentLevel} Name`,
    },
    [`level${currentLevel}Type`]: {
      type: 'string',
      title: `Level ${currentLevel} Type`,
      enum: ['option1', 'option2', 'option3'],
      enumNames: ['Option 1', 'Option 2', 'Option 3'],
    },
    [`level${currentLevel}Value`]: {
      type: 'number',
      title: `Level ${currentLevel} Value`,
      default: 0,
    },
  };

  if (currentLevel < maxLevel) {
    properties[`level${currentLevel + 1}`] = {
      type: 'object',
      title: `Level ${currentLevel + 1}`,
      properties: generateNestedStructure(maxLevel, currentLevel + 1).properties || {},
    };
  }

  return {
    type: 'object',
    title: `Level ${currentLevel}`,
    properties,
  };
}

/**
 * 生成类型特定字段
 */
function generateTypeSpecificFields(
  type: string,
  fieldCount: number
): Record<string, ExtendedJSONSchema> {
  const fields: Record<string, ExtendedJSONSchema> = {};

  for (let i = 0; i < fieldCount; i++) {
    const fieldName = `${type.toLowerCase()}Field${i + 1}`;
    const fieldType = ['string', 'number', 'boolean'][i % 3];

    if (fieldType === 'string') {
      fields[fieldName] = {
        type: 'string',
        title: `${type} Field ${i + 1}`,
        ...(i % 3 === 0 && {
          enum: ['value1', 'value2', 'value3'],
          enumNames: ['Value 1', 'Value 2', 'Value 3'],
        }),
      };
    } else if (fieldType === 'number') {
      fields[fieldName] = {
        type: 'number',
        title: `${type} Field ${i + 1}`,
        default: 0,
      };
    } else {
      fields[fieldName] = {
        type: 'boolean',
        title: `${type} Field ${i + 1}`,
        default: false,
      };
    }
  }

  return fields;
}

/**
 * 计算总字段数（估算）
 *
 * 注意：
 * - 包含所有定义的字段（包括隐藏字段）
 * - 隐藏字段虽然不渲染，但仍会影响表单状态管理和联动计算性能
 */
function calculateTotalFields(arrayItemCount: number, nestedLevel: number): number {
  const basicFields = 3; // basicInfo 中的字段：formType, priority, description

  // 每个数组项包含：
  // - 3个基础字段：configName, configType, enabled
  // - 30个通用字段：field1 ~ field30
  // - 4个条件对象（databaseConfig, apiConfig, cacheConfig, queueConfig）
  //   每个对象包含 3-5 个字段，总计约 15 个字段
  // 虽然同时只显示一个条件对象，但所有字段都会被注册
  const arrayFields = arrayItemCount * (3 + 30 + 5 + 4 + 3 + 3); // = arrayItemCount * 48

  // 嵌套结构：每层 3 个字段
  const nestedFields = nestedLevel * 3;

  // 类型特定字段：同时只显示一个，但所有字段都会被注册
  // typeAConfig: 10, typeBConfig: 15, typeCConfig: 20
  const typeSpecificFields = 10 + 15 + 20; // = 45

  const total = basicFields + arrayFields + nestedFields + typeSpecificFields;

  // 实际可见字段数约为总字段数的 70-80%（因为部分字段被联动隐藏）
  return total;
}

/**
 * 计算实际可见字段数（估算）
 */
function calculateVisibleFields(arrayItemCount: number, nestedLevel: number): number {
  const basicFields = 3; // basicInfo 中的字段

  // 每个数组项可见字段：3个基础字段 + 30个通用字段 + 1个条件对象（3-5个字段）
  const arrayFields = arrayItemCount * (3 + 30 + 4); // 平均每项 37 个可见字段

  // 嵌套结构：每层 3 个字段
  const nestedFields = nestedLevel * 3;

  // 类型特定字段：只显示一个（默认 typeBConfig: 15个字段）
  const typeSpecificFields = 15;

  return basicFields + arrayFields + nestedFields + typeSpecificFields;
}

/**
 * 生成默认值
 */
function generateDefaultValues(arrayItemCount: number, nestedLevel: number): Record<string, any> {
  return {
    // 基础信息
    formType: 'type_b',
    priority: 'high',
    description: 'This is a performance test form with large amounts of data',

    // 配置数组
    configurations: generateConfigurationArrayDefaults(arrayItemCount),

    // 嵌套数据
    nestedData: generateNestedDefaults(nestedLevel, 1),

    // Type B 配置（因为 formType 默认是 type_b）
    typeBConfig: generateTypeSpecificDefaults('B', 15),
  };
}

/**
 * 生成配置数组的默认值
 */
function generateConfigurationArrayDefaults(itemCount: number): any[] {
  const configs = [];
  const types = ['database', 'api', 'cache', 'queue'];

  for (let i = 0; i < itemCount; i++) {
    const configType = types[i % 4];
    const config: any = {
      configName: `Configuration ${i + 1}`,
      configType,
      enabled: i % 3 !== 0, // 大部分启用
    };

    // 添加30个通用字段的默认值
    for (let j = 1; j <= 30; j++) {
      const fieldType = ['string', 'number', 'boolean'][j % 3];
      if (fieldType === 'string') {
        config[`field${j}`] = `Value ${j} for item ${i + 1}`;
      } else if (fieldType === 'number') {
        config[`field${j}`] = (i + 1) * 10 + j;
      } else {
        config[`field${j}`] = (i + j) % 2 === 0;
      }
    }

    // 根据类型添加对应的配置
    if (configType === 'database') {
      config.host = `db-server-${i + 1}.example.com`;
      config.port = 5432 + i;
      config.database = `app_db_${i + 1}`;
      config.username = `db_user_${i + 1}`;
      config.password = `password_${i + 1}`;
    } else if (configType === 'api') {
      config.endpoint = `https://api-${i + 1}.example.com/v1`;
      config.method = ['GET', 'POST', 'PUT', 'DELETE'][i % 4];
      config.timeout = 5000 + i * 100;
      config.retryCount = (i % 5) + 1;
    } else if (configType === 'cache') {
      config.ttl = 3600 + i * 60;
      config.maxSize = 100 + i * 10;
      config.strategy = ['lru', 'lfu', 'fifo'][i % 3];
    } else if (configType === 'queue') {
      config.queueName = `task_queue_${i + 1}`;
      config.concurrency = (i % 10) + 1;
      config.maxRetries = (i % 5) + 1;
    }

    configs.push(config);
  }

  return configs;
}

/**
 * 生成嵌套结构的默认值
 */
function generateNestedDefaults(maxLevel: number, currentLevel: number): any {
  if (currentLevel > maxLevel) {
    return `Level ${currentLevel} value`;
  }

  const data: any = {
    [`level${currentLevel}Name`]: `Level ${currentLevel} Name`,
    [`level${currentLevel}Type`]: ['option1', 'option2', 'option3'][currentLevel % 3],
    [`level${currentLevel}Value`]: currentLevel * 100,
  };

  if (currentLevel < maxLevel) {
    data[`level${currentLevel + 1}`] = generateNestedDefaults(maxLevel, currentLevel + 1);
  }

  return data;
}

/**
 * 生成类型特定字段的默认值
 */
function generateTypeSpecificDefaults(type: string, fieldCount: number): Record<string, any> {
  const defaults: Record<string, any> = {};

  for (let i = 0; i < fieldCount; i++) {
    const fieldName = `${type.toLowerCase()}Field${i + 1}`;
    const fieldType = ['string', 'number', 'boolean'][i % 3];

    if (fieldType === 'string') {
      if (i % 3 === 0) {
        // 枚举字段
        defaults[fieldName] = ['value1', 'value2', 'value3'][i % 3];
      } else {
        defaults[fieldName] = `${type} field ${i + 1} value`;
      }
    } else if (fieldType === 'number') {
      defaults[fieldName] = (i + 1) * 10;
    } else {
      defaults[fieldName] = i % 2 === 0;
    }
  }

  return defaults;
}
