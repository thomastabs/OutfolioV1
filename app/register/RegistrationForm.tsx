'use client';

import { FormEvent, useState } from 'react';
import { ValidationMessage } from '../components/ValidationMessage';

type FormValues = {
  name: string;
  username: string;
  email: string;
  password: string;
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

type ApiErrorResponse = {
  message?: string;
  fields?: FieldErrors;
};

type RegistrationFormProps = {
  onRegistered?: () => void | Promise<void>;
};

const initialValues: FormValues = {
  name: '',
  username: '',
  email: '',
  password: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[A-Za-z0-9_-]+$/;
const minimumPasswordLength = 12;

function validate(values: FormValues) {
  const errors: FieldErrors = {};

  if (!values.name.trim()) errors.name = 'Name is required.';
  const username = values.username.trim();
  const password = values.password;

  if (!username) {
    errors.username = 'Username is required.';
  } else if (!usernamePattern.test(username)) {
    errors.username = 'Username may contain only letters, numbers, underscores, and hyphens.';
  }
  if (!values.email.trim() || !emailPattern.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  if (!password.trim()) {
    errors.password = 'Password is required.';
  } else if (password.length < minimumPasswordLength) {
    errors.password = 'Password must be at least 12 characters.';
  }

  return errors;
}

export function RegistrationForm({ onRegistered }: RegistrationFormProps) {
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
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      });
      const payload = (await response.json()) as ApiErrorResponse;

      if (!response.ok) {
        setFieldErrors(payload.fields ?? {});
        setFormError(payload.message ?? 'Could not create the account.');
        return;
      }

      await onRegistered?.();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="responsive-form auth-form" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          value={values.name}
          onChange={(event) => updateField('name', event.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
        />
        {fieldErrors.name ? <ValidationMessage id="name-error" message={fieldErrors.name} /> : null}
      </div>

      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          value={values.username}
          onChange={(event) => updateField('username', event.target.value)}
          aria-invalid={Boolean(fieldErrors.username)}
          aria-describedby={fieldErrors.username ? 'username-error' : undefined}
        />
        {fieldErrors.username ? <ValidationMessage id="username-error" message={fieldErrors.username} /> : null}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={(event) => updateField('email', event.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
        />
        {fieldErrors.email ? <ValidationMessage id="email-error" message={fieldErrors.email} /> : null}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={values.password}
          onChange={(event) => updateField('password', event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
        />
        {fieldErrors.password ? <ValidationMessage id="password-error" message={fieldErrors.password} /> : null}
      </div>

      {formError ? <ValidationMessage message={formError} /> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}
