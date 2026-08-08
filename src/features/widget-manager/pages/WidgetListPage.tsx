import React, { useState, useEffect } from 'react';
import {
  Card,
  HTMLTable,
  Button,
  Intent,
  Tag,
  InputGroup,
  HTMLSelect,
  Spinner,
  Dialog,
  Classes,
} from '@blueprintjs/core';
import { useNavigate } from 'react-router-dom';
import { fetchWidgets, deleteWidget, publishWidget, archiveWidget, renameWidget } from '../services/widgetApi';
import type { CustomWidget } from '../types/widget';

const STATUS_COLORS: Record<string, Intent> = {
  draft: Intent.NONE,
  published: Intent.SUCCESS,
  archived: Intent.DANGER,
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已下架',
};

export const WidgetListPage: React.FC = () => {
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<CustomWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<CustomWidget | null>(null);
  const [newName, setNewName] = useState('');

  const loadWidgets = async () => {
    setLoading(true);
    try {
      const result = await fetchWidgets({
        search,
        status: statusFilter,
        createdBy: createdByFilter,
      });
      setWidgets(result.items);
    } catch (error) {
      console.error('Failed to load widgets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, [search, statusFilter, createdByFilter]);

  const handleCreate = () => {
    navigate('/widget-manager/editor');
  };

  const handleEdit = (id: string) => {
    navigate(`/widget-manager/editor/${id}`);
  };

  const handleRename = (widget: CustomWidget) => {
    setSelectedWidget(widget);
    setNewName(widget.name);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!selectedWidget || !newName.trim()) return;

    try {
      await renameWidget(selectedWidget.id, newName);
      setRenameDialogOpen(false);
      loadWidgets();
    } catch (error) {
      console.error('Failed to rename widget:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此 Widget？')) return;

    try {
      await deleteWidget(id);
      loadWidgets();
    } catch (error) {
      console.error('Failed to delete widget:', error);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishWidget(id);
      loadWidgets();
    } catch (error) {
      console.error('Failed to publish widget:', error);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveWidget(id);
      loadWidgets();
    } catch (error) {
      console.error('Failed to archive widget:', error);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2>自定义 Widget 管理</h2>
          <Button intent={Intent.PRIMARY} icon="plus" onClick={handleCreate}>
            创建 Widget
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <InputGroup
            leftIcon="search"
            placeholder="按名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <HTMLSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: '全部状态', value: '' },
              { label: '草稿', value: 'draft' },
              { label: '已发布', value: 'published' },
              { label: '已下架', value: 'archived' },
            ]}
          />
          <InputGroup
            placeholder="按创建人筛选"
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            style={{ width: 200 }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spinner />
          </div>
        ) : (
          <HTMLTable striped bordered style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Widget 名称</th>
                <th>创建人</th>
                <th>状态</th>
                <th>创建时间</th>
                <th>最后修改时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {widgets.map((widget) => (
                <tr key={widget.id}>
                  <td>{widget.name}</td>
                  <td>{widget.createdBy}</td>
                  <td>
                    <Tag intent={STATUS_COLORS[widget.status]}>
                      {STATUS_LABELS[widget.status]}
                    </Tag>
                  </td>
                  <td>{new Date(widget.createdAt).toLocaleString()}</td>
                  <td>{new Date(widget.updatedAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <Button
                        small
                        minimal
                        icon="edit"
                        onClick={() => handleEdit(widget.id)}
                      >
                        编辑代码
                      </Button>
                      <Button
                        small
                        minimal
                        icon="text-highlight"
                        onClick={() => handleRename(widget)}
                      >
                        重命名
                      </Button>
                      {widget.status === 'draft' && (
                        <Button
                          small
                          minimal
                          intent={Intent.SUCCESS}
                          icon="upload"
                          onClick={() => handlePublish(widget.id)}
                        >
                          发布
                        </Button>
                      )}
                      {widget.status === 'published' && (
                        <Button
                          small
                          minimal
                          intent={Intent.WARNING}
                          icon="download"
                          onClick={() => handleArchive(widget.id)}
                        >
                          下架
                        </Button>
                      )}
                      <Button
                        small
                        minimal
                        intent={Intent.DANGER}
                        icon="trash"
                        onClick={() => handleDelete(widget.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        )}
      </Card>

      <Dialog
        isOpen={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        title="重命名 Widget"
      >
        <div className={Classes.DIALOG_BODY}>
          <InputGroup
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="输入新名称"
          />
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setRenameDialogOpen(false)}>取消</Button>
            <Button intent={Intent.PRIMARY} onClick={handleRenameConfirm}>
              确定
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
