import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test } from '../fixtures/user.fixture';
import { UserApiClient } from '../helpers/user-api.client';
import type { NewUser, User } from '../types/user';

test('retrieves the user created by the fixture', async ({ request, user }) => {
  const userApi = new UserApiClient(request);
  const retrieveResponse = await userApi.getUser(user.id);
  expect(retrieveResponse.status).toBe(200);
  expect(retrieveResponse.body).toEqual(user);

  const listResponse = await userApi.listUsers();
  expect(listResponse.status).toBe(200);
  expect(listResponse.body).toContainEqual(user);
});

test('replaces a user while preserving its ID', async ({ request, user }) => {
  const userApi = new UserApiClient(request);
  const replacement: NewUser = {
    name: faker.person.fullName(),
    email: `updated-${faker.string.uuid()}@example.test`,
    status: user.status === 'active' ? 'inactive' : 'active',
  };

  const updateResponse = await userApi.updateUser(user.id, replacement);
  expect(updateResponse.status).toBe(200);

  const updatedUser = { id: user.id, ...replacement };
  expect(updateResponse.body).toEqual(updatedUser);

  const retrieveResponse = await userApi.getUser(user.id);
  expect(retrieveResponse.status).toBe(200);
  expect(retrieveResponse.body).toEqual(updatedUser);
});

test('deletes a user and returns an empty body', async ({ request, user }) => {
  const userApi = new UserApiClient(request);
  const deleteResponse = await userApi.deleteUser(user.id);

  expect(deleteResponse.status).toBe(204);
  expect(deleteResponse.body).toBeUndefined();

  const retrieveResponse = await userApi.getUser(user.id);
  expect(retrieveResponse.status).toBe(404);
  expect(retrieveResponse.body).toMatchObject({ code: 'USER_NOT_FOUND' });
});

test('rejects a user with an unsupported status', async ({ request }) => {
  const userApi = new UserApiClient(request);
  const response = await userApi.createUser({
    name: 'Invalid Status User',
    email: `invalid-status-${faker.string.uuid()}@example.test`,
    status: 'pending',
  });

  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({ code: 'INVALID_USER' });
});
