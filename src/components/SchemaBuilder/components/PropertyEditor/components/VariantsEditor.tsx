import React, { useState } from "react";
import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogFooter,
  Divider,
  FormGroup,
  InputGroup,
  Tag,
} from "@blueprintjs/core";
import { Select } from "../../../../Select";
import { SchemaBuilder } from "../../../SchemaBuilder";
import JsonView from "../../../../JsonView";
import type {
  ExtendedJSONSchema,
  FieldVariant,
  UIConfig,
} from "../../../../DynamicForm/types/schema";
import { FunctionRefEditor } from "./FunctionRefEditor";

interface VariantsEditorProps {
  value?: UIConfig["variants"];
  defaultVariant?: string;
  onChange: (
    variants: FieldVariant[] | undefined,
    defaultVariant?: string,
  ) => void;
  disabled?: boolean;
}

interface VariantItemEditorProps {
  value: FieldVariant;
  onSave: (value: FieldVariant) => void;
  onCancel: () => void;
  disabled?: boolean;
}

const TYPES = [
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
  "null",
] as const;

const getWidgetOptions = (type: FieldVariant["type"]) => {
  if (type === "object")
    return [
      { value: "nested-form", label: "Nested Form" },
      { value: "object-editor", label: "Object Editor" },
    ];
  if (type === "array")
    return [
      { value: "array", label: "Array" },
      { value: "key-value-array", label: "Key-Value Array" },
      { value: "table-array", label: "Table Array" },
    ];
  if (type === "boolean")
    return [
      { value: "checkbox", label: "Checkbox" },
      { value: "switch", label: "Switch" },
    ];
  if (type === "number" || type === "integer")
    return [
      { value: "number", label: "Number" },
      { value: "range", label: "Range" },
    ];
  return [
    { value: "text", label: "Text" },
    { value: "textarea", label: "Textarea" },
    { value: "select", label: "Select" },
  ];
};

const getDefaultWidget = (type: FieldVariant["type"]) => {
  if (type === "object") return "nested-form";
  if (type === "array") return "array";
  if (type === "boolean") return "checkbox";
  if (type === "number" || type === "integer") return "number";
  return "text";
};

const createVariant = (index: number): FieldVariant => ({
  name: `variant${index + 1}`,
  label: `Variant ${index + 1}`,
  type: "string",
  widget: undefined,
  schema: { type: "string" },
});

const createDefaultVariantSchema = (
  type: FieldVariant["type"],
): ExtendedJSONSchema => {
  if (type === "object") return { type, properties: {} };
  if (type === "array")
    return { type, items: { type: "string", title: "Item" } };
  return { type };
};

/** 编辑单个 Variant；保存前所有修改都停留在本地副本中，取消不会污染外层 Schema。 */
const VariantItemEditor: React.FC<VariantItemEditorProps> = ({
  value,
  onSave,
  onCancel,
  disabled,
}) => {
  const [draft, setDraft] = useState<FieldVariant>({
    ...value,
    schema: value.schema ? { ...value.schema } : { type: value.type },
  });
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const [dialogSchema, setDialogSchema] = useState<ExtendedJSONSchema>();
  const update = (changes: Partial<FieldVariant>) =>
    setDraft((current) => ({ ...current, ...changes }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FormGroup label="Name" helperText="Must be unique within this field.">
        <InputGroup
          value={draft.name}
          disabled={disabled}
          onChange={(event) => update({ name: event.target.value })}
        />
      </FormGroup>
      <FormGroup label="Label">
        <InputGroup
          value={draft.label || ""}
          disabled={disabled}
          onChange={(event) => update({ label: event.target.value })}
        />
      </FormGroup>
      <FormGroup label="Type">
        <Select
          value={draft.type}
          disabled={disabled}
          options={TYPES.map((type) => ({ value: type, label: type }))}
          onChange={(value) => {
            const type = String(value) as FieldVariant["type"];
            // 类型切换会重置 Schema，避免旧类型的 properties/items 和约束残留。
            update({
              type,
              widget: undefined,
              schema: createDefaultVariantSchema(type),
            });
          }}
        />
      </FormGroup>
      <FormGroup label="Widget">
        <Select
          value={draft.widget || ""}
          disabled={disabled}
          options={[
            { value: "", label: `Default (${getDefaultWidget(draft.type)})` },
            ...getWidgetOptions(draft.type).filter(
              (option) => option.value !== getDefaultWidget(draft.type),
            ),
          ]}
          onChange={(value) => update({ widget: String(value) || undefined })}
        />
      </FormGroup>
      <FunctionRefEditor
        value={draft.detect?.callback}
        onChange={(callback) =>
          update({ detect: callback ? { callback } : undefined })
        }
        modeLabel="Detection callback"
        functionNameLabel="Function name"
        functionNameHelperText="Receives { value, formData, context, helpers } and returns a truthy match result."
        functionNamePlaceholder="detectVariant"
        scriptLabel="Inline detection script"
        scriptHelperText="Return a truthy value when this Variant matches."
        scriptTemplate="({ value, formData, context, helpers }) => Boolean(value)"
        disabled={disabled}
      />
      <FormGroup
        label="Variant Schema"
        helperText="Open the schema builder to edit this variant's fields and constraints."
      >
        <JsonView data={draft.schema || { type: draft.type }} />
        <Button
          icon="edit"
          text="Edit Schema"
          disabled={disabled}
          onClick={() => {
            setDialogSchema(draft.schema || { type: draft.type });
            setSchemaDialogOpen(true);
          }}
        />
      </FormGroup>
      <Dialog
        isOpen={schemaDialogOpen}
        title={`Edit ${draft.label || draft.name} Schema`}
        onClose={() => setSchemaDialogOpen(false)}
        style={{ width: "min(88vw, 1200px)" }}
      >
        <DialogBody>
          <SchemaBuilder
            defaultValue={dialogSchema || { type: draft.type }}
            previewMode="none"
            options={{
              rootType: draft.type,
              hidden: {
                importExport: true,
                preview: true,
                variantsTab: true,
                rootValidation: true,
              },
              readonly: { all: false },
            }}
            onChange={(schema) =>
              setDialogSchema({ ...schema, type: draft.type })
            }
          />
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button
                text="Cancel"
                onClick={() => setSchemaDialogOpen(false)}
              />
              <Button
                intent="primary"
                text="Apply"
                onClick={() => {
                  if (dialogSchema)
                    setDraft((current) => ({
                      ...current,
                      schema: { ...dialogSchema, type: current.type },
                    }));
                  setSchemaDialogOpen(false);
                }}
              />
            </>
          }
        />
      </Dialog>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 8,
        }}
      >
        <Button text="Cancel" onClick={onCancel} disabled={disabled} />
        <Button
          intent="primary"
          text="Save"
          onClick={() => onSave(draft)}
          disabled={disabled || !draft.name.trim()}
        />
      </div>
    </div>
  );
};

