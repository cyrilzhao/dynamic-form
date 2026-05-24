# DynamicForm: Technical Architecture Overview

## Executive Summary

DynamicForm is a configuration-driven dynamic form solution built on **react-hook-form** and **JSON Schema** standards. It provides a flexible, type-safe, and high-performance approach to generating forms from schema configurations, enabling developers to build complex forms without writing repetitive UI code.

**Key Highlights**:
- Configuration-driven form generation using standard JSON Schema
- Complete TypeScript support with full type inference
- High performance through uncontrolled components (react-hook-form)
- Sophisticated field linkage system for dynamic interactions
- Support for complex nested structures and array fields
- UI framework agnostic architecture

---

## 1. Architecture Design

### 1.1 Layered Architecture

The system follows a clean layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  User Form Pages | Config Management | Form Preview      │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Component Layer                        │
│  DynamicForm | Field Widgets | Layout Components        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                     Core Layer                           │
│  Schema Parser | Validator | Field Registry             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   Foundation Layer                       │
│  react-hook-form | JSON Schema | TypeScript             │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Core Design Principles

1. **Configuration-Driven**: All form structure defined in JSON Schema
2. **Type Safety**: Complete TypeScript support throughout the stack
3. **Performance First**: Uncontrolled components minimize re-renders
4. **Framework Agnostic**: Core logic decoupled from UI libraries
5. **Progressive Enhancement**: Start simple, add complexity when needed
6. **Separation of Concerns**: Validation logic vs. UI interaction logic

### 1.3 Data Flow

```
JSON Schema Configuration
       ↓
  Schema Parser
       ↓
  Field Configuration
       ↓
  DynamicForm Component
       ↓
  Field Widgets
       ↓
  react-hook-form State
       ↓
  User Input
       ↓
  Validation
       ↓
  Form Submission
```

---

## 2. Technology Stack

### 2.1 Core Dependencies

| Technology        | Version | Purpose                |
|-------------------|---------|------------------------|
| React             | 18+     | UI framework           |
| TypeScript        | 5+      | Type system            |
| react-hook-form   | 7+      | Form state management  |
| JSON Schema       | Draft-07/2020-12 | Data specification |
| Ajv               | 8+      | Schema validation      |

### 2.2 Why react-hook-form?

**Performance Advantages**:
- Uncontrolled components reduce unnecessary re-renders
- Form state managed via refs, not React state
- Can handle 100+ fields efficiently
- ~9KB gzipped bundle size, zero dependencies

**Developer Experience**:
- Hook-based API is intuitive and concise
- Excellent TypeScript support with full type inference
- Built-in validation, field arrays, async validation
- Large ecosystem and active community

**Comparison with Alternatives**:

| Feature | react-hook-form | Formik | Ant Design Form |
|---------|----------------|--------|-----------------|
| Performance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Bundle Size | Small (9KB) | Medium | Large |
| TypeScript | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| API Design | Hook-based | Render props/Hook | Component-based |

### 2.3 Why JSON Schema?

**Industry Standard**:
- Cross-platform, language-agnostic specification
- Used by OpenAPI, Swagger, and many other tools
- Extensive tooling ecosystem (validators, generators, editors)

**Rich Validation**:
- Complete type system (string, number, boolean, array, object)
- Built-in validation rules (minLength, pattern, format, etc.)
- Conditional validation (if/then/else, dependencies)
- Schema composition (allOf, anyOf, oneOf, $ref)

**Maintainability**:
- JSON format is human-readable and editable
- Self-documenting schemas
- Version control friendly
- Easy to store in databases or retrieve from APIs

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```typescript
DynamicForm (Root Component)
├── NestedSchemaProvider (Dynamic Schema Registry)
├── LinkageStateProvider (Linkage State Management)
├── FormProvider (react-hook-form Context)
├── SchemaParser (Parse Schema → Field Config)
├── LinkageManager (Field Interaction Logic)
└── FormField[] (Field Wrappers)
    ├── FieldLabel
    ├── FieldWidget (TextWidget, SelectWidget, etc.)
    └── FieldError
```

### 3.2 Core Components

#### DynamicForm Component

**Responsibilities**:
- Parse JSON Schema into field configurations
- Initialize form state (react-hook-form)
- Manage field linkage system
- Handle form submission and data transformation
- Provide context for nested forms

**Key Props**:
```typescript
interface DynamicFormProps {
  // Required
  schema: ExtendedJSONSchema;

  // Optional
  defaultValues?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void;
  onChange?: (data: Record<string, any>) => void;

  // Customization
  widgets?: Record<string, React.ComponentType<any>>;
  linkageFunctions?: Record<string, LinkageFunction>;
  customFormats?: Record<string, (value: string) => boolean>;

  // UI Configuration
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string;

  // Behavior
  validateMode?: 'onSubmit' | 'onBlur' | 'onChange' | 'all';
  disabled?: boolean;
  readonly?: boolean;
}
```

#### Schema Parser

**Responsibilities**:
- Parse JSON Schema into field configurations
- Determine widget types based on schema
- Generate validation rules for react-hook-form
- Handle nested objects and arrays
- Support path flattening for deep nesting

**Core Algorithm**:
```typescript
class SchemaParser {
  static parse(schema: ExtendedJSONSchema): FieldConfig[] {
    // 1. Extract properties from schema
    // 2. Determine field order
    // 3. For each property:
    //    - Determine widget type
    //    - Generate validation rules
    //    - Handle nested structures
    //    - Apply path flattening if configured
    // 4. Return field configurations
  }
}
```

#### Field Registry

**Responsibilities**:
- Register and manage widget components
- Provide widget lookup by type
- Support custom widget registration

