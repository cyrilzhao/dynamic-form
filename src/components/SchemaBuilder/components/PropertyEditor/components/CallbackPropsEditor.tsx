import React, { useState } from "react";
import {
  Button,
  Card,
  Callout,
  Divider,
  FormGroup,
  Icon,
  InputGroup,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { Select } from "../../../../Select";
import { CodeEditor } from "../../../../CodeEditor";
import type {
  CallbackPropRef,
  UIConfig,
} from "../../../../DynamicForm/types/schema";

type CallbackMode = "function-name" | "inline-script";

interface CallbackPropsEditorProps {
  value?: UIConfig["callbackProps"];
  onChange: (value: UIConfig["callbackProps"]) => void;
  disabled?: boolean;
}

const DEFAULT_SCRIPT_TEMPLATE = `function(value) {
  return value;
}`;

const callbackModeLabel = (
  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
    Callback Mode
    <Tooltip
      placement="right"
      content={
        <div style={{ maxWidth: 360 }}>
          <p style={{ marginBottom: 8 }}>
            Function Name reuses callbacks defined in code. Use it for shared
            handlers such as upload APIs, remote search, permission checks,
            analytics, or callbacks that need app services, auth, or client
            state.
          </p>
          <p style={{ marginBottom: 0 }}>
            Inline Script is more flexible for one-off behavior stored with the
            schema. Use it when the logic is field-specific, simple formatting
            or filtering, and the schema source is trusted.
          </p>
        </div>
      }
    >
      <Button
        aria-label="Callback Mode help"
        icon={<Icon icon="info-sign" size={12} />}
        minimal
        small
      />
    </Tooltip>
  </span>
);

const functionNameLabel = (
  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
    Function Name
    <Tooltip
      placement="right"
      content={
        <div style={{ maxWidth: 380 }}>
          <p style={{ marginBottom: 8 }}>
            Enter the key from the DynamicForm callbacks object, not the widget
            prop name.
          </p>
          <p style={{ marginBottom: 8 }}>
            Example: callbackProps: {'{ onUpload: "uploadFile" }'} injects
            callbacks=&#123;&#123; uploadFile &#125;&#125; into the widget as
            the onUpload prop.
          </p>
          <p style={{ marginBottom: 0 }}>
            Define uploadFile in application code when rendering DynamicForm.
          </p>
        </div>
      }
    >
      <Button
        aria-label="Function Name help"
        icon={<Icon icon="info-sign" size={12} />}
        minimal
        small
      />
    </Tooltip>
  </span>
);

export const CallbackPropsEditor: React.FC<CallbackPropsEditorProps> = ({
  value = {},
  onChange,
  disabled,
}) => {
  const entries = Object.entries(value);
  const [editingName, setEditingName] = useState("");
  const [editingRef, setEditingRef] = useState<CallbackPropRef | undefined>();
  const [editingOriginalName, setEditingOriginalName] = useState<string | null>(
    null,
  );
  const [isNewCallback, setIsNewCallback] = useState(false);

  const isScript = editingRef != null && typeof editingRef !== "string";
  const [callbackMode, setCallbackMode] =
    useState<CallbackMode>("inline-script");

  const resetEditingState = () => {
    setEditingName("");
    setEditingRef(undefined);
    setEditingOriginalName(null);
    setIsNewCallback(false);
    setCallbackMode("inline-script");
  };

  const handleAdd = () => {
    setEditingName("");
    setEditingRef({ type: "script", code: DEFAULT_SCRIPT_TEMPLATE });
    setEditingOriginalName(null);
    setIsNewCallback(true);
    setCallbackMode("inline-script");
  };

  const handleEdit = ({
    propName,
    ref,
  }: {
    propName: string;
    ref: CallbackPropRef;
  }) => {
    setEditingName(propName);
    setEditingRef(ref);
    setEditingOriginalName(propName);
    setIsNewCallback(false);
    setCallbackMode(
      typeof ref === "string" ? "function-name" : "inline-script",
    );
  };

  const handleRemove = (propName: string) => {
    const next = { ...value };
    delete next[propName];
    onChange(Object.keys(next).length ? next : undefined);
    if (editingOriginalName === propName) {
      resetEditingState();
    }
  };

  const handleModeChange = (newMode: CallbackMode) => {
    setCallbackMode(newMode);
    setEditingRef(
      newMode === "function-name"
        ? ""
        : { type: "script", code: DEFAULT_SCRIPT_TEMPLATE },
    );
  };

  const handleSave = () => {
    const propName = editingName.trim();
    if (!propName || editingRef == null) {
      return;
    }

    const ref =
      typeof editingRef === "string"
        ? editingRef.trim()
        : { type: "script" as const, code: editingRef.code.trim() };

    if (
      (typeof ref === "string" && !ref) ||
      (typeof ref !== "string" && !ref.code)
    ) {
      return;
    }

    const next = { ...value };
    if (editingOriginalName && editingOriginalName !== propName) {
      delete next[editingOriginalName];
    }
    next[propName] = ref;
    onChange(next);
    resetEditingState();
  };

  const renderSummary = (ref: CallbackPropRef) => {
    if (typeof ref === "string") {
      return (
        <>
          <Tag minimal intent="success">
            function
          </Tag>
          <code style={{ fontSize: 12 }}>{ref}</code>
        </>
      );
    }

    return (
      <>
        <Tag minimal intent="warning">
          inline script
        </Tag>
        <code style={{ fontSize: 12 }}>{ref.code.slice(0, 80)}</code>
      </>
    );
  };

  const renderEditForm = () => (
    <Card style={{ padding: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FormGroup
          label="Callback Prop Name"
          helperText="Widget prop name, for example onUpload or filterOption."
        >
          <InputGroup
            aria-label="Callback Prop Name"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            placeholder="onUpload"
            disabled={disabled}
          />
        </FormGroup>

        <FormGroup label={callbackModeLabel}>
          <Select
            aria-label="Callback Mode"
            value={callbackMode}
            onChange={(value) => handleModeChange(value as CallbackMode)}
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

        {callbackMode === "function-name" ? (
          <FormGroup
            label={functionNameLabel}
            helperText="Function from DynamicForm callbacks prop."
          >
            <InputGroup
              value={typeof editingRef === "string" ? editingRef : ""}
              onChange={(e) => setEditingRef(e.target.value)}
              placeholder="handleUpload"
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
            <FormGroup
              label="Callback Script"
              helperText="Complete JavaScript function. The widget decides which arguments are passed."
            >
              <CodeEditor
                value={isScript ? editingRef.code : DEFAULT_SCRIPT_TEMPLATE}
                language="javascript"
                config={{ initialMode: "preview", previewLines: 5 }}
                onChange={(code) => setEditingRef({ type: "script", code })}
                disabled={disabled}
              />
            </FormGroup>
          </>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button
            text="Cancel"
            onClick={resetEditingState}
            disabled={disabled}
          />
          <Button
            text="Save Callback Prop"
            intent="primary"
            onClick={handleSave}
            disabled={disabled || !editingName.trim()}
          />
        </div>
      </div>
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Callout intent="primary" icon="info-sign">
        Callback props are resolved as functions and override same-named
        widgetProps.
      </Callout>

      {entries.map(([propName, ref]) => (
        <Card key={propName} style={{ padding: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <code style={{ fontSize: 12 }}>{propName}</code>
              {renderSummary(ref)}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <Button
                icon="edit"
                minimal
                small
                onClick={() => handleEdit({ propName, ref })}
                disabled={disabled}
              />
              <Button
                icon="trash"
                minimal
                small
                intent="danger"
                onClick={() => handleRemove(propName)}
                disabled={disabled}
              />
            </div>
          </div>
        </Card>
      ))}

      {(isNewCallback || editingOriginalName != null) && renderEditForm()}

      <Divider />

      <Button
        icon="add"
        text="Add Callback Prop"
        intent="primary"
        onClick={handleAdd}
        disabled={disabled || isNewCallback || editingOriginalName != null}
      />
    </div>
  );
};
