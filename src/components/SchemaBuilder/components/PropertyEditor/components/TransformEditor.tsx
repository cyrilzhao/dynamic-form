import React from "react";
import { Button, Card } from "@blueprintjs/core";
import { FunctionRefEditor } from "./FunctionRefEditor";
import type {
  CallbackPropRef,
  UIConfig,
} from "../../../../DynamicForm/types/schema";

interface TransformEditorProps {
  value?: UIConfig["transform"];
  onChange: (value: UIConfig["transform"]) => void;
  disabled?: boolean;
}

const TRANSFORM_SCRIPT_TEMPLATE = `/**
 * Transform display value into stored form value.
 * @param {object} params - Parameters object
 * @param {any} params.value - Value from the widget/input domain
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, valibot, etc.)
 * @returns {any} Stored value written to form data
 *
 * Example: convert percentage input 96 to decimal 0.96.
 */
function({ value, helpers }) {
  if (value == null || value === '') {
    return value;
  }

  return Number(value) / 100;
}`;

const REVERSE_TRANSFORM_SCRIPT_TEMPLATE = `/**
 * Transform stored form value back into display value.
 * @param {object} params - Parameters object
 * @param {any} params.value - Stored value from form data
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, valibot, etc.)
 * @returns {any} Display value shown by the widget/input
 *
 * Example: convert stored decimal 0.96 back to percentage input 96.
 */
function({ value, helpers }) {
  if (value == null || value === '') {
    return value;
  }

  return Number(value) * 100;
}`;

const handleTransformRefChange = ({
  value,
  callback,
  onChange,
}: {
  value: UIConfig["transform"];
  callback: CallbackPropRef | undefined;
  onChange: (value: UIConfig["transform"]) => void;
}) => {
  if (!callback) {
    onChange(undefined);
    return;
  }
  onChange({ ...value, callback });
};

const handleReverseTransformRefChange = ({
  value,
  callback,
  onChange,
}: {
  value: UIConfig["transform"];
  callback: CallbackPropRef | undefined;
  onChange: (value: UIConfig["transform"]) => void;
}) => {
  if (!value) {
    return;
  }
  onChange({ ...value, reverseCallback: callback });
};

export const TransformEditor: React.FC<TransformEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const enabled = value != null;

  const handleEnable = () => onChange({ callback: "" });

  const handleDisable = () => onChange(undefined);

  if (!enabled) {
    return (
      <Button
        icon="add"
        text="Add Transform"
        intent="primary"
        fill
        onClick={handleEnable}
        disabled={disabled}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FunctionRefEditor
            value={value.callback}
            onChange={(callback) =>
              handleTransformRefChange({ value, callback, onChange })
            }
            disabled={disabled}
            modeLabel="Callback Mode"
            functionNameLabel="Function Name"
            functionNameHelperText="Function from DynamicForm callbacks prop. Signature: (value) => storedValue."
            functionNamePlaceholder="e.g. percentToDecimal"
            scriptLabel="Transform Script"
            scriptHelperText="Complete JavaScript function receiving value. Return the stored-domain value."
            scriptTemplate={TRANSFORM_SCRIPT_TEMPLATE}
            previewLines={5}
          />
        </div>
      </Card>

      <Card style={{ padding: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FunctionRefEditor
            value={value.reverseCallback}
            onChange={(callback) =>
              handleReverseTransformRefChange({ value, callback, onChange })
            }
            disabled={disabled}
            modeLabel="Callback Mode"
            functionNameLabel="Function Name"
            functionNameHelperText="Function from DynamicForm callbacks prop. Signature: (value) => inputValue."
            functionNamePlaceholder="e.g. decimalToPercent"
            scriptLabel="Reverse Transform Script"
            scriptHelperText="Complete JavaScript function receiving stored value. Return the input-domain value."
            scriptTemplate={REVERSE_TRANSFORM_SCRIPT_TEMPLATE}
            previewLines={5}
          />
        </div>
      </Card>

      <Button
        small
        icon="trash"
        intent="danger"
        onClick={handleDisable}
        disabled={disabled}
      >
        Remove Transform
      </Button>
    </div>
  );
};
