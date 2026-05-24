import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

// 示例：获取用户列表
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response;
    },
  });
};

// 示例：获取单个用户
export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const response = await api.get(`/users/${id}`);
      return response;
    },
    enabled: !!id, // 只有当 id 存在时才执行查询
  });
};

// 示例：创建用户
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: { name: string; email: string }) => {
      const response = await api.post('/users', userData);
      return response;
    },
    onSuccess: () => {
      // 创建成功后，使 users 查询缓存失效，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// 示例：更新用户
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ name: string; email: string }>;
    }) => {
      const response = await api.put(`/users/${id}`, data);
      return response;
    },
    onSuccess: (_, variables) => {
      // 更新成功后，使相关查询缓存失效
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', variables.id] });
    },
  });
};

// 示例：删除用户
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/users/${id}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
