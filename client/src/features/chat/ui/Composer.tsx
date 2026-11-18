import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { looksLikeSecret } from '../model/secretDetection';
import { MAX_MESSAGE_LENGTH } from '../types';

export function Composer({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  /** A message is in flight: the field stays focusable but cannot send. */
  sending: boolean;
  /** Nothing can be sent yet, e.g. while a conversation loads. */
  disabled: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const ids = { input: useId(), hint: useId(), error: useId(), count: useId() };
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? ownRef;
  const warningRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [secretWarning, setSecretWarning] = useState(false);
  const blocked = sending || disabled;

  useEffect(() => {
    if (secretWarning) warningRef.current?.focus();
  }, [secretWarning]);

  function submit(force = false) {
    if (blocked) return;
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
    textareaRef.current?.focus();
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
  const describedBy = [
    ids.hint,
    remaining < 200 ? ids.count : null,
    error ? ids.error : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <form className="composer" onSubmit={onSubmit}>
      {secretWarning ? (
        <div
          className="alert alert--warning"
          role="alert"
          ref={warningRef}
          tabIndex={-1}
        >
          <p>
            This looks like a password or secret code. Remove it before sending.
          </p>
          <div className="row">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setSecretWarning(false);
                textareaRef.current?.focus();
              }}
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
        {/* Never disabled while sending: disabling the focused field would
            drop keyboard focus to the page body. */}
        <textarea
          id={ids.input}
          ref={textareaRef}
          rows={2}
          value={value}
          placeholder="Describe your IT issue..."
          onChange={(event) => {
            onChange(event.target.value);
            if (error) setError(null);
            if (secretWarning) setSecretWarning(false);
          }}
          onKeyDown={onKeyDown}
          aria-invalid={Boolean(error) || remaining < 0}
          aria-describedby={describedBy}
          disabled={disabled}
        />
        <button type="submit" className="button" aria-disabled={blocked}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error ? (
        <p className="field__error" id={ids.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className="muted small" id={ids.hint}>
        Don't share passwords or secret codes. Enter sends, Shift+Enter adds a
        new line.
      </p>
      {remaining < 200 ? (
        <p
          className={`small ${remaining < 0 ? 'field__error' : 'muted'}`}
          id={ids.count}
        >
          {remaining < 0
            ? `Too long: remove ${-remaining} characters.`
            : `${remaining} characters left.`}
        </p>
      ) : null}
    </form>
  );
}
