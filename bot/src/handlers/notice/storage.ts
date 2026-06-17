import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_NOTICE_SECTIONS, type NoticeSection } from './content.js';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data');
const CONTENT_PATH = path.join(DATA_DIR, 'notice_content.json');
const CONFIRMS_PATH = path.join(DATA_DIR, 'notice_confirms.json');

interface SavedSectionOverride {
  title?: string;
  description?: string;
}

interface NoticeContentStore {
  sections?: Record<string, SavedSectionOverride>;
  customSections?: NoticeSection[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadContentStore(): NoticeContentStore {
  ensureDataDir();
  try {
    if (fs.existsSync(CONTENT_PATH)) {
      return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8')) as NoticeContentStore;
    }
  } catch {
    // ignore corrupt file
  }
  return {};
}

function saveContentStore(data: NoticeContentStore) {
  ensureDataDir();
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getNoticeSections(): NoticeSection[] {
  const saved = loadContentStore();
  const merged = DEFAULT_NOTICE_SECTIONS.map((section) => {
    const override = saved.sections?.[section.key];
    if (!override) return { ...section };
    return {
      ...section,
      title: override.title ?? section.title,
      description: override.description ?? section.description,
    };
  });

  return [...merged, ...(saved.customSections ?? [])];
}

export function updateNoticeSection(sectionKey: string, title: string, description: string) {
  const saved = loadContentStore();
  const isDefault = DEFAULT_NOTICE_SECTIONS.some((s) => s.key === sectionKey);

  if (isDefault) {
    saved.sections = saved.sections ?? {};
    saved.sections[sectionKey] = { title, description };
  } else {
    saved.customSections = (saved.customSections ?? []).map((section) =>
      section.key === sectionKey ? { ...section, title, description } : section
    );
  }

  saveContentStore(saved);
}

export function addNoticeSection(title: string, description: string) {
  const saved = loadContentStore();
  const key = `custom_${Date.now()}`;
  const section: NoticeSection = {
    key,
    color: 0x95a5a6,
    title,
    description,
  };
  saved.customSections = [...(saved.customSections ?? []), section];
  saveContentStore(saved);
  return section;
}

export function loadNoticeConfirms(): Record<string, string[]> {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIRMS_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIRMS_PATH, 'utf-8')) as Record<string, string[]>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveNoticeConfirms(data: Record<string, string[]>) {
  ensureDataDir();
  fs.writeFileSync(CONFIRMS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getSectionByIndex(index: number): NoticeSection | undefined {
  return getNoticeSections()[index];
}

export function getSectionIndexByKey(key: string): number {
  return getNoticeSections().findIndex((section) => section.key === key);
}
