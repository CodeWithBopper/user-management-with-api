import { faker } from '@faker-js/faker';
import { expect, test as base } from '@playwright/test';

export interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

interface UserFixtures {
  user: User;
}

export const test = base.extend<UserFixtures>({
  user: [
    async ({ request }, use) => {
      const newUser = {
        name: faker.person.fullName(),
        email: `fixture-${faker.string.uuid()}@example.test`,
        status: 'active' as const,
      };

      const createResponse = await request.post('/api/users', { data: newUser });
      expect(createResponse.status()).toBe(201);

      const user = (await createResponse.json()) as User;
      expect(user).toMatchObject(newUser);
      expect(user.id).toEqual(expect.any(Number));
      expect(Number.isInteger(user.id)).toBe(true);
      expect(user.id).toBeGreaterThanOrEqual(1);
      expect(user.id).toBeLessThanOrEqual(999_999);

      try {
        await use(user);
      } finally {
        const deleteResponse = await request.delete(`/api/users/${user.id}`);
        expect([204, 404]).toContain(deleteResponse.status());
      }
    },
    { scope: 'test' },
  ],
});
