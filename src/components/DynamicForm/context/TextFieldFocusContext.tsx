import React, { createContext, useContext } from "react";
import type { TextFieldFocusPayload } from "../types";

type TextFieldFocusHandler = (payload: TextFieldFocusPayload) => void;

const TextFieldFocusContext = createContext<TextFieldFocusHandler | undefined>(
  undefined,
);

interface TextFieldFocusProviderProps {
  children: React.ReactNode;
  onTextFieldFocus?: TextFieldFocusHandler;
}

/** 提供文本字段 focus 的页面级回调，供嵌套 DynamicForm 继承。 */
export const TextFieldFocusProvider: React.FC<TextFieldFocusProviderProps> = ({
  children,
  onTextFieldFocus,
}) => {
  return (
    <TextFieldFocusContext.Provider value={onTextFieldFocus}>
      {children}
    </TextFieldFocusContext.Provider>
  );
};

/** 获取最近一层 DynamicForm 提供的文本字段 focus 回调。 */
// Context Hook 必须与 Provider 共用同一个模块级 Context 实例。
// eslint-disable-next-line react-refresh/only-export-components
export const useTextFieldFocus = (): TextFieldFocusHandler | undefined => {
  return useContext(TextFieldFocusContext);
};
