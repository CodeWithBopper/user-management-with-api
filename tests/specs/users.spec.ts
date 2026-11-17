import { faker } from '@faker-js/faker';
import { expect } from '@playwright/test';
import { test } from '../fixtures/user.fixture';
import { UserApiClient } from '../helpers/user-api.client';
import { UserManagementHelper } from '../helpers/user-management.helper';
import { UserManagementPage } from '../pages/user-management.page';
import type { NewUser } from '../types/user';

const userManagementHelper = new UserManagementHelper();

test.afterEach(async ({ request }, testInfo) => {
  const cleanupStatuses = await userManagementHelper.cleanupCreatedUsers(request, testInfo);
  for (const status of cleanupStatuses) {
    expect([204, 404]).toContain(status);
  }
});

test(
  'creates a user through the api and verifies it appears in the users table',
  async ({ page, request }, testInfo) => {
    const newUser: NewUser = {
      name: 'API Created User',
      email: `api-created-${faker.string.uuid()}@example.test`,
      status: 'active',
    };
    userManagementHelper.registerUserForCleanup(testInfo, newUser.email);

    const userApi = new UserApiClient(request);
    const createResponse = await userApi.createUser(newUser);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      ...newUser,
      id: expect.any(Number),
    });

    const userPage = new UserManagementPage(page);
    await userPage.goto();
    const userRow = userPage.userRow(newUser.email);
    await expect(userRow).toBeVisible();
    await expect(userRow).toContainText(newUser.name);
    await expect(userRow).toContainText(newUser.status);
  },
);

test('loads the user management page and its content', async ({ page }) => {
  const userPage = new UserManagementPage(page);

  await userPage.goto();
  await expect(userPage.welcomeHeading).toBeVisible();
  await expect(userPage.createUserHeading).toBeVisible();
  await expect(userPage.usersHeading).toBeVisible();
  await expect(userPage.nameColumnHeader).toBeVisible();
  await expect(userPage.emailColumnHeader).toBeVisible();
  await expect(userPage.statusColumnHeader).toBeVisible();
});

test('creates a user', async ({ page }, testInfo) => {
  const { userPage, user } = await userManagementHelper.createUserThroughUi(
    page,
    testInfo,
    'inactive',
  );

  await expect(userPage.statusMessage).toHaveText(`Created user ${user.name}.`);
  await expect(userPage.userHeading(user.name)).toBeVisible();
  await expect(userPage.userDetailsValue(user.email)).toBeVisible();
  await expect(userPage.userDetailsValue(user.status)).toBeVisible();
  await expect(userPage.createdUserIdInput).toHaveValue(/^\d+$/);
  const id = await userPage.getCreatedUserId();
  expect(id).toBeGreaterThanOrEqual(1);
  expect(id).toBeLessThanOrEqual(999_999);
});

test('deletes a user', async ({ page, user }) => {
  const userPage = new UserManagementPage(page);

  await userPage.goto();
  await userPage.retrieveUser(user.id);
  await userPage.selectDeleteUserButton();

  await expect(userPage.statusMessage).toHaveText(`Deleted user ${user.id}.`);
});

test('shows a created user in the users table', async ({ page }, testInfo) => {
  const { userPage, user } = await userManagementHelper.createUserThroughUi(page, testInfo);

  const userRow = userPage.userRow(user.email);
  await expect(userRow).toBeVisible();
  await expect(userRow).toContainText(user.name);
  await expect(userRow).toContainText(user.status);
});

test('removes a deleted user from the users table', async ({ page, user }) => {
  const userPage = new UserManagementPage(page);

  await userPage.goto();
  const userRow = userPage.userRow(user.email);
  await expect(userRow).toBeVisible();
  await expect(userRow).toContainText(user.name);
  await expect(userRow).toContainText(user.status);
  await userPage.retrieveUser(user.id);
  await userPage.selectDeleteUserButton();

  await expect(userRow).toHaveCount(0);
});

test('shows not found when retrieving a deleted user', async ({ page, user }) => {
  const userPage = new UserManagementPage(page);

  await userPage.goto();
  await userPage.retrieveUser(user.id);
  await userPage.selectDeleteUserButton();
  await userPage.selectRetrieveUserButton();

  await expect(userPage.statusMessage).toHaveText('No user exists with the specified ID.');
});
