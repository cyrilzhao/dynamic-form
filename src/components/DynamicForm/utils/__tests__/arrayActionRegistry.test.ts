import {
  consumeArrayActionForSnapshot,
  recordArrayAction,
  registerArrayActionStore,
} from '../arrayActionRegistry'

describe('arrayActionRegistry', () => {
  it('连续 move 时应按元素身份匹配当前动作而不是旧动作', () => {
    const control = {}
    registerArrayActionStore(control, { current: [] })

    recordArrayAction(control, 'contacts', {
      action: 'move',
      fromIndex: 0,
      toIndex: 1,
      value: { name: 'a' },
    })
    recordArrayAction(control, 'contacts', {
      action: 'move',
      fromIndex: 1,
      toIndex: 0,
      value: { name: 'a' },
    })

    const action = consumeArrayActionForSnapshot(
      control,
      'contacts',
      [{ name: 'b' }, { name: 'a' }],
      [{ name: 'a' }, { name: 'b' }],
    )

    expect(action).toEqual({
      action: 'move',
      fromIndex: 1,
      toIndex: 0,
      value: { name: 'a' },
    })
  })
})