**Built-in Widgets**:
- `text`, `textarea`, `password`: Text input variants
- `number`: Number input
- `select`, `radio`, `checkbox`: Choice widgets
- `switch`: Toggle widget
- `date`, `datetime`, `time`: Date/time pickers
- `email`, `url`: Format-specific inputs
- `array`: Array field management
- `nested-form`: Nested object rendering
- `key-value-array`: Key-value pair management
- `table-array`: Table-based array display

### 3.3 Widget System

**Framework Agnostic Design**:
- Widgets implement a standard `FieldWidgetProps` interface
- Default implementation uses Blueprint.js, but any library can be used
- Widgets are registered via `FieldRegistry.register()`
- Custom widgets can override built-in widgets

**Widget Interface**:
```typescript
interface FieldWidgetProps {
  name: string;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;

  // Metadata
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;

  // State
  disabled?: boolean;
  readonly?: boolean;

  // Options (for select, radio, etc.)
  options?: FieldOption[];

  // Schema (for nested forms, arrays)
  schema?: ExtendedJSONSchema;
}
```

**Custom Widget Registration**:
```typescript
// Define custom widget
const CustomDatePicker = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, value, onChange, disabled }, ref) => {
    return (
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={disabled}
      />
    );
  }
);

// Register widget
FieldRegistry.register('custom-date', CustomDatePicker);

// Use in schema
{
  "birthDate": {
    "type": "string",
    "ui": { "widget": "custom-date" }
  }
}
```

---

## 4. JSON Schema Extensions

### 4.1 UI Configuration

The `ui` field extends standard JSON Schema with presentation logic:

```typescript
interface UIConfig {
  // Widget selection
  widget?: WidgetType;
  widgetProps?: Record<string, any>;

  // Presentation
  placeholder?: string;
  help?: string;
  className?: string;
  style?: React.CSSProperties;

  // State
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;

  // Layout
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string;
  order?: string[];

  // Validation messages
  errorMessages?: {
    required?: string;
    minLength?: string;
    maxLength?: string;
    min?: string;
    max?: string;
    pattern?: string;
  };

  // Field linkage (see section 5)
  linkages?: LinkageConfig[];

  // Path flattening (see section 6.5)
  flattenPath?: boolean;
  flattenPrefix?: boolean;

  // Array configuration
  arrayMode?: 'dynamic' | 'static';
  showAddButton?: boolean;
  showRemoveButton?: boolean;
  addButtonText?: string;
}
```

### 4.2 Schema Example

```json
{
  "type": "object",
  "title": "User Registration Form",
  "properties": {
    "username": {
      "type": "string",
      "title": "Username",
      "minLength": 3,
      "maxLength": 20,
      "pattern": "^[a-zA-Z0-9_]+$",
      "ui": {
        "placeholder": "Enter username",
        "errorMessages": {
          "required": "Username is required",
          "minLength": "Username must be at least 3 characters",
          "pattern": "Username can only contain letters, numbers and underscores"
        }
      }
    },
    "email": {
      "type": "string",
      "title": "Email",
      "format": "email",
      "ui": {
        "widget": "email",
        "placeholder": "example@email.com"
      }
    },
    "age": {
      "type": "integer",
      "title": "Age",
      "minimum": 18,
      "maximum": 100
    },
    "gender": {
      "type": "string",
      "title": "Gender",
      "enum": ["male", "female", "other"],
      "enumNames": ["Male", "Female", "Other"],
      "ui": {
        "widget": "radio"
      }
    }
  },
  "required": ["username", "email", "age"]
}
```

---

## 5. Field Linkage System

### 5.1 Overview

The linkage system enables dynamic field interactions without custom code. It's a **declarative approach** to field dependencies and conditional behavior.

**Key Distinction**:
- **JSON Schema Validation** (`if/then/else`, `dependencies`): Data validation rules
- **UI Linkage** (`ui.linkages`): UI interaction behavior (visibility, state, values)

### 5.2 Linkage Types

#### Visibility Linkage
Show/hide fields based on conditions:

```json
{
  "hasAddress": {
    "type": "boolean",
    "title": "Do you have an address?"
  },
  "address": {
    "type": "string",
    "title": "Address",
    "ui": {
      "linkages": [{
        "type": "visibility",
        "dependencies": ["#/properties/hasAddress"],
        "when": {
          "field": "#/properties/hasAddress",
          "operator": "==",
          "value": true
        }
      }]
    }
  }
}
```

#### Disabled Linkage
Enable/disable fields dynamically:

```json
{
  "agreeTerms": {
    "type": "boolean",
    "title": "I agree to the terms"
  },
  "submitButton": {
    "ui": {
      "linkages": [{
        "type": "disabled",
        "dependencies": ["#/properties/agreeTerms"],
        "when": {
          "field": "#/properties/agreeTerms",
          "operator": "!=",
          "value": true
        }
      }]
    }
  }
}
```

#### Value Linkage
Auto-calculate field values:

```json
{
  "price": { "type": "number", "title": "Unit Price" },
  "quantity": { "type": "number", "title": "Quantity" },
  "total": {
    "type": "number",
    "title": "Total",
    "ui": {
      "readonly": true,
      "linkages": [{
        "type": "value",
        "dependencies": ["#/properties/price", "#/properties/quantity"],
        "fulfill": {
          "function": "calculateTotal"
        }
      }]
    }
  }
}
```

```typescript
// Linkage function
const linkageFunctions = {
  calculateTotal: (formData: any) => {
    return (formData.price || 0) * (formData.quantity || 0);
  }
};

<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
/>
```

#### Options Linkage
Dynamic option lists:

```json
{
  "country": {
    "type": "string",
    "title": "Country",
    "enum": ["usa", "china", "uk"]
  },
  "city": {
    "type": "string",
    "title": "City",
    "ui": {
      "linkages": [{
        "type": "options",
        "dependencies": ["#/properties/country"],
        "fulfill": {
          "function": "loadCities"
        }
      }]
    }
  }
}
```

