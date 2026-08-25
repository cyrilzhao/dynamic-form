import type { ExtendedJSONSchema } from "../../DynamicForm/types/schema";
import type { LinkageType } from "../../DynamicForm/types/linkage";

const SCHEMA_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
  "null",
]);
const OPERATORS = new Set([
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "in",
  "notIn",
  "includes",
  "notIncludes",
  "isEmpty",
  "isNotEmpty",
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validFunction = (value: unknown): boolean =>
  typeof value === "string" ||
  (isRecord(value) &&
    value.type === "script" &&
    typeof value.code === "string");

const validEffect = (value: unknown, allowedKeys: string[]): boolean => {
  if (!isRecord(value)) return false;
  if (value.function !== undefined && !validFunction(value.function))
    return false;
  if (
    value.state !== undefined &&
    (!isRecord(value.state) ||
      !Object.values(value.state).every((item) => typeof item === "boolean"))
  )
    return false;
  if (
    value.options !== undefined &&
    (!Array.isArray(value.options) ||
      !value.options.every(
        (item) =>
          isRecord(item) && typeof item.label === "string" && "value" in item,
      ))
  )
    return false;
  return Object.keys(value).every((key) => allowedKeys.includes(key));
};

// 新增 LinkageType 时必须在此映射中补充规则，TypeScript 会强制提示遗漏。
const LINKAGE_VALIDATORS: Record<LinkageType, (effect: unknown) => boolean> = {
  visibility: (effect) => validEffect(effect, ["state", "function"]),
  disabled: (effect) => validEffect(effect, ["state", "function"]),
  readonly: (effect) => validEffect(effect, ["state", "function"]),
  value: (effect) => validEffect(effect, ["value", "function"]),
  options: (effect) => validEffect(effect, ["options", "function"]),
  schema: (effect) => validEffect(effect, ["schema", "function"]),
};

const validCondition = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.and !== undefined || value.or !== undefined) {
    return (
      (value.and === undefined ||
        (Array.isArray(value.and) && value.and.every(validCondition))) &&
      (value.or === undefined ||
        (Array.isArray(value.or) && value.or.every(validCondition)))
    );
  }
  return (
    typeof value.field === "string" &&
    typeof value.operator === "string" &&
    OPERATORS.has(value.operator)
  );
};

const validLinkages = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;
  return value.every((linkage) => {
    if (
      !isRecord(linkage) ||
      typeof linkage.type !== "string" ||
      !(linkage.type in LINKAGE_VALIDATORS)
    )
      return false;
    if (
      !Array.isArray(linkage.dependencies) ||
      !linkage.dependencies.every(
        (item) => typeof item === "string" && item.startsWith("#/properties/"),
      )
    )
      return false;
    if (
      linkage.when !== undefined &&
      typeof linkage.when !== "string" &&
      !validCondition(linkage.when)
    )
      return false;
    const validator = LINKAGE_VALIDATORS[linkage.type as LinkageType];
    return (
      (linkage.fulfill === undefined || validator(linkage.fulfill)) &&
      (linkage.otherwise === undefined || validator(linkage.otherwise))
    );
  });
};

/** 验证 SchemaBuilder 可编辑的 ExtendedJSONSchema 及其扩展配置。 */
export const isExtendedJSONSchema = (
  value: unknown,
  isRoot = true,
): value is ExtendedJSONSchema => {
  if (!isRecord(value)) return false;
  if (isRoot && value.type !== "object") return false;
  if (value.type !== undefined) {
    const types = Array.isArray(value.type) ? value.type : [value.type];
    if (
      !types.every((type) => typeof type === "string" && SCHEMA_TYPES.has(type))
    )
      return false;
  }
  if (
    value.properties !== undefined &&
    (!isRecord(value.properties) ||
      !Object.values(value.properties).every((item) =>
        isExtendedJSONSchema(item, false),
      ))
  )
    return false;
  if (value.items !== undefined) {
    const items = Array.isArray(value.items) ? value.items : [value.items];
    if (!items.every((item) => isExtendedJSONSchema(item, false))) return false;
  }
  if (
    value.required !== undefined &&
    (!Array.isArray(value.required) ||
      !value.required.every((item) => typeof item === "string"))
  )
    return false;
  if (
    isRecord(value.ui) &&
    value.ui.linkages !== undefined &&
    !validLinkages(value.ui.linkages)
  )
    return false;
  return true;
};
