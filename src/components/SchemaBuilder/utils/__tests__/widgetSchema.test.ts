import type { ExtendedJSONSchema } from '../../../DynamicForm/types/schema'
import type { WidgetDefinition } from '../../../DynamicForm/types/widgets'
import {
  getWidgetValueType,
  getSchemaDefaults,
  mergeWidgetValueSchema,
  checkWidgetCompatibility,
  resolveWidgetTypeConflict,
  getWidgetContractSchemaAtPath,
  isWidgetArrayItemsContractPath,
  isWidgetValueSchemaDescendantPath,
  validateWidgetSchemaContracts,
} from '../widgetSchema'

describe('widgetSchema utilities', () => {
  const uploadWidget: WidgetDefinition = {
    name: 'upload-input',
    component: (() => null) as WidgetDefinition['component'],
    valueSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', title: 'File ID' },
        fileName: { type: 'string', title: 'File Name' },
      },
      required: ['fileId', 'fileName'],
    },
  }

  it('优先从 valueSchema 读取 Widget 输出类型', () => {
    expect(getWidgetValueType(uploadWidget)).toBe('object')
    expect(
      getWidgetValueType({
        ...uploadWidget,
        valueSchema: undefined,
        valueType: 'string',
      }),
    ).toBe('string')
  })

  it('从 propsSchema 提取默认值且不修改 Schema', () => {
    const propsSchema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        multiple: { type: 'boolean', default: false },
        nested: {
          type: 'object',
          properties: { limit: { type: 'number', default: 3 } },
        },
      },
    }

    expect(getSchemaDefaults(propsSchema)).toEqual({
      multiple: false,
      nested: { limit: 3 },
    })
    expect(propsSchema).toEqual({
      type: 'object',
      properties: {
        multiple: { type: 'boolean', default: false },
        nested: {
          type: 'object',
          properties: { limit: { type: 'number', default: 3 } },
        },
      },
    })
  })

  it('将空字段合并为 Widget 输出 Schema，同时不覆盖用户配置', () => {
    const currentSchema: ExtendedJSONSchema = {
      type: 'string',
      title: 'Custom title',
    }
    const result = mergeWidgetValueSchema({
      currentSchema,
      widgetSchema: uploadWidget.valueSchema!,
    })

    expect(result.schema).toMatchObject({
      type: 'object',
      title: 'Custom title',
      properties: uploadWidget.valueSchema!.properties,
      required: ['fileId', 'fileName'],
    })
    expect(result.changedType).toBe(true)
    expect(result.addedPaths).toEqual([
      'properties.fileId',
      'properties.fileName',
    ])
    expect(currentSchema).toEqual({ type: 'string', title: 'Custom title' })
  })

  it('object Widget 合并后只保留完整输出契约字段', () => {
    const result = mergeWidgetValueSchema({
      currentSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', title: 'Business ID' },
          customLabel: { type: 'string', title: 'Custom Label' },
        },
        required: ['fileId', 'customLabel'],
      },
      widgetSchema: uploadWidget.valueSchema!,
    })

    expect(result.schema.properties?.fileId?.title).toBe('File ID')
    expect(result.schema.properties?.fileName).toEqual({
      type: 'string',
      title: 'File Name',
    })
    expect(result.schema.properties?.customLabel).toBeUndefined()
    expect(result.schema.required).toEqual(['fileId', 'fileName'])
    expect(result.changedType).toBe(false)
  })

  it('返回字段类型与 Widget 输出类型的兼容性结果', () => {
    expect(
      checkWidgetCompatibility({
        fieldSchema: { type: 'string' },
        widgetDefinition: uploadWidget,
      }),
    ).toEqual({
      compatible: false,
      expectedType: 'object',
      actualType: 'string',
    })
    expect(
      checkWidgetCompatibility({
        fieldSchema: { type: 'object' },
        widgetDefinition: uploadWidget,
      }),
    ).toEqual({
      compatible: true,
      expectedType: 'object',
      actualType: 'object',
    })
  })

  it('Use object 会恢复类型并合并 Widget Schema', () => {
    const result = resolveWidgetTypeConflict({
      action: 'use-widget-type',
      currentSchema: { type: 'string', title: 'File' },
      widgetDefinition: uploadWidget,
    })

    expect(result.schema.type).toBe('object')
    expect(result.schema.properties?.fileId).toBeDefined()
    expect(result.removeWidget).toBe(false)
  })

  it('Remove widget 会保留字段类型并清除 Widget 配置', () => {
    const result = resolveWidgetTypeConflict({
      action: 'remove-widget',
      currentSchema: {
        type: 'string',
        ui: { widget: 'upload-input', widgetProps: { multiple: true } },
      },
      widgetDefinition: uploadWidget,
    })

    expect(result.schema.type).toBe('string')
    expect(result.schema.ui).toBeUndefined()
    expect(result.removeWidget).toBe(true)
  })

  it('识别 valueSchema 中不可删除、重命名或改类型的契约字段', () => {
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        upload: {
          type: 'object',
          ui: { widget: 'upload-input' },
          properties: {
            fileId: { type: 'string' },
            fileName: { type: 'string' },
            customLabel: { type: 'string' },
          },
        },
      },
    }

    expect(
      getWidgetContractSchemaAtPath({
        schema,
        path: ['properties', 'upload', 'properties', 'fileId'],
        widgetDefinitions: [uploadWidget],
      }),
    ).toEqual({ type: 'string', title: 'File ID' })
    expect(
      getWidgetContractSchemaAtPath({
        schema,
        path: ['properties', 'upload', 'properties', 'customLabel'],
        widgetDefinitions: [uploadWidget],
      }),
    ).toBeUndefined()
    expect(
      isWidgetValueSchemaDescendantPath({
        schema,
        path: ['properties', 'upload', 'properties', 'customLabel'],
        widgetDefinitions: [uploadWidget],
      }),
    ).toBe(true)
  })

  it('校验 Widget 输出 Schema 中缺失字段和字段类型冲突', () => {
    const issues = validateWidgetSchemaContracts({
      schema: {
        type: 'object',
        properties: {
          upload: {
            type: 'object',
            ui: { widget: 'upload-input' },
            properties: {
              fileName: { type: 'number' },
            },
          },
        },
      },
      widgetDefinitions: [uploadWidget],
    })

    expect(issues).toEqual([
      {
        path: '#/properties/upload',
        message:
          'Widget "upload-input" requires required fields to match its value schema.',
      },
      {
        path: '#/properties/upload/properties/fileId',
        message: 'Widget "upload-input" requires field "fileId".',
      },
      {
        path: '#/properties/upload/properties/fileName',
        message:
          'Widget "upload-input" requires field "fileName" to use type "string".',
      },
    ])
  })

  it('校验 Widget 输出 Schema 中的子字段配置必须匹配 valueSchema', () => {
    const issues = validateWidgetSchemaContracts({
      schema: {
        type: 'object',
        properties: {
          upload: {
            type: 'object',
            ui: { widget: 'upload-input' },
            required: ['fileId', 'fileName'],
            properties: {
              fileId: { type: 'string', title: 'Business ID' },
              fileName: { type: 'string', title: 'File Name' },
            },
          },
        },
      },
      widgetDefinitions: [uploadWidget],
    })

    expect(issues).toEqual([
      {
        path: '#/properties/upload/properties/fileId',
        message:
          'Widget "upload-input" requires field "fileId" configuration to match its value schema.',
      },
    ])
  })

  it('校验 Widget 输出 Schema 中不允许额外字段', () => {
    const issues = validateWidgetSchemaContracts({
      schema: {
        type: 'object',
        properties: {
          upload: {
            type: 'object',
            ui: { widget: 'upload-input' },
            required: ['fileId', 'fileName'],
            properties: {
              fileId: { type: 'string', title: 'File ID' },
              fileName: { type: 'string', title: 'File Name' },
              customLabel: { type: 'string' },
            },
          },
        },
      },
      widgetDefinitions: [uploadWidget],
    })

    expect(issues).toEqual([
      {
        path: '#/properties/upload/properties/customLabel',
        message: 'Widget "upload-input" does not support field "customLabel".',
      },
    ])
  })

  it('识别 array valueSchema 的 items 及其所有子节点为只读契约区', () => {
    const listWidget: WidgetDefinition = {
      name: 'upload-list-input',
      component: (() => null) as WidgetDefinition['component'],
      valueSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fileId: { type: 'string' },
            fileName: { type: 'string' },
          },
        },
      },
    }
    const schema: ExtendedJSONSchema = {
      type: 'object',
      properties: {
        uploads: {
          type: 'array',
          ui: { widget: 'upload-list-input' },
          items: {
            type: 'object',
            properties: {
              fileId: { type: 'string' },
              fileName: { type: 'string' },
            },
          },
        },
      },
    }

    expect(
      isWidgetArrayItemsContractPath({
        schema,
        path: ['properties', 'uploads'],
        widgetDefinitions: [listWidget],
      }),
    ).toBe(false)
    expect(
      isWidgetArrayItemsContractPath({
        schema,
        path: ['properties', 'uploads', 'items'],
        widgetDefinitions: [listWidget],
      }),
    ).toBe(true)
    expect(
      isWidgetArrayItemsContractPath({
        schema,
        path: ['properties', 'uploads', 'items', 'properties', 'fileId'],
        widgetDefinitions: [listWidget],
      }),
    ).toBe(true)
  })

  it('校验 array valueSchema 缺失 items 或 items 子字段的情况', () => {
    const listWidget: WidgetDefinition = {
      name: 'upload-list-input',
      component: (() => null) as WidgetDefinition['component'],
      valueSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            fileId: { type: 'string' },
            fileName: { type: 'string' },
          },
        },
      },
    }

    expect(
      validateWidgetSchemaContracts({
        schema: {
          type: 'object',
          properties: {
            uploads: {
              type: 'array',
              ui: { widget: 'upload-list-input' },
            },
          },
        },
        widgetDefinitions: [listWidget],
      }),
    ).toEqual([
      {
        path: '#/properties/uploads/items',
        message: 'Widget "upload-list-input" requires items schema.',
      },
    ])
  })
})
