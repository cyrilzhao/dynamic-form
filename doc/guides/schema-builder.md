# SchemaBuilder: User Guide

SchemaBuilder is a visual workspace for building a form. You work with a field tree and property panels; the tool updates the form definition for you, so you do not need to write JSON.

## The screen at a glance

When SchemaBuilder opens, the screen is divided into these areas:

1. **Schema Tree (left)** – Shows the form hierarchy. The root is at the top, object fields appear beneath `properties`, and array fields contain an item definition.
2. **Property Editor (center)** – Shows settings for the selected field. Select a different tree node to edit another field.
3. **Toolbar (top)** – Contains **Import JSON** (when enabled) and the **Edit / Preview** switch.
4. **Preview (right or main area)** – In Preview mode, **Live Preview** renders the form and shows the entered data; **JSON Schema** displays the generated definition.

The divider between the tree and editor can be dragged to make the tree wider or narrower. If the tree or preview is not visible, it may have been hidden by the page configuration.

## Build a form

### 1. Start with the root

If no schema is provided, SchemaBuilder starts with an object and a starter field. The root itself cannot be deleted. Select the root when you need to work with the form's top-level structure.

### 2. Add fields

1. Select an **object** node in the tree.
2. Choose **Add child** and select a field type (string, number, integer, boolean, object, or array).
3. Select the new field and edit its **Name**, **Label**, and other settings in the Property Editor.

For an array node, use its item controls to define the type and structure of each item. Object and array nodes are expanded automatically when a child is added.

### 3. Organize fields

Use the actions on a selected tree node to:

- **Add sibling** – Insert another field at the same level.
- **Move up / Move down** – Change the order of object properties.
- **Delete** – Remove the selected field. Deleting a parent also removes its nested fields.

Field names must be unique within the same object. Renaming a field updates its path and keeps its nested content.

## Configure a selected field

The Property Editor is organized into tabs. Available tabs can vary by field type and page configuration.

### Basic

Set the field's name, label, description, type, default value, and whether it is required. For enum fields, enter the selectable values and their display labels.

Changing **Type** changes which settings are valid. For example, switching a field from object to string removes its object children; switching to object or array creates an initial child structure when needed.

### Validation

Add rules appropriate to the field type:

- Strings: minimum/maximum length, regular expression, and format.
- Numbers: minimum, maximum, and step multiples.
- Arrays: minimum/maximum items and unique items.
- Objects: minimum/maximum properties.

You can also customize validation messages and add custom validators where those controls are enabled.

### UI Config

Choose how the field appears in the generated form: widget, placeholder, help text, hidden/disabled/read-only state, layout, column span, and object/array behavior. This is also where you configure transforms and other advanced display or data-handling options.

### Linkage

Create rules that react to other fields. A rule can show or hide a field, disable or make it read-only, set its value, change its options, or apply a schema change. Select the dependent field path, define a condition, then configure what happens when the condition is true or false. Multiple rules run in the order shown.

### Variants

Variants let one field offer several mutually exclusive editing modes (for example, a text mode and an object mode). Add a variant, give it a unique name and label, choose its type and widget, then edit its schema. Select a default variant and, when needed, configure automatic detection.

## Check the result

1. Click **Preview** in the toolbar.
2. In **Live Preview**, fill in the generated form as a user would. The **Data** area below it shows the current values.
3. Select **JSON Schema** to inspect the complete definition.
4. Click **Edit** to return to the tree and Property Editor.

Preview reflects the current edits. It is useful for checking labels, required fields, widget choices, layout, and linkage behavior before saving or publishing the schema.

## Import an existing schema

1. Click **Import JSON**.
2. Paste or edit an `ExtendedJSONSchema` document in the dialog.
3. Click **Apply**. If the document is invalid, an error message appears and the current schema is kept.
4. Click **Cancel** to close the dialog without applying changes.

Import replaces the schema currently open in the builder. Review it in the tree and Preview after applying.

## Working with a restricted or read-only screen

Some deployments intentionally hide parts of the interface or disable actions. For example, the tree, preview, import control, Property Editor, Variants tab, or root validation may not be shown. A read-only screen can still let you browse fields and inspect their settings, but add, delete, reorder, rename, or type-changing actions may be unavailable. This is expected behavior for review workflows.

## Practical tips

- Build the hierarchy first, then configure each field's details.
- Use clear labels because they are shown to form users and in validation messages.
- Test conditional rules in Live Preview with both matching and non-matching values.
- After importing or making major changes, inspect both Live Preview and JSON Schema.
- If a field seems missing, expand its parent object or array in the tree and verify that the relevant panel has not been hidden.
