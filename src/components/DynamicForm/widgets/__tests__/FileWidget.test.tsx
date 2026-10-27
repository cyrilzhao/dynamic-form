import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FileWidget } from '../FileWidget'

describe('FileWidget', () => {
  it('选择文件时输出 File，清空时输出 null', () => {
    const onChange = jest.fn()
    const { container, rerender } = render(
      <FileWidget name="avatar" onChange={onChange} />,
    )
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [file] } })
    expect(onChange).toHaveBeenLastCalledWith(file)
    rerender(<FileWidget name="avatar" value={file} onChange={onChange} />)
    expect(screen.getByLabelText('Selected file')).toHaveTextContent(
      'avatar.png',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('超出 maxSize 时拒绝文件且显示英文错误', () => {
    const onChange = jest.fn()
    const { container } = render(
      <FileWidget name="avatar" maxSize={2} onChange={onChange} />,
    )
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['toolarge'], 'large.txt')] },
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('large.txt exceeds')
  })
})
