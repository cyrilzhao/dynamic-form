import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DynamicForm, type DynamicFormRef } from '../components/DynamicForm';
import type { ExtendedJSONSchema } from '../components/DynamicForm/types/schema';
import type { LinkageFunction } from '../components/DynamicForm/types/linkage';

/**
 * LinkageContext 示例
 *
 * 演示如何使用 linkageContext 将页面级的外部数据传递给联动函数
 *
 * 使用场景：
 * - 联动函数需要依赖异步加载的外部数据（如 API 返回的数据）
 * - 避免联动函数通过闭包捕获外部变量（导致引用问题）
 * - 实现更纯粹的函数式联动逻辑
 */
export const LinkageContextExample: React.FC = () => {
  // 模拟异步加载的外部数据
  const [cities, setCities] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<DynamicFormRef>(null);

  // 模拟从 API 加载城市数据
  useEffect(() => {
    setTimeout(() => {
      setCities({
        CN: ['北京', '上海', '广州', '深圳'],
        US: ['纽约', '洛杉矶', '芝加哥', '休斯顿'],
        JP: ['东京', '大阪', '京都', '横滨'],
      });
      setLoading(false);
    }, 1000);
  }, []);

  // Schema 定义
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      country: {
        type: 'string',
        title: '国家',
        enum: ['CN', 'US', 'JP'],
        enumNames: ['中国', '美国', '日本'],
      },
      city: {
        type: 'string',
        title: '城市',
        ui: {
          widget: 'select',
          placeholder: '请先选择国家',
          linkages: [
            {
              type: 'options',
              dependencies: ['#/properties/country'],
              fulfill: { function: 'loadCityOptions' },
            },
          ],
        },
      },
    },
    required: ['country', 'city'],
  };

  // ✅ 正确方式：联动函数从 context.externalData 获取外部数据
  const linkageFunctions: Record<string, LinkageFunction> = {
    loadCityOptions: async (formData, context) => {
      // 从 context.externalData 获取城市数据
      const { cities } = context?.externalData || {};
      const country = formData.country;

      if (!cities || !country) {
        return [];
      }

      const cityList = cities[country as keyof typeof cities] || [];
      return cityList.map((city: string) => ({
        label: city,
        value: city,
      }));
    },
  };

  // ✅ 使用 useMemo 稳定 linkageContext 引用，避免不必要的重新渲染
  const linkageContext = useMemo(() => ({ cities }), [cities]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>LinkageContext 示例</h1>

      <div style={{
        background: '#f0f7ff',
        padding: '16px',
        borderRadius: '4px',
        marginBottom: '20px'
      }}>
        <h3>📖 功能说明</h3>
        <p>
          <code>linkageContext</code> 允许您将页面级的外部数据传递给联动函数，
          避免通过闭包捕获导致的引用问题。
        </p>
        <p><strong>当前状态：</strong> {loading ? '正在加载城市数据...' : '城市数据已加载'}</p>
      </div>

      {/* 示例表单将在后续添加 */}
      <div style={{
        background: '#fff',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <h3>表单示例</h3>
        {loading ? (
          <p>正在加载数据...</p>
        ) : (
          <DynamicForm
            ref={formRef}
            schema={schema}
            linkageFunctions={linkageFunctions}
            linkageContext={linkageContext}
            onSubmit={(data) => {
              console.log('提交的数据：', data);
              alert(`提交成功！\n国家：${data.country}\n城市：${data.city}`);
            }}
          />
        )}
      </div>

      <div style={{
        background: '#f6f8fa',
        padding: '16px',
        borderRadius: '4px',
        marginTop: '20px'
      }}>
        <h3>💡 使用要点</h3>
        <ol>
          <li>
            <strong>传递外部数据：</strong>
            <code>linkageContext=&#123;&#123; cities &#125;&#125;</code>
          </li>
          <li>
            <strong>联动函数获取：</strong>
            <code>const &#123; cities &#125; = context</code>
          </li>
          <li>
            <strong>自动刷新：</strong> cities 数据变化时，联动会自动重新执行
          </li>
        </ol>
      </div>
    </div>
  );
};
