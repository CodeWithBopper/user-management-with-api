import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ApiErrorBody, ApiResult, NewUser, User, UserInput } from '../types/user';

export class UserApiClient {
  constructor(private readonly request: APIRequestContext) {}

  listUsers(): Promise<ApiResult<User[]>> {
    return this.send<User[]>(this.request.get('/api/users'));
  }

  createUser(user: UserInput): Promise<ApiResult<User>> {
    return this.send<User>(this.request.post('/api/users', { data: { ...user } }));
  }

  getUser(id: number): Promise<ApiResult<User>> {
    return this.send<User>(this.request.get(`/api/users/${id}`));
  }

  updateUser(id: number, user: NewUser): Promise<ApiResult<User>> {
    return this.send<User>(this.request.put(`/api/users/${id}`, { data: { ...user } }));
  }

  deleteUser(id: number): Promise<ApiResult<undefined>> {
    return this.send<undefined>(this.request.delete(`/api/users/${id}`));
  }

  private async send<TBody>(responsePromise: Promise<APIResponse>): Promise<ApiResult<TBody>> {
    const response = await responsePromise;
    const rawBody = await response.body();
    const body =
      rawBody.byteLength === 0
        ? undefined
        : (JSON.parse(rawBody.toString('utf8')) as TBody | ApiErrorBody);

    return {
      status: response.status(),
      body,
    };
  }
}
