// Jest 全局设置文件
import '@testing-library/jest-dom';

// 保存原始的 console 方法
const originalError = console.error;
const originalWarn = console.warn;

// Mock console.error 和 console.warn，但不影响测试结果
// 只过滤掉 React 的 act 警告和测试中故意抛出的错误
beforeAll(() => {
  console.error = (...args: any[]) => {
    const message = args[0]?.toString() || '';

    // 过滤掉以下类型的错误/警告：
    // 1. React 的 act 警告
    if (
      message.includes('Warning: An update to') ||
      message.includes('inside a test was not wrapped in act')
    ) {
      return;
    }

    // 2. 测试中故意抛出的错误（用于测试错误处理）
    if (
      message.includes('联动初始化失败') ||
      message.includes('联动计算失败') ||
      message.includes('Test error') ||
      message.includes('Async test error')
    ) {
      return;
    }

    // 其他错误正常输出（但不会导致测试失败）
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || '';
    // 过滤掉一些常见的警告
    if (message.includes('Warning:')) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

// 测试结束后恢复原始方法
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
