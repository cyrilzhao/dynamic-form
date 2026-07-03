# DynamicForm Component - Usage Guide

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Basic Usage](#basic-usage)
5. [Schema Definition](#schema-definition)
   - [Basic Field Types](#1-basic-field-types)
   - [Field Validation](#2-field-validation)
   - [Field Linkage](#3-field-linkage)
   - [UI Configuration](#4-ui-configuration)
6. [Advanced Features](#advanced-features)
7. [API Reference](#api-reference)
8. [Examples](#examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

DynamicForm is a powerful, configuration-driven form component built on top of `react-hook-form` and standard `JSON Schema`. It enables you to generate complex forms dynamically from JSON Schema definitions, with built-in validation, UI linkage, and extensive customization options.

### Key Features

- **Configuration-Driven**: Generate forms from JSON Schema
- **Type-Safe**: Full TypeScript support
- **Validation**: Automatic validation based on JSON Schema rules
- **High Performance**: Built on react-hook-form's uncontrolled components
- **Extensible**: Support for custom widgets and validation rules
- **UI Linkage**: Dynamic field visibility, disabled states, and computed values
- **Nested Forms**: Support for nested objects and arrays
- **Field Path Flattening**: Simplify deeply nested parameter display

---

## Installation

### Prerequisites

- React 18+
- TypeScript 5+

### Install Dependencies

```bash
npm install react-hook-form
npm install ajv ajv-formats
npm install @types/json-schema
```

### Optional Dependencies

For UI components (Blueprint.js example):

```bash
npm install @blueprintjs/core @blueprintjs/icons
```

---

## Quick Start

Here's a minimal example to get you started:

```typescript
import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';

const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: 'Username',
      minLength: 3,
      maxLength: 20,
    },
    email: {
      type: 'string',
      title: 'Email',
      format: 'email',
    },
  },
  required: ['username', 'email'],
};

function App() {
  const handleSubmit = (data: any) => {
    console.log('Form data:', data);
  };

  return (
    <DynamicForm
      schema={schema}
      onSubmit={handleSubmit}
    />
  );
}

export default App;
```

---

## Basic Usage

### Simple Form with Default Values

```typescript
const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: 'Full Name',
    },
    age: {
      type: 'integer',
      title: 'Age',
      minimum: 0,
      maximum: 120,
    },
  },
  required: ['name'],
};

const defaultValues = {
  name: 'John Doe',
  age: 25,
};

<DynamicForm
  schema={schema}
  defaultValues={defaultValues}
  onSubmit={handleSubmit}
/>
```

### Listening to Form Changes

```typescript
const handleChange = (data: any) => {
  console.log('Form changed:', data);
};

<DynamicForm
  schema={schema}
  onChange={handleChange}
  onSubmit={handleSubmit}
/>
```

### Form Layout Options

DynamicForm supports three layout modes:

```typescript
// Vertical layout (default)
<DynamicForm
  schema={schema}
  layout="vertical"
  onSubmit={handleSubmit}
/>

// Horizontal layout with label width
<DynamicForm
  schema={schema}
  layout="horizontal"
  labelWidth={120}
  onSubmit={handleSubmit}
/>

// Inline layout
<DynamicForm
  schema={schema}
  layout="inline"
  onSubmit={handleSubmit}
/>
```

### Readonly and Disabled States

```typescript
// Readonly form (data included in submission)
<DynamicForm
  schema={schema}
  readonly={true}
  onSubmit={handleSubmit}
/>

// Disabled form (data excluded from submission)
<DynamicForm
  schema={schema}
  disabled={true}
  onSubmit={handleSubmit}
/>
```

---

## Schema Definition

This section explains how to define form schemas using JSON Schema with DynamicForm-specific extensions.

### 1. Basic Field Types

#### String Fields

```typescript
{
  type: 'string',
  title: 'Username',
  description: 'Enter your username',
  minLength: 3,
  maxLength: 20,
  pattern: '^[a-zA-Z0-9_]+$',
  default: '',
  ui: {
    placeholder: 'Enter username',
    widget: 'text'  // or 'textarea', 'password', 'email'
  }
}
```

#### Number Fields

```typescript
{
  type: 'integer',  // or 'number' for decimals
  title: 'Age',
  minimum: 0,
  maximum: 120,
  multipleOf: 1,
  default: 18,
  ui: {
    widget: 'number',  // or 'range' for slider
    step: 1
  }
}
```

#### Boolean Fields

```typescript
{
  type: 'boolean',
  title: 'Accept Terms',
  default: false,
  ui: {
    widget: 'checkbox'  // or 'switch'
  }
}
```

#### Enum Fields (Select/Radio)

```typescript
{
  type: 'string',
  title: 'Gender',
  enum: ['male', 'female', 'other'],
  enumNames: ['Male', 'Female', 'Other'],
  ui: {
    widget: 'select'  // or 'radio'
  }
}
```

#### Array Fields

DynamicForm provides three different Array Widgets to meet different use cases:

| Widget                  | Use Case                                         | Layout Style                         | Virtual Scroll |
| ----------------------- | ------------------------------------------------ | ------------------------------------ | -------------- |
| **ArrayFieldWidget**    | General arrays (supports any type)               | Card/List style                      | ✅             |
| **KeyValueArrayWidget** | Key-value pair arrays (e.g., env vars, mappings) | Table style (fixed two columns)      | ❌             |
| **TableArrayWidget**    | Object arrays (table display)                    | Table style (auto-generated columns) | ✅             |

##### 1. ArrayFieldWidget (General Arrays)

The default widget for all array types. It intelligently chooses the appropriate sub-widget based on the `items` configuration.

**Simple Array (Checkboxes)**:

```typescript
{
  type: 'array',
  title: 'Hobbies',
  items: {
    type: 'string',
    enum: ['reading', 'sports', 'music', 'travel'],
    enumNames: ['Reading', 'Sports', 'Music', 'Travel']
  },
  uniqueItems: true,
  ui: {
    widget: 'checkboxes'  // Auto-inferred when items.enum exists
  }
}
```

**Object Array (Nested Forms)**:

```typescript
{
  type: 'array',
  title: 'Contacts',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      phone: { type: 'string', title: 'Phone' },
      email: { type: 'string', title: 'Email', format: 'email' }
    },
    required: ['name', 'phone']
  },
  minItems: 1,
  ui: {
    widget: 'array',  // Default: uses ArrayFieldWidget
    addButtonText: 'Add Contact'
  }
}
```

**Object Array with Virtual Scroll (Large Dataset)**:

For arrays with many items (50+), enable virtual scrolling for better performance:

**Note**: Array fields automatically use the `array` widget by default. You only need to explicitly specify `ui.widget` if you want to use a different widget (e.g., `key-value-array` or `table-array`).

```typescript
{
  type: 'array',
  title: 'Large Contact List',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      phone: { type: 'string', title: 'Phone' },
      email: { type: 'string', title: 'Email', format: 'email' },
      company: { type: 'string', title: 'Company' }
    },
    required: ['name', 'phone']
  },
  ui: {
    // widget: 'array' is the default for array type, no need to specify
    widgetProps: {
      enableVirtualScroll: true,      // Enable virtual scrolling
      virtualScrollHeight: 500,       // Scroll container height in pixels
      addButtonText: 'Add Contact'
    }
  }
}
```

##### 2. KeyValueArrayWidget (Key-Value Pair Arrays)

A specialized widget for key-value pair scenarios such as environment variables, HTTP headers, and output mappings.

**Features:**

- Table layout with two columns (key and value)
- Customizable field names and labels
- Add/remove operations
- Min/max item limits
- Empty state display

**Configuration:**

```typescript
{
  type: 'array',
  title: 'Environment Variables',
  items: {
    type: 'object',
    properties: {
      key: { type: 'string', title: 'Key' },
      value: { type: 'string', title: 'Value' }
    }
  },
  ui: {
    widget: 'key-value-array',
    widgetProps: {
      keyField: 'key',
      valueField: 'value',
      keyLabel: 'Variable Name',
      valueLabel: 'Variable Value',
      keyPlaceholder: 'e.g., API_KEY',
      valuePlaceholder: 'e.g., your-api-key',
      addButtonText: 'Add Variable',
      emptyText: 'No environment variables configured'
    }
  }
}
```

**Widget Props:**

| Property           | Type     | Default              | Description             |
| ------------------ | -------- | -------------------- | ----------------------- |
| `keyField`         | `string` | `'key'`              | Key field name          |
| `valueField`       | `string` | `'value'`            | Value field name        |
| `keyLabel`         | `string` | `'Key'`              | Key column header       |
| `valueLabel`       | `string` | `'Value'`            | Value column header     |
| `keyPlaceholder`   | `string` | Same as `keyLabel`   | Key input placeholder   |
| `valuePlaceholder` | `string` | Same as `valueLabel` | Value input placeholder |
| `addButtonText`    | `string` | `'Add'`              | Add button text         |
| `emptyText`        | `string` | -                    | Empty state message     |

##### 3. TableArrayWidget (Table Arrays)

A specialized widget for displaying object arrays in table format, with virtual scroll support for handling large datasets.

**Features:**

- Table layout with auto-generated columns
- Virtual scrolling for large datasets (50+ items)
- Customizable column order
- Add/remove rows
- Min/max item limits
- Empty state display

**Configuration:**

```typescript
{
  type: 'array',
  title: 'User List',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      age: { type: 'number', title: 'Age' },
      email: { type: 'string', title: 'Email', format: 'email' },
      role: {
        type: 'string',
        title: 'Role',
        enum: ['admin', 'user', 'guest'],
        enumNames: ['Admin', 'User', 'Guest']
      }
    }
  },
  ui: {
    widget: 'table-array',
    widgetProps: {
      enableVirtualScroll: true,
      virtualScrollHeight: 400,
      columns: ['name', 'email', 'role', 'age'],  // Custom column order
      addButtonText: 'Add User',
      emptyText: 'No users found'
    }
  }
}
```

**Widget Props:**

| Property              | Type       | Default     | Description                                           |
| --------------------- | ---------- | ----------- | ----------------------------------------------------- |
| `enableVirtualScroll` | `boolean`  | `false`     | Enable virtual scrolling                              |
| `virtualScrollHeight` | `number`   | `400`       | Virtual scroll container height (pixels)              |
| `columns`             | `string[]` | -           | Column order (optional, defaults to properties order) |
| `addButtonText`       | `string`   | `'Add Row'` | Add button text                                       |
| `emptyText`           | `string`   | `'No data'` | Empty state message                                   |

**Performance Comparison:**

| Array Size  | Without Virtual Scroll | With Virtual Scroll |
| ----------- | ---------------------- | ------------------- |
| 50 items    | Smooth                 | Smooth              |
| 100 items   | Slightly laggy         | Smooth              |
| 500 items   | Noticeably laggy       | Smooth              |
| 1000+ items | Severely laggy         | Smooth              |

**When to Use:**

- Enable virtual scroll when array has 50+ items
- Each item contains complex form fields
- Users need to frequently scroll through data

**Widget Comparison:**

| Feature               | TableArrayWidget              | ArrayFieldWidget           | KeyValueArrayWidget     |
| --------------------- | ----------------------------- | -------------------------- | ----------------------- |
| **Use Case**          | Object arrays (table display) | General arrays             | Key-value pairs         |
| **Layout**            | Table                         | Card/List                  | Table (fixed 2 columns) |
| **Virtual Scroll**    | ✅ Supported                  | ✅ Supported               | ❌ Not supported        |
| **Column Definition** | Auto-generated                | Auto-generated             | Fixed 2 columns         |
| **Complexity**        | Medium                        | High (supports nesting)    | Simple                  |
| **Performance**       | Excellent (virtual scroll)    | Excellent (virtual scroll) | Good                    |

#### Object Fields (Nested Forms)

**Note**: Object fields automatically use the `nested-form` widget by default. You only need to explicitly specify `ui.widget` if you want to use a custom widget.

```typescript
{
  type: 'object',
  title: 'Address',
  properties: {
    street: { type: 'string', title: 'Street' },
    city: { type: 'string', title: 'City' },
    zipCode: { type: 'string', title: 'Zip Code' }
  },
  required: ['city']
}
```

#### Code Editor Widget

A code editor widget with syntax highlighting, powered by CodeMirror 6. Ideal for editing code snippets, JSON configurations, scripts, etc.

**Features:**

- Syntax highlighting for multiple languages
- Preview mode with expandable full-screen editor
- Built-in JSON validation and formatting
- Customizable preview height and modal size

**Supported Languages:** `javascript`, `json`, `python`, `sql`, `yaml`, `markdown`, `html`, `css`

**Basic Configuration:**

```typescript
{
  type: 'string',
  title: 'Configuration (JSON)',
  ui: {
    widget: 'code-editor',
    widgetProps: {
      language: 'json',
      config: {
        previewLines: 5,
        previewMaxHeight: 150,
      },
    },
  },
}
```

**JavaScript Example:**

```typescript
{
  type: 'string',
  title: 'Auth Script',
  ui: {
    widget: 'code-editor',
    widgetProps: {
      language: 'javascript',
      config: {
        previewLines: 5,
        previewMaxHeight: 150,
        modalPadding: 40,
      },
    },
  },
}
```

**Widget Props:**

| Property    | Type                               | Default        | Description                           |
| ----------- | ---------------------------------- | -------------- | ------------------------------------- |
| `language`  | `SupportedLanguage`                | `'javascript'` | Programming language for highlighting |
| `theme`     | `'light' \| 'dark'`                | `'light'`      | Editor theme                          |
| `config`    | `CodeEditorConfig`                 | `{}`           | Editor configuration                  |
| `validator` | `(code: string) => string \| null` | -              | Custom validator function             |
| `formatter` | `(code: string) => string`         | -              | Custom formatter function             |

**Config Options:**

| Property               | Type                  | Default     | Description                         |
| ---------------------- | --------------------- | ----------- | ----------------------------------- |
| `initialMode`          | `'preview' \| 'edit'` | `'preview'` | Initial display mode                |
| `previewLines`         | `number`              | `3`         | Number of lines shown in preview    |
| `previewMaxHeight`     | `number`              | `120`       | Max height of preview area (px)     |
| `modalPadding`         | `number`              | `40`        | Modal margin from screen edges (px) |
| `backdropOpacity`      | `number`              | `0.5`       | Modal backdrop opacity (0-1)        |
| `closeOnEscape`        | `boolean`             | `true`      | Close modal on ESC key              |
| `closeOnBackdropClick` | `boolean`             | `true`      | Close modal on backdrop click       |

**Registration:**

```typescript
import { CodeEditorWidget } from '@/components/DynamicForm/widgets/CodeEditorWidget';

<DynamicForm
  schema={schema}
  widgets={{
    'code-editor': CodeEditorWidget,
  }}
  onSubmit={handleSubmit}
/>
```

#### Object Editor Widget

A specialized widget for editing JSON objects. Based on CodeEditor, it automatically handles conversion between JSON strings and JavaScript objects.

**Features:**

- Edit objects as formatted JSON
- Automatic JSON validation
- Converts JSON string to object on change
- Converts object to JSON string for display

**Configuration:**

```typescript
{
  type: 'object',
  title: 'Metadata',
  ui: {
    widget: 'object-editor',
    widgetProps: {
      config: {
        previewLines: 5,
        previewMaxHeight: 150,
      },
      indent: 2,  // JSON indentation spaces
    },
  },
}
```

**Widget Props:**

| Property | Type                | Default   | Description                               |
| -------- | ------------------- | --------- | ----------------------------------------- |
| `config` | `CodeEditorConfig`  | `{}`      | Editor configuration (same as CodeEditor) |
| `theme`  | `'light' \| 'dark'` | `'light'` | Editor theme                              |
| `indent` | `number`            | `2`       | JSON indentation spaces                   |

**Data Flow:**

- **Input**: Receives `object` from form → Converts to JSON string → Displays in editor
- **Output**: User edits JSON → Parses to object → Passes to form's `onChange`

**Registration:**

```typescript
import { ObjectEditorWidget } from '@/components/DynamicForm/widgets/ObjectEditorWidget';

<DynamicForm
  schema={schema}
  widgets={{
    'object-editor': ObjectEditorWidget,
  }}
  onSubmit={handleSubmit}
/>
```

**Complete Example:**

```typescript
import { CodeEditorWidget } from '@/components/DynamicForm/widgets/CodeEditorWidget';
import { ObjectEditorWidget } from '@/components/DynamicForm/widgets/ObjectEditorWidget';

const schema = {
  type: 'object',
  properties: {
    script: {
      type: 'string',
      title: 'Script',
      ui: {
        widget: 'code-editor',
        widgetProps: { language: 'javascript' },
      },
    },
    metadata: {
      type: 'object',
      title: 'Metadata',
      ui: {
        widget: 'object-editor',
      },
    },
  },
};

<DynamicForm
  schema={schema}
  widgets={{
    'code-editor': CodeEditorWidget,
    'object-editor': ObjectEditorWidget,
  }}
  onSubmit={handleSubmit}
/>
```

### UI Extensions

The `ui` field provides extensive customization options:

#### Common UI Properties

```typescript
{
  type: 'string',
  title: 'Email',
  ui: {
    widget: 'email',           // Widget type
    placeholder: 'Enter email', // Placeholder text
    disabled: false,            // Disable field
    readonly: false,            // Make field readonly
    hidden: false,              // Hide field
    help: 'We will never share your email', // Help text
    className: 'custom-class',  // CSS class
    layout: 'horizontal',       // Layout override
    labelWidth: 120,            // Label width (horizontal layout)
    errorMessages: {            // Custom error messages
      required: 'Email is required',
      pattern: 'Invalid email format'
    }
  }
}
```

#### Supported Widget Types

| Widget          | Field Type          | Description                       |
| --------------- | ------------------- | --------------------------------- |
| `text`          | string              | Single-line text input            |
| `textarea`      | string              | Multi-line text input             |
| `password`      | string              | Password input                    |
| `email`         | string              | Email input                       |
| `number`        | number/integer      | Number input                      |
| `select`        | string/number/array | Dropdown select                   |
| `radio`         | string/number       | Radio buttons                     |
| `checkboxes`    | array               | Multiple checkboxes               |
| `checkbox`      | boolean             | Single checkbox                   |
| `switch`        | boolean             | Toggle switch                     |
| `date`          | string              | Date picker                       |
| `nested-form`   | object/array        | Nested form                       |
| `code-editor`   | string              | Code editor with syntax highlight |
| `object-editor` | object              | JSON object editor                |

### 2. Field Validation

DynamicForm provides comprehensive validation capabilities based on JSON Schema standard with custom extensions.

#### Built-in Validation Rules

JSON Schema provides a rich set of built-in validation keywords:

**String Validation:**

- `minLength` / `maxLength` - Length constraints
- `pattern` - Regular expression matching
- `format` - Predefined formats (email, uri, date, etc.)

**Number Validation:**

- `minimum` / `maximum` - Range constraints
- `exclusiveMinimum` / `exclusiveMaximum` - Exclusive range
- `multipleOf` - Must be a multiple of specified value

**Array Validation:**

- `minItems` / `maxItems` - Item count constraints
- `uniqueItems` - Ensure unique items

**Required Fields:**

- Add field names to schema's `required` array

**Example:**

```typescript
{
  type: 'string',
  title: 'Username',
  minLength: 3,              // Minimum length
  maxLength: 20,             // Maximum length
  pattern: '^[a-zA-Z0-9_]+$', // Regex pattern
  format: 'email',           // Predefined format
}
```

#### Custom Error Messages

You can customize error messages for each validation rule using `ui.errorMessages`:

```typescript
{
  type: 'string',
  title: 'Username',
}
```

#### Linkage-Driven Field Skipping

Fields that are hidden or disabled via **linkage** are automatically excluded from validation. This prevents validation errors from blocking form submission when fields are not visible or interactive to the user.

```typescript
// Example: creditCardNumber is hidden when paymentMethod !== 'credit_card'
// → creditCardNumber will NOT be validated when hidden, even if it's in `required`
const schema = {
  type: 'object',
  properties: {
    paymentMethod: { type: 'string', title: 'Payment Method' },
    creditCardNumber: {
      type: 'string',
      title: 'Card Number',
      ui: {
        linkages: [
          {
            type: 'visibility',
            dependencies: ['#/properties/paymentMethod'],
            when: {
              field: '#/properties/paymentMethod',
              operator: '==',
              value: 'credit_card',
            },
            fulfill: { state: { visible: true } },
            otherwise: { state: { visible: false } },
          },
        ],
      },
    },
  },
  required: ['creditCardNumber'],
}
```

**Rules:**

- Fields with `visible: false` (linkage-hidden) → validation errors skipped
- Fields with `disabled: true` (linkage-disabled) → validation errors skipped
- Fields with `ui.hidden: true` (schema static config) → validation errors skipped
- Fields with `ui.disabled: true` (schema static config) → validation errors skipped

#### Conditional Validation

Use JSON Schema's conditional validation keywords:

```typescript
{
  type: 'object',
  properties: {
    hasAddress: {
      type: 'boolean',
      title: 'Provide Address'
    },
    address: {
      type: 'string',
      title: 'Address'
    }
  },
  // If hasAddress is true, address is required
  if: {
    properties: { hasAddress: { const: true } }
  },
  then: {
    required: ['address']
  }
}
```

#### Custom Validation Functions

For complex validation logic beyond JSON Schema's built-in rules, you can use custom validation functions:

```typescript
const formRef = useRef<DynamicFormRef>(null)

// Add custom validation after form creation
const handleValidatePasswords = () => {
  const password = formRef.current?.getValue('password')
  const confirmPassword = formRef.current?.getValue('confirmPassword')

  if (password !== confirmPassword) {
    formRef.current?.setError('confirmPassword', {
      type: 'manual',
      message: 'Passwords do not match',
    })
  }
}
```

#### Custom Format Validators

Extend the `format` keyword with custom validators using `customFormats`:

```typescript
const customFormats = {
  // Custom phone number format
  phone: (value: string) => {
    return /^\d{3}-\d{3}-\d{4}$/.test(value);
  },
  // Custom URL format
  customUrl: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
};

const schema = {
  type: 'object',
  properties: {
    phone: {
      type: 'string',
      title: 'Phone Number',
      format: 'phone',
      ui: {
        placeholder: '123-456-7890',
        errorMessages: {
          format: 'Please enter a valid phone number (XXX-XXX-XXXX)',
        },
      },
    },
  },
};

<DynamicForm
  schema={schema}
  customFormats={customFormats}
  onSubmit={handleSubmit}
/>
```

#### Custom Field Validators (ui.validators)

For advanced validation scenarios beyond JSON Schema rules and custom formats, you can use `ui.validators` to define field-level custom validators.

**ScriptValidator** allows you to define custom validation logic using JavaScript functions. It supports two callback modes:

1. **Function Name Mode**: Reference a function from the `callbacks` registry (recommended for reusable validation logic)
2. **Inline Script Mode**: Provide a complete JavaScript function string (for simple, one-off validation)

**Configuration:**

```typescript
{
  type: 'string',
  title: 'Username',
  ui: {
    validators: [
      // Multiple validators can be defined for a single field
      // They run sequentially and all must pass
    ]
  }
}
```

**Mode 1: Function Name (Recommended)**

Reference a function from the `callbacks` registry for reusable validation logic.

```typescript
// Define validation function
const validateUsername = (value: any, formValues: Record<string, any>) => {
  if (!value) return 'Username is required';
  if (value.length < 3) return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
  return null;
};

// Pass to DynamicForm
<DynamicForm
  schema={schema}
  callbacks={{
    validateUsername,
  }}
/>

// Reference in schema
{
  type: 'string',
  title: 'Username',
  ui: {
    validators: [
      {
        type: 'script',
        callback: 'validateUsername'  // Function name from callbacks registry
      }
    ]
  }
}
```

**Mode 2: Inline Script**

Provide a complete JavaScript function string for simple, one-off validation.

```typescript
{
  type: 'string',
  title: 'Confirm Password',
  ui: {
    validators: [
      {
        type: 'script',
        callback: {
          type: 'script',
          code: `function(value, formValues) {
            // value: current field value
            // formValues: entire form data object
            // Return null for valid, error message string for invalid
            
            if (value !== formValues.password) {
              return 'Passwords do not match';
            }
            return null;
          }`
        }
      }
    ]
  }
}
```

**Function signature:**

```typescript
(value: any, formValues: Record<string, any>) => string | null | Promise<string | null>
```

**Parameters:**
- `value`: Current field value
- `formValues`: Entire form data object

**Return value:**
- `null` → Validation passes
- `string` → Validation fails with the returned string as error message
- `Promise<string | null>` → Async validation is supported

**Complete example:**

```typescript
// Using callback registry (recommended)
const validatePassword = (value: any, formValues: Record<string, any>) => {
  if (!value) return 'Please confirm your password';
  if (value !== formValues.password) {
    return 'Passwords do not match';
  }
  return null;
};

const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    password: {
      type: 'string',
      title: 'Password',
      minLength: 6,
      ui: {
        widget: 'password',
      },
    },
    confirmPassword: {
      type: 'string',
      title: 'Confirm Password',
      ui: {
        widget: 'password',
        validators: [
          {
            type: 'script',
            callback: 'validatePassword'  // From callbacks registry
          },
        ],
      },
    },
    couponCode: {
      type: 'string',
      title: 'Coupon Code',
      ui: {
        validators: [
          {
            type: 'script',
            // Inline script for simple one-off validation
            callback: {
              type: 'script',
              code: `function(value, formValues) {
                // Async validation is supported
                if (!value) return null; // Optional field
                
                // Example: validate coupon format
                if (!/^[A-Z0-9]{6,10}$/.test(value)) {
                  return 'Invalid coupon format (6-10 uppercase letters/numbers)';
                }
                return null;
              }`
            }
          },
        ],
      },
    },
  },
};

<DynamicForm
  schema={schema}
  callbacks={{
    validatePassword,
  }}
/>
```

⚠️ **Security note**: 

- **Inline Script Mode** uses `Function` constructor to execute dynamic code. Only use it in trusted internal environments. Never accept script code from untrusted user input.
- **Function Name Mode** is safer as functions are explicitly registered in your code. Use this for production applications.

**Common use cases:**

| Scenario                                             | Recommended Approach                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| Password confirmation                                | ScriptValidator (inline or callback)              |
| Cross-field validation (e.g., end date > start date) | ScriptValidator (inline or callback)              |
| Complex business rules using form data               | ScriptValidator with callback                     |
| Format validation that can't be done with `pattern`  | ScriptValidator (inline or callback)              |
| Check username availability (server-side)            | ScriptValidator with async callback + API call    |
| Validate coupon code against database                | ScriptValidator with async callback + API call    |

**Example: Server-side validation with callback**

```typescript
// Define async validation function that calls your API
const checkUsernameAvailability = async (value: any) => {
  if (!value) return null;
  
  try {
    const response = await fetch('/api/check-username', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: value }),
    });
    
    const result = await response.json();
    return result.available ? null : 'Username is already taken';
  } catch (error) {
    return 'Failed to validate username';
  }
};

// Use in schema
{
  type: 'string',
  title: 'Username',
  ui: {
    validators: [
      {
        type: 'script',
        callback: 'checkUsernameAvailability'
      }
    ]
  }
}
```

---

### 3. Field Linkage

Field linkage enables dynamic form behavior where fields can automatically respond to changes in other fields' values. This is essential for creating interactive, context-aware forms.

#### Why Use Linkage?

Common use cases include:

- **Conditional Fields**: Show/hide fields based on other selections
- **Dynamic Options**: Update dropdown options based on parent field
- **Computed Values**: Calculate field values automatically
- **Contextual Validation**: Apply different validation rules based on context
- **UI State Control**: Enable/disable or make fields readonly dynamically

#### Linkage Types

DynamicForm supports 6 types of linkage:

**1. visibility** - Control field visibility

```typescript
{
  type: 'object',
  properties: {
    hasAddress: {
      type: 'boolean',
      title: 'Provide Address'
    },
    address: {
      type: 'string',
      title: 'Address',
      ui: {
        linkages: [{
          type: 'visibility',
          dependencies: ['#/properties/hasAddress'],
          when: {
            field: '#/properties/hasAddress',
            operator: '==',
            value: true
          },
          fulfill: { state: { visible: true } },
          otherwise: { state: { visible: false } }
        }]
      }
    }
  }
}
```

**2. disabled** - Control field disabled state

```typescript
{
  agreed: {
    type: 'boolean',
    title: 'I agree to terms'
  },
  submitButton: {
    type: 'string',
    title: 'Submit',
    ui: {
      linkages: [{
        type: 'disabled',
        dependencies: ['#/properties/agreed'],
        when: {
          field: '#/properties/agreed',
          operator: '==',
          value: false
        },
        fulfill: { state: { disabled: true } },
        otherwise: { state: { disabled: false } }
      }]
    }
  }
}
```

**3. readonly** - Control field readonly state

```typescript
{
  isEditing: {
    type: 'boolean',
    title: 'Enable Editing'
  },
  userName: {
    type: 'string',
    title: 'User Name',
    ui: {
      linkages: [{
        type: 'readonly',
        dependencies: ['#/properties/isEditing'],
        when: {
          field: '#/properties/isEditing',
          operator: '==',
          value: false
        },
        fulfill: { state: { readonly: true } }
      }]
    }
  }
}
```

**4. value** - Computed field values

```typescript
const schema = {
  type: 'object',
  properties: {
    price: { type: 'number', title: 'Price' },
    quantity: { type: 'number', title: 'Quantity' },
    total: {
      type: 'number',
      title: 'Total',
      ui: {
        readonly: true,
        linkages: [{
          type: 'value',
          dependencies: ['#/properties/price', '#/properties/quantity'],
          fulfill: { function: 'calculateTotal' }
        }]
      }
    }
  }
};

const linkageFunctions = {
  calculateTotal: (formData: any) => {
    return (formData.price || 0) * (formData.quantity || 0);
  }
};

<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
  onSubmit={handleSubmit}
/>
```

**5. options** - Dynamic dropdown options

Options linkage supports both static and dynamic (function-based) configurations.

**Using Functions (Dynamic):**

```typescript
const schema = {
  type: 'object',
  properties: {
    country: {
      type: 'string',
      title: 'Country',
      enum: ['china', 'usa'],
      enumNames: ['China', 'USA'],
    },
    province: {
      type: 'string',
      title: 'Province/State',
      ui: {
        linkages: [
          {
            type: 'options',
            dependencies: ['#/properties/country'],
            fulfill: { function: 'getProvinceOptions' },
          },
        ],
      },
    },
  },
}

const linkageFunctions = {
  getProvinceOptions: (formData: any) => {
    if (formData.country === 'china') {
      return [
        { label: 'Beijing', value: 'beijing' },
        { label: 'Shanghai', value: 'shanghai' },
      ]
    } else if (formData.country === 'usa') {
      return [
        { label: 'California', value: 'ca' },
        { label: 'New York', value: 'ny' },
      ]
    }
    return []
  },
}
```

**Using Static Values:**

```typescript
{
  category: {
    type: 'string',
    title: 'Category',
    enum: ['electronics', 'books']
  },
  subcategory: {
    type: 'string',
    title: 'Subcategory',
    ui: {
      linkages: [{
        type: 'options',
        dependencies: ['#/properties/category'],
        when: {
          field: '#/properties/category',
          operator: '==',
          value: 'electronics'
        },
        fulfill: {
          options: [
            { label: 'Laptop', value: 'laptop' },
            { label: 'Phone', value: 'phone' }
          ]
        },
        otherwise: {
          options: [
            { label: 'Fiction', value: 'fiction' },
            { label: 'Non-Fiction', value: 'nonfiction' }
          ]
        }
      }]
    }
  }
}
```

**Automatic Value Cleanup:**

When options change, DynamicForm automatically clears the field value if it's no longer valid in the new options list. This ensures data integrity:

```typescript
// Example: User selects category='electronics' and subcategory='laptop'
// Then changes category to 'books'
// → subcategory is automatically cleared (laptop not in books options)
```

**6. schema** - Dynamic schema switching

> **Note**: Schema linkage works on all field types (string, number, boolean, object, array). It allows you to dynamically change validation rules, UI configuration, or the entire schema structure based on other field values.

Dynamically change nested form structure based on field values:

```typescript
const userSchemas = {
  personal: {
    type: 'object',
    properties: {
      firstName: { type: 'string', title: 'First Name' },
      lastName: { type: 'string', title: 'Last Name' },
    },
  },
  company: {
    type: 'object',
    properties: {
      companyName: { type: 'string', title: 'Company Name' },
      taxId: { type: 'string', title: 'Tax ID' },
    },
  },
}

const schema = {
  type: 'object',
  properties: {
    userType: {
      type: 'string',
      title: 'User Type',
      enum: ['personal', 'company'],
      enumNames: ['Personal', 'Company'],
    },
    details: {
      type: 'object',
      title: 'Details',
      ui: {
        widget: 'nested-form',
        linkages: [
          {
            type: 'schema',
            dependencies: ['userType'],
            fulfill: { function: 'loadUserSchema' },
          },
        ],
      },
    },
  },
}

const linkageFunctions = {
  loadUserSchema: (formData: any) => {
    return userSchemas[formData.userType] || { type: 'object', properties: {} }
  },
}
```

**Effective Schema After Linkage:**

The `schema` linkage performs a **selective merge** — it only replaces `properties` and validation-related fields (`required`, `if/then/else`, `allOf`, etc.) from the dynamic schema. The original field's `title`, `type`, and `ui` configuration (including `linkages`) are always preserved.

When `userType = 'personal'`, the effective schema for `details` becomes:

```typescript
// Effective structure when userType = 'personal'
{
  type: 'object',
  properties: {
    userType: {
      type: 'string',
      title: 'User Type',
      enum: ['personal', 'company'],
      enumNames: ['Personal', 'Company']
    },
    details: {
      type: 'object',
      title: 'Details',           // preserved from original schema
      ui: {                        // preserved from original schema
        widget: 'nested-form',
        linkages: [{ type: 'schema', dependencies: ['userType'], fulfill: { function: 'loadUserSchema' } }]
      },
      // replaced by userSchemas.personal:
      properties: {
        firstName: { type: 'string', title: 'First Name' },
        lastName: { type: 'string', title: 'Last Name' }
      }
    }
  }
}
```

When `userType = 'company'`, the equivalent structure is:

```typescript
// Effective structure when userType = 'company'
{
  type: 'object',
  properties: {
    userType: {
      type: 'string',
      title: 'User Type',
      enum: ['personal', 'company'],
      enumNames: ['Personal', 'Company']
    },
    details: {
      type: 'object',
      title: 'Details',           // preserved from original schema
      ui: {                        // preserved from original schema
        widget: 'nested-form',
        linkages: [{ type: 'schema', dependencies: ['userType'], fulfill: { function: 'loadUserSchema' } }]
      },
      // replaced by userSchemas.company:
      properties: {
        companyName: { type: 'string', title: 'Company Name' },
        taxId: { type: 'string', title: 'Tax ID' }
      }
    }
  }
}
```

**Complete Component Usage:**

```typescript
<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
  onSubmit={handleSubmit}
/>
```

**Submitted Data Structure:**

```typescript
// When userType = 'personal':
{ userType: 'personal', details: { firstName: 'John', lastName: 'Doe' } }

// When userType = 'company':
{ userType: 'company', details: { companyName: 'Acme Inc', taxId: '123456789' } }
```

**Schema Linkage for Primitive Fields:**

Schema linkage also works on primitive field types (string, number, boolean) to dynamically change validation rules or UI configuration.

**Example 1 — Dynamic validation rules:**

```typescript
// Change validation pattern based on document type
const schema = {
  type: 'object',
  properties: {
    documentType: {
      type: 'string',
      title: 'Document Type',
      enum: ['passport', 'id_card', 'license'],
      enumNames: ['Passport', 'ID Card', 'Driver License'],
    },
    documentNumber: {
      type: 'string',
      title: 'Document Number',
      ui: {
        linkages: [
          {
            type: 'schema',
            dependencies: ['#/properties/documentType'],
            fulfill: { function: 'getDocumentValidation' },
          },
        ],
      },
    },
  },
};

const linkageFunctions = {
  getDocumentValidation: (context: any) => {
    const { documentType } = context.formData;
    
    // Return different validation rules based on document type
    if (documentType === 'passport') {
      return {
        pattern: '^[A-Z]{2}[0-9]{7}$',
        minLength: 9,
        maxLength: 9,
        ui: { placeholder: 'e.g., AB1234567' },
      };
    }
    
    if (documentType === 'id_card') {
      return {
        pattern: '^[0-9]{9}$',
        minLength: 9,
        maxLength: 9,
        ui: { placeholder: 'e.g., 123456789' },
      };
    }
    
    if (documentType === 'license') {
      return {
        pattern: '^[A-Z]{1}[0-9]{8}$',
        minLength: 9,
        maxLength: 9,
        ui: { placeholder: 'e.g., D12345678' },
      };
    }
    
    return {};
  },
};
```

**Example 2 — Dynamic widget:**

```typescript
// Change widget based on input type
const schema = {
  type: 'object',
  properties: {
    inputType: {
      type: 'string',
      title: 'Input Type',
      enum: ['short', 'long', 'formatted'],
      enumNames: ['Short Text', 'Long Text', 'Formatted Text'],
    },
    content: {
      type: 'string',
      title: 'Content',
      ui: {
        linkages: [
          {
            type: 'schema',
            dependencies: ['#/properties/inputType'],
            fulfill: { function: 'getContentWidget' },
          },
        ],
      },
    },
  },
};

const linkageFunctions = {
  getContentWidget: (context: any) => {
    const { inputType } = context.formData;
    
    if (inputType === 'short') {
      return {
        ui: { widget: 'input', placeholder: 'Enter short text' },
        maxLength: 100,
      };
    }
    
    if (inputType === 'long') {
      return {
        ui: { widget: 'textarea', placeholder: 'Enter long text' },
        maxLength: 1000,
      };
    }
    
    if (inputType === 'formatted') {
      return {
        ui: { widget: 'markdown', placeholder: 'Enter markdown text' },
      };
    }
    
    return {};
  },
};
```

#### Multiple Linkages of the Same Type

A single field can have multiple linkage configs of the same type in its `linkages` array. When multiple configs of the same type produce results, they are merged using the following strategy (derived from `evaluateLinkagesByLayers`):

| Linkage Type | Merge Strategy                                                                      | Example                                                    |
| ------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `visibility` | **AND** — field is visible only if **all** configs resolve to `visible: true`       | Two visibility rules: both must pass for the field to show |
| `disabled`   | **OR** — field is disabled if **any** config resolves to `disabled: true`           | Two disabled rules: either one disabling is enough         |
| `readonly`   | **OR** — field is readonly if **any** config resolves to `readonly: true`           | Two readonly rules: either one is enough                   |
| `value`      | **Last wins** — the last config (by definition order) that produces a value takes effect | Useful for fallback chaining                               |
| `options`    | **Last wins** — the last config (by definition order) that produces options takes effect | Useful for fallback chaining                               |
| `schema`     | **Shallow merge** — later configs' schema properties override earlier ones          | `{ ...schema1, ...schema2 }`                               |

**Example — `visibility` AND logic:**

```typescript
// Field is shown only when BOTH conditions are true
ui: {
  linkages: [
    {
      type: 'visibility',
      dependencies: ['#/properties/isLoggedIn'],
      when: { field: '#/properties/isLoggedIn', operator: '==', value: true },
      fulfill: { state: { visible: true } },
      otherwise: { state: { visible: false } },
    },
    {
      type: 'visibility',
      dependencies: ['#/properties/role'],
      when: { field: '#/properties/role', operator: '==', value: 'admin' },
      fulfill: { state: { visible: true } },
      otherwise: { state: { visible: false } },
    },
  ]
}
// → visible only when isLoggedIn === true AND role === 'admin'
```

**Example — `disabled` OR logic:**

```typescript
// Field is disabled if EITHER condition is true
ui: {
  linkages: [
    {
      type: 'disabled',
      dependencies: ['#/properties/isReadonlyMode'],
      when: {
        field: '#/properties/isReadonlyMode',
        operator: '==',
        value: true,
      },
      fulfill: { state: { disabled: true } },
      otherwise: { state: { disabled: false } },
    },
    {
      type: 'disabled',
      dependencies: ['#/properties/userRole'],
      when: { field: '#/properties/userRole', operator: '==', value: 'guest' },
      fulfill: { state: { disabled: true } },
      otherwise: { state: { disabled: false } },
    },
  ]
}
// → disabled when isReadonlyMode === true OR userRole === 'guest'
```

**Async Linkages and Execution Order:**

When multiple linkage configs of the same type use **async linkage functions** (functions that return Promises), they execute **concurrently for performance**. However, the final result is **guaranteed to strictly follow the definition order** (array index order).

**Behavior guarantee:**

- For `value`, `options`, and `schema` types: The **last defined** linkage in the array always wins, regardless of which async function resolves first
- For `visibility`, `disabled`, and `readonly` types: The merge strategy (AND/OR) applies as documented in the table above
- **Mixed sync/async linkages**: The result still strictly follows array order — the last defined linkage wins, whether it's synchronous or asynchronous

**Example:**

```typescript
const schema = {
  type: 'object',
  properties: {
    price: {
      type: 'number',
      title: 'Price',
      ui: {
        linkages: [
          {
            type: 'value',
            dependencies: ['country'],
            fulfill: { function: 'fetchPriceFromAPI1' },
          }, // async, returns 100
          {
            type: 'value',
            dependencies: ['country'],
            fulfill: { function: 'fetchPriceFromAPI2' },
          }, // async, returns 200
          {
            type: 'value',
            dependencies: ['country'],
            fulfill: { function: 'fetchPriceFromAPI3' },
          }, // async, returns 300
        ],
      },
    },
  },
}

// Result: price = 300 (always the last defined linkage, regardless of which completes first)
```

#### Static vs Dynamic Linkage

Linkage effects can be configured in two ways:

**Static Linkage** - Direct value assignment:

```typescript
fulfill: {
  state: { visible: true },
  options: [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' }
  ]
}
```

**Dynamic Linkage** - Function-based computation:

```typescript
fulfill: {
  function: 'myLinkageFunction'
}

// Register the function
const linkageFunctions = {
  myLinkageFunction: (formData: any) => {
    // Compute and return the result
    return calculatedValue;
  }
};
```

Use static linkage for simple, predetermined values. Use dynamic linkage when the result depends on complex logic or multiple field values.

**Async Linkage Functions:**

Linkage functions can be asynchronous, which is useful for fetching data from APIs:

```typescript
const linkageFunctions = {
  // Async function to load options from API
  loadCityOptions: async (formData: any) => {
    const countryId = formData.country
    if (!countryId) return []

    const response = await fetch(`/api/cities?country=${countryId}`)
    const cities = await response.json()

    return cities.map((city: any) => ({
      label: city.name,
      value: city.id,
    }))
  },

  // Async function to validate and compute value
  calculateShipping: async (formData: any) => {
    const { weight, destination } = formData
    if (!weight || !destination) return 0

    const response = await fetch('/api/calculate-shipping', {
      method: 'POST',
      body: JSON.stringify({ weight, destination }),
    })
    const { cost } = await response.json()

    return cost
  },
}

const schema = {
  type: 'object',
  properties: {
    country: {
      type: 'string',
      title: 'Country',
    },
    city: {
      type: 'string',
      title: 'City',
      ui: {
        linkages: [
          {
            type: 'options',
            dependencies: ['#/properties/country'],
            fulfill: { function: 'loadCityOptions' },
          },
        ],
      },
    },
  },
}
```

**Important:** Async functions are automatically handled - just return a Promise or use `async/await`.

#### Linkage Conditions

Control when linkage effects are applied using the `when`/`fulfill`/`otherwise` pattern:

```typescript
{
  ui: {
    linkages: [
      {
        type: 'visibility',
        dependencies: ['#/properties/userType'],
        when: {
          field: '#/properties/userType',
          operator: '==',
          value: 'premium',
        },
        fulfill: {
          state: { visible: true },
        },
        otherwise: {
          state: { visible: false },
        },
      },
    ]
  }
}
```

**Supported Operators:**

- `==` - Equal (strict equality)
- `!=` - Not equal
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `in` - Value in array (checks if fieldValue is in compareValue array)
- `notIn` - Value not in array
- `includes` - Array includes value (checks if fieldValue array includes compareValue)
- `notIncludes` - Array not includes value
- `isEmpty` - Field is empty (null, undefined, '', or empty array)
- `isNotEmpty` - Field has a value

**Without `when` condition**, the `fulfill` effect is always applied.

#### Linkage Dependencies

Declare which fields the linkage depends on using JSON Pointer format:

```typescript
{
  ui: {
    linkages: [
      {
        type: 'value',
        dependencies: [
          '#/properties/price', // Top-level field
          '#/properties/address/city', // Nested object field
          '#/properties/items', // Entire array (to react to any item change)
        ],
        fulfill: { function: 'calculate' },
      },
    ]
  }
}
```

**Rules:**

- Use `#/properties/` prefix for top-level fields
- Use `/` for nested paths
- Dependencies determine when linkage recalculates
- Empty dependencies array means linkage runs only on initial load
- **When depending on array data, always reference the array field itself** (`#/properties/items`), not individual items. Any change to array contents (e.g. `items.0.price`) will automatically trigger dependencies on the parent array path. Use a linkage function to access specific item values from `formData`.

---

### 4. UI Configuration

Configure field appearance, behavior, and layout using the `ui` field.

#### Widget Selection

**Built-in Widgets:**

DynamicForm automatically selects appropriate widgets based on field type, but you can override this:

| Widget          | Field Type          | Description                       |
| --------------- | ------------------- | --------------------------------- |
| `text`          | string              | Single-line text input            |
| `textarea`      | string              | Multi-line text input             |
| `password`      | string              | Password input                    |
| `email`         | string              | Email input                       |
| `number`        | number/integer      | Number input                      |
| `select`        | string/number/array | Dropdown select                   |
| `radio`         | string/number       | Radio buttons                     |
| `checkboxes`    | array               | Multiple checkboxes               |
| `checkbox`      | boolean             | Single checkbox                   |
| `switch`        | boolean             | Toggle switch                     |
| `date`          | string              | Date picker                       |
| `nested-form`   | object              | Nested form (auto for objects)    |
| `array`         | array               | Array widget (auto for arrays)    |
| `code-editor`   | string              | Code editor with syntax highlight |
| `object-editor` | object              | JSON object editor                |

**Example:**

```typescript
{
  type: 'string',
  title: 'Bio',
  ui: {
    widget: 'textarea'  // Override default 'text' widget
  }
}
```

**Custom Widgets:**

Register custom widgets to extend DynamicForm's capabilities:

```typescript
import { CustomInputWidget } from './widgets/CustomInputWidget';

<DynamicForm
  schema={schema}
  widgets={{
    'custom-input': CustomInputWidget,
    'advanced-select': AdvancedSelectWidget
  }}
  onSubmit={handleSubmit}
/>

// Use in schema
{
  type: 'string',
  title: 'Custom Field',
  ui: {
    widget: 'custom-input'
  }
}
```

**Widget Callbacks:**

Use `callbacks` + `ui.callbackProps` to pass runtime functions to widgets (e.g., upload handlers, search handlers). Function names in the schema are resolved at render time from the `callbacks` registry.

```typescript
const schema = {
  type: 'object',
  properties: {
    avatar: {
      type: 'string',
      title: 'Avatar',
      ui: {
        widget: 'upload',
        callbackProps: { onUpload: 'handleAvatarUpload' }, // function name reference
        widgetProps: { accept: 'image/*' }                 // plain data props
      }
    },
    resume: {
      type: 'string',
      title: 'Resume',
      ui: {
        widget: 'upload',
        callbackProps: { onUpload: 'handleResumeUpload' }
      }
    }
  }
};

function MyForm() {
  // ✅ 必须用 useMemo 稳定引用，否则每次渲染都创建新对象，
  //    导致 CallbacksContext 持续触发所有 Widget 重渲染
  const callbacks = useMemo(() => ({
    handleAvatarUpload: async (file: File) => {
      const url = await uploadAvatarAPI(file);
      return url;
    },
    handleResumeUpload: async (file: File) => {
      const url = await uploadResumeAPI(file);
      return url;
    }
  }), []); // 若函数依赖外部状态，将其加入依赖数组

  return (
    <DynamicForm
      schema={schema}
      callbacks={callbacks}
      widgets={{ upload: UploadWidget }}
      onSubmit={handleSubmit}
    />
  );
}
```

**Rules:**

- `callbackProps` keys override same-named keys in `widgetProps`
- If a function name in `callbackProps` is not found in `callbacks`, it is silently skipped (with a dev warning)
- The `callbacks` registry is shared across all fields; each field selects its own functions via `callbackProps`

````

#### Layout Configuration

Control form layout at global or field level:

**Global Layout:**
```typescript
<DynamicForm
  schema={schema}
  layout="horizontal"
  labelWidth={120}
  onSubmit={handleSubmit}
/>
````

**Field-Level Override:**

```typescript
{
  type: 'string',
  title: 'Email',
  ui: {
    layout: 'horizontal',  // Override global layout
    labelWidth: 150         // Custom label width for this field
  }
}
```

**Layout Options:**

- `vertical` - Label above input (default)
- `horizontal` - Label beside input
- `inline` - Compact inline layout

#### Field Path Flattening

Simplify deeply nested parameter display while maintaining data structure:

```typescript
{
  type: 'object',
  properties: {
    auth: {
      type: 'object',
      title: 'Authentication',
      ui: {
        flattenPath: true,      // Flatten this level
        flattenPrefix: true     // Add parent title as prefix
      },
      properties: {
        content: {
          type: 'object',
          ui: { flattenPath: true },
          properties: {
            apiKey: {
              type: 'string',
              title: 'API Key'
            }
          }
        }
      }
    }
  }
}
```

**Result:**

- Display: "Authentication - API Key" (flattened)
- Submit: `{ auth: { content: { apiKey: 'xxx' } } }` (nested)

#### Other UI Options

Additional UI customization options:

```typescript
{
  type: 'string',
  title: 'Email',
  ui: {
    placeholder: 'Enter your email',     // Input placeholder
    help: 'We will never share your email', // Help text below field
    className: 'custom-field',           // Custom CSS class
    disabled: false,                     // Disable field
    readonly: false,                     // Make field readonly
    hidden: false                        // Hide field
  }
}
```

**All UI Options:**

| Option          | Type      | Description                                                                        |
| --------------- | --------- | ---------------------------------------------------------------------------------- |
| `widget`        | `string`  | Widget type                                                                        |
| `placeholder`   | `string`  | Input placeholder text                                                             |
| `help`          | `string`  | Help text below field                                                              |
| `className`     | `string`  | Custom CSS class                                                                   |
| `disabled`      | `boolean` | Disable field                                                                      |
| `readonly`      | `boolean` | Make field readonly                                                                |
| `hidden`        | `boolean` | Hide field                                                                         |
| `layout`        | `string`  | Layout override                                                                    |
| `labelWidth`    | `number`  | Label width (horizontal layout)                                                    |
| `linkages`      | `array`   | Field linkage configurations                                                       |
| `flattenPath`   | `boolean` | Flatten nested path                                                                |
| `flattenPrefix` | `boolean` | Add parent title as prefix                                                         |
| `errorMessages` | `object`  | Custom error messages                                                              |
| `widgetProps`   | `object`  | Props passed to widget component                                                   |
| `callbackProps` | `object`  | Callback function references (key=prop name, value=function name from `callbacks`) |
| `transform`     | `object`  | Value transform config (see below)                                                 |

#### Value Transform (`ui.transform`)

Use `ui.transform` when a field needs to accept input in one domain (e.g. percentage) but store a different value (e.g. decimal). The conversion is transparent to external callers.

**Value domain contract:**

| Boundary                                 | Domain                                  |
| ---------------------------------------- | --------------------------------------- |
| `setValues` / `setValue` input           | Stored domain                           |
| `getValues` / `getValue` output          | Stored domain                           |
| `onChange` / `onSubmit` callback         | Stored domain                           |
| `schema.default` / `schema.maximum` etc. | Input domain (the value the user types) |
| Form internal state                      | Input domain                            |

**Configuration:**

The `callback` and `reverseCallback` support two forms:

**Form 1: Function name reference** (recommended for reusability)

```typescript
ui: {
  transform: {
    callback: string          // function name from the `callbacks` registry
                              // signature: (inputValue: any) => storedValue
    reverseCallback?: string  // reverse function name
                              // signature: (storedValue: any) => inputValue
  }
}
```

**Form 2: Inline JavaScript code** (for simple one-off transforms)

```typescript
ui: {
  transform: {
    callback: {
      type: 'script',
      code: string            // JavaScript expression, e.g. 'return value / 100'
                              // receives `value` parameter, must return transformed value
    },
    reverseCallback?: {
      type: 'script',
      code: string            // JavaScript expression for reverse transform
    }
  }
}
```

**Which form to use:**

- Use **function name reference** when the transform logic is reused across multiple fields, or requires external dependencies
- Use **inline JavaScript** for simple, self-contained transforms that are field-specific

⚠️ **Security note**: Inline JavaScript uses `Function` constructor and should only be used with trusted code sources. Never accept inline scripts from untrusted user input.

**When to provide `reverseCallback`:**

There are two types of transforms, each with different `reverseCallback` requirements:

**Type 1 — Reversible transform** (e.g. percentage ↔ decimal): `reverseCallback` is **strongly recommended**. Without it, `setValues({ rate: 0.96 })` cannot convert the stored value back to `96` for display — the raw stored value will appear in the input instead.

```typescript
// ✅ Reversible: provide reverseCallback
transform: {
  callback: 'percentToDecimal',       // 96 → 0.96
  reverseCallback: 'decimalToPercent', // 0.96 → 96
}
```

**Type 2 — Irreversible transform** (e.g. normalise currency text to a canonical code): `reverseCallback` **cannot** be provided because the conversion is one-way. This is fine because the stored value itself is a valid input value (idempotent: `callback("HKD") === "HKD"`), so `setValues({ currency: 'HKD' })` writes `"HKD"` directly to the input, which is correct.

```typescript
// ✅ Irreversible: omit reverseCallback by design
transform: {
  callback: 'normalizeCurrency', // "HK$" | "HK dollar" | "HKD" → "HKD"
}
```

**Example — percentage input stored as decimal:**

```typescript
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    rate: {
      type: 'number',
      title: 'Interest Rate',
      default: 50,     // input domain: user sees 50 initially
      maximum: 100,    // input domain: validation checks against 50–100
      ui: {
        widget: 'number',
        placeholder: 'Enter percentage, e.g. 96',
        transform: {
          callback: 'percentToDecimal',
          reverseCallback: 'decimalToPercent',
        },
      },
    },
  },
};

<DynamicForm
  schema={schema}
  callbacks={{
    percentToDecimal: (val: number) => val / 100,
    decimalToPercent: (val: number) => val * 100,
  }}
  onSubmit={(data) => {
    console.log(data.rate); // 0.96 — stored domain
  }}
/>
```

**Alternative: Using inline JavaScript** (for field-specific transforms)

```typescript
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    rate: {
      type: 'number',
      title: 'Interest Rate',
      default: 50,
      maximum: 100,
      ui: {
        widget: 'number',
        placeholder: 'Enter percentage, e.g. 96',
        transform: {
          // Inline JavaScript code - no callbacks registry needed
          callback: {
            type: 'script',
            code: 'return value / 100',  // value parameter is automatically provided
          },
          reverseCallback: {
            type: 'script',
            code: 'return value * 100',
          },
        },
      },
    },
  },
};

<DynamicForm
  schema={schema}
  // No callbacks prop needed for inline transforms
  onSubmit={(data) => {
    console.log(data.rate); // 0.96 — stored domain
  }}
/>
```

**Behavior at runtime:**

- The input always shows the input-domain value the user typed (e.g. `96`).
- A "Converted value: 0.96" hint is shown below the input in real time.
- All validation rules (`minimum`, `maximum`, `pattern`, custom `validate`) run against the input value.
- `setValues({ rate: 0.96 })` calls `reverseCallback(0.96)` = `96` before writing to the input.
- `getValues()` and `onSubmit` always return the stored-domain value (`0.96`).

---

## Advanced Features

#### Field Visibility

```typescript
{
  type: 'object',
  properties: {
    hasAddress: {
      type: 'boolean',
      title: 'Provide Address'
    },
    address: {
      type: 'string',
      title: 'Address',
      ui: {
        linkages: [
          {
            type: 'visibility',
            dependencies: ['#/properties/hasAddress'],
            when: {
              field: '#/properties/hasAddress',
              operator: '==',
              value: true
            },
            fulfill: {
              state: { visible: true }
            },
            otherwise: {
              state: { visible: false }
            }
          }
        ]
      }
    }
  }
}
```

#### Computed Values

```typescript
const schema = {
  type: 'object',
  properties: {
    price: {
      type: 'number',
      title: 'Price'
    },
    quantity: {
      type: 'number',
      title: 'Quantity'
    },
    total: {
      type: 'number',
      title: 'Total',
      ui: {
        readonly: true,
        linkages: [
          {
            type: 'value',
            dependencies: ['#/properties/price', '#/properties/quantity'],
            fulfill: {
              function: 'calculateTotal'
            }
          }
        ]
      }
    }
  }
};

const linkageFunctions = {
  calculateTotal: (formData: any) => {
    return (formData.price || 0) * (formData.quantity || 0);
  }
};

<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
  onSubmit={handleSubmit}
/>
```

#### Dynamic Options

**Using Functions (Dynamic):**

```typescript
const schema = {
  type: 'object',
  properties: {
    country: {
      type: 'string',
      title: 'Country',
      enum: ['china', 'usa'],
      enumNames: ['China', 'USA'],
    },
    province: {
      type: 'string',
      title: 'Province/State',
      ui: {
        linkages: [
          {
            type: 'options',
            dependencies: ['#/properties/country'],
            fulfill: {
              function: 'getProvinceOptions',
            },
          },
        ],
      },
    },
  },
}

const linkageFunctions = {
  getProvinceOptions: (formData: any) => {
    if (formData.country === 'china') {
      return [
        { label: 'Beijing', value: 'beijing' },
        { label: 'Shanghai', value: 'shanghai' },
      ]
    } else if (formData.country === 'usa') {
      return [
        { label: 'California', value: 'ca' },
        { label: 'New York', value: 'ny' },
      ]
    }
    return []
  },
}
```

**Using Static Values:**

You can also set options directly without using functions:

```typescript
const schema = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      title: 'Category',
      enum: ['electronics', 'books'],
      enumNames: ['Electronics', 'Books'],
    },
    subcategory: {
      type: 'string',
      title: 'Subcategory',
      ui: {
        linkages: [
          {
            type: 'options',
            dependencies: ['#/properties/category'],
            when: {
              field: '#/properties/category',
              operator: '==',
              value: 'electronics',
            },
            fulfill: {
              options: [
                { label: 'Laptop', value: 'laptop' },
                { label: 'Phone', value: 'phone' },
              ],
            },
            otherwise: {
              options: [
                { label: 'Fiction', value: 'fiction' },
                { label: 'Non-Fiction', value: 'nonfiction' },
              ],
            },
          },
        ],
      },
    },
  },
}
```

**Automatic Value Cleanup:**

When options change, the form automatically clears the field value if it's no longer in the new options list. This ensures data validity:

```typescript
// If user selects category='electronics' and subcategory='laptop',
// then changes category to 'books', the subcategory field will be
// automatically cleared since 'laptop' is not in the books options.
```

### Nested Forms

#### Static Nested Forms

```typescript
const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: 'Name',
    },
    address: {
      type: 'object',
      title: 'Address',
      properties: {
        street: { type: 'string', title: 'Street' },
        city: { type: 'string', title: 'City' },
        zipCode: { type: 'string', title: 'Zip Code' },
      },
      required: ['city'],
    },
  },
}
```

#### Dynamic Nested Forms

Switch between different schemas based on field values using linkages:

```typescript
// Define schemas for different user types
const userSchemas = {
  personal: {
    type: 'object',
    properties: {
      firstName: { type: 'string', title: 'First Name' },
      lastName: { type: 'string', title: 'Last Name' },
    },
  },
  company: {
    type: 'object',
    properties: {
      companyName: { type: 'string', title: 'Company Name' },
      taxId: { type: 'string', title: 'Tax ID' },
    },
  },
};

