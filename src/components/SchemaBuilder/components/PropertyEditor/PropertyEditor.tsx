import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import {
  Tabs,
  Tab,
  FormGroup,
  InputGroup,
  TextArea,
  NumericInput,
  Switch,
  Callout,
  Divider,
  Button,
  Tag,
  Tooltip,
  Icon,
  Dialog,
  DialogBody,
  DialogFooter,
} from '@blueprintjs/core'
import { Select } from '../../../Select'
import { get } from 'lodash'
import { useSchemaBuilder } from '../../SchemaBuilder'
import type { SchemaNodeType } from '../../types'
import { SchemaValidationEditor } from './components/SchemaValidationEditor'
import { FieldValidatorsEditor } from './components/FieldValidatorsEditor'
import { LinkagesEditor } from './components/LinkagesEditor'
import { TransformEditor } from './components/TransformEditor'
import { CallbackPropsEditor } from './components/CallbackPropsEditor'
import { ObjectEditor } from '../../../ObjectEditor'
import { VariantsEditor } from './components/VariantsEditor'
import JsonView from '../../../JsonView'
import { DynamicForm } from '../../../DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import {
  WidgetOptionsEditor,
  selectionWidgetDefinitions,
  basicWidgetDefinitions,
} from '../../../DynamicForm/widgets'
import type { FieldOption } from '../../../DynamicForm/types/schema'
import {
  checkWidgetCompatibility,
  getSchemaDefaults,
  mergeWidgetValueSchema,
  resolveWidgetTypeConflict,
  getWidgetContractSchemaAtPath,
  isWidgetArrayItemsContractPath,
  isWidgetValueSchemaDescendantPath,
} from '../../utils/widgetSchema'

// 按 Schema 路径统一读取节点；根路径和嵌套路径由同一入口处理，避免各处重复分支。
const getNode = (schema: any, path: string[]) => {
  if (path.length === 0) {
    return schema
  }
  return get(schema, path)
}

// 同时编码原始类型和值，防止 enum/options 合并时把数字 1 与字符串 "1" 当成同一项。
const getOptionValueKey = (value: unknown): string =>
  `${typeof value}:${JSON.stringify(value)}`

const mergeWidgetOptions = ({
  schema,
  widgetPropsOptions,
}: {
  schema: ExtendedJSONSchema
  widgetPropsOptions?: FieldOption[]
}): FieldOption[] => {
  // 先投影 Schema enum，保证旧数据只有 enum 时仍可在 Widget Props 中编辑。
  const schemaOptions = (schema.enum || []).map((value, index) => ({
    value,
    label: schema.enumNames?.[index] ?? String(value),
    disabled: false,
  }))
  // 用带类型的 key 去重，并让后续 widgetProps 展示配置覆盖同值的旧展示属性。
  const merged = new Map<string, FieldOption>()

  schemaOptions.forEach((option) => {
    merged.set(getOptionValueKey(option.value), option)
  })
  widgetPropsOptions?.forEach((option) => {
    // 当前 option 可能覆盖历史 label/disabled，但没有明确 disabled 时统一为 false。
    const key = getOptionValueKey(option.value)
    merged.set(key, {
      ...merged.get(key),
      ...option,
      disabled: option.disabled ?? false,
    })
  })

  return Array.from(merged.values())
}

const getOptionValueType = (schema: ExtendedJSONSchema): string => {
  // 由现有 enum 推断新增 option 的输入类型，避免历史数字或布尔选项被误建成字符串。
  const enumTypes = Array.from(
    new Set((schema.enum || []).map((value) => typeof value)),
  )
  if (
    enumTypes.length === 1 &&
    ['string', 'number', 'boolean'].includes(enumTypes[0])
  ) {
    return enumTypes[0]
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return 'number'
  }
  if (schema.type === 'boolean') {
    return 'boolean'
  }
  return 'string'
}

interface FieldHelpLabelParams {
  label: string
  title: string
  description: string
  reasons?: string[]
}

