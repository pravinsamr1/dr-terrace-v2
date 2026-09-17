import React, { createContext } from 'react';

// Dark mode has been removed. The app is permanently locked to light mode.
// All isDark checks across the codebase will evaluate to false.
const ThemeCustomContext = createContext({
  theme: 'light',
  colorScheme: 'light',
  setTheme: () => { },
});

export function ThemeCustomProvider({ children }) {
  return (
    <ThemeCustomContext.Provider value={{ theme: 'light', colorScheme: 'light', setTheme: () => { } }}>
      {children}
    </ThemeCustomContext.Provider>
  );
}

export function useColorScheme() {
  return 'light';
}

export function useThemeCustom() {
  return { theme: 'light', colorScheme: 'light', setTheme: () => { } };
}

export function useToggleTheme() {
  return () => { };
}
