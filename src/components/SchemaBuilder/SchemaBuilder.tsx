import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { cloneDeep, get, set, unset } from "lodash";
import type {
  SchemaBuilderProps,
  SchemaBuilderContextType,
  SchemaNode,
  SchemaNodeType,
  PreviewMode,
  SchemaBuilderRef,
} from "./types";
import type { ExtendedJSONSchema } from "../DynamicForm/types/schema";
import { SchemaTree } from "./components/SchemaTree/SchemaTree";
import { PropertyEditor } from "./components/PropertyEditor/PropertyEditor";
import {
  Button,
  ButtonGroup,
  Divider,
  Tabs,
  Tab,
  Dialog,
  DialogBody,
  DialogFooter,
  Callout,
} from "@blueprintjs/core";
import { DynamicForm } from "../DynamicForm";
import { CodeMirrorView } from "../CodeEditor";
import { isExtendedJSONSchema } from "./utils/validateExtendedJSONSchema";
import {
  defaultSchema,
  ensureHasFirstLevelNode,
  generateRandomKey,
  parseJsonPointer,
  validatePath,
} from "./utils/schemaBuilderUtils";
import "./SchemaBuilder.scss";

type BuilderViewMode = "edit" | "preview";

export const SchemaBuilderContext = createContext<
  SchemaBuilderContextType | undefined
>(undefined);

export const useSchemaBuilder = () => {
  const context = useContext(SchemaBuilderContext);
  if (!context) {
    throw new Error(
      "useSchemaBuilder must be used within a SchemaBuilderProvider",
    );
  }
  return context;
};

