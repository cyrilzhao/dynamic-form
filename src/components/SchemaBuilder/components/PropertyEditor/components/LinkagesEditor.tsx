import React, { useState } from 'react';
import { Button, Card, Tag, Divider, Collapse, Icon, Callout } from '@blueprintjs/core';
import { LinkageEditor } from './LinkageEditor';
import type { LinkageConfig } from '../../../../DynamicForm/types/linkage';
import type { ExtendedJSONSchema } from '../../../../DynamicForm/types/schema';

interface LinkagesEditorProps {
  value?: LinkageConfig[];
  onChange: (value: LinkageConfig[] | undefined) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
}

export const LinkagesEditor: React.FC<LinkagesEditorProps> = ({
  value = [],
  onChange,
  schema,
  currentFieldPath,
  disabled,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [editingLinkage, setEditingLinkage] = useState<LinkageConfig | null>(null);
  const [isNewLinkage, setIsNewLinkage] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleAdd = () => {
    const newIndex = value.length;
    const newLinkage: LinkageConfig = {
      type: 'visibility',
      dependencies: [],
    };
    setEditingLinkage(newLinkage);
    setIsNewLinkage(true);
    setExpandedIndex(newIndex);
  };

  const handleEdit = (index: number) => {
    const linkage = value[index];
    setEditingLinkage({ ...linkage });
    setIsNewLinkage(false);
    setExpandedIndex(index);
  };

  const handleSave = (linkageToSave: LinkageConfig) => {
    if (isNewLinkage) {
      onChange([...value, linkageToSave]);
    } else {
      const newValue = [...value];
      newValue[expandedIndex!] = linkageToSave;
      onChange(newValue);
    }

    setEditingLinkage(null);
    setIsNewLinkage(false);
    setExpandedIndex(null);
  };

  const handleCancel = () => {
    setEditingLinkage(null);
    setIsNewLinkage(false);
    setExpandedIndex(null);
  };

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : undefined);
    if (expandedIndex === index) {
      setEditingLinkage(null);
      setIsNewLinkage(false);
      setExpandedIndex(null);
    }
  };

  const renderLinkageSummary = (linkage: LinkageConfig) => {
    const depsCount = linkage.dependencies.filter(d => d.trim()).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag minimal intent="primary">
            {linkage.type}
          </Tag>
          <span style={{ fontSize: 12, color: '#5c7080' }}>
            {depsCount} {depsCount === 1 ? 'dependency' : 'dependencies'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 说明组件 */}
      <Callout intent="primary" icon={null} style={{ padding: '8px 12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowGuide(!showGuide)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon icon="info-sign" size={14} />
            <strong>What is Field Linkage?</strong>
          </div>
          <Icon icon={showGuide ? 'chevron-up' : 'chevron-down'} size={14} />
        </div>

        <Collapse isOpen={showGuide}>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
            <p style={{ marginTop: 0, marginBottom: 8 }}>
              <strong>Field linkage</strong> enables dynamic form behavior where fields automatically respond to changes in other fields' values.
            </p>

            <p style={{ marginBottom: 8 }}>
              <strong>Common use cases:</strong>
            </p>
            <ul style={{ marginTop: 0, marginBottom: 12, paddingLeft: 20 }}>
              <li>Conditional fields: Show/hide fields based on other selections</li>
              <li>Dynamic options: Update dropdown options based on parent field</li>
              <li>Computed values: Calculate field values automatically</li>
              <li>UI state control: Enable/disable or make fields readonly dynamically</li>
            </ul>

            <p style={{ marginBottom: 8 }}>
              <strong>Multiple linkages of the same type:</strong>
            </p>
            <ul style={{ marginTop: 0, marginBottom: 0, paddingLeft: 20 }}>
              <li><strong>visibility</strong>: AND logic — field visible only if ALL linkages resolve to visible</li>
              <li><strong>disabled</strong>: OR logic — field disabled if ANY linkage resolves to disabled</li>
              <li><strong>readonly</strong>: OR logic — field readonly if ANY linkage resolves to readonly</li>
              <li><strong>value/options</strong>: Last wins — last linkage (by definition order) takes effect</li>
              <li><strong>schema</strong>: Shallow merge — later linkages override earlier properties</li>
            </ul>
          </div>
        </Collapse>
      </Callout>

      {value.map((linkage, index) => (
        <Card key={index} style={{ padding: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: expandedIndex === index ? 12 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag intent="primary" minimal>
                #{index + 1}
              </Tag>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                icon={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                minimal
                small
                onClick={() => {
                  if (expandedIndex === index) {
                    handleCancel();
                  } else {
                    handleEdit(index);
                  }
                }}
                disabled={disabled}
              />
              <Button
                icon="trash"
                minimal
                small
                intent="danger"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              />
            </div>
          </div>

          {expandedIndex !== index && (
            <div style={{ marginTop: 8 }}>{renderLinkageSummary(linkage)}</div>
          )}

          {expandedIndex === index && !isNewLinkage && (
            <LinkageEditor
              key={`${currentFieldPath}-${index}`}
              value={editingLinkage!}
              onChange={setEditingLinkage}
              currentFieldPath={currentFieldPath}
              schema={schema}
              disabled={disabled}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </Card>
      ))}

      {isNewLinkage && expandedIndex === value.length && (
        <Card style={{ padding: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag intent="primary" minimal>
                #{value.length + 1}
              </Tag>
            </div>
            <Button
              icon="cross"
              minimal
              small
              onClick={handleCancel}
              disabled={disabled}
            />
          </div>

          <LinkageEditor
            key={`${currentFieldPath}-new`}
            value={editingLinkage!}
            onChange={setEditingLinkage}
            currentFieldPath={currentFieldPath}
            schema={schema}
            disabled={disabled}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </Card>
      )}

      <Divider />

      <Button
        icon="add"
        text="Add Linkage Rule"
        intent="primary"
        onClick={handleAdd}
        disabled={disabled || isNewLinkage}
      />
    </div>
  );
};
