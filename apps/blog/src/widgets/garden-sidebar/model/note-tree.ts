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

export function flattenTree(nodes: SidebarTreeNode[]): { slug: string; title: string }[] {
  return nodes.flatMap(node => [{ slug: node.slug, title: node.title }, ...flattenTree(node.children)]);
}