// Define linkage function to load schema
const linkageFunctions = {
  loadUserSchema: (formData: Record<string, any>) => {
    const userType = formData?.userType;
    return userSchemas[userType] || { type: 'object', properties: {} };
  },
};

const schema = {
  type: 'object',
  properties: {
    userType: {
      type: 'string',
      title: 'User Type',
      enum: ['personal', 'company'],
      enumNames: ['Personal', 'Company'],
    },
    details: {
      type: 'object',
      title: 'Details',
      ui: {
        widget: 'nested-form',
        linkages: [
          {
            type: 'schema',
            dependencies: ['userType'],
            when: { field: 'userType', operator: 'isNotEmpty' },
            fulfill: { function: 'loadUserSchema' },
          }
        ],
      },
    },
  },
};

// Use in component
<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
  onSubmit={handleSubmit}
/>
```

### Field Path Flattening

Simplify deeply nested parameter display:

```typescript
const schema = {
  type: 'object',
  properties: {
    auth: {
      type: 'object',
      title: 'Authentication',
      ui: {
        flattenPath: true,
        flattenPrefix: true,
      },
      properties: {
        content: {
          type: 'object',
          ui: {
            flattenPath: true,
          },
          properties: {
            apiKey: {
              type: 'string',
              title: 'API Key',
            },
          },
        },
      },
    },
  },
}
// Display: "Authentication - API Key"
// Submit: { auth: { content: { apiKey: 'xxx' } } }
```

---

## API Reference

### DynamicForm Props

| Prop               | Type                                            | Required | Default      | Description                                                      |
| ------------------ | ----------------------------------------------- | -------- | ------------ | ---------------------------------------------------------------- |
| `schema`           | `ExtendedJSONSchema`                            | Yes      | -            | JSON Schema definition                                           |
| `defaultValues`    | `Record<string, any>`                           | No       | `{}`         | Initial form values                                              |
| `onSubmit`         | `(data: any) => void \| Promise<void>`          | No       | -            | Submit handler                                                   |
| `onChange`         | `(data: any) => void`                           | No       | -            | Change handler                                                   |
| `widgets`          | `Record<string, ComponentType>`                 | No       | `{}`         | Custom widgets                                                   |
| `linkageFunctions` | `Record<string, Function>`                      | No       | `{}`         | Linkage functions                                                |
| `callbacks`        | `Record<string, Function>`                      | No       | `{}`         | Widget callback function registry (used with `ui.callbackProps`) |
| `customFormats`    | `Record<string, Function>`                      | No       | `{}`         | Custom format validators                                         |
| `layout`           | `'vertical' \| 'horizontal' \| 'inline'`        | No       | `'vertical'` | Form layout                                                      |
| `labelWidth`       | `number \| string`                              | No       | -            | Label width (horizontal layout)                                  |
| `showSubmitButton` | `boolean`                                       | No       | `true`       | Show submit button                                               |
| `renderAsForm`     | `boolean`                                       | No       | `true`       | Render as `<form>` tag                                           |
| `validateMode`     | `'onSubmit' \| 'onBlur' \| 'onChange' \| 'all'` | No       | `'onSubmit'` | Validation mode                                                  |
| `loading`          | `boolean`                                       | No       | `false`      | Loading state                                                    |
| `disabled`         | `boolean`                                       | No       | `false`      | Disable all fields                                               |
| `readonly`         | `boolean`                                       | No       | `false`      | Make all fields readonly                                         |
| `className`        | `string`                                        | No       | -            | CSS class name                                                   |
| `style`            | `React.CSSProperties`                           | No       | -            | Inline styles                                                    |

### DynamicFormRef Methods

DynamicForm exposes several methods via ref that allow you to programmatically control the form:

#### Basic Methods

| Method      | Signature                                                          | Description                                                                   |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `setValue`  | `(name: string, value: any, options?: SetValueOptions) => void`    | Set a single field value                                                      |
| `getValue`  | `(name: string) => any`                                            | Get a single field value by name                                              |
| `getValues` | `() => Record<string, any>`                                        | Get all form values as an object                                              |
| `setValues` | `(values: Record<string, any>, options?: SetValueOptions) => void` | Set multiple field values (supports nested objects and arrays)                |
| `reset`     | `(values?: Record<string, any>) => void`                           | Reset form; empty call clears all fields, with values resets to provided data |

**`setValue(name, value, options?)` - Set Field Value**

Set a single field value programmatically.

```typescript
const formRef = useRef<DynamicFormRef>(null)

