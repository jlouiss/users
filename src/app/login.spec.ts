import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Auth } from './auth';
import { Login } from './login';

@Component({ selector: 'app-dummy-users-page', template: '' })
class DummyUsersPage {}

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}));

describe('Login', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([{ path: 'users', component: DummyUsersPage }])],
    });
  });

  it('renders the sign-in form', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('input#email')).toBeTruthy();
    expect(compiled.querySelector('input#password')).toBeTruthy();
    const googleButton = compiled.querySelector('button[aria-label="Sign in with Google"]');
    expect(googleButton).toBeTruthy();
    expect(googleButton?.querySelector('img')).toBeTruthy();
  });

  it('shows validation errors once the form is touched and submitted', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Email is required.');
    expect(compiled.textContent).toContain('Password is required.');
  });

  it('calls Google sign-in when the Google button is clicked', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const authService = TestBed.inject(Auth);
    const spy = vi.spyOn(authService, 'signInWithGoogle').mockResolvedValue();

    (
      fixture.nativeElement.querySelector('button[aria-label="Sign in with Google"]') as HTMLButtonElement
    ).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('switches to sign-up mode and creates an account on submit', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const authService = TestBed.inject(Auth);
    const spy = vi.spyOn(authService, 'signUpWithEmail').mockResolvedValue();

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const toggleButton = Array.from(buttons).find((button) =>
      button.textContent?.includes('Create one'),
    ) as HTMLButtonElement;
    toggleButton.click();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('button[type="submit"]')?.textContent).toContain(
      'Create account',
    );

    const emailInput = compiled.querySelector('#email') as HTMLInputElement;
    const passwordInput = compiled.querySelector('#password') as HTMLInputElement;
    emailInput.value = 'new@example.com';
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'secret1';
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = compiled.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(spy).toHaveBeenCalledWith('new@example.com', 'secret1');
  });
});
