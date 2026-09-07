import { cloneDeep, get } from "lodash";
import type { ExtendedJSONSchema } from "../../DynamicForm/types/schema";

const NUMERIC_SCHEMA_KEYWORDS = new Set([
  "multipleOf",
  "maximum",
  "exclusiveMaximum",
  "minimum",
  "exclusiveMinimum",
  "maxLength",
  "minLength",
  "maxItems",
  "minItems",
  "maxProperties",
  "minProperties",
  "maxContains",
  "minContains",
]);

export const defaultSchema: ExtendedJSONSchema = {
  type: "object",
  title: "Root",
  properties: {},
};

/**
 * 递归将 JSON Schema 数字关键字转换为 number，避免表单输入或导入值以字符串保存。
 */
export const normalizeSchemaNumericValues = (
  schema: ExtendedJSONSchema,
): ExtendedJSONSchema => {
  const normalized = cloneDeep(schema) as unknown;

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    Object.keys(record).forEach((key) => {
      const child = record[key];
      if (NUMERIC_SCHEMA_KEYWORDS.has(key) && typeof child === "string") {
        const trimmed = child.trim();
        const parsed = trimmed === "" ? Number.NaN : Number(trimmed);
        if (Number.isFinite(parsed)) {
          record[key] = parsed;
        } else {
          delete record[key];
        }
        return;
      }
      visit(child);
    });
  };

  visit(normalized);
  return normalized as ExtendedJSONSchema;
};

export const generateRandomKey = (
  properties: Record<string, unknown>,
): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let newKey = "";
  do {
    let randomStr = "";
    for (let index = 0; index < 4; index += 1) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newKey = `field_${randomStr}`;
  } while (properties[newKey]);
  return newKey;
};

export const ensureHasFirstLevelNode = (
  schema: ExtendedJSONSchema | null | undefined,
): ExtendedJSONSchema => {
  if (
    !schema ||
    typeof schema !== "object" ||
    Object.keys(schema).length === 0
  ) {
    const newSchema = cloneDeep(defaultSchema);
    newSchema.properties![generateRandomKey(newSchema.properties!)] = {
      type: "string",
      title: "New Field",
    };
    return newSchema;
  }
  if (schema.type !== "object") {
    const newSchema: ExtendedJSONSchema = {
      type: "object",
      title: schema.title || "Root",
      properties: {},
    };
    newSchema.properties![generateRandomKey(newSchema.properties!)] = {
      type: "string",
      title: "New Field",
    };
    return newSchema;
  }
  const hasProperties =
    schema.properties && Object.keys(schema.properties).length > 0;
  if (!hasProperties) {
    const newSchema = cloneDeep(schema);
    newSchema.properties ??= {};
    newSchema.properties[generateRandomKey(newSchema.properties)] = {
      type: "string",
      title: "New Field",
    };
    return newSchema;
  }
  return schema;
};

export const parseJsonPointer = (pointer: string): string[] => {
  if (!pointer || !pointer.startsWith("#/")) return [];
  return pointer.slice(2).split("/").filter(Boolean);
};

export const validatePath = (
  schema: ExtendedJSONSchema,
  path: string[],
): boolean => {
  if (path.length === 0) return true;
  try {
    return get(schema, path) !== undefined;
  } catch {
    return false;
  }
};
