import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ManageUsers } from './manage-users';

type SnapshotListener = (snapshot: { docs: { id: string; data: () => Record<string, unknown> }[] }) => void;

interface FakeQueryDescriptor {
  where?: { field: string; value: unknown };
  rangeStart?: string;
  rangeEnd?: string;
}

const USERS_FIXTURE = [
  { id: '1', username: 'ada', role: 'admin', enabled: true, createdAt: null, updatedAt: null },
  { id: '2', username: 'grace', role: 'user', enabled: false, createdAt: null, updatedAt: null },
];

function toDoc(user: (typeof USERS_FIXTURE)[number]) {
  return { id: user.id, data: () => user };
}

const { addDocMock, onSnapshotMock, getDocsMock } = vi.hoisted(() => ({
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
  getDocsMock: vi.fn((descriptor: FakeQueryDescriptor) => {
    let results = USERS_FIXTURE;
    if (descriptor.where) {
      results = results.filter(
        (user) => (user as unknown as Record<string, unknown>)[descriptor.where!.field] === descriptor.where!.value,
      );
    }
    if (descriptor.rangeStart !== undefined && descriptor.rangeEnd !== undefined) {
      results = results.filter(
        (user) => user.username >= descriptor.rangeStart! && user.username <= descriptor.rangeEnd!,
      );
    }
    return Promise.resolve({ docs: results.map(toDoc) });
  }),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string, id: string) => ({ path, id })),
  query: vi.fn((ref: FakeQueryDescriptor, ...constraints: Array<(d: FakeQueryDescriptor) => void>) => {
    const next = { ...ref };
    constraints.forEach((apply) => apply(next));
    return next;
  }),
  orderBy: vi.fn(() => () => {}),
  where: vi.fn(
    (field: string, _op: string, value: unknown) => (d: FakeQueryDescriptor) => {
      d.where = { field, value };
    },
  ),
  startAt: vi.fn((value: string) => (d: FakeQueryDescriptor) => {
    d.rangeStart = value;
  }),
  endAt: vi.fn((value: string) => (d: FakeQueryDescriptor) => {
    d.rangeEnd = value;
  }),
  startAfter: vi.fn(() => () => {}),
  limit: vi.fn(() => () => {}),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: USERS_FIXTURE.length }) })),
  onSnapshot: onSnapshotMock,
  getDocs: getDocsMock,
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

  it('filters the list when searching', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(ManageUsers);
      fixture.detectChanges();

      const search = fixture.nativeElement.querySelector('#search') as HTMLInputElement;
      search.value = 'admin';
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // The search term is debounced before it triggers a query.
      await vi.advanceTimersByTimeAsync(300);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('ada');
      expect(compiled.textContent).not.toContain('grace');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders the add-user form', () => {
    const fixture = TestBed.createComponent(ManageUsers);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#new-username')).toBeTruthy();
    expect(compiled.querySelector('#new-role')).toBeTruthy();
  });
});
