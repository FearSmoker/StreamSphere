import PropTypes from 'prop-types';
import { createContext, useContext, useState, useMemo } from 'react';

const ThemeContext = createContext(null);

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}

ThemeModeProvider.propTypes = {
  children: PropTypes.node,
};

export function ThemeModeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    return saved === 'light' ? 'light' : 'dark';
  });

  const toggleThemeMode = () => {
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('themeMode', next);
      return next;
    });
  };

  const memoizedValue = useMemo(
    () => ({
      themeMode,
      toggleThemeMode,
    }),
    [themeMode]
  );

  return (
    <ThemeContext.Provider value={memoizedValue}>
      {children}
    </ThemeContext.Provider>
  );
}
