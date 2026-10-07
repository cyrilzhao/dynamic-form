import { cloneDeep, isEqual } from 'lodash'
import type { WidgetDefinition } from '../../DynamicForm/types/widgets'
import type { ExtendedJSONSchema } from '../../DynamicForm/types/schema'

export interface WidgetCompatibilityResult {
  compatible: boolean
  expectedType?: ExtendedJSONSchema['type']
  supportedTypes?: WidgetDefinition['supports']['schemaTypes']
  actualType?: ExtendedJSONSchema['type']
}

export interface WidgetSchemaMergeResult {
  schema: ExtendedJSONSchema
  addedPaths: string[]
  changedType: boolean
  compatibility: WidgetCompatibilityResult
}

export type WidgetConflictAction = 'use-widget-type' | 'remove-widget'

export interface WidgetConflictResolutionResult {
  schema: ExtendedJSONSchema
  removeWidget: boolean
}

export interface WidgetSchemaContractIssue {
  path: string
  message: string
}

export const getWidgetValueType = (
  widgetDefinition: WidgetDefinition,
): ExtendedJSONSchema['type'] | undefined =>
  widgetDefinition.valueSchema?.type ?? widgetDefinition.valueType

const extractDefaults = (schema: ExtendedJSONSchema): unknown => {
  if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
    return cloneDeep(schema.default)
  }

  if (schema.type === 'object' && schema.properties) {
    const defaults: Record<string, unknown> = {}
    Object.entries(schema.properties).forEach(([key, childSchema]) => {
      const childDefault = extractDefaults(childSchema)
      if (childDefault !== undefined) {
        defaults[key] = childDefault
      }
    })
    return Object.keys(defaults).length > 0 ? defaults : undefined
  }

  if (schema.type === 'array' && schema.items && !Array.isArray(schema.items)) {
    const itemDefault = extractDefaults(schema.items)
    return itemDefault === undefined ? undefined : [itemDefault]
  }

  return undefined
}

export const getSchemaDefaults = (
  schema: ExtendedJSONSchema | undefined,
): Record<string, unknown> => {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return {}
  }
  return (extractDefaults(schema) as Record<string, unknown> | undefined) ?? {}
}

export const checkWidgetCompatibility = ({
  fieldSchema,
  widgetDefinition,
}: {
  fieldSchema: ExtendedJSONSchema
  widgetDefinition: WidgetDefinition
}): WidgetCompatibilityResult => {
  const expectedType = getWidgetValueType(widgetDefinition)
  const actualType = fieldSchema.type
  if (!actualType) {
    return { compatible: true, expectedType, actualType }
  }
  if (!expectedType && widgetDefinition.supports?.schemaTypes) {
    const actualTypes = Array.isArray(actualType) ? actualType : [actualType]
    return {
      compatible: actualTypes.every((type) =>
        widgetDefinition.supports!.schemaTypes!.includes(type),
      ),
      expectedType,
      supportedTypes: widgetDefinition.supports.schemaTypes,
      actualType,
    }
  }
  if (!expectedType) {
    return { compatible: true, expectedType, actualType }
  }
  return {
    compatible: expectedType === actualType,
    expectedType,
    actualType,
  }
}

