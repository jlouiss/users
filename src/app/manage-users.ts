import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormField, maxLength, minLength, required, schema, submit, form } from '@angular/forms/signals';
import { Router } from '@angular/router';

import { Auth } from './auth';
import { Users } from './users';
import type { UserDocument, UserRole } from '../models/user';

interface UserFormModel {
  username: string;
  role: UserRole;
}

const userSchema = schema<UserFormModel>((path) => {
  required(path.username, { message: 'Username is required.' });
  minLength(path.username, 2, { message: 'Username must be at least 2 characters.' });
  maxLength(path.username, 40, { message: 'Username must be 40 characters or fewer.' });
  required(path.role, { message: 'Role is required.' });
});

function emptyUserModel(): UserFormModel {
  return { username: '', role: 'user' };
}

function formatTimestamp(value: unknown): string {
  const toDate = (value as { toDate?: () => Date } | null)?.toDate;
  if (typeof toDate !== 'function') {
    return 'Just now';
  }
  return toDate.call(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

@Component({
  selector: 'app-manage-users',
  imports: [FormField],
  template: `
    <div class="page">
      <header class="topbar">
        <h1>Manage Users</h1>
        <div class="topbar-account">
          @if (currentUserEmail()) {
            <span class="account-email">{{ currentUserEmail() }}</span>
          }
          <button type="button" class="ghost-button" (click)="onSignOut()">Sign out</button>
        </div>
      </header>

      <main class="content">
        <section class="card" aria-labelledby="add-user-heading">
          <h2 id="add-user-heading">Add user</h2>
          <form class="add-user-form" (submit)="onAddUser($event)" novalidate>
            <div class="field">
              <label for="new-username">Username</label>
              <input
                id="new-username"
                type="text"
                autocomplete="off"
                [formField]="addForm.username"
                [attr.aria-invalid]="addForm.username().invalid() && addForm.username().touched()"
                [attr.aria-describedby]="
                  addForm.username().invalid() && addForm.username().touched() ? 'new-username-error' : null
                "
              />
              @if (addForm.username().touched() && addForm.username().invalid()) {
                <p id="new-username-error" class="field-error" role="alert">
                  {{ addForm.username().errors()[0]?.message }}
                </p>
              }
            </div>

            <div class="field">
              <label for="new-role">Role</label>
              <select id="new-role" [formField]="addForm.role">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button type="submit" class="primary-button" [disabled]="addBusy()">
              {{ addBusy() ? 'Adding…' : 'Add user' }}
            </button>
          </form>
          @if (addError()) {
            <p class="form-error" role="alert">{{ addError() }}</p>
          }
        </section>

        <section class="card" aria-labelledby="users-heading">
          <div class="card-header-row">
            <h2 id="users-heading">Users</h2>
            <div class="search-field">
              <label for="search">Search by username or role</label>
              <input
                id="search"
                type="search"
                placeholder="e.g. admin, ada"
                [value]="usersService.searchTerm()"
                (input)="onSearch($event)"
              />
            </div>
          </div>

          @if (actionError()) {
            <p class="form-error" role="alert">{{ actionError() }}</p>
          }

          @if (usersService.error()) {
            <p class="form-error" role="alert">{{ usersService.error() }}</p>
          }

          @if (usersService.loading()) {
            <p class="empty-state">Loading users…</p>
          } @else if (usersService.filteredUsers().length === 0) {
            <p class="empty-state">
              @if (usersService.searchTerm()) {
                No users match "{{ usersService.searchTerm() }}".
              } @else {
                No users yet. Add one above to get started.
              }
            </p>
          } @else {
            <div class="table-scroll">
              <table>
                <caption class="visually-hidden">List of users, their role and status</caption>
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (user of usersService.filteredUsers(); track user.id) {
                    @if (editingUserId() === user.id) {
                      <tr>
                        <td colspan="5">
                          <form class="edit-user-form" (submit)="onSaveEdit($event, user)" novalidate>
                            <div class="field">
                              <label [for]="'edit-username-' + user.id">Username</label>
                              <input
                                [id]="'edit-username-' + user.id"
                                type="text"
                                autocomplete="off"
                                [formField]="editForm.username"
                              />
                              @if (editForm.username().touched() && editForm.username().invalid()) {
                                <p class="field-error" role="alert">
                                  {{ editForm.username().errors()[0]?.message }}
                                </p>
                              }
                            </div>
                            <div class="field">
                              <label [for]="'edit-role-' + user.id">Role</label>
                              <select [id]="'edit-role-' + user.id" [formField]="editForm.role">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div class="row-actions">
                              <button type="submit" class="primary-button" [disabled]="editBusy()">
                                {{ editBusy() ? 'Saving…' : 'Save' }}
                              </button>
                              <button type="button" class="ghost-button" (click)="cancelEdit()">Cancel</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    } @else {
                      <tr>
                        <td data-label="Username">{{ user.username }}</td>
                        <td data-label="Role">{{ user.role }}</td>
                        <td data-label="Status">
                          <span class="status-pill" [class.status-disabled]="!user.enabled">
                            {{ user.enabled ? 'Enabled' : 'Disabled' }}
                          </span>
                        </td>
                        <td data-label="Created">{{ formatTimestamp(user.createdAt) }}</td>
                        <td data-label="Actions" class="row-actions">
                          <button type="button" class="ghost-button" (click)="startEdit(user)">
                            Edit<span class="visually-hidden"> {{ user.username }}</span>
                          </button>
                          <button type="button" class="ghost-button" (click)="onToggleEnabled(user)">
                            {{ user.enabled ? 'Disable' : 'Enable' }}
                            <span class="visually-hidden"> {{ user.username }}</span>
                          </button>
                          <button type="button" class="danger-button" (click)="onRemove(user)">
                            Remove<span class="visually-hidden"> {{ user.username }}</span>
                          </button>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </main>
    </div>
  `,
  styles: `
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .page {
      min-height: 100dvh;
      background: #f4f5f7;
      color: #111827;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.5rem;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
    }

    .topbar h1 {
      margin: 0;
      font-size: 1.25rem;
    }

    .topbar-account {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .account-email {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .content {
      max-width: 60rem;
      margin: 0 auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
      padding: 1.25rem 1.5rem;
    }

    .card h2 {
      margin: 0 0 1rem;
      font-size: 1.0625rem;
    }

    .card-header-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .card-header-row h2 {
      margin: 0;
    }

    .add-user-form,
    .edit-user-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      min-width: 12rem;
    }

    .search-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: #374151;
    }

    input,
    select {
      font: inherit;
      padding: 0.5rem 0.65rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      color: #111827;
      background: #fff;
    }

    input:focus-visible,
    select:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 1px;
      border-color: #2563eb;
    }

    input[aria-invalid='true'] {
      border-color: #dc2626;
    }

    .field-error,
    .form-error {
      margin: 0;
      font-size: 0.8125rem;
      color: #b91c1c;
    }

    .form-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 0.5rem;
      padding: 0.6rem 0.75rem;
      margin-top: 0.75rem;
    }

    .primary-button {
      font: inherit;
      font-weight: 600;
      padding: 0.55rem 1rem;
      border: none;
      border-radius: 0.5rem;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
      align-self: flex-end;
    }

    .primary-button:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .primary-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .ghost-button {
      font: inherit;
      font-weight: 500;
      padding: 0.4rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      background: #fff;
      color: #111827;
      cursor: pointer;
    }

    .ghost-button:hover {
      background: #f9fafb;
    }

    .danger-button {
      font: inherit;
      font-weight: 500;
      padding: 0.4rem 0.75rem;
      border: 1px solid #fecaca;
      border-radius: 0.5rem;
      background: #fff;
      color: #b91c1c;
      cursor: pointer;
    }

    .danger-button:hover {
      background: #fef2f2;
    }

    button:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }

    .empty-state {
      color: #6b7280;
      font-size: 0.9375rem;
      margin: 0;
    }

    .table-scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9375rem;
    }

    th,
    td {
      text-align: left;
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }

    th {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #6b7280;
    }

    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .status-pill {
      display: inline-block;
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 500;
      background: #dcfce7;
      color: #166534;
    }

    .status-pill.status-disabled {
      background: #f3f4f6;
      color: #6b7280;
    }

    @media (max-width: 640px) {
      thead {
        display: none;
      }

      table,
      tbody,
      tr,
      td {
        display: block;
        width: 100%;
      }

      tr {
        border-bottom: 1px solid #e5e7eb;
        padding: 0.5rem 0;
      }

      td {
        border-bottom: none;
        padding: 0.3rem 0;
      }

      td[data-label]::before {
        content: attr(data-label);
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: #6b7280;
      }
    }
  `,
})
export class ManageUsers {
  protected readonly usersService = inject(Users);
  private readonly authService = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentUserEmail = computed(() => this.authService.currentUser()?.email ?? null);

  private readonly addModel = signal<UserFormModel>(emptyUserModel());
  protected readonly addForm = form(this.addModel, userSchema);
  protected readonly addBusy = signal(false);
  protected readonly addError = signal<string | null>(null);

  protected readonly editingUserId = signal<string | null>(null);
  private readonly editModel = signal<UserFormModel>(emptyUserModel());
  protected readonly editForm = form(this.editModel, userSchema);
  protected readonly editBusy = signal(false);

  protected readonly actionError = signal<string | null>(null);

  protected readonly formatTimestamp = formatTimestamp;

  constructor() {
    this.usersService.subscribe();
    this.destroyRef.onDestroy(() => this.usersService.unsubscribeFromUsers());
  }

  onSearch(event: Event): void {
    this.usersService.setSearchTerm((event.target as HTMLInputElement).value);
  }

  async onAddUser(event: Event): Promise<void> {
    event.preventDefault();
    this.addError.set(null);
    this.addBusy.set(true);
    try {
      await submit(this.addForm, async () => {
        await this.usersService.addUser({ ...this.addModel() });
        this.addForm().reset(emptyUserModel());
      });
    } catch (error) {
      this.addError.set(errorMessage(error, 'Could not add the user.'));
    } finally {
      this.addBusy.set(false);
    }
  }

  startEdit(user: UserDocument): void {
    this.actionError.set(null);
    this.editModel.set({ username: user.username, role: user.role });
    this.editForm().reset({ username: user.username, role: user.role });
    this.editingUserId.set(user.id ?? null);
  }

  cancelEdit(): void {
    this.editingUserId.set(null);
  }

  async onSaveEdit(event: Event, user: UserDocument): Promise<void> {
    event.preventDefault();
    if (!user.id) {
      return;
    }
    this.actionError.set(null);
    this.editBusy.set(true);
    try {
      await submit(this.editForm, async () => {
        await this.usersService.updateUser(user.id!, { ...this.editModel() });
        this.editingUserId.set(null);
      });
    } catch (error) {
      this.actionError.set(errorMessage(error, 'Could not save changes.'));
    } finally {
      this.editBusy.set(false);
    }
  }

  async onToggleEnabled(user: UserDocument): Promise<void> {
    if (!user.id) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.usersService.setEnabled(user.id, !user.enabled);
    } catch (error) {
      this.actionError.set(errorMessage(error, 'Could not update the user status.'));
    }
  }

  async onRemove(user: UserDocument): Promise<void> {
    if (!user.id) {
      return;
    }
    const confirmed = window.confirm(`Remove "${user.username}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    this.actionError.set(null);
    try {
      await this.usersService.removeUser(user.id);
    } catch (error) {
      this.actionError.set(errorMessage(error, 'Could not remove the user.'));
    }
  }

  async onSignOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/login');
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
