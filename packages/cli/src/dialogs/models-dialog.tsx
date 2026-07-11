import { useCallback } from 'react';
import { useDialog } from '../providers/dialog';
import { DialogSearchList } from '../components/dialog-search-list';
import type { SupportedChatModelId } from '@sora/shared';

type ModelsDialogContentProps = {
  models: SupportedChatModelId[];
  onSelectModel: (model: SupportedChatModelId) => void;
};

export const ModelsDialogContent = ({ models, onSelectModel }: ModelsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (nextModel: SupportedChatModelId) => {
      onSelectModel(nextModel);
      dialog.close();
    },
    [onSelectModel, dialog],
  );

  return (
    <DialogSearchList
      items={models}
      onSelect={handleSelect}
      filterFn={(model, query) => model.toLowerCase().includes(query.toLowerCase())}
      renderItem={(model, isSelected) => (
        <text selectable={false} fg={isSelected ? 'black' : 'white'}>
          {model}
        </text>
      )}
      getKey={(model) => model}
      placeholder="Search models"
      emptyText="No matching models"
    />
  );
};
