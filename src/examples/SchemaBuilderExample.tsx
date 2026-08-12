import React, { useState } from 'react'
import { SchemaBuilder } from '@/components/SchemaBuilder/SchemaBuilder'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import { H3 } from '@blueprintjs/core'

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
  const [schema, setSchema] = useState<ExtendedJSONSchema>(initialSchema)

  return (
    <div style={{ padding: '20px', margin: '0 auto' }}>
      <H3>Schema Builder</H3>
      <p>Visual editor for ExtendedJSONSchema with integrated preview.</p>

      <div style={{ marginBottom: '20px' }}>
        <SchemaBuilder defaultValue={initialSchema} onChange={setSchema} />
      </div>

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
