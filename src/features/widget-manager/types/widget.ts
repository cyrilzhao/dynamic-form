/**
 * 自定义 Widget 类型定义
 */

export type WidgetStatus = 'draft' | 'published' | 'archived'

export interface CustomWidget {
  id: string
  name: string
  code: string
  compiledCode?: string
  status: WidgetStatus
  version: number
  latestPublishedVersion?: number
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  publishedBy?: string
  publishedAt?: string
  usageCount: number
}

export interface WidgetVersion {
  id: string
  widgetId: string
  version: number
  code: string
  compiledCode?: string
  status: WidgetStatus
  changelog?: string
  createdBy: string
  createdAt: string
  publishedBy?: string
  publishedAt?: string
}

export interface CompileResult {
  success: boolean
  code?: string
  error?: string
}

export interface ExecuteResult {
  success: boolean
  component?: React.ComponentType<any>
  error?: string
}