// Set a simple field
formRef.current?.setValue('username', 'john_doe')

// Set with validation
formRef.current?.setValue('email', 'john@example.com', {
  shouldValidate: true, // Trigger validation
  shouldDirty: true, // Mark field as dirty
  shouldTouch: true, // Mark field as touched
})

// Set nested field
formRef.current?.setValue('address.city', 'Beijing')

// Set array element
formRef.current?.setValue('contacts.0.name', 'Alice')
```

**`getValue(name)` - Get Field Value**

Get a single field value by name.

```typescript
const username = formRef.current?.getValue('username')
const city = formRef.current?.getValue('address.city')
const firstContact = formRef.current?.getValue('contacts.0')
```

**`getValues()` - Get All Values**

Get all form values as an object.

```typescript
const allValues = formRef.current?.getValues()
console.log(allValues)
// { username: 'john_doe', email: 'john@example.com', address: { city: 'Beijing' } }
```

**`setValues(values, options?)` - Set Multiple Values**

Set multiple field values at once. Supports nested objects, deep nesting, and arrays.

```typescript
// 设置顶层字段
formRef.current?.setValues(
  {
    username: 'jane_doe',
    email: 'jane@example.com',
  },
  { shouldValidate: true }
)

// 设置嵌套对象（自动递归展开，确保嵌套表单子字段正确更新）
formRef.current?.setValues({
  address: {
    street: '123 Main St',
    city: 'Shanghai',
    zipCode: '200000',
  },
})

