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

export class FieldRegistry {
  private static widgets: Map<string, React.ComponentType<any>> = new Map<
    string,
    React.ComponentType<any>
  >([
    ['text', TextWidget],
    ['textarea', TextareaWidget],
    ['password', PasswordWidget],
    ['email', TextWidget],
    ['url', UrlWidget],
    ['number', NumberWidget],
    ['select', SelectWidget],
    ['radio', RadioWidget],
    ['checkbox', CheckboxWidget],
    ['switch', SwitchWidget],
    ['nested-form', NestedFormWidget],
    ['array', ArrayFieldWidget],
    ['key-value-array', KeyValueArrayWidget],
    ['table-array', TableArrayWidget],
  ]);

  static register(type: string, component: React.ComponentType<any>) {
    this.widgets.set(type, component);
  }

  static getWidget(type: string): React.ComponentType<any> | undefined {
    return this.widgets.get(type);
  }

  static registerBatch(widgets: Record<string, React.ComponentType<any>>) {
    Object.entries(widgets).forEach(([type, component]) => {
      this.register(type, component);
    });
  }
}