/** 以 LinkagesEditor 相同的预览态/编辑态模式管理多个 Variant。 */
export const VariantsEditor: React.FC<VariantsEditorProps> = ({
  value = [],
  defaultVariant,
  onChange,
  disabled,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<FieldVariant | null>(
    null,
  );
  const [isNew, setIsNew] = useState(false);

  const handleAdd = () => {
    setEditingVariant(createVariant(value.length));
    setEditingIndex(value.length);
    setIsNew(true);
  };
  const handleEdit = (index: number) => {
    setEditingVariant({ ...value[index] });
    setEditingIndex(index);
    setIsNew(false);
  };
  const handleSave = (variant: FieldVariant) => {
    const next = [...value];
    if (
      next.some(
        (item, index) => item.name === variant.name && index !== editingIndex,
      )
    )
      return;
    if (isNew) next.push(variant);
    else next[editingIndex!] = variant;
    onChange(
      next,
      defaultVariant && next.some((item) => item.name === defaultVariant)
        ? defaultVariant
        : next[0]?.name,
    );
    setEditingIndex(null);
    setEditingVariant(null);
    setIsNew(false);
  };
  const handleCancel = () => {
    setEditingIndex(null);
    setEditingVariant(null);
    setIsNew(false);
  };
  const handleRemove = (index: number) => {
    const next = value.filter((_, itemIndex) => itemIndex !== index);
    onChange(
      next.length ? next : undefined,
      defaultVariant === value[index]?.name ? next[0]?.name : defaultVariant,
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <FormGroup
        label="Default Variant"
        helperText="Used when the value is empty or cannot be recognized."
      >
        <Select
          value={defaultVariant || value[0]?.name || ""}
          disabled={disabled || !value.length}
          options={value.map((item) => ({
            value: item.name,
            label: item.label || item.name,
          }))}
          onChange={(next) => onChange(value, String(next) || undefined)}
          placeholder="No variants"
        />
      </FormGroup>
      {value.map((variant, index) => (
        <Card key={`${variant.name}-${index}`} style={{ padding: 10 }}>
          {editingIndex !== index && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <Tag minimal intent="primary">
                    #{index + 1}
                  </Tag>{" "}
                  <strong>{variant.label || variant.name}</strong>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Button
                    icon="edit"
                    minimal
                    small
                    onClick={() => handleEdit(index)}
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
              <div style={{ marginTop: 8, fontSize: 12, color: "#5c7080" }}>
                {variant.name} · {variant.type} · {variant.widget || "Default"}
              </div>
            </>
          )}
          {editingIndex === index && editingVariant && (
            <VariantItemEditor
              value={editingVariant}
              onSave={handleSave}
              onCancel={handleCancel}
              disabled={disabled}
            />
          )}
        </Card>
      ))}
      {isNew && editingVariant && (
        <Card style={{ padding: 10 }}>
          <VariantItemEditor
            value={editingVariant}
            onSave={handleSave}
            onCancel={handleCancel}
            disabled={disabled}
          />
        </Card>
      )}
      <Divider />
      <Button
        icon="add"
        text="Add Variant"
        intent="primary"
        onClick={handleAdd}
        disabled={disabled || isNew || editingIndex !== null}
      />
    </div>
  );
};