// 设置深层嵌套对象
formRef.current?.setValues({
  company: {
    companyName: 'Acme Inc',
    location: {
      country: 'China',
      city: 'Beijing',
    },
  },
})

// 设置数组（基本类型数组会自动包装为内部格式）
formRef.current?.setValues({
  tags: ['frontend', 'react', 'typescript'],
  contacts: [
    { contactName: 'Alice', phone: '123-4567' },
    { contactName: 'Bob', phone: '890-1234' },
  ],
})

// 混合设置：顶层 + 嵌套 + 数组
formRef.current?.setValues({
  username: 'john_doe',
  address: { street: '456 Oak Ave', city: 'Shenzhen' },
  tags: ['vue', 'angular'],
})
```

> **实现细节**：`setValues` 内部会：
>
> 1. 使用 `wrapPrimitiveArrays` 将基本类型数组（如 `string[]`）转换为 `useFieldArray` 所需的对象数组格式
> 2. 递归展开嵌套对象，对每一层级的路径都调用 `setValue`，确保嵌套表单（`NestedFormWidget`）内部的子 Controller 都能收到新值

**`reset(values?)` - Reset Form**

Reset form to default values or provided values. Supports nested objects and arrays.

```typescript
// 清空表单（所有字段重置为类型恰当的空值）
// string → '', array → [], object → 递归空对象, number/boolean → undefined
formRef.current?.reset()
formRef.current?.reset({})

