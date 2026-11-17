import { useEffect, useRef, useState } from 'react'

/** One or more answer boxes (word, or V2 + V3) with phone keyboards set for English typing. */
export function TypedInputs({
  labels,
  onSubmit,
  disabled,
  submitLabel = 'Kiểm tra',
  resetKey,
}: {
  labels: string[]
  onSubmit: (values: string[]) => void
  disabled?: boolean
  submitLabel?: string
  resetKey: string | number
}) {
  const [values, setValues] = useState<string[]>(labels.map(() => ''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    setValues(labels.map(() => ''))
    setTimeout(() => refs.current[0]?.focus(), 30)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const submit = () => {
    if (disabled || values.every((v) => !v.trim())) return
    onSubmit(values)
  }

  return (
    <form
      className="typed"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {labels.map((label, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={values[i] ?? ''}
          placeholder={label}
          disabled={disabled}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint={i < labels.length - 1 ? 'next' : 'done'}
          onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && i < labels.length - 1) {
              e.preventDefault()
              refs.current[i + 1]?.focus()
            }
          }}
        />
      ))}
      <button type="submit" className="primary" disabled={disabled}>
        {submitLabel}
      </button>
    </form>
  )
}
