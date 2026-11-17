import { faker } from '@faker-js/faker';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { UserApiClient } from './user-api.client';
import { UserManagementPage } from '../pages/user-management.page';
import type { NewUser } from '../types/user';

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

    const userApi = new UserApiClient(request);
    return Promise.all([...emails].map((email) => this.cleanupUser(userApi, email)));
  }

  registerUserForCleanup(testInfo: TestInfo, email: string): void {
    const emails = this.usersToCleanUp.get(testInfo) ?? new Set<string>();
    emails.add(email);
    this.usersToCleanUp.set(testInfo, emails);
  }

  private async cleanupUser(userApi: UserApiClient, email: string): Promise<number> {
    const usersResponse = await userApi.listUsers();
    if (usersResponse.status !== 200 || !Array.isArray(usersResponse.body)) {
      return usersResponse.status;
    }

    const user = usersResponse.body.find((candidate) => candidate.email === email);
    if (!user) {
      return 404;
    }

    const deleteResponse = await userApi.deleteUser(user.id);
    return deleteResponse.status;
  }
}
