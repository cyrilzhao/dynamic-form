import React, { useState } from 'react'
import { DynamicForm } from '@/components/DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'

/**
 * Multi-Column Layout Example
 * Demonstrates columnsCount and colSpan features
 */
export const MultiColumnLayoutExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null)

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: 'User Profile Form (Multi-Column Layout)',
    properties: {
      // Row 1: 3 fields in 3 columns
      firstName: {
        type: 'string',
        title: 'First Name',
        minLength: 2,
      },
      lastName: {
        type: 'string',
        title: 'Last Name',
        minLength: 2,
      },
      middleName: {
        type: 'string',
        title: 'Middle Name',
      },
      // Row 2: 2 fields in 3 columns
      email: {
        type: 'string',
        title: 'Email Address',
        format: 'email',
      },
      phone: {
        type: 'string',
        title: 'Phone Number',
        pattern: '^[0-9]{10,11}$',
      },
      // Row 3: 1 field spanning all 3 columns
      bio: {
        type: 'string',
        title: 'Biography',
        maxLength: 500,
        ui: {
          widget: 'textarea',
          colSpan: 3, // Span all 3 columns
        },
      },
      // Row 4: 3 fields in 3 columns
      country: {
        type: 'string',
        title: 'Country',
        enum: ['China', 'USA', 'UK', 'Japan'],
      },
      city: {
        type: 'string',
        title: 'City',
      },
      zipCode: {
        type: 'string',
        title: 'Zip Code',
        pattern: '^[0-9]{5,6}$',
      },
      // Row 5: 1 field spanning 2 columns + 1 field in 1 column
      address: {
        type: 'string',
        title: 'Street Address',
        ui: {
          colSpan: 2, // Span 2 columns
        },
      },
      age: {
        type: 'integer',
        title: 'Age',
        minimum: 18,
        maximum: 120,
      },
    },
    required: ['firstName', 'lastName', 'email'],
  }

  const handleSubmit = (data: any) => {
    console.log('Submitted data:', data)
    setFormData(data)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Multi-Column Layout Example</h3>
      <p>
        This example demonstrates the <code>columnsCount</code> and{' '}
        <code>colSpan</code> features:
      </p>
      <ul>
        <li>
          <strong>columnsCount=3</strong>: The form uses a 3-column grid layout
        </li>
        <li>
          <strong>Biography field (colSpan=3)</strong>: Spans all 3 columns
        </li>
        <li>
          <strong>Street Address field (colSpan=2)</strong>: Spans 2 columns
        </li>
        <li>Other fields use default colSpan=1</li>
      </ul>

      <div style={{ marginTop: '20px' }}>
        <DynamicForm
          schema={schema}
          columnsCount={3}
          onSubmit={handleSubmit}
        />
      </div>

      {formData && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '4px',
          }}
        >
          <h4>Submitted Data:</h4>
          <pre style={{ fontSize: '13px' }}>
            {JSON.stringify(formData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