const mergeWidgetSchemaWithConfiguration = ({
  currentSchema,
  widgetSchema,
  path,
}: {
  currentSchema: ExtendedJSONSchema | undefined
  widgetSchema: ExtendedJSONSchema
  path: string
}): { schema: ExtendedJSONSchema; addedPaths: string[] } => {
  const {
    type: _currentType,
    properties: currentProperties,
    required: _currentRequired,
    items: currentItems,
    ...currentConfiguration
  } = currentSchema ?? {}
  const schema: ExtendedJSONSchema = {
    ...cloneDeep(widgetSchema),
    ...cloneDeep(currentConfiguration),
    type: widgetSchema.type,
  }
  const addedPaths: string[] = []

  if (widgetSchema.type === 'object' && widgetSchema.properties) {
    schema.properties = {}
    Object.entries(widgetSchema.properties).forEach(([key, propertySchema]) => {
      const mergedProperty = mergeWidgetSchemaWithConfiguration({
        currentSchema: undefined,
        widgetSchema: propertySchema,
        path: `${path}.properties.${key}`,
      })
      schema.properties![key] = mergedProperty.schema
      addedPaths.push(...mergedProperty.addedPaths)
      if (!currentProperties?.[key]) {
        addedPaths.push(`${path}.properties.${key}`)
      }
    })
    schema.required = cloneDeep(widgetSchema.required)
  }

  if (widgetSchema.type === 'array' && widgetSchema.items) {
    if (Array.isArray(widgetSchema.items)) {
      schema.items = cloneDeep(widgetSchema.items)
    } else {
      const mergedItems = mergeWidgetSchemaWithConfiguration({
        currentSchema: undefined,
        widgetSchema: widgetSchema.items,
        path: `${path}.items`,
      })
      schema.items = mergedItems.schema
      addedPaths.push(...mergedItems.addedPaths)
      if (!currentItems) {
        addedPaths.push(`${path}.items`)
      }
    }
  }

  return { schema, addedPaths }
}

export const mergeWidgetValueSchema = ({
  currentSchema,
  widgetSchema,
}: {
  currentSchema: ExtendedJSONSchema
  widgetSchema: ExtendedJSONSchema
}): WidgetSchemaMergeResult => {
  const changedType = currentSchema.type !== widgetSchema.type
  const merged = mergeWidgetSchemaWithConfiguration({
    currentSchema,
    widgetSchema,
    path: '',
  })

  return {
    schema: merged.schema,
    addedPaths: merged.addedPaths.map((path) => path.replace(/^\./, '')),
    changedType,
    compatibility: {
      compatible: true,
      expectedType: widgetSchema.type,
      actualType: merged.schema.type,
    },
  }
}

export const resolveWidgetTypeConflict = ({
  action,
  currentSchema,
  widgetDefinition,
}: {
  action: WidgetConflictAction
  currentSchema: ExtendedJSONSchema
  widgetDefinition: WidgetDefinition
}): WidgetConflictResolutionResult => {
  if (action === 'use-widget-type' && widgetDefinition.valueSchema) {
    const merged = mergeWidgetValueSchema({
      currentSchema,
      widgetSchema: widgetDefinition.valueSchema,
    })
    return { schema: merged.schema, removeWidget: false }
  }

  const schema = cloneDeep(currentSchema)
  if (schema.ui) {
    delete schema.ui.widget
    delete schema.ui.widgetProps
    if (Object.keys(schema.ui).length === 0) {
      delete schema.ui
    }
  }
  return { schema, removeWidget: true }
}

const getSchemaNodeAtPath = (
  schema: ExtendedJSONSchema,
  path: string[],
): ExtendedJSONSchema | undefined => {
  let currentSchema: ExtendedJSONSchema | undefined = schema
  let index = 0

  while (currentSchema && index < path.length) {
    const segment = path[index]
    if (segment === 'properties') {
      const fieldName = path[index + 1]
      currentSchema = fieldName
        ? currentSchema.properties?.[fieldName]
        : undefined
      index += 2
      continue
    }
    if (segment === 'items') {
      currentSchema = Array.isArray(currentSchema.items)
        ? undefined
        : currentSchema.items
      index += 1
      continue
    }
    return undefined
  }

  return currentSchema
}

/**
 * 返回路径对应的 Widget 值契约 Schema。
 * 返回值存在表示该节点的 key 和 type 由 Widget 输出契约固定。
 */
