import type { Locator, Page } from '@playwright/test';
import type { NewUser } from '../types/user';

export class UserManagementPage {
  private readonly page: Page;
  readonly welcomeHeading: Locator;
  readonly createUserHeading: Locator;
  readonly usersHeading: Locator;
  private readonly nameInput: Locator;
  private readonly emailInput: Locator;
  private readonly statusSelect: Locator;
  private readonly createUserButton: Locator;
  readonly createdUserIdInput: Locator;
  private readonly retrieveUserButton: Locator;
  private readonly deleteUserButton: Locator;
  readonly statusMessage: Locator;
  private readonly userDetails: Locator;
  private readonly usersTable: Locator;
  readonly nameColumnHeader: Locator;
  readonly emailColumnHeader: Locator;
  readonly statusColumnHeader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.getByRole('heading', { name: 'Welcome to Playwright' });
    this.createUserHeading = page.getByRole('heading', { name: 'Create a user' });
    this.usersHeading = page.getByRole('heading', { name: 'Users' });
    this.nameInput = page.getByLabel('Name');
    this.emailInput = page.getByLabel('Email');
    this.statusSelect = page.getByLabel('Status');
    this.createUserButton = page.getByRole('button', { name: 'Create user' });
    this.createdUserIdInput = page.getByLabel('User ID');
    this.retrieveUserButton = page.getByRole('button', { name: 'Retrieve user' });
    this.deleteUserButton = page.getByRole('button', { name: 'Delete user' });
    this.statusMessage = page.getByRole('status');
    this.userDetails = page.locator('#user-details');
    this.usersTable = page.getByRole('table', { name: 'Users' });
    this.nameColumnHeader = this.usersTable.getByRole('columnheader', { name: 'Name' });
    this.emailColumnHeader = this.usersTable.getByRole('columnheader', { name: 'Email' });
    this.statusColumnHeader = this.usersTable.getByRole('columnheader', {
      name: 'Status',
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async createUser(user: NewUser): Promise<void> {
    await this.nameInput.fill(user.name);
    await this.emailInput.fill(user.email);
    await this.statusSelect.selectOption(user.status);
    await this.createUserButton.click();
  }

  async getCreatedUserId(): Promise<number> {
    return Number(await this.createdUserIdInput.inputValue());
  }

  async retrieveUser(id: number): Promise<void> {
    await this.createdUserIdInput.fill(String(id));
    await this.selectRetrieveUserButton();
  }

  async selectRetrieveUserButton(): Promise<void> {
    await this.retrieveUserButton.click();
  }

  async selectDeleteUserButton(): Promise<void> {
    await this.deleteUserButton.click();
  }

  userHeading(name: string): Locator {
    return this.page.getByRole('heading', { name, level: 3 });
  }

  userDetailsValue(value: string): Locator {
    return this.userDetails.getByText(value, { exact: true });
  }

  userRow(email: string): Locator {
    return this.usersTable.getByRole('row').filter({ hasText: email });
  }
}
