import { faker } from '@faker-js/faker';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { UserManagementPage, type NewUser } from '../pages/user-management.page';

export class UserManagementHelper {
  private readonly usersToCleanUp = new WeakMap<TestInfo, Set<string>>();

  async createUserThroughUi(
    page: Page,
    testInfo: TestInfo,
    status: NewUser['status'] = 'active',
  ): Promise<{ userPage: UserManagementPage; user: NewUser }> {
    const userPage = new UserManagementPage(page);
    const user: NewUser = {
      name: faker.person.fullName(),
      email: `playwright-${faker.string.uuid()}@example.test`,
      status,
    };

    this.registerUserForCleanup(testInfo, user.email);
    await userPage.goto();
    await userPage.createUser(user);

    return { userPage, user };
  }

  async cleanupCreatedUsers(request: APIRequestContext, testInfo: TestInfo): Promise<number[]> {
    const emails = this.usersToCleanUp.get(testInfo);
    this.usersToCleanUp.delete(testInfo);

    if (!emails) {
      return [];
    }

    return Promise.all([...emails].map((email) => this.cleanupUser(request, email)));
  }

  private registerUserForCleanup(testInfo: TestInfo, email: string): void {
    const emails = this.usersToCleanUp.get(testInfo) ?? new Set<string>();
    emails.add(email);
    this.usersToCleanUp.set(testInfo, emails);
  }

  private async cleanupUser(request: APIRequestContext, email: string): Promise<number> {
    const usersResponse = await request.get('/api/users');
    if (!usersResponse.ok()) {
      return usersResponse.status();
    }

    const users = (await usersResponse.json()) as Array<{ id: number; email: string }>;
    const user = users.find((candidate) => candidate.email === email);
    if (!user) {
      return 404;
    }

    const deleteResponse = await request.delete(`/api/users/${user.id}`);
    return deleteResponse.status();
  }
}
