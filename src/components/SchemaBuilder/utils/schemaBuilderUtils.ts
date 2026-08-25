import { cloneDeep, get } from "lodash";
import type { ExtendedJSONSchema } from "../../DynamicForm/types/schema";

export const defaultSchema: ExtendedJSONSchema = {
  type: "object",
  title: "Root",
  properties: {},
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
  if (path.length === 0 || path[path.length - 1] === "items")
    return path.length === 0;
  try {
    return get(schema, path) !== undefined;
  } catch {
    return false;
  }
};
