const PREFIX = '[SlipUpClipz:clip]'

export function logClipPipeline(
  stage: string,
  data: Record<string, unknown> = {},
): void {
  console.log(`${PREFIX} ${stage}`, data)
}

export function summarizeException(error: unknown): Record<string, unknown> {
  if (error instanceof DOMException) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  return { message: String(error) }
}

export function logClipPipelineError(
  stage: string,
  error: unknown,
  data: Record<string, unknown> = {},
): void {
  console.error(`${PREFIX} ${stage}`, {
    ...data,
    exception: summarizeException(error),
  })
}

export function summarizeBlob(blob: Blob | null | undefined) {
  if (!blob) {
    return { present: false, size: 0, type: '' }
  }

  return {
    present: true,
    size: blob.size,
    type: blob.type || '(empty type)',
  }
}
