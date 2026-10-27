import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UploadListInputWidget } from '../UploadListInputWidget'
import { uploadListInputWidgetDefinition } from '../UploadListInputWidget.definition'

describe('UploadListInputWidget', () => {
  it('上传多个文件后输出 UploadValue 数组', async () => {
    const onUpload = jest
      .fn()
      .mockResolvedValueOnce({ fileId: 'file-1', fileName: 'one.txt' })
      .mockResolvedValueOnce({ fileId: 'file-2', fileName: 'two.txt' })
    const onChange = jest.fn()
    const { container } = render(
      <UploadListInputWidget
        name="uploads"
        value={[]}
        onUpload={onUpload}
        onChange={onChange}
      />,
    )
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const first = new File(['one'], 'one.txt')
    const second = new File(['two'], 'two.txt')

    fireEvent.change(input, { target: { files: [first, second] } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { fileId: 'file-1', fileName: 'one.txt' },
        { fileId: 'file-2', fileName: 'two.txt' },
      ])
    })
  })

  it('回显已上传文件列表', () => {
    render(
      <UploadListInputWidget
        name="uploads"
        value={[
          { fileId: 'file-1', fileName: 'one.txt' },
          { fileId: 'file-2', fileName: 'two.txt' },
        ]}
      />,
    )

    expect(screen.getByLabelText('Uploaded files')).toHaveTextContent('one.txt')
    expect(screen.getByLabelText('Uploaded files')).toHaveTextContent('two.txt')
  })

  it('声明 array valueSchema 及不可编辑的 items 对象结构', () => {
    expect(uploadListInputWidgetDefinition.valueSchema).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fileId: { type: 'string', title: 'File ID' },
          fileName: { type: 'string', title: 'File Name' },
        },
        required: ['fileId', 'fileName'],
      },
    })
  })
})
