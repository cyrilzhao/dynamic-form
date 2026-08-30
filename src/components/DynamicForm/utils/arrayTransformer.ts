import type { ExtendedJSONSchema } from "../types/schema";

/**
 * 判断是否为基本类型
 */
function isPrimitiveType(schema: ExtendedJSONSchema): boolean {
  const type = schema.type;
  return (
    type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean"
  );
}

/**
 * 判断数组值是否应保持基本类型数组格式
 */
function shouldPreserveArrayValues(schema: ExtendedJSONSchema): boolean {
  // 多选 Select 直接使用基本类型数组，不经过 useFieldArray 的对象包装
  if (
    schema.ui?.widget === "select" &&
    schema.ui.widgetProps?.multiple === true
  ) {
    return true;
  }

  // 显式指定了 static 模式
  if (schema.ui?.arrayMode === "static") {
    return true;
  }

  // 显式指定了 dynamic 模式
  if (schema.ui?.arrayMode === "dynamic") {
    return false;
  }

  // items 有 enum，默认为 static 模式
  if (schema.items && typeof schema.items === "object") {
    const items = schema.items as ExtendedJSONSchema;
    if (items.enum && items.enum.length > 0) {
      return true;
    }
  }

  return false;
}

/**
 * 将基本类型数组包装成对象数组
 * 例如：['a', 'b'] => [{ value: 'a' }, { value: 'b' }]
 *
 * 注意：此函数只在 wrapPrimitiveArrays 内部调用，调用前已确保 array 是数组
 */
function wrapPrimitiveArray(array: any[]): any[] {
  return array.map((item) => ({ value: item }));
}

/**
 * 将对象数组解包回基本类型数组
 * 例如：[{ value: 'a' }, { value: 'b' }] => ['a', 'b']
 *
 * 注意：此函数能够处理混合格式的数据（对象和基本类型混合）
 * 例如：[{ value: 'a' }, 'b', { value: 'c' }] => ['a', 'b', 'c']
 *
 * 此函数只在 unwrapPrimitiveArrays 内部调用，调用前已确保 array 是数组
 */
function unwrapPrimitiveArray(array: any[]): any[] {
  return array.map((item) => {
    // 如果是对象且有 value 属性，提取 value
    if (item && typeof item === "object" && "value" in item) {
      return item.value;
    }
    // 否则直接返回原值（已经是基本类型）
    return item;
  });
}

/**
 * 递归转换数据：将基本类型数组包装成对象数组（用于初始化）
 */
export function wrapPrimitiveArrays(
  data: any,
  schema: ExtendedJSONSchema,
): any {
  if (!data || !schema) {
    return data;
  }

  // 处理对象
  if (schema.type === "object" && schema.properties) {
    // Schema 可能因 Variant/联动暂时与当前值类型不一致；字符串等原始值
    // 不能使用 Object.keys，否则会被拆成字符索引对象。
    if (typeof data !== "object" || Array.isArray(data)) {
      return data;
    }
    const result: any = {};
    Object.keys(data).forEach((key) => {
      const fieldSchema = schema.properties![key] as ExtendedJSONSchema;
      if (fieldSchema) {
        result[key] = wrapPrimitiveArrays(data[key], fieldSchema);
      } else {
        result[key] = data[key];
      }
    });
    return result;
  }

  // 处理数组
  if (schema.type === "array" && schema.items) {
    const itemsSchema = schema.items as ExtendedJSONSchema;

    // 确保 data 是数组
    if (!Array.isArray(data)) {
      return data;
    }

    const arrayData = data as any[];

    // static 数组和多选 Select 不进行包装，直接返回原数组
    if (shouldPreserveArrayValues(schema)) {
      return arrayData;
    }

    // 如果是基本类型数组，包装成对象数组
    if (isPrimitiveType(itemsSchema)) {
      return wrapPrimitiveArray(arrayData);
    }

    // 如果是对象数组，递归处理每个元素
    if (itemsSchema.type === "object") {
      return arrayData.map((item) => wrapPrimitiveArrays(item, itemsSchema));
    }

    // 如果是嵌套数组（数组的数组），递归处理
    if (itemsSchema.type === "array") {
      return arrayData.map((item) => wrapPrimitiveArrays(item, itemsSchema));
    }

    return arrayData;
  }

  return data;
}

/**
 * 递归转换数据：将对象数组解包回基本类型数组（用于提交）
 */
export function unwrapPrimitiveArrays(
  data: any,
  schema: ExtendedJSONSchema,
): any {
  if (!data || !schema) {
    return data;
  }

  // 处理对象
  if (schema.type === "object" && schema.properties) {
    if (typeof data !== "object" || Array.isArray(data)) {
      return data;
    }
    const result: any = {};
    Object.keys(data).forEach((key) => {
      const fieldSchema = schema.properties![key] as ExtendedJSONSchema;
      if (fieldSchema) {
        result[key] = unwrapPrimitiveArrays(data[key], fieldSchema);
      } else {
        result[key] = data[key];
      }
    });
    return result;
  }

  // 处理数组
  if (schema.type === "array" && schema.items) {
    const itemsSchema = schema.items as ExtendedJSONSchema;

    // 确保 data 是数组
    if (!Array.isArray(data)) {
      return data;
    }

    const arrayData = data as any[];

    // static 数组和多选 Select 不进行解包，直接返回原数组
    if (shouldPreserveArrayValues(schema)) {
      return arrayData;
    }

    // 如果是基本类型数组，解包回基本类型
    if (isPrimitiveType(itemsSchema)) {
      return unwrapPrimitiveArray(arrayData);
    }

    // 如果是对象数组，递归处理每个元素
    if (itemsSchema.type === "object") {
      return arrayData.map((item) => unwrapPrimitiveArrays(item, itemsSchema));
    }

    // 如果是嵌套数组（数组的数组），递归处理
    if (itemsSchema.type === "array") {
      return arrayData.map((item) => unwrapPrimitiveArrays(item, itemsSchema));
    }

    return arrayData;
  }

  return data;
}