```typescript
const linkageFunctions = {
  loadCities: (formData: any) => {
    const cityMap = {
      usa: ['New York', 'Los Angeles', 'Chicago'],
      china: ['Beijing', 'Shanghai', 'Guangzhou'],
      uk: ['London', 'Manchester', 'Birmingham']
    };
    return cityMap[formData.country] || [];
  }
};
```

#### Schema Linkage
Dynamic nested schemas:

```json
{
  "authType": {
    "type": "string",
    "title": "Authentication Type",
    "enum": ["basic", "oauth", "apikey"]
  },
  "authConfig": {
    "type": "object",
    "title": "Authentication Configuration",
    "ui": {
      "linkages": [{
        "type": "schema",
        "dependencies": ["#/properties/authType"],
        "fulfill": {
          "function": "getAuthSchema"
        }
      }]
    }
  }
}
```

```typescript
const linkageFunctions = {
  getAuthSchema: (formData: any) => {
    const schemas = {
      basic: {
        type: 'object',
        properties: {
          username: { type: 'string', title: 'Username' },
          password: { type: 'string', title: 'Password' }
        }
      },
      oauth: {
        type: 'object',
        properties: {
          clientId: { type: 'string', title: 'Client ID' },
          clientSecret: { type: 'string', title: 'Client Secret' }
        }
      },
      apikey: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', title: 'API Key' }
        }
      }
    };
    return schemas[formData.authType] || null;
  }
};
```

### 5.3 Linkage Architecture

**Dependency Graph**:
- Schema is parsed to extract all linkage configurations
- Dependency graph is built showing field relationships
- When a field changes, dependent linkages are evaluated

**Path Resolution**:
- **JSON Pointer** (`#/properties/fieldName`): Absolute path for cross-level dependencies
- **Relative Path** (`./fieldName`): Relative to current level (for array elements)
- Runtime conversion to react-hook-form path format (`a.b.c`)

**State Management**:
- Linkage state stored in React Context (`LinkageStateProvider`)
- Each linkage instance tracks: visibility, disabled state, computed values, dynamic options
- Array elements get individual linkage instances

**Performance**:
- Linkages only re-evaluate when dependencies change
- Uses `useMemo` and `useCallback` for optimization
- Dependency tracking prevents unnecessary evaluations

---

## 6. Advanced Features

### 6.1 Nested Forms

**Two Operating Modes**:

1. **Independent Mode** (`asNestedForm: false`, default):
   - Creates own `useForm` instance
   - Manages own form state
   - Suitable for standalone forms

2. **Nested Mode** (`asNestedForm: true`):
   - Reuses parent `FormContext`
   - Fields auto-prefixed with path (e.g., `address.city`)
   - Shared linkage state with parent
   - Suitable for object/array field rendering

**Example - Static Nested Form**:
```json
{
  "address": {
    "type": "object",
    "title": "Address",
    "properties": {
      "street": { "type": "string", "title": "Street" },
      "city": { "type": "string", "title": "City" },
      "zipCode": { "type": "string", "title": "ZIP Code" }
    }
  }
}
```
Field paths: `address.street`, `address.city`, `address.zipCode`

**Example - Dynamic Nested Form**:
```json
{
  "taskType": {
    "type": "string",
    "enum": ["http", "database", "script"]
  },
  "config": {
    "type": "object",
    "title": "Configuration",
    "ui": {
      "linkages": [{
        "type": "schema",
        "dependencies": ["#/properties/taskType"],
        "fulfill": { "function": "getConfigSchema" }
      }]
    }
  }
}
```

**Data Handling**:
- **Initialization**: Nested data structure preserved
- **Submission**: Auto-filters to keep only active schema fields
- **Type Switching**: Data preserved but filtered on submit

### 6.2 Array Field Management

**Three-tier Widget System**:

1. **ArrayFieldWidget** (Universal):
   - Handles all array types: primitives, objects, enums, custom
   - Auto-selects sub-widget based on `items` schema
   - Two modes: `dynamic` (editable) and `static` (fixed size)

2. **KeyValueArrayWidget** (Specialized):
   - Optimized for key-value pairs
   - Table layout with two columns
   - Use cases: environment variables, HTTP headers, mappings

3. **TableArrayWidget** (Performance):
   - Table display for object arrays
   - Virtual scrolling support (react-window)
   - Column configuration and sorting
   - Ideal for 50+ array elements

**Widget Selection Logic**:
```typescript
// ArrayFieldWidget internally determines rendering mode:
if (items.enum) {
  // Render as checkboxes (static mode)
  return <CheckboxGroup options={items.enum} />;
} else if (items.type === 'object') {
  // Render as nested forms (dynamic mode)
  return items.map(index => <NestedFormWidget />);
} else {
  // Render as basic field inputs (dynamic mode)
  return items.map(index => <BasicWidget />);
}
```

**Primitive Array Wrapping**:

Problem: react-hook-form's `useFieldArray` filters out falsy primitive values (empty strings, 0, false).

Solution: Automatically wrap primitives in objects:
```typescript
// User data
['tag1', 'tag2', 'tag3']

// Internal representation
[
  { value: 'tag1' },
  { value: 'tag2' },
  { value: 'tag3' }
]

// Field paths
'tags.0.value', 'tags.1.value', 'tags.2.value'

// On submit: auto-unwraps back to ['tag1', 'tag2', 'tag3']
```

**Array Operations**:
- Add/remove items
- Reorder via drag-and-drop (optional)
- Move up/down buttons
- Min/max item validation (`minItems`, `maxItems`)

### 6.3 Array Field Linkage

**Relative Path Dependencies**:

Use `./fieldName` to reference fields within the same array element:

