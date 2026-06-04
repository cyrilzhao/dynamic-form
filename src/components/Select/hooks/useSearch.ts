import { useMemo } from 'react';
import type { SelectOption } from '../types';

interface UseSearchParams {
  options: SelectOption[];
  searchTerm: string;
}

/**
 * 搜索过滤选项
 */
export function useSearch({ options, searchTerm }: UseSearchParams): SelectOption[] {
  return useMemo(() => {
    if (!searchTerm) return options;

    const term = searchTerm.toLowerCase();
    return options.filter(option => option.label.toLowerCase().includes(term));
  }, [options, searchTerm]);
}
