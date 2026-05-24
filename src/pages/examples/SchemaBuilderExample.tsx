import React, { useState } from 'react';
import { SchemaBuilder } from '../../components/SchemaBuilder/SchemaBuilder';
import type { ExtendedJSONSchema } from '../../components/DynamicForm/types/schema';
import { H3 } from '@blueprintjs/core';

const initialSchema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Root',
  properties: {
    username: {
      type: 'string',
      title: 'Name',
      minLength: 3,
    },
    age: {
      type: 'integer',
      title: 'Age',
      minimum: 0,
    },
    weight: {
      type: 'number',
      title: 'Weight',
      minimum: 0,
    },
    address: {
      type: 'object',
      title: 'Address',
      properties: {
        province: {
          type: 'string',
          title: 'Province',
        },
        city: {
          type: 'string',
          title: 'City',
        },
      },
    },
    contacts: {
      type: 'array',
      title: 'Contacts',
      items: {
        type: 'object',
        title: 'Contact',
        properties: {
          email: {
            type: 'string',
            title: 'Email',
          },
          phone: {
            type: 'string',
            title: 'Phone',
          },
        },
      },
    },
  },
  required: ['username'],
};

export const SchemaBuilderExample: React.FC = () => {
  const [schema, setSchema] = useState<ExtendedJSONSchema>(initialSchema);

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
  );
};

export default SchemaBuilderExample;
