import _ from 'lodash';
import * as v from 'valibot';
import type { BuiltInHelpers } from '../../types/helpers';

// Mock ofetch for testing
const mockOfetch = async (url: string, options?: any) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  });
};

export const builtInHelpers: BuiltInHelpers = {
  ofetch: mockOfetch as any,
  _,
  v,
};
