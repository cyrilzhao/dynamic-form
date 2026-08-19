import { forwardRef } from "react";
import type { FocusEventHandler } from "react";
import { InputGroup } from "@blueprintjs/core";
import type { FieldWidgetProps } from "../types";

export interface TextWidgetProps extends FieldWidgetProps {
  onFocus?: FocusEventHandler<HTMLInputElement>;
}

export const TextWidget = forwardRef<HTMLInputElement, TextWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, onFocus, ...rest }, ref) => {
    return (
      <InputGroup
        inputRef={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        intent={error ? "danger" : "none"}
        onFocus={onFocus}
        {...rest}
      />
    );
  },
);

TextWidget.displayName = "TextWidget";
