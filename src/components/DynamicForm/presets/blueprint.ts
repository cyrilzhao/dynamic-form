import {
  TextWidget,
  PasswordWidget,
  TextareaWidget,
  NumberWidget,
  SelectWidget,
  RadioWidget,
  CheckboxWidget,
  SwitchWidget,
  NestedFormWidget,
  UrlWidget,
  ArrayFieldWidget,
  KeyValueArrayWidget,
  TableArrayWidget,
} from '../widgets';
import type { WidgetPreset } from '../types/widgets';

/**
 * Blueprint 组件库预设
 * 基于 @blueprintjs/core 实现的完整 Widget 集合
 */
export const blueprintPreset: WidgetPreset = {
  text: TextWidget,
  textarea: TextareaWidget,
  password: PasswordWidget,
  email: TextWidget,
  url: UrlWidget,
  number: NumberWidget,
  select: SelectWidget,
  radio: RadioWidget,
  checkbox: CheckboxWidget,
  switch: SwitchWidget,
  'nested-form': NestedFormWidget,
  array: ArrayFieldWidget,
  'key-value-array': KeyValueArrayWidget,
  'table-array': TableArrayWidget,
};
