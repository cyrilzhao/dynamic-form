import type { WidgetDefinition } from '../types/widgets'
import { UploadInputWidget } from './UploadInputWidget'

/** 用于 SchemaBuilder 测试和示例的 Widget 元数据。 */
export const uploadInputWidgetDefinition: WidgetDefinition = {
  name: 'upload-input',
  component: UploadInputWidget,
  valueSchema: {
    type: 'object',
    title: 'Uploaded File',
    properties: {
      fileId: { type: 'string', title: 'File ID' },
      fileName: { type: 'string', title: 'File Name' },
    },
    required: ['fileId', 'fileName'],
  },
  propsSchema: {
    type: 'object',
    properties: {
      accept: {
        type: 'string',
        title: 'Accepted File Types',
        default: '',
      },
    },
  },
}
