import { useRef, useCallback, useEffect, type RefObject, useState } from 'react';
import { readdir } from 'fs/promises';
import { isAbsolute, relative, resolve } from 'path';
import { TextAttributes } from '@opentui/core';
import type { TextareaRenderable, ScrollBoxRenderable } from '@opentui/core';
import { useKeyboard, useRenderer } from '@opentui/react';
import type { KeyBinding } from '@opentui/core';
import { useNavigate } from 'react-router';
import { StatusBar } from './status-bar';
import { CommandMenu } from './command-menu';
import type { Command } from './command-menu/types';
import { useCommandMenu } from './command-menu/use-command-menu';
import { useToast } from '../providers/toast';
import { useKeyboardLayer } from '../providers/keyboard-layer';
import { useDialog } from '../providers/dialog';
import { useTheme } from '../providers/theme';
import { usePromptConfig } from '../providers/prompt-config';

const MAX_VISIBLE_MENTIONS = 8;
const CURRENT_DIRECTORY = process.cwd();
const MAX_FALLBACK_MENTION_CANDIDATES = 32;
const MENTION_QUERY_CHARACTERS = /[A-Za-z0-9._/-]/;
const RECURSIVE_MENTION_IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.DS_Store',
  'dist',
  'build',
  'out',
]);

type MentionMatch = {
  start: number;
  end: number;
  query: string;
};

type MentionCandidate = {
  path: string;
  kind: 'file' | 'directory';
};

function isWithinCurrentDirectory(targetPath: string): boolean {
  const relativePath = relative(CURRENT_DIRECTORY, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

function isMentionQueryCharacter(char: string): boolean {
  return MENTION_QUERY_CHARACTERS.test(char);
}

function findActiveMention(text: string, currentOffset: number): MentionMatch | null {
  const safeOffset = Math.max(0, Math.min(currentOffset, text.length));

  let start = safeOffset;

  while (start > 0 && !/\s/.test(text[start - 1]!)) {
    start -= 1;
  }

  let end = safeOffset;
  while (end < text.length && !/\s/.test(text[end]!)) {
    end += 1;
  }

  const token = text.slice(start, end);
  const relativeCusor = safeOffset - start;
  const mentionStart = token.lastIndexOf('@', relativeCusor);

  if (mentionStart === -1) {
    return null;
  }

  const previousChracter = token[mentionStart - 1];
  if (previousChracter && isMentionQueryCharacter(previousChracter)) {
    return null;
  }

  let mentionEnd = mentionStart + 1;

  while (mentionEnd < token.length && isMentionQueryCharacter(token[mentionEnd]!)) {
    mentionEnd += 1;
  }

  if (relativeCusor < mentionStart || relativeCusor > mentionEnd) {
    return null;
  }

  return {
    start: start + mentionStart,
    end: start + mentionEnd,
    query: token.slice(mentionStart + 1, mentionEnd),
  };
}

async function getMentionCandidates(query: string): Promise<MentionCandidate[]> {
  const normalizedQuery = query.startsWith('/') ? query.slice(2) : query;
  if (normalizedQuery.startsWith('/')) {
    return [];
  }

  const hasTrailingSlash = normalizedQuery.endsWith('/');
  const lastSlashIndex = hasTrailingSlash
    ? normalizedQuery.length - 1
    : normalizedQuery.lastIndexOf('/');

  const directoryPath = hasTrailingSlash
    ? normalizedQuery.slice(0, -1)
    : lastSlashIndex === -1
      ? ''
      : normalizedQuery.slice(0, lastSlashIndex);

  const namePrefix = hasTrailingSlash
    ? ''
    : lastSlashIndex === -1
      ? normalizedQuery
      : normalizedQuery.slice(lastSlashIndex + 1);

  const absoluteDirectory = resolve(CURRENT_DIRECTORY, directoryPath || '.');
  if (!isWithinCurrentDirectory(absoluteDirectory)) {
    return [];
  }

  try {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    const lowercasePrefix = namePrefix.toLowerCase();
    const showHiddenEntries = namePrefix.startsWith('.');

    const directMatches = entries
      .filter((entry) => showHiddenEntries || !entry.name.startsWith('.'))
      .filter(
        (entry) => !entry.isDirectory() || !RECURSIVE_MENTION_IGNORED_DIRECTORIES.has(entry.name),
      )
      .filter((entry) => {
        return lowercasePrefix === '' || entry.name.toLowerCase().startsWith(lowercasePrefix);
      })
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      })
      .map((entry) => {
        const path = directoryPath ? `${directoryPath}/${entry.name}` : entry.name;
        const kind: MentionCandidate['kind'] = entry.isDirectory() ? 'directory' : 'file';
        return { path: kind === 'directory' ? `${path}/` : path, kind };
      });

    if (directMatches.length > 0 || directoryPath !== '' || namePrefix === '') {
      return directMatches;
    }

    const FallbackMatches: MentionCandidate[] = [];
    const visit = async (absoluteDirectory: string, directoryPath: string): Promise<void> => {
      const entries = await readdir(absoluteDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!showHiddenEntries && entry.name.startsWith('.')) {
          continue;
        }

        if (entry.isDirectory() && RECURSIVE_MENTION_IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        const path = directoryPath ? `${directoryPath}/${entry.name}` : entry.name;
        const kind: MentionCandidate['kind'] = entry.isDirectory() ? 'directory' : 'file';

        if (entry.name.toLowerCase().startsWith(lowercasePrefix)) {
          FallbackMatches.push({ path: kind === 'directory' ? `${path}/` : path, kind });
        }

        if (FallbackMatches.length >= MAX_FALLBACK_MENTION_CANDIDATES) {
          return;
        }

        if (entry.isDirectory()) {
          await visit(resolve(absoluteDirectory, entry.name), path);
          if (FallbackMatches.length >= MAX_FALLBACK_MENTION_CANDIDATES) {
            return;
          }
        }
      }
    };

    await visit(CURRENT_DIRECTORY, '');
    return FallbackMatches.sort((left, right) => left.path.localeCompare(right.path));
  } catch {
    // If we can't read the directory (e.g., permission denied), return an empty list.
    return [];
  }
}

