import type { WidgetRegistry, PartialWidgetPreset } from "../types/widgets";

export class FieldRegistry {
  private static widgets: Map<string, React.ComponentType<any>> = new Map();
  private static defaultPreset: PartialWidgetPreset | null = null;

  /**
   * 设置默认 Widget 预设
   * 通常在应用启动时调用一次
   */
  static setDefaultPreset(preset: PartialWidgetPreset) {
    this.defaultPreset = preset;
    this.registerBatch(preset as WidgetRegistry);
  }

  /**
   * 获取默认预设
   */
  static getDefaultPreset(): PartialWidgetPreset | null {
    return this.defaultPreset;
  }

  /**
   * 注册单个 widget
   */
  static register(type: string, component: React.ComponentType<any>) {
    this.widgets.set(type, component);
  }

  /**
   * 获取 widget
   */
  static getWidget(type: string): React.ComponentType<any> | undefined {
    return this.widgets.get(type);
  }

  /**
   * 批量注册 widgets
   */
  static registerBatch(widgets: WidgetRegistry) {
    // 兼容性保护：某些预设的某个子模块可能为 null/undefined，
    // 直接调用 Object.entries 会抛 TypeError，提前返回避免整个预设加载失败
    if (!widgets) {
      return;
    }
    Object.entries(widgets).forEach(([type, component]) => {
      this.register(type, component);
    });
  }

  /**
   * 清空所有已注册的 widgets
   */
  static clear() {
    this.widgets.clear();
    this.defaultPreset = null;
  }
}
