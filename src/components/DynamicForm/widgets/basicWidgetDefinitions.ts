import type { WidgetDefinition } from '../types/widgets'
import { TextWidget } from './TextWidget'
import { TextareaWidget } from './TextareaWidget'

/** 有稳定可配置参数的基础文本 Widget 定义。 */
export const basicWidgetDefinitions: WidgetDefinition[] = [
  {
    name: 'text',
    component: TextWidget,
    supports: { schemaTypes: ['string'] },
    propsSchema: {
      type: 'object',
      properties: {
        maxLength: {
          type: 'integer',
          title: 'Maximum Length',
          minimum: 0,
        },
        autoComplete: {
          type: 'string',
          title: 'Autocomplete',
        },
      },
    },
  },
  {
    name: 'textarea',
    component: TextareaWidget,
    supports: { schemaTypes: ['string'] },
    propsSchema: {
      type: 'object',
      properties: {
        rows: {
          type: 'integer',
          title: 'Rows',
          default: 4,
          minimum: 1,
        },
        maxLength: {
          type: 'integer',
          title: 'Maximum Length',
          minimum: 0,
        },
      },
    },
  },
]
