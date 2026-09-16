import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { ProfileEditor, type ProfileData } from './ProfileEditor';

const profile: ProfileData = {
  userId: 'user-1',
  name: 'Ada Lovelace',
  bio: 'Builds rigorous developer tools.',
  experienceYears: 7,
  certifications: ['OutSystems Associate Reactive Developer'],
  links: ['https://example.com/ada'],
  visibility: 'public',
};

describe('ProfileEditor', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('renders editable fields populated with current profile data', () => {
    render(<ProfileEditor profile={profile} onProfileSaved={jest.fn()} />);

    expect(screen.getByLabelText(/^name$/i)).toHaveValue('Ada Lovelace');
    expect(screen.getByLabelText(/^bio$/i)).toHaveValue('Builds rigorous developer tools.');
    expect(screen.getByLabelText(/years of experience/i)).toHaveValue(7);
    expect(screen.getByLabelText(/certifications/i)).toHaveValue('OutSystems Associate Reactive Developer');
    expect(screen.getByLabelText(/public links/i)).toHaveValue('https://example.com/ada');
    expect(screen.getByLabelText(/visibility/i)).toHaveValue('public');
    expect(screen.getByRole('option', { name: 'Public' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Private' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Unlisted' })).toBeInTheDocument();
  });

  it('submits valid profile updates and reports the saved profile', async () => {
    const user = userEvent.setup();
    const onProfileSaved = jest.fn();
    const savedProfile = {
      ...profile,
      name: 'Ada Byron',
      bio: 'Documents platform engineering work.',
      experienceYears: 8,
      certifications: ['OutSystems Professional Developer'],
      links: ['https://example.com/ada-updated'],
      visibility: 'unlisted',
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => savedProfile,
    } as Response);

    render(<ProfileEditor profile={profile} onProfileSaved={onProfileSaved} />);

    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), 'Ada Byron');
    await user.clear(screen.getByLabelText(/^bio$/i));
    await user.type(screen.getByLabelText(/^bio$/i), 'Documents platform engineering work.');
    await user.clear(screen.getByLabelText(/years of experience/i));
    await user.type(screen.getByLabelText(/years of experience/i), '8');
    await user.clear(screen.getByLabelText(/certifications/i));
    await user.type(screen.getByLabelText(/certifications/i), 'OutSystems Professional Developer');
    await user.clear(screen.getByLabelText(/public links/i));
    await user.type(screen.getByLabelText(/public links/i), 'https://example.com/ada-updated');
    await user.selectOptions(screen.getByLabelText(/visibility/i), 'unlisted');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Ada Byron',
          bio: 'Documents platform engineering work.',
          experienceYears: 8,
          certifications: ['OutSystems Professional Developer'],
          links: ['https://example.com/ada-updated'],
          visibility: 'unlisted',
        }),
      }),
    );
    expect(onProfileSaved).toHaveBeenCalledWith(savedProfile);
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('prevents submission when client-side validation fails', async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onProfileSaved={jest.fn()} />);

    await user.clear(screen.getByLabelText(/years of experience/i));
    await user.type(screen.getByLabelText(/years of experience/i), '-1');
    await user.clear(screen.getByLabelText(/public links/i));
    await user.type(screen.getByLabelText(/public links/i), 'bad-link');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Years of experience must be a non-negative integer.')).toBeInTheDocument();
    expect(screen.getByText('Links must be valid HTTP or HTTPS URLs.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('prevents submission when required profile fields are missing', async () => {
    const user = userEvent.setup();
    render(<ProfileEditor profile={profile} onProfileSaved={jest.fn()} />);

    await user.clear(screen.getByLabelText(/^name$/i));
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Name is required.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('displays API validation errors without reporting a saved profile', async () => {
    const user = userEvent.setup();
    const onProfileSaved = jest.fn();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'validation_error',
        message: 'Profile input is invalid.',
        fields: {
          links: 'Links must be valid HTTP or HTTPS URLs.',
        },
      }),
    } as Response);

    render(<ProfileEditor profile={profile} onProfileSaved={onProfileSaved} />);

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Links must be valid HTTP or HTTPS URLs.')).toBeInTheDocument();
    expect(onProfileSaved).not.toHaveBeenCalled();
  });

  it.each(['public', 'private', 'unlisted'])('submits the selected %s visibility value', async (visibility) => {
    const user = userEvent.setup();
    const onProfileSaved = jest.fn();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...profile, visibility }),
    } as Response);

    render(<ProfileEditor profile={profile} onProfileSaved={onProfileSaved} />);

    await user.selectOptions(screen.getByLabelText(/visibility/i), visibility);
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/profile/me', expect.objectContaining({
        body: expect.stringContaining(`"visibility":"${visibility}"`),
      })),
    );
    expect(onProfileSaved).toHaveBeenCalledWith(expect.objectContaining({ visibility }));
  });

  it('displays API validation errors for visibility', async () => {
    const user = userEvent.setup();
    const onProfileSaved = jest.fn();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'validation_error',
        message: 'Profile input is invalid.',
        fields: {
          visibility: 'Visibility must be public, private, or unlisted.',
        },
      }),
    } as Response);

    render(<ProfileEditor profile={profile} onProfileSaved={onProfileSaved} />);

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Visibility must be public, private, or unlisted.')).toBeInTheDocument();
    expect(onProfileSaved).not.toHaveBeenCalled();
  });

  it('shows a general error message for unexpected save failures', async () => {
    const user = userEvent.setup();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'unexpected_failure' }),
    } as Response);

    render(<ProfileEditor profile={profile} onProfileSaved={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(await screen.findByText('Could not save profile changes.')).toBeInTheDocument();
  });

  it('disables the submit button while the update request is in progress', async () => {
    const user = userEvent.setup();
    let resolveSave: (response: Response) => void = () => undefined;
    jest.spyOn(global, 'fetch').mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveSave = resolve;
      }),
    );

    render(<ProfileEditor profile={profile} onProfileSaved={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    await act(async () => {
      resolveSave({
        ok: true,
        status: 200,
        json: async () => profile,
      } as Response);
    });
  });
});
