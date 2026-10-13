import { fireEvent, render, screen } from '@testing-library/react'
import { WidgetOptionsEditor } from '../WidgetOptionsEditor'

describe('WidgetOptionsEditor', () => {
  it('JSON option allows editing incomplete JSON without reverting the draft', () => {
    const onChange = jest.fn()

    render(
      <WidgetOptionsEditor
        name="options"
        value={[{ value: {}, label: 'Object' }]}
        onChange={onChange}
      />,
    )

    const valueInput = screen.getByRole('textbox', {
      name: 'Option 1 value',
    })

    fireEvent.change(valueInput, { target: { value: '{' } })

    expect((valueInput as HTMLInputElement).value).toBe('{')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('JSON option commits a complete JSON value after editing', () => {
    const onChange = jest.fn()

    render(
      <WidgetOptionsEditor
        name="options"
        value={[{ value: {}, label: 'Object' }]}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Option 1 value' }), {
      target: { value: '{"key":"value"}' },
    })

    expect(onChange).toHaveBeenLastCalledWith([
      { value: { key: 'value' }, label: 'Object' },
    ])
  })
})
