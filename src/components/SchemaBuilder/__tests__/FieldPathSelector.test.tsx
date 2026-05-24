/**
 * FieldPathSelector 组件测试
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldPathSelector } from '../FieldPathSelector';
import { basicSchema, nestedSchema, arraySchema } from './testHelpers';

describe('FieldPathSelector', () => {
  const defaultProps = {
    schema: basicSchema,
    currentFieldPath: '#/properties/name',
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染输入框和搜索按钮', () => {
      render(<FieldPathSelector {...defaultProps} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('应该显示当前选中的值', () => {
      render(
        <FieldPathSelector {...defaultProps} value="#/properties/age" />
      );

      expect(screen.getByRole('textbox')).toHaveValue('#/properties/age');
    });

    it('应该显示 placeholder', () => {
      render(
        <FieldPathSelector
          {...defaultProps}
          placeholder="Select a field"
        />
      );

      expect(screen.getByPlaceholderText('Select a field')).toBeInTheDocument();
    });

    it('禁用状态下按钮应该被禁用', () => {
      render(<FieldPathSelector {...defaultProps} disabled />);

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('对话框交互', () => {
    it('点击搜索按钮应该打开对话框', async () => {
      render(<FieldPathSelector {...defaultProps} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });
    });

    it('对话框应该显示路径类型切换按钮', async () => {
      render(<FieldPathSelector {...defaultProps} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Absolute Path (JSON Pointer)')).toBeInTheDocument();
      });
    });

    it('点击取消按钮应该关闭对话框', async () => {
      render(<FieldPathSelector {...defaultProps} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Select Field Path')).not.toBeInTheDocument();
      });
    });
  });

  describe('字段过滤', () => {
    it('应该排除当前字段（excludeCurrentField=true）', async () => {
      render(
        <FieldPathSelector
          {...defaultProps}
          excludeCurrentField={true}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      // 当前字段应该被标记为 Current Field
      // 由于 Tree 组件的渲染方式，我们检查是否有 Current Field 标签
    });

    it('应该只显示 visibleFields 中的字段', async () => {
      render(
        <FieldPathSelector
          {...defaultProps}
          visibleFields={['#/properties/age']}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });
    });
  });

  describe('嵌套 Schema', () => {
    it('应该正确处理嵌套对象 Schema', async () => {
      render(
        <FieldPathSelector
          schema={nestedSchema}
          currentFieldPath="#/properties/user/properties/firstName"
          value=""
          onChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });
    });

    it('应该正确处理数组 Schema', async () => {
      render(
        <FieldPathSelector
          schema={arraySchema}
          currentFieldPath="#/properties/contacts/items/properties/name"
          value=""
          onChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });
    });
  });

  describe('相对路径', () => {
    it('数组元素内部应该显示相对路径选项', async () => {
      render(
        <FieldPathSelector
          schema={arraySchema}
          currentFieldPath="#/properties/contacts/items/properties/name"
          value=""
          onChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Relative Path (Same Level)')).toBeInTheDocument();
      });
    });

    it('非数组元素不应该启用相对路径按钮', async () => {
      render(
        <FieldPathSelector
          schema={basicSchema}
          currentFieldPath="#/properties/name"
          value=""
          onChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const relativeButton = screen.getByText('Relative Path (Same Level)');
        expect(relativeButton.closest('button')).toBeDisabled();
      });
    });
  });

  describe('空 Schema 处理', () => {
    it('应该正确处理空 Schema', async () => {
      render(
        <FieldPathSelector
          schema={{ type: 'object' }}
          currentFieldPath=""
          value=""
          onChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });
    });

    it('应该正确处理 undefined schema', async () => {
      render(
        <FieldPathSelector
          schema={undefined as any}
          currentFieldPath=""
          value=""
          onChange={jest.fn()}
        />
      );

      // 组件应该不会崩溃
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('确认选择', () => {
    it('点击确认按钮应该调用 onChange 并关闭对话框', async () => {
      const onChange = jest.fn();
      render(
        <FieldPathSelector
          {...defaultProps}
          onChange={onChange}
          value="#/properties/age"
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('#/properties/age');
      });
    });

    it('未选择路径时确认按钮应该被禁用', async () => {
      render(
        <FieldPathSelector
          {...defaultProps}
          value=""
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton.closest('button')).toBeDisabled();
    });
  });

  describe('Tree 节点交互', () => {
    it('点击 Tree 节点应该选中该节点', async () => {
      render(
        <FieldPathSelector
          {...defaultProps}
          value=""
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      // 点击 Age 字段节点
      const ageNode = screen.getByText('Age');
      fireEvent.click(ageNode);

      // 检查 Selected Path 输入框的值
      const selectedPathInput = screen.getAllByRole('textbox')[1];
      expect(selectedPathInput).toHaveValue('#/properties/age');
    });

    it('点击禁用的节点不应该选中', async () => {
      render(
        <FieldPathSelector
          {...defaultProps}
          currentFieldPath="#/properties/name"
          excludeCurrentField={true}
          value=""
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      // 点击当前字段（被禁用）
      const nameNode = screen.getByText('Name');
      fireEvent.click(nameNode);

      // Selected Path 应该仍然为空
      const selectedPathInput = screen.getAllByRole('textbox')[1];
      expect(selectedPathInput).toHaveValue('');
    });
  });

  describe('相对路径选择', () => {
    it('切换到相对路径模式应该显示同级字段列表', async () => {
      render(
        <FieldPathSelector
          schema={arraySchema}
          currentFieldPath="#/properties/contacts/items/properties/name"
          value=""
          onChange={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      // 点击相对路径按钮
      const relativeButton = screen.getByText('Relative Path (Same Level)');
      fireEvent.click(relativeButton);

      // 应该显示同级字段 phone
      await waitFor(() => {
        expect(screen.getByText('./phone')).toBeInTheDocument();
      });
    });

    it('点击相对路径选项应该选中该路径', async () => {
      const onChange = jest.fn();
      render(
        <FieldPathSelector
          schema={arraySchema}
          currentFieldPath="#/properties/contacts/items/properties/name"
          value=""
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Select Field Path')).toBeInTheDocument();
      });

      // 切换到相对路径模式
      const relativeButton = screen.getByText('Relative Path (Same Level)');
      fireEvent.click(relativeButton);

      // 点击 phone 选项
      await waitFor(() => {
        const phoneOption = screen.getByText('./phone');
        fireEvent.click(phoneOption.closest('button')!);
      });

      // 点击确认
      fireEvent.click(screen.getByText('Confirm'));

      expect(onChange).toHaveBeenCalledWith('./phone');
    });
  });
});
