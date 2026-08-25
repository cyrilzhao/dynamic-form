import React, { useEffect, useMemo, useState } from "react";
import { Callout, FormGroup, InputGroup } from "@blueprintjs/core";
import { Select } from "../../../../Select";
import { CodeEditor } from "../../../../CodeEditor";
import type { CallbackPropRef } from "../../../../DynamicForm/types/schema";

type FunctionRefMode = "function-name" | "inline-script";

interface FunctionRefEditorProps {
  value?: CallbackPropRef;
  onChange: (value: CallbackPropRef | undefined) => void;
  disabled?: boolean;
  modeLabel: React.ReactNode;
  functionNameLabel: React.ReactNode;
  functionNameHelperText: string;
  functionNamePlaceholder: string;
  scriptLabel: React.ReactNode;
  scriptHelperText: string;
  scriptTemplate: string;
  previewLines?: number;
}

export const FunctionRefEditor: React.FC<FunctionRefEditorProps> = ({
  value,
  onChange,
  disabled,
  modeLabel,
  functionNameLabel,
  functionNameHelperText,
  functionNamePlaceholder,
  scriptLabel,
  scriptHelperText,
  scriptTemplate,
  previewLines = 5,
}) => {
  const initialMode = useMemo<FunctionRefMode>(
    () =>
      value != null && typeof value !== "string"
        ? "inline-script"
        : "function-name",
    [value],
  );
  const [mode, setMode] = useState<FunctionRefMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleModeChange = (newMode: FunctionRefMode) => {
    setMode(newMode);
    // 不要在切换到函数名模式时立即写入空字符串。部分父级配置会将
    // 空值视为删除整个配置，导致当前编辑区域被卸载；用户输入名称时
    // 再通过 InputGroup 的 onChange 提交实际值。
    if (newMode === "inline-script") {
      onChange({ type: "script", code: scriptTemplate });
    }
  };

  return (
    <>
      <FormGroup label={modeLabel}>
        <Select
          aria-label="Callback Mode"
          value={mode}
          onChange={(value) => handleModeChange(value as FunctionRefMode)}
          disabled={disabled}
          options={[
            {
              label: "Function Name (from callbacks registry)",
              value: "function-name",
            },
            { label: "Inline Script", value: "inline-script" },
          ]}
        />
      </FormGroup>

      {mode === "function-name" ? (
        <FormGroup
          label={functionNameLabel}
          helperText={functionNameHelperText}
        >
          <InputGroup
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={functionNamePlaceholder}
            disabled={disabled}
          />
        </FormGroup>
      ) : (
        <>
          <Callout
            intent="warning"
            icon="warning-sign"
            style={{ fontSize: 12 }}
          >
            Only use in trusted internal environments. The code runs in the
            browser.
          </Callout>
          <FormGroup label={scriptLabel} helperText={scriptHelperText}>
            <CodeEditor
              value={
                value != null && typeof value !== "string"
                  ? value.code
                  : scriptTemplate
              }
              language="javascript"
              config={{ initialMode: "preview", previewLines }}
              onChange={(code) =>
                onChange(code ? { type: "script", code } : undefined)
              }
              disabled={disabled}
            />
          </FormGroup>
        </>
      )}
    </>
  );
};
