/**
 * Mock 数据：自定义 Widget 列表
 */

export interface MockCustomWidget {
  id: string
  name: string
  code: string
  compiledCode?: string
  status: 'draft' | 'published' | 'archived'
  version: number
  latestPublishedVersion?: number
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  publishedBy?: string
  publishedAt?: string
  usageCount: number
}

export const mockWidgets: MockCustomWidget[] = [
  {
    id: 'widget-1',
    name: 'star-rating',
    status: 'published',
    version: 1,
    latestPublishedVersion: 1,
    createdBy: 'user-001',
    createdAt: '2026-08-01T10:00:00Z',
    updatedBy: 'user-001',
    updatedAt: '2026-08-01T10:00:00Z',
    publishedBy: 'admin-001',
    publishedAt: '2026-08-01T11:00:00Z',
    usageCount: 5,
    code: `import React, { useState } from 'react';
import { Icon } from '@blueprintjs/core';

export default function StarRating({ value = 0, onChange, disabled = false, readonly = false }) {
  const [hoverValue, setHoverValue] = useState(0);
  const maxStars = 5;

  const handleClick = (rating) => {
    if (!disabled && !readonly) {
      onChange?.(rating);
    }
  };

  const handleMouseEnter = (rating) => {
    if (!disabled && !readonly) {
      setHoverValue(rating);
    }
  };

  const handleMouseLeave = () => {
    setHoverValue(0);
  };

  const displayValue = hoverValue || value || 0;

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((rating) => (
        <Icon
          key={rating}
          icon={rating <= displayValue ? 'star' : 'star-empty'}
          size={20}
          color={rating <= displayValue ? '#FFB300' : '#CCC'}
          style={{
            cursor: disabled || readonly ? 'default' : 'pointer',
            transition: 'color 0.2s'
          }}
          onClick={() => handleClick(rating)}
          onMouseEnter={() => handleMouseEnter(rating)}
          onMouseLeave={handleMouseLeave}
        />
      ))}
      <span style={{ marginLeft: 8, color: '#5C7080' }}>
        {displayValue}/{maxStars}
      </span>
    </div>
  );
}`,
  },
  {
    id: 'widget-2',
    name: 'color-picker',
    status: 'published',
    version: 2,
    latestPublishedVersion: 2,
    createdBy: 'user-002',
    createdAt: '2026-08-03T10:00:00Z',
    updatedBy: 'user-002',
    updatedAt: '2026-08-06T15:00:00Z',
    publishedBy: 'admin-001',
    publishedAt: '2026-08-06T16:00:00Z',
    usageCount: 3,
    code: `import React, { useState, useEffect } from 'react';
import { Button, Popover, InputGroup } from '@blueprintjs/core';
import _ from 'lodash';
import { z } from 'zod';

export default function ColorPicker({ value = '#000000', onChange, disabled = false, readonly = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const presetColors = [
    '#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33',
    '#33FFF5', '#F53333', '#33F533', '#3333F5', '#000000',
  ];
  const [innerValue, setInnerValue] = useState<string>();

  useEffect(() => {
     setInnerValue(value)
    
  }, [value])

  // 使用 zod 验证颜色格式
  const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format');

  // 使用 lodash 防抖优化性能
  const debouncedChange = _.debounce((color) => {
    onChange?.(color);
    setInnerValue(color)
  }, 200);

  const handleColorChange = (color) => {
    if (!disabled && !readonly) {
      debouncedChange(color);
      setIsOpen(false);
    }
  };

  const handleInputChange = (e) => {
    if (!disabled && !readonly) {
      const newColor = e.target.value;
      try {
        colorSchema.parse(newColor);
        debouncedChange(newColor);
      } catch (err) {
        console.warn('Invalid color format:', newColor);
      }
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Popover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        disabled={disabled || readonly}
        content={
          <div style={{ padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 32px)', gap: 8 }}>
              {presetColors.map((color, index) => (
                <div
                  key={index}
                  onClick={() => handleColorChange(color)}
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: color,
                    border: color === value ? '2px solid #000' : '1px solid #CCC',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        }
      >
        <Button
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: 40,
            height: 30,
            backgroundColor: innerValue,
            border: '1px solid #CCC',
            padding: 0,
          }}
        />
      </Popover>
      <InputGroup
        value={innerValue}
        onChange={handleInputChange}
        disabled={disabled}
        readOnly={readonly}
        placeholder="#000000"
        style={{ width: 120 }}
      />
    </div>
  );
}`,
  },
  {
    id: 'widget-3',
    name: 'tag-input',
    status: 'draft',
    version: 1,
    createdBy: 'user-003',
    createdAt: '2026-08-05T10:00:00Z',
    updatedBy: 'user-003',
    updatedAt: '2026-08-05T14:00:00Z',
    usageCount: 0,
    code: `import React, { useState } from 'react';
import { Tag, InputGroup, Intent } from '@blueprintjs/core';

export default function TagInput({ value = [], onChange, disabled = false, readonly = false, placeholder = 'Add tag...' }) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (!value.includes(inputValue.trim())) {
        onChange?.([...value, inputValue.trim()]);
      }
      setInputValue('');
    }
  };

  const handleRemove = (tagToRemove) => {
    if (!disabled && !readonly) {
      onChange?.(value.filter((tag) => tag !== tagToRemove));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {value.map((tag) => (
          <Tag
            key={tag}
            intent={Intent.PRIMARY}
            onRemove={disabled || readonly ? undefined : () => handleRemove(tag)}
          >
            {tag}
          </Tag>
        ))}
      </div>
      {!readonly && (
        <InputGroup
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}`,
  },
]

// 模拟延迟
export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))
