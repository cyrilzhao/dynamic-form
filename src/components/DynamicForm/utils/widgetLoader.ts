import { WidgetCompiler } from '@/features/widget-manager/services/widgetCompiler';
import { WidgetSandbox } from '@/utils/widgetSandbox';
import { fetchPublishedWidgets } from '@/features/widget-manager/services/widgetApi';

export interface WidgetLoadResult {
  [widgetName: string]: React.ComponentType<any>;
}

/**
 * Widget 加载器
 * 从后端 API 加载自定义 Widget 并编译执行
 */
export class WidgetLoader {
  private compiler = new WidgetCompiler();
  private sandbox = new WidgetSandbox();
  private cache = new Map<string, React.ComponentType<any>>();

  /**
   * 加载所有已发布的自定义 Widget
   */
  async loadCustomWidgets(): Promise<WidgetLoadResult> {
    try {
      const widgets = await fetchPublishedWidgets();

      const result: WidgetLoadResult = {};

      for (const widget of widgets) {
        if (this.cache.has(widget.name)) {
          result[widget.name] = this.cache.get(widget.name)!;
          continue;
        }

        const code = widget.compiledCode || this.compileWidget(widget.code);

        const executeResult = this.sandbox.execute(code);

        if (executeResult.success && executeResult.component) {
          result[widget.name] = executeResult.component;
          this.cache.set(widget.name, executeResult.component);
        } else {
          console.error(`Failed to load widget: ${widget.name}`, executeResult.error);
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to load custom widgets:', error);
      return {};
    }
  }

  /**
   * 编译 Widget 代码
   */
  private compileWidget(sourceCode: string): string {
    const compileResult = this.compiler.compile(sourceCode);

    if (!compileResult.success || !compileResult.code) {
      throw new Error(compileResult.error || 'Compilation failed');
    }

    return compileResult.code;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}
