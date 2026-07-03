'use client'

import { useRef, useState, useTransition } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uploadInspiracaoImage } from '@/lib/inspiracoes/upload-actions'

interface Props {
  value: string
  onChange: (url: string) => void
  label?: string
  className?: string
}

export function ImageUploader({ value, onChange, label, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const file = files[0]

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG, WEBP ou GIF.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Imagem muito grande (máx. 10 MB).')
      return
    }

    setError('')
    const fd = new FormData()
    fd.append('file', file)

    startTransition(async () => {
      const result = await uploadInspiracaoImage(fd)
      if ('error' in result) {
        setError(result.error)
      } else {
        onChange(result.url)
      }
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="block text-xs font-medium text-foreground">{label}</p>}

      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt=""
            className="w-full max-h-56 object-cover rounded-xl border border-border/40"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-xl transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 bg-white text-foreground text-xs font-medium px-3 py-2 rounded-lg shadow hover:bg-muted transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Trocar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium px-3 py-2 rounded-lg shadow hover:bg-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !isPending && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors',
            dragging
              ? 'border-[#6699F3] bg-[#6699F3]/5'
              : 'border-border/60 hover:border-[#6699F3]/50 hover:bg-muted/30',
            isPending && 'pointer-events-none'
          )}
        >
          {isPending ? (
            <Loader2 className="w-7 h-7 text-[#6699F3] animate-spin" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-[#6699F3]" />
            </div>
          )}
          <div className="text-center">
            <p className="text-xs font-medium text-foreground">
              {isPending ? 'Enviando...' : 'Clique ou arraste uma imagem'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">JPG, PNG, WEBP ou GIF · máx. 10 MB</p>
          </div>
        </div>
      )}

      {isPending && value && (
        <p className="text-xs text-[#6699F3] flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Enviando imagem...
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}
