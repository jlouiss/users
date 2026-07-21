import { Service, effect, signal } from '@angular/core';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

@Service()
export class ThemeService {
  private readonly themeSignal = signal<Theme>(initialTheme());

  readonly theme = this.themeSignal.asReadonly();

  constructor() {
    effect(() => {
      const theme = this.themeSignal();
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem(STORAGE_KEY, theme);
    });
  }

  toggle(): void {
    this.themeSignal.set(this.themeSignal() === 'dark' ? 'light' : 'dark');
  }
}
