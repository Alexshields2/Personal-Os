import { useState } from 'react'
import { Card, SectionTitle } from './ui'
import { askAlex, askableQuestions } from '../lib/askAlex'
import { todayISO } from '../lib/date'
import { useStore } from '../lib/store'

/**
 * Ask Alex. Honest about what it is: a fixed set of questions matched by
 * keyword against selectors that already exist, not a language model. It can
 * only answer what's in the list, and says so rather than guessing when
 * nothing matches — the same rule the rest of Alex holds itself to.
 */
export default function AskAlex({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const state = useStore()
  const [text, setText] = useState('')
  const [history, setHistory] = useState<{ q: string; a: string; tab?: string }[]>([])
  const suggestions = askableQuestions()

  const ask = (question: string) => {
    if (!question.trim()) return
    const result = askAlex(state, question, todayISO())
    setHistory((h) => [{ q: question.trim(), a: result.text, tab: result.tab }, ...h])
    setText('')
  }

  return (
    <>
      <SectionTitle title="Ask Alex" />
      <Card className="card-pad">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            value={text}
            placeholder="Ask something — try one below"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(text)}
          />
          <button className="btn btn-primary" onClick={() => ask(text)} disabled={!text.trim()}>
            Ask
          </button>
        </div>

        <div className="chips" style={{ marginTop: 10 }}>
          {suggestions.slice(0, 6).map((s) => (
            <button key={s} className="chip chip-sm" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {history.map((h, i) => (
              <div key={i} className="insight" style={{ padding: 0 }}>
                <div className="insight-title">{h.q}</div>
                <div className="insight-body" style={{ whiteSpace: 'pre-line' }}>
                  {h.a}
                </div>
                {h.tab && (
                  <button
                    className="btn btn-quiet btn-sm"
                    style={{ padding: '2px 0' }}
                    onClick={() => onNavigate?.(h.tab!)}
                  >
                    Open it →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="t-foot muted" style={{ marginTop: 12 }}>
          This matches keywords against your own data, not a language model — it can only
          answer what it was built to answer. Open-ended conversation needs a real model wired
          in, which takes an API key from you.
        </p>
      </Card>
    </>
  )
}
