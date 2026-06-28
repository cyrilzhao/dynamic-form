import type { ExtendedJSONSchema } from '../types/schema'

/**
 * Schema 级别验证器
 * 负责处理 JSON Schema 中的条件验证机制
 */
export class SchemaValidator {
  private schema: ExtendedJSONSchema
  private rootSchema: ExtendedJSONSchema

  constructor(schema: ExtendedJSONSchema, rootSchema?: ExtendedJSONSchema) {
    this.schema = schema
    this.rootSchema = rootSchema || schema
  }

  /**
   * 验证整个表单数据
   * 按顺序执行以下验证：
   * 1. required 字段验证
   * 2. properties 字段约束验证
   * 3. dependencies（字段依赖）
   * 4. if/then/else（条件分支）
   * 5. allOf（逻辑与）
   * 6. anyOf（逻辑或）
   * 7. oneOf（逻辑异或）
   * @param formData - 表单数据对象
   * @param recursive - 是否递归验证嵌套字段（默认 false，只验证当前层）
   * @returns 验证错误对象，键为字段名，值为错误信息
   */
  validate(
    formData: Record<string, any>,
    recursive: boolean = false
  ): Record<string, string> {
    return this.validateAgainstSchema(formData, this.schema, recursive)
  }

  /**
   * 检查值是否存在（非空、非 undefined、非空字符串）
   * @param value - 要检查的值
   * @returns 如果值存在返回 true，否则返回 false
   */
  private hasValue(value: any): boolean {
    if (value === null || value === undefined) return false
    if (typeof value === 'string' && value.trim() === '') return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  }

  /**
   * 获取字段的标题（用于错误提示）
   * 支持嵌套路径查找，如 "address.city"
   * 优先从根 schema 查找，如果找不到再从传入的 schema 查找
   * @param fieldName - 字段名称
   * @param schema - 可选的 Schema，用于查找字段标题
   * @returns 字段标题，如果找不到则返回字段名称本身
   */
  private getFieldTitle(
    fieldName: string,
    schema?: ExtendedJSONSchema
  ): string {
    // 优先从根 schema 查找（包含所有字段的 title）
    const title = this.findFieldTitle(fieldName, this.rootSchema)
    if (title) return title

    // 如果根 schema 没找到，再从传入的 schema 查找
    if (schema) {
      const schemaTitle = this.findFieldTitle(fieldName, schema)
      if (schemaTitle) return schemaTitle
    }

    return fieldName
  }

  /**
   * 递归查找字段的 title
   * 在 schema 的 properties 中查找指定字段的 title 属性
   * 如果当前层级找不到，会递归查找嵌套的 object 类型字段
   * @param fieldName - 字段名称
   * @param schema - 要查找的 Schema
   * @returns 字段标题，如果找不到则返回 null
   */
  private findFieldTitle(
    fieldName: string,
    schema: ExtendedJSONSchema
  ): string | null {
    if (!schema.properties) return null

    // 直接查找当前层级
    const fieldSchema = schema.properties[fieldName]
    if (
      fieldSchema &&
      typeof fieldSchema === 'object' &&
      'title' in fieldSchema
    ) {
      const title = fieldSchema.title
      if (title && typeof title === 'string') {
        return title
      }
    }

    // 递归查找嵌套的 object 类型字段
    for (const [_, propSchema] of Object.entries(schema.properties)) {
      if (
        typeof propSchema === 'object' &&
        propSchema.type === 'object' &&
        propSchema.properties
      ) {
        const nestedTitle = this.findFieldTitle(fieldName, propSchema)
        if (nestedTitle) return nestedTitle
      }
    }

    return null
  }

  /**
   * 检查数据是否匹配指定的 schema
   * @param formData - 表单数据对象
   * @param schema - 要匹配的 JSON Schema
   * @returns 如果数据匹配 schema 返回 true，否则返回 false
   */
  private matchesSchema(
    formData: Record<string, any>,
    schema: ExtendedJSONSchema
  ): boolean {
    const errors = this.validateAgainstSchema(formData, schema, false)
    return Object.keys(errors).length === 0
  }

