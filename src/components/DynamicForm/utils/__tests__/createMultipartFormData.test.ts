import {
  createMultipartFormData,
  type MultipartFileReference,
} from '../createMultipartFormData'

interface Payload {
  profile: {
    name: string
    avatar: MultipartFileReference
  }
  attachments: MultipartFileReference[]
  existing: {
    fieldId: string
    fileName: string
  }
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}

async function readPayload(formData: FormData): Promise<Payload> {
  const payload = formData.get('payload')

  if (!(payload instanceof Blob)) {
    throw new Error('Payload part must be a Blob')
  }

  return JSON.parse(await readBlobAsText(payload)) as Payload
}

describe('createMultipartFormData', () => {
  it('保留嵌套结构，并为每个文件生成与引用一致的独立 part', async () => {
    const avatar = new File(['avatar'], 'avatar.png', { type: 'image/png' })
    const firstAttachment = new File(['first'], 'first.pdf', {
      type: 'application/pdf',
    })
    const secondAttachment = new File(['second'], 'second.pdf', {
      type: 'application/pdf',
    })
    const values = {
      profile: { name: 'Ada', avatar },
      attachments: [firstAttachment, secondAttachment],
      existing: { fieldId: 'stored-1', fileName: 'stored.pdf' },
    }

    const formData = createMultipartFormData(values)
    const payload = await readPayload(formData)

    expect(payload).toEqual({
      profile: {
        name: 'Ada',
        avatar: { $file: 'files.profile.avatar', fileName: 'avatar.png' },
      },
      attachments: [
        { $file: 'files.attachments.0', fileName: 'first.pdf' },
        { $file: 'files.attachments.1', fileName: 'second.pdf' },
      ],
      existing: { fieldId: 'stored-1', fileName: 'stored.pdf' },
    })
    expect((formData.get('files.profile.avatar') as File).name).toBe(
      'avatar.png',
    )
    expect((formData.get('files.attachments.0') as File).name).toBe('first.pdf')
    expect((formData.get('files.attachments.1') as File).name).toBe(
      'second.pdf',
    )
    expect(values.profile.avatar).toBe(avatar)
    expect(values.attachments).toEqual([firstAttachment, secondAttachment])
  })

  it('支持 Blob、空值和自定义 part 名称', async () => {
    const document = new Blob(['document'], { type: 'text/plain' })
    const createdAt = new Date('2026-09-08T00:00:00.000Z')
    const formData = createMultipartFormData(
      { document, nullable: null, empty: [], omitted: undefined, createdAt },
      {
        jsonFieldName: 'data',
        fileFieldName: (path) => `upload/${path}`,
        jsonContentType: 'application/vnd.api+json',
      },
    )
    const payloadPart = formData.get('data')

    expect(payloadPart).toBeInstanceOf(Blob)
    expect((payloadPart as Blob).type).toBe('application/vnd.api+json')
    expect(JSON.parse(await readBlobAsText(payloadPart as Blob))).toEqual({
      document: { $file: 'upload/document', fileName: 'blob' },
      nullable: null,
      empty: [],
      createdAt: '2026-09-08T00:00:00.000Z',
    })
    expect(await readBlobAsText(formData.get('upload/document') as Blob)).toBe(
      'document',
    )
  })
})
