import { useRef, useState } from 'react'
import { UploadIcon } from './icons'
import './upload-dropzone.css'

interface UploadDropzoneProps {
  onFile: (file: File) => void
  accept?: string
  hint?: string
}

export function UploadDropzone({
  onFile,
  accept = 'image/*',
  hint = 'PNG, JPG or screenshot',
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dropzone--dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        pick(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
    >
      <span className="dropzone__glow" aria-hidden="true" />
      <span className="dropzone__icon">
        <UploadIcon size={28} />
      </span>
      <span className="dropzone__title">Drop your proof here</span>
      <span className="dropzone__hint">or tap to browse · {hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="dropzone__input"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  )
}
