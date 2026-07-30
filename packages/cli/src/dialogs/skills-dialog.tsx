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
        const indicator = loaded ? '✓' : ' ';
        const label = skill.name.padEnd(24);
        const meta = skill.description ?? skill.source;
        return (
          <text
            selectable={false}
            fg={isSelected ? 'black' : loaded ? 'green' : 'white'}
          >
            {`${indicator} ${label} ${meta}`}
          </text>
        );
      }}
      getKey={(skill) => skill.name}
      placeholder="Search skills"
      emptyText="No matching skills"
    />
  );
}
