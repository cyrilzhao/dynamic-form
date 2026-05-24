# DynamicForm Component - Usage Guide

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Basic Usage](#basic-usage)
5. [Schema Definition](#schema-definition)
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

### Basic Field Types

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

| Widget                  | Use Case                                  | Layout Style              | Virtual Scroll |
| ----------------------- | ----------------------------------------- | ------------------------- | -------------- |
| **ArrayFieldWidget**    | General arrays (supports any type)        | Card/List style           | ✅             |
| **KeyValueArrayWidget** | Key-value pair arrays (e.g., env vars, mappings) | Table style (fixed two columns) | ❌             |
| **TableArrayWidget**    | Object arrays (table display)             | Table style (auto-generated columns) | ✅             |

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

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `keyField` | `string` | `'key'` | Key field name |
| `valueField` | `string` | `'value'` | Value field name |
| `keyLabel` | `string` | `'Key'` | Key column header |
| `valueLabel` | `string` | `'Value'` | Value column header |
| `keyPlaceholder` | `string` | Same as `keyLabel` | Key input placeholder |
| `valuePlaceholder` | `string` | Same as `valueLabel` | Value input placeholder |
| `addButtonText` | `string` | `'Add'` | Add button text |
| `emptyText` | `string` | - | Empty state message |

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

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enableVirtualScroll` | `boolean` | `false` | Enable virtual scrolling |
| `virtualScrollHeight` | `number` | `400` | Virtual scroll container height (pixels) |
| `columns` | `string[]` | - | Column order (optional, defaults to properties order) |
| `addButtonText` | `string` | `'Add Row'` | Add button text |
| `emptyText` | `string` | `'No data'` | Empty state message |

**Performance Comparison:**

| Array Size | Without Virtual Scroll | With Virtual Scroll |
|-----------|----------------------|-------------------|
| 50 items  | Smooth               | Smooth            |
| 100 items | Slightly laggy       | Smooth            |
| 500 items | Noticeably laggy     | Smooth            |
| 1000+ items | Severely laggy     | Smooth            |

**When to Use:**
- Enable virtual scroll when array has 50+ items
- Each item contains complex form fields
- Users need to frequently scroll through data

**Widget Comparison:**

| Feature | TableArrayWidget | ArrayFieldWidget | KeyValueArrayWidget |
|---------|------------------|------------------|---------------------|
| **Use Case** | Object arrays (table display) | General arrays | Key-value pairs |
| **Layout** | Table | Card/List | Table (fixed 2 columns) |
| **Virtual Scroll** | ✅ Supported | ✅ Supported | ❌ Not supported |
| **Column Definition** | Auto-generated | Auto-generated | Fixed 2 columns |
| **Complexity** | Medium | High (supports nesting) | Simple |
| **Performance** | Excellent (virtual scroll) | Excellent (virtual scroll) | Good |

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

| Property    | Type               | Default        | Description                          |
| ----------- | ------------------ | -------------- | ------------------------------------ |
| `language`  | `SupportedLanguage`| `'javascript'` | Programming language for highlighting |
| `theme`     | `'light' \| 'dark'`| `'light'`      | Editor theme                         |
| `config`    | `CodeEditorConfig` | `{}`           | Editor configuration                 |
| `validator` | `(code: string) => string \| null` | - | Custom validator function |
| `formatter` | `(code: string) => string` | -       | Custom formatter function            |

**Config Options:**

| Property              | Type      | Default | Description                              |
| --------------------- | --------- | ------- | ---------------------------------------- |
| `initialMode`         | `'preview' \| 'edit'` | `'preview'` | Initial display mode       |
| `previewLines`        | `number`  | `3`     | Number of lines shown in preview         |
| `previewMaxHeight`    | `number`  | `120`   | Max height of preview area (px)          |
| `modalPadding`        | `number`  | `40`    | Modal margin from screen edges (px)      |
| `backdropOpacity`     | `number`  | `0.5`   | Modal backdrop opacity (0-1)             |
| `closeOnEscape`       | `boolean` | `true`  | Close modal on ESC key                   |
| `closeOnBackdropClick`| `boolean` | `true`  | Close modal on backdrop click            |

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

| Property | Type               | Default   | Description                    |
| -------- | ------------------ | --------- | ------------------------------ |
| `config` | `CodeEditorConfig` | `{}`      | Editor configuration (same as CodeEditor) |
| `theme`  | `'light' \| 'dark'`| `'light'` | Editor theme                   |
| `indent` | `number`           | `2`       | JSON indentation spaces        |

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

| Widget          | Field Type          | Description                    |
| --------------- | ------------------- | ------------------------------ |
| `text`          | string              | Single-line text input         |
| `textarea`      | string              | Multi-line text input          |
| `password`      | string              | Password input                 |
| `email`         | string              | Email input                    |
| `number`        | number/integer      | Number input                   |
| `select`        | string/number/array | Dropdown select                |
| `radio`         | string/number       | Radio buttons                  |
| `checkboxes`    | array               | Multiple checkboxes            |
| `checkbox`      | boolean             | Single checkbox                |
| `switch`        | boolean             | Toggle switch                  |
| `date`          | string              | Date picker                    |
| `nested-form`   | object/array        | Nested form                    |
| `code-editor`   | string              | Code editor with syntax highlight |
| `object-editor` | object              | JSON object editor             |

### Validation Rules

#### Built-in Validation

```typescript
{
  type: 'string',
  title: 'Username',
  minLength: 3,              // Minimum length
  maxLength: 20,             // Maximum length
  pattern: '^[a-zA-Z0-9_]+$', // Regex pattern
  format: 'email',           // Predefined format
  ui: {
    errorMessages: {
      required: 'Username is required',
      minLength: 'Username must be at least 3 characters',
      maxLength: 'Username cannot exceed 20 characters',
      pattern: 'Username can only contain letters, numbers and underscores'
    }
  }
}
```

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

---

## Advanced Features

### UI Linkage

UI linkage allows fields to dynamically change based on other field values.

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
};

const linkageFunctions = {
  getProvinceOptions: (formData: any) => {
    if (formData.country === 'china') {
      return [
        { label: 'Beijing', value: 'beijing' },
        { label: 'Shanghai', value: 'shanghai' },
      ];
    } else if (formData.country === 'usa') {
      return [
        { label: 'California', value: 'ca' },
        { label: 'New York', value: 'ny' },
      ];
    }
    return [];
  },
};
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
};
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
};
// Display: "Authentication - API Key"
// Submit: { auth: { content: { apiKey: 'xxx' } } }
```

---

## API Reference

### DynamicForm Props

| Prop               | Type                                            | Required | Default      | Description                     |
| ------------------ | ----------------------------------------------- | -------- | ------------ | ------------------------------- |
| `schema`           | `ExtendedJSONSchema`                            | Yes      | -            | JSON Schema definition          |
| `defaultValues`    | `Record<string, any>`                           | No       | `{}`         | Initial form values             |
| `onSubmit`         | `(data: any) => void \| Promise<void>`          | No       | -            | Submit handler                  |
| `onChange`         | `(data: any) => void`                           | No       | -            | Change handler                  |
| `widgets`          | `Record<string, ComponentType>`                 | No       | `{}`         | Custom widgets                  |
| `linkageFunctions` | `Record<string, Function>`                      | No       | `{}`         | Linkage functions               |
| `customFormats`    | `Record<string, Function>`                      | No       | `{}`         | Custom format validators        |
| `layout`           | `'vertical' \| 'horizontal' \| 'inline'`        | No       | `'vertical'` | Form layout                     |
| `labelWidth`       | `number \| string`                              | No       | -            | Label width (horizontal layout) |
| `showSubmitButton` | `boolean`                                       | No       | `true`       | Show submit button              |
| `renderAsForm`     | `boolean`                                       | No       | `true`       | Render as `<form>` tag          |
| `validateMode`     | `'onSubmit' \| 'onBlur' \| 'onChange' \| 'all'` | No       | `'onSubmit'` | Validation mode                 |
| `loading`          | `boolean`                                       | No       | `false`      | Loading state                   |
| `disabled`         | `boolean`                                       | No       | `false`      | Disable all fields              |
| `readonly`         | `boolean`                                       | No       | `false`      | Make all fields readonly        |
| `className`        | `string`                                        | No       | -            | CSS class name                  |
| `style`            | `React.CSSProperties`                           | No       | -            | Inline styles                   |

### DynamicFormRef Methods

DynamicForm exposes several methods via ref that allow you to programmatically control the form:

#### Basic Methods

| Method      | Signature                                                          | Description                              |
| ----------- | ------------------------------------------------------------------ | ---------------------------------------- |
| `setValue`  | `(name: string, value: any, options?: SetValueOptions) => void`    | Set a single field value                 |
| `getValue`  | `(name: string) => any`                                            | Get a single field value by name         |
| `getValues` | `() => Record<string, any>`                                        | Get all form values as an object         |
| `setValues` | `(values: Record<string, any>, options?: SetValueOptions) => void` | Set multiple field values (supports nested objects and arrays) |
| `reset`     | `(values?: Record<string, any>) => void`                           | Reset form; empty call clears all fields, with values resets to provided data |

**`setValue(name, value, options?)` - Set Field Value**

Set a single field value programmatically.

```typescript
const formRef = useRef<DynamicFormRef>(null);

// Set a simple field
formRef.current?.setValue('username', 'john_doe');

// Set with validation
formRef.current?.setValue('email', 'john@example.com', {
  shouldValidate: true, // Trigger validation
  shouldDirty: true, // Mark field as dirty
  shouldTouch: true, // Mark field as touched
});

// Set nested field
formRef.current?.setValue('address.city', 'Beijing');

// Set array element
formRef.current?.setValue('contacts.0.name', 'Alice');
```

**`getValue(name)` - Get Field Value**

Get a single field value by name.

```typescript
const username = formRef.current?.getValue('username');
const city = formRef.current?.getValue('address.city');
const firstContact = formRef.current?.getValue('contacts.0');
```

**`getValues()` - Get All Values**

Get all form values as an object.

```typescript
const allValues = formRef.current?.getValues();
console.log(allValues);
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
);

// 设置嵌套对象（自动递归展开，确保嵌套表单子字段正确更新）
formRef.current?.setValues({
  address: {
    street: '123 Main St',
    city: 'Shanghai',
    zipCode: '200000',
  },
});

// 设置深层嵌套对象
formRef.current?.setValues({
  company: {
    companyName: 'Acme Inc',
    location: {
      country: 'China',
      city: 'Beijing',
    },
  },
});

// 设置数组（基本类型数组会自动包装为内部格式）
formRef.current?.setValues({
  tags: ['frontend', 'react', 'typescript'],
  contacts: [
    { contactName: 'Alice', phone: '123-4567' },
    { contactName: 'Bob', phone: '890-1234' },
  ],
});

// 混合设置：顶层 + 嵌套 + 数组
formRef.current?.setValues({
  username: 'john_doe',
  address: { street: '456 Oak Ave', city: 'Shenzhen' },
  tags: ['vue', 'angular'],
});
```

> **实现细节**：`setValues` 内部会：
> 1. 使用 `wrapPrimitiveArrays` 将基本类型数组（如 `string[]`）转换为 `useFieldArray` 所需的对象数组格式
> 2. 递归展开嵌套对象，对每一层级的路径都调用 `setValue`，确保嵌套表单（`NestedFormWidget`）内部的子 Controller 都能收到新值

**`reset(values?)` - Reset Form**

Reset form to default values or provided values. Supports nested objects and arrays.

```typescript
// 清空表单（所有字段重置为类型恰当的空值）
// string → '', array → [], object → 递归空对象, number/boolean → undefined
formRef.current?.reset();
formRef.current?.reset({});

// 用完整数据重置（支持嵌套对象和数组）
formRef.current?.reset({
  username: 'john_doe',
  email: 'john@example.com',
  address: {
    street: '123 Main St',
    city: 'Beijing',
  },
  tags: ['frontend', 'react'],
  contacts: [
    { contactName: 'Alice', phone: '123-4567' },
  ],
});
```

> **注意**：
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
const isValid = await formRef.current?.validate();
if (isValid) {
  console.log('Form is valid');
}

// Validate specific field
const isEmailValid = await formRef.current?.validate('email');

// Validate multiple fields
const areFieldsValid = await formRef.current?.validate(['email', 'username', 'password']);
if (areFieldsValid) {
  console.log('All specified fields are valid');
}
```

**`getErrors()` - Get Validation Errors**

Get all current validation errors.

```typescript
const errors = formRef.current?.getErrors();
console.log(errors);
// { email: { type: 'pattern', message: 'Invalid email format' } }
```

**`clearErrors(name?)` - Clear Errors**

Clear validation errors for a specific field, multiple fields, or entire form.

```typescript
// Clear specific field error
formRef.current?.clearErrors('email');

// Clear multiple fields' errors
formRef.current?.clearErrors(['email', 'username', 'password']);

// Clear all errors
formRef.current?.clearErrors();
```

**`setError(name, error)` - Set Error**

Manually set a validation error for a field. Useful for async validation, server-side validation, or custom business logic validation.

```typescript
// Basic usage: Set a manual error
formRef.current?.setError('username', {
  type: 'manual',
  message: 'This username is already taken',
});

// Async validation example: Check username availability
const handleCheckUsername = async () => {
  const username = formRef.current?.getValue('username');

  try {
    const response = await fetch(`/api/check-username?username=${username}`);
    const { available } = await response.json();

    if (!available) {
      formRef.current?.setError('username', {
        type: 'manual',
        message: 'This username is already taken',
      });
    } else {
      formRef.current?.clearErrors('username');
    }
  } catch (error) {
    formRef.current?.setError('username', {
      type: 'manual',
      message: 'Failed to check username availability',
    });
  }
};

// Server-side validation example: Handle API errors
const handleSubmit = async (data: any) => {
  try {
    await api.createUser(data);
  } catch (error: any) {
    // Set errors from server response
    if (error.response?.data?.errors) {
      Object.entries(error.response.data.errors).forEach(([field, message]) => {
        formRef.current?.setError(field, {
          type: 'server',
          message: message as string,
        });
      });
    }
  }
};

// Custom business logic validation
const handleValidatePassword = () => {
  const password = formRef.current?.getValue('password');
  const confirmPassword = formRef.current?.getValue('confirmPassword');

  if (password !== confirmPassword) {
    formRef.current?.setError('confirmPassword', {
      type: 'manual',
      message: 'Passwords do not match',
    });
  }
};
```

**`getFormState()` - Get Form State**

Get current form state information.

```typescript
const formState = formRef.current?.getFormState();
console.log(formState);
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

This method allows you to manually re-trigger all linkage calculations. This is particularly useful when:

1. **Async Data Loading**: Linkage functions depend on data loaded asynchronously (e.g., from APIs)
2. **External State Changes**: Data used by linkage functions is updated outside the form
3. **Dynamic Function Updates**: Linkage functions themselves are updated dynamically

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
);
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
    await api.submitForm(data);
  } catch (error) {
    toast.error('Submission failed. Please try again.');
  }
};
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