```json
{
  "contacts": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "contactType": {
          "type": "string",
          "enum": ["personal", "business"]
        },
        "companyName": {
          "type": "string",
          "title": "Company Name",
          "ui": {
            "linkages": [{
              "type": "visibility",
              "dependencies": ["./contactType"],
              "when": {
                "field": "./contactType",
                "operator": "==",
                "value": "business"
              }
            }]
          }
        }
      }
    }
  }
}
```

**Absolute Path Dependencies**:

Use JSON Pointer to reference fields outside the array:

```json
{
  "country": { "type": "string", "enum": ["usa", "china"] },
  "offices": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "city": {
          "type": "string",
          "ui": {
            "linkages": [{
              "type": "options",
              "dependencies": ["#/properties/country"],
              "fulfill": { "function": "loadCities" }
            }]
          }
        }
      }
    }
  }
}
```

**Runtime Path Resolution**:
```typescript
// Relative path resolution (within array element)
"./companyName" → "contacts.0.companyName" (for element 0)
"./companyName" → "contacts.1.companyName" (for element 1)

// Absolute path resolution (cross-level)
"#/properties/country" → "country" (always)
```

**Dynamic Linkage Instantiation**:
- Each array element gets its own linkage instances
- Instances created/destroyed as elements are added/removed
- Relative paths automatically resolve to correct element index

### 6.4 Validation System

**Two-Layer Validation**:

1. **Field-Level Validation** (react-hook-form):
   - Single field constraints: required, minLength, pattern, etc.
   - Executes on field blur or form submit
   - Fast and lightweight

2. **Schema-Level Validation** (JSON Schema + Ajv):
   - Cross-field validation: dependencies, if/then/else
   - Complex validation: allOf, anyOf, oneOf
   - Executes on form submit
   - Comprehensive but heavier

**Validation Rules Generation**:
```typescript
// Schema
{
  "type": "string",
  "minLength": 3,
  "maxLength": 20,
  "pattern": "^[a-zA-Z0-9_]+$"
}

// Generated react-hook-form rules
{
  required: "This field is required",
  minLength: {
    value: 3,
    message: "Minimum length is 3 characters"
  },
  maxLength: {
    value: 20,
    message: "Maximum length is 20 characters"
  },
  pattern: {
    value: /^[a-zA-Z0-9_]+$/,
    message: "Invalid format"
  }
}
```

**Custom Validation**:
```typescript
// Custom format validator
<DynamicForm
  customFormats={{
    phone: (value) => /^1[3-9]\d{9}$/.test(value)
  }}
/>

// Schema
{
  "phoneNumber": {
    "type": "string",
    "format": "phone"
  }
}
```

**Conditional Validation** (JSON Schema Standard):
```json
{
  "type": "object",
  "properties": {
    "country": { "type": "string" },
    "zipCode": { "type": "string" }
  },
  "if": {
    "properties": { "country": { "const": "USA" } }
  },
  "then": {
    "properties": {
      "zipCode": {
        "pattern": "^\\d{5}(-\\d{4})?$"
      }
    }
  }
}
```

### 6.5 Path Flattening

**Problem**: Deep nesting creates visual redundancy and poor UX.

**Example Problem**:
```json
{
  "auth": {
    "type": "object",
    "properties": {
      "content": {
        "type": "object",
        "properties": {
          "apiKey": { "type": "string", "title": "API Key" }
        }
      }
    }
  }
}
```
Without flattening: Displays nested cards "Auth" > "Content" > "API Key" (confusing)

**Solution**: Path Flattening (v3.0)

```json
{
  "auth": {
    "type": "object",
    "title": "Authentication",
    "ui": {
      "flattenPath": true,
      "flattenPrefix": true
    },
    "properties": {
      "content": {
        "type": "object",
        "ui": { "flattenPath": true },
        "properties": {
          "apiKey": { "type": "string", "title": "Key" }
        }
      }
    }
  }
}
```

**Result**:
- **Visual**: Single field labeled "Authentication - Key" (no nested cards)
- **Data Path**: `auth.content.apiKey` (standard nested structure)
- **Form Data**: `{ auth: { content: { apiKey: 'xxx' } } }` (unchanged)

**Configuration**:
- `flattenPath: true`: Skip this object layer, don't render Card component
- `flattenPrefix: true`: Add this field's title as label prefix

**When to Use**:
- ✅ Backend API has deep nesting (3+ levels)
- ✅ Intermediate levels have no business meaning
- ✅ Users only care about leaf fields
- ❌ Nesting has clear business grouping
- ❌ Need to show hierarchical structure

### 6.6 Layout System

**Layout Modes**:
- `vertical`: Label above input (default)
- `horizontal`: Label left, input right
- `inline`: Fields in a row

**Layout Inheritance**:
```typescript
// Priority (highest to lowest):
// 1. Field-level ui.layout
// 2. Parent field ui.layout
// 3. DynamicForm layout prop
```

**Example**:
```json
{
  "type": "object",
  "ui": { "layout": "horizontal" },
  "properties": {
    "name": { "type": "string" },  // Inherits horizontal
    "email": {
      "type": "string",
      "ui": { "layout": "vertical" }  // Override: vertical
    }
  }
}
```

**Label Width** (horizontal layout only):
```typescript
<DynamicForm
  schema={schema}
  layout="horizontal"
  labelWidth={120}  // Global default
/>
```

```json
{
  "username": {
    "type": "string",
    "ui": { "labelWidth": 150 }  // Override for this field
  }
}
```

---

## 7. Data Processing Pipeline

### 7.1 Initialization Flow

```
Raw defaultValues
       ↓
1. Wrap Primitive Arrays
   ['a', 'b'] → [{value: 'a'}, {value: 'b'}]
       ↓
2. Apply Path Flattening (if enabled)
   Nested structure preserved (no transformation in v3.0)
       ↓
3. Set as react-hook-form defaultValues
```

