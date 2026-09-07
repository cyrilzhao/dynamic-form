import {
  TextWidget,
  PasswordWidget,
  TextareaWidget,
  NumberWidget,
  SelectWidget,
  RadioWidget,
  CheckboxWidget,
  CheckboxGroupWidget,
  SwitchWidget,
  NestedFormWidget,
  UrlWidget,
  ArrayFieldWidget,
  KeyValueArrayWidget,
  TableArrayWidget,
  SchemaBuilderWidget,
  VariantWidget,
  CodeEditorWidget,
  ObjectEditorWidget,
} from "../widgets";
import type { WidgetPreset } from "../types/widgets";

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
  "checkbox-group": CheckboxGroupWidget,
  "schema-builder": SchemaBuilderWidget,
  switch: SwitchWidget,
  "nested-form": NestedFormWidget,
  array: ArrayFieldWidget,
  "key-value-array": KeyValueArrayWidget,
  "table-array": TableArrayWidget,
  variant: VariantWidget,
  "code-editor": CodeEditorWidget,
  "object-editor": ObjectEditorWidget,
};
