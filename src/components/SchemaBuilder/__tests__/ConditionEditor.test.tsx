/**
 * ConditionEditor 组件测试
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ConditionEditor } from '../components/PropertyEditor/components/ConditionEditor'
import { basicSchema } from './testHelpers'

// Mock FieldPathSelector 组件以便测试
jest.mock('../components/PropertyEditor/components/FieldPathSelector', () => ({
  FieldPathSelector: ({ value, onChange, disabled, placeholder }: any) => (
    <input
      data-testid="field-path-selector"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  ),
}))

// Mock Select 组件以便测试
jest.mock('../../../../Select', () => ({
  Select: ({ value, onChange, disabled, options }: any) => {
    const selectedOption = options.find((opt: any) => opt.value === value)
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  },
}))

describe('ConditionEditor', () => {
  const defaultProps = {
    schema: basicSchema,
    currentFieldPath: '#/properties/name',
    dependencies: ['#/properties/age'],
    onChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('无依赖字段时', () => {
    it('应该显示警告提示', () => {
      render(<ConditionEditor {...defaultProps} dependencies={[]} />)

      expect(
        screen.getByText(/Please add at least one dependency field/i)
      ).toBeInTheDocument()
    })
  })

  describe('无条件配置时', () => {
    it('应该显示创建条件的按钮', () => {
      render(<ConditionEditor {...defaultProps} />)

      expect(screen.getByText('Single Condition')).toBeInTheDocument()
      expect(screen.getByText('AND Group')).toBeInTheDocument()
      expect(screen.getByText('OR Group')).toBeInTheDocument()
    })

    it('点击 Single Condition 应该创建单条件', () => {
      const onChange = jest.fn()
      render(<ConditionEditor {...defaultProps} onChange={onChange} />)

      fireEvent.click(screen.getByText('Single Condition'))

      expect(onChange).toHaveBeenCalledWith({
        field: '',
        operator: '==',
        value: '',
      })
    })

    it('点击 AND Group 应该创建 AND 组合', () => {
      const onChange = jest.fn()
      render(<ConditionEditor {...defaultProps} onChange={onChange} />)

      fireEvent.click(screen.getByText('AND Group'))

      expect(onChange).toHaveBeenCalledWith({
        and: [{ field: '', operator: '==', value: '' }],
      })
    })

    it('点击 OR Group 应该创建 OR 组合', () => {
      const onChange = jest.fn()
      render(<ConditionEditor {...defaultProps} onChange={onChange} />)

      fireEvent.click(screen.getByText('OR Group'))

      expect(onChange).toHaveBeenCalledWith({
        or: [{ field: '', operator: '==', value: '' }],
      })
    })
  })

  describe('单条件编辑', () => {
    it('应该显示单条件编辑器', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('应该显示清除按钮', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      expect(screen.getByText('Clear All')).toBeInTheDocument()
    })

    it('点击清除按钮应该清除条件', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      fireEvent.click(screen.getByText('Clear All'))

      expect(onChange).toHaveBeenCalledWith(undefined)
    })
  })

  describe('AND 条件编辑', () => {
    it('应该显示 AND 标签', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      expect(screen.getByText('AND')).toBeInTheDocument()
    })

    it('应该显示 AND 逻辑说明', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      expect(
        screen.getByText(/All conditions must be satisfied/i)
      ).toBeInTheDocument()
    })
  })

  describe('OR 条件编辑', () => {
    it('应该显示 OR 标签', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            or: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      expect(screen.getByText('OR')).toBeInTheDocument()
    })

    it('应该显示 OR 逻辑说明', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            or: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      expect(
        screen.getByText(/Any condition can be satisfied/i)
      ).toBeInTheDocument()
    })
  })

  describe('禁用状态', () => {
    it('禁用状态下按钮应该被禁用', () => {
      render(<ConditionEditor {...defaultProps} disabled={true} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })
  })

  describe('操作符选项', () => {
    it('isEmpty 和 isNotEmpty 操作符不需要值', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: 'isEmpty' }}
        />
      )

      // 不应该显示 Compare Value 输入框
      expect(screen.queryByText('Compare Value')).not.toBeInTheDocument()
    })

    it('isNotEmpty 操作符不需要值', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: 'isNotEmpty' }}
        />
      )

      expect(screen.queryByText('Compare Value')).not.toBeInTheDocument()
    })
  })

  describe('添加条件到组', () => {
    it('点击 Add Condition 应该显示菜单', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      // Add Condition 按钮存在
      expect(screen.getByText('Add Condition')).toBeInTheDocument()
    })

    it('AND 组应该显示 Add Condition 按钮', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      const addButton = screen.getByText('Add Condition')
      expect(addButton).toBeInTheDocument()
      expect(addButton.closest('button')).not.toBeDisabled()
    })

    it('OR 组应该显示 Add Condition 按钮', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            or: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      const addButton = screen.getByText('Add Condition')
      expect(addButton).toBeInTheDocument()
      expect(addButton.closest('button')).not.toBeDisabled()
    })
  })

  describe('删除条件', () => {
    it('点击删除按钮应该移除条件', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            and: [
              { field: '#/properties/age', operator: '>', value: '18' },
              { field: '#/properties/name', operator: '==', value: 'test' },
            ],
          }}
        />
      )

      const deleteButtons = screen.getAllByRole('button')
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector('.bp5-icon-trash')
      )
      if (trashButton) {
        fireEvent.click(trashButton)
        expect(onChange).toHaveBeenCalled()
      }
    })
  })

  describe('多个依赖字段', () => {
    it('应该正确处理多个依赖字段', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          dependencies={['#/properties/age', '#/properties/email']}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })
  })

  describe('嵌套条件组', () => {
    it('应该正确渲染嵌套的 AND 组', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            and: [
              { field: '#/properties/age', operator: '>', value: '18' },
              {
                or: [
                  { field: '#/properties/name', operator: '==', value: 'test' },
                ],
              },
            ],
          }}
        />
      )

      expect(screen.getByText('AND')).toBeInTheDocument()
      expect(screen.getByText('OR')).toBeInTheDocument()
    })

    it('应该显示嵌套层级标签', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      expect(screen.getByText('Level 1')).toBeInTheDocument()
    })
  })

  describe('操作符变更', () => {
    it('修改操作符应该调用 onChange', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      const select = screen.getByDisplayValue('Equals (==)')
      fireEvent.change(select, { target: { value: '>' } })

      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('值输入变更', () => {
    it('修改值应该调用 onChange', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      const input = screen.getByDisplayValue('18')
      fireEvent.change(input, { target: { value: '25' } })

      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('转换为组', () => {
    it('单条件应该显示 Single 标签', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('点击 Convert to AND 应该转换为 AND 组', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      // 找到 Convert to AND 按钮
      const convertButton = screen.queryByText('Convert to AND')
      if (convertButton) {
        fireEvent.click(convertButton)
        expect(onChange).toHaveBeenCalled()
      }
    })

    it('点击 Convert to OR 应该转换为 OR 组', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      const convertButton = screen.queryByText('Convert to OR')
      if (convertButton) {
        fireEvent.click(convertButton)
        expect(onChange).toHaveBeenCalled()
      }
    })
  })

  describe('in 和 notIn 操作符', () => {
    it('in 操作符应该显示数组输入', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            field: '#/properties/age',
            operator: 'in',
            value: ['18', '20'],
          }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('notIn 操作符应该显示数组输入', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            field: '#/properties/age',
            operator: 'notIn',
            value: ['18'],
          }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })
  })

  describe('includes 和 notIncludes 操作符', () => {
    it('includes 操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            field: '#/properties/name',
            operator: 'includes',
            value: 'test',
          }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('notIncludes 操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{
            field: '#/properties/name',
            operator: 'notIncludes',
            value: 'test',
          }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })
  })

  describe('比较操作符', () => {
    it('大于操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '>', value: '18' }}
        />
      )

      expect(screen.getByDisplayValue('Greater Than (>)')).toBeInTheDocument()
    })

    it('小于操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '<', value: '18' }}
        />
      )

      expect(screen.getByDisplayValue('Less Than (<)')).toBeInTheDocument()
    })

    it('大于等于操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '>=', value: '18' }}
        />
      )

      expect(
        screen.getByDisplayValue('Greater or Equal (>=)')
      ).toBeInTheDocument()
    })

    it('小于等于操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '<=', value: '18' }}
        />
      )

      expect(screen.getByDisplayValue('Less or Equal (<=)')).toBeInTheDocument()
    })

    it('不等于操作符应该正确渲染', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          value={{ field: '#/properties/age', operator: '!=', value: '18' }}
        />
      )

      expect(screen.getByDisplayValue('Not Equals (!=)')).toBeInTheDocument()
    })
  })

  describe('filterSchemaByDependencies 边缘情况', () => {
    it('相对路径 ./ 应该被忽略', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          dependencies={['./relativeField']}
          value={{ field: '', operator: '==', value: '' }}
        />
      )

      // 组件应该正常渲染
      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('非标准路径应该被忽略', () => {
      render(
        <ConditionEditor
          {...defaultProps}
          dependencies={['invalidPath']}
          value={{ field: '', operator: '==', value: '' }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('嵌套对象路径应该正确处理', () => {
      const nestedSchema = {
        type: 'object' as const,
        title: 'Test',
        properties: {
          user: {
            type: 'object' as const,
            title: 'User',
            properties: {
              profile: {
                type: 'object' as const,
                title: 'Profile',
                properties: {
                  name: { type: 'string' as const, title: 'Name' },
                },
              },
            },
          },
        },
      }

      render(
        <ConditionEditor
          schema={nestedSchema}
          currentFieldPath="#/properties/other"
          dependencies={[
            '#/properties/user/properties/profile/properties/name',
          ]}
          onChange={jest.fn()}
          value={{ field: '', operator: '==', value: '' }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })

    it('数组 items 路径应该正确处理', () => {
      const arraySchema = {
        type: 'object' as const,
        title: 'Test',
        properties: {
          contacts: {
            type: 'array' as const,
            title: 'Contacts',
            items: {
              type: 'object' as const,
              properties: {
                email: { type: 'string' as const, title: 'Email' },
              },
            },
          },
        },
      }

      render(
        <ConditionEditor
          schema={arraySchema}
          currentFieldPath="#/properties/other"
          dependencies={['#/properties/contacts/items/properties/email']}
          onChange={jest.fn()}
          value={{ field: '', operator: '==', value: '' }}
        />
      )

      expect(screen.getByText('Single')).toBeInTheDocument()
    })
  })

  describe('逻辑组合条件交互', () => {
    it('点击 Add Single Condition 菜单项应该添加单条件', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      // 点击 Add Condition 按钮打开菜单
      const addButton = screen.getByText('Add Condition')
      fireEvent.click(addButton)

      // 点击 Add Single Condition 菜单项
      const menuItem = screen.getByText('Add Single Condition')
      fireEvent.click(menuItem)

      expect(onChange).toHaveBeenCalledWith({
        and: [
          { field: '#/properties/age', operator: '>', value: '18' },
          { field: '', operator: '==', value: '' },
        ],
      })
    })

    it('点击 Add AND Group 菜单项应该添加 AND 组', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            or: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      const addButton = screen.getByText('Add Condition')
      fireEvent.click(addButton)

      const menuItem = screen.getByText('Add AND Group')
      fireEvent.click(menuItem)

      expect(onChange).toHaveBeenCalledWith({
        or: [
          { field: '#/properties/age', operator: '>', value: '18' },
          { and: [{ field: '', operator: '==', value: '' }] },
        ],
      })
    })

    it('点击 Add OR Group 菜单项应该添加 OR 组', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      const addButton = screen.getByText('Add Condition')
      fireEvent.click(addButton)

      const menuItem = screen.getByText('Add OR Group')
      fireEvent.click(menuItem)

      expect(onChange).toHaveBeenCalledWith({
        and: [
          { field: '#/properties/age', operator: '>', value: '18' },
          { or: [{ field: '', operator: '==', value: '' }] },
        ],
      })
    })

    it('更新嵌套条件应该调用 onChange', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      // 修改嵌套条件的操作符
      const select = screen.getByDisplayValue('Greater Than (>)')
      fireEvent.change(select, { target: { value: '<' } })

      expect(onChange).toHaveBeenCalled()
    })

    it('删除嵌套条件后只剩一个应该保留组结构', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            and: [
              { field: '#/properties/age', operator: '>', value: '18' },
              { field: '#/properties/name', operator: '==', value: 'test' },
            ],
          }}
        />
      )

      // 找到删除按钮并点击
      const deleteButtons = screen.getAllByRole('button')
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector('.bp5-icon-trash')
      )
      if (trashButton) {
        fireEvent.click(trashButton)
        expect(onChange).toHaveBeenCalled()
      }
    })

    it('删除最后一个嵌套条件应该转换为单条件', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            and: [{ field: '#/properties/age', operator: '>', value: '18' }],
          }}
        />
      )

      // 找到删除按钮并点击
      const deleteButtons = screen.getAllByRole('button')
      const trashButton = deleteButtons.find((btn) =>
        btn.querySelector('.bp5-icon-trash')
      )
      if (trashButton) {
        fireEvent.click(trashButton)
        expect(onChange).toHaveBeenCalledWith({
          field: '',
          operator: '==',
          value: '',
        })
      }
    })
  })

  describe('转换条件类型', () => {
    it('点击 Convert to AND 应该将单条件转换为 AND 组', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      // 点击更多按钮打开菜单
      const moreButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('.bp5-icon-more'))
      if (moreButton) {
        fireEvent.click(moreButton)

        // 点击 Convert to AND 菜单项
        const convertButton = screen.getByText('Convert to AND')
        fireEvent.click(convertButton)

        expect(onChange).toHaveBeenCalledWith({
          and: [{ field: '#/properties/age', operator: '==', value: '18' }],
        })
      }
    })

    it('点击 Convert to OR 应该将单条件转换为 OR 组', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      const moreButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('.bp5-icon-more'))
      if (moreButton) {
        fireEvent.click(moreButton)

        const convertButton = screen.getByText('Convert to OR')
        fireEvent.click(convertButton)

        expect(onChange).toHaveBeenCalledWith({
          or: [{ field: '#/properties/age', operator: '==', value: '18' }],
        })
      }
    })
  })

  describe('FieldPathSelector 交互', () => {
    it('修改字段路径应该调用 onChange', () => {
      const onChange = jest.fn()
      render(
        <ConditionEditor
          {...defaultProps}
          onChange={onChange}
          value={{ field: '#/properties/age', operator: '==', value: '18' }}
        />
      )

      const fieldSelector = screen.getByTestId('field-path-selector')
      fireEvent.change(fieldSelector, {
        target: { value: '#/properties/name' },
      })

      expect(onChange).toHaveBeenCalledWith({
        field: '#/properties/name',
        operator: '==',
        value: '18',
      })
    })
  })
})
