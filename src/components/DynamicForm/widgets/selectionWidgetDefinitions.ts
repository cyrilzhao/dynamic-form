import type { WidgetDefinition } from '../types/widgets'
import { CheckboxGroupWidget } from './CheckboxGroupWidget'
import { RadioWidget } from './RadioWidget'
import { SelectWidget } from './SelectWidget'

const optionsSchema = {
  type: 'array' as const,
  title: 'Options',
  items: {
    type: 'object' as const,
    properties: {
      value: { title: 'Value' },
      label: { type: 'string' as const, title: 'Label' },
      disabled: { type: 'boolean' as const, title: 'Disabled' },
    },
    required: ['value', 'label'],
  },
  ui: { widget: 'widget-options-editor' },
}

/** Blueprint 选择类内置 Widget 的 SchemaBuilder 配置定义。 */
export const selectionWidgetDefinitions: WidgetDefinition[] = [
  {
    name: 'select',
    component: SelectWidget,
    propsSchema: {
      type: 'object',
      properties: {
        options: optionsSchema,
        multiple: { type: 'boolean', title: 'Multiple', default: false },
      },
    },
  },
  {
    name: 'radio',
    component: RadioWidget,
    propsSchema: { type: 'object', properties: { options: optionsSchema } },
  },
  {
    name: 'checkbox-group',
    component: CheckboxGroupWidget,
    propsSchema: { type: 'object', properties: { options: optionsSchema } },
  },
]