const renderLabelWithTooltip = ({
  label,
  title,
  description,
  reasons,
}: FieldHelpLabelParams) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {label}{' '}
    <Tooltip
      content={
        <div style={{ maxWidth: 340 }}>
          <p style={{ marginBottom: 8, fontWeight: 'bold' }}>{title}</p>
          <p style={{ marginBottom: reasons?.length ? 8 : 0 }}>{description}</p>
          {reasons?.length ? (
            <>
              <p style={{ marginBottom: 6, fontWeight: 'bold' }}>
                Why configure it?
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      }
      placement="right"
    >
      <Icon
        icon="info-sign"
        size={12}
        style={{
          display: 'block',
          color: '#5c7080',
        }}
      />
    </Tooltip>
  </span>
)

const renderSwitchLabelWithTooltip = ({
  label,
  title,
  description,
  reasons,
}: FieldHelpLabelParams) => (
  <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
    {label}{' '}
    <Tooltip
      content={
        <div style={{ maxWidth: 340 }}>
          <p style={{ marginBottom: 8, fontWeight: 'bold' }}>{title}</p>
          <p style={{ marginBottom: reasons?.length ? 8 : 0 }}>{description}</p>
          {reasons?.length ? (
            <>
              <p style={{ marginBottom: 6, fontWeight: 'bold' }}>
                Why configure it?
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      }
      placement="right"
    >
      <Icon
        icon="info-sign"
        size={12}
        style={{
          display: 'block',
          color: '#5c7080',
        }}
      />
    </Tooltip>
  </span>
)

const createEditorFormDefaults = ({
  currentKey,
  currentNode,
}: {
  currentKey?: string
  currentNode: any
}) => ({
  key: currentKey,
  ...currentNode,
  ui: {
    widget: '',
    widgetProps: undefined,
    callbackProps: undefined,
    placeholder: '',
    hidden: false,
    disabled: false,
    readonly: false,
    layout: '',
    labelWidth: '',
    colSpan: 1,
    columnsCount: 1,
    flattenPath: false,
    flattenPrefix: false,
    arrayMode: 'dynamic',
    addButtonText: '',
    transform: undefined,
    validators: undefined,
    linkages: undefined,
    ...currentNode?.ui,
    validation: currentNode?.ui?.validation || {},
    errorMessages: currentNode?.ui?.errorMessages || {},
  },
})

const ConfigSection = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) => (
  <section className="ui-config-section">
    <div className="ui-config-section-header">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
    <div className="ui-config-section-content">{children}</div>
  </section>
)

const getDefaultWidget = (schema: any): string => {
  if (schema?.type === 'string') {
    if (schema.format === 'email') {
      return 'email'
    }
    if (schema.format === 'date') {
      return 'date'
    }
    if (schema.format === 'date-time') {
      return 'datetime'
    }
    if (schema.format === 'time') {
      return 'time'
    }
    if (schema.enum) {
      return 'select'
    }
    if (schema.maxLength && schema.maxLength > 100) {
      return 'textarea'
    }
    return 'text'
  }

  if (schema?.type === 'number' || schema?.type === 'integer') {
    return 'number'
  }

  if (schema?.type === 'boolean') {
    return 'checkbox'
  }

  if (schema?.type === 'array') {
    return 'array'
  }

  if (schema?.type === 'object') {
    return 'nested-form'
  }

  return 'text'
}

export const PropertyEditor: React.FC = () => {
  const {
    schema,
    selectedPath,
    onUpdate,
    options,
    widgetDefinitions = [],
  } = useSchemaBuilder()
  // 当前被编辑的 Schema 节点；后续默认值、widget 和父级 required 状态都以它为基准。
  const currentNode = getNode(schema, selectedPath)

  // 将 selectedPath 数组转换为 JSON Pointer 格式
  // ['properties', 'field1', 'properties', 'field2'] -> '#/properties/field1/properties/field2'
  // 子编辑器使用 JSON Pointer 标识字段；根节点没有字段路径，因此保持空字符串。
  const currentFieldPath =
    selectedPath.length > 0 ? `#/${selectedPath.join('/')}` : ''

  // Determine if it's a root node
  // 根节点不能按普通字段编辑，其面板只提供 Schema 级条件配置。
  const isRoot = selectedPath.length === 0

  // Determine if it's an object property (to allow renaming key)
  // path: ['properties', 'field1'] -> yes
  // path: ['items'] -> no
  // 只有 object.properties 下的节点才有可编辑的属性名。
  const isObjectProperty =
    selectedPath.length > 0 &&
    selectedPath[selectedPath.length - 2] === 'properties'
  // 缓存当前属性键，供名称输入、required 更新和路径提示复用。
  const currentKey = isObjectProperty
    ? selectedPath[selectedPath.length - 1]
    : undefined

  // Determine if it's an array items node
  // items 节点需要读取父数组以区别真正的数组元素 schema 与普通名为 items 的节点。
  const parentPath = selectedPath.slice(0, -1)
  // 父节点决定所选 items 是否属于 array。
  const parentNode = getNode(schema, parentPath)
  // 该标记控制普通数组元素的专属编辑能力；Widget 契约 items 后续会额外只读保护。
  const isItemsSchemaNode =
    selectedPath.length > 0 &&
    selectedPath[selectedPath.length - 1] === 'items' &&
    parentNode?.type === 'array'

  // 普通数组的 `items` 是数组元素本身的 Schema，可以配置元素标题、约束
  // 和 UI；如果它属于 Widget 的 valueSchema 契约，则由下方契约只读分支接管。

  // Determine if it's a schema-level node (only root)
  // 只有根节点应该只显示条件验证配置
  // 其他节点（包括 object 类型）都应该显示完整的字段配置
  // rootType 模式把根节点当作字段容器编辑；否则根面板只处理跨字段验证。
  const isSchemaLevelNode = isRoot && !options?.rootType

  // 将标签页选择保存在组件状态中，避免字段内部更新时意外切回默认面板。
  const [selectedTabId, setSelectedTabId] = useState(
    isSchemaLevelNode ? 'validation' : 'basic',
  )
  // 名称输入需在 blur 时验证后提交，因此暂存输入值，不直接改 Schema。
  const [keyInput, setKeyInput] = useState(currentKey || '')
  // 暂存名称校验错误，以便输入框立即反馈重复名或空名称。
  const [keyError, setKeyError] = useState('')
  // 类型不兼容时先保存用户意图，等待阻断式弹窗让用户选择如何解决。
  const [pendingType, setPendingType] = useState<SchemaNodeType | null>(null)
  // 控制类型冲突弹窗；不允许关闭是为了避免冲突状态被无选择地保留。
  const [isTypeConflictOpen, setIsTypeConflictOpen] = useState(false)

  // React Hook Form 管理面板输入态；Schema 更新后 reset 保证表单回显与外部节点一致。
  const { control, reset, watch, setValue } = useForm({
    defaultValues: createEditorFormDefaults({ currentKey, currentNode }),
    mode: 'onBlur',
  })

  // Watch for changes to update schema
  useEffect(() => {
    if (currentNode) {
      reset(createEditorFormDefaults({ currentKey, currentNode }))
      setKeyInput(currentKey || '')
      setKeyError('')
    }
  }, [currentNode, currentKey, reset])

  useEffect(() => {
    // 根据节点类型设置默认 tab
    setSelectedTabId(isSchemaLevelNode ? 'validation' : 'basic')
  }, [currentKey, isSchemaLevelNode])

  if (!currentNode) {
    return (
      <div className="property-editor-empty">
        <Callout intent="primary">
          Select a node from the tree to edit properties.
        </Callout>
      </div>
    )
  }

  // 集中提交顶层 Schema 字段变更，避免每个控件重复构造更新路径。
  const handleFieldChange = (field: string, value: any) => {
    onUpdate(selectedPath, { [field]: value })
  }

  // UI 配置必须与现有 ui 合并写回，避免修改单项时覆盖其他 UI 元数据。
  const handleUIChange = (field: string, value: any) => {
    onUpdate(selectedPath, { ui: { ...currentNode.ui, [field]: value } })
  }

  const handleKeyChange = (e: React.FocusEvent<HTMLInputElement>) => {
    // 仅在失焦时提交名称，先去除首尾空格以保持 Schema key 稳定。
    const newKey = e.target.value.trim()

    // 验证：不能为空
    if (!newKey) {
      setKeyError('Field name cannot be empty')
      setKeyInput(currentKey || '')
      return
    }

    // 验证：不能与其他字段重复
    if (newKey !== currentKey) {
      // 当前属性的父级 properties 用于检查同级键冲突。
      const propertiesPath = selectedPath.slice(0, -1)
      // 读取同级属性集合，避免重命名覆盖已有字段。
      const propertiesNode = get(schema, propertiesPath)
      if (propertiesNode && propertiesNode[newKey]) {
        setKeyError(`Field name "${newKey}" already exists`)
        setKeyInput(currentKey || '')
        return
      }

      setKeyError('')
      onUpdate(selectedPath, {}, newKey)
    }
  }

  // 按字段类型渲染合适的默认值控件，集中处理数值中间态与 Schema 提交转换。
  const renderDefaultValueInput = (field: any) => {
    if (currentType === 'boolean') {
      return (
        <Switch
          checked={!!field.value}
          onChange={(e) => {
            field.onChange(e.currentTarget.checked)
            handleFieldChange('default', e.currentTarget.checked)
          }}
        />
      )
    }
    if (currentType === 'integer') {
      return (
        <input
          key="default-integer"
          type="text"
          className="bp6-input"
          style={{ width: '100%' }}
          defaultValue={field.value ?? ''}
          onKeyDown={(e) => {
            if (
              ![
                '-',
                'Backspace',
                'Delete',
                'ArrowLeft',
                'ArrowRight',
                'Tab',
              ].includes(e.key) &&
              !/^\d$/.test(e.key)
            ) {
              e.preventDefault()
            }
          }}
          onBlur={(e) => {
            // 数字 default 在 blur 时才提交，允许输入过程中暂存空值等中间状态。
            const v =
              e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            field.onChange(v)
            handleFieldChange('default', v)
          }}
        />
      )
    }
    if (currentType === 'number') {
      return (
        <input
          key="default-number"
          type="text"
          className="bp6-input"
          style={{ width: '100%' }}
          defaultValue={field.value ?? ''}
          onKeyDown={(e) => {
            if (e.key === '.' && e.currentTarget.value.includes('.')) {
              e.preventDefault()
              return
            }
            if (
              ![
                '-',
                '.',
                'Backspace',
                'Delete',
                'ArrowLeft',
                'ArrowRight',
                'Tab',
              ].includes(e.key) &&
              !/^\d$/.test(e.key)
            ) {
              e.preventDefault()
            }
          }}
          onBlur={(e) => {
            // 小数 default 同样在 blur 时解析，避免每次按键都破坏输入中的临时文本。
            const v =
              e.target.value === '' ? undefined : parseFloat(e.target.value)
            field.onChange(v)
            handleFieldChange('default', v)
          }}
        />
      )
    }
    return (
      <InputGroup
        {...field}
        value={field.value || ''}
        onChange={(e) => {
          field.onChange(e)
          handleFieldChange('default', e.target.value)
        }}
      />
    )
  }

  // 集中维护可选 JSON Schema 基本类型，供字段类型选择器复用。
  const typeOptions = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Integer', value: 'integer' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Object', value: 'object' },
    { label: 'Array', value: 'array' },
  ]

  // 内置候选按字段类型分类；custom Widget 则另行追加，不因类型不匹配而隐藏。
  const widgetOptions = {
    string: [
      'textarea',
      'password',
      'email',
      'url',
      'select',
      'radio',
      'checkbox-group',
    ],
    number: ['range'],
    integer: ['range'],
    boolean: ['checkbox', 'radio'],
    array: ['key-value-array', 'table-array', 'select', 'radio'],
    object: ['object-editor'],
  }

  // 监听表单中的类型草稿，候选内置 Widget 随用户编辑立即更新。
  const currentType = watch('type') as SchemaNodeType
  // 当前类型对应的内置控件候选，减少不适用的内置选择项。
  const currentWidgetOptions = (widgetOptions[currentType] || []).map(
    (widget) => ({
      label:
        widget.charAt(0).toUpperCase() + widget.slice(1).replace(/-/g, ' '),
      value: widget,
    }),
  )
  // custom Widget 保持跨类型可见，便于选择后按其 valueSchema 同步字段类型。
  const customWidgetOptions = widgetDefinitions
    .filter(
      (definition) =>
        !selectionWidgetDefinitions.some(
          (builtinDefinition) => builtinDefinition.name === definition.name,
        ),
    )
    .map((definition) => ({
      label: `${definition.name}${definition.valueSchema?.type ? ` · ${definition.valueSchema.type}` : ''}`,
      value: definition.name,
    }))
  // 保存当前 schema 中已经配置的 widget 名称，用于回显自定义 widget，
  // 即使它不在 SchemaBuilder 的内置 widget 列表中也不能丢失。
  // 保存 schema 中显式配置的 Widget，用于编辑器回显和区分默认 Widget。
  const configuredWidget = currentNode.ui?.widget
  // 数组 items 允许调用方使用注册在 DynamicForm.widgets 中的任意名称，
  // 因此即使元素类型没有内置候选项，也必须显示 widget 编辑入口。
  // 未进入内置候选的已配置名称仍要保留，否则打开编辑器会丢失既有配置。
  const hasConfiguredCustomWidget =
    !!configuredWidget &&
    !currentWidgetOptions.some((option) => option.value === configuredWidget)
  // 把当前未知但已保存的 Widget 插入候选，保证历史/外部注册值可见。
  const widgetOptionsWithConfiguredValue = hasConfiguredCustomWidget
    ? [
        {
          label: `Custom (${configuredWidget})`,
          value: configuredWidget,
        },
        ...currentWidgetOptions,
      ]
    : currentWidgetOptions
  // 合并当前类型的内置候选与全部 custom 候选，同时按名称去重。
  const allWidgetOptions = [
    ...widgetOptionsWithConfiguredValue,
    ...customWidgetOptions.filter(
      (option) =>
        !widgetOptionsWithConfiguredValue.some(
          (currentOption) => currentOption.value === option.value,
        ),
    ),
  ]
  // items 即使没有类型候选也允许输入自定义 Widget 名称，因此单独决定配置入口显隐。
  const showWidgetConfig =
    currentWidgetOptions.length > 0 ||
    customWidgetOptions.length > 0 ||
    isItemsSchemaNode
  // 计算 DynamicForm 对当前 schema 的默认渲染方式，用于空选择和缓存键回退。
  const defaultWidget = getDefaultWidget(currentNode)
  // 使用表单草稿中的 Widget；未显式选择时仍按 Schema 默认渲染控件配置。
  const effectiveWidget = watch('ui.widget') || defaultWidget
  // checkbox 在非 boolean 字段上代表复选组，映射到其独立配置定义名称。
  const effectiveWidgetDefinitionName =
    effectiveWidget === 'checkbox' && currentType !== 'boolean'
      ? 'checkbox-group'
      : effectiveWidget
  // 统一计算面板只读策略，避免后续编辑器和契约只读判断重复展开全局选项。
  const editorReadonly =
    options?.readonly?.all ||
    options?.readonly?.schema ||
    options?.readonly?.propertyEditor

  // 优先使用调用方注册定义，再回退到内置定义，以共享 value/props schema 契约。
  const selectedWidgetDefinition =
    widgetDefinitions.find(
      (definition) => definition.name === effectiveWidgetDefinitionName,
    ) ??
    basicWidgetDefinitions.find(
      (definition) => definition.name === effectiveWidgetDefinitionName,
    ) ??
    selectionWidgetDefinitions.find(
      (definition) => definition.name === effectiveWidgetDefinitionName,
    )
  // 注入 options 编辑器的默认值类型提示，不修改注册定义本身。
  const widgetPropsSchema = selectedWidgetDefinition?.propsSchema
    ? {
        ...selectedWidgetDefinition.propsSchema,
        properties: selectedWidgetDefinition.propsSchema.properties
          ? {
              ...selectedWidgetDefinition.propsSchema.properties,
              ...(selectedWidgetDefinition.propsSchema.properties.options
                ? {
                    options: {
                      ...selectedWidgetDefinition.propsSchema.properties
                        .options,
                      ui: {
                        ...selectedWidgetDefinition.propsSchema.properties
                          .options.ui,
                        widgetProps: {
                          defaultValueType: getOptionValueType(currentNode),
                        },
                      },
                    },
                  }
                : {}),
            }
          : undefined,
      }
    : undefined

  const getWidgetPropsDefaults = () => {
    if (!selectedWidgetDefinition?.propsSchema) {
      return {}
    }
    // propsSchema 提供首次使用的默认值，之后才由缓存或当前配置覆盖。
    const defaults = getSchemaDefaults(selectedWidgetDefinition.propsSchema)
    // 当前 Widget 名用于兼容尚未拥有按 Widget 缓存的历史 ui.widgetProps。
    const currentWidget = currentNode.ui?.widget || defaultWidget
    // 按 Widget 名恢复编辑器缓存，避免不同控件的参数表单串用。
    const cachedProps =
      currentNode.ui?.__schemaBuilder?.widgetPropsByWidget?.[
        effectiveWidgetDefinitionName
      ]
    // 仅当正在编辑当前 Widget 时读取旧 widgetProps，避免把另一控件参数当作目标配置。
    const currentProps =
      cachedProps ??
      (effectiveWidgetDefinitionName === currentWidget
        ? currentNode.ui?.widgetProps
        : undefined) ??
      {}
    if (!selectedWidgetDefinition.propsSchema.properties?.options) {
      return { ...defaults, ...currentProps }
    }
    return {
      ...defaults,
      ...currentProps,
      options: mergeWidgetOptions({
        schema: currentNode,
        widgetPropsOptions: currentProps.options,
      }),
    }
  }

  const handleWidgetPropsChange = (values: Record<string, any>) => {
    // options 分支需同时同步 enum 校验值，其余参数仅写入 ui.widgetProps。
    const nextOptions = values.options
    // 构造独立配置对象，避免直接修改 DynamicForm 返回的表单值。
    const nextProps = { ...values }
    if (Array.isArray(nextOptions)) {
      // 补齐 disabled 默认值，确保展示配置结构稳定并能完整写回缓存。
      const normalizedOptions: FieldOption[] = nextOptions.map(
        (option: FieldOption) => ({
          ...option,
          disabled: option.disabled ?? false,
        }),
      )
      nextProps.options = normalizedOptions
      onUpdate(selectedPath, {
        enum: normalizedOptions.length
          ? normalizedOptions.map((option) => option.value)
          : undefined,
        enumNames: normalizedOptions.length
          ? normalizedOptions.map((option) => option.label)
          : undefined,
        ui: {
          ...currentNode.ui,
          widgetProps: nextProps,
          __schemaBuilder: {
            ...currentNode.ui?.__schemaBuilder,
            widgetPropsByWidget: {
              ...currentNode.ui?.__schemaBuilder?.widgetPropsByWidget,
              [effectiveWidgetDefinitionName]: nextProps,
            },
          },
        },
      })
      return
    }
    // 默认 Widget 也需要独立缓存，否则从隐式默认控件切出时会丢掉刚编辑的参数。
    const currentWidget = currentNode.ui?.widget || defaultWidget
    onUpdate(selectedPath, {
      ui: {
        ...currentNode.ui,
        widgetProps: nextProps,
        __schemaBuilder: {
          ...currentNode.ui?.__schemaBuilder,
          widgetPropsByWidget: {
            ...currentNode.ui?.__schemaBuilder?.widgetPropsByWidget,
            [currentWidget]: nextProps,
          },
        },
      },
    })
  }

  const handleWidgetChange = (
    nextWidgetValue: string | number | (string | number)[] | null,
  ) => {
    // Select 可返回单值或多值；此处规范为一个 widget 名以便匹配定义和缓存。
    const normalizedWidgetValue = Array.isArray(nextWidgetValue)
      ? nextWidgetValue[0]
      : nextWidgetValue
    // 空选择表示恢复 Schema 推导出的默认 Widget。
    const nextWidget = String(normalizedWidgetValue || defaultWidget)
    // 当前 Widget 是旧配置缓存的键，未显式设置时使用默认 Widget 名。
    const currentWidget = currentNode.ui?.widget || defaultWidget
    // 先保存当前生效参数，切回该 Widget 时才能恢复用户配置。
    const previousProps = currentNode.ui?.widgetProps
    // 克隆缓存映射以保证 Schema 更新不可变，避免污染当前节点。
    const widgetPropsByWidget = {
      ...currentNode.ui?.__schemaBuilder?.widgetPropsByWidget,
    }
    if (previousProps && currentWidget) {
      widgetPropsByWidget[currentWidget] = previousProps
    }

    // 定位目标控件定义，决定其默认 Props 与 valueSchema 行为。
    const nextDefinition =
      widgetDefinitions.find((definition) => definition.name === nextWidget) ??
      basicWidgetDefinitions.find(
        (definition) => definition.name === nextWidget,
      ) ??
      selectionWidgetDefinitions.find(
        (definition) => definition.name === nextWidget,
      )
    // 优先恢复目标 Widget 历史配置；只有首次使用时才采用 schema 默认值。
    const nextCachedProps = widgetPropsByWidget[nextWidget]
    // 默认参数来自目标 propsSchema，保证新切换的控件从有效初始状态开始。
    const nextDefaults = nextDefinition?.propsSchema
      ? getSchemaDefaults(nextDefinition.propsSchema)
      : {}
    // 合并默认值与该控件专属缓存，禁止沿用其他控件的 widgetProps。
    const nextProps = {
      ...nextDefaults,
      ...(nextCachedProps ??
        (nextWidget === currentWidget ? previousProps : {})),
    }
    if (nextDefinition?.propsSchema?.properties?.options) {
      nextProps.options = mergeWidgetOptions({
        schema: currentNode,
        widgetPropsOptions: nextProps.options,
      })
    }
    if (nextDefinition?.propsSchema) {
      widgetPropsByWidget[nextWidget] = nextProps
    }

    // 当前运行时只暴露目标 Widget 的参数；缓存留在 SchemaBuilder 内部元数据中。
    const nextUI = {
      ...currentNode.ui,
      widget: normalizedWidgetValue || undefined,
      widgetProps: nextDefinition?.propsSchema ? nextProps : undefined,
      __schemaBuilder: {
        ...currentNode.ui?.__schemaBuilder,
        widgetPropsByWidget,
      },
    }
    if (nextDefinition?.valueSchema) {
      // 有 valueSchema 时同步字段值类型和完整结构，确保选择器切换后契约一致。
      const merged = mergeWidgetValueSchema({
        currentSchema: currentNode,
        widgetSchema: nextDefinition.valueSchema,
      })
      onUpdate(selectedPath, {
        type: merged.schema.type,
        properties: merged.schema.properties,
        items: merged.schema.items,
        required: merged.schema.required,
        ui: { ...merged.schema.ui, ...nextUI },
      })
      return
    }
    onUpdate(selectedPath, { ui: nextUI })
  }
  // 历史 enum 即使未显式设置 widget 也需展示隐式 select 的 options 编辑入口。
  const shouldShowWidgetProps =
    Boolean(configuredWidget) || Boolean(currentNode.enum)
  // 查询当前路径对应的 Widget 输出契约，为契约根字段禁用不兼容编辑操作。
  const widgetContractSchema = getWidgetContractSchemaAtPath({
    schema,
    path: selectedPath,
    widgetDefinitions,
  })
  // 契约根节点仍可编辑通用字段信息，但不能破坏 Widget 声明的值结构。
  const isWidgetContractField = widgetContractSchema !== undefined
  // 数组 Widget 的 items 子树整体受 valueSchema 管理，不能增删或修改。
  const isWidgetArrayItemsContract = isWidgetArrayItemsContractPath({
    schema,
    path: selectedPath,
    widgetDefinitions,
  })
  // object Widget 的契约子字段以 valueSchema 为唯一来源，因此整个属性面板只读。
  const isWidgetValueSchemaDescendant = isWidgetValueSchemaDescendantPath({
    schema,
    path: selectedPath,
    widgetDefinitions,
  })
  // 冲突弹窗需要显示 Widget 真正要求的类型，valueSchema 优先于简写 valueType。
  const widgetRequiredType =
    selectedWidgetDefinition?.valueSchema?.type ??
    selectedWidgetDefinition?.valueType
  const widgetSupportedTypes = selectedWidgetDefinition?.supports?.schemaTypes
  const conflictUseType = widgetSupportedTypes?.includes(
    currentNode.type as never,
  )
    ? currentNode.type
    : (widgetSupportedTypes?.[0] ?? widgetRequiredType)

  const applySchemaReplacement = (replacement: ExtendedJSONSchema) => {
    onUpdate(selectedPath, {
      type: replacement.type,
      properties: replacement.properties,
      items: replacement.items,
      required: replacement.required,
      ui: replacement.ui,
    })
  }

  const handleTypeChange = (nextType: SchemaNodeType) => {
    // 只有用户显式选择了 Widget 才锁定其类型；默认 Widget 会随字段类型自然变化。
    if (selectedWidgetDefinition && currentNode.ui?.widget) {
      // 在应用类型之前校验 Widget 输出契约，避免生成不能正确提交的字段 Schema。
      const compatibility = checkWidgetCompatibility({
        fieldSchema: { ...currentNode, type: nextType },
        widgetDefinition: selectedWidgetDefinition,
      })
      if (!compatibility.compatible) {
        setPendingType(nextType)
        setIsTypeConflictOpen(true)
        return
      }
    }

    setValue('type', nextType)
    handleFieldChange('type', nextType)
    setValue('default', undefined)
    handleFieldChange('default', undefined)
  }

  const handleUseWidgetType = () => {
    if (!selectedWidgetDefinition) {
      return
    }
    if (!selectedWidgetDefinition.valueSchema) {
      const targetType = conflictUseType
      if (targetType) {
        onUpdate(selectedPath, { type: targetType })
        setValue('type', targetType)
      }
    } else {
      // 统一使用契约解析器重建类型及结构，避免只改 type 留下不匹配的子树。
      const resolved = resolveWidgetTypeConflict({
        action: 'use-widget-type',
        currentSchema: currentNode,
        widgetDefinition: selectedWidgetDefinition,
      })
      applySchemaReplacement(resolved.schema)
      setValue('type', resolved.schema.type)
    }
    setPendingType(null)
    setIsTypeConflictOpen(false)
  }

  const handleRemoveWidget = () => {
    // 保留用户刚选择的字段类型，同时移除冲突 Widget 及其专属配置。
    const resolved = selectedWidgetDefinition
      ? resolveWidgetTypeConflict({
          action: 'remove-widget',
          currentSchema: {
            ...currentNode,
            type: pendingType ?? currentNode.type,
          },
          widgetDefinition: selectedWidgetDefinition,
        })
      : {
          schema: { ...currentNode, type: pendingType ?? currentNode.type },
          removeWidget: true,
        }
    applySchemaReplacement(resolved.schema)
    setValue('type', resolved.schema.type)
    setValue('ui.widget', '')
    setPendingType(null)
    setIsTypeConflictOpen(false)
  }

  if (
    editorReadonly ||
    isWidgetArrayItemsContract ||
    isWidgetValueSchemaDescendant
  ) {
    return (
      <div className="property-editor">
        <JsonView title="Schema (Read Only)" data={currentNode} />
      </div>
    )
  }

  return (
    <div className="property-editor">
      {isSchemaLevelNode ? (
        // Schema 层级节点:只显示条件验证配置
        <div className="editor-panel">
          {options?.hidden?.rootValidation ? null : (
            <>
              <Callout
                intent="primary"
                icon="info-sign"
                style={{ marginBottom: 16 }}
              >
                <strong>Schema-Level Configuration</strong>
                <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                  Configure conditional validation rules for this schema level.
                  These rules apply to the fields within this object.
                </p>
              </Callout>

              <FormGroup
                label={renderLabelWithTooltip({
                  label: 'Columns Count',
                  title: 'Form layout column count',
                  description:
                    'Controls how many columns this schema level uses when laying out child fields.',
                  reasons: [
                    'Use it to make long forms easier to scan by grouping fields across columns.',
                    'It defines the grid that field-level Column Span values can use.',
                  ],
                })}
                helperText="Number of columns for the form layout (default: 1)"
                style={{ marginBottom: 16 }}
              >
                <Controller
                  name="ui.columnsCount"
                  control={control}
                  render={({ field }) => (
                    <NumericInput
                      {...field}
                      value={field.value ?? 1}
                      onValueChange={(value) =>
                        handleUIChange('columnsCount', value)
                      }
                      min={1}
                      max={12}
                      fill
                    />
                  )}
                />
              </FormGroup>

              <Divider style={{ marginBottom: 16 }} />

              <SchemaValidationEditor
                schema={schema}
                currentFieldPath={currentFieldPath}
                parentSchema={schema}
                value={{
                  dependencies: currentNode.dependencies,
                  if: currentNode.if,
                  then: currentNode.then,
                  else: currentNode.else,
                  allOf: currentNode.allOf,
                  anyOf: currentNode.anyOf,
                  oneOf: currentNode.oneOf,
                }}
                onChange={(validationConfig) => {
                  // 更新条件验证配置
                  // 只收集本次编辑器实际提供的条件关键字，避免未编辑项被误清除。
                  const updates: any = {}

                  // dependencies - 使用 'in' 操作符检查键是否存在
                  if ('dependencies' in validationConfig) {
                    updates.dependencies = validationConfig.dependencies
                  }

                  // if/then/else - 需要检查是否存在于 validationConfig 中
                  if ('if' in validationConfig) {
                    updates.if = validationConfig.if
                    updates.then = validationConfig.then
                    updates.else = validationConfig.else
                  }

                  // allOf
                  if ('allOf' in validationConfig) {
                    updates.allOf = validationConfig.allOf
                  }

                  // anyOf
                  if ('anyOf' in validationConfig) {
                    updates.anyOf = validationConfig.anyOf
                  }

                  // oneOf
                  if ('oneOf' in validationConfig) {
                    updates.oneOf = validationConfig.oneOf
                  }

                  onUpdate(selectedPath, updates)
                }}
                disabled={false}
              />
            </>
          )}
        </div>
      ) : (
        // 字段级别节点:显示完整的配置标签页
        <Tabs
          selectedTabId={selectedTabId}
          id="property-editor-tabs"
          onChange={(newTabId) => setSelectedTabId(newTabId.toString())}
        >
          <Tab
            id="basic"
            title="Basic"
            panel={
              <div className="editor-panel">
                {isObjectProperty && (
                  <FormGroup
                    label="Name"
                    helperText={keyError || 'Unique identifier for this field'}
                    intent={keyError ? 'danger' : 'none'}
                  >
                    <InputGroup
                      value={keyInput}
                      disabled={
                        options?.readonly?.editFieldKey || isWidgetContractField
                      }
                      intent={keyError ? 'danger' : 'none'}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onBlur={handleKeyChange}
                    />
                  </FormGroup>
                )}

                <FormGroup label="Label">
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <InputGroup
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange('title', e.target.value)
                        }}
                      />
                    )}
                  />
                </FormGroup>

                {!isItemsSchemaNode && (
                  <FormGroup label="Description">
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => {
                        return (
                          <TextArea
                            {...field}
                            fill
                            onChange={(e) => {
                              field.onChange(e)
                              handleFieldChange('description', e.target.value)
                            }}
                          />
                        )
                      }}
                    />
                  </FormGroup>
                )}

                <FormGroup label="Type">
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onChange={(value) => {
                          handleTypeChange(value as SchemaNodeType)
                        }}
                        options={typeOptions}
                        disabled={
                          isRoot ||
                          options?.readonly?.editFieldType ||
                          isWidgetContractField
                        }
                      />
                    )}
                  />
                </FormGroup>

                {!isItemsSchemaNode && (
                  <Controller
                    name="default"
                    control={control}
                    render={({ field }) => (
                      <FormGroup label="Default Value">
                        {renderDefaultValueInput(field)}
                      </FormGroup>
                    )}
                  />
                )}

                {isObjectProperty && (
                  <Switch
                    style={{ marginBottom: '16px' }}
                    label="Required"
                    checked={(() => {
                      // required 存在于父 object 上，需从字段路径回退到该父节点。
                      const parentPath = selectedPath.slice(0, -2)
                      // 读取父对象以回显当前字段是否在 required 列表中。
                      const parentNode =
                        parentPath.length === 0
                          ? schema
                          : get(schema, parentPath)
                      return parentNode?.required?.includes(currentKey) || false
                    })()}
                    onChange={(e) => {
                      // 记录用户本次 required 开关选择，用于更新父对象的 required 集合。
                      const isRequired = e.currentTarget.checked
                      // required 规则写在父 object，不能更新当前字段自身。
                      const parentPath = selectedPath.slice(0, -2)
                      // 将父节点限定为 Schema 类型，便于安全读取并更新 required。
                      const parentNode: ExtendedJSONSchema =
                        parentPath.length === 0
                          ? schema
                          : get(schema, parentPath)

                      if (parentNode) {
                        // 复制现有必填项集合，后续添加或移除不会修改原 Schema 数组。
                        const currentRequired: string[] =
                          parentNode.required || []
                        // 根据开关状态生成新列表，避免重复加入或误删其他必填项。
                        const newRequired = isRequired
                          ? [...currentRequired, currentKey!]
                          : currentRequired.filter((k) => k !== currentKey)

                        onUpdate(parentPath, {
                          required:
                            newRequired.length > 0 ? newRequired : undefined,
                        })
                      }
                    }}
                  />
                )}
              </div>
            }
          />

          <Tab
            id="validation"
            title="Validation"
            panel={
              <div className="editor-panel validation-panel">
                <div className="ui-config-sections">
                  {currentType === 'string' && (
                    <ConfigSection
                      title="String Constraints"
                      description="Configure text length, format, and pattern rules."
                    >
                      <FormGroup label="Min Length">
                        <Controller
                          name="minLength"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minLength', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Min Length Error Message">
                        <Controller
                          name="ui.errorMessages.minLength"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for minLength"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  minLength: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Length">
                        <Controller
                          name="maxLength"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maxLength', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Length Error Message">
                        <Controller
                          name="ui.errorMessages.maxLength"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for maxLength"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  maxLength: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Pattern (Regex)">
                        <Controller
                          name="pattern"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                handleFieldChange('pattern', e.target.value)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Pattern Error Message">
                        <Controller
                          name="ui.errorMessages.pattern"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for pattern"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  pattern: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Format">
                        <Controller
                          name="format"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleFieldChange('format', value)
                              }}
                              options={[
                                { label: '(none)', value: '' },
                                { label: 'email', value: 'email' },
                                { label: 'uri', value: 'uri' },
                                { label: 'date', value: 'date' },
                                { label: 'date-time', value: 'date-time' },
                                { label: 'time', value: 'time' },
                              ]}
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  {(currentType === 'number' || currentType === 'integer') && (
                    <ConfigSection
                      title="Number Constraints"
                      description="Configure numeric range and step validation."
                    >
                      <FormGroup label="Minimum">
                        <Controller
                          name="minimum"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minimum', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Minimum Error Message">
                        <Controller
                          name="ui.errorMessages.min"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for minimum"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  min: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Maximum">
                        <Controller
                          name="maximum"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maximum', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Maximum Error Message">
                        <Controller
                          name="ui.errorMessages.max"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for maximum"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  max: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Multiple Of">
                        <Controller
                          name="multipleOf"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('multipleOf', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Multiple Of Error Message">
                        {/* 为 ui.errorMessages.multipleOf 提供配置入口，并保留已有错误消息。 */}
                        <Controller
                          name="ui.errorMessages.multipleOf"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for multipleOf"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  multipleOf: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  {currentType === 'array' && (
                    <ConfigSection
                      title="Array Constraints"
                      description="Control how many items the array can contain and whether values must be unique."
                    >
                      <FormGroup label="Min Items">
                        <Controller
                          name="minItems"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minItems', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Items">
                        <Controller
                          name="maxItems"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maxItems', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <Controller
                        name="uniqueItems"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            style={{ display: 'flex', alignItems: 'center' }}
                            labelElement={renderSwitchLabelWithTooltip({
                              label: 'Unique Items',
                              title: 'Prevent duplicate array items',
                              description:
                                'When enabled, the form checks whether the array contains repeated items. If two items have the same content, the user will be asked to remove or change one of them before submitting.',
                              reasons: [
                                'Use it when each item should appear only once, such as tags, permissions, selected products, supported channels, email addresses, or member IDs.',
                                'Keep it off when repeated items are meaningful, such as event logs, order lines, repeated quantities, or any list where the same value can intentionally appear more than once.',
                              ],
                            })}
                            checked={!!field.value}
                            onChange={(e) =>
                              handleFieldChange(
                                'uniqueItems',
                                e.currentTarget.checked,
                              )
                            }
                          />
                        )}
                      />
                    </ConfigSection>
                  )}

                  {currentType === 'object' && (
                    <ConfigSection
                      title="Object Constraints"
                      description="Control how many properties an object value can contain."
                    >
                      <FormGroup label="Min Properties">
                        <Controller
                          name="minProperties"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minProperties', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Properties">
                        <Controller
                          name="maxProperties"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maxProperties', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  {/* 以下配置只对叶子节点（非 object 和 array）显示 */}
                  {currentType !== 'object' && currentType !== 'array' && (
                    <ConfigSection
                      title="Required Message"
                      description="Customize the validation message shown when required field input is missing."
                    >
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Required Error Message',
                          title: 'Required validation message',
                          description:
                            'Custom error message shown when this field is required but the user leaves it empty.',
                          reasons: [
                            'Use business-specific wording so users understand exactly what value is missing.',
                            'A clear required message reduces form submission failures in operational workflows.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.errorMessages.required"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="This field is required"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  required: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}
                  <ConfigSection
                    title="Custom Validators"
                    description="Add field-level business validation that cannot be expressed with basic JSON Schema constraints."
                  >
                    <FieldValidatorsEditor
                      value={currentNode.ui?.validators}
                      onChange={(validators) =>
                        handleUIChange('validators', validators)
                      }
                    />
                  </ConfigSection>
                </div>
              </div>
            }
          />

          <Tab
            id="ui"
            title="UI Config"
            panel={
              <div className="editor-panel ui-config-panel">
                <div className="ui-config-sections">
                  <ConfigSection
                    title="Input Guidance"
                    description="Configure how users enter and understand values for this field."
                  >
                    {showWidgetConfig && (
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Widget',
                          title: 'Field rendering component',
                          description:
                            'Overrides the default widget that DynamicForm would choose from the field type.',
                          reasons: [
                            'Choose a widget that matches the business input pattern, such as textarea for long text or radio for a small fixed choice set.',
                            'This keeps stored schema data stable while changing how users interact with the field.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.widget"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleWidgetChange(value)
                              }}
                              options={[
                                {
                                  label: `Default (${defaultWidget})`,
                                  value: '',
                                },
                                ...allWidgetOptions,
                              ]}
                            />
                          )}
                        />
                        {isItemsSchemaNode && (
                          <InputGroup
                            placeholder="Custom widget name"
                            value={configuredWidget ?? ''}
                            onChange={(event) =>
                              handleUIChange('widget', event.target.value)
                            }
                            style={{ marginTop: 8 }}
                          />
                        )}
                      </FormGroup>
                    )}

                    {showWidgetConfig && shouldShowWidgetProps && (
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Widget Props',
                          title: 'Widget-specific configuration',
                          description:
                            'Passes plain JSON props directly to the selected widget component.',
                          reasons: [
                            'Use it when a widget needs extra static options, such as accepted file types, editor language, labels, or display limits.',
                            'Keeping these values in schema lets the same widget serve multiple business scenarios without custom code per field.',
                          ],
                        })}
                        helperText="Configure options and other parameters for this widget."
                      >
                        {widgetPropsSchema ? (
                          <DynamicForm
                            schema={widgetPropsSchema}
                            defaultValues={getWidgetPropsDefaults()}
                            // Widget props 是 SchemaBuilder 的即时配置，不需要独立提交动作。
                            showSubmitButton={false}
                            renderAsForm
                            widgets={{
                              'widget-options-editor': WidgetOptionsEditor,
                            }}
                            onChange={handleWidgetPropsChange}
                          />
                        ) : (
                          <ObjectEditor
                            value={currentNode.ui?.widgetProps}
                            onChange={(val) =>
                              handleUIChange('widgetProps', val)
                            }
                          />
                        )}
                      </FormGroup>
                    )}

                    {showWidgetConfig && shouldShowWidgetProps && (
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Widget Callback Props',
                          title: 'Widget function props',
                          description:
                            'Passes function props to the selected widget through callback references or trusted inline scripts.',
                          reasons: [
                            'Use it when a widget needs dynamic behavior such as upload handlers, option filtering, or label formatting.',
                            'Keeping function props separate from widgetProps preserves widgetProps as plain JSON configuration.',
                          ],
                        })}
                        helperText="Function props resolved at render time. These override same-named widgetProps."
                      >
                        <Callout
                          intent="primary"
                          icon="info-sign"
                          style={{ marginBottom: 12 }}
                        >
                          Callback props are resolved as functions and override
                          same-named widgetProps.
                        </Callout>
                        <CallbackPropsEditor
                          value={currentNode.ui?.callbackProps}
                          onChange={(val) =>
                            handleUIChange('callbackProps', val)
                          }
                        />
                      </FormGroup>
                    )}

                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Placeholder',
                        title: 'Input hint text',
                        description:
                          'Shows short guidance inside an empty input before the user enters a value.',
                        reasons: [
                          'Use it to clarify expected format or examples without changing validation rules.',
                          'Good placeholders reduce support cost for fields with business-specific formats like IDs, emails, or percentages.',
                        ],
                      })}
                    >
                      <Controller
                        name="ui.placeholder"
                        control={control}
                        render={({ field }) => (
                          <InputGroup
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              handleUIChange('placeholder', e.target.value)
                            }
                          />
                        )}
                      />
                    </FormGroup>

                    {/* Options 配置 - 仅用于 boolean 类型 */}
                    {currentType === 'boolean' && (
                      <>
                        <FormGroup
                          label={renderLabelWithTooltip({
                            label: 'Boolean Display Labels',
                            title: 'Human-readable true/false labels',
                            description:
                              'Configures the display text for boolean values when rendered as radio or checkbox-style choices.',
                            reasons: [
                              'Use business language such as Approved/Rejected or Enabled/Disabled instead of raw true/false.',
                              'The stored value remains boolean, so downstream logic can stay simple and predictable.',
                            ],
                          })}
                          helperText="Configure display labels for boolean values (used with radio/checkbox widget)"
                        >
                          {(() => {
                            // boolean enumNames 保存 true/false 的展示文案，缺省时允许逐项补齐。
                            const enumNames = currentNode.enumNames || []
                            // 固定布尔值顺序，使标签编辑始终对应 true 后 false。
                            const displayEnum = [true, false]

                            // 仅更新布尔选项的展示名称，存储值始终固定为 true/false。
                            const handleUpdateLabel = (
                              index: number,
                              label: string,
                            ) => {
                              // 使用副本更新单个标签，保留另一个布尔值的展示名称。
                              const newEnumNames = [...enumNames]
                              newEnumNames[index] = label

                              // 同时设置 enum 为 [true, false]
                              onUpdate(selectedPath, {
                                enum: [true, false],
                                enumNames: newEnumNames,
                              })
                            }

                            return (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                }}
                              >
                                {displayEnum.map(
                                  (value: any, index: number) => (
                                    <div
                                      key={index}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: '#f9f9f9',
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            minWidth: '50px',
                                            fontSize: '12px',
                                            color: '#5c7080',
                                          }}
                                        >
                                          Value:
                                        </span>
                                        <Tag
                                          intent={value ? 'success' : 'none'}
                                        >
                                          {String(value)}
                                        </Tag>
                                      </div>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            minWidth: '50px',
                                            fontSize: '12px',
                                            color: '#5c7080',
                                          }}
                                        >
                                          Label:
                                        </span>
                                        <InputGroup
                                          placeholder={value ? 'Yes' : 'No'}
                                          value={enumNames[index] || ''}
                                          onChange={(e) =>
                                            handleUpdateLabel(
                                              index,
                                              e.target.value,
                                            )
                                          }
                                          style={{ flex: 1 }}
                                        />
                                      </div>
                                    </div>
                                  ),
                                )}
                              </div>
                            )
                          })()}
                        </FormGroup>
                      </>
                    )}
                  </ConfigSection>

                  <ConfigSection
                    title="Visibility and State"
                    description="Control whether the field is shown, editable, or review-only by default."
                  >
                    <Controller
                      name="ui.hidden"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          style={{ display: 'flex', alignItems: 'center' }}
                          labelElement={renderSwitchLabelWithTooltip({
                            label: 'Hidden',
                            title: 'Hide this field from the form',
                            description:
                              'Removes the field from the visible UI when it should not be shown by default.',
                            reasons: [
                              'Use it for fields controlled by business rules, internal data, or progressive disclosure.',
                              'Hidden fields are skipped by static validation, which prevents users from being blocked by fields they cannot see.',
                            ],
                          })}
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('hidden', e.currentTarget.checked)
                          }
                        />
                      )}
                    />

                    <Controller
                      name="ui.disabled"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          style={{ display: 'flex', alignItems: 'center' }}
                          labelElement={renderSwitchLabelWithTooltip({
                            label: 'Disabled',
                            title: 'Prevent user input',
                            description:
                              'Shows the field in a disabled state so users can see it but cannot edit it.',
                            reasons: [
                              'Use it for system-managed values, locked workflow states, or fields awaiting another prerequisite.',
                              'Disabled fields communicate context without allowing accidental changes to protected business data.',
                            ],
                          })}
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('disabled', e.currentTarget.checked)
                          }
                        />
                      )}
                    />

                    <Controller
                      name="ui.readonly"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          style={{ display: 'flex', alignItems: 'center' }}
                          labelElement={renderSwitchLabelWithTooltip({
                            label: 'Readonly',
                            title: 'Display value as read-only',
                            description:
                              'Keeps the field visible while making its current value non-editable.',
                            reasons: [
                              'Use it when users need to review calculated, imported, or approved values.',
                              'Readonly is useful when the value should still be part of the form context but edits must happen elsewhere.',
                            ],
                          })}
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('readonly', e.currentTarget.checked)
                          }
                        />
                      )}
                    />
                  </ConfigSection>

                  <ConfigSection
                    title="Layout Rules"
                    description="Tune how this field occupies space in dense or multi-column forms."
                  >
                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Layout',
                        title: 'Field-level layout override',
                        description:
                          'Overrides the global form layout for this field: vertical, horizontal, or inline.',
                        reasons: [
                          'Use vertical layout for longer inputs, horizontal layout for dense enterprise forms, and inline layout for compact controls.',
                          'Field-level overrides let important exceptions fit the business workflow without changing the whole form.',
                        ],
                      })}
                    >
                      <Controller
                        name="ui.layout"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value ?? ''}
                            onChange={(value) => {
                              field.onChange(value)
                              handleUIChange('layout', value)
                            }}
                            options={[
                              { label: '(none)', value: '' },
                              { label: 'vertical', value: 'vertical' },
                              { label: 'horizontal', value: 'horizontal' },
                              { label: 'inline', value: 'inline' },
                            ]}
                          />
                        )}
                      />
                    </FormGroup>

                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Label Width',
                        title: 'Label width for horizontal layout',
                        description:
                          'Controls the label area width when this field uses horizontal layout.',
                        reasons: [
                          'Use it to align fields with long business labels and keep inputs starting at a consistent position.',
                          'Consistent label width improves scanability in operational forms with many parameters.',
                        ],
                      })}
                    >
                      <Controller
                        name="ui.labelWidth"
                        control={control}
                        render={({ field }) => (
                          <InputGroup
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              handleUIChange('labelWidth', e.target.value)
                            }
                          />
                        )}
                      />
                    </FormGroup>

                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Column Span',
                        title: 'Grid width for this field',
                        description:
                          'Controls how many layout columns this field occupies inside a multi-column form.',
                        reasons: [
                          'Use it to give wide fields like textareas, code editors, or nested objects more room.',
                          'It lets high-priority or complex business fields remain readable in dense layouts.',
                        ],
                      })}
                      helperText="Number of columns this field spans in multi-column layout"
                    >
                      <Controller
                        name="ui.colSpan"
                        control={control}
                        render={({ field }) => (
                          <NumericInput
                            {...field}
                            value={field.value ?? 1}
                            onValueChange={(value) =>
                              handleUIChange('colSpan', value)
                            }
                            min={1}
                            max={12}
                            fill
                          />
                        )}
                      />
                    </FormGroup>
                  </ConfigSection>

                  {currentType === 'object' && (
                    <ConfigSection
                      title="Object Flattening"
                      description="Flatten nested object fields when backend structure and user workflow should differ."
                    >
                      <Controller
                        name="ui.flattenPath"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            style={{ display: 'flex', alignItems: 'center' }}
                            labelElement={renderSwitchLabelWithTooltip({
                              label: 'Flatten Path (Transparent)',
                              title: 'Flatten nested fields in the UI',
                              description:
                                'Displays child fields from this object at the parent level while preserving the nested submitted data structure.',
                              reasons: [
                                'Use it to simplify deeply nested configuration forms without losing the API contract.',
                                'It is helpful when nesting exists for backend structure but would make the user workflow harder to read.',
                              ],
                            })}
                            checked={!!field.value}
                            onChange={(e) =>
                              handleUIChange(
                                'flattenPath',
                                e.currentTarget.checked,
                              )
                            }
                          />
                        )}
                      />

                      <Controller
                        name="ui.flattenPrefix"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            style={{ display: 'flex', alignItems: 'center' }}
                            labelElement={renderSwitchLabelWithTooltip({
                              label: 'Flatten Prefix',
                              title: 'Prefix flattened field labels',
                              description:
                                'Adds the parent title as a label prefix when flattened child fields are displayed.',
                              reasons: [
                                'Use it to preserve business context after flattening removes visible nesting.',
                                'Prefixes prevent similarly named fields from different object groups from becoming ambiguous.',
                              ],
                            })}
                            checked={!!field.value}
                            onChange={(e) =>
                              handleUIChange(
                                'flattenPrefix',
                                e.currentTarget.checked,
                              )
                            }
                          />
                        )}
                      />
                    </ConfigSection>
                  )}

                  {currentType === 'array' && !isItemsSchemaNode && (
                    <ConfigSection
                      title="Array Behavior"
                      description="Choose how repeated values are edited and how add actions are labeled."
                    >
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Array Mode',
                          title: 'How users edit array values',
                          description:
                            'Chooses between dynamic item editing and static option selection for array fields.',
                          reasons: [
                            'Use dynamic mode when users create arbitrary repeated records or values.',
                            'Use static mode when the business domain is a fixed multi-select list, such as permissions, tags, or supported channels.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.arrayMode"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleUIChange('arrayMode', value)
                              }}
                              options={[
                                { label: 'dynamic', value: 'dynamic' },
                                { label: 'static', value: 'static' },
                              ]}
                            />
                          )}
                        />
                      </FormGroup>

                      {/* Static 模式下的选项配置 */}
                      {watch('ui.arrayMode') === 'static' && (
                        <FormGroup
                          label={renderLabelWithTooltip({
                            label: 'Array Items Options',
                            title: 'Static choices for array values',
                            description:
                              'Configures the available values and display labels for static array mode.',
                            reasons: [
                              'Use it to make multi-select arrays consistent with an approved business vocabulary.',
                              'Separating stored value from display label keeps integrations stable while showing user-friendly text.',
                            ],
                          })}
                          helperText="Configure available options for static array (multi-select checkboxes)"
                        >
                          {(() => {
                            // 静态数组选项实际定义在 items schema，而非数组字段本身。
                            const items = currentNode.items || {}
                            // 读取元素可选值，供列表展示和增删改回调使用。
                            const enumValues = items.enum || []
                            // 与 enumValues 同索引保存标签；缺失标签时保持空列表兼容旧数据。
                            const enumNames = items.enumNames || []

                            // 新增静态数组选项时同时扩展值和标签列表，保持索引对应。
                            const handleAddOption = () => {
                              // 新选项先用空值占位，保持 value 与 label 数组索引对齐。
                              const newEnum = [...enumValues, '']
                              // 新 label 同步增加占位，确保后续编辑不会错配选项。
                              const newEnumNames = [...enumNames, '']
                              onUpdate(selectedPath, {
                                items: {
                                  ...items,
                                  enum: newEnum,
                                  enumNames: newEnumNames,
                                },
                              })
                            }

                            // 删除选项时同步裁剪 enum 与 enumNames，避免留下错位标签。
                            const handleRemoveOption = (index: number) => {
                              // 从值和标签数组按同一索引删除，避免标签与值错位。
                              const newEnum = enumValues.filter(
                                (_: any, i: number) => i !== index,
                              )
                              // 同步移除对应标签，保持 items.enumNames 与 enum 对齐。
                              const newEnumNames = enumNames.filter(
                                (_: any, i: number) => i !== index,
                              )
                              onUpdate(selectedPath, {
                                items: {
                                  ...items,
                                  enum:
                                    newEnum.length > 0 ? newEnum : undefined,
                                  enumNames:
                                    newEnumNames.length > 0
                                      ? newEnumNames
                                      : undefined,
                                },
                              })
                            }

                            // 更新静态选项的实际值，同时保留同索引展示标签。
                            const handleUpdateValue = (
                              index: number,
                              value: string,
                            ) => {
                              // 复制选项值列表后修改单项，避免原地更改 Schema。
                              const newEnum = [...enumValues]
                              newEnum[index] = value
                              onUpdate(selectedPath, {
                                items: { ...items, enum: newEnum },
                              })
                            }

                            // 更新静态选项展示标签，不改变其实际校验值。
                            const handleUpdateLabel = (
                              index: number,
                              label: string,
                            ) => {
                              // 复制标签列表后修改单项，避免原地更改 Schema。
                              const newEnumNames = [...enumNames]
                              newEnumNames[index] = label
                              onUpdate(selectedPath, {
                                items: { ...items, enumNames: newEnumNames },
                              })
                            }

                            return (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                }}
                              >
                                {enumValues.length > 0 ? (
                                  enumValues.map(
                                    (value: any, index: number) => (
                                      <div
                                        key={index}
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 8,
                                          padding: '8px',
                                          border: '1px solid #ddd',
                                          borderRadius: '4px',
                                          backgroundColor: '#f9f9f9',
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontWeight: 500,
                                              minWidth: '50px',
                                              fontSize: '12px',
                                              color: '#5c7080',
                                            }}
                                          >
                                            Value:
                                          </span>
                                          <InputGroup
                                            value={String(value)}
                                            onChange={(e) =>
                                              handleUpdateValue(
                                                index,
                                                e.target.value,
                                              )
                                            }
                                            style={{ flex: 1 }}
                                          />
                                          <Button
                                            icon="cross"
                                            minimal
                                            small
                                            onClick={() =>
                                              handleRemoveOption(index)
                                            }
                                          />
                                        </div>
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontWeight: 500,
                                              minWidth: '50px',
                                              fontSize: '12px',
                                              color: '#5c7080',
                                            }}
                                          >
                                            Label:
                                          </span>
                                          <InputGroup
                                            placeholder="Display text"
                                            value={enumNames[index] || ''}
                                            onChange={(e) =>
                                              handleUpdateLabel(
                                                index,
                                                e.target.value,
                                              )
                                            }
                                            style={{ flex: 1 }}
                                          />
                                        </div>
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <Callout intent="warning" icon="info-sign">
                                    No options configured. Add options to enable
                                    static array mode.
                                  </Callout>
                                )}
                                <Button
                                  icon="add"
                                  text="Add Option"
                                  minimal
                                  onClick={handleAddOption}
                                />
                              </div>
                            )
                          })()}
                        </FormGroup>
                      )}

                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Add Button Text',
                          title: 'Array add action label',
                          description:
                            'Customizes the button text users click to add another array item.',
                          reasons: [
                            'Use domain-specific language like Add Contact, Add Mapping, or Add Header to make the action clear.',
                            'Clear action text reduces mistakes in repeatable sections where users may add many records.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.addButtonText"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                handleUIChange('addButtonText', e.target.value)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  <ConfigSection
                    title="Data Handling"
                    description="Configure value conversion when the displayed input differs from stored form data."
                  >
                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Field Transform',
                        title: 'Convert between input and stored values',
                        description:
                          'Configures transformation functions for cases where the displayed input domain differs from the value stored in form data.',
                        reasons: [
                          'Use it for business-friendly inputs such as percentages shown as 96 while storing 0.96.',
                          'Transforms keep external API payloads correct without forcing users to enter backend-oriented values.',
                        ],
                      })}
                    >
                      <Callout
                        intent="primary"
                        icon="info-sign"
                        style={{ marginBottom: 12 }}
                      >
                        Transform functions convert between the value users type
                        and the value stored in form data.
                      </Callout>
                      <TransformEditor
                        value={currentNode.ui?.transform}
                        onChange={(transform) =>
                          handleUIChange('transform', transform)
                        }
                      />
                    </FormGroup>
                  </ConfigSection>
                </div>
              </div>
            }
          />

          <Tab
            id="linkage"
            title="Linkage"
            panel={
              <div className="editor-panel">
                <LinkagesEditor
                  key={selectedPath.join('.')}
                  value={currentNode.ui?.linkages}
                  onChange={(linkages) => handleUIChange('linkages', linkages)}
                  currentFieldPath={currentFieldPath}
                  schema={schema}
                />
              </div>
            }
          />

          {!options?.hidden?.variantsTab && (
            <Tab
              id="variants"
              title="Variants"
              panel={
                <div className="editor-panel">
                  <ConfigSection
                    title="Field Variants"
                    description="Configure independent data types and widgets for this field."
                  >
                    <VariantsEditor
                      value={currentNode.ui?.variants}
                      defaultVariant={currentNode.ui?.defaultVariant}
                      onChange={(variants, nextDefaultVariant) => {
                        // 记录更新前是否已有 Variant，以区分首次添加与清空后的默认恢复。
                        const hadVariants =
                          (currentNode.ui?.variants?.length ?? 0) > 0
                        // 更新后是否仍有 Variant，决定是否切换到 VariantWidget。
                        const hasVariants = (variants?.length ?? 0) > 0
                        onUpdate(selectedPath, {
                          ui: {
                            ...currentNode.ui,
                            variants,
                            defaultVariant: nextDefaultVariant,
                            widget: hasVariants
                              ? 'variant'
                              : hadVariants
                                ? getDefaultWidget(currentNode)
                                : currentNode.ui?.widget,
                          },
                        })
                      }}
                    />
                  </ConfigSection>
                </div>
              }
            />
          )}
        </Tabs>
      )}
      <Dialog
        isOpen={isTypeConflictOpen}
        onClose={() => undefined}
        title="Widget and field type conflict"
        canEscapeKeyClose={false}
        canOutsideClickClose={false}
      >
        <DialogBody>
          <Callout intent="warning">
            {widgetSupportedTypes?.length
              ? `The selected Widget supports field types ${widgetSupportedTypes
                  .map((type) => `"${type}"`)
                  .join(' or ')}, but the field type is "${pendingType}".`
              : `The selected Widget requires type "${widgetRequiredType}", but the field type is "${pendingType}".`}
          </Callout>
          <p style={{ marginTop: 12 }}>
            Choose how to resolve the conflict before continuing.
          </p>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button intent="primary" onClick={handleUseWidgetType}>
                {conflictUseType ? `Use ${conflictUseType}` : 'Use widget type'}
              </Button>
              <Button onClick={handleRemoveWidget}>Remove widget</Button>
            </>
          }
        />
      </Dialog>
    </div>
  )
}
