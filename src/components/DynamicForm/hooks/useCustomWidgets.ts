import { useState, useEffect } from 'react';
import { WidgetLoader } from '../utils/widgetLoader';

export interface UseCustomWidgetsResult {
  widgets: Record<string, React.ComponentType<any>>;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

/**
 * 自定义 Widget 加载 Hook
 * 在 DynamicForm 中加载和使用自定义 Widget
 */
export function useCustomWidgets(): UseCustomWidgetsResult {
  const [widgets, setWidgets] = useState<Record<string, React.ComponentType<any>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loader = new WidgetLoader();

  const loadWidgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const customWidgets = await loader.loadCustomWidgets();
      setWidgets(customWidgets);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load widgets'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  return {
    widgets,
    loading,
    error,
    reload: loadWidgets,
  };
}
