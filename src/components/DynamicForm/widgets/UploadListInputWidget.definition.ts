import type { WidgetDefinition } from '../types/widgets'
import { UploadListInputWidget } from './UploadListInputWidget'

/** 用于 SchemaBuilder 测试和示例的数组上传 Widget 元数据。 */
export const uploadListInputWidgetDefinition: WidgetDefinition = {
  name: 'upload-list-input',
  component: UploadListInputWidget,
  valueSchema: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        fileId: { type: 'string', title: 'File ID' },
        fileName: { type: 'string', title: 'File Name' },
      },
      required: ['fileId', 'fileName'],
    },
  },
  propsSchema: {
    type: 'object',
    properties: {
      accept: { type: 'string', title: 'Accepted File Types', default: '' },
    },
  },
}
