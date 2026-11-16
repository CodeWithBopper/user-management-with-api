# Playwright TypeScript Testing Guide

This guide documents the structure and testing conventions used in this repository. It is intended both as a reference for extending this project and as a starting point for similar Playwright projects.

The central design rule is:

> Keep scenario assertions in the test. Put selectors and UI actions in page objects, reusable setup and cleanup in fixtures or helpers, and keep each responsibility easy to find.

## 1. Project at a glance

This repository contains a small in-memory user-management API, a mock browser UI served by that API, and Playwright tests covering both API and UI behavior.

| Path | Responsibility |
| --- | --- |
| `src/server.ts` | HTTP server, API routes, validation, and in-memory user storage |
| `public/index.html` | Mock UI used by browser tests |
| `tests/specs/` | Browser and cross-layer UI scenarios |
| `tests/api/` | API contract tests and the OpenAPI definition |
| `tests/pages/` | Page objects: locators and user-facing page actions |
| `tests/fixtures/` | Playwright fixtures that provide reusable test-scoped data |
| `tests/helpers/` | Reusable workflows and cleanup support that do not belong in a spec |
| `playwright.config.ts` | Test projects, browser settings, and local web server startup |
| `tsconfig.json` | Strict type-checking configuration for application and test code |
| `tsconfig.build.json` | Build configuration for the server |
| `.github/workflows/playwright.yml` | CI setup, type-checking, browser installation, and test execution |

### Runtime behavior

- The API listens on `http://127.0.0.1:3000`; the same server serves the mock UI at `/`.
- User data is stored in memory. Restarting the server clears users and resets the ID counter.
- IDs are sequential integers from `1` through `999999`. Deleted IDs are not reused during the process lifetime.
- Tests run against one server process, so test data can be visible across workers. Use unique data and clean up records.

## 2. Getting started and running tests

Install dependencies and the browsers used by this project:

```sh
npm ci
npx playwright install chromium firefox
```

Common commands:

| Command | Purpose |
| --- | --- |
| `npm start` | Build and start the API and mock UI locally |
| `npm run build` | Compile the server TypeScript into `dist/` |
| `npm run typecheck` | Type-check the server, config, fixtures, helpers, and tests |
| `npm test` | Run the complete Playwright suite |
| `npm run test:api` | Run only the API project |

Playwright starts the server automatically for test runs using the `webServer` configuration. For ordinary local runs, it can reuse an existing server on port 3000; CI starts its own server.

The configured projects are Chromium, Firefox, and API. WebKit is intentionally not configured in this project.

## 3. Test configuration and execution model

`playwright.config.ts` sets the following project conventions:

- Tests are discovered under `tests/`.
- UI tests run in Chromium and Firefox; API specs run in a separate `api` project.
- `fullyParallel` is enabled. Tests must not depend on execution order or shared mutable state.
- CI disallows focused tests, retries failures twice, and uses one worker.
- Traces are collected on the first retry.
- The HTML reporter writes its output to `playwright-report/`.

The `api` project matches `*.api.spec.ts`, while the browser projects exclude those files. This keeps API-only tests from starting browser contexts and makes the test intent apparent from the filename.

## 4. Test responsibilities and organization

### Keep each test focused

Give each test one behavior to demonstrate. A test name should describe the behavior, and its body should make the setup, action, and verification understandable at a glance.

```ts
test('deletes a user', async ({ page, user }) => {
  const userPage = new UserManagementPage(page);

  await userPage.goto();
  await userPage.retrieveUser(user.id);
  await userPage.selectDeleteUserButton();

  await expect(userPage.statusMessage).toHaveText(`Deleted user ${user.id}.`);
});
```

Prefer several focused tests over one long test that covers unrelated scenarios. Avoid making one test depend on data or state created by another.

### Put scenario assertions in the test

Assertions that prove the behavior named by a test belong in that test. For example, a test should contain the `expect(...)` that verifies a success message or table row.

- Page objects should not call `expect`.
- Helpers should prepare data, perform reusable workflows, and expose results; they should not hide whether the scenario passed.
- Fixtures may assert their own setup contract—for example, that a user was successfully created before yielding it. That is fixture validation, not a substitute for the scenario assertions in the test.