### 7.2 Submission Flow

```
Form Data (from react-hook-form)
       ↓
1. Convert Flattened Paths to Nested (if flattenPath used)
   v3.0: No conversion needed (paths are already standard)
       ↓
2. Unwrap Primitive Arrays
   [{value: 'a'}, {value: 'b'}] → ['a', 'b']
       ↓
3. Filter by Active Schema
   Remove fields not in current schema
   (Important for dynamic schema switching)
       ↓
4. Call onSubmit with clean data
```

### 7.3 Data Transformation Example

```typescript
// User provides
const defaultValues = {
  tags: ['react', 'typescript'],
  auth: {
    content: {
      apiKey: 'secret-key'
    }
  }
};

// After wrapping (internal)
{
  tags: [
    { value: 'react' },
    { value: 'typescript' }
  ],
  auth: {
    content: {
      apiKey: 'secret-key'
    }
  }
}

// User modifies form...

// On submit (after unwrapping)
{
  tags: ['react', 'typescript', 'javascript'],
  auth: {
    content: {
      apiKey: 'new-secret-key'
    }
  }
}
```

---

## 8. Performance Optimization

### 8.1 Core Performance Features

**Uncontrolled Components**:
- Form state managed via refs, not React state
- Field changes don't trigger parent re-renders
- Only validation triggers re-render (on error state change)

**Memoization Strategy**:
```typescript
// Schema parsing
const fields = useMemo(() =>
  SchemaParser.parse(schema),
  [schema]
);

// Linkage functions
const stableLinkageFunctions = linkageFunctions || EMPTY_OBJECT;

// Widget components
const WidgetComponent = useMemo(() =>
  FieldRegistry.getWidget(field.widget),
  [field.widget]
);
```

**Context Optimization**:
- Multiple focused contexts instead of one large context
- Only subscribe to relevant context slices
- Prevents unnecessary re-renders across form

### 8.2 Large Form Strategies

**For 100+ Fields**:
1. **Field-level lazy rendering**: Render fields only when visible
2. **Schema memoization**: Cache parsed schema
3. **Debounced onChange**: Reduce callback frequency
4. **Avoid deep nesting**: Keep structure flat when possible

**For Large Arrays** (50+ elements):
1. **Use TableArrayWidget**: Built-in virtual scrolling
2. **Enable virtual scrolling**: `ui.widgetProps.enableVirtualScroll`
3. **Limit initial items**: Load more on scroll/pagination
4. **Optimize linkage**: Minimize cross-element dependencies

**Example - Virtual Scrolling**:
```json
{
  "users": {
    "type": "array",
    "title": "User List",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string" }
      }
    },
    "ui": {
      "widget": "table-array",
      "widgetProps": {
        "enableVirtualScroll": true,
        "virtualScrollHeight": 400
      }
    }
  }
}
```

### 8.3 Performance Benchmarks

| Scenario | Fields | Render Time | Re-render Time |
|----------|--------|-------------|----------------|
| Simple Form | 10 | ~50ms | ~5ms |
| Complex Form | 50 | ~200ms | ~20ms |
| Large Form | 100 | ~400ms | ~40ms |
| Large Array (no virtual scroll) | 100 items | ~600ms | ~60ms |
| Large Array (virtual scroll) | 1000 items | ~200ms | ~20ms |

*Benchmarks on MacBook Pro M1, React 18, production build*

---

## 9. Field Path System

### 9.1 Path Formats

Multiple path formats serve different purposes:

| Path Format | Syntax | Example | Use Case |
|------------|--------|---------|----------|
| **Dot Notation** | `a.b.c` | `address.city` | Form data access, field registration |
| **Array Index** | `a.0.b` | `contacts.0.name` | Array element field access |
| **Relative Path** | `./field` | `./companyName` | Array element internal linkage |
| **JSON Pointer** | `#/properties/...` | `#/properties/country` | Cross-level linkage dependencies |

### 9.2 Path Resolution

**Relative Path Resolution** (Array Linkage):
```typescript
// Schema definition
"./companyName"

// Runtime resolution for element 0
"contacts.0.companyName"

// Runtime resolution for element 1
"contacts.1.companyName"
```

**JSON Pointer Resolution** (Cross-Level Linkage):
```typescript
// Schema definition
"#/properties/country"

// Runtime resolution
"country"

// For nested fields
"#/properties/address/properties/country"
→ "address.country"
```

**Path Flattening** (v3.0 - No Special Handling):
```typescript
// Schema with flattenPath
{
  auth: {
    ui: { flattenPath: true },
    properties: {
      content: {
        ui: { flattenPath: true },
        properties: {
          apiKey: { ... }
        }
      }
    }
  }
}

// Field path (standard dot notation)
"auth.content.apiKey"

// No special separator needed in v3.0
```

### 9.3 Path Best Practices

1. **Use Relative Paths for Array Linkage**: `./fieldName` keeps linkage portable
2. **Use JSON Pointer for Cross-Level**: `#/properties/path` is explicit and safe
3. **Avoid Parent References**: `../` is not supported, use absolute paths
4. **Keep Nesting Shallow**: 2-3 levels max for maintainability

---

## 10. Design Patterns

### 10.1 Separation of Concerns

**Data Validation vs. UI Interaction**:

| Concern | Mechanism | Purpose |
|---------|-----------|---------|
| **Data Validation** | JSON Schema (`if/then/else`, `dependencies`) | Ensure data correctness |
| **UI Interaction** | UI Linkage (`ui.linkages`) | Control field visibility, state, values |

