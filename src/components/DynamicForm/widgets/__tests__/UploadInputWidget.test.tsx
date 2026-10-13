import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UploadInputWidget } from '../UploadInputWidget'
import { uploadInputWidgetDefinition } from '../UploadInputWidget.definition'

describe('UploadInputWidget', () => {
  it('声明 object valueSchema 和 propsSchema 以供 SchemaBuilder 使用', () => {
    expect(uploadInputWidgetDefinition.valueSchema?.type).toBe('object')
    expect(uploadInputWidgetDefinition.valueSchema?.required).toEqual([
      'fileId',
      'fileName',
    ])
    expect(uploadInputWidgetDefinition.propsSchema?.properties?.accept).toEqual(
      expect.objectContaining({ default: '' }),
    )
  })

  it('选择文件后调用 onUpload，并将上传结果作为结构化值输出', async () => {
    const onUpload = jest.fn().mockResolvedValue({
      fileId: 'file-1',
      fileName: 'avatar.png',
    })
    const onChange = jest.fn()
    const { container } = render(
      <UploadInputWidget
        name="avatar"
        onUpload={onUpload}
        onChange={onChange}
      />,
    )
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(file)
      expect(onChange).toHaveBeenCalledWith({
        fileId: 'file-1',
        fileName: 'avatar.png',
      })
    })
  })

  it('使用 value 回显已上传文件名', () => {
    render(
      <UploadInputWidget
        name="avatar"
        value={{ fileId: 'file-2', fileName: 'existing.pdf' }}
      />,
    )

    expect(screen.getByLabelText('Uploaded file')).toHaveTextContent(
      'existing.pdf',
    )
  })

  it('上传失败时显示英文错误且不触发 onChange', async () => {
    const onUpload = jest.fn().mockRejectedValue(new Error('Upload failed'))
    const onChange = jest.fn()
    const { container } = render(
      <UploadInputWidget
        name="avatar"
        onUpload={onUpload}
        onChange={onChange}
      />,
    )
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement

    fireEvent.change(input, {
      target: { files: [new File(['avatar'], 'avatar.png')] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed')
    expect(onChange).not.toHaveBeenCalled()
  })
})
