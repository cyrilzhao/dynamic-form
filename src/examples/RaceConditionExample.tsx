import React, { useRef, useState } from 'react'
import { Card, Button, Callout } from '@blueprintjs/core'
import { DynamicForm, type DynamicFormRef } from '@/components/DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import type { LinkageFunction } from '@/components/DynamicForm'

/**
 * 竞态条件测试示例（修复后验证）
 *
 * 修复方案：移除自动初始化，改为手动调用 refreshLinkage
 *
 * 新的执行流程：
 *   1. 组件挂载后，需要手动调用 formRef.current.refreshLinkage() 初始化联动
 *   2. refreshLinkage 会等待 processQueue 完成后再执行，避免并发
 *   3. processQueue 之间是串行的，通过任务队列管理
 *
 * 测试场景：
 *   - slowField: 依赖 base，visibility 联动（2000ms）
 *   - fastField: 依赖 fast，visibility 联动（200ms）
 *
 * 验证步骤：
 *   1. 点击"初始化联动"按钮，触发 refreshLinkage（2000ms）
 *   2. 在 2000ms 内点击"触发快速联动"，设置 fast="yes"
 *   3. 观察 fastField 是否正确显示并保持可见
 *
 * 预期结果（无竞态）：
 *   - refreshLinkage 检测到 processQueue 正在运行，等待其完成
 *   - 或 processQueue 等待 refreshLinkage 完成后执行
 *   - fastField 最终保持 visible=true（正确）
 */

type LogEntry = {
  time: string
  message: string
  type: 'refresh' | 'queue' | 'warn' | 'info'
}

let logCollector: ((entry: LogEntry) => void) | null = null

function addLog(message: string, type: LogEntry['type']) {
  const time = new Date().toISOString().slice(11, 23)
  logCollector?.({ time, message, type })
}

// 慢速 visibility 联动（2000ms）：base 有值则显示 slowField
const slowVisibilityFn: LinkageFunction = async (formData) => {
  addLog(`[REFRESH] slowVisibilityFn 开始，base="${formData.base}"`, 'refresh')
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const result = Boolean(formData.base)
  addLog(`[REFRESH] slowVisibilityFn 完成 → visible=${result}`, 'refresh')
  return result
}

// 快速 visibility 联动（200ms）：fast 有值则显示 fastField
const fastVisibilityFn: LinkageFunction = async (formData) => {
  addLog(`[QUEUE] fastVisibilityFn 开始，fast="${formData.fast}"`, 'queue')
  await new Promise((resolve) => setTimeout(resolve, 200))
  const result = Boolean(formData.fast)
  addLog(`[QUEUE] fastVisibilityFn 完成 → visible=${result}`, 'queue')
  return result
}

/**
 * Schema 设计：
 * - base: 固定默认值 "init"，触发 slowField 的慢速 visibility 联动（2000ms）
 * - fast: 默认为空，用户修改触发 fastField 的快速 visibility 联动（200ms）
 * - slowField: 依赖 base 的 visibility 联动（慢，2000ms）
 * - fastField: 依赖 fast 的 visibility 联动（快，200ms）
 *
 * 测试场景（修复后）：
 * T=0:    点击"初始化联动"，refreshLinkage 开始（2000ms）
 * T=100:  点击"触发快速联动"，fast="yes"，processQueue 尝试开始
 *         - refreshLinkage 正在运行，processQueue 等待
 * T=2000: refreshLinkage 完成，slowField 和 fastField 都基于初始数据计算
 * T=2001: processQueue 开始执行，计算 fastField（200ms）
 * T=2201: processQueue 完成，fastField 更新为 visible=true
 *
 * 预期结果：fastField 最终显示（无竞态）
 */
