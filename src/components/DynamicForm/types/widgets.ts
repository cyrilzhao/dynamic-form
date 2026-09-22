import type { ComponentType } from 'react'
import type { FieldWidgetProps, NestedFormWidgetProps } from './index'
import type { ExtendedJSONSchema } from './schema'

export type WidgetSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'

/**
 * Widget 元数据定义。
 * valueSchema/valueType 描述 Widget 的提交值，propsSchema 描述静态配置参数。
 */
export interface WidgetDefinition {
  name: string
  component: ComponentType<FieldWidgetProps>
  valueSchema?: ExtendedJSONSchema
  valueType?: WidgetSchemaType
  propsSchema?: ExtendedJSONSchema
  supports?: {
    schemaTypes?: WidgetSchemaType[]
  }
}

/**
 * Widget 预设包接口
 * 定义了一套完整的表单组件集合
 */
export interface WidgetPreset {
  text: ComponentType<FieldWidgetProps>
  textarea: ComponentType<FieldWidgetProps>
  password: ComponentType<FieldWidgetProps>
  email: ComponentType<FieldWidgetProps>
  url: ComponentType<FieldWidgetProps>
  number: ComponentType<FieldWidgetProps>
  select: ComponentType<FieldWidgetProps>
  radio: ComponentType<FieldWidgetProps>
  checkbox: ComponentType<FieldWidgetProps>
  'checkbox-group': ComponentType<FieldWidgetProps>
  'schema-builder': ComponentType<FieldWidgetProps>
  switch: ComponentType<FieldWidgetProps>
  'nested-form': ComponentType<NestedFormWidgetProps>
  array: ComponentType<FieldWidgetProps>
  'key-value-array': ComponentType<FieldWidgetProps>
  'table-array': ComponentType<FieldWidgetProps>
  variant: ComponentType<FieldWidgetProps>
  'code-editor': ComponentType<FieldWidgetProps>
  'object-editor': ComponentType<FieldWidgetProps>
  file: ComponentType<FieldWidgetProps>
  'upload-input'?: ComponentType<FieldWidgetProps>
  'upload-list-input'?: ComponentType<FieldWidgetProps>
}

/**
 * 部分 Widget 预设
 * 允许只覆盖部分 widgets
 */
export type PartialWidgetPreset = Partial<WidgetPreset>

/**
 * Widget 注册表类型
 */
export type WidgetRegistry = Record<string, ComponentType<any>>
