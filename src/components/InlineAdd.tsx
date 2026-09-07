import { useEffect, useRef, useState } from 'react'
import { IconPlus } from './icons'

/**
 * A button that becomes a field where it stands.
 *
 * This replaces three `window.prompt` calls. A prompt works, but it steals the
 * window, looks like nothing else in the app, and on iOS it can't be styled or
 * dismissed by tapping away — which is exactly the seam that makes a web app
 * feel like a web app.
 */
export default function InlineAdd({
  label,
  placeholder,
  onAdd,
  className = '',
}: {
  label: string
  placeholder?: string
  onAdd: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  const commit = () => {
    const v = value.trim()
    if (v) onAdd(v)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className={`inline-add ${className}`} onClick={() => setOpen(true)}>
        <IconPlus style={{ width: 13, height: 13 }} />
        {label}
      </button>
    )
  }

  return (
    <div className={`inline-add-open ${className}`}>
      <input
        ref={ref}
        className="input"
        value={value}
        placeholder={placeholder ?? label}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setValue('')
            setOpen(false)
          }
        }}
        // Committing on blur means tapping away saves rather than discards,
        // which is what every note field on a phone does.
        onBlur={commit}
      />
    </div>
  )
}
