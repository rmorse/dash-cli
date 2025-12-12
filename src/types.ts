export interface Project {
  name: string;
  path: string;
  isGitRepo: boolean;
  hasNestedProjects?: boolean;
  nestedProjects?: Project[];
}

export interface HistoryEntry {
  path: string;
  lastUsed: number;
}

export interface HistoryData {
  recent: HistoryEntry[];
}

export interface SelectItem {
  label: string;
  value: string;
  isHeader?: boolean;
}