// 用完整数据重置（支持嵌套对象和数组）
formRef.current?.reset({
  username: 'john_doe',
  email: 'john@example.com',
  address: {
    street: '123 Main St',
    city: 'Beijing',
  },
  tags: ['frontend', 'react'],
  contacts: [{ contactName: 'Alice', phone: '123-4567' }],
})
```

> **注意**：
>
> - `reset()` 或 `reset({})` 会根据 schema 结构为每个字段生成类型恰当的空值，确保 React 受控组件能正确清除显示值
> - `reset(values)` 会自动处理基本类型数组的包装，并递归设置嵌套对象的子路径，确保嵌套表单内的字段正确更新

#### Validation Methods

| Method         | Signature                                    | Description                                        |
| -------------- | -------------------------------------------- | -------------------------------------------------- |
| `validate`     | `(name?: string) => Promise<boolean>`        | Trigger validation for a field or entire form      |
| `getErrors`    | `() => Record<string, any>`                  | Get all validation errors                          |
| `clearErrors`  | `(name?: string) => void`                    | Clear validation errors for a field or entire form |
| `setError`     | `(name: string, error: ErrorOption) => void` | Set a validation error manually                    |
| `getFormState` | `() => FormState`                            | Get form state (isDirty, isValid, etc.)            |

**`validate(name?)` - Trigger Validation**

Trigger validation for a specific field, multiple fields, or the entire form.

```typescript
// Validate entire form
const isValid = await formRef.current?.validate()
if (isValid) {
  console.log('Form is valid')
}

