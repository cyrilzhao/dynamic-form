import React, { useRef, useState } from 'react'
import { Button, ButtonGroup, Callout, H3, Intent } from '@blueprintjs/core'
import {
  SchemaBuilder,
  type SchemaBuilderRef,
} from '@/components/SchemaBuilder/SchemaBuilder'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import { isExtendedJSONSchema } from '@/components/SchemaBuilder/utils/validateExtendedJSONSchema'
import { validateWidgetSchemaContracts } from '@/components/SchemaBuilder/utils/widgetSchema'
import {
  basicWidgetDefinitions,
  selectionWidgetDefinitions,
  uploadInputWidgetDefinition,
  uploadListInputWidgetDefinition,
} from '@/components/DynamicForm/widgets'

// const initialSchema: ExtendedJSONSchema = {
//   type: 'object',
//   title: 'Root',
//   properties: {
//     username: {
//       type: 'string',
//       title: 'Name',
//       minLength: 3,
//     },
//     age: {
//       type: 'integer',
//       title: 'Age',
//       minimum: 0,
//     },
//     weight: {
//       type: 'number',
//       title: 'Weight',
//       minimum: 0,
//     },
//     address: {
//       type: 'object',
//       title: 'Address',
//       properties: {
//         province: {
//           type: 'string',
//           title: 'Province',
//         },
//         city: {
//           type: 'string',
//           title: 'City',
//         },
//       },
//     },
//     contacts: {
//       type: 'array',
//       title: 'Contacts',
//       items: {
//         type: 'object',
//         title: 'Contact',
//         properties: {
//           email: {
//             type: 'string',
//             title: 'Email',
//           },
//           phone: {
//             type: 'string',
//             title: 'Phone',
//           },
//         },
//       },
//     },
//   },
//   required: ['username'],
// }

const initialSchema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    users: {
      type: 'array',
      title: 'Users',
      items: {
        type: 'string',
      },
    },
    actions: {
      type: 'array',
      title: 'Actions',
      items: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            title: 'Code',
          },
          label: {
            type: 'string',
            title: 'Label',
          },
        },
      },
    },
    permissions: {
      type: 'array',
      title: 'Permissions',
      items: {
        type: 'object',
        properties: {
          users: {
            type: 'array',
            title: 'Users',
            items: {
              title: 'User',
              type: 'string',
            },
            ui: {
              widget: 'select',
              widgetProps: {
                multiple: true,
              },
              linkages: [
                {
                  type: 'options',
                  dependencies: [],
                  fulfill: {
                    function: {
                      type: 'script',
                      code: '/**\n * Generate dynamic options\n * @param {object} params - Parameters object\n * @param {object} params.formData - Current form values\n * @param {object} params.context - Linkage context\n * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)\n * @returns {Array<{label: string, value: any}>} - Options array\n */\nasync function({ formData, context, helpers }) {\n  // Example: fetch from API or calculate based on other fields\n  return formData.users.map((user) => {\n    return {\n      label: user.value,\n      value: user.value,\n    }\n  })\n}',
                    },
                  },
                },
              ],
            },
          },
          actions: {
            type: 'array',
            title: 'Actions',
            items: {
              title: 'Action',
              type: 'string',
            },
            ui: {
              widget: 'select',
              widgetProps: {
                multiple: true,
              },
              linkages: [
                {
                  type: 'options',
                  dependencies: [],
                  fulfill: {
                    function: {
                      type: 'script',
                      code: '/**\n * Generate dynamic options\n * @param {object} params - Parameters object\n * @param {object} params.formData - Current form values\n * @param {object} params.context - Linkage context\n * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)\n * @returns {Array<{label: string, value: any}>} - Options array\n */\nasync function({ formData, context, helpers }) {\n  // Example: fetch from API or calculate based on other fields\n  return formData.actions.map((action) => {\n    return {\n      label: action.label,\n      value: action.code\n    }\n  })\n}',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
}

export const SchemaBuilderExample: React.FC = () => {
  const builderRef = useRef<SchemaBuilderRef>(null)
  const [schema, setSchema] = useState<ExtendedJSONSchema>(initialSchema)
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  )
  const [snapshot, setSnapshot] = useState<ExtendedJSONSchema | null>(null)

  const handleValidate = () => {
    const currentSchema = builderRef.current?.getSchema()
    const isBaseSchemaValid = currentSchema
      ? isExtendedJSONSchema(currentSchema)
      : false
    const widgetDefinitions = [
      ...basicWidgetDefinitions,
      ...selectionWidgetDefinitions,
      uploadInputWidgetDefinition,
      uploadListInputWidgetDefinition,
    ]
    const contractIssues = currentSchema
      ? validateWidgetSchemaContracts({
          schema: currentSchema,
          widgetDefinitions,
        })
      : []
    const isValid = isBaseSchemaValid && contractIssues.length === 0
    setValidationMessage(
      isValid
        ? 'Schema is valid.'
        : contractIssues.length > 0
          ? `Schema is invalid: ${contractIssues[0].message}`
          : 'Schema is invalid.',
    )
  }

  const handleReadSchema = () => {
    const currentSchema = builderRef.current?.getSchema()
    if (currentSchema) {
      setSnapshot(currentSchema)
    }
  }

  const handleReset = () => {
    builderRef.current?.reset()
    setSchema(initialSchema)
    setSnapshot(null)
    setValidationMessage(null)
  }

  return (
    <div style={{ padding: '20px', margin: '0 auto' }}>
      <H3>Schema Builder</H3>
      <p>Visual editor for ExtendedJSONSchema with integrated preview.</p>

      <ButtonGroup style={{ marginBottom: 12 }}>
        <Button intent={Intent.PRIMARY} onClick={handleValidate}>
          Validate Schema
        </Button>
        <Button onClick={handleReadSchema}>Read Current Schema</Button>
        <Button onClick={handleReset}>Reset Schema</Button>
      </ButtonGroup>

      {validationMessage && (
        <Callout
          intent={
            validationMessage === 'Schema is valid.'
              ? Intent.SUCCESS
              : Intent.DANGER
          }
          style={{ marginBottom: 12 }}
        >
          {validationMessage}
        </Callout>
      )}

      <div style={{ marginBottom: '20px' }}>
        <SchemaBuilder
          ref={builderRef}
          defaultValue={initialSchema}
          onChange={setSchema}
        />
      </div>

      {snapshot && (
        <div style={{ marginTop: 20 }}>
          <p>Current Schema Snapshot:</p>
          <pre style={{ fontSize: 10, maxHeight: 240, overflow: 'auto' }}>
            {JSON.stringify(snapshot, null, 2)}
          </pre>
        </div>
      )}

      {/* 
      // Preview is now inside SchemaBuilder
      <div style={{ marginTop: '20px' }}>
        <p>Current Schema State in Parent Component:</p>
        <pre style={{ fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
            {JSON.stringify(schema, null, 2)}
        </pre>
      </div> 
      */}
    </div>
  )
}

export default SchemaBuilderExample
