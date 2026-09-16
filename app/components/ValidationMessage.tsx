export type ValidationMessageType = 'error' | 'warning';

export type ValidationMessageProps = {
  id?: string;
  message: string;
  type?: ValidationMessageType;
};

/**
 * Theme-backed validation feedback for forms.
 */
export function ValidationMessage({ id, message, type = 'error' }: ValidationMessageProps) {
  const role = type === 'error' ? 'alert' : 'status';

  return (
    <p
      className={`validation-message validation-message--${type}`}
      id={id}
      role={role}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      {message}
    </p>
  );
}
