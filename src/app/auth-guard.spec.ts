import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type RouterStateSnapshot } from '@angular/router';

import { Auth } from './auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  function setup(currentUser: { uid: string } | null | undefined, readyUser: { uid: string } | null = null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { currentUser: () => currentUser, ready: Promise.resolve(readyUser) } },
      ],
    });
  }

  it('allows navigation when the live signal already has a signed-in user', async () => {
    setup({ uid: '1' });
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/users' } as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('redirects to /login with a returnUrl when the live signal is signed out', async () => {
    setup(null);
    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/users' } as RouterStateSnapshot),
    );
    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/login?returnUrl=%2Fusers',
    );
  });

  it('falls back to the ready promise while the initial auth state is still pending', async () => {
    setup(undefined, { uid: '1' });
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/users' } as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });
});