  /**
   * 验证 dependencies（字段依赖）
   * 支持两种依赖形式：
   * 1. 简单依赖（数组形式）：当触发字段有值时，依赖字段必填
   * 2. Schema 依赖（对象形式）：当触发字段有值时，验证整个表单数据是否满足依赖 schema
   * @param formData - 表单数据对象
   * @param errors - 错误对象，用于收集验证错误
   * @param recursive - 是否递归验证嵌套字段
   */
  private validateDependencies(
    formData: Record<string, any>,
    errors: Record<string, string>,
    recursive: boolean
  ): void {
    const dependencies = this.schema.dependencies
    if (!dependencies) return

    for (const [triggerField, dependentFields] of Object.entries(
      dependencies
    )) {
      // 如果触发字段有值
      if (this.hasValue(formData[triggerField])) {
        // 检查依赖字段
        if (Array.isArray(dependentFields)) {
          // 简单依赖：检查依赖字段是否都有值
          for (const dependentField of dependentFields) {
            if (!this.hasValue(formData[dependentField])) {
              errors[dependentField] =
                `${this.getFieldTitle(dependentField)} is required when ${this.getFieldTitle(triggerField)} is provided`
            }
          }
        } else if (typeof dependentFields === 'object') {
          // Schema 依赖：验证整个表单数据是否满足依赖 schema
          const dependencyErrors = this.validateAgainstSchema(
            formData,
            dependentFields as ExtendedJSONSchema,
            recursive
          )
          Object.assign(errors, dependencyErrors)
        }
      }
    }
  }

  /**
   * 验证 if/then/else（条件分支）
   * 根据 if 条件是否满足，选择应用 then 或 else schema 进行验证
   * @param formData - 表单数据对象
   * @param errors - 错误对象，用于收集验证错误
   * @param recursive - 是否递归验证嵌套字段
   */
  private validateConditional(
    formData: Record<string, any>,
    errors: Record<string, string>,
    recursive: boolean
  ): void {
    const { if: ifSchema, then: thenSchema, else: elseSchema } = this.schema

    if (!ifSchema) return

    // 检查 if 条件是否满足
    const ifMatches = this.matchesSchema(
      formData,
      ifSchema as ExtendedJSONSchema
    )

    // 根据条件选择对应的 schema
    const targetSchema = ifMatches ? thenSchema : elseSchema

    if (targetSchema) {
      // 验证表单数据是否满足目标 schema
      const conditionalErrors = this.validateAgainstSchema(
        formData,
        targetSchema as ExtendedJSONSchema,
        recursive
      )
      Object.assign(errors, conditionalErrors)
    }
  }

  /**
   * 验证 allOf（逻辑与）
   * 表单数据必须满足所有子 schema 的验证规则
   * @param formData - 表单数据对象
   * @param errors - 错误对象，用于收集验证错误
   * @param recursive - 是否递归验证嵌套字段
   */
  private validateAllOf(
    formData: Record<string, any>,
    errors: Record<string, string>,
    recursive: boolean
  ): void {
    const allOf = this.schema.allOf
    if (!allOf || !Array.isArray(allOf)) return

    // 必须满足所有子 schema
    for (const subSchema of allOf) {
      const subErrors = this.validateAgainstSchema(
        formData,
        subSchema as ExtendedJSONSchema,
        recursive
      )
      Object.assign(errors, subErrors)
    }
  }

