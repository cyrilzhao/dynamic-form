import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { SelectWidget } from '../SelectWidget';

// 模拟真实的表单场景
const TestForm: React.FC = () => {
  const methods = useForm({
    defaultValues: {
      testSelect: undefined,
    },
  });

  const [submittedData, setSubmittedData] = React.useState<any>(null);

  const onSubmit = (data: any) => {
    setSubmittedData(data);
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <Controller
          name="testSelect"
          control={methods.control}
          render={({ field }) => (
            <SelectWidget
              {...field}
              options={[
                { label: 'Option A', value: 'a' },
                { label: 'Option B', value: 'b' },
                { label: 'Option C', value: 'c' },
              ]}
              placeholder="Please select"
            />
          )}
        />
        <button type="submit">Submit</button>
        {submittedData && (
          <div data-testid="submitted-data">{JSON.stringify(submittedData)}</div>
        )}
      </form>
    </FormProvider>
  );
};

describe('SelectWidget - react-hook-form 集成测试', () => {
  it('应该能正确存储和回显选中的值', async () => {
    render(<TestForm />);

    // 1. 初始状态应该显示 placeholder
    expect(screen.getByText('Please select')).toBeInTheDocument();

    // 2. 点击打开下拉菜单
    const trigger = screen.getByText('Please select').closest('.select-trigger');
    fireEvent.click(trigger!);

    // 3. 选择一个选项
    const optionB = screen.getByText('Option B');
    fireEvent.click(optionB);

    // 4. 验证值被回显
    await waitFor(() => {
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });

    // 5. 提交表单
    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    // 6. 验证提交的数据
    await waitFor(() => {
      const submittedData = screen.getByTestId('submitted-data');
      expect(submittedData).toHaveTextContent('{"testSelect":"b"}');
    });
  });
});