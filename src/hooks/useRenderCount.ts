import { useRef, useEffect } from 'react';

/**
 * 用于统计组件渲染次数的 Hook
 *
 * @param componentName - 组件名称，用于日志输出
 * @returns 当前组件的渲染次数
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);

  renderCount.current += 1;

  useEffect(() => {
    console.log(`[${componentName}] Render count: ${renderCount.current}`);
  });

  return renderCount.current;
}
