import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  FormField,
  FormRoot,
  maxLength,
  minLength,
  required,
  schema,
  submit,
  form,
} from '@angular/forms/signals';
import { Router } from '@angular/router';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideMoon, lucideSearch, lucideSun } from '@ng-icons/lucide';

import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmEmptyImports } from '@spartan-ng/helm/empty';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputGroupImports } from '@spartan-ng/helm/input-group';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmPaginationImports } from '@spartan-ng/helm/pagination';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { HlmTableImports } from '@spartan-ng/helm/table';

import { Auth } from './auth';
import { ThemeService } from './theme';
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
  imports: [
    FormField,
    FormRoot,
    NgIcon,
    HlmAlertImports,
    HlmBadgeImports,
    HlmButtonImports,
    HlmCardImports,
    HlmEmptyImports,
    HlmFieldImports,
    HlmInputGroupImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmPaginationImports,
    HlmSpinnerImports,
    HlmTableImports,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideMoon, lucideSearch, lucideSun })],
  template: `
    <div class="bg-muted min-h-dvh">
      <header class="bg-card border-border flex items-center justify-between gap-4 border-b px-6 py-4">
        <h1 class="text-xl font-semibold">Manage Users</h1>
        <div class="flex items-center gap-3">
          @if (currentUserEmail()) {
            <span class="text-muted-foreground text-sm">{{ currentUserEmail() }}</span>
          }
          <button
            hlmBtn
            type="button"
            variant="outline"
            size="icon"
            [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            (click)="theme.toggle()"
          >
            <ng-icon [name]="theme.theme() === 'dark' ? 'lucideSun' : 'lucideMoon'" />
          </button>
          <button hlmBtn type="button" variant="outline" size="sm" (click)="onSignOut()">Sign out</button>
        </div>
      </header>

      <main class="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <section hlmCard aria-labelledby="add-user-heading">
          <div hlmCardHeader>
            <h2 hlmCardTitle id="add-user-heading">Add user</h2>
          </div>
          <div hlmCardContent>
            <form
              class="flex flex-wrap items-start gap-4"
              [formRoot]="addForm"
              (submit)="onAddUser($event)"
              novalidate
            >
              <div hlmField class="min-w-48 flex-1">
                <label hlmFieldLabel for="new-username">Username</label>
                <input hlmInput id="new-username" type="text" autocomplete="off" [formField]="addForm.username" />
                @for (error of addForm.username().errors(); track error.kind) {
                  <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
                }
              </div>

              <div hlmField class="w-40">
                <label hlmFieldLabel for="new-role">Role</label>
                <hlm-native-select id="new-role" selectClass="h-8 ps-2.5 text-sm" [formField]="addForm.role">
                  <option hlmNativeSelectOption value="user">User</option>
                  <option hlmNativeSelectOption value="admin">Admin</option>
                </hlm-native-select>
              </div>

              <button hlmBtn type="submit" class="self-end" [disabled]="addBusy()">
                @if (addBusy()) {
                  <hlm-spinner />
                }
                {{ addBusy() ? 'Adding…' : 'Add user' }}
              </button>
            </form>
            @if (addError()) {
              <div hlmAlert variant="destructive" class="mt-4" role="alert">
                <p hlmAlertDescription>{{ addError() }}</p>
              </div>
            }
          </div>
        </section>

        <section hlmCard aria-labelledby="users-heading">
          <div hlmCardHeader>
            <h2 hlmCardTitle id="users-heading">Users</h2>
          </div>

          <div hlmCardContent class="flex flex-col gap-4">
            <div hlmField>
              <label hlmFieldLabel for="search" class="sr-only">Search by username or role</label>
              <div hlmInputGroup>
                <div hlmInputGroupAddon>
                  <ng-icon name="lucideSearch" />
                </div>
                <input
                  hlmInputGroupInput
                  id="search"
                  type="search"
                  placeholder="Search by username or role…"
                  [value]="usersService.searchInput()"
                  (input)="onSearch($event)"
                />
              </div>
            </div>

            @if (actionError()) {
              <div hlmAlert variant="destructive" role="alert">
                <p hlmAlertDescription>{{ actionError() }}</p>
              </div>
            }

            @if (usersService.error()) {
              <div hlmAlert variant="destructive" role="alert">
                <p hlmAlertDescription>{{ usersService.error() }}</p>
              </div>
            }

            @if (usersService.loading()) {
              <div class="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <hlm-spinner />
                Loading users…
              </div>
            } @else if (usersService.users().length === 0) {
              <div hlmEmpty>
                <div hlmEmptyHeader>
                  <p hlmEmptyTitle>No users found</p>
                  <p hlmEmptyDescription>
                    @if (usersService.isSearchActive()) {
                      No users match "{{ usersService.searchInput() }}".
                    } @else {
                      No users yet. Add one above to get started.
                    }
                  </p>
                </div>
              </div>
            } @else {
              <div hlmTableContainer>
                <table hlmTable>
                  <caption hlmCaption class="sr-only">List of users, their role and status</caption>
                  <thead hlmTHead>
                    <tr hlmTr>
                      <th hlmTh scope="col">Username</th>
                      <th hlmTh scope="col">Role</th>
                      <th hlmTh scope="col">Status</th>
                      <th hlmTh scope="col">Created</th>
                      <th hlmTh scope="col">Updated</th>
                      <th hlmTh scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody hlmTBody>
                    @for (user of usersService.users(); track user.id) {
                      @if (editingUserId() === user.id) {
                        <tr hlmTr>
                          <td hlmTd colspan="6">
                            <form
                              class="flex flex-wrap items-start gap-4 py-2"
                              [formRoot]="editForm"
                              (submit)="onSaveEdit($event, user)"
                              novalidate
                            >
                              <div hlmField class="min-w-48 flex-1">
                                <label hlmFieldLabel [for]="'edit-username-' + user.id">Username</label>
                                <input
                                  hlmInput
                                  [id]="'edit-username-' + user.id"
                                  type="text"
                                  autocomplete="off"
                                  [formField]="editForm.username"
                                />
                                @for (error of editForm.username().errors(); track error.kind) {
                                  <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
                                }
                              </div>
                              <div hlmField class="w-40">
                                <label hlmFieldLabel [for]="'edit-role-' + user.id">Role</label>
                                <hlm-native-select
                                  [id]="'edit-role-' + user.id"
                                  selectClass="h-8 ps-2.5 text-sm"
                                  [formField]="editForm.role"
                                >
                                  <option hlmNativeSelectOption value="user">User</option>
                                  <option hlmNativeSelectOption value="admin">Admin</option>
                                </hlm-native-select>
                              </div>
                              <div class="flex items-end gap-2">
                                <button hlmBtn type="submit" size="sm" [disabled]="editBusy()">
                                  {{ editBusy() ? 'Saving…' : 'Save' }}
                                </button>
                                <button hlmBtn type="button" variant="outline" size="sm" (click)="cancelEdit()">
                                  Cancel
                                </button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      } @else {
                        <tr hlmTr>
                          <td hlmTd>{{ user.username }}</td>
                          <td hlmTd>{{ user.role }}</td>
                          <td hlmTd>
                            <span hlmBadge [variant]="user.enabled ? 'default' : 'secondary'">
                              {{ user.enabled ? 'Enabled' : 'Disabled' }}
                            </span>
                          </td>
                          <td hlmTd>{{ formatTimestamp(user.createdAt) }}</td>
                          <td hlmTd>{{ formatTimestamp(user.updatedAt) }}</td>
                          <td hlmTd>
                            <div class="flex flex-wrap gap-2">
                              <button hlmBtn type="button" variant="outline" size="sm" (click)="startEdit(user)">
                                Edit<span class="sr-only"> {{ user.username }}</span>
                              </button>
                              <button hlmBtn type="button" variant="outline" size="sm" (click)="onToggleEnabled(user)">
                                {{ user.enabled ? 'Disable' : 'Enable' }}
                                <span class="sr-only"> {{ user.username }}</span>
                              </button>
                              <button hlmBtn type="button" variant="destructive" size="sm" (click)="onRemove(user)">
                                Remove<span class="sr-only"> {{ user.username }}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>

              @if (!usersService.isSearchActive()) {
                <nav hlmPagination class="justify-between">
                  <p class="text-muted-foreground text-sm">
                    Page {{ usersService.pageIndex() + 1 }} of {{ usersService.totalPages() }}
                    ({{ usersService.totalCount() }} user{{ usersService.totalCount() === 1 ? '' : 's' }})
                  </p>
                  <ul hlmPaginationContent>
                    <li hlmPaginationItem>
                      <button
                        hlmBtn
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        [disabled]="!usersService.hasPrevPage()"
                        aria-label="Go to previous page"
                        (click)="usersService.prevPage()"
                      >
                        <ng-icon name="lucideChevronLeft" />
                      </button>
                    </li>
                    <li hlmPaginationItem>
                      <button
                        hlmBtn
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        [disabled]="!usersService.hasNextPage()"
                        aria-label="Go to next page"
                        (click)="usersService.nextPage()"
                      >
                        <ng-icon name="lucideChevronRight" />
                      </button>
                    </li>
                  </ul>
                </nav>
              }
            }
          </div>
        </section>
      </main>
    </div>
  `,
})
export class ManageUsers {
  protected readonly usersService = inject(Users);
  private readonly authService = inject(Auth);
  protected readonly theme = inject(ThemeService);
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