export const getWidgetContractSchemaAtPath = ({
  schema,
  path,
  widgetDefinitions = [],
}: {
  schema: ExtendedJSONSchema
  path: string[]
  widgetDefinitions?: WidgetDefinition[]
}): ExtendedJSONSchema | undefined => {
  for (let length = path.length; length >= 0; length -= 1) {
    const ownerPath = path.slice(0, length)
    const ownerSchema = getSchemaNodeAtPath(schema, ownerPath)
    const widgetName = ownerSchema?.ui?.widget
    const widgetDefinition = widgetDefinitions.find(
      (definition) => definition.name === widgetName,
    )
    if (!ownerSchema || !widgetDefinition?.valueSchema) {
      continue
    }

    const relativePath = path.slice(length)
    if (relativePath.length === 0) {
      continue
    }
    return getSchemaNodeAtPath(widgetDefinition.valueSchema, relativePath)
  }

  return undefined
}

/** 判断路径是否正好指向声明 valueSchema 的 Widget 字段。 */
export const isWidgetValueSchemaOwnerPath = ({
  schema,
  path,
  widgetDefinitions = [],
}: {
  schema: ExtendedJSONSchema
  path: string[]
  widgetDefinitions?: WidgetDefinition[]
}): boolean => {
  const currentSchema = getSchemaNodeAtPath(schema, path)
  return widgetDefinitions.some(
    (definition) =>
      definition.name === currentSchema?.ui?.widget && definition.valueSchema,
  )
}

/** 判断路径是否位于 Widget 完整输出结构的子节点内。 */
export const isWidgetValueSchemaDescendantPath = ({
  schema,
  path,
  widgetDefinitions = [],
}: {
  schema: ExtendedJSONSchema
  path: string[]
  widgetDefinitions?: WidgetDefinition[]
}): boolean => {
  for (let length = path.length - 1; length >= 0; length -= 1) {
    if (
      isWidgetValueSchemaOwnerPath({
        schema,
        path: path.slice(0, length),
        widgetDefinitions,
      })
    ) {
      return true
    }
  }

  return false
}

/**
 * 判断节点是否位于 array 输出 Widget 的 items 契约内。
 * array 的元素结构由 Widget 运行时输出决定，编辑器不允许修改该区域。
 */
export const isWidgetArrayItemsContractPath = ({
  schema,
  path,
  widgetDefinitions = [],
}: {
  schema: ExtendedJSONSchema
  path: string[]
  widgetDefinitions?: WidgetDefinition[]
}): boolean => {
  for (let length = path.length; length >= 0; length -= 1) {
    const ownerPath = path.slice(0, length)
    const ownerSchema = getSchemaNodeAtPath(schema, ownerPath)
    const widgetDefinition = widgetDefinitions.find(
      (definition) => definition.name === ownerSchema?.ui?.widget,
    )
    if (
      widgetDefinition?.valueSchema?.type === 'array' &&
      path[length] === 'items'
    ) {
      return true
    }
  }

  return false
}

