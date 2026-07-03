import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { DynamicForm } from '../DynamicForm'
import { FieldRegistry, blueprintPreset } from '..'
import type { DynamicFormProps, DynamicFormRef } from '../types'

export function setupDynamicFormTest() {
  FieldRegistry.setDefaultPreset(blueprintPreset)
}

export function renderDynamicForm({
  props,
}: {
  props: Omit<DynamicFormProps, 'onSubmit'> & {
    onSubmit?: DynamicFormProps['onSubmit']
  }
}) {
  const formRef = React.createRef<DynamicFormRef>()
  const result = render(
    <DynamicForm ref={formRef} onSubmit={jest.fn()} {...props} />
  )

  return { formRef, ...result }
}

export async function waitForFormReady({
  formRef,
}: {
  formRef: React.RefObject<DynamicFormRef>
}) {
  await waitFor(() => {
    expect(formRef.current).toBeTruthy()
  })
}

export async function refreshLinkage({
  formRef,
}: {
  formRef: React.RefObject<DynamicFormRef>
}) {
  await act(async () => {
    await formRef.current!.refreshLinkage()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

export async function setFieldValue({
  formRef,
  name,
  value,
}: {
  formRef: React.RefObject<DynamicFormRef>
  name: string
  value: unknown
}) {
  await act(async () => {
    formRef.current!.setValue(name, value)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

export function getInputByName({
  container,
  name,
}: {
  container: HTMLElement
  name: string
}) {
  return container.querySelector(`[name="${name}"]`) as HTMLInputElement | null
}
