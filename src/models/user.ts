export type UserRole = 'admin' | 'user';

export interface UserDocument {
  id?: string;
  username: string;
  role: UserRole;
  enabled: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CreateUserInput {
  username: string;
  role: UserRole;
}

export interface UpdateUserInput {
  username?: string;
  role?: UserRole;
  enabled?: boolean;
}
