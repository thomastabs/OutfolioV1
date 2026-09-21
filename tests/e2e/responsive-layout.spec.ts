import { expect, test, type Page } from '@playwright/test';

// Story 9563524: Real Device and Viewport Testing.
//
// Runs across three viewport/device projects (Desktop Chrome, iPhone 13,
// iPad Pro 11 — see playwright.config.ts) to close the sandbox
// resize-window gap and verify responsive layout on real device profiles.
//
// Visual validation here is structural (no horizontal overflow, key
// landmark visible) plus a captured screenshot per page/device as a CI
// artifact for human review, rather than pixel-diff baseline snapshots.
// This project's isolated test DB reseeds unique per-run data (timestamped
// usernames, project slugs) on every run, which would produce false-positive
// pixel diffs on pages like /profile and /developer/{username} regardless
// of any real regression, and CI-runner-vs-local rendering differences
// would force baselines to be generated on the runner itself and
// re-baselined on every legitimate UI change — not worth that maintenance
// burden for this suite.

const uniqueSuffix = Date.now();
const testUser = {
  name: 'E2E Viewport Test User',
  username: `e2e-viewport-user-${uniqueSuffix}`,
  email: `e2e-viewport-user-${uniqueSuffix}@example.com`,
  password: 'e2e-viewport-test-password-123',
};
const testProject = {
  title: `E2E Viewport Project ${uniqueSuffix}`,
  summary: 'A project case study created by the responsive-layout E2E test.',
  role: 'QA Engineer',
};

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasOverflow, 'page should not overflow horizontally at this viewport').toBe(false);
}

test('renders key pages responsively without horizontal overflow', async ({ page }, testInfo) => {
  await test.step('Register an account, publish a public profile, and publish a project', async () => {
    const registerResponse = await page.request.post('/api/v1/auth/register', { data: testUser });
    expect(registerResponse.ok(), `register API response: ${await registerResponse.text()}`).toBeTruthy();

    const profileResponse = await page.request.put('/api/v1/profile/me', {
      data: {
        name: testUser.name,
        bio: 'Responsive layout coverage for real devices and viewports.',
        experienceYears: 3,
        certifications: [],
        links: [],
        visibility: 'public',
      },
    });
    expect(profileResponse.ok(), `profile update API response: ${await profileResponse.text()}`).toBeTruthy();

    const createResponse = await page.request.post('/api/v1/projects', { data: testProject });
    expect(createResponse.ok(), `create project API response: ${await createResponse.text()}`).toBeTruthy();
    const created = (await createResponse.json()) as { id: string };

    const publishResponse = await page.request.post(`/api/v1/projects/${created.id}/publish`);
    expect(publishResponse.ok(), `publish API response: ${await publishResponse.text()}`).toBeTruthy();
  });

  const pages: Array<{ name: string; path: string; assertMarker: (p: Page) => Promise<void> }> = [
    {
      name: 'home',
      path: '/',
      assertMarker: async (p) => {
        await expect(p.getByRole('heading', { name: 'Outfolio', exact: true })).toBeVisible();
      },
    },
    {
      name: 'discover',
      path: '/discover',
      assertMarker: async (p) => {
        await expect(p.getByRole('heading', { name: 'Discover projects' })).toBeVisible();
      },
    },
    {
      name: 'profile',
      path: '/profile',
      assertMarker: async (p) => {
        await expect(p.getByRole('region', { name: 'Developer profile' })).toBeVisible();
      },
    },
    {
      name: 'projects',
      path: '/projects',
      assertMarker: async (p) => {
        await expect(p.getByRole('region', { name: 'Project list' })).toBeVisible();
      },
    },
    {
      name: 'developer-profile',
      path: `/developer/${testUser.username}`,
      assertMarker: async (p) => {
        await expect(p.getByText(`@${testUser.username}`)).toBeVisible();
      },
    },
  ];

  for (const target of pages) {
    await test.step(`Verify responsive layout for ${target.path}`, async () => {
      await page.goto(target.path);
      await target.assertMarker(page);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`${target.name}.png`),
        fullPage: true,
      });
    });
  }
});
