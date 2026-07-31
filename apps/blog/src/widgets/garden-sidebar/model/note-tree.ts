export interface SidebarTreeNode {
  slug: string;
  title: string;
  children: SidebarTreeNode[];
}

export interface Category {
  key: string;
  label: string;
  noteCount: number;
  tree: SidebarTreeNode[];
}
