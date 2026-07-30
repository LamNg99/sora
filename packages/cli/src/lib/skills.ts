import { existsSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, basename, extname } from 'path';

export type Skill = {
  name: string;
  description?: string;
  content: string;
  source: 'global' | 'project';
};

const GLOBAL_SKILLS_DIR = join(homedir(), '.sora', 'skills');
const PROJECT_SKILLS_DIR = join(process.cwd(), '.sora', 'skills');

function parseFrontmatter(raw: string): { description?: string; content: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { content: raw.trim() };

  const frontmatter = match[1]!;
  const content = match[2]!.trim();
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return { description: descMatch?.[1]?.trim(), content };
}

function readSkillsFromDir(dir: string, source: 'global' | 'project'): Skill[] {
  if (!existsSync(dir)) return [];
  const skills: Skill[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const name = basename(file, extname(file));
      const raw = readFileSync(join(dir, file), 'utf-8');
      const { description, content } = parseFrontmatter(raw);
      if (content) skills.push({ name, description, content, source });
    }
  } catch {
    // silently skip unreadable dirs/files
  }
  return skills;
}

export function loadAvailableSkills(): Skill[] {
  const project = readSkillsFromDir(PROJECT_SKILLS_DIR, 'project');
  const global = readSkillsFromDir(GLOBAL_SKILLS_DIR, 'global');

  // project skills shadow global ones with the same name
  const projectNames = new Set(project.map((s) => s.name));
  return [...project, ...global.filter((s) => !projectNames.has(s.name))].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
