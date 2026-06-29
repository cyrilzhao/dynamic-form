import React, { useState } from 'react';
import {
  Button,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Card,
  Tag,
  Callout,
  Divider,
} from '@blueprintjs/core';
import { CodeEditor } from '../CodeEditor';
import type { ValidatorRule } from '../DynamicForm/types/schema';

interface FieldValidatorsEditorProps {
  value?: ValidatorRule[];
  onChange: (value: ValidatorRule[]) => void;
  disabled?: boolean;
}

export const FieldValidatorsEditor: React.FC<FieldValidatorsEditorProps> = ({
  value = [],
  onChange,
  disabled,
}) => {
  const [addingType, setAddingType] = useState<'remote' | 'script'>('remote');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteMethod, setRemoteMethod] = useState<'POST' | 'GET'>('POST');
  const [remoteMessage, setRemoteMessage] = useState('');
  const [scriptCode, setScriptCode] = useState('');

  const handleAdd = () => {
    let newRule: ValidatorRule;
    if (addingType === 'remote') {
      if (!remoteUrl.trim()) return;
      newRule = { type: 'remote', url: remoteUrl.trim(), method: remoteMethod, message: remoteMessage.trim() || undefined };
      setRemoteUrl('');
      setRemoteMessage('');
    } else {
      if (!scriptCode.trim()) return;
      newRule = { type: 'script', code: scriptCode.trim() };
      setScriptCode('');
    }
    onChange([...value, newRule]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Callout intent="primary" icon="info-sign">
        <strong>Field Validators</strong>
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          Add custom validation rules for this field. These run on form submit.
        </p>
      </Callout>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {value.map((rule, index) => (
            <Card key={index} style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <Tag intent={rule.type === 'remote' ? 'primary' : 'warning'} minimal>
                    {rule.type}
                  </Tag>
                  {rule.type === 'remote' && (
                    <code style={{ fontSize: 12 }}>{rule.method || 'POST'} {rule.url}</code>
                  )}
                  {rule.type === 'script' && (
                    <pre style={{ margin: 0, fontSize: 11, maxHeight: 60, overflow: 'hidden', color: '#5c7080' }}>
                      {rule.code.slice(0, 120)}{rule.code.length > 120 ? '…' : ''}
                    </pre>
                  )}
                </div>
                <Button icon="trash" minimal small intent="danger" onClick={() => handleRemove(index)} disabled={disabled} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Divider />

      <FormGroup label="Validator Type">
        <HTMLSelect
          value={addingType}
          onChange={e => setAddingType(e.target.value as 'remote' | 'script')}
          disabled={disabled}
        >
          <option value="remote">Remote (API endpoint)</option>
          <option value="script">Script (JS code)</option>
        </HTMLSelect>
      </FormGroup>

      {addingType === 'remote' && (
        <>
          <FormGroup label="URL" helperText="POST { value, formValues } to this endpoint">
            <InputGroup value={remoteUrl} onChange={e => setRemoteUrl(e.target.value)} placeholder="https://api.example.com/validate" disabled={disabled} />
          </FormGroup>
          <FormGroup label="Method">
            <HTMLSelect value={remoteMethod} onChange={e => setRemoteMethod(e.target.value as 'POST' | 'GET')} disabled={disabled}>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </HTMLSelect>
          </FormGroup>
          <FormGroup label="Error Message" helperText="Fallback message if response has no message field">
            <InputGroup value={remoteMessage} onChange={e => setRemoteMessage(e.target.value)} placeholder="Validation failed" disabled={disabled} />
          </FormGroup>
        </>
      )}

      {addingType === 'script' && (
        <>
          <Callout intent="warning" icon="warning-sign" style={{ fontSize: 12 }}>
            Only use in trusted internal environments. The code runs in the browser.
          </Callout>
          <FormGroup
            label="Validation Code"
            helperText="Function body receiving (value, formValues). Return true or a string error message."
          >
            <CodeEditor
              value={scriptCode}
              language="javascript"
              config={{ initialMode: 'edit', previewLines: 6 }}
              onChange={code => setScriptCode(code)}
              disabled={disabled}
            />
          </FormGroup>
        </>
      )}

      <Button
        icon="add"
        text="Add Validator"
        intent="primary"
        onClick={handleAdd}
        disabled={disabled || (addingType === 'remote' ? !remoteUrl.trim() : !scriptCode.trim())}
      />
    </div>
  );
};
