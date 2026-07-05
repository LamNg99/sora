import { useCallback, useEffect, useRef } from 'react';
import { useDialog } from '../providers/dialog';
import { useTheme } from '../providers/theme';
import { DialogSearchList } from '../components/dialog-search-list';
import { THEMES, type Theme } from '../theme';

export const ThemeDialogContent = () => {
  const dialog = useDialog();
  const { theme, setTheme } = useTheme();
  const originalThemeRef = useRef(theme);
  const confirmedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (!confirmedRef.current) {
        setTheme(originalThemeRef.current);
      }
    };
  }, [setTheme]);

  const handleSelect = useCallback(
    (theme: Theme) => {
      confirmedRef.current = true;
      setTheme(theme);
      dialog.close();
    },
    [setTheme, dialog],
  );

  const handleHighlight = useCallback(
    (theme: Theme) => {
      setTheme(theme);
    },
    [setTheme],
  );

  return (
    <DialogSearchList
      items={THEMES}
      onSelect={handleSelect}
      onHightlight={handleHighlight}
      filterFn={(theme, query) => theme.name.toLowerCase().includes(query.toLowerCase())}
      renderItem={(theme, isSelected) => (
        <text selectable={false} fg={isSelected ? 'black' : 'white'}>
          {theme.name === originalThemeRef.current.name
            ? '\u0020\u203A\u0020'
            : '\u0020\u0020\u0020'}
          {theme.name}
        </text>
      )}
      getKey={(theme) => theme.name}
      placeholder="Search themes"
      emptyText="No matching themes"
    />
  );
};
