import { useEffect, useRef, useState } from 'react'
import { Field, Segmented, Sheet } from './ui'
import { IconPlus } from './icons'
import { PRIORITY_TAGS } from '../lib/config'
import { todayISO } from '../lib/date'
import { uid } from '../lib/format'
import { actions, newTask, useStore } from '../lib/store'
import type { MoneyEntity, Priority } from '../lib/types'

type Kind = 'task' | 'priority' | 'goal' | 'deal'

const KINDS: { id: Kind; label: string; placeholder: string; hint: string }[] = [
  { id: 'task', label: 'Task', placeholder: 'What needs doing', hint: 'Lands in Work, undated' },
  {
    id: 'priority',
    label: 'Today',
    placeholder: 'What needs doing today',
    hint: "Lands on today's to-do, and in Work",
  },
  { id: 'goal', label: 'Goal', placeholder: "What you're aiming at", hint: 'Lands on the ladder' },
  { id: 'deal', label: 'Deal', placeholder: 'Who and what', hint: 'Lands in the pipeline as a lead' },
]

/**
 * One button, everywhere. Capture only worked from Home, which meant the thing
 * you thought of on the Money screen had to survive the trip — and it usually
 * didn't. Five destinations cover what actually turns up mid-day; anything
 * rarer is worth the extra taps on its own screen.
 */
export default function QuickAdd({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Quick add">
        <IconPlus />
      </button>
      {open && <QuickAddSheet onNavigate={onNavigate} onClose={() => setOpen(false)} />}
    </>
  )
}

function QuickAddSheet({
  onNavigate,
  onClose,
}: {
  onNavigate: (tab: string) => void
  onClose: () => void
}) {
  const state = useStore()
  const [kind, setKind] = useState<Kind>('task')
  const [text, setText] = useState('')
  const [tag, setTag] = useState<Priority['tag']>('consulting')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const spec = KINDS.find((k) => k.id === kind)!
  const today = todayISO()

  const save = () => {
    const value = text.trim()
    if (!value) return

    if (kind === 'task') {
      actions.addTask(newTask(value, { entity: tag }))
      onNavigate('work')
    } else if (kind === 'priority') {
      actions.addTask(newTask(value, { entity: tag, scheduled: today }))
      onNavigate('today')
    } else if (kind === 'goal') {
      actions.setGoals([
        ...state.goals,
        {
          id: uid(),
          parentId: '',
          domainId: '',
          title: value,
          note: '',
          due: '',
          done: false,
          image: '',
          keyResults: [],
        },
      ])
      onNavigate('goals')
    } else if (kind === 'deal') {
      actions.setDeals([
        ...state.deals,
        {
          id: uid(),
          entity: (tag === 'life' ? 'consulting' : tag) as MoneyEntity,
          name: value,
          clientId: '',
          stage: 'lead',
          value: 0,
          probability: 10,
          expectedClose: '',
          nextStep: '',
          moved: today,
          notes: '',
        },
      ])
      onNavigate('work')
    }
    onClose()
  }

  return (
    <Sheet title="Quick add" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Add a">
          <div className="chips">
            {KINDS.map((k) => (
              <button
                key={k.id}
                className="chip"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={spec.label}>
          <input
            ref={inputRef}
            className="input"
            value={text}
            placeholder={spec.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </Field>

        {kind !== 'goal' && (
          <Field label="Belongs to">
            <Segmented
              value={tag === 'life' && kind === 'deal' ? 'consulting' : tag}
              onChange={setTag}
              options={PRIORITY_TAGS.filter((t) => !(kind === 'deal' && t.id === 'life')).map(
                (t) => ({ value: t.id, label: t.label }),
              )}
            />
          </Field>
        )}

        <p className="t-foot muted">
          {spec.hint}
        </p>

        <button
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={!text.trim()}
        >
          Add
        </button>
      </div>
    </Sheet>
  )
}
