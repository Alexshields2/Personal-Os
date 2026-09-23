import { Card, Check, Empty, SectionTitle } from './ui'
import { ACCOUNT_LABEL, CLOTHES_CHECK, PURSE_LABEL, READ_CHECK } from '../lib/config'
import { addDays, formatShort, hoursMinutes, sleepMinutes } from '../lib/date'
import { euro, num } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { todoFor } from '../lib/selectors'
import type { DayEntry, GymSet } from '../lib/types'

/**
 * What was actually done, on whatever day you are looking at.
 *
 * Ticking something off takes it out of the list it was in — a list of things
 * to do that is mostly things already done stops being a list of things to
 * do. It lands here instead, with the numbers that came with it: the weights,
 * the food, the money. Walk the date back and this is the record of that day,
 * exactly as it was left.
 *
 * Anything ticked can be un-ticked from here, because the other place it
 * could be corrected no longer shows it.
 */
export default function DoneDay({ date, day }: { date: string; day: DayEntry }) {
  const state = useStore()

  const habits = state.morningRitual.filter((h) => day.checks[h.id])
  const tasks = todoFor(state, date).filter((t) => t.done)
  const gym = state.workout
    .map((ex) => ({ name: ex.name, sets: day.gym[ex.id] ?? [] }))
    .filter((ex) => ex.sets.some(logged))
  const home = day.homeGym.filter((ex) => ex.sets.some(logged))
  const spent = state.ledger.filter((e) => e.date === date && e.kind === 'expense')
  const slept = sleepMinutes(day.bedtime, day.wakeTime)
  const tomorrow = state.tasks.filter((t) => t.scheduled === addDays(date, 1)).length
  const quarters = Object.values(day.timeLog ?? {}).filter((slot) => slot.text.trim() !== '').length

  const nothing =
    habits.length === 0 &&
    tasks.length === 0 &&
    gym.length === 0 &&
    home.length === 0 &&
    spent.length === 0 &&
    slept === null &&
    day.food.length === 0 &&
    !day.gymMissed &&
    day.metrics.waterL === 0 &&
    day.metrics.consultingHours === 0 &&
    !day.checks[READ_CHECK] &&
    !day.checks[CLOTHES_CHECK] &&
    quarters === 0 &&
    day.journal.trim() === '' &&
    day.endJournal.trim() === ''

  if (nothing) {
    return (
      <Card>
        <Empty>Nothing ticked off on this day yet.</Empty>
      </Card>
    )
  }

  return (
    <>
      {habits.length > 0 && (
        <>
          <SectionTitle title={`Habits · ${habits.length}`} />
          <Card>
            <div className="rows">
              {habits.map((habit) => (
                <button
                  className="row"
                  key={habit.id}
                  role="checkbox"
                  aria-checked
                  onClick={() => actions.markHabit(date, habit.id, null)}
                >
                  <Check on />
                  <span className="row-main">
                    <span className="row-title" style={{ opacity: 0.6 }}>
                      {habit.label}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {tasks.length > 0 && (
        <>
          <SectionTitle title={`To-do · ${tasks.length}`} />
          <Card>
            <div className="rows">
              {tasks.map((task) => (
                <button
                  className="row"
                  key={task.id}
                  role="checkbox"
                  aria-checked
                  onClick={() => actions.toggleTask(task.id)}
                >
                  <Check on />
                  <span className="row-main">
                    <span className="row-title" style={{ opacity: 0.6 }}>
                      {task.title}
                    </span>
                    {task.estimateMin > 0 && (
                      <span className="row-sub">Estimated {task.estimateMin}m</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {(gym.length > 0 || home.length > 0 || day.gymMissed) && (
        <>
          <SectionTitle title={day.gymMissed ? 'Gym · missed' : home.length > 0 ? 'Home workout' : 'Gym'} />
          <Card>
            {day.gymMissed && gym.length === 0 && home.length === 0 ? (
              <div className="row">
                <span className="row-main">
                  <span className="row-title">Missed — noted</span>
                  {day.gymMissedWhy.trim() !== '' && (
                    <span className="row-sub">{day.gymMissedWhy}</span>
                  )}
                </span>
              </div>
            ) : (
              <div className="rows">
                {[...gym, ...home].map((exercise) => (
                  <div className="row" key={exercise.name}>
                    <span className="row-main">
                      <span className="row-title">{exercise.name}</span>
                      <span className="row-sub">{setsLine(exercise.sets)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {(slept !== null || day.food.length > 0 || day.metrics.waterL > 0) && (
        <>
          <SectionTitle title="Body" />
          <Card>
            <div className="rows">
              {slept !== null && (
                <div className="row">
                  <span className="row-main">
                    <span className="row-title">Slept {hoursMinutes(slept)}</span>
                    <span className="row-sub">
                      Asleep {day.bedtime} · woke {day.wakeTime}
                    </span>
                  </span>
                </div>
              )}
              {day.food.map((food) => (
                <div className="row" key={food.id}>
                  <span className="row-main">
                    <span className="row-title">{food.what || 'Food'}</span>
                    <span className="row-sub">
                      {num(food.kcal)} kcal · {num(food.protein)} g protein
                    </span>
                  </span>
                </div>
              ))}
              {(day.food.length > 0 || day.metrics.waterL > 0) && (
                <div className="row">
                  <span className="row-main">
                    <span className="row-title">
                      {num(day.metrics.calories)} kcal · {num(day.metrics.protein)} g protein
                    </span>
                    <span className="row-sub">{num(day.metrics.waterL, 2)} L of water</span>
                  </span>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {spent.length > 0 && (
        <>
          <SectionTitle
            title="Money spent"
            action={
              <span className="t-foot muted">
                {euro(
                  spent.reduce((sum, e) => sum + e.amount, 0),
                  2,
                )}
              </span>
            }
          />
          <Card>
            <div className="rows">
              {spent.map((entry) => (
                <div className="row" key={entry.id}>
                  <span className="row-main">
                    <span className="row-title">{entry.note || 'Spent'}</span>
                    <span className="row-sub">
                      {PURSE_LABEL[entry.entity]}
                      {entry.account ? ` · ${ACCOUNT_LABEL[entry.account]}` : ''}
                    </span>
                  </span>
                  <span className="row-value">{euro(entry.amount, 2)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <SectionTitle title="The rest of it" />
      <Card>
        <div className="rows">
          <DoneRow
            on={Boolean(day.checks[READ_CHECK])}
            label="Read the top of the day"
            onToggle={() => actions.toggleCheck(date, READ_CHECK)}
          />
          <DoneRow
            on={Boolean(day.checks[CLOTHES_CHECK])}
            label="Clothes laid out"
            onToggle={() => actions.toggleCheck(date, CLOTHES_CHECK)}
          />
          <DoneRow
            on={tomorrow > 0}
            label={`Tomorrow's to-do${tomorrow > 0 ? ` · ${tomorrow} set` : ''}`}
          />
          {day.metrics.consultingHours > 0 && (
            <DoneRow on label={`${num(day.metrics.consultingHours, 1)} hours in the office`} />
          )}
          {quarters > 0 && (
            <DoneRow on label={`${quarters} quarter-hour${quarters === 1 ? '' : 's'} logged`} />
          )}
        </div>
      </Card>

      {(day.journal.trim() !== '' || day.endJournal.trim() !== '') && (
        <>
          <SectionTitle title="In your own words" />
          <Card className="card-pad">
            {day.journal.trim() !== '' && <p className="identity-text">{day.journal}</p>}
            {day.endJournal.trim() !== '' && (
              <>
                {day.journal.trim() !== '' && (
                  <div className="t-cap" style={{ margin: '14px 0 6px' }}>
                    End of day
                  </div>
                )}
                <p className="identity-text">{day.endJournal}</p>
              </>
            )}
          </Card>
        </>
      )}

      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        {formatShort(date)} as it was left. Tap a tick to put something back on the list.
      </p>
    </>
  )
}

function DoneRow({ on, label, onToggle }: { on: boolean; label: string; onToggle?: () => void }) {
  const content = (
    <>
      <Check on={on} locked={!onToggle} />
      <span className="row-main">
        <span className="row-title" style={{ opacity: on ? 0.6 : 1 }}>
          {label}
        </span>
      </span>
    </>
  )
  if (!onToggle) {
    return (
      <div className="row" role="checkbox" aria-checked={on} aria-label={label}>
        {content}
      </div>
    )
  }
  return (
    <button className="row" role="checkbox" aria-checked={on} onClick={onToggle}>
      {content}
    </button>
  )
}

function logged(set: GymSet): boolean {
  return set.kg !== null || set.reps !== null
}

/** "62.5×8, 62.5×8, 60×7" — the set, the way it would be said out loud. */
function setsLine(sets: GymSet[]): string {
  return sets
    .filter(logged)
    .map((set) => {
      if (set.kg !== null && set.reps !== null) return `${num(set.kg, 2)}×${num(set.reps)}`
      if (set.reps !== null) return `${num(set.reps)} reps`
      return `${num(set.kg ?? 0, 2)} kg`
    })
    .join(', ')
}
