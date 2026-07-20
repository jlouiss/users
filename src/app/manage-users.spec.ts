import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ManageUsers } from './manage-users';

type SnapshotListener = (snapshot: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void;

const { addDocMock, onSnapshotMock } = vi.hoisted(() => ({
  addDocMock: vi.fn(() => Promise.resolve({ id: 'new-id' })),
  onSnapshotMock: vi.fn((_query: unknown, onNext: SnapshotListener) => {
    onNext({
      docs: [
        {
          id: '1',
          data: () => ({ username: 'ada', role: 'admin', enabled: true, createdAt: null, updatedAt: null }),
        },
        {
          id: '2',
          data: () => ({ username: 'grace', role: 'user', enabled: false, createdAt: null, updatedAt: null }),
        },
      ],
    });
    return vi.fn();
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string, id: string) => ({ path, id })),
  query: vi.fn((ref: unknown) => ref),
  orderBy: vi.fn(),
  onSnapshot: onSnapshotMock,
  addDoc: addDocMock,
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((_auth: unknown, listener: (user: null) => void) => {
    listener(null);
    return vi.fn();
  }),
  signOut: vi.fn(() => Promise.resolve()),
}));

describe('ManageUsers', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ManageUsers],
      providers: [provideRouter([])],
    });
  });

  it('lists users from the realtime subscription', () => {
    const fixture = TestBed.createComponent(ManageUsers);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('ada');
    expect(compiled.textContent).toContain('grace');
    expect(compiled.textContent).toContain('Enabled');
    expect(compiled.textContent).toContain('Disabled');
  });

  it('filters the list when searching', () => {
    const fixture = TestBed.createComponent(ManageUsers);
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('#search') as HTMLInputElement;
    search.value = 'admin';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('ada');
    expect(compiled.textContent).not.toContain('grace');
  });

  it('renders the add-user form', () => {
    const fixture = TestBed.createComponent(ManageUsers);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#new-username')).toBeTruthy();
    expect(compiled.querySelector('#new-role')).toBeTruthy();
  });
});
