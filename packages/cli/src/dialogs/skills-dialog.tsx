import { TextAttributes } from '@opentui/core';
import { useDialog } from '../providers/dialog';
import { usePromptConfig } from '../providers/prompt-config';
import { DialogSearchList } from '../components/dialog-search-list';
import type { Skill } from '../lib/skills';

export function SkillsDialogContent() {
  const dialog = useDialog();
  const { availableSkills, loadedSkillNames, toggleSkill } = usePromptConfig();

  if (availableSkills.length === 0) {
    return (
      <box flexDirection="column" gap={1} paddingX={1}>
        <text attributes={TextAttributes.DIM}>No skills found.</text>
        <text attributes={TextAttributes.DIM}>
          Add .md files to ~/.sora/skills/ or .sora/skills/
        </text>
      </box>
    );
  }

  const handleSelect = (skill: Skill) => {
    toggleSkill(skill.name);
    dialog.close();
  };

  return (
    <DialogSearchList
      items={availableSkills}
      onSelect={handleSelect}
      filterFn={(skill, query) =>
        skill.name.toLowerCase().includes(query.toLowerCase()) ||
        (skill.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      }
      renderItem={(skill, isSelected) => {
        const loaded = loadedSkillNames.has(skill.name);
        return (
          <box flexDirection="row" gap={2} paddingX={1} width="100%">
            <box width={2} flexShrink={0}>
              <text selectable={false} fg={loaded ? 'green' : isSelected ? 'black' : 'gray'}>
                {loaded ? '✓' : ' '}
              </text>
            </box>
            <box flexShrink={0} width={22}>
              <text selectable={false} fg={isSelected ? 'black' : 'white'}>
                {skill.name}
              </text>
            </box>
            <box flexGrow={1} flexShrink={1} overflow="hidden">
              <text selectable={false} fg={isSelected ? 'black' : 'gray'} attributes={TextAttributes.DIM}>
                {skill.description ?? (skill.source === 'project' ? 'project' : 'global')}
              </text>
            </box>
          </box>
        );
      }}
      getKey={(skill) => skill.name}
      placeholder="Search skills"
      emptyText="No matching skills"
    />
  );
}
