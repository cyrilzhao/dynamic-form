import type { CustomWidget } from '../types/widget';
import { mockWidgets, delay } from '../mock/mockWidgets';

/**
 * Widget API 服务
 * 使用 Mock 数据模拟后端接口
 */

/**
 * 获取所有已发布的 Widget（用于 DynamicForm 加载）
 */
export async function fetchPublishedWidgets(): Promise<CustomWidget[]> {
  await delay(300);
  return mockWidgets.filter((w) => w.status === 'published');
}

/**
 * 获取 Widget 列表
 */
export async function fetchWidgets({
  page = 1,
  pageSize = 20,
  search = '',
  createdBy = '',
  status = '',
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  createdBy?: string;
  status?: string;
} = {}): Promise<{
  items: CustomWidget[];
  total: number;
  page: number;
  pageSize: number;
}> {
  await delay(300);

  let filtered = [...mockWidgets];

  if (search) {
    filtered = filtered.filter((w) => w.name.includes(search));
  }

  if (createdBy) {
    filtered = filtered.filter((w) => w.createdBy === createdBy);
  }

  if (status) {
    filtered = filtered.filter((w) => w.status === status);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = filtered.slice(start, end);

  return {
    items,
    total: filtered.length,
    page,
    pageSize,
  };
}

/**
 * 获取单个 Widget 详情
 */
export async function fetchWidgetById(id: string): Promise<CustomWidget | null> {
  await delay(200);
  return mockWidgets.find((w) => w.id === id) || null;
}

/**
 * 创建 Widget
 */
export async function createWidget(data: {
  name: string;
  code: string;
}): Promise<CustomWidget> {
  await delay(300);

  const newWidget: CustomWidget = {
    id: `widget-${Date.now()}`,
    name: data.name,
    code: data.code,
    status: 'draft',
    version: 1,
    createdBy: 'current-user',
    createdAt: new Date().toISOString(),
    updatedBy: 'current-user',
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  };

  mockWidgets.push(newWidget);
  return newWidget;
}

/**
 * 更新 Widget
 */
export async function updateWidget(
  id: string,
  data: { code: string }
): Promise<CustomWidget> {
  await delay(300);

  const widget = mockWidgets.find((w) => w.id === id);
  if (!widget) {
    throw new Error('Widget not found');
  }

  widget.code = data.code;
  widget.updatedBy = 'current-user';
  widget.updatedAt = new Date().toISOString();

  return widget;
}

/**
 * 重命名 Widget
 */
export async function renameWidget(id: string, name: string): Promise<CustomWidget> {
  await delay(200);

  const widget = mockWidgets.find((w) => w.id === id);
  if (!widget) {
    throw new Error('Widget not found');
  }

  widget.name = name;
  widget.updatedBy = 'current-user';
  widget.updatedAt = new Date().toISOString();

  return widget;
}

/**
 * 删除 Widget
 */
export async function deleteWidget(id: string): Promise<void> {
  await delay(200);

  const index = mockWidgets.findIndex((w) => w.id === id);
  if (index === -1) {
    throw new Error('Widget not found');
  }

  mockWidgets.splice(index, 1);
}

/**
 * 发布 Widget
 */
export async function publishWidget(id: string): Promise<CustomWidget> {
  await delay(300);

  const widget = mockWidgets.find((w) => w.id === id);
  if (!widget) {
    throw new Error('Widget not found');
  }

  widget.status = 'published';
  widget.version += 1;
  widget.latestPublishedVersion = widget.version;
  widget.publishedBy = 'admin-001';
  widget.publishedAt = new Date().toISOString();

  return widget;
}

/**
 * 下架 Widget
 */
export async function archiveWidget(id: string): Promise<CustomWidget> {
  await delay(200);

  const widget = mockWidgets.find((w) => w.id === id);
  if (!widget) {
    throw new Error('Widget not found');
  }

  widget.status = 'archived';
  widget.updatedBy = 'admin-001';
  widget.updatedAt = new Date().toISOString();

  return widget;
}
