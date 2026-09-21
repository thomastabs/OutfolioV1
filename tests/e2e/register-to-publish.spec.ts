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
    await page.getByRole('button', { name: 'Log in' }).click();

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
    const created = await createResponse.json() as { slug: string };
    projectSlug = created.slug;

    const projectList = page.getByRole('region', { name: 'Project list' });
    await expect(projectList.getByRole('heading', { name: testProject.title })).toBeVisible();
    await expect(projectList.getByText('Draft', { exact: true })).toBeVisible();
  });

  await test.step('Publish the project case study', async () => {
    const projectList = page.getByRole('region', { name: 'Project list' });
    await page.getByRole('button', { name: `Publish ${testProject.title}` }).click();

    await expect(projectList.getByText('Published', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Unpublish ${testProject.title}` })).toBeVisible();
  });

  await test.step('View the published project on its public page as a logged-out visitor', async () => {
    expect(projectSlug).toBeTruthy();

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();

    await visitorPage.goto(`/project/${projectSlug}`);

    await expect(visitorPage.getByRole('heading', { name: testProject.title })).toBeVisible();
    await expect(visitorPage.getByText(testProject.summary)).toBeVisible();
    await expect(visitorPage.getByRole('heading', { name: 'Access denied' })).toHaveCount(0);
    await expect(visitorPage.getByRole('heading', { name: 'Project not found' })).toHaveCount(0);
    await expect(visitorPage.getByRole('heading', { name: 'Project unavailable' })).toHaveCount(0);

    await visitorContext.close();
  });
});