// Validate specific field
const isEmailValid = await formRef.current?.validate('email')

// Validate multiple fields
const areFieldsValid = await formRef.current?.validate([
  'email',
  'username',
  'password',
])
if (areFieldsValid) {
  console.log('All specified fields are valid')
}
```

**`getErrors()` - Get Validation Errors**

Get all current validation errors.

```typescript
const errors = formRef.current?.getErrors()
console.log(errors)
// { email: { type: 'pattern', message: 'Invalid email format' } }
```

**`clearErrors(name?)` - Clear Errors**

Clear validation errors for a specific field, multiple fields, or entire form.

```typescript
// Clear specific field error
formRef.current?.clearErrors('email')

// Clear multiple fields' errors
formRef.current?.clearErrors(['email', 'username', 'password'])

// Clear all errors
formRef.current?.clearErrors()
```

**`setError(name, error)` - Set Error**

Manually set a validation error for a field. Useful for async validation, server-side validation, or custom business logic validation.

```typescript
// Basic usage: Set a manual error
formRef.current?.setError('username', {
  type: 'manual',
  message: 'This username is already taken',
})

// Async validation example: Check username availability
const handleCheckUsername = async () => {
  const username = formRef.current?.getValue('username')

  try {
    const response = await fetch(`/api/check-username?username=${username}`)
    const { available } = await response.json()

    if (!available) {
      formRef.current?.setError('username', {
        type: 'manual',
        message: 'This username is already taken',
      })
    } else {
      formRef.current?.clearErrors('username')
    }
  } catch (error) {
    formRef.current?.setError('username', {
      type: 'manual',
      message: 'Failed to check username availability',
    })
  }
}

