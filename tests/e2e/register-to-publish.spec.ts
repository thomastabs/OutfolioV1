import { expect, test } from '@playwright/test';

// Story 9563143: End-to-End Coverage for Register-to-Publish.
//
// The locked scenario is one continuous journey, not five independent
// ones, and later steps depend on state created by earlier ones (the
// registered user's credentials, the created project's slug). Rather than
// splitting into separate spec files with fragile assumed shared state
// across files, this is implemented as one test with a test.step() per
// developer-pack task, keeping the same traceability while state flows
// naturally through a single run.

const uniqueSuffix = Date.now();
const testUser = {
  name: 'E2E Test User',
  username: `e2e-test-user-${uniqueSuffix}`,
  email: `e2e-test-user-${uniqueSuffix}@example.com`,
  password: 'e2e-golden-path-password-123',
};
const testProject = {
  title: `E2E Test Project ${uniqueSuffix}`,
  summary: 'A project case study created by the register-to-publish E2E test.',
  role: 'QA Engineer',
};

test('registers, logs in, creates and publishes a project, then views it publicly as a logged-out visitor', async ({ page, browser }) => {
  let projectSlug = '';

  await test.step('Register a new account', async () => {
    await page.goto('/register');

    await page.getByLabel('Name', { exact: true }).fill(testUser.name);
    await page.getByLabel('Username', { exact: true }).fill(testUser.username);
    await page.getByLabel('Email', { exact: true }).fill(testUser.email);
    await page.getByLabel('Password', { exact: true }).fill(testUser.password);

    const [registerResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/v1/auth/register') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Create account' }).click(),
    ]);
    expect(registerResponse.ok(), `register API response: ${await registerResponse.text()}`).toBeTruthy();
    const registerBody = await registerResponse.json() as {
      userId: string; username: string; email: string; createdAt: string; session: { expiresAt: string };
    };
    expect(registerBody.userId).toBeTruthy();
    expect(registerBody.username).toBe(testUser.username);
    expect(registerBody.email).toBe(testUser.email);
    expect(registerBody.createdAt).toBeTruthy();
    expect(registerBody.session?.expiresAt).toBeTruthy();

    await expect(page).toHaveURL('/profile');
    await expect(page.getByRole('heading', { name: 'Profile workspace' })).toBeVisible();
  });

  await test.step('Log out so the login flow can be exercised separately', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Register', exact: true })).toBeVisible();
  });

  await test.step('Log in with the registered account', async () => {
    await page.goto('/login');

    await page.getByLabel('Username', { exact: true }).fill(testUser.username);
    await page.getByLabel('Password', { exact: true }).fill(testUser.password);

    const [loginResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Log in' }).click(),
    ]);
    expect(loginResponse.ok(), `login API response: ${await loginResponse.text()}`).toBeTruthy();
    const loginBody = await loginResponse.json() as {
      userId: string; username: string; email: string; session: { expiresAt: string };
    };
    expect(loginBody.userId).toBeTruthy();
    expect(loginBody.username).toBe(testUser.username);
    expect(loginBody.email).toBe(testUser.email);
    expect(loginBody.session?.expiresAt).toBeTruthy();

    await expect(page).toHaveURL('/profile');
    await expect(page.getByRole('heading', { name: 'Profile workspace' })).toBeVisible();
  });

  await test.step('Create a draft project case study', async () => {
    await page.goto('/projects');

    await page.getByLabel('Title', { exact: true }).fill(testProject.title);
    await page.getByLabel('Summary', { exact: true }).fill(testProject.summary);
    await page.getByLabel('Role', { exact: true }).fill(testProject.role);

    const [createResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/v1/projects') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Create project' }).click(),
    ]);
    expect(createResponse.ok(), `create project API response: ${await createResponse.text()}`).toBeTruthy();
    const created = await createResponse.json() as {
      id: string; title: string; slug: string; summary: string; visibility: string; publishedAt: string | null;
    };
    projectSlug = created.slug;
    expect(created.id).toBeTruthy();
    expect(created.title).toBe(testProject.title);
    expect(created.summary).toBe(testProject.summary);
    expect(created.visibility).toBe('draft');
    expect(created.publishedAt).toBeNull();

    const projectList = page.getByRole('region', { name: 'Project list' });
    await expect(projectList.getByRole('heading', { name: testProject.title })).toBeVisible();
    await expect(projectList.getByText('Draft', { exact: true })).toBeVisible();
  });

  await test.step('Publish the project case study', async () => {
    const projectList = page.getByRole('region', { name: 'Project list' });

    const [publishResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/publish') && response.request().method() === 'POST'),
      page.getByRole('button', { name: `Publish ${testProject.title}` }).click(),
    ]);
    expect(publishResponse.ok(), `publish API response: ${await publishResponse.text()}`).toBeTruthy();
    const published = await publishResponse.json() as {
      id: string; title: string; slug: string; status: string; visibility: string; publishedAt: string;
    };
    expect(published.id).toBeTruthy();
    expect(published.title).toBe(testProject.title);
    expect(published.slug).toBe(projectSlug);
    expect(published.status).toBeTruthy();
    expect(published.visibility).toBe('published');
    expect(published.publishedAt).toBeTruthy();

    await expect(projectList.getByText('Published', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Unpublish ${testProject.title}` })).toBeVisible();
  });

  await test.step('View the published project on its public page as a logged-out visitor', async () => {
    expect(projectSlug).toBeTruthy();

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();

    const [publicResponse] = await Promise.all([
      visitorPage.waitForResponse((response) => response.url().includes(`/api/v1/public/project/${projectSlug}`) && !response.url().includes('/images')),
      visitorPage.goto(`/project/${projectSlug}`),
    ]);
    expect(publicResponse.ok(), `public project API response: ${await publicResponse.text()}`).toBeTruthy();
    const publicProject = await publicResponse.json() as { title: string; visibility: string; error?: string };
    expect(publicProject.title).toBe(testProject.title);
    expect(publicProject.visibility).toBe('published');
    expect(publicProject.error).toBeUndefined();

    await expect(visitorPage.getByRole('heading', { name: testProject.title })).toBeVisible();
    await expect(visitorPage.getByText(testProject.summary)).toBeVisible();
    await expect(visitorPage.getByRole('heading', { name: 'Access denied' })).toHaveCount(0);
    await expect(visitorPage.getByRole('heading', { name: 'Project not found' })).toHaveCount(0);
    await expect(visitorPage.getByRole('heading', { name: 'Project unavailable' })).toHaveCount(0);

    await visitorContext.close();
  });
});
