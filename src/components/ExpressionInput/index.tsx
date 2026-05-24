import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Braces } from 'lucide-react';
import './index.scss';

export interface Variable {
  label: string;
  value: string; // The full path, e.g. "Start.data.id"
  type?: string;
  group?: string;
}

type InputMode = 'text' | 'expression';

interface ExpressionInputProps {
  value?: string;
  onChange?: (value: string) => void;
  variables?: Variable[];
  placeholder?: string;
}

// Enhanced mock variables with dot notation
const DEFAULT_VARIABLES: Variable[] = [
  { label: 'Start Data', value: 'Start.data', type: 'object', group: 'Start Node' },
  { label: 'Start Body', value: 'Start.data.body', type: 'object', group: 'Start Node' },
  { label: 'User ID', value: 'Start.data.userId', type: 'string', group: 'Start Node' },
  { label: 'User Name', value: 'Start.data.userName', type: 'string', group: 'Start Node' },
  { label: 'Loop Item', value: 'loop.item', type: 'any', group: 'Loop Context' },
  { label: 'Loop Index', value: 'loop.index', type: 'number', group: 'Loop Context' },
  { label: 'Env API Key', value: 'env.API_KEY', type: 'string', group: 'Environment' },
];

export const ExpressionInput: React.FC<ExpressionInputProps> = ({
  value = '',
  onChange,
  variables = DEFAULT_VARIABLES,
  placeholder = 'Type ${ to select variable...',
}) => {
  const [mode, setMode] = useState<InputMode>('text');

  // 表达式模式下，去除外层的 ${ } 用于内部显示
  const getDisplayValue = (val: string): string => {
    if (mode === 'expression' && val.startsWith('${') && val.endsWith('}')) {
      return val.slice(2, -1);
    }
    return val;
  };

  // 表达式模式下，包装用户输入为 ${ }
  const wrapExpressionValue = (val: string): string => {
    if (mode === 'expression') {
      return `\${${val}}`;
    }
    return val;
  };

  const displayValue = getDisplayValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [filteredVars, setFilteredVars] = useState<Variable[]>([]);
  const [activeVarIndex, setActiveVarIndex] = useState(0);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const variableListRef = useRef<HTMLDivElement>(null);

  // --- Syntax Highlighting Logic ---
  const highlights = useMemo(() => {
    // 文本模式下不做任何高亮
    if (mode === 'text') {
      return <span>{value}</span>;
    }

    // 表达式模式下，检测输入内容是否匹配变量并高亮
    const variableValues = variables.map(v => v.value.toLowerCase());
    const tokens = displayValue.split(/(\s+|[+\-*/(),])/);

    return tokens.map((token, index) => {
      const isVariable = variableValues.includes(token.toLowerCase());
      if (isVariable) {
        return (
          <span key={index} className="token-variable">
            {token}
          </span>
        );
      }
      return <span key={index}>{token}</span>;
    });
  }, [value, displayValue, mode, variables]);

  // --- Scroll Sync ---
  const handleScroll = useCallback(() => {
    if (textareaRef.current && backdropRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;

      // Use transform to move the backdrop content
      const highlightsDiv = backdropRef.current.querySelector('.highlights') as HTMLElement;
      if (highlightsDiv) {
        highlightsDiv.style.transform = `translate(-${scrollLeft}px, -${scrollTop}px)`;
      }
    }
  }, []);

  // Filter variables based on current input context
  useEffect(() => {
    // 文本模式下不显示变量下拉菜单
    if (mode === 'text') {
      setFilteredVars([]);
      setIsOpen(false);
      return;
    }

    // 表达式模式下的变量匹配逻辑
    const inputText = displayValue.trim();
    if (!inputText) {
      setFilteredVars([]);
      setIsOpen(false);
      return;
    }

    // 提取最后一个正在输入的 token（以空格、运算符等分隔）
    const tokenMatch = inputText.match(/[a-zA-Z_][a-zA-Z0-9_.]*$/);
    const currentToken = tokenMatch ? tokenMatch[0].toLowerCase() : '';

    if (!currentToken) {
      setFilteredVars([]);
      setIsOpen(false);
      return;
    }

    // 匹配变量
    const matchResults: Array<{ variable: Variable; matchLength: number }> = [];

    variables.forEach(v => {
      const varValue = v.value.toLowerCase();
      if (varValue.startsWith(currentToken)) {
        matchResults.push({ variable: v, matchLength: currentToken.length });
      }
    });

    // 按匹配长度降序排序
    matchResults.sort((a, b) => b.matchLength - a.matchLength);

    const suggestions = matchResults.map(r => r.variable);
    setFilteredVars(suggestions);
    setActiveVarIndex(0);

    // 如果当前 token 完全匹配了某个变量，不显示下拉菜单
    const hasExactMatch = suggestions.some(v => v.value.toLowerCase() === currentToken);
    setIsOpen(suggestions.length > 0 && !hasExactMatch);
  }, [mode, displayValue, variables]);

  // Sync scrollbar width when value changes
  useEffect(() => {
    handleScroll();
  }, [value]);

  // Calculate popover position when it opens
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPopoverPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both container and popover
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Scroll active variable item into view
  const scrollActiveItemIntoView = useCallback((index: number) => {
    if (!variableListRef.current) return;

    const listEl = variableListRef.current;
    const items = listEl.querySelectorAll('.variable-item');
    const activeItem = items[index] as HTMLElement;

    if (!activeItem) return;

    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // Monitor textarea resize to handle scrollbar changes
  useEffect(() => {
    if (!textareaRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger scroll handler to recalculate padding when size changes
      handleScroll();
    });

    resizeObserver.observe(textareaRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleScroll]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // 表达式模式下，自动包装为 ${ }
    if (mode === 'expression') {
      onChange?.(wrapExpressionValue(newValue));
      return;
    }

    // 文本模式下直接传递值
    onChange?.(newValue);
  };

  const insertVariable = (variable: Variable) => {
    // 表达式模式下，替换当前正在输入的 token
    if (mode === 'expression') {
      const inputText = displayValue;
      const tokenMatch = inputText.match(/[a-zA-Z_][a-zA-Z0-9_.]*$/);
      const tokenStart = tokenMatch ? inputText.length - tokenMatch[0].length : inputText.length;

      const newValue = inputText.slice(0, tokenStart) + variable.value;
      onChange?.(wrapExpressionValue(newValue));
      setIsOpen(false);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursor = newValue.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 0);
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle autocomplete popover navigation
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const newIndex = (activeVarIndex + 1) % filteredVars.length;
        setActiveVarIndex(newIndex);
        scrollActiveItemIntoView(newIndex);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const newIndex = (activeVarIndex - 1 + filteredVars.length) % filteredVars.length;
        setActiveVarIndex(newIndex);
        scrollActiveItemIntoView(newIndex);
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredVars[activeVarIndex]) {
          insertVariable(filteredVars[activeVarIndex]);
        }
        return;
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
    }
  };

  // 切换模式时处理值的转换
  const handleModeToggle = () => {
    if (mode === 'text') {
      // 切换到表达式模式，将当前内容包装为 ${}
      setMode('expression');
      if (!value.startsWith('${') || !value.endsWith('}')) {
        onChange?.(`\${${value}}`);
      }
    } else {
      // 切换到文本模式，去除外层的 ${}
      setMode('text');
      if (value.startsWith('${') && value.endsWith('}')) {
        onChange?.(value.slice(2, -1));
      }
    }
    textareaRef.current?.focus();
  };

  return (
    <div
      className={`expression-input-container ${mode === 'expression' ? 'expression-mode' : ''}`}
      ref={containerRef}
    >
      <div className="editor-wrapper">
        {mode === 'expression' && <span className="expression-decorator left">{'${'}</span>}
        <div className="backdrop" ref={backdropRef}>
          <div className="highlights">
            {highlights}
            {/* Ending space to ensure height matches if text ends with newline */}
            <br />
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="expression-textarea"
          value={mode === 'expression' ? displayValue : value}
          onChange={handleInputChange}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'expression' ? 'Enter variable name...' : placeholder}
          spellCheck={false}
        />
        {mode === 'expression' && <span className="expression-decorator right">{'}'}</span>}
      </div>
      <button
        ref={buttonRef}
        className={`variable-trigger-btn ${mode === 'expression' ? 'active' : ''}`}
        onClick={handleModeToggle}
        title={mode === 'expression' ? 'Switch to Text Mode' : 'Switch to Expression Mode'}
        type="button"
      >
        <Braces size={12} />
      </button>

      {isOpen &&
        filteredVars.length > 0 &&
        createPortal(
          <div
            ref={popoverRef}
            className="variable-picker-popover"
            style={{
              position: 'fixed',
              top: `${popoverPosition.top}px`,
              left: `${popoverPosition.left}px`,
            }}
          >
            <div className="variable-group" ref={variableListRef}>
              {/* Grouping logic simplified for demo: just show filtered list */}
              {filteredVars.map((v, idx) => (
                <div
                  key={v.value}
                  className={`variable-item ${idx === activeVarIndex ? 'active' : ''}`}
                  onClick={() => insertVariable(v)}
                  onMouseEnter={() => setActiveVarIndex(idx)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{v.label}</span>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{v.value}</span>
                  </div>
                  {v.type && <span className="var-type">{v.type}</span>}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
