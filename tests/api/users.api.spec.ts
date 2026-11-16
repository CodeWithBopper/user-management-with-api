import { expect } from '@playwright/test';
import { test, type User } from '../fixtures/user.fixture';
import { faker } from '@faker-js/faker';

test('retrieves the user created by the fixture', async ({ request, user }) => {
  const retrieveResponse = await request.get(`/api/users/${user.id}`);
  expect(retrieveResponse.status()).toBe(200);
  expect(await retrieveResponse.json()).toEqual(user);

  const listResponse = await request.get('/api/users');
  expect(listResponse.status()).toBe(200);
  expect(await listResponse.json()).toContainEqual(user);
});

test('replaces a user while preserving its ID', async ({ request, user }) => {
  const replacement = {
    name: faker.person.fullName(),
    email: `updated-${faker.string.uuid()}@example.test`,
    status: user.status === 'active' ? 'inactive' : 'active',
  };

  const updateResponse = await request.put(`/api/users/${user.id}`, {
    data: replacement,
  });
  expect(updateResponse.status()).toBe(200);

  const updatedUser = (await updateResponse.json()) as User;
  expect(updatedUser).toEqual({ id: user.id, ...replacement });

  const retrieveResponse = await request.get(`/api/users/${user.id}`);
  expect(retrieveResponse.status()).toBe(200);
  expect(await retrieveResponse.json()).toEqual(updatedUser);
});

test('rejects a user with an unsupported status', async ({ request }) => {
  const response = await request.post('/api/users', {
    data: {
      name: 'Invalid Status User',
      email: `invalid-status-${faker.string.uuid()}@example.test`,
      status: 'pending',
    },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ code: 'INVALID_USER' });
});
