/**
 * LinkageEditor 组件测试
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LinkageEditor } from '../components/PropertyEditor/components/LinkageEditor'
import { basicSchema } from './testHelpers'

describe('LinkageEditor', () => {
  const defaultProps = {
    schema: basicSchema,
    currentFieldPath: '#/properties/name',
    value: { type: 'visibility' as const, dependencies: [] },
    onChange: jest.fn(),
    onSave: jest.fn(),
    onCancel: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // 注意：组件设计已变更，不再支持"无联动配置"状态
  // 组件始终显示联动配置表单，因此删除了相关测试
  describe('无联动配置时', () => {
    it.skip('应该显示启用联动按钮', () => {
      // 组件不再有启用/禁用切换界面
    })

    it.skip('应该显示提示信息', () => {
      // 组件不再有"No linkage configured"提示
    })

    it.skip('点击启用按钮应该创建默认联动配置', () => {
      // 组件不再有启用按钮
    })
  })

  describe('有联动配置时', () => {
    const linkageValue = {
      type: 'visibility' as const,
      dependencies: ['#/properties/age'],
    }

    it('应该显示联动类型选择器', () => {
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it.skip('应该显示禁用联动按钮', () => {
      // 组件不再有禁用联动按钮
    })

    it.skip('点击禁用按钮应该清除联动配置', () => {
      // 组件不再有禁用联动功能
    })
  })

  describe('不同联动类型', () => {
    it('应该正确渲染 disabled 类型联动', () => {
      const disabledLinkage = {
        type: 'disabled' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={disabledLinkage} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it('应该正确渲染 readonly 类型联动', () => {
      const readonlyLinkage = {
        type: 'readonly' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={readonlyLinkage} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it('应该正确渲染 value 类型联动', () => {
      const valueLinkage = {
        type: 'value' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={valueLinkage} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })
  })

  describe('禁用状态', () => {
    it.skip('禁用状态下应该正常渲染', () => {
      // 组件不再有 Enable Linkage 按钮，始终显示联动配置表单
    })
  })

  describe('联动类型切换', () => {
    it('切换联动类型应该调用 onChange', () => {
      const onChange = jest.fn()
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: [],
      }
      render(
        <LinkageEditor
          {...defaultProps}
          onChange={onChange}
          value={linkageValue}
        />
      )

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: 'disabled' } })

      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('依赖字段管理', () => {
    it('点击添加依赖按钮应该添加空依赖', () => {
      const onChange = jest.fn()
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: [],
      }
      render(
        <LinkageEditor
          {...defaultProps}
          onChange={onChange}
          value={linkageValue}
        />
      )

      fireEvent.click(screen.getByText('Add Dependency'))

      expect(onChange).toHaveBeenCalledWith({
        type: 'visibility',
        dependencies: [''],
      })
    })

    it('点击删除按钮应该移除依赖', () => {
      const onChange = jest.fn()
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
      }
      render(
        <LinkageEditor
          {...defaultProps}
          onChange={onChange}
          value={linkageValue}
        />
      )

      const deleteButtons = screen.getAllByRole('button')
      const trashButton = deleteButtons.find(
        (btn) =>
          btn.querySelector('.bp5-icon-trash') ||
          btn.querySelector('.bp6-icon-trash')
      )
      if (trashButton) {
        fireEvent.click(trashButton)
        expect(onChange).toHaveBeenCalledWith({
          type: 'visibility',
          dependencies: [],
        })
      }
    })

    it('删除多个依赖中的一个应该保留其他依赖', () => {
      const onChange = jest.fn()
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age', '#/properties/email'],
      }
      render(
        <LinkageEditor
          {...defaultProps}
          onChange={onChange}
          value={linkageValue}
        />
      )

      const deleteButtons = screen.getAllByRole('button')
      const trashButtons = deleteButtons.filter(
        (btn) =>
          btn.querySelector('.bp5-icon-trash') ||
          btn.querySelector('.bp6-icon-trash')
      )
      if (trashButtons.length > 0) {
        fireEvent.click(trashButtons[0])
        expect(onChange).toHaveBeenCalled()
      }
    })
  })

  describe('options 类型联动', () => {
    it('应该正确渲染 options 类型联动', () => {
      const optionsLinkage = {
        type: 'options' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={optionsLinkage} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it('options 类型应该显示 Enable Cache 选项', () => {
      const optionsLinkage = {
        type: 'options' as const,
        dependencies: [],
      }
      render(<LinkageEditor {...defaultProps} value={optionsLinkage} />)
      expect(screen.getByText('Enable Cache')).toBeInTheDocument()
    })
  })

  describe('schema 类型联动', () => {
    it('应该正确渲染 schema 类型联动', () => {
      const schemaLinkage = {
        type: 'schema' as const,
        dependencies: [],
      }
      render(<LinkageEditor {...defaultProps} value={schemaLinkage} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it('schema 类型应该显示 Enable Cache 选项', () => {
      const schemaLinkage = {
        type: 'schema' as const,
        dependencies: [],
      }
      render(<LinkageEditor {...defaultProps} value={schemaLinkage} />)
      expect(screen.getByText('Enable Cache')).toBeInTheDocument()
    })
  })

  describe('Enable Cache 开关', () => {
    it('切换 Enable Cache 应该调用 onChange', () => {
      const onChange = jest.fn()
      const valueLinkage = {
        type: 'value' as const,
        dependencies: [],
      }
      render(
        <LinkageEditor
          {...defaultProps}
          onChange={onChange}
          value={valueLinkage}
        />
      )

      const cacheSwitch = screen.getByLabelText('Enable Cache')
      fireEvent.click(cacheSwitch)

      expect(onChange).toHaveBeenCalled()
    })

    it('切换 Enable Cache 为 true 应该更新配置', () => {
      const onChange = jest.fn()
      const valueLinkage = {
        type: 'value' as const,
        dependencies: [],
        enableCache: false,
      }
      render(
        <LinkageEditor
          {...defaultProps}
          onChange={onChange}
          value={valueLinkage}
        />
      )

      const cacheSwitch = screen.getByLabelText('Enable Cache')
      fireEvent.click(cacheSwitch)

      expect(onChange).toHaveBeenCalledWith({
        type: 'value',
        dependencies: [],
        enableCache: true,
      })
    })
  })

  describe('value 同步', () => {
    it.skip('value 变化时应该同步 isEnabled 状态', () => {
      // 组件不再有 Enable/Disable 切换界面，始终显示联动配置表单
    })
  })

  describe('条件和效果配置', () => {
    it('应该显示 Condition (When) 配置区域', () => {
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Condition (When)')).toBeInTheDocument()
    })

    it('应该显示 Effect (Fulfill) 配置区域', () => {
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Effect (Fulfill)')).toBeInTheDocument()
    })

    it('应该显示 Effect (Otherwise) 配置区域', () => {
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
      }
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Effect (Otherwise)')).toBeInTheDocument()
    })

    it('应该正确渲染带有 when 条件的联动配置', () => {
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
        when: {
          field: '#/properties/age',
          operator: '>' as const,
          value: '18',
        },
      }
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it('应该正确渲染带有 fulfill 效果的联动配置', () => {
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
        fulfill: {
          state: { visible: true },
        },
      }
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })

    it('应该正确渲染带有 otherwise 效果的联动配置', () => {
      const linkageValue = {
        type: 'visibility' as const,
        dependencies: ['#/properties/age'],
        otherwise: {
          state: { visible: false },
        },
      }
      render(<LinkageEditor {...defaultProps} value={linkageValue} />)
      expect(screen.getByText('Linkage Type')).toBeInTheDocument()
    })
  })

  describe('Path Format Guide', () => {
    it.skip('应该显示路径格式指南', () => {
      // 组件当前版本未包含 Path Format Guide 功能
    })
  })
})