  /**
   * 验证 anyOf（逻辑或）
   * 表单数据至少满足一个子 schema 的验证规则
   * 如果没有任何 schema 匹配，会收集所有子 schema 的错误信息
   * @param formData - 表单数据对象
   * @param errors - 错误对象，用于收集验证错误
   * @param recursive - 是否递归验证嵌套字段
   */
  private validateAnyOf(
    formData: Record<string, any>,
    errors: Record<string, string>,
    recursive: boolean
  ): void {
    const anyOf = this.schema.anyOf
    if (!anyOf || !Array.isArray(anyOf)) return

    // 至少满足一个子 schema
    const allSubErrors: Record<string, string>[] = []
    let hasMatch = false

    for (const subSchema of anyOf) {
      const subErrors = this.validateAgainstSchema(
        formData,
        subSchema as ExtendedJSONSchema,
        recursive
      )
      if (Object.keys(subErrors).length === 0) {
        hasMatch = true
        break
      }
      allSubErrors.push(subErrors)
    }

    // 如果没有任何一个 schema 匹配，收集所有错误
    if (!hasMatch) {
      // 合并所有子 schema 的错误信息
      const combinedErrors: Record<string, string[]> = {}
      for (const subErrors of allSubErrors) {
        for (const [field, message] of Object.entries(subErrors)) {
          if (!combinedErrors[field]) {
            combinedErrors[field] = []
          }
          combinedErrors[field].push(message)
        }
      }

      // 生成友好的错误提示
      for (const [field, messages] of Object.entries(combinedErrors)) {
        errors[field] =
          `Must satisfy at least one of the following conditions: ${messages.join(' or ')}`
      }
    }
  }

  /**
   * 验证 oneOf（逻辑异或）
   * 表单数据有且仅有一个子 schema 匹配
   * 如果没有任何 schema 匹配，返回最后一个 schema 的错误
   * 如果多个 schema 匹配，返回互斥条件冲突错误
   * @param formData - 表单数据对象
   * @param errors - 错误对象，用于收集验证错误
   * @param recursive - 是否递归验证嵌套字段
   */
  private validateOneOf(
    formData: Record<string, any>,
    errors: Record<string, string>,
    recursive: boolean
  ): void {
    const oneOf = this.schema.oneOf
    if (!oneOf || !Array.isArray(oneOf)) return

    // 有且仅有一个子 schema 匹配
    let matchCount = 0
    let bestMatchErrors: Record<string, string> = {}
    let minErrorCount = Infinity

    for (const subSchema of oneOf) {
      const subErrors = this.validateAgainstSchema(
        formData,
        subSchema as ExtendedJSONSchema,
        recursive
      )
      const errorCount = Object.keys(subErrors).length

      if (errorCount === 0) {
        matchCount++
      } else if (errorCount < minErrorCount) {
        // 保存错误最少的 schema 的错误（最接近匹配）
        minErrorCount = errorCount
        bestMatchErrors = subErrors
      }
    }

    if (matchCount === 0) {
      // 没有任何 schema 匹配，返回最接近匹配的 schema 的错误
      Object.assign(errors, bestMatchErrors)
    } else if (matchCount > 1) {
      // 多个 schema 匹配（互斥条件冲突）
      errors['_schema'] = 'Data matches multiple mutually exclusive conditions'
    }
    // matchCount === 1 时验证通过，不添加错误
  }