const validateWidgetValueSchema = ({
  actualSchema,
  widgetSchema,
  widgetName,
  path,
  issues,
  isWidgetRoot,
}: {
  actualSchema: ExtendedJSONSchema
  widgetSchema: ExtendedJSONSchema
  widgetName: string
  path: string[]
  issues: WidgetSchemaContractIssue[]
  isWidgetRoot: boolean
}): void => {
  if (widgetSchema.type && actualSchema.type !== widgetSchema.type) {
    const fieldName =
      path[path.length - 2] === 'properties' ? path[path.length - 1] : null
    issues.push({
      path: `#/${path.join('/')}`,
      message: fieldName
        ? `Widget "${widgetName}" requires field "${fieldName}" to use type "${widgetSchema.type}".`
        : `Widget "${widgetName}" requires type "${widgetSchema.type}".`,
    })
    return
  }

  if (
    widgetSchema.type === 'object' &&
    !isEqual(actualSchema.required, widgetSchema.required)
  ) {
    issues.push({
      path: `#/${path.join('/')}`,
      message: `Widget "${widgetName}" requires required fields to match its value schema.`,
    })
  }

  if (!isWidgetRoot) {
    const {
      type: _actualType,
      properties: _actualProperties,
      required: _actualRequired,
      items: _actualItems,
      ...actualConfiguration
    } = actualSchema
    const {
      type: _widgetType,
      properties: _widgetProperties,
      required: _widgetRequired,
      items: _widgetItems,
      ...widgetConfiguration
    } = widgetSchema
    if (!isEqual(actualConfiguration, widgetConfiguration)) {
      const fieldName =
        path[path.length - 2] === 'properties' ? path[path.length - 1] : null
      issues.push({
        path: `#/${path.join('/')}`,
        message: fieldName
          ? `Widget "${widgetName}" requires field "${fieldName}" configuration to match its value schema.`
          : `Widget "${widgetName}" requires configuration to match its value schema.`,
      })
    }
  }

  if (widgetSchema.properties) {
    Object.entries(widgetSchema.properties).forEach(([key, childSchema]) => {
      const childPath = [...path, 'properties', key]
      const actualChild = actualSchema.properties?.[key]
      if (!actualChild) {
        issues.push({
          path: `#/${childPath.join('/')}`,
          message: `Widget "${widgetName}" requires field "${key}".`,
        })
        return
      }
      validateWidgetValueSchema({
        actualSchema: actualChild,
        widgetSchema: childSchema,
        widgetName,
        path: childPath,
        issues,
        isWidgetRoot: false,
      })
    })

    Object.keys(actualSchema.properties ?? {}).forEach((key) => {
      if (widgetSchema.properties?.[key]) {
        return
      }
      issues.push({
        path: `#/${[...path, 'properties', key].join('/')}`,
        message: `Widget "${widgetName}" does not support field "${key}".`,
      })
    })
  }

  if (widgetSchema.items && !Array.isArray(widgetSchema.items)) {
    if (!actualSchema.items || Array.isArray(actualSchema.items)) {
      issues.push({
        path: `#/${[...path, 'items'].join('/')}`,
        message: `Widget "${widgetName}" requires items schema.`,
      })
      return
    }
    validateWidgetValueSchema({
      actualSchema: actualSchema.items,
      widgetSchema: widgetSchema.items,
      widgetName,
      path: [...path, 'items'],
      issues,
      isWidgetRoot: false,
    })
  }
}

/** 校验使用 Widget valueSchema 的字段是否仍满足完整输出契约。 */
export const validateWidgetSchemaContracts = ({
  schema,
  widgetDefinitions,
}: {
  schema: ExtendedJSONSchema
  widgetDefinitions: WidgetDefinition[]
}): WidgetSchemaContractIssue[] => {
  const issues: WidgetSchemaContractIssue[] = []

  const visit = (currentSchema: ExtendedJSONSchema, path: string[]): void => {
    const widgetDefinition = widgetDefinitions.find(
      (definition) => definition.name === currentSchema.ui?.widget,
    )
    const supportedTypes = widgetDefinition?.supports?.schemaTypes
    const actualTypes = currentSchema.type
      ? Array.isArray(currentSchema.type)
        ? currentSchema.type
        : [currentSchema.type]
      : []
    if (
      widgetDefinition &&
      !getWidgetValueType(widgetDefinition) &&
      supportedTypes?.length &&
      actualTypes.some((type) => !supportedTypes.includes(type))
    ) {
      issues.push({
        path: `#/${path.join('/')}`,
        message: `Widget "${widgetDefinition.name}" supports field types ${supportedTypes
          .map((type) => `"${type}"`)
          .join(' or ')}, but the field uses type "${currentSchema.type}".`,
      })
    }
    if (widgetDefinition?.valueSchema) {
      validateWidgetValueSchema({
        actualSchema: currentSchema,
        widgetSchema: widgetDefinition.valueSchema,
        widgetName: widgetDefinition.name,
        path,
        issues,
        isWidgetRoot: true,
      })
    }

    Object.entries(currentSchema.properties ?? {}).forEach(
      ([key, childSchema]) => visit(childSchema, [...path, 'properties', key]),
    )
    if (currentSchema.items && !Array.isArray(currentSchema.items)) {
      visit(currentSchema.items, [...path, 'items'])
    }
  }

  visit(schema, [])
  return issues
}
