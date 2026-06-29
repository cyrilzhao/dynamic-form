import React, { useState } from 'react';
import { Button, Card, Tag, Divider } from '@blueprintjs/core';
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(value.length === 0 ? null : 0);

  const handleAdd = () => {
    const newIndex = value.length;
    onChange([...value, { type: 'visibility', dependencies: [] }]);
    setExpandedIndex(newIndex);
  };

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : undefined);
    setExpandedIndex(prev => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
  };

  const handleChange = (index: number, config: LinkageConfig | undefined) => {
    const next = [...value];
    if (config) {
      next[index] = config;
      onChange(next);
    } else {
      handleRemove(index);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((linkage, index) => (
        <Card key={index} style={{ padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: expandedIndex === index ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag intent="primary" minimal>#{index + 1}</Tag>
              <Tag minimal>{linkage.type}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                icon={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                minimal small
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                disabled={disabled}
              />
              <Button icon="trash" minimal small intent="danger" onClick={() => handleRemove(index)} disabled={disabled} />
            </div>
          </div>
          {expandedIndex === index && (
            <LinkageEditor
              key={`${currentFieldPath}-${index}`}
              value={linkage}
              onChange={config => handleChange(index, config)}
              currentFieldPath={currentFieldPath}
              schema={schema}
              disabled={disabled}
            />
          )}
        </Card>
      ))}

      <Divider />

      <Button icon="add" text="Add Linkage Rule" intent="primary" onClick={handleAdd} disabled={disabled} />
    </div>
  );
};