// Server-side validation example: Handle API errors
const handleSubmit = async (data: any) => {
  try {
    await api.createUser(data)
  } catch (error: any) {
    // Set errors from server response
    if (error.response?.data?.errors) {
      Object.entries(error.response.data.errors).forEach(([field, message]) => {
        formRef.current?.setError(field, {
          type: 'server',
          message: message as string,
        })
      })
    }
  }
}

// Custom business logic validation
const handleValidatePassword = () => {
  const password = formRef.current?.getValue('password')
  const confirmPassword = formRef.current?.getValue('confirmPassword')

  if (password !== confirmPassword) {
    formRef.current?.setError('confirmPassword', {
      type: 'manual',
      message: 'Passwords do not match',
    })
  }
}
```

**`getFormState()` - Get Form State**

Get current form state information.

```typescript
const formState = formRef.current?.getFormState()
console.log(formState)
// {
//   isDirty: true,      // Has any field been modified
//   isValid: false,     // Are all fields valid
//   isSubmitting: false, // Is form currently submitting
//   isSubmitted: false,  // Has form been submitted
//   submitCount: 0       // Number of submit attempts
// }
```

#### Linkage Methods

| Method           | Signature             | Description                                |
| ---------------- | --------------------- | ------------------------------------------ |
| `refreshLinkage` | `() => Promise<void>` | Manually re-trigger linkage initialization |

**`refreshLinkage()` - Manual Linkage Refresh**

> **⚠️ IMPORTANT**: DynamicForm does **NOT** automatically execute linkage initialization on mount. You **MUST** manually call `refreshLinkage()` to trigger linkage calculations when:
>
> - The form is first mounted and has linkage configurations
> - Linkage functions depend on asynchronously loaded data
> - External state used by linkage functions changes

This method allows you to manually trigger all linkage calculations. Common use cases:

1. **Initial Linkage Trigger**: Call after form mount to initialize linkage states
2. **Async Data Loading**: Linkage functions depend on data loaded asynchronously (e.g., from APIs)
3. **External State Changes**: Data used by linkage functions is updated outside the form
4. **Dynamic Function Updates**: Linkage functions themselves are updated dynamically

**Usage Example with Async Data:**

```typescript
import React, { useRef, useState, useEffect } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { DynamicFormRef } from '@/components/DynamicForm';

