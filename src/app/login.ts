import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  FormRoot,
  email,
  minLength,
  required,
  schema,
  submit,
  form,
} from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';

import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';

import { Auth } from './auth';
import { ThemeService } from './theme';

type Mode = 'signin' | 'signup';

interface LoginModel {
  email: string;
  password: string;
}

const loginSchema = schema<LoginModel>((path) => {
  required(path.email, { message: 'Email is required.' });
  email(path.email, { message: 'Enter a valid email address.' });
  required(path.password, { message: 'Password is required.' });
  minLength(path.password, 6, { message: 'Password must be at least 6 characters.' });
});

function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/internal-error':
    case 'auth/permission-denied':
      return 'This account is not authorized to access this application.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for sign-in. Contact an admin.';
    default:
      console.error('Unrecognized auth error:', error);
      return 'Something went wrong. Please try again.';
  }
}

@Component({
  selector: 'app-login',
  imports: [
    FormField,
    FormRoot,
    NgIcon,
    HlmAlertImports,
    HlmButtonImports,
    HlmCardImports,
    HlmFieldImports,
    HlmInputImports,
    HlmSeparatorImports,
    HlmSpinnerImports,
  ],
  providers: [provideIcons({ lucideMoon, lucideSun })],
  template: `
    <div class="bg-muted flex min-h-dvh items-center justify-center p-6">
      <div class="flex w-full max-w-sm flex-col gap-3">
        <div class="flex justify-end">
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
        </div>
        <section hlmCard class="w-full">
        <div hlmCardHeader>
          <h1 hlmCardTitle>Manage Users</h1>
          <p hlmCardDescription>
            {{ mode() === 'signin' ? 'Sign in to continue' : 'Create an account to continue' }}
          </p>
        </div>

        <div hlmCardContent>
          <form class="flex flex-col gap-4" [formRoot]="loginForm" (submit)="onSubmit($event)" novalidate>
            @if (errorMessage()) {
              <div hlmAlert variant="destructive" role="alert">
                <p hlmAlertDescription>{{ errorMessage() }}</p>
              </div>
            }

            <div hlmField>
              <label hlmFieldLabel for="email">Email</label>
              <input hlmInput id="email" type="email" autocomplete="email" [formField]="loginForm.email" />
              @for (error of loginForm.email().errors(); track error.kind) {
                <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
              }
            </div>

            <div hlmField>
              <label hlmFieldLabel for="password">Password</label>
              <input
                hlmInput
                id="password"
                type="password"
                [autocomplete]="mode() === 'signin' ? 'current-password' : 'new-password'"
                [formField]="loginForm.password"
              />
              @for (error of loginForm.password().errors(); track error.kind) {
                <hlm-field-error [validator]="error.kind">{{ error.message }}</hlm-field-error>
              }
            </div>

            <button hlmBtn type="submit" class="w-full" [disabled]="busy()">
              @if (busy()) {
                <hlm-spinner />
              }
              {{
                busy()
                  ? mode() === 'signin'
                    ? 'Signing in…'
                    : 'Creating account…'
                  : mode() === 'signin'
                    ? 'Sign in'
                    : 'Create account'
              }}
            </button>

            <button
              hlmBtn
              type="button"
              variant="link"
              class="w-full"
              [disabled]="busy()"
              (click)="toggleMode()"
            >
              {{
                mode() === 'signin'
                  ? "Don't have an account? Create one"
                  : 'Already have an account? Sign in'
              }}
            </button>
          </form>

          <div class="my-5 flex items-center gap-3" role="separator" aria-label="Or">
            <hlm-separator class="flex-1" />
            <span class="text-muted-foreground text-xs">or</span>
            <hlm-separator class="flex-1" />
          </div>

          <button
            hlmBtn
            type="button"
            variant="outline"
            class="mx-auto block h-auto w-fit p-0"
            [disabled]="busy()"
            (click)="onGoogleSignIn()"
            aria-label="Sign in with Google"
          >
            <img src="sign-in-light.svg" alt="" width="180" height="40" />
          </button>
        </div>
        </section>
      </div>
    </div>
  `,
})
export class Login {
  private readonly authService = inject(Auth);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode = signal<Mode>('signin');
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly model = signal<LoginModel>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, loginSchema);

  private get returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') || '/users';
  }

  toggleMode(): void {
    this.mode.set(this.mode() === 'signin' ? 'signup' : 'signin');
    this.errorMessage.set(null);
    this.model.update((value) => ({ ...value, password: '' }));
    this.loginForm().reset();
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.busy.set(true);

    let signedIn = false;
    try {
      await submit(this.loginForm, async () => {
        if (this.mode() === 'signin') {
          await this.authService.signInWithEmail(this.model().email, this.model().password);
        } else {
          await this.authService.signUpWithEmail(this.model().email, this.model().password);
        }
        signedIn = true;
      });
    } catch (error) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }

    if (signedIn) {
      await this.router.navigateByUrl(this.returnUrl);
    }
  }

  async onGoogleSignIn(): Promise<void> {
    this.errorMessage.set(null);
    this.busy.set(true);
    try {
      await this.authService.signInWithGoogle();
      await this.router.navigateByUrl(this.returnUrl);
    } catch (error) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
