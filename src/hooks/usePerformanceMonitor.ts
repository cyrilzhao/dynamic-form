import { useRef, useEffect } from 'react';

/**
 * 性能监控数据
 */
export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  totalRenderTime: number;
}

/**
 * 用于监控组件渲染性能的 Hook
 *
 * @param componentName - 组件名称
 * @param enabled - 是否启用监控（默认 true）
 * @returns 性能指标
 */
export function usePerformanceMonitor(
  componentName: string,
  enabled: boolean = true
): PerformanceMetrics {
  const renderCount = useRef(0);
  const startTime = useRef(0);
  const totalRenderTime = useRef(0);
  const lastRenderTime = useRef(0);

  if (enabled) {
    // 记录渲染开始时间
    startTime.current = performance.now();
    renderCount.current += 1;
  }

  useEffect(() => {
    if (enabled && startTime.current > 0) {
      // 计算渲染耗时
      const endTime = performance.now();
      const renderTime = endTime - startTime.current;

      lastRenderTime.current = renderTime;
      totalRenderTime.current += renderTime;

      // 输出性能日志
      // if (process.env.NODE_ENV !== 'production') {
      //   console.log(
      //     `[Performance] ${componentName} - Render #${renderCount.current}: ${renderTime.toFixed(2)}ms`
      //   );
      // }
    }
  });

  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current,
    averageRenderTime: renderCount.current > 0 ? totalRenderTime.current / renderCount.current : 0,
    totalRenderTime: totalRenderTime.current,
  };
}