const schema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Race Condition Test Form',
  properties: {
    base: {
      type: 'string',
      title: 'Base（只读，触发 slowField 的慢速 visibility 联动 2000ms）',
      ui: {
        widget: 'input',
        widgetProps: {
          readonly: true,
        },
      },
    },
    fast: {
      type: 'string',
      title:
        'Fast（点击按钮设置为 "yes"，触发 fastField 的快速 visibility 联动 200ms）',
      ui: {
        widget: 'input',
        widgetProps: {
          readonly: true,
        },
      },
    },
    slowField: {
      type: 'string',
      title: '🔵 Slow Field（依赖 base，visibility 联动 2000ms）',
      ui: {
        widget: 'input',
        placeholder: 'I appear after slow linkage (2000ms)',
        linkages: [
          {
            type: 'visibility',
            dependencies: ['#/properties/base'],
            fulfill: {
              function: 'slowVisibilityFn',
            },
          },
        ],
      },
    },
    fastField: {
      type: 'string',
      title:
        '⚡ Fast Field（依赖 fast，visibility 联动 200ms）——观察是否被竞态覆盖',
      ui: {
        widget: 'input',
        placeholder: 'I should appear ~200ms after you click the button',
        linkages: [
          {
            type: 'visibility',
            dependencies: ['#/properties/fast'],
            fulfill: {
              function: 'fastVisibilityFn',
            },
          },
        ],
      },
    },
  },
}

const defaultValues = {
  base: 'init',
  fast: '',
  slowField: '',
  fastField: '',
}