This makes failures easy to interpret: the test itself shows what outcome it promises.

## 5. Page-object conventions

`UserManagementPage` is the single place for UI selectors and page operations.

### Structure

Follow this pattern when adding or changing a page object:

1. Declare the `Page` and `Locator` properties at the top of the class.
2. Initialize locators in the constructor.
3. Use accessible locators such as `getByRole` and `getByLabel` where possible.
4. Put selectors and UI interactions in page-object methods.
5. Expose useful locator properties or locator-returning methods for test assertions.
6. Do not put scenario expectations in the page object.

For example, the page object owns how a user row is located:

```ts
userRow(email: string): Locator {
  return this.usersTable.getByRole('row').filter({ hasText: email });
}
```

The test owns what must be true about that row:

```ts
const userRow = userPage.userRow(user.email);
await expect(userRow).toBeVisible();
await expect(userRow).toContainText(user.name);
await expect(userRow).toContainText(user.status);
```

Tests should not repeat raw selectors such as `page.locator(...)` or `page.getByRole(...)`. If a test needs a new page element, add its locator to the page object and expose it in a clear, purposeful way.

### Keep page methods focused on page work

Good page-object responsibilities include:

- Navigation, such as `goto()`.
- User actions, such as `createUser()`, `retrieveUser(id)`, and `selectDeleteUserButton()`.
- Reading a value needed by a test, such as `getCreatedUserId()`.
- Returning an assertion target, such as `userHeading(name)` or `userRow(email)`.

Avoid page methods named `expect...` that assert a whole scenario internally. That makes test behavior less visible and can hide which assertion failed.

## 6. Fixtures for reusable test data

The custom `user` fixture in `tests/fixtures/user.fixture.ts` creates a user through Playwright's built-in `request` fixture and provides the resulting typed user to tests.

```ts
import { expect } from '@playwright/test';
import { test } from '../fixtures/user.fixture';

test('retrieves a user', async ({ request, user }) => {
  const response = await request.get(`/api/users/${user.id}`);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual(user);
});
```

Fixture behavior:

- It has test scope, so a test that uses it gets its own user.
- Fixtures are lazy: a test that does not request `user` does not create one.
- The fixture validates that its setup request succeeded before exposing the user.
- Its `try/finally` teardown deletes the user after the test, including when the test fails.
- Cleanup accepts `204` (deleted) or `404` (the test already deleted the user).

Import the custom `test` from the fixture module in specs that use `user`. Tests that do not need the fixture can still use the same `test` object without causing the `user` fixture to run.

Use fixtures for stable test-scoped prerequisites. Avoid putting a fixture in a hook if that would cause tests that do not need it to create the data anyway.

## 7. Helpers and `afterEach` cleanup

`UserManagementHelper` contains reusable UI-user setup and cleanup bookkeeping. The spec keeps the actual test declarations and registers an `afterEach` hook:

```ts
const userManagementHelper = new UserManagementHelper();

test.afterEach(async ({ request }, testInfo) => {
  const cleanupStatuses = await userManagementHelper.cleanupCreatedUsers(request, testInfo);
  for (const status of cleanupStatuses) {
    expect([204, 404]).toContain(status);
  }
});
```

When a test creates a UI user, it passes `testInfo` to the helper:

```ts
test('creates a user', async ({ page }, testInfo) => {
  const { userPage, user } = await userManagementHelper.createUserThroughUi(
    page,
    testInfo,
    'inactive',
  );

  await expect(userPage.statusMessage).toHaveText(`Created user ${user.name}.`);
  await expect(userPage.userDetailsValue(user.email)).toBeVisible();
});
```

The helper records that user's unique email in a `WeakMap` keyed by `TestInfo`. The hook uses the same test's `TestInfo` to find and clean up only that test's users. This avoids shared cleanup state between parallel tests and still runs if an assertion fails.

Use a single helper instance for the suite so the test and its hook share the same registry. The hook depends on the built-in `request` fixture, not the custom `user` fixture, so it does not make every test create a fixture user.

Choose the cleanup mechanism that matches the resource:

