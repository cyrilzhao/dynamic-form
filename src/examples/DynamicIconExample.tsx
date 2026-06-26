import React, { useState } from 'react';
import { DynamicIcon } from 'lucide-react/dynamic';

const iconNames = [
  'play',
  'square',
  'refresh-cw',
  'git-branch',
  'bot',
  'box',
  'search',
  'message-square',
  'chevron-down',
  'chevron-up',
  'home',
  'settings',
  'user',
  'heart',
  'star',
] as const;

export const DynamicIconExample: React.FC = () => {
  const [selectedIcon, setSelectedIcon] = useState<string>('play');
  const [iconSize, setIconSize] = useState<number>(24);
  const [iconColor, setIconColor] = useState<string>('#333333');

  return (
    <div style={{ padding: 24 }}>
      <h1>Dynamic Icon 示例</h1>
      <p>使用 lucide-react/dynamic 的 DynamicIcon 组件，通过字符串名称动态渲染图标</p>

      <div style={{ marginTop: 24 }}>
        <h2>控制面板</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <label>
            图标名称：
            <select
              value={selectedIcon}
              onChange={e => setSelectedIcon(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              {iconNames.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label>
            大小：
            <input
              type="range"
              min={16}
              max={64}
              value={iconSize}
              onChange={e => setIconSize(Number(e.target.value))}
              style={{ marginLeft: 8 }}
            />
            <span style={{ marginLeft: 4 }}>{iconSize}px</span>
          </label>

          <label>
            颜色：
            <input
              type="color"
              value={iconColor}
              onChange={e => setIconColor(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>
        </div>

        <div
          style={{
            padding: 24,
            border: '1px solid #ddd',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 100,
          }}
        >
          <DynamicIcon name={selectedIcon as any} size={iconSize} color={iconColor} />
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>图标列表</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 16,
          }}
        >
          {iconNames.map(name => (
            <div
              key={name}
              style={{
                padding: 16,
                border: '1px solid #eee',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                backgroundColor: selectedIcon === name ? '#f0f0f0' : 'transparent',
              }}
              onClick={() => setSelectedIcon(name)}
            >
              <DynamicIcon name={name as any} size={24} />
              <span style={{ fontSize: 12, color: '#666' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>使用方式</h2>
        <pre
          style={{
            backgroundColor: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          {`import { DynamicIcon } from 'lucide-react/dynamic';

// 通过字符串名称渲染图标
<DynamicIcon name="play" size={16} />
<DynamicIcon name="settings" size={24} color="red" />
<DynamicIcon name="${selectedIcon}" size={${iconSize}} color="${iconColor}" />`}
        </pre>
      </div>
    </div>
  );
};

export default DynamicIconExample;
