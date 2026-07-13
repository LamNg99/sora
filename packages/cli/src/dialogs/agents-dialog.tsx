import { useCallback } from 'react';
import { useDialog } from '../providers/dialog';
import { DialogSearchList } from '../components/dialog-search-list';
import { Mode, type ModeType } from '@sora/shared';

const AVAILABLE_MODES: ModeType[] = [Mode.ASK, Mode.AGENT];

type AgentsDialogContentProps = {
  currentMode: ModeType;
  onSelectMode: (mode: ModeType) => void;
};

function getModeLabel(mode: ModeType): string {
  return mode === Mode.ASK ? 'Ask' : 'Agent';
}

export const AgentsDialogContent = ({ currentMode, onSelectMode }: AgentsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (nextMode: ModeType) => {
      onSelectMode(nextMode);
      dialog.close();
    },
    [onSelectMode, dialog],
  );

  return (
    <DialogSearchList
      items={AVAILABLE_MODES}
      onSelect={handleSelect}
      filterFn={(mode, query) => getModeLabel(mode).toLowerCase().includes(query.toLowerCase())}
      renderItem={(mode, isSelected) => (
        <text selectable={false} fg={isSelected ? 'black' : 'white'}>
          {mode === currentMode ? '\u0020\u203A\u0020' : '\u0020\u0020\u0020'}
          {getModeLabel(mode)}
        </text>
      )}
      getKey={(mode) => getModeLabel(mode)}
      placeholder="Search modes"
      emptyText="No matching modes"
    />
  );
};
