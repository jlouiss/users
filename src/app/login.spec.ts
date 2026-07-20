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
    expect(compiled.querySelector('button.google-button')?.textContent).toContain(
      'Sign in with Google',
    );
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
    expect(compiled.querySelector('#email-error')).toBeTruthy();
    expect(compiled.querySelector('#password-error')).toBeTruthy();
  });

  it('calls Google sign-in when the Google button is clicked', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const authService = TestBed.inject(Auth);
    const spy = vi.spyOn(authService, 'signInWithGoogle').mockResolvedValue();

    (fixture.nativeElement.querySelector('button.google-button') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('switches to sign-up mode and creates an account on submit', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const authService = TestBed.inject(Auth);
    const spy = vi.spyOn(authService, 'signUpWithEmail').mockResolvedValue();

    (fixture.nativeElement.querySelector('button.link-button') as HTMLButtonElement).click();
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
