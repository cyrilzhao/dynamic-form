import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  Elevation,
  Button,
  FormGroup,
  NumericInput,
  Switch,
  H3,
  H4,
  Callout,
} from '@blueprintjs/core';
import { DynamicForm } from '../../../components/DynamicForm/DynamicForm';
import type { ExtendedJSONSchema } from '../../../components/DynamicForm/types/schema';

/**
 * React.memo 性能测试示例
 *
 * 测试目标：
 * 1. 对比优化前后的渲染性能
 * 2. 统计组件重渲染次数
 * 3. 测量输入响应时间
 * 4. 测试大规模数据场景（50 个数组项 × 50 个字段 = 2500+ 字段）
 */
export const MemoPerformanceTest: React.FC = () => {
  const [arrayItemCount, setArrayItemCount] = useState(50);
  const [fieldsPerItem, setFieldsPerItem] = useState(50);
  const [enableMonitoring, setEnableMonitoring] = useState(true);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // 性能统计
  const [renderStats, setRenderStats] = useState({
    changeCount: 0,
    inputResponseTime: 0,
    schemaGenerationTime: 0,
  });

  const changeCount = useRef<number>(0);
  const lastChangeTime = useRef<number>(0);
  const recentResponseTimes = useRef<number[]>([]);

  // 生成测试 Schema
  const schema = useMemo(() => {
    const startTime = performance.now();
    const generatedSchema = generateLargeScaleSchema(arrayItemCount, fieldsPerItem);
    const endTime = performance.now();
    setRenderStats(prev => ({
      ...prev,
      schemaGenerationTime: endTime - startTime,
    }));
    return generatedSchema;
  }, [arrayItemCount, fieldsPerItem]);

  // 生成默认值
  const defaultValues = useMemo(() => {
    return generateLargeScaleDefaultValues(arrayItemCount, fieldsPerItem);
  }, [arrayItemCount, fieldsPerItem]);

  // 计算总字段数
  const totalFields = useMemo(() => {
    return calculateTotalFields(arrayItemCount, fieldsPerItem);
  }, [arrayItemCount, fieldsPerItem]);

  // 处理表单变化
  const handleChange = useCallback((data: Record<string, any>) => {
    if (!enableMonitoring) return;

    const currentTime = performance.now();
    changeCount.current += 1;

    // 计算输入响应时间（连续输入之间的间隔）
    if (lastChangeTime.current > 0) {
      const responseTime = currentTime - lastChangeTime.current;

      // 只记录合理的响应时间（小于 1 秒），过滤掉长时间停顿后的输入
      if (responseTime < 1000) {
        recentResponseTimes.current.push(responseTime);
        // 只保留最近 10 次的响应时间
        if (recentResponseTimes.current.length > 10) {
          recentResponseTimes.current.shift();
        }

        // 计算平均响应时间
        const avgResponseTime = recentResponseTimes.current.reduce((a, b) => a + b, 0) / recentResponseTimes.current.length;

        setRenderStats(prev => ({
          ...prev,
          changeCount: changeCount.current,
          inputResponseTime: avgResponseTime,
        }));
      } else {
        // 长时间停顿后的输入，只更新计数
        setRenderStats(prev => ({
          ...prev,
          changeCount: changeCount.current,
        }));
      }
    } else {
      setRenderStats(prev => ({
        ...prev,
        changeCount: changeCount.current,
      }));
    }

    lastChangeTime.current = currentTime;
  }, [enableMonitoring]);

  const handleSubmit = useCallback((data: Record<string, any>) => {
    console.log('Form submitted:', data);
    setFormData(data);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <H3>React.memo Performance Test</H3>
      <p>Test the performance improvements from React.memo optimization</p>

      {/* 配置面板 */}
      <Card elevation={Elevation.TWO} style={{ marginBottom: '20px', padding: '15px' }}>
        <H4>Configuration</H4>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <FormGroup label="Array Item Count" inline>
            <NumericInput
              value={arrayItemCount}
              onValueChange={value => setArrayItemCount(value)}
              min={10}
              max={100}
              stepSize={10}
              style={{ width: '100px' }}
            />
          </FormGroup>

          <FormGroup label="Fields Per Item" inline>
            <NumericInput
              value={fieldsPerItem}
              onValueChange={value => setFieldsPerItem(value)}
              min={10}
              max={100}
              stepSize={10}
              style={{ width: '100px' }}
            />
          </FormGroup>

          <div>
            <Switch
              checked={enableMonitoring}
              label="Enable Performance Monitoring"
              onChange={e => setEnableMonitoring(e.currentTarget.checked)}
            />
          </div>

          <Button
            icon="refresh"
            onClick={() => {
              changeCount.current = 0;
              lastChangeTime.current = 0;
              recentResponseTimes.current = [];
              setRenderStats({
                changeCount: 0,
                inputResponseTime: 0,
                schemaGenerationTime: 0,
              });
            }}
          >
            Reset Stats
          </Button>
        </div>

        <div style={{ marginTop: '15px', color: '#666' }}>
          <p>
            <strong>Total Fields:</strong> {totalFields}
            <span style={{ marginLeft: '20px' }}>
              ({arrayItemCount} items × {fieldsPerItem} fields)
            </span>
          </p>
          <p>
            <strong>Schema Generation Time:</strong> {renderStats.schemaGenerationTime.toFixed(2)}ms
          </p>
        </div>
      </Card>

      {/* 性能统计面板 */}
      {enableMonitoring && (
        <Card elevation={Elevation.TWO} style={{ marginBottom: '20px', padding: '15px' }}>
          <H4>Performance Metrics</H4>
          <Callout intent="primary" style={{ marginBottom: '15px' }}>
            <strong>Test Instructions:</strong> Type in the first field of the first array item to
            see the performance impact. With React.memo optimization, only the modified field should
            re-render.
          </Callout>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
            <div>
              <strong>Form Changes:</strong>
              <div style={{ fontSize: '24px', color: '#0F9960' }}>{renderStats.changeCount}</div>
            </div>
            <div>
              <strong>Schema Generation Time:</strong>
              <div style={{ fontSize: '24px', color: '#0F9960' }}>
                {renderStats.schemaGenerationTime.toFixed(2)}ms
              </div>
            </div>
            <div>
              <strong>Input Response Time:</strong>
              <div style={{ fontSize: '24px', color: '#0F9960' }}>
                {renderStats.inputResponseTime.toFixed(2)}ms
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 动态表单 */}
      <DynamicForm
        key={`${arrayItemCount}-${fieldsPerItem}`}
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        onChange={handleChange}
        enableVirtualScroll={true}
        virtualScrollHeight={600}
      />
    </div>
  );
};

/**
 * 生成大规模测试 Schema
 * 参考 LargeDataPerformanceExample 的数据规模
 */
function generateLargeScaleSchema(
  arrayItemCount: number,
  fieldsPerItem: number
): ExtendedJSONSchema {
  return {
    type: 'object',
    title: 'React.memo Performance Test Form',
    properties: {
      configurations: {
        type: 'array',
        title: 'Test Configurations',
        minItems: 1,
        items: generateArrayItemSchema(fieldsPerItem),
        ui: {
          addButtonText: 'Add Configuration',
          emptyText: 'No configurations yet',
        },
      },
    },
  };
}

/**
 * 生成数组项的 Schema
 */
function generateArrayItemSchema(fieldsPerItem: number): ExtendedJSONSchema {
  const properties: Record<string, ExtendedJSONSchema> = {
    configName: {
      type: 'string',
      title: 'Configuration Name',
      ui: { placeholder: 'Enter configuration name' },
    },
    configType: {
      type: 'string',
      title: 'Configuration Type',
      enum: ['database', 'api', 'cache', 'queue'],
      enumNames: ['Database', 'API', 'Cache', 'Queue'],
    },
    enabled: {
      type: 'boolean',
      title: 'Enabled',
      ui: { widget: 'switch' },
      default: true,
    },
  };

  // 生成多个字段（模拟大规模数据）
  for (let i = 0; i < fieldsPerItem; i++) {
    const fieldType = i % 4;

    if (fieldType === 0) {
      properties[`field${i}`] = {
        type: 'string',
        title: `Text Field ${i + 1}`,
        ui: { placeholder: `Enter text ${i + 1}` },
      };
    } else if (fieldType === 1) {
      properties[`field${i}`] = {
        type: 'number',
        title: `Number Field ${i + 1}`,
        ui: { placeholder: `Enter number ${i + 1}` },
      };
    } else if (fieldType === 2) {
      properties[`field${i}`] = {
        type: 'string',
        title: `Select Field ${i + 1}`,
        enum: ['option1', 'option2', 'option3'],
        enumNames: ['Option 1', 'Option 2', 'Option 3'],
      };
    } else {
      properties[`field${i}`] = {
        type: 'boolean',
        title: `Boolean Field ${i + 1}`,
        ui: { widget: 'switch' },
      };
    }
  }

  return {
    type: 'object',
    title: 'Configuration',
    properties,
    required: ['configName', 'configType'],
  };
}

/**
 * 生成大规模默认值
 */
function generateLargeScaleDefaultValues(
  arrayItemCount: number,
  fieldsPerItem: number
): Record<string, any> {
  const configurations = [];

  for (let i = 0; i < arrayItemCount; i++) {
    const config: any = {
      configName: `Configuration ${i + 1}`,
      configType: ['database', 'api', 'cache', 'queue'][i % 4],
      enabled: i % 2 === 0,
    };

    // 生成字段默认值
    for (let j = 0; j < fieldsPerItem; j++) {
      const fieldType = j % 4;
      if (fieldType === 0) {
        config[`field${j}`] = `Text ${i + 1}-${j + 1}`;
      } else if (fieldType === 1) {
        config[`field${j}`] = (i + 1) * 10 + j;
      } else if (fieldType === 2) {
        config[`field${j}`] = 'option1';
      } else {
        config[`field${j}`] = j % 2 === 0;
      }
    }

    configurations.push(config);
  }

  return { configurations };
}

/**
 * 计算总字段数
 */
function calculateTotalFields(arrayItemCount: number, fieldsPerItem: number): number {
  // 每个数组项包含：3 个基础字段 + fieldsPerItem 个自定义字段
  return arrayItemCount * (3 + fieldsPerItem);
}