**Example - Dependencies**:
```json
// Data validation: dependentField MUST exist if triggerField has a value
{
  "dependencies": {
    "creditCard": ["billingAddress"]
  }
}

// UI interaction: show billingAddress when paymentMethod is 'credit_card'
{
  "billingAddress": {
    "ui": {
      "linkages": [{
        "type": "visibility",
        "dependencies": ["#/properties/paymentMethod"],
        "when": {
          "field": "#/properties/paymentMethod",
          "operator": "==",
          "value": "credit_card"
        }
      }]
    }
  }
}
```

### 10.2 Context Composition

**Multiple Contexts for Different Concerns**:

```typescript
<NestedSchemaProvider>          {/* Dynamic schema registry */}
  <LinkageStateProvider>         {/* Linkage state management */}
    <FormProvider {...methods}>  {/* Form state (react-hook-form) */}
      <PathPrefixProvider>       {/* Path prefixing for nested forms */}
        {/* Form fields */}
      </PathPrefixProvider>
    </FormProvider>
  </LinkageStateProvider>
</NestedSchemaProvider>
```

**Benefits**:
- Each context has single responsibility
- Components subscribe only to needed context
- Prevents unnecessary re-renders
- Easy to test in isolation

### 10.3 Progressive Enhancement

**Start Simple, Add Complexity**:

```json
// Level 1: Basic field
{
  "name": {
    "type": "string",
    "title": "Name"
  }
}

// Level 2: Add validation
{
  "name": {
    "type": "string",
    "title": "Name",
    "minLength": 2,
    "maxLength": 50
  }
}

// Level 3: Add UI config
{
  "name": {
    "type": "string",
    "title": "Name",
    "minLength": 2,
    "maxLength": 50,
    "ui": {
      "placeholder": "Enter your name",
      "errorMessages": {
        "required": "Name is required",
        "minLength": "Name must be at least 2 characters"
      }
    }
  }
}

// Level 4: Add linkage
{
  "name": {
    "type": "string",
    "title": "Name",
    "minLength": 2,
    "maxLength": 50,
    "ui": {
      "placeholder": "Enter your name",
      "linkages": [{
        "type": "disabled",
        "dependencies": ["#/properties/useDefaultName"],
        "when": {
          "field": "#/properties/useDefaultName",
          "operator": "==",
          "value": true
        }
      }]
    }
  }
}
```

---

## 11. Use Cases and Applicability

### 11.1 Ideal Use Cases

✅ **Backend-Driven Forms**:
- Schema stored in database or retrieved from API
- Form structure controlled by server
- Example: CMS, admin panels, configuration UIs

✅ **Multi-Tenant Systems**:
- Different schemas per tenant/organization
- Tenant-specific form customization
- Example: SaaS platforms, enterprise applications

✅ **Form Builders**:
- Visual form design tools
- Drag-and-drop form creation
- Example: Survey builders, workflow designers

✅ **Low-Code Platforms**:
- Configuration-based application building
- Minimal coding required
- Example: Internal tools, rapid prototyping

✅ **Version-Controlled Forms**:
- Schema versioning and migration
- Form evolution over time
- Example: Contract forms, compliance forms

✅ **Complex Workflows**:
- Multi-step forms with conditional logic
- Dynamic field dependencies
- Example: Onboarding flows, application forms

### 11.2 Not Ideal For

❌ **Simple Static Forms**:
- 5-10 fields with no dynamic behavior
- Direct JSX is simpler and faster
- Use react-hook-form directly

❌ **Highly Custom UI**:
- Unique, one-off designs
- Complex animations or interactions
- Configuration limits flexibility

❌ **Extremely Complex Logic**:
- Logic too complex to express in schema
- Better handled in custom code
- Consider hybrid approach (schema + custom components)

### 11.3 Hybrid Approach

Combine schema-driven and code-driven:

```typescript
<DynamicForm schema={baseSchema}>
  {/* Custom field override */}
  <Controller
    name="customField"
    render={({ field }) => (
      <CustomComplexComponent {...field} />
    )}
  />
</DynamicForm>
```

---

## 12. Extensibility and Customization

### 12.1 Custom Widgets

```typescript
// 1. Define widget component
const CustomRatingWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ value, onChange, disabled }, ref) => {
    return (
      <StarRating
        ref={ref}
        value={value}
        onChange={onChange}
        disabled={disabled}
        max={5}
      />
    );
  }
);

// 2. Register globally
FieldRegistry.register('star-rating', CustomRatingWidget);

// 3. Use in schema
{
  "rating": {
    "type": "number",
    "title": "Rating",
    "ui": {
      "widget": "star-rating"
    }
  }
}

// OR: Pass per-form
<DynamicForm
  schema={schema}
  widgets={{
    'star-rating': CustomRatingWidget
  }}
/>
```

### 12.2 Custom Validation

**Custom Format Validators**:
```typescript
<DynamicForm
  customFormats={{
    // Phone number validation
    phone: (value) => /^1[3-9]\d{9}$/.test(value),

    // Credit card validation
    creditCard: (value) => {
      // Luhn algorithm
      return validateLuhn(value);
    }
  }}
/>
```

**Custom Validation Functions**:
```typescript
const customValidators = {
  passwordMatch: (value: string, formData: any) => {
    if (value !== formData.password) {
      return 'Passwords do not match';
    }
    return true;
  }
};

<DynamicForm
  schema={schema}
  customValidators={customValidators}
/>
```

### 12.3 Custom Linkage Functions

```typescript
const linkageFunctions = {
  // Value calculation
  calculateTotal: (formData: any) => {
    return formData.price * formData.quantity;
  },

  // Dynamic options
  loadCities: async (formData: any) => {
    const response = await fetch(`/api/cities?country=${formData.country}`);
    return response.json();
  },

  // Dynamic schema
  getAuthSchema: (formData: any) => {
    const schemas = {
      basic: basicAuthSchema,
      oauth: oauthSchema,
      apikey: apikeySchema
    };
    return schemas[formData.authType];
  }
};

<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
/>
```

