/**
 * CodeMirror @codemirror/view 模块的 mock
 * 通过 moduleNameMapper 在模块解析层面替换，确保在所有环境下生效
 */

// 用于追踪调用的全局数组
export const __mockCalls = {
  destroy: [] as any[][],
  dispatch: [] as any[][],
  reset() {
    this.destroy = [];
    this.dispatch = [];
  },
};

// 存储最后创建的实例
export let __lastInstance: any = null;

// 静态方法的 mock - 在构造函数定义之前创建
const editableOf = jest.fn(() => []);
const themeFn = jest.fn(() => []);
const updateListenerOf = jest.fn(() => []);

/**
 * EditorView 构造函数
 * 注意：这是一个真正的构造函数，不是 jest.fn()
 * 这样可以确保 `new EditorView()` 返回的实例有正确的方法
 */
export class EditorView {
  // 静态属性
  static editable = { of: editableOf };
  static theme = themeFn;
  static updateListener = { of: updateListenerOf };

  // 实例属性
  state: { doc: { toString: () => string } };

  constructor(config: { parent?: HTMLElement; state?: any }) {
    if (config.parent) {
      config.parent.setAttribute('data-testid', 'editor-mounted');
    }

    this.state = config.state || {
      doc: {
        toString: () => '',
      },
    };

    __lastInstance = this;
  }

  destroy(...args: any[]) {
    __mockCalls.destroy.push(args);
  }

  dispatch(...args: any[]) {
    __mockCalls.dispatch.push(args);
  }
}

// 其他导出
export const keymap = {
  of: jest.fn(() => []),
};

export const lineNumbers = jest.fn(() => []);
