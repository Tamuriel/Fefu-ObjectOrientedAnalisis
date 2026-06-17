import { message } from '@tauri-apps/plugin-dialog';
import { BaseDirectory } from '@tauri-apps/api/path';
import { mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { shapeFromJSON } from './math/shape/shapeFromJSON';
import type { Shape, ShapeJSON } from './math/shape/Shape';

export interface ProjectShapeData extends ShapeJSON {}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lineAlg: string;
  shapes: ProjectShapeData[];
}

export interface ProjectIndexItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  shapeCount: number;
}

const PROJECT_ROOT = 'VectorEngine/projects';
const INDEX_FILE = 'index.json';
const LOCAL_STORAGE_INDEX_KEY = 'vectorengine.projects.index';

function hasTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function readLocalStorageJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorageJSON(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function loadLocalProjectIndex(): ProjectIndexItem[] {
  return readLocalStorageJSON<ProjectIndexItem[]>(LOCAL_STORAGE_INDEX_KEY, []);
}

function saveLocalProjectIndex(items: ProjectIndexItem[]) {
  writeLocalStorageJSON(LOCAL_STORAGE_INDEX_KEY, items);
}

function loadLocalProject(projectId: string): ProjectData | null {
  const project = readLocalStorageJSON<ProjectData | null>(`vectorengine.projects.${projectId}`, null);
  return project;
}

function saveLocalProject(project: ProjectData) {
  writeLocalStorageJSON(`vectorengine.projects.${project.id}`, project);
}

function projectFileName(projectId: string) {
  return `${projectId}.json`;
}

async function ensureProjectFolder() {
  if (!hasTauriRuntime()) {
    return;
  }

  await mkdir(PROJECT_ROOT, { baseDir: BaseDirectory.Document, recursive: true });
}

async function readIndexFile(): Promise<ProjectIndexItem[]> {
  if (!hasTauriRuntime()) {
    return loadLocalProjectIndex();
  }

  try {
    const raw = await readTextFile(`${PROJECT_ROOT}/${INDEX_FILE}`, { baseDir: BaseDirectory.Document });
    const parsed = JSON.parse(raw) as ProjectIndexItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndexFile(items: ProjectIndexItem[]) {
  if (!hasTauriRuntime()) {
    saveLocalProjectIndex(items);
    return;
  }

  await writeTextFile(`${PROJECT_ROOT}/${INDEX_FILE}`, JSON.stringify(items, null, 2), {
    baseDir: BaseDirectory.Document,
  });
}

export async function loadProjectIndex(): Promise<ProjectIndexItem[]> {
  await ensureProjectFolder();
  return readIndexFile();
}

export async function saveProject(project: Omit<ProjectData, 'updatedAt'> & { updatedAt?: string }): Promise<ProjectData> {
  const now = new Date().toISOString();
  const data: ProjectData = {
    ...project,
    updatedAt: project.updatedAt ?? now,
    shapes: project.shapes.map((shape) => ({ ...shape })),
  };

  if (!hasTauriRuntime()) {
    const index = loadLocalProjectIndex();
    const existing = index.findIndex((item) => item.id === data.id);
    const summary: ProjectIndexItem = {
      id: data.id,
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      shapeCount: data.shapes.length,
    };

    if (existing >= 0) {
      index[existing] = summary;
    } else {
      index.unshift(summary);
    }

    saveLocalProject(data);
    saveLocalProjectIndex(index);
    return data;
  }

  await ensureProjectFolder();

  await writeTextFile(`${PROJECT_ROOT}/${projectFileName(data.id)}`, JSON.stringify(data, null, 2), {
    baseDir: BaseDirectory.Document,
    create: true,
  });

  const index = await readIndexFile();
  const existing = index.findIndex((item) => item.id === data.id);
  const summary: ProjectIndexItem = {
    id: data.id,
    name: data.name,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    shapeCount: data.shapes.length,
  };

  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }

  await writeIndexFile(index);
  return data;
}

export async function loadProject(projectId: string): Promise<ProjectData | null> {
  if (!hasTauriRuntime()) {
    return loadLocalProject(projectId);
  }

  await ensureProjectFolder();

  try {
    const raw = await readTextFile(`${PROJECT_ROOT}/${projectFileName(projectId)}`, { baseDir: BaseDirectory.Document });
    const parsed = JSON.parse(raw) as ProjectData;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      id: String(parsed.id ?? projectId),
      name: String(parsed.name ?? `Проект ${projectId}`),
      createdAt: String(parsed.createdAt ?? new Date().toISOString()),
      updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
      lineAlg: parsed.lineAlg === 'wu' ? 'wu' : 'bresenham',
      shapes: Array.isArray(parsed.shapes) ? parsed.shapes.filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

export function shapesToProjectData(shapes: Shape[]): ProjectShapeData[] {
  return shapes.map((shape) => shape.toJSON() as ProjectShapeData);
}

export function shapesFromProjectData(data: ProjectShapeData[]): Shape[] {
  return data.map((item) => shapeFromJSON(item)).filter((shape): shape is Shape => shape !== null);
}

export async function notifyProjectSaved(projectName: string) {
  if (!hasTauriRuntime()) {
    return;
  }

  await message(`Проект ${projectName} сохранён`, { title: 'VectorEngine', kind: 'info' });
}