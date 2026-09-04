import React from 'react'
import { render, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BasicFormPanel } from '../BasicFormPanel'

describe('BasicFormPanel', () => {
  it('定时 setValues 应触发一次 onChange，而不是只在后续手动修改时触发', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})

    render(
      <React.StrictMode>
        <BasicFormPanel />
      </React.StrictMode>,
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3200))
    })

    await waitFor(() => {
      // 示例 onChange 的第一条 info 日志就是完整表单快照；验证它确实由 setValues 产生。
      expect(infoSpy).toHaveBeenCalledWith(
        'cyril data: ',
        expect.objectContaining({
          users: ['Alan Zhao', 'Leo Huang', 'Carmen Zhu'],
        }),
      )
      expect(infoSpy).toHaveBeenCalledWith(
        'cyril meta: ',
        expect.stringContaining('"rootSource": "setValues"'),
      )
    })

    infoSpy.mockRestore()
  })
})