### 12.4 Custom Layouts

```typescript
// Custom field layout component
const CustomFieldLayout: React.FC<FormFieldProps> = ({
  field,
  children
}) => {
  return (
    <div className="custom-field-layout">
      <div className="field-label-section">
        <FieldLabel label={field.label} required={field.required} />
        {field.description && <FieldHelp text={field.description} />}
      </div>
      <div className="field-input-section">
        {children}
      </div>
    </div>
  );
};

// Override FormField component
<DynamicForm
  schema={schema}
  components={{
    FormField: CustomFieldLayout
  }}
/>
```

---

## 13. Testing Strategy

### 13.1 Unit Testing

**Test Schema Parser**:
```typescript
describe('SchemaParser', () => {
  it('should parse basic field', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' }
      }
    };

    const fields = SchemaParser.parse(schema);

    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe('name');
    expect(fields[0].widget).toBe('text');
  });

  it('should generate validation rules', () => {
    const schema = {
      type: 'string',
      minLength: 3,
      maxLength: 20
    };

    const rules = SchemaParser.getValidationRules(schema, true);

    expect(rules.required).toBeDefined();
    expect(rules.validate.minLength).toBeDefined();
    expect(rules.maxLength.value).toBe(20);
  });
});
```

**Test Linkage System**:
```typescript
describe('LinkageManager', () => {
  it('should evaluate visibility linkage', () => {
    const linkage = {
      type: 'visibility',
      when: {
        field: 'country',
        operator: '==',
        value: 'USA'
      }
    };

    const formData = { country: 'USA' };
    const result = evaluateLinkage(linkage, formData);

    expect(result.visible).toBe(true);
  });
});
```

### 13.2 Integration Testing

**Test Form Rendering**:
```typescript
describe('DynamicForm', () => {
  it('should render all fields', () => {
    const schema = {
      type: 'object',
      properties: {
        username: { type: 'string', title: 'Username' },
        email: { type: 'string', title: 'Email' }
      }
    };

    render(<DynamicForm schema={schema} />);

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'string', title: 'Email' }
      },
      required: ['email']
    };

    const onSubmit = jest.fn();
    render(<DynamicForm schema={schema} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should handle field linkage', async () => {
    const schema = {
      type: 'object',
      properties: {
        hasAddress: { type: 'boolean', title: 'Has Address' },
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
              }
            }]
          }
        }
      }
    };

    render(<DynamicForm schema={schema} />);

    // Initially hidden
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();

    // Show after checkbox
    fireEvent.click(screen.getByLabelText('Has Address'));

    await waitFor(() => {
      expect(screen.getByLabelText('Address')).toBeInTheDocument();
    });
  });
});
```

### 13.3 E2E Testing

**Test Complete Workflow**:
```typescript
describe('User Registration Form', () => {
  it('should complete registration flow', async () => {
    // 1. Render form
    render(<DynamicForm schema={registrationSchema} onSubmit={handleSubmit} />);

    // 2. Fill basic info
    await userEvent.type(screen.getByLabelText('Username'), 'testuser');
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    // 3. Select country (triggers city options linkage)
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'USA');

    // 4. Verify city options loaded
    await waitFor(() => {
      const citySelect = screen.getByLabelText('City');
      expect(citySelect).toHaveDisplayValue('');
      expect(within(citySelect).getByText('New York')).toBeInTheDocument();
    });

    // 5. Select city
    await userEvent.selectOptions(screen.getByLabelText('City'), 'New York');

    // 6. Agree to terms (enables submit button)
    await userEvent.click(screen.getByLabelText('I agree to terms'));

    // 7. Submit
    await userEvent.click(screen.getByText('Submit'));

    // 8. Verify submission
    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        country: 'USA',
        city: 'New York',
        agreeTerms: true
      });
    });
  });
});
```

---

## 14. Production Deployment

### 14.1 Performance Optimization

**Code Splitting**:
```typescript
// Lazy load large widgets
const CodeEditorWidget = lazy(() => import('./widgets/CodeEditorWidget'));
const RichTextWidget = lazy(() => import('./widgets/RichTextWidget'));

// Register with Suspense wrapper
FieldRegistry.register('code-editor', props => (
  <Suspense fallback={<Spinner />}>
    <CodeEditorWidget {...props} />
  </Suspense>
));
```

**Bundle Optimization**:
```typescript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'form-vendor': ['react-hook-form'],
          'dynamic-form': ['./src/components/DynamicForm']
        }
      }
    }
  }
};
```

**Schema Caching**:
```typescript
// Cache parsed schemas
const schemaCache = new Map<string, FieldConfig[]>();

function useParsedSchema(schema: ExtendedJSONSchema) {
  const schemaKey = JSON.stringify(schema);

  return useMemo(() => {
    if (schemaCache.has(schemaKey)) {
      return schemaCache.get(schemaKey)!;
    }

    const parsed = SchemaParser.parse(schema);
    schemaCache.set(schemaKey, parsed);
    return parsed;
  }, [schemaKey]);
}
```

### 14.2 Security Considerations

**Schema Validation**:
```typescript
// Server-side schema validation
import Ajv from 'ajv';
const ajv = new Ajv();

function validateSchema(schema: unknown): ExtendedJSONSchema {
  const valid = ajv.validateSchema(schema);
  if (!valid) {
    throw new Error('Invalid schema');
  }
  return schema as ExtendedJSONSchema;
}
```

**XSS Prevention**:
```typescript
// Sanitize user input in custom validators
import DOMPurify from 'dompurify';

const sanitizeInput = (value: string) => {
  return DOMPurify.sanitize(value);
};
```

