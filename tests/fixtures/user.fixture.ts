import { faker } from '@faker-js/faker';
import { expect, test as base } from '@playwright/test';
import { UserApiClient } from '../helpers/user-api.client';
import type { NewUser, User } from '../types/user';

interface UserFixtures {
  user: User;
}

export const test = base.extend<UserFixtures>({
  user: [
    async ({ request }, use) => {
      const newUser: NewUser = {
        name: faker.person.fullName(),
        email: `fixture-${faker.string.uuid()}@example.test`,
        status: 'active',
      };

      const userApi = new UserApiClient(request);
      const createResponse = await userApi.createUser(newUser);
      expect(createResponse.status).toBe(201);

      const responseBody = createResponse.body;
      if (!responseBody || 'code' in responseBody) {
        throw new Error(
          `Expected POST /api/users to return a user; received status ${createResponse.status}.`,
        );
      }

      const user: User = responseBody;
      expect(user).toMatchObject({ ...newUser });
      expect(user.id).toEqual(expect.any(Number));
      expect(Number.isInteger(user.id)).toBe(true);
      expect(user.id).toBeGreaterThanOrEqual(1);
      expect(user.id).toBeLessThanOrEqual(999_999);

      try {
        await use(user);
      } finally {
        const deleteResponse = await userApi.deleteUser(user.id);
        expect([204, 404]).toContain(deleteResponse.status);
      }
    },
    { scope: 'test' },
  ],
});
