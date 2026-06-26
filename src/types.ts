export interface NodeMetadata {
  id: string;
  color?: string; // Custom background color
  textColor?: string; // Custom text color
  emoji?: string; // e.g. "🎯"
  icon?: string; // Lucide icon name, e.g. "Star", "Heart", etc.
  checked?: boolean; // If checkbox is active
  hasCheckbox?: boolean; // Whether checkbox is displayed
  notes?: string; // Tooltip / detail note
  link?: string; // Hyperlink
  tags?: string[]; // Custom tags
  collapsed?: boolean; // Whether children are hidden
  pinned?: boolean; // Whether manual position is locked
  manualX?: number; // Custom manual absolute position X
  manualY?: number; // Custom manual absolute position Y
}

export interface MindMapNode {
  id: string; // Reconciled ID
  text: string; // The pure label without tags, emojis, etc.
  rawText: string; // Full line of text as typed by user
  indent: number; // Indentation level
  level: number; // Hierarchical level (0 = root)
  parentId: string | null;
  childrenIds: string[];
  lineNumber: number; // 0-indexed line number in editor
  
  // Custom metadata merged
  metadata: NodeMetadata;
  
  // Computed coordinates for rendering
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtraLink {
  id: string;
  fromId: string;
  toId: string;
  style: "straight" | "curved";
  color: string;
  thickness: number;
  hasArrow: boolean;
  label?: string;
}

export type LayoutType = "horizontal" | "vertical" | "radial" | "organogram" | "organic" | "flowchart";

export type ThemeType = "light" | "dark" | "high-contrast";

export interface AppConfig {
  theme: ThemeType;
  fontFamily: string;
  fontSize: number;
  levelSpacing: number;
  siblingSpacing: number;
  lineThickness: number;
  borderRadius: number; // Radius of balloons
  nodeShape: "rectangle" | "rounded" | "capsule" | "ellipse";
  accentColor: string;
}

export interface SearchState {
  query: string;
  results: string[]; // List of matching node IDs
  currentIndex: number; // Current selected result index for navigation
}

export interface HistoryState {
  text: string;
  metadata: Record<string, NodeMetadata>;
  extraLinks: ExtraLink[];
  config: AppConfig;
  layout: LayoutType;
}

export interface SavedMapData {
  version: string;
  text: string;
  metadata: Record<string, NodeMetadata>;
  extraLinks: ExtraLink[];
  layout: LayoutType;
  config: AppConfig;
  zoom: number;
  panX: number;
  panY: number;
}
