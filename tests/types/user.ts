export type UserStatus = 'active' | 'inactive';

export interface UserInput {
  name: string;
  email: string;
  status: string;
}

export interface NewUser extends UserInput {
  status: UserStatus;
}

export interface User extends NewUser {
  id: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiResult<TBody> {
  status: number;
  body: TBody | ApiErrorBody | undefined;
}
