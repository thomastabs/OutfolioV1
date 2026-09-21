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
  const overflowInfo = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const hasOverflow = document.documentElement.scrollWidth > clientWidth + 1;
    if (!hasOverflow) return { hasOverflow, culprit: '' };

    // Every element's own getBoundingClientRect() stayed within the
    // viewport (grid stretch resizes each item's outer box to fit its
    // track), so the overflow must be an element whose CONTENT overflows
    // ITSELF - i.e. scrollWidth > clientWidth on the element itself, with
    // overflow:visible (the default) leaking it up to the document. That's
    // the real signature of a shrunk flex/grid item whose un-wrappable
    // content (a form control, an unbroken string) didn't shrink with it.
    const selfOverflowing = Array.from(document.querySelectorAll('*'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => {
        const classAttr = el.getAttribute('class');
        const selector = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${classAttr ? `.${classAttr.trim().split(/\s+/).join('.')}` : ''}`;
        const text = (el.textContent || '').trim().slice(0, 50);
        return `${selector} scrollWidth=${el.scrollWidth}px clientWidth=${el.clientWidth}px text="${text}"`;
      });
    return { hasOverflow, culprit: selfOverflowing.length > 0 ? selfOverflowing.join(' || ') : 'no element has scrollWidth > clientWidth on itself' };
  });

  expect(overflowInfo.hasOverflow, `page should not overflow horizontally at this viewport; widest offender: ${overflowInfo.culprit}`).toBe(false);
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
      // Screenshot before the overflow assertion so a failure still leaves
      // a visual artifact behind to diagnose from.
      await page.screenshot({
        path: testInfo.outputPath(`${target.name}.png`),
        fullPage: true,
      });
      await expectNoHorizontalOverflow(page);
    });
  }
});
