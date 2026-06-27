import { forwardRef, useRef, useState } from 'react';
import { Button, Dialog, DialogBody, DialogFooter } from '@blueprintjs/core';
import { SchemaBuilder } from '../../SchemaBuilder';
import type { SchemaBuilderRef } from '../../SchemaBuilder';
import type { FieldWidgetProps } from '../types';

export const SchemaBuilderWidget = forwardRef<HTMLElement, FieldWidgetProps>(
  ({ value, onChange, disabled, readonly }, _ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const builderRef = useRef<SchemaBuilderRef>(null);

    const handleSave = () => {
      const schema = builderRef.current?.getSchema();
      onChange?.(schema);
      setIsOpen(false);
    };

    return (
      <>
        <Button
          icon="edit"
          text="Edit Schema"
          onClick={() => setIsOpen(true)}
          disabled={disabled || readonly}
        />

        <Dialog
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Schema Editor"
          style={{ width: '90vw', maxWidth: 1200, height: '80vh' }}
        >
          <DialogBody style={{ padding: 0, height: 'calc(80vh - 110px)', overflow: 'hidden' }}>
            <SchemaBuilder
              ref={builderRef}
              defaultValue={value}
              style={{ height: '100%' }}
            />
          </DialogBody>
          <DialogFooter
            actions={
              <>
                <Button text="Cancel" onClick={() => setIsOpen(false)} />
                <Button intent="primary" text="Save" onClick={handleSave} />
              </>
            }
          />
        </Dialog>
      </>
    );
  }
);

SchemaBuilderWidget.displayName = 'SchemaBuilderWidget';