  /**
   * 根据 schema 验证表单数据
   * 这是核心验证方法，递归处理各种验证规则：
   * 1. 验证 required 字段
   * 2. 验证 properties 中的约束
   * 3. 递归处理嵌套的条件验证（oneOf/anyOf/allOf/if）
   * @param formData - 表单数据对象
   * @param schema - 要验证的 JSON Schema
   * @param recursive - 是否递归验证嵌套字段
   * @returns 验证错误对象，键为字段名，值为错误信息
   */
  private validateAgainstSchema(
    formData: Record<string, any>,
    schema: ExtendedJSONSchema,
    recursive: boolean
  ): Record<string, string> {
    const errors: Record<string, string> = {}

    // 1. 验证 required 字段
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (schema.properties && !(requiredField in schema.properties)) continue
        if (!this.hasValue(formData[requiredField])) {
          errors[requiredField] =
            `${this.getFieldTitle(requiredField, schema)} is required`
        }
      }
    }

    // 2. 验证 properties 中的约束
    if (schema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        if (typeof fieldSchema === 'boolean') continue
        const fieldErrors = this.validateFieldValue({
          value: formData[fieldName],
          schema: fieldSchema,
          fieldName,
          parentSchema: schema,
          recursive,
        })
        Object.assign(errors, fieldErrors)
      }
    }

    // 3-7. 条件验证（各自独立判断，修复 dependencies 仅在其他条件存在时才触发的 bug）
    const nestedValidator = new SchemaValidator(schema, this.rootSchema)
    if (schema.dependencies) nestedValidator.validateDependencies(formData, errors, recursive)
    if (schema.if) nestedValidator.validateConditional(formData, errors, recursive)
    if (schema.allOf) nestedValidator.validateAllOf(formData, errors, recursive)
    if (schema.anyOf) nestedValidator.validateAnyOf(formData, errors, recursive)
    if (schema.oneOf) nestedValidator.validateOneOf(formData, errors, recursive)

    return errors
  }

  /**
   * 验证单个字段的值
   * 根据字段的 schema 类型，调用相应的类型验证方法
   * 支持的验证：
   * - const（常量值）
   * - enum（枚举值）
   * - string（字符串类型）
   * - number/integer（数字类型）
   * - array（数组类型）
   * - object（对象类型）
   * @param value - 要验证的字段值
   * @param schema - 字段的 JSON Schema 定义
   * @param fieldName - 字段名称
   * @param parentSchema - 父级 Schema，用于获取字段标题
   * @param recursive - 是否递归验证嵌套字段
   * @returns 验证错误对象，键为字段名，值为错误信息
   */
  private validateFieldValue({
    value,
    schema,
    fieldName,
    parentSchema,
    recursive,
  }: {
    value: any
    schema: ExtendedJSONSchema
    fieldName: string
    parentSchema?: ExtendedJSONSchema
    recursive: boolean
  }): Record<string, string> {
    const errors: Record<string, string> = {}

    // 如果值不存在，跳过验证（required 已在上层处理）
    // 但对于数组类型，即使是空数组也需要验证类型约束（如 minItems）
    const isEmptyArray = Array.isArray(value) && value.length === 0
    if (!this.hasValue(value) && !isEmptyArray) return errors

    // 验证 const（常量值）
    if (schema.const !== undefined && value !== schema.const) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} must be ${schema.const}`
      return errors
    }

    // 验证 enum（枚举值）
    if (schema.enum && !schema.enum.includes(value)) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} must be one of: ${schema.enum.join(', ')}`
      return errors
    }

    // 根据类型验证
    // 如果没有明确的 type，根据其他字段推断类型
    let inferredType = schema.type
    if (!inferredType) {
      if (
        schema.pattern ||
        schema.minLength ||
        schema.maxLength ||
        schema.format
      ) {
        inferredType = 'string'
      } else if (
        schema.minimum !== undefined ||
        schema.maximum !== undefined ||
        schema.multipleOf !== undefined
      ) {
        inferredType = 'number'
      } else if (
        schema.minItems !== undefined ||
        schema.maxItems !== undefined ||
        schema.uniqueItems
      ) {
        inferredType = 'array'
      } else if (
        schema.minProperties !== undefined ||
        schema.maxProperties !== undefined
      ) {
        inferredType = 'object'
      }
    }

    switch (inferredType) {
      case 'string':
        this.validateString({ value, schema, fieldName, errors, parentSchema })
        break
      case 'number':
      case 'integer':
        this.validateNumber({ value, schema, fieldName, errors, parentSchema })
        break
      case 'array':
        this.validateArray({
          value,
          schema,
          fieldName,
          errors,
          parentSchema,
          recursive,
        })
        break
      case 'object':
        this.validateObject({
          value,
          schema,
          fieldName,
          errors,
          parentSchema,
          recursive,
        })
        break
    }

    return errors
  }

  /**
   * 验证字符串类型
   * @param value - 要验证的字符串值
   * @param schema - 字段的 JSON Schema 定义
   * @param fieldName - 字段名称
   * @param errors - 错误对象，用于收集验证错误
   * @param parentSchema - 父级 Schema，用于获取字段标题
   */
  private validateString({
    value,
    schema,
    fieldName,
    errors,
    parentSchema,
  }: {
    value: string
    schema: ExtendedJSONSchema
    fieldName: string
    errors: Record<string, string>
    parentSchema?: ExtendedJSONSchema
  }): void {
    // 验证最小长度
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} minimum length is ${schema.minLength} characters`
    }

    // 验证最大长度
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} maximum length is ${schema.maxLength} characters`
    }

    // 验证正则表达式
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern)
      if (!regex.test(value)) {
        errors[fieldName] =
          `${this.getFieldTitle(fieldName, parentSchema)} invalid format`
      }
    }

    // 验证格式（format）
    if (schema.format) {
      const formatError = this.validateFormat({
        value,
        format: schema.format,
        fieldName,
        parentSchema,
      })
      if (formatError) {
        errors[fieldName] = formatError
      }
    }
  }

  /**
   * 验证数字类型
   * @param value - 要验证的数字值
   * @param schema - 字段的 JSON Schema 定义
   * @param fieldName - 字段名称
   * @param errors - 错误对象，用于收集验证错误
   * @param parentSchema - 父级 Schema，用于获取字段标题
   */
  private validateNumber({
    value,
    schema,
    fieldName,
    errors,
    parentSchema,
  }: {
    value: number
    schema: ExtendedJSONSchema
    fieldName: string
    errors: Record<string, string>
    parentSchema?: ExtendedJSONSchema
  }): void {
    // 验证最小值
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} minimum value is ${schema.minimum}`
    }

    // 验证最大值
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} maximum value is ${schema.maximum}`
    }

    // 验证排他最小值
    if (
      schema.exclusiveMinimum !== undefined &&
      value <= schema.exclusiveMinimum
    ) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} must be greater than ${schema.exclusiveMinimum}`
    }

    // 验证排他最大值
    if (
      schema.exclusiveMaximum !== undefined &&
      value >= schema.exclusiveMaximum
    ) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} must be less than ${schema.exclusiveMaximum}`
    }

    // 验证倍数
    if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} must be a multiple of ${schema.multipleOf}`
    }
  }

  /**
   * 验证数组类型
   * @param value - 要验证的数组值
   * @param schema - 字段的 JSON Schema 定义
   * @param fieldName - 字段名称
   * @param errors - 错误对象，用于收集验证错误
   * @param parentSchema - 父级 Schema，用于获取字段标题
   * @param recursive - 是否递归验证数组元素
   */
  private validateArray({
    value,
    schema,
    fieldName,
    errors,
    parentSchema,
    recursive,
  }: {
    value: any[]
    schema: ExtendedJSONSchema
    fieldName: string
    errors: Record<string, string>
    parentSchema?: ExtendedJSONSchema
    recursive: boolean
  }): void {
    // 验证最小项数
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} requires at least ${schema.minItems} items`
    }

    // 验证最大项数
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors[fieldName] =
        `${this.getFieldTitle(fieldName, parentSchema)} allows at most ${schema.maxItems} items`
    }

    // 验证唯一性
    if (schema.uniqueItems) {
      const uniqueValues = new Set(value.map((v) => JSON.stringify(v)))
      if (uniqueValues.size !== value.length) {
        errors[fieldName] =
          `${this.getFieldTitle(fieldName, parentSchema)} must not contain duplicate items`
      }
    }

    // 验证数组元素（items.required 始终检查，属性级别递归验证需要 recursive=true）
    if (
      schema.items &&
      typeof schema.items !== 'boolean' &&
      !Array.isArray(schema.items)
    ) {
      const itemsSchema = schema.items

      for (let i = 0; i < value.length; i++) {
        const item = value[i]

        // 如果 items 是对象类型，递归验证其 properties
        if (
          itemsSchema.type === 'object' &&
          typeof item === 'object' &&
          item !== null
        ) {
          // 始终检查 required 字段（不依赖 recursive）
          if (itemsSchema.required && Array.isArray(itemsSchema.required)) {
            for (const requiredField of itemsSchema.required) {
              if (itemsSchema.properties && !(requiredField in itemsSchema.properties)) continue
              if (!this.hasValue((item as Record<string, any>)[requiredField])) {
                errors[`${fieldName}[${i}].${requiredField}`] =
                  `${this.getFieldTitle(requiredField, itemsSchema)} is required`
              }
            }
          }

          // 递归验证 properties
          if (itemsSchema.properties) {
            for (const [propName, propSchema] of Object.entries(
              itemsSchema.properties
            )) {
              if (typeof propSchema === 'boolean') continue

              const propValue = (item as Record<string, any>)[propName]
              const propErrors = this.validateFieldValue({
                value: propValue,
                schema: propSchema,
                fieldName: `${fieldName}[${i}].${propName}`,
                parentSchema: itemsSchema,
                recursive: true,
              })
              Object.assign(errors, propErrors)
            }
          }
        } else {
          // 非对象类型的数组元素，直接递归验证
          const itemErrors = this.validateFieldValue({
            value: item,
            schema: itemsSchema,
            fieldName: `${fieldName}[${i}]`,
            parentSchema: schema,
            recursive: true,
          })
          Object.assign(errors, itemErrors)
        }
      }
    }
  }

  /**
   * 验证对象类型
   * @param value - 要验证的对象值
   * @param schema - 字段的 JSON Schema 定义
   * @param fieldName - 字段名称
   * @param errors - 错误对象，用于收集验证错误
   * @param parentSchema - 父级 Schema，用于获取字段标题
   * @param recursive - 是否递归验证嵌套属性
   */
  private validateObject({
    value,
    schema,
    fieldName,
    errors,
    parentSchema,
    recursive,
  }: {
    value: Record<string, any>
    schema: ExtendedJSONSchema
    fieldName: string
    errors: Record<string, string>
    parentSchema?: ExtendedJSONSchema
    recursive: boolean
  }): void {
    // 验证最小属性数
    if (schema.minProperties !== undefined) {
      const propCount = Object.keys(value).length
      if (propCount < schema.minProperties) {
        errors[fieldName] =
          `${this.getFieldTitle(fieldName, parentSchema)} requires at least ${schema.minProperties} properties`
      }
    }

    // 验证最大属性数
    if (schema.maxProperties !== undefined) {
      const propCount = Object.keys(value).length
      if (propCount > schema.maxProperties) {
        errors[fieldName] =
          `${this.getFieldTitle(fieldName, parentSchema)} allows at most ${schema.maxProperties} properties`
      }
    }

    // 如果 recursive 为 true，递归验证嵌套属性
    if (recursive) {
      // 检查 required 字段
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (schema.properties && !(requiredField in schema.properties)) continue
          if (!this.hasValue(value[requiredField])) {
            errors[`${fieldName}.${requiredField}`] =
              `${this.getFieldTitle(requiredField, schema)} is required`
          }
        }
      }

      // 递归验证 properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(
          schema.properties
        )) {
          if (typeof propSchema === 'boolean') continue

          const propValue = value[propName]
          const propErrors = this.validateFieldValue({
            value: propValue,
            schema: propSchema,
            fieldName: `${fieldName}.${propName}`,
            parentSchema: schema,
            recursive: true,
          })
          Object.assign(errors, propErrors)
        }
      }
    }
  }

  /**
   * 验证格式（format）
   * @param value - 要验证的字符串值
   * @param format - 格式类型（email, uri, ipv4, date, time, date-time）
   * @param fieldName - 字段名称
   * @param parentSchema - 父级 Schema，用于获取字段标题
   * @returns 错误信息，如果验证通过则返回 null
   */
  private validateFormat({
    value,
    format,
    fieldName,
    parentSchema,
  }: {
    value: string
    format: string
    fieldName: string
    parentSchema?: ExtendedJSONSchema
  }): string | null {
    const formatValidators: Record<string, RegExp> = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      uri: /^https?:\/\/.+/,
      ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
      date: /^\d{4}-\d{2}-\d{2}$/,
      time: /^\d{2}:\d{2}:\d{2}$/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    }

    const validator = formatValidators[format]
    if (validator && !validator.test(value)) {
      return `${this.getFieldTitle(fieldName, parentSchema)} invalid format (expected: ${format})`
    }

    return null
  }
}
