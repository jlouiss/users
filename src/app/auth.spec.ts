import { TestBed } from '@angular/core/testing';

import { Auth } from './auth';

type AuthStateListener = (user: { uid: string; email: string } | null) => void;

const { onAuthStateChangedMock, signInWithPopupMock, signInWithEmailAndPasswordMock, signOutMock } = vi.hoisted(
  () => ({
    onAuthStateChangedMock: vi.fn((_auth: unknown, listener: AuthStateListener) => {
      listener(null);
      return vi.fn();
    }),
    signInWithPopupMock: vi.fn(() => Promise.resolve()),
    signInWithEmailAndPasswordMock: vi.fn(() => Promise.resolve()),
    signOutMock: vi.fn(() => Promise.resolve()),
  }),
);

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: onAuthStateChangedMock,
  signInWithPopup: signInWithPopupMock,
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signOut: signOutMock,
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}));

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangedMock.mockImplementation((_auth: unknown, listener: AuthStateListener) => {
      listener(null);
      return vi.fn();
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(Auth);
  });

  it('starts signed out once the initial auth state resolves', async () => {
    await expect(service.ready).resolves.toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('updates currentUser when the auth state changes', () => {
    const listener = onAuthStateChangedMock.mock.calls[0][1] as AuthStateListener;
    const user = { uid: '1', email: 'a@b.com' };
    listener(user);
    expect(service.currentUser()).toBe(user);
  });

  it('delegates Google sign-in to the SDK', async () => {
    await service.signInWithGoogle();
    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
  });

  it('delegates email/password sign-in to the SDK', async () => {
    await service.signInWithEmail('a@b.com', 'secret');
    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(expect.anything(), 'a@b.com', 'secret');
  });

  it('delegates sign-out to the SDK', async () => {
    await service.signOut();
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