export const RaceConditionExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [raceTriggered, setRaceTriggered] = useState(false)
  const [initialized, setInitialized] = useState(false)

  React.useEffect(() => {
    logCollector = (entry) => {
      setLogs((prev) => [...prev.slice(-100), entry])
    }
    addLog('📋 页面已加载，等待手动初始化联动', 'info')
    addLog('💡 点击"初始化联动"按钮开始测试', 'warn')
    return () => {
      logCollector = null
    }
  }, [])

  const linkageFunctions: Record<string, LinkageFunction> = {
    slowVisibilityFn,
    fastVisibilityFn,
  }

  /**
   * 手动初始化联动
   */
  const handleInitialize = async () => {
    if (!formRef.current) return
    addLog('🚀 手动初始化联动开始（2000ms）', 'refresh')
    addLog('   - slowField: slowVisibilityFn(base="init") → 2000ms', 'refresh')
    addLog('   - fastField: fastVisibilityFn(fast="")    → 200ms', 'refresh')
    setInitialized(true)
    await formRef.current.refreshLinkage()
    addLog('✅ 初始化完成', 'info')
  }

  /**
   * 在 refreshLinkage 执行期间设置 fast="yes"，触发 processQueue。
   * processQueue 会等待 refreshLinkage 完成后执行。
   */
  const triggerFastLinkage = () => {
    if (!formRef.current) return
    addLog('⚡ 用户操作：fast="yes"（触发 processQueue，200ms）', 'warn')
    addLog('   预期：processQueue 等待 refreshLinkage 完成后执行', 'warn')
    setRaceTriggered(true)
    formRef.current.setValue('fast', 'yes', { shouldDirty: true })
  }

  const handleReset = () => {
    formRef.current?.reset(defaultValues)
    setLogs([])
    setRaceTriggered(false)
    setInitialized(false)
    setTimeout(() => {
      addLog('🔄 表单已重置', 'info')
      addLog('💡 点击"初始化联动"按钮开始测试', 'warn')
    }, 50)
  }

  const logColors: Record<LogEntry['type'], string> = {
    refresh: '#5c8ee8',
    queue: '#3dba7a',
    warn: '#e8a93d',
    info: '#999',
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <Card>
        <h2>Race Condition Test (After Fix)</h2>
        <Callout
          intent="success"
          title="修复方案：移除自动初始化，改为手动触发"
          style={{ marginBottom: '16px' }}
        >
          <p>
            <strong>核心改动：</strong>
            <br />
            • 移除自动初始化的 useEffect
            <br />• 暴露 <code>refreshLinkage()</code> 方法供手动调用
            <br />• refreshLinkage 会等待 processQueue 完成后再执行，避免并发
          </p>
          <p style={{ marginTop: '8px' }}>
            <strong>测试步骤：</strong>
          </p>
          <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>
            <li>点击"初始化联动"按钮，触发 refreshLinkage（2000ms）</li>
            <li>
              <strong>在 2000ms 内</strong>点击"触发快速联动"按钮
            </li>
            <li>观察 processQueue 是否等待 refreshLinkage 完成</li>
            <li>
              观察 <strong>Fast Field 是否正确显示并保持可见</strong>
            </li>
          </ol>
          <p style={{ marginTop: '8px' }}>
            ✅ <strong>预期结果（无竞态）</strong>：Fast Field
            最终显示并保持可见
          </p>
        </Callout>

        <DynamicForm
          ref={formRef}
          schema={schema}
          linkageFunctions={linkageFunctions}
          defaultValues={defaultValues}
          onSubmit={(data) => console.log('Submit:', data)}
          layout="vertical"
        />

        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <Button
            intent="primary"
            onClick={handleInitialize}
            disabled={initialized}
          >
            🚀 初始化联动（2000ms）
          </Button>
          <Button
            intent="danger"
            onClick={triggerFastLinkage}
            disabled={!initialized || raceTriggered}
          >
            ⚡ 触发快速联动（在初始化期间点击）
          </Button>
          <Button onClick={handleReset}>🔄 重置</Button>
        </div>

        {raceTriggered && (
          <Callout intent="primary" style={{ marginTop: '12px' }}>
            已触发 fast="yes"。观察执行日志和 <strong>Fast Field</strong>：
            <br />• processQueue 应该等待 refreshLinkage 完成
            <br />• Fast Field 最终应该<strong>显示并保持可见</strong>（无竞态）
          </Callout>
        )}
      </Card>

      {/* 执行日志 */}
      <Card style={{ marginTop: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <h3 style={{ margin: 0 }}>执行日志</h3>
          <Button small minimal onClick={() => setLogs([])}>
            清空
          </Button>
        </div>
        <p style={{ color: '#666', fontSize: '12px', marginBottom: '8px' }}>
          <span style={{ color: logColors.refresh }}>
            ■ refreshLinkage 路径（2000ms）
          </span>
          {' · '}
          <span style={{ color: logColors.queue }}>
            ■ processQueue 路径（200ms）
          </span>
          {' · '}
          <span style={{ color: logColors.warn }}>■ 操作/提示</span>
          {' · '}
          <span style={{ color: logColors.info }}>■ 信息</span>
        </p>
        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            background: '#1e1e1e',
            borderRadius: '4px',
            padding: '10px 14px',
            fontFamily: 'monospace',
            fontSize: '11px',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#555' }}>等待联动执行...</div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                style={{
                  color: logColors[log.type],
                  marginBottom: '3px',
                  lineHeight: '1.6',
                }}
              >
                <span style={{ color: '#555' }}>{log.time}</span> {log.message}
              </div>
            ))
          )}
        </div>
      </Card>

      <Card style={{ marginTop: '16px' }}>
        <h3>技术分析</h3>
        <div style={{ color: '#555', fontSize: '13px', lineHeight: '1.7' }}>
          <p>
            <strong>修复方案：移除自动初始化，改为手动触发</strong>
          </p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>
              <strong>问题根源：</strong>自动初始化与 processQueue
              并发执行，导致状态覆盖
            </li>
            <li>
              <strong>修复方案：</strong>移除自动初始化的 useEffect，暴露{' '}
              <code>refreshLinkage()</code> 方法
            </li>
            <li>
              <strong>竞态避免：</strong>refreshLinkage 会检查并等待
              processQueue 完成后再执行
            </li>
            <li>
              <strong>代码简化：</strong>移除了复杂的 FieldWriteCounter
              版本号机制（约150行代码）
            </li>
          </ul>
          <p>
            <strong>新的执行流程：</strong>
          </p>
          <ol style={{ paddingLeft: '20px' }}>
            <li>
              用户手动调用 <code>refreshLinkage()</code> 初始化联动
            </li>
            <li>如果 processQueue 正在运行，refreshLinkage 等待其完成</li>
            <li>如果 refreshLinkage 正在运行，processQueue 等待其完成</li>
            <li>两者串行执行，不会互相覆盖</li>
          </ol>
          <p>
            <strong>优势：</strong>
            代码更简洁，逻辑更清晰，易于维护，完全避免竞态问题。
          </p>
        </div>
      </Card>
    </div>
  )
}
