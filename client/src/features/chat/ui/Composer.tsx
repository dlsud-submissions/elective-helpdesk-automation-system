import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { looksLikeSecret } from '../model/secretDetection';
import { MAX_MESSAGE_LENGTH } from '../types';

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  disabled: boolean;
}) {
  const ids = { input: useId(), hint: useId(), error: useId() };
  const [error, setError] = useState<string | null>(null);
  const [secretWarning, setSecretWarning] = useState(false);

  function submit(force = false) {
    if (disabled) return;
    const content = value.trim();
    if (!content) {
      setError('Type a question first.');
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      setError('Keep messages under 2,000 characters.');
      return;
    }
    if (!force && looksLikeSecret(content)) {
      setSecretWarning(true);
      return;
    }
    setError(null);
    setSecretWarning(false);
    onSend(content);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - value.length;

  return (
    <form className="composer" onSubmit={onSubmit}>
      {secretWarning ? (
        <div className="alert alert--warning" role="alert">
          <p>
            This looks like a password or secret code. Remove it before sending.
          </p>
          <div className="row">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setSecretWarning(false)}
            >
              Edit message
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => submit(true)}
            >
              Send anyway
            </button>
          </div>
        </div>
      ) : null}
      <label htmlFor={ids.input} className="visually-hidden">
        Describe your IT issue
      </label>
      <div className="composer__row">
        <textarea
          id={ids.input}
          rows={2}
          value={value}
          placeholder="Describe your IT issue..."
          onChange={(event) => {
            onChange(event.target.value);
            if (error) setError(null);
            if (secretWarning) setSecretWarning(false);
          }}
          onKeyDown={onKeyDown}
          aria-invalid={Boolean(error)}
          aria-describedby={`${ids.hint}${error ? ` ${ids.error}` : ''}`}
          disabled={disabled}
        />
        <button type="submit" className="button" disabled={disabled}>
          {disabled ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error ? (
        <p className="field__error" id={ids.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className="muted small" id={ids.hint}>
        Don't share passwords or secret codes. Enter sends, Shift+Enter adds a
        new line.{' '}
        <span className={remaining < 0 ? 'field__error' : undefined}>
          {remaining < 200 ? `${remaining} characters left.` : ''}
        </span>
      </p>
    </form>
  );
}
