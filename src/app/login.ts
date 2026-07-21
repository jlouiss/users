import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  email,
  minLength,
  required,
  schema,
  submit,
  form,
} from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';

import { Auth } from './auth';

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
  imports: [FormField],
  template: `
    <div class="login-page">
      <form class="login-card" (submit)="onSubmit($event)" novalidate>
        <h1>Manage Users</h1>
        <p class="subtitle">
          {{ mode() === 'signin' ? 'Sign in to continue' : 'Create an account to continue' }}
        </p>

        @if (errorMessage()) {
          <p class="form-error" role="alert">{{ errorMessage() }}</p>
        }

        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            autocomplete="email"
            [formField]="loginForm.email"
            [attr.aria-invalid]="loginForm.email().invalid() && loginForm.email().touched()"
            [attr.aria-describedby]="
              loginForm.email().invalid() && loginForm.email().touched() ? 'email-error' : null
            "
          />
          @if (loginForm.email().touched() && loginForm.email().invalid()) {
            <p id="email-error" class="field-error" role="alert">
              {{ loginForm.email().errors()[0]?.message }}
            </p>
          }
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            [autocomplete]="mode() === 'signin' ? 'current-password' : 'new-password'"
            [formField]="loginForm.password"
            [attr.aria-invalid]="loginForm.password().invalid() && loginForm.password().touched()"
            [attr.aria-describedby]="
              loginForm.password().invalid() && loginForm.password().touched()
                ? 'password-error'
                : null
            "
          />
          @if (loginForm.password().touched() && loginForm.password().invalid()) {
            <p id="password-error" class="field-error" role="alert">
              {{ loginForm.password().errors()[0]?.message }}
            </p>
          }
        </div>

        <button type="submit" class="primary-button" [disabled]="busy()">
          @if (busy()) {
            {{ mode() === 'signin' ? 'Signing in…' : 'Creating account…' }}
          } @else {
            {{ mode() === 'signin' ? 'Sign in' : 'Create account' }}
          }
        </button>

        <button type="button" class="link-button" [disabled]="busy()" (click)="toggleMode()">
          {{
            mode() === 'signin'
              ? "Don't have an account? Create one"
              : 'Already have an account? Sign in'
          }}
        </button>

        <div class="divider" role="separator" aria-label="Or">
          <span>or</span>
        </div>

        <button
          type="button"
          class="google-button"
          [disabled]="busy()"
          (click)="onGoogleSignIn()"
          aria-label="Sign in with Google"
        >
          <img src="sign-in-light.svg" alt="" width="180" height="40" />
        </button>
      </form>
    </div>
  `,
  styles: `
    .login-page {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      background: #f4f5f7;
    }

    .login-card {
      width: 100%;
      max-width: 22rem;
      background: #fff;
      border-radius: 0.75rem;
      box-shadow:
        0 1px 2px rgba(0, 0, 0, 0.06),
        0 8px 24px rgba(0, 0, 0, 0.08);
      padding: 2rem;
      box-sizing: border-box;
    }

    h1 {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 600;
      color: #111827;
    }

    .subtitle {
      margin: 0.25rem 0 1.5rem;
      color: #6b7280;
      font-size: 0.9rem;
    }

    .field {
      margin-bottom: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    input {
      font: inherit;
      padding: 0.55rem 0.7rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      color: #111827;
    }

    input:focus-visible {
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
      margin-bottom: 1rem;
    }

    .primary-button {
      width: 100%;
      font: inherit;
      font-weight: 600;
      padding: 0.6rem 1rem;
      border: none;
      border-radius: 0.5rem;
      background: #2563eb;
      color: #fff;
      cursor: pointer;
    }

    .primary-button:hover:not(:disabled) {
      background: #1d4ed8;
    }

    .primary-button:disabled,
    .google-button:disabled,
    .link-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .link-button {
      display: block;
      width: 100%;
      margin-top: 0.75rem;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      background: none;
      border: none;
      color: #2563eb;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
      text-align: center;
    }

    .link-button:hover:not(:disabled) {
      color: #1d4ed8;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.25rem 0;
      color: #9ca3af;
      font-size: 0.8125rem;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }

    .google-button {
      display: block;
      width: 180px;
      max-width: 100%;
      margin: 0 auto;
      padding: 0;
      border: none;
      border-radius: 0.5rem;
      background: none;
      line-height: 0;
      cursor: pointer;
    }

    .google-button img {
      display: block;
      width: 100%;
      height: auto;
    }

    .google-button:hover:not(:disabled) img {
      filter: brightness(0.97);
    }

    button:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
  `,
})
export class Login {
  private readonly authService = inject(Auth);
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