function EmployeeForm() {
  const formRef = useRef<DynamicFormRef>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Load async data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [deptData, empData] = await Promise.all([
          fetchDepartments(),
          fetchEmployees(),
        ]);

        setDepartments(deptData);
        setEmployees(empData);

        // Refresh linkage after data is loaded
        await formRef.current?.refreshLinkage();
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const schema = {
    type: 'object',
    properties: {
      department: {
        type: 'string',
        title: 'Department',
        ui: {
          linkages: [
            {
              type: 'options',
              dependencies: [],
              fulfill: { function: 'getDepartmentOptions' }
            }
          ]
        }
      },
      employee: {
        type: 'string',
        title: 'Employee',
        ui: {
          linkages: [
            {
              type: 'options',
              dependencies: ['department'],
              fulfill: { function: 'getEmployeeOptions' }
            }
          ]
        }
      }
    }
  };

  const linkageFunctions = {
    getDepartmentOptions: () => {
      return departments.map(dept => ({
        label: dept.name,
        value: dept.id
      }));
    },
    getEmployeeOptions: (formData: any) => {
      const selectedDept = formData.department;
      if (!selectedDept) return [];

      return employees
        .filter(emp => emp.departmentId === selectedDept)
        .map(emp => ({
          label: emp.name,
          value: emp.id
        }));
    }
  };

  return (
    <DynamicForm
      ref={formRef}
      schema={schema}
      linkageFunctions={linkageFunctions}
      loading={loading}
      onSubmit={handleSubmit}
    />
  );
}
```

**Important Notes:**

- **DynamicForm does NOT auto-initialize linkage** - You must manually call `refreshLinkage()` after mount
- `refreshLinkage()` is asynchronous and returns a Promise
- It re-calculates all linkage states based on current form values
- Best practice: Call it after async data has been loaded and state updated
- For better UX, use a loading state while data is being fetched

#### Complete Example: Using All DynamicFormRef Methods

Here's a comprehensive example demonstrating all available methods:

```typescript
import React, { useRef } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { DynamicFormRef } from '@/components/DynamicForm';

function UserManagementForm() {
  const formRef = useRef<DynamicFormRef>(null);

  const schema = {
    type: 'object',
    properties: {
      username: {
        type: 'string',
        title: 'Username',
        minLength: 3,
        maxLength: 20
      },
      email: {
        type: 'string',
        title: 'Email',
        format: 'email'
      },
      role: {
        type: 'string',
        title: 'Role',
        enum: ['user', 'admin'],
        enumNames: ['User', 'Administrator']
      }
    },
    required: ['username', 'email']
  };

  // Example: Programmatically set values
  const handleLoadUserData = () => {
    formRef.current?.setValues({
      username: 'john_doe',
      email: 'john@example.com',
      role: 'admin'
    }, { shouldValidate: true });
  };

  // Example: Get and display current values
  const handleShowValues = () => {
    const values = formRef.current?.getValues();
    console.log('Current form values:', values);
    alert(JSON.stringify(values, null, 2));
  };

  // Example: Validate before custom action
  const handleCustomAction = async () => {
    const isValid = await formRef.current?.validate();
    if (!isValid) {
      const errors = formRef.current?.getErrors();
      console.log('Validation errors:', errors);
      alert('Please fix validation errors');
      return;
    }

    const values = formRef.current?.getValues();
    console.log('Performing action with:', values);
  };

  // Example: Check username availability
  const handleCheckUsername = async () => {
    const username = formRef.current?.getValue('username');

    // Simulate API call
    const isAvailable = await checkUsernameAvailability(username);

    if (!isAvailable) {
      formRef.current?.setError('username', {
        type: 'manual',
        message: 'This username is already taken'
      });
    } else {
      formRef.current?.clearErrors('username');
      alert('Username is available!');
    }
  };

  // Example: Reset form
  const handleReset = () => {
    formRef.current?.reset();
  };

  // Example: Check form state
  const handleCheckState = () => {
    const state = formRef.current?.getFormState();
    console.log('Form state:', state);
    alert(`
      Dirty: ${state?.isDirty}
      Valid: ${state?.isValid}
      Submitted: ${state?.isSubmitted}
    `);
  };

  return (
    <div>
      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={(data) => console.log('Submitted:', data)}
      />

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleLoadUserData}>Load User Data</button>
        <button onClick={handleShowValues}>Show Values</button>
        <button onClick={handleCustomAction}>Validate & Act</button>
        <button onClick={handleCheckUsername}>Check Username</button>
        <button onClick={handleCheckState}>Check State</button>
        <button onClick={handleReset}>Reset Form</button>
      </div>
    </div>
  );
}
```

---

## Examples

### Complete Registration Form

```typescript
const registrationSchema = {
  type: 'object',
  title: 'User Registration',
  properties: {
    username: {
      type: 'string',
      title: 'Username',
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-zA-Z0-9_]+$',
      ui: {
        placeholder: 'Enter username',
        errorMessages: {
          required: 'Username is required',
          minLength: 'Username must be at least 3 characters',
          pattern: 'Only letters, numbers and underscores allowed'
        }
      }
    },
    email: {
      type: 'string',
      title: 'Email',
      format: 'email',
      ui: {
        placeholder: 'example@email.com'
      }
    },
    password: {
      type: 'string',
      title: 'Password',
      minLength: 6,
      ui: {
        widget: 'password',
        placeholder: 'At least 6 characters'
      }
    },
    age: {
      type: 'integer',
      title: 'Age',
      minimum: 18,
      maximum: 100
    },
    gender: {
      type: 'string',
      title: 'Gender',
      enum: ['male', 'female', 'other'],
      enumNames: ['Male', 'Female', 'Other'],
      ui: {
        widget: 'radio'
      }
    },
    agreeTerms: {
      type: 'boolean',
      title: 'I agree to the terms and conditions',
      const: true
    }
  },
  required: ['username', 'email', 'password', 'agreeTerms']
};

function RegistrationForm() {
  const handleSubmit = async (data: any) => {
    try {
      await api.register(data);
      alert('Registration successful!');
    } catch (error) {
      alert('Registration failed');
    }
  };

  return (
    <DynamicForm
      schema={registrationSchema}
      onSubmit={handleSubmit}
      layout="vertical"
    />
  );
}
```

---

## Best Practices

### Schema Design

**1. Keep It Simple**

```typescript
// ✅ Good: Simple and clear
{
  type: 'string',
  title: 'Username',
  minLength: 3
}

// ❌ Avoid: Over-complicated
{
  type: 'string',
  title: 'Username',
  minLength: 3,
  maxLength: 20,
  pattern: '^[a-zA-Z0-9_]+$',
  allOf: [...],
  anyOf: [...]
}
```

**2. Use Meaningful Field Names**

```typescript
// ✅ Good
properties: {
  firstName: { type: 'string' },
  lastName: { type: 'string' }
}

// ❌ Avoid
properties: {
  field1: { type: 'string' },
  field2: { type: 'string' }
}
```

**3. Provide Clear Titles and Descriptions**

```typescript
{
  type: 'string',
  title: 'Email Address',
  description: 'Used for notifications and password recovery',
  ui: {
    placeholder: 'example@email.com'
  }
}
```

### Performance Optimization

**1. Cache Schema with useMemo**

```typescript
const schema = useMemo(
  () => ({
    type: 'object',
    properties: {
      // ... schema definition
    },
  }),
  []
)
```

**2. Debounce onChange Callbacks**

```typescript
const debouncedOnChange = useMemo(
  () => debounce((data) => {
    console.log('Form changed:', data);
  }, 300),
  []
);

<DynamicForm
  schema={schema}
  onChange={debouncedOnChange}
/>
```

**3. Split Large Forms**

For forms with 50+ fields, consider splitting into multiple steps.

### Error Handling

**1. Provide Friendly Error Messages**

```typescript
{
  type: 'string',
  minLength: 6,
  ui: {
    errorMessages: {
      minLength: 'Password must be at least 6 characters'
    }
  }
}
```

**2. Global Error Handling**

```typescript
const handleSubmit = async (data: any) => {
  try {
    await api.submitForm(data)
  } catch (error) {
    toast.error('Submission failed. Please try again.')
  }
}
```

---

## Troubleshooting

### Common Issues

**Q: Fields not rendering**

- Check if `type` is correctly specified in schema
- Verify widget type is supported
- Check console for errors

**Q: Validation not working**

- Ensure `required` fields are in schema's `required` array
- Check validation rules syntax
- Verify custom validators are registered

**Q: Nested forms not displaying**

- Object fields automatically use `nested-form` widget by default
- For arrays of objects, ensure `items.type: 'object'` is set
- Check schema structure is correct

**Q: Linkage not working**

- Verify dependencies use correct path format
- Check linkage functions are registered
- Use JSON Pointer format for nested fields

---
