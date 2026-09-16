import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export type FormInputProps = InputHTMLAttributes<HTMLInputElement>;

export type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Theme-backed text input for Outfolio forms.
 * Labels remain the responsibility of the surrounding form.
 */
export function FormInput({ className, disabled = false, type = 'text', ...props }: FormInputProps) {
  return (
    <input
      {...props}
      aria-disabled={disabled}
      className={joinClassNames('form-input', className)}
      disabled={disabled}
      type={type}
    />
  );
}

/**
 * Theme-backed textarea for longer Outfolio form content.
 */
export function FormTextarea({ className, disabled = false, ...props }: FormTextareaProps) {
  return (
    <textarea
      {...props}
      aria-disabled={disabled}
      className={joinClassNames('form-input', 'form-input--textarea', className)}
      disabled={disabled}
    />
  );
}