export const SchemaBuilder = forwardRef<SchemaBuilderRef, SchemaBuilderProps>(
  (
    {
      defaultValue,
      onChange,
      initialSelectedPath,
      hideTree = false,
      previewMode = "both",
      className,
      style,
    },
    ref,
  ) => {
    // 初始化时确保至少有一个一级节点
    const getInitialSchema = () => {
      const initialSchema = defaultValue || defaultSchema;
      return ensureHasFirstLevelNode(initialSchema);
    };

    // 获取第一个一级节点的路径
    const getFirstLevelNodePath = (schema: ExtendedJSONSchema): string[] => {
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const firstKey = Object.keys(schema.properties)[0];
        return ["properties", firstKey];
      }
      return [];
    };

    // 获取初始选中路径
    const getInitialSelectedPath = (schema: ExtendedJSONSchema): string[] => {
      if (!initialSelectedPath) {
        return getFirstLevelNodePath(schema);
      }

      // 支持 JSON Pointer 格式
      const pathArray =
        typeof initialSelectedPath === "string"
          ? parseJsonPointer(initialSelectedPath)
          : initialSelectedPath;

      // 验证路径是否有效
      if (pathArray.length > 0 && validatePath(schema, pathArray)) {
        return pathArray;
      }

      // 如果路径无效，回退到第一个一级节点
      console.warn("Invalid initialSelectedPath, falling back to first node");
      return getFirstLevelNodePath(schema);
    };

    const initialSchema = getInitialSchema();
    const initialSchemaRef = useRef(initialSchema);
    const [schema, setSchema] = useState<ExtendedJSONSchema>(initialSchema);
    const [selectedPath, setSelectedPath] = useState<string[]>(
      getInitialSelectedPath(initialSchema),
    );
    const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(
      { "": true },
    );
    const [previewData, setPreviewData] = useState({});
    const [previewTab, setPreviewTab] = useState<"form" | "json">("form");
    const [builderViewMode, setBuilderViewMode] =
      useState<BuilderViewMode>("edit");
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importText, setImportText] = useState("");
    const [importError, setImportError] = useState<string | null>(null);

    // Resizable sidebar state
    const [leftPanelWidth, setLeftPanelWidth] = useState(300);
    const isResizingRef = useRef(false);
    const activeViewMode: BuilderViewMode =
      previewMode === "none" ? "edit" : builderViewMode;
    const previewColumnsCount =
      typeof schema.ui?.columnsCount === "number" && schema.ui.columnsCount > 1
        ? schema.ui.columnsCount
        : undefined;

    // 暴露 ref 方法
    useImperativeHandle(
      ref,
      () => ({
        setSchema: (newSchema: ExtendedJSONSchema) => {
          const schemaToSet = ensureHasFirstLevelNode(newSchema);
          setSchema(schemaToSet);
          // 保持当前选中路径，如果路径无效则选中第一个节点
          if (!validatePath(schemaToSet, selectedPath)) {
            setSelectedPath(getFirstLevelNodePath(schemaToSet));
          }
        },
        getSchema: () => schema,
        reset: () => {
          const schemaToSet = ensureHasFirstLevelNode(initialSchemaRef.current);
          setSchema(schemaToSet);
          setSelectedPath(getInitialSelectedPath(schemaToSet));
          setExpandedPaths({ "": true });
          setPreviewData({});
        },
      }),
      [schema, selectedPath],
    );

    // Resize handler
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isResizingRef.current) {
          // Calculate new width relative to container if possible,
          // but here we can just update based on mouse position if we assume sidebar is on the left
          // A simpler approach for absolute width:
          // We need the offset of the container.
          // Let's rely on movementX? No, that accumulates errors.
          // We can track the initial mouse X and initial width.
          // But React state updates might be slow for drag.
          // Let's use requestAnimationFrame if needed, but for simple resize state update is usually fine.

          // Actually, since the component might be anywhere on screen, we need clientX relative to the sidebar start.
          // But we don't have ref to container easily here without adding more refs.
          // Let's assume standard behavior:
          // New Width = Current Width + Movement
          const movementX = Number.isFinite(e.movementX) ? e.movementX : 0;
          setLeftPanelWidth((prev) =>
            Math.max(200, Math.min(600, prev + movementX)),
          );
        }
      };

      const handleMouseUp = () => {
        isResizingRef.current = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, []);

    const startResizing = (e: React.MouseEvent) => {
      isResizingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none"; // Prevent text selection
      e.preventDefault();
    };

    const commitFocusedFieldBeforeViewChange = () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };

    const handleViewModeChange = (nextViewMode: BuilderViewMode) => {
      commitFocusedFieldBeforeViewChange();
      setBuilderViewMode(nextViewMode);
    };

    const handleImportSchema = () => {
      try {
        const parsed: unknown = JSON.parse(importText);
        if (!isExtendedJSONSchema(parsed)) throw new Error("Invalid schema");
        const schemaToSet = ensureHasFirstLevelNode(parsed);
        setSchema(schemaToSet);
        setSelectedPath(getFirstLevelNodePath(schemaToSet));
        setExpandedPaths({ "": true });
        onChange?.(schemaToSet);
        setImportError(null);
        setIsImportDialogOpen(false);
      } catch {
        setImportError("Invalid ExtendedJSONSchema");
      }
    };

    const handleToggleExpand = useCallback(
      (path: string[], expanded: boolean) => {
        const pathStr = path.join(".");
        setExpandedPaths((prev) => ({ ...prev, [pathStr]: expanded }));
      },
      [],
    );

    const handleUpdate = useCallback(
      (path: string[], updates: Partial<SchemaNode>, newKey?: string) => {
        setSchema((prevSchema) => {
          const nextSchema = cloneDeep(prevSchema);
          const targetPath = path.length === 0 ? [] : path;

          // Get the current node at the path
          const currentNode =
            path.length === 0 ? nextSchema : get(nextSchema, targetPath);

          if (!currentNode) return prevSchema;

          // Apply updates - 对于值为 undefined 的属性，需要删除而不是赋值
          Object.keys(updates).forEach((key) => {
            const value = updates[key as keyof typeof updates];
            if (value === undefined) {
              delete currentNode[key];
            } else {
              currentNode[key] = value;
            }
          });

          // 根据节点类型维护互斥的子结构，避免类型切换后残留无效子节点。
          if (updates.type === "array") {
            delete currentNode.properties;
            delete currentNode.required;

            if (!currentNode.items) {
              const newSubFieldKey = generateRandomKey({});

              currentNode.items = {
                type: "object",
                title: "Items",
                properties: {
                  [newSubFieldKey]: {
                    type: "string",
                    title: "New Field",
                  },
                },
              };
            }
          } else if (updates.type === "object") {
            delete currentNode.items;

            if (!currentNode.properties) {
              const newSubFieldKey = generateRandomKey({});

              currentNode.properties = {
                [newSubFieldKey]: {
                  type: "string",
                  title: "New Field",
                },
              };
            }
          } else if (updates.type) {
            delete currentNode.items;
            delete currentNode.properties;
            delete currentNode.required;
          }

          // Auto-expand logic
          if (updates.type === "array" || updates.type === "object") {
            const pathStr = path.join(".");
            setExpandedPaths((prev) => {
              const next = { ...prev, [pathStr]: true };
              if (updates.type === "array") {
                // Expand items as well if requested "expand new items child field"
                // Path to items is path + ['items']
                const itemsPathStr = [...path, "items"].join(".");
                next[itemsPathStr] = true;
              }
              return next;
            });
          }

          // Handle key renaming if newKey is provided and it's different from the last part of the path
          if (newKey && path.length > 0) {
            const parentPath = path.slice(0, -1);
            const oldKey = path[path.length - 1];

            // Only rename if it's property of an object (inside properties)
            if (
              parentPath[parentPath.length - 1] === "properties" &&
              oldKey !== newKey
            ) {
              const parentNode = get(nextSchema, parentPath);
              if (parentNode) {
                // Check if new key already exists to avoid overwrite
                if (parentNode[newKey]) {
                  console.warn(`Key "${newKey}" already exists.`);
                  return prevSchema;
                }

                // Rebuild properties object to maintain order
                const keys = Object.keys(parentNode);
                const newProperties: Record<string, any> = {};

                keys.forEach((key) => {
                  if (key === oldKey) {
                    newProperties[newKey] = parentNode[oldKey];
                  } else {
                    newProperties[key] = parentNode[key];
                  }
                });

                // Replace all keys
                Object.keys(parentNode).forEach(
                  (key) => delete parentNode[key],
                );
                Object.assign(parentNode, newProperties);

                // Update selected path to reflect the new key
                const newPath = [...parentPath, newKey];
                setSelectedPath(newPath);

                // Update expanded paths if needed (rename keys in expandedPaths map)
                const oldPathPrefix = path.join(".") + ".";
                const newPathPrefix = newPath.join(".") + ".";

                setExpandedPaths((prev) => {
                  const next: Record<string, boolean> = {};
                  Object.keys(prev).forEach((key) => {
                    if (key === path.join(".")) {
                      next[newPath.join(".")] = prev[key];
                    } else if (key.startsWith(oldPathPrefix)) {
                      const suffix = key.substring(oldPathPrefix.length);
                      next[newPathPrefix + suffix] = prev[key];
                    } else {
                      next[key] = prev[key];
                    }
                  });
                  return next;
                });
              }
            }
          }

          onChange?.(nextSchema);
          return nextSchema;
        });
      },
      [onChange],
    );

    const handleAddChild = useCallback(
      (path: string[], type: SchemaNodeType) => {
        setSchema((prevSchema) => {
          const nextSchema = cloneDeep(prevSchema);
          const targetNode =
            path.length === 0 ? nextSchema : get(nextSchema, path);

          if (!targetNode) return prevSchema;

          if (targetNode.type === "object") {
            if (!targetNode.properties) {
              targetNode.properties = {};
            }

            const newKey = generateRandomKey(targetNode.properties);

            let newNode: any = {
              type: type,
              title: `New Field`,
            };

            // If explicitly adding object/array (though UI defaults to string), set defaults
            if (type === "object") {
              newNode.properties = {};
            } else if (type === "array") {
              newNode.items = {
                type: "string",
                title: "Item",
              };
            }

            targetNode.properties[newKey] = newNode;

            // Auto expand parent to show new child
            const pathStr = path.join(".");
            setExpandedPaths((prev) => ({ ...prev, [pathStr]: true }));
          } else if (targetNode.type === "array") {
            // Ensure items exists
            if (!targetNode.items) {
              targetNode.items = {
                type: type,
                title: "Item",
              };
            }
            // Expand array
            const pathStr = path.join(".");
            setExpandedPaths((prev) => ({ ...prev, [pathStr]: true }));
          }

          onChange?.(nextSchema);
          return nextSchema;
        });
      },
      [onChange],
    );

    const handleAddSibling = useCallback(
      (path: string[], type: SchemaNodeType) => {
        if (path.length === 0) return;

        setSchema((prevSchema) => {
          const nextSchema = cloneDeep(prevSchema);

          if (path.length >= 2 && path[path.length - 2] === "properties") {
            const propertiesPath = path.slice(0, -1);
            const propertiesNode = get(nextSchema, propertiesPath);
            const currentKey = path[path.length - 1];

            if (propertiesNode) {
              const newKey = generateRandomKey(propertiesNode);
              let newNode: any = {
                type: type,
                title: `New Field`,
              };

              if (type === "object") {
                newNode.properties = {};
              } else if (type === "array") {
                newNode.items = { type: "string", title: "Item" };
              }

              // 在当前节点后插入
              const keys = Object.keys(propertiesNode);
              const currentIndex = keys.indexOf(currentKey);
              const newProperties: Record<string, any> = {};

              keys.forEach((key, index) => {
                newProperties[key] = propertiesNode[key];
                if (index === currentIndex) {
                  newProperties[newKey] = newNode;
                }
              });

              // 替换整个 properties 对象以保持顺序
              Object.keys(propertiesNode).forEach(
                (key) => delete propertiesNode[key],
              );
              Object.assign(propertiesNode, newProperties);
            }
          }

          onChange?.(nextSchema);
          return nextSchema;
        });
      },
      [onChange],
    );

    const handleDelete = useCallback(
      (path: string[]) => {
        if (path.length === 0) return;

        setSchema((prevSchema) => {
          const nextSchema = cloneDeep(prevSchema);
          const parentPath = path.slice(0, -1);
          const keyToDelete = path[path.length - 1];

          const parentNode =
            path.length === 1 ? nextSchema : get(nextSchema, parentPath);

          if (parentNode) {
            if (Array.isArray(parentNode)) {
              // Should not happen in standard schema structure for properties
            } else {
              if (parentPath[parentPath.length - 1] === "properties") {
                delete parentNode[keyToDelete];
              } else if (keyToDelete === "items") {
                delete parentNode.items;
              }
            }
          }

          onChange?.(nextSchema);
          return nextSchema;
        });

        setTimeout(() => {
          setSchema((currentSchema) => {
            const newPath = getFirstLevelNodePath(currentSchema);
            setSelectedPath(newPath);
            return currentSchema;
          });
        }, 0);
      },
      [onChange],
    );

    const handleMoveUp = useCallback(
      (path: string[]) => {
        if (path.length < 2 || path[path.length - 2] !== "properties") return;

        setSchema((prevSchema) => {
          const nextSchema = cloneDeep(prevSchema);
          const propertiesPath = path.slice(0, -1);
          const propertiesNode = get(nextSchema, propertiesPath);
          const currentKey = path[path.length - 1];

          if (propertiesNode) {
            const keys = Object.keys(propertiesNode);
            const currentIndex = keys.indexOf(currentKey);

            if (currentIndex > 0) {
              const newProperties: Record<string, any> = {};
              keys.forEach((key, index) => {
                if (index === currentIndex - 1) {
                  newProperties[currentKey] = propertiesNode[currentKey];
                  newProperties[key] = propertiesNode[key];
                } else if (index !== currentIndex) {
                  newProperties[key] = propertiesNode[key];
                }
              });

              Object.keys(propertiesNode).forEach(
                (key) => delete propertiesNode[key],
              );
              Object.assign(propertiesNode, newProperties);
            }
          }

          onChange?.(nextSchema);
          return nextSchema;
        });
      },
      [onChange],
    );

    const handleMoveDown = useCallback(
      (path: string[]) => {
        if (path.length < 2 || path[path.length - 2] !== "properties") return;

        setSchema((prevSchema) => {
          const nextSchema = cloneDeep(prevSchema);
          const propertiesPath = path.slice(0, -1);
          const propertiesNode = get(nextSchema, propertiesPath);
          const currentKey = path[path.length - 1];

          if (propertiesNode) {
            const keys = Object.keys(propertiesNode);
            const currentIndex = keys.indexOf(currentKey);

            if (currentIndex < keys.length - 1) {
              const newProperties: Record<string, any> = {};
              keys.forEach((key, index) => {
                if (index === currentIndex) {
                  newProperties[keys[currentIndex + 1]] =
                    propertiesNode[keys[currentIndex + 1]];
                  newProperties[currentKey] = propertiesNode[currentKey];
                } else if (index !== currentIndex + 1) {
                  newProperties[key] = propertiesNode[key];
                }
              });

              Object.keys(propertiesNode).forEach(
                (key) => delete propertiesNode[key],
              );
              Object.assign(propertiesNode, newProperties);
            }
          }

          onChange?.(nextSchema);
          return nextSchema;
        });
      },
      [onChange],
    );

    const renderPreviewPanel = () => {
      if (previewMode === "both") {
        return (
          <Tabs
            id="preview-tabs"
            selectedTabId={previewTab}
            onChange={(id) => setPreviewTab(id as any)}
          >
            <Tab
              id="form"
              title="Live Preview"
              panel={
                <div className="preview-content">
                  <DynamicForm
                    schema={schema}
                    onChange={setPreviewData}
                    columnsCount={previewColumnsCount}
                  />
                  <Divider />
                  <div className="preview-data">
                    <h5>Data</h5>
                    <pre>{JSON.stringify(previewData, null, 2)}</pre>
                  </div>
                </div>
              }
            />
            <Tab
              id="json"
              title="JSON Schema"
              panel={
                <div className="preview-content">
                  <pre>{JSON.stringify(schema, null, 2)}</pre>
                </div>
              }
            />
          </Tabs>
        );
      }

      if (previewMode === "form") {
        return (
          <div className="preview-content">
            <DynamicForm
              schema={schema}
              onChange={setPreviewData}
              columnsCount={previewColumnsCount}
            />
            <Divider />
            <div className="preview-data">
              <h5>Data</h5>
              <pre>{JSON.stringify(previewData, null, 2)}</pre>
            </div>
          </div>
        );
      }

      return (
        <div className="preview-content">
          <pre>{JSON.stringify(schema, null, 2)}</pre>
        </div>
      );
    };

    return (
      <SchemaBuilderContext.Provider
        value={{
          schema,
          selectedPath,
          expandedPaths,
          onSelect: setSelectedPath,
          onUpdate: handleUpdate,
          onAddChild: handleAddChild,
          onAddSibling: handleAddSibling,
          onDelete: handleDelete,
          onToggleExpand: handleToggleExpand,
          onMoveUp: handleMoveUp,
          onMoveDown: handleMoveDown,
        }}
      >
        <div className={`schema-builder ${className || ""}`} style={style}>
          {activeViewMode === "edit" && !hideTree && (
            <>
              <div
                className="schema-builder-left"
                style={{ width: leftPanelWidth }}
              >
                <SchemaTree />
              </div>
              <div
                className="schema-builder-resizer"
                onMouseDown={startResizing}
              />
            </>
          )}
          <div className="schema-builder-main">
            <div className="schema-builder-toolbar">
              <Button
                text="Import JSON"
                onClick={() => {
                  setImportText(JSON.stringify(schema, null, 2));
                  setImportError(null);
                  setIsImportDialogOpen(true);
                }}
              />
              <ButtonGroup>
                <Button
                  text="Edit"
                  active={activeViewMode === "edit"}
                  intent={activeViewMode === "edit" ? "primary" : "none"}
                  onClick={() => handleViewModeChange("edit")}
                />
                {previewMode !== "none" && (
                  <Button
                    text="Preview"
                    active={activeViewMode === "preview"}
                    intent={activeViewMode === "preview" ? "primary" : "none"}
                    onClick={() => handleViewModeChange("preview")}
                  />
                )}
              </ButtonGroup>
            </div>
            <div
              className={
                activeViewMode === "preview"
                  ? "schema-builder-preview"
                  : "schema-builder-middle"
              }
            >
              {activeViewMode === "preview" ? (
                renderPreviewPanel()
              ) : (
                <PropertyEditor />
              )}
            </div>
          </div>
        </div>
        <Dialog
          isOpen={isImportDialogOpen}
          title="Import JSON Schema"
          className="schema-builder-import-dialog"
          onClose={() => setIsImportDialogOpen(false)}
        >
          <DialogBody>
            {importError && <Callout intent="danger">{importError}</Callout>}
            <CodeMirrorView
              value={importText}
              language="json"
              onChange={setImportText}
              lineWrapping
            />
          </DialogBody>
          <DialogFooter
            actions={
              <>
                <Button onClick={() => setIsImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button intent="primary" onClick={handleImportSchema}>
                  Apply
                </Button>
              </>
            }
          />
        </Dialog>
      </SchemaBuilderContext.Provider>
    );
  },
);