type FileMentionMenuProps = {
  candidates: MentionCandidate[];
  selectedIndex: number;
  scrollRef: RefObject<ScrollBoxRenderable | null>;
  onSelect: (index: number) => void;
  onExecute: (index: number) => void;
};

function FileMentionMenu({
  candidates,
  selectedIndex,
  scrollRef,
  onSelect,
  onExecute,
}: FileMentionMenuProps) {
  const { colors } = useTheme();
  const visibleHeight = Math.min(candidates.length, MAX_VISIBLE_MENTIONS);

  if (candidates.length === 0) {
    return (
      <box paddingX={1}>
        <text attributes={TextAttributes.DIM}>No matching files or directories</text>
      </box>
    );
  }

  return (
    <scrollbox ref={scrollRef} height={visibleHeight}>
      {candidates.map((candidate, index) => {
        const isSelected = index === selectedIndex;
        return (
          <box
            key={candidate.path}
            flexDirection="row"
            paddingX={1}
            height={1}
            overflow="hidden"
            backgroundColor={isSelected ? colors.selected : undefined}
            onMouseMove={() => onSelect(index)}
            onMouseDown={() => onExecute(index)}
          >
            <box flexGrow={1} flexShrink={1} overflow="hidden">
              <text selectable={false} fg={isSelected ? 'back' : 'white'}>
                {candidate.path}
              </text>
            </box>

            <box width={8} alignItems="flex-end" flexShrink={0}>
              <text selectable={false} fg={isSelected ? 'back' : 'gray'}>
                {candidate.kind === 'directory' ? 'Folder' : 'File'}
              </text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
  { name: 'return', action: 'submit' },
  { name: 'enter', action: 'submit' },
  { name: 'return', shift: true, action: 'newline' },
  { name: 'enter', shift: true, action: 'newline' },
];

export function InputBar({ onSubmit, disabled = false }: Props) {
  const { mode, toggleMode, setMode, setModel } = usePromptConfig();
  const textareaRef = useRef<TextareaRenderable>(null);
  const onSubmitRef = useRef<() => void>(() => {});
  const activeMentionRef = useRef<MentionMatch | null>(null);
  const mentionScrollRef = useRef<ScrollBoxRenderable>(null);

  const renderer = useRenderer();
  const navigate = useNavigate();
  const toast = useToast();
  const dialog = useDialog();
  const { colors } = useTheme();
  const { isTopLayer, push, pop, setResponder } = useKeyboardLayer();

  const [activeMention, setActiveMention] = useState<MentionMatch | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const {
    commandQuery,
    showCommandMenu,
    selectedIndex,
    scrollRef,
    resolveCommand,
    handleContentChange,
    setSelectedIndex,
  } = useCommandMenu();

  const showMentionMenu = activeMention !== null;

  const closeMentionMenu = useCallback(() => {
    activeMentionRef.current = null;
    setActiveMention(null);
    setMentionCandidates([]);
    pop('mention');
  }, [pop]);

  const syncMentionMenu = useCallback(
    async (text: string, cursorOffset: number) => {
      const nextMention = findActiveMention(text, cursorOffset);
      const previousMention = activeMentionRef.current;

      if (!nextMention) {
        if (previousMention) {
          closeMentionMenu();
        }
        return;
      }

      const mentionChanged =
        nextMention.start !== previousMention?.start ||
        nextMention.end !== previousMention?.end ||
        nextMention.query !== previousMention?.query;

      if (!mentionChanged) {
        return;
      }

      activeMentionRef.current = nextMention;
      setActiveMention(nextMention);

      if (!previousMention) {
        push('mention', () => {
          closeMentionMenu();
          return true;
        });
      }

      setSelectedMentionIndex(0);
      mentionScrollRef.current?.scrollTo(0);
    },
    [closeMentionMenu, push],
  );

  const handleTextAreaContentChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    handleContentChange(textarea.plainText);
    syncMentionMenu(textarea.plainText, textarea.cursorOffset);
  }, [handleContentChange, syncMentionMenu]);

  const handleMentionExecute = useCallback(
    (index: number) => {
      const textarea = textareaRef.current;
      const mention = activeMentionRef.current;
      const candidate = mentionCandidates[index];

      if (!textarea || !mention || !candidate) return;

      const insertedText =
        candidate.kind === 'directory' ? `${candidate.path}` : `${candidate.path} `;

      const nextText = `${textarea.plainText.slice(0, mention.start)}@${insertedText}${textarea.plainText.slice(mention.end)}`;

      textarea.replaceText(nextText);
      textarea.cursorOffset = mention.start + 1 + insertedText.length;
      syncMentionMenu(nextText, textarea.cursorOffset);
    },
    [mentionCandidates, syncMentionMenu],
  );

  const handletextareaCursorChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    syncMentionMenu(textarea.plainText, textarea.cursorOffset);
  }, [syncMentionMenu]);

  const handleSubmit = useCallback(() => {
    if (disabled) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const text = textarea.plainText.trim();
    if (text.length === 0) return;

    onSubmit(text);
    textarea.setText('');
  }, [onSubmit, disabled]);

  const handleCommand = useCallback(
    (command: Command | undefined) => {
      const textarea = textareaRef.current;
      if (!textarea || !command) return;

      textarea.setText('');

      if (command.action) {
        command.action({
          exit: () => renderer.destroy(),
          toast,
          dialog,
          navigate,
          mode,
          setMode,
          setModel,
        });
      } else {
        textarea.insertText(command.value + ' ');
      }
    },
    [renderer, toast, dialog, navigate, mode, setMode, setModel],
  );

  const handleTextareaSubmit = useCallback(() => {
    if (disabled) return;

    if (showCommandMenu) {
      const command = resolveCommand(selectedIndex);
      handleCommand(command);
      return;
    }

    handleSubmit();
  }, [disabled, showCommandMenu, resolveCommand, selectedIndex, handleCommand, handleSubmit]);

  useEffect(() => {
    if (!activeMention) {
      setMentionCandidates([]);
      return;
    }

    let ignored = false;
    const loadCandidates = async () => {
      const nextCandidates = await getMentionCandidates(activeMention.query);
      if (ignored) return;

      setMentionCandidates(nextCandidates);
      setSelectedMentionIndex((currentIndex) => {
        if (nextCandidates.length === 0) {
          return 0;
        }
        return Math.min(currentIndex, nextCandidates.length - 1);
      });
    };

    loadCandidates();
    return () => {
      ignored = true;
    };
  }, [activeMention]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.onSubmit = () => {
      onSubmitRef.current();
    };
  }, []);

  onSubmitRef.current = () => {
    if (disabled) return;

    if (showCommandMenu) {
      const command = resolveCommand(selectedIndex);
      handleCommand(command);
      return;
    }

    if (showMentionMenu) {
      const candidate = mentionCandidates[selectedMentionIndex];
      if (candidate) {
        handleMentionExecute(selectedMentionIndex);
        return;
      }
    }
    handleSubmit();
  };

  const handleCommandExecute = useCallback(
    (index: number) => {
      const command = resolveCommand(index);
      handleCommand(command);
    },
    [resolveCommand, handleCommand],
  );

  useKeyboard((key) => {
    if (disabled) return;
    if (!isTopLayer('base')) return;
    if (key.name === 'tab') {
      key.preventDefault();
      toggleMode();
    }
  });

  // Register the base layer responder for Escape dismissal
  useEffect(() => {
    setResponder('base', () => {
      if (disabled) return false;

      const textarea = textareaRef.current;
      if (textarea && textarea.plainText.length > 0) {
        textarea.setText('');
        return true;
      }
      return false;
    });

    return () => setResponder('base', null);
  }, [disabled, setResponder]);

  useKeyboard((key) => {
    if (disabled) return;
    if (!showMentionMenu || !isTopLayer('mention')) return;

    if (key.name === 'escape') {
      key.preventDefault();
      closeMentionMenu();
    } else if (key.name === 'up') {
      key.preventDefault();
      setSelectedMentionIndex((currentIndex) => {
        const nextIndex = Math.max(0, currentIndex - 1);
        const scrollBox = mentionScrollRef.current;
        if (scrollBox && nextIndex < scrollBox.scrollTop) {
          scrollBox.scrollTo(nextIndex);
        }
        return nextIndex;
      });
    } else if (key.name === 'down') {
      key.preventDefault();
      setSelectedMentionIndex((currentIndex) => {
        if (mentionCandidates.length === 0) {
          return 0;
        }
        const nextIndex = Math.min(mentionCandidates.length - 1, currentIndex + 1);
        const scrollbox = mentionScrollRef.current;
        if (scrollbox) {
          const viewportHeight = scrollbox.viewport.height;
          const visibleEnd = scrollbox.scrollTop + viewportHeight - 1;
          if (nextIndex > visibleEnd) {
            scrollbox.scrollTo(nextIndex - viewportHeight + 1);
          }
        }
        return nextIndex;
      });
    }
  });

  return (
    <box width="100%" alignItems="center">
      <box
        position="relative"
        justifyContent="center"
        paddingX={2}
        paddingY={1}
        backgroundColor={colors.surface}
        width="100%"
        gap={1}
      >
        {showCommandMenu && (
          <box
            position="absolute"
            left={0}
            bottom="100%"
            width="100%"
            backgroundColor={colors.surface}
            zIndex={10}
          >
            <CommandMenu
              query={commandQuery}
              selectedIndex={selectedIndex}
              scrollRef={scrollRef}
              onSelect={setSelectedIndex}
              onExecute={handleCommandExecute}
            />
          </box>
        )}
        {!showCommandMenu && showMentionMenu && (
          <box
            position="absolute"
            left={0}
            bottom="100%"
            width="100%"
            backgroundColor={colors.surface}
            zIndex={10}
          >
            <FileMentionMenu
              candidates={mentionCandidates}
              selectedIndex={selectedMentionIndex}
              scrollRef={mentionScrollRef}
              onSelect={setSelectedMentionIndex}
              onExecute={handleMentionExecute}
            />
          </box>
        )}
        <textarea
          ref={textareaRef}
          placeholder={`Type your command here...`}
          keyBindings={TEXTAREA_KEY_BINDINGS}
          focused={
            !disabled && (isTopLayer('base') || isTopLayer('command') || isTopLayer('mention'))
          }
          onContentChange={handleTextAreaContentChange}
        />
        <StatusBar />
      </box>
    </box>
  );
}
