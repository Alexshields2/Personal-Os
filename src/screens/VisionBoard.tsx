import { useRef, useState } from 'react'
import { Field, Sheet, TextField } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import { VISION_IMAGE_MAX_PX, VISION_IMAGE_QUALITY } from '../lib/config'
import { actions, useStore } from '../lib/store'
import type { VisionColumn } from '../lib/types'

/**
 * The year on one wall: a column per part of the life, each with the target
 * stated in one line, the plan underneath it, and the pictures that make it
 * concrete. A vision board that is only words is a list, and a list is the one
 * thing this is not for.
 *
 * Pictures are downscaled hard before they are stored. The whole document lives
 * in localStorage and syncs as one JSON blob, so a single full-resolution photo
 * would cost more than everything else in the app put together.
 */
export default function VisionBoard() {
  const state = useStore()
  const { vision } = state
  const [editing, setEditing] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(false)

  const filled = vision.columns.filter((c) => c.headline || c.body || c.images.length).length

  return (
    <div className="screen wrap wrap-wide">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            {filled} of {vision.columns.length} filled in
          </span>
        </div>
        <div className="vision-title">
          <input
            className="input input-plain vision-title-input"
            value={vision.title}
            onChange={(e) => actions.setVision({ title: e.target.value })}
            aria-label="Board title"
          />
          <input
            className="input input-plain vision-year"
            inputMode="numeric"
            value={vision.year}
            onChange={(e) =>
              actions.setVision({ year: Number(e.target.value.replace(/\D/g, '')) || vision.year })
            }
            aria-label="Year"
          />
        </div>
        <p className="t-sub">
          One column per part of the life. State the target in a line, write the plan under it,
          and pin the pictures that make it real.
        </p>
      </header>

      <button className="vision-intro" onClick={() => setShowIntro(true)}>
        <span className="t-cap">The year, in prose</span>
        <span className={vision.intro ? 't-body' : 't-body muted'}>
          {vision.intro || 'Nothing written yet. What has to be true by December?'}
        </span>
      </button>

      <div className="vision">
        {vision.columns.map((col) => (
          <ColumnCard key={col.id} column={col} onEdit={() => setEditing(col.id)} />
        ))}

        <button
          className="vision-add"
          onClick={() => {
            const title = prompt('Name the column')?.trim()
            if (title) actions.addVisionColumn(title)
          }}
        >
          <IconPlus style={{ width: 18, height: 18 }} />
          Add a column
        </button>
      </div>

      {editing && <ColumnSheet id={editing} onClose={() => setEditing(null)} />}
      {showIntro && (
        <Sheet title="The year, in prose" onClose={() => setShowIntro(false)}>
          <TextField
            label="What has to be true by December"
            value={vision.intro}
            onChange={(intro) => actions.setVision({ intro })}
            placeholder="Write it as though it already happened."
            multiline
          />
        </Sheet>
      )}
    </div>
  )
}

function ColumnCard({ column, onEdit }: { column: VisionColumn; onEdit: () => void }) {
  return (
    <div className="vision-col">
      <button className="vision-col-head" onClick={onEdit}>
        <span className="vision-col-title">{column.title}</span>
        {column.headline ? (
          <span className="vision-headline">{column.headline}</span>
        ) : (
          <span className="vision-headline vision-headline-empty">Set the target</span>
        )}
      </button>

      {column.images.length > 0 && (
        <div className="vision-images">
          {column.images.map((img) => (
            <figure key={img.id} className="vision-img">
              <img src={img.src} alt={img.caption || column.title} loading="lazy" />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {column.body && <p className="vision-body">{column.body}</p>}

      <button className="vision-col-edit" onClick={onEdit}>
        Edit
      </button>
    </div>
  )
}

function ColumnSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const column = state.vision.columns.find((c) => c.id === id)
  const fileRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!column) return null

  const addFile = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const src = await downscale(file)
      actions.addVisionImage(id, src)
    } catch {
      setError("Couldn't read that image.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={column.title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField
          label="Column"
          value={column.title}
          onChange={(title) => actions.updateVisionColumn(id, { title })}
        />
        <TextField
          label="The target, in one line"
          value={column.headline}
          onChange={(headline) => actions.updateVisionColumn(id, { headline })}
          placeholder="Specific enough that you'd know if you hit it"
        />
        <TextField
          label="The plan"
          value={column.body}
          onChange={(body) => actions.updateVisionColumn(id, { body })}
          placeholder="How it actually happens"
          multiline
        />

        <Field label={`Pictures · ${column.images.length}`}>
          <div className="vision-edit-images">
            {column.images.map((img) => (
              <div key={img.id} className="vision-edit-img">
                <img src={img.src} alt={img.caption} />
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.removeVisionImage(id, img.id)}
                  aria-label="Remove picture"
                >
                  <IconTrash style={{ width: 15, height: 15 }} />
                </button>
              </div>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Adding…' : 'Upload a picture'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void addFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="…or paste an image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && url.trim()) {
                actions.addVisionImage(id, url.trim())
                setUrl('')
              }
            }}
          />
          <button
            className="btn"
            disabled={!url.trim()}
            onClick={() => {
              actions.addVisionImage(id, url.trim())
              setUrl('')
            }}
            aria-label="Add from URL"
          >
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {error && (
          <p className="t-foot" style={{ color: 'var(--warning)' }}>
            {error}
          </p>
        )}

        <p className="t-foot muted">
          Uploads are shrunk to {VISION_IMAGE_MAX_PX}px before they're saved — the whole app is
          one JSON document on your device, and a full-size photo would cost more than
          everything else in it. A pasted URL stores only the link, and needs the network to
          show.
        </p>

        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            if (confirm(`Delete the ${column.title} column and its pictures?`)) {
              actions.removeVisionColumn(id)
              onClose()
            }
          }}
        >
          Delete column
        </button>
      </div>
    </Sheet>
  )
}

/**
 * Shrink to a sane size before storing. Returns a JPEG data URI — the alpha
 * channel is not worth the size for a photo, and JPEG is a third of the bytes.
 */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode failed'))
      img.onload = () => {
        const scale = Math.min(1, VISION_IMAGE_MAX_PX / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('no canvas'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', VISION_IMAGE_QUALITY))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
