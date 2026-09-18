'use client';

import { FormEvent, useState } from 'react';
import { ValidationMessage } from '../components/ValidationMessage';

type FormValues = {
  username: string;
  password: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

type ApiErrorResponse = {
  message?: string;
  fields?: FieldErrors;
};

type LoginFormProps = {
  onLoggedIn?: () => void | Promise<void>;
};

const initialValues: FormValues = {
  username: '',
  password: '',
};

function validate(values: FormValues) {
  const errors: FieldErrors = {};

  if (!values.username.trim()) errors.username = 'Username is required.';
  if (!values.password.trim()) errors.password = 'Password is required.';

  return errors;
}

export function LoginForm({ onLoggedIn }: LoginFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validate(values);
    setFieldErrors(errors);
    setFormError('');

    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.username.trim(),
          password: values.password,
        }),
      });
      const payload = (await response.json()) as ApiErrorResponse;

      if (!response.ok) {
        setFieldErrors(payload.fields ?? {});
        setFormError(payload.message ?? 'Could not log in.');
        return;
      }

      await onLoggedIn?.();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="responsive-form auth-form" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="login-username">Username</label>
        <input
          id="login-username"
          name="username"
          value={values.username}
          onChange={(event) => updateField('username', event.target.value)}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={fieldErrors.username ? 'login-username-error' : undefined}
        />
        {fieldErrors.username ? <ValidationMessage id="login-username-error" message={fieldErrors.username} /> : null}
      </div>

      <div>
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          name="password"
          type="password"
          value={values.password}
          onChange={(event) => updateField('password', event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
        />
        {fieldErrors.password ? <ValidationMessage id="login-password-error" message={fieldErrors.password} /> : null}
      </div>

      {formError ? <ValidationMessage message={formError} /> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  );
}