**CSRF Protection**:
```typescript
// Include CSRF token in form submission
<DynamicForm
  schema={schema}
  onSubmit={async (data) => {
    await fetch('/api/submit', {
      method: 'POST',
      headers: {
        'X-CSRF-Token': getCSRFToken(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  }}
/>
```

### 14.3 Error Handling

**Global Error Boundary**:
```typescript
class DynamicFormErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking service
    console.error('DynamicForm Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Form error. Please try again.</div>;
    }
    return this.props.children;
  }
}

// Usage
<DynamicFormErrorBoundary>
  <DynamicForm schema={schema} />
</DynamicFormErrorBoundary>
```

**Schema Validation Error Handling**:
```typescript
function SafeDynamicForm({ schema, ...props }: DynamicFormProps) {
  try {
    const validatedSchema = validateSchema(schema);
    return <DynamicForm schema={validatedSchema} {...props} />;
  } catch (error) {
    console.error('Invalid schema:', error);
    return <div>Invalid form configuration</div>;
  }
}
```

### 14.4 Monitoring

**Performance Monitoring**:
```typescript
import { Profiler } from 'react';

<Profiler
  id="DynamicForm"
  onRender={(id, phase, actualDuration) => {
    // Send to monitoring service
    analytics.track('form_render', {
      id,
      phase,
      duration: actualDuration
    });
  }}
>
  <DynamicForm schema={schema} />
</Profiler>
```

**User Analytics**:
```typescript
<DynamicForm
  schema={schema}
  onChange={(data) => {
    // Track field interactions
    analytics.track('form_field_change', {
      form_id: 'registration',
      fields_filled: Object.keys(data).length
    });
  }}
  onSubmit={(data) => {
    // Track form submission
    analytics.track('form_submit', {
      form_id: 'registration',
      fields_count: Object.keys(data).length
    });
  }}
/>
```

---

## 15. Future Roadmap

### 15.1 Schema Versioning

**Planned Features**:
- Version field in schema (`"$version": "1.0.0"`)
- Migration tools for schema evolution
- Backward compatibility checks
- Automatic data migration

**Example**:
```json
{
  "$version": "2.0.0",
  "$migrations": {
    "1.0.0": "rename_field",
    "2.0.0": "add_validation"
  },
  "type": "object",
  "properties": {
    "emailAddress": {
      "type": "string",
      "$previousNames": ["email"]
    }
  }
}
```

### 15.2 Plugin Architecture

**Planned Features**:
- Pluggable widget systems
- Middleware for data transformation
- Event hooks for lifecycle integration
- Third-party plugin registry

**Example**:
```typescript
DynamicForm.use(ValidationPlugin);
DynamicForm.use(AnalyticsPlugin);
DynamicForm.use(A11yPlugin);

<DynamicForm
  schema={schema}
  plugins={[
    new CustomValidationPlugin(),
    new FormAnalyticsPlugin({ apiKey: 'xxx' })
  ]}
/>
```

### 15.3 Multi-Framework Support

**Planned Ports**:
- React Native (mobile support)
- Vue 3 adapter
- Svelte adapter
- Web Components (framework-agnostic)

**Core Library**:
- Extract framework-agnostic core (`@dynamic-form/core`)
- Separate adapters (`@dynamic-form/react`, `@dynamic-form/vue`)
- Shared schema parser and validation logic

### 15.4 Advanced Features

**Conditional Fields**:
- Smarter if/then/else UI rendering
- Visual schema editor integration

**Accessibility**:
- ARIA attributes generation
- Screen reader optimization
- Keyboard navigation improvements

**Internationalization**:
- Built-in i18n support for labels, errors, placeholders
- RTL layout support
- Date/number format localization

**Visual Schema Editor**:
- Drag-and-drop schema builder
- Live preview
- Schema validation and testing tools

---

## 16. Conclusion

DynamicForm provides a **production-ready, enterprise-grade** solution for building dynamic forms in React applications. The architecture successfully balances:

**Simplicity**: Easy to get started with basic forms
**Power**: Sophisticated features for complex scenarios
**Performance**: Efficiently handles large forms and arrays
**Flexibility**: Highly customizable and extensible
**Type Safety**: Full TypeScript support throughout
**Standards Compliance**: Built on JSON Schema and react-hook-form

### Key Strengths

1. **Configuration-Driven**: Entire form structure defined in JSON Schema
2. **High Performance**: Uncontrolled components minimize re-renders
3. **Rich Feature Set**: Linkage, nested forms, arrays, validation
4. **Type Safe**: Complete TypeScript support
5. **Framework Agnostic**: Core logic decoupled from UI libraries
6. **Production Ready**: Used in enterprise applications

### When to Use

✅ **Best For**:
- Backend-driven forms (schema from API)
- Multi-tenant systems (different schemas per tenant)
- Form builders and low-code platforms
- Complex workflows with conditional logic
- Applications requiring form versioning

❌ **Consider Alternatives For**:
- Simple static forms (5-10 fields)
- Highly custom one-off designs
- Logic too complex for configuration

### Getting Started

```typescript
// 1. Install dependencies
npm install react-hook-form

// 2. Define schema
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' },
    email: { type: 'string', title: 'Email', format: 'email' }
  },
  required: ['name', 'email']
};

// 3. Render form
<DynamicForm
  schema={schema}
  onSubmit={(data) => console.log(data)}
/>
```

The system is designed to **grow with your needs**—start simple and progressively add features like validation, linkage, nested structures, and custom widgets as requirements evolve.

---

**Document Version**: 1.0
**Created**: 2026-01-22
**Target Audience**: Technical architects, senior developers
**Technology Stack**: React 18+, TypeScript 5+, react-hook-form 7+, JSON Schema Draft-07/2020-12
**Status**: Production Ready