- Use the fixture's teardown for users created by the `user` fixture.
- Use the helper and `afterEach` registry for users created through its UI workflow.
- If a test creates data directly with `request`, make sure that data also has a reliable cleanup path. If creation itself is not under test, prefer an existing fixture where practical.

## 8. API testing and contract

The OpenAPI contract is maintained in [`tests/api/openapi.json`](../tests/api/openapi.json). Keep it consistent with the server and tests when changing the API.

| Operation | Endpoint | Success response |
| --- | --- | --- |
| List users | `GET /api/users` | `200` with an array |
| Create a user | `POST /api/users` | `201` with the created user |
| Retrieve a user | `GET /api/users/{id}` | `200` with the user |
| Replace user details | `PUT /api/users/{id}` | `200` with the updated user |
| Delete a user | `DELETE /api/users/{id}` | `204` |

User data requires a non-empty name, valid email, and a status of `active` or `inactive`. IDs are server-generated integers from `1` to `999999`. Deletion removes the user; it does not change the status to inactive.

Use the built-in `request` fixture for API tests. Assert both the HTTP status and relevant response data:

```ts
test('replaces a user while preserving its ID', async ({ request, user }) => {
  const replacement = {
    name: faker.person.fullName(),
    email: `updated-${faker.string.uuid()}@example.test`,
    status: 'inactive' as const,
  };

  const response = await request.put(`/api/users/${user.id}`, { data: replacement });

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ id: user.id, ...replacement });
});
```

Keep API specs under `tests/api/` and name them `*.api.spec.ts` so they run in the API project.

## 9. Test data

- Use `@faker-js/faker` to avoid collisions between parallel tests and repeated runs.
- Prefer UUID-backed emails such as `` `test-${faker.string.uuid()}@example.test` ``.
- Use the `NewUser` or `User` types rather than duplicating untyped data shapes.
- Keep data relevant to the scenario; use explicit values when they clarify the behavior.
- Do not rely on a particular generated ID. Assert the documented range instead.

## 10. TypeScript, builds, and CI

TypeScript is configured with strict checking. The root `tsconfig.json` includes the server, tests, and Playwright configuration. The build-specific `tsconfig.build.json` compiles only `src/` into `dist/`.

The GitHub Actions workflow in `.github/workflows/playwright.yml`:

1. Checks out the repository and configures Node with npm caching.
2. Installs locked dependencies with `npm ci`.
3. Runs `npm run typecheck`.
4. Installs Playwright browsers and their system dependencies.
5. Runs `npm test`.
6. Uploads the HTML Playwright report.

Run type-checking locally after changing TypeScript or test structure. Run the full suite for changes that affect shared setup, configuration, or multiple test projects; use `npm run test:api` for focused API-only changes.

## 11. Adding a new test

Use this checklist:

1. Decide whether the behavior is API-only, UI-only, or cross-layer.
2. Add one clearly named test for the behavior.
3. Reuse the `user` fixture for an API-created prerequisite when appropriate.
4. Reuse `UserManagementHelper` for the established UI-user workflow; use `testInfo` so cleanup is registered.
5. Put any new UI selectors in the relevant page object, not the spec.
6. Add page-object action methods for UI operations, but keep the test's `expect` calls in the test.
7. Generate unique test data with Faker when collisions are possible.
8. Ensure every created resource has cleanup that runs on both passing and failing tests.
9. Run `npm run typecheck` and the relevant Playwright tests.

## 12. Guidance for AI-assisted changes

When asking an AI tool to extend this project, include these constraints in the task:

```text
Follow the project's existing TypeScript and Playwright structure.
Keep scenario assertions in the test body, not in page-object methods or helpers.
Keep selectors and UI interactions in page objects; initialize locators in constructors.
Use existing fixtures for test-scoped prerequisites and helpers for reusable workflows.
Keep test data unique and ensure created resources are cleaned up after failures as well as passes.
Do not make tests depend on order or shared mutable data.
Run npm run typecheck and the relevant Playwright tests, and report the results.
```

AI-generated changes should still be reviewed for correct fixture scope, cleanup behavior, API contract alignment, and whether assertions are visible in the test that describes the behavior.
