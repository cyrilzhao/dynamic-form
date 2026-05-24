import React from 'react';
import { FieldRegistry } from '../FieldRegistry';
import { blueprintPreset } from '../../presets/blueprint';

describe('FieldRegistry', () => {
  // 保存原始的 widgets 状态，以便测试后恢复
  const originalWidgets: Array<[string, React.ComponentType<any>]> = [];

  beforeAll(() => {
    // 初始化默认预设
    FieldRegistry.setDefaultPreset(blueprintPreset);

    // 记录所有默认注册的 widgets
    const defaultTypes = [
      'text',
      'textarea',
      'password',
      'email',
      'url',
      'number',
      'select',
      'radio',
      'checkbox',
      'switch',
      'nested-form',
      'array',
      'key-value-array',
      'table-array',
    ];
    defaultTypes.forEach((type) => {
      const widget = FieldRegistry.getWidget(type);
      if (widget) {
        originalWidgets.push([type, widget]);
      }
    });
  });

  afterEach(() => {
    // 清理测试中注册的自定义 widgets
    // 由于 FieldRegistry 是静态类，需要确保测试之间不会相互影响
  });

  describe('默认注册的 widgets', () => {
    it('应该包含 text widget', () => {
      expect(FieldRegistry.getWidget('text')).toBeDefined();
    });

    it('应该包含 textarea widget', () => {
      expect(FieldRegistry.getWidget('textarea')).toBeDefined();
    });

    it('应该包含 password widget', () => {
      expect(FieldRegistry.getWidget('password')).toBeDefined();
    });

    it('应该包含 email widget', () => {
      expect(FieldRegistry.getWidget('email')).toBeDefined();
    });

    it('应该包含 url widget', () => {
      expect(FieldRegistry.getWidget('url')).toBeDefined();
    });

    it('应该包含 number widget', () => {
      expect(FieldRegistry.getWidget('number')).toBeDefined();
    });

    it('应该包含 select widget', () => {
      expect(FieldRegistry.getWidget('select')).toBeDefined();
    });

    it('应该包含 radio widget', () => {
      expect(FieldRegistry.getWidget('radio')).toBeDefined();
    });

    it('应该包含 checkbox widget', () => {
      expect(FieldRegistry.getWidget('checkbox')).toBeDefined();
    });

    it('应该包含 switch widget', () => {
      expect(FieldRegistry.getWidget('switch')).toBeDefined();
    });

    it('应该包含 nested-form widget', () => {
      expect(FieldRegistry.getWidget('nested-form')).toBeDefined();
    });

    it('应该包含 array widget', () => {
      expect(FieldRegistry.getWidget('array')).toBeDefined();
    });

    it('应该包含 key-value-array widget', () => {
      expect(FieldRegistry.getWidget('key-value-array')).toBeDefined();
    });

    it('应该包含 table-array widget', () => {
      expect(FieldRegistry.getWidget('table-array')).toBeDefined();
    });
  });

  describe('getWidget', () => {
    it('对于不存在的类型应该返回 undefined', () => {
      expect(FieldRegistry.getWidget('nonexistent-widget')).toBeUndefined();
    });

    it('应该返回正确的 widget 组件', () => {
      const textWidget = FieldRegistry.getWidget('text');
      expect(textWidget).toBeDefined();
    });
  });

  describe('register', () => {
    it('应该能注册新的 widget', () => {
      const CustomWidget: React.FC = () => null;
      FieldRegistry.register('custom-test', CustomWidget);

      expect(FieldRegistry.getWidget('custom-test')).toBe(CustomWidget);
    });

    it('应该能覆盖已存在的 widget', () => {
      const NewTextWidget: React.FC = () => null;
      const originalTextWidget = FieldRegistry.getWidget('text');

      FieldRegistry.register('text', NewTextWidget);
      expect(FieldRegistry.getWidget('text')).toBe(NewTextWidget);

      // 恢复原始的 text widget
      if (originalTextWidget) {
        FieldRegistry.register('text', originalTextWidget);
      }
    });
  });

  describe('registerBatch', () => {
    it('应该能批量注册多个 widgets', () => {
      const Widget1: React.FC = () => null;
      const Widget2: React.FC = () => null;
      const Widget3: React.FC = () => null;

      FieldRegistry.registerBatch({
        'batch-widget-1': Widget1,
        'batch-widget-2': Widget2,
        'batch-widget-3': Widget3,
      });

      expect(FieldRegistry.getWidget('batch-widget-1')).toBe(Widget1);
      expect(FieldRegistry.getWidget('batch-widget-2')).toBe(Widget2);
      expect(FieldRegistry.getWidget('batch-widget-3')).toBe(Widget3);
    });

    it('应该能用空对象调用而不报错', () => {
      expect(() => {
        FieldRegistry.registerBatch({});
      }).not.toThrow();
    });

    it('批量注册应该能覆盖已存在的 widgets', () => {
      const NewSelectWidget: React.FC = () => null;
      const originalSelectWidget = FieldRegistry.getWidget('select');

      FieldRegistry.registerBatch({
        select: NewSelectWidget,
      });

      expect(FieldRegistry.getWidget('select')).toBe(NewSelectWidget);

      // 恢复原始的 select widget
      if (originalSelectWidget) {
        FieldRegistry.register('select', originalSelectWidget);
      }
    });
  });
});
