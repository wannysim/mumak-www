export {
  buildNoteTree,
  getAllNoteSlugs,
  getAllNoteTags,
  getBacklinks,
  getExistingNoteSlugs,
  getLinkDirection,
  getMergedLinkedNotes,
  getNote,
  getNoteAnchorIndex,
  getNoteEmbedPreview,
  getNotes,
  getNotesByCategory,
  getNotesByStatus,
  getNotesByTag,
  getOutgoingNotes,
  hasBlockAnchor,
  hasHeadingAnchor,
} from './api/notes';

export { PARA_CATEGORY_KEYS, PARA_LABELS, isValidParaCategory, type ParaCategoryKey } from './para';

export type {
  LinkDirection,
  LinkedNote,
  Note,
  NoteAnchorIndex,
  NoteEmbedPreview,
  NoteMeta,
  NoteStatus,
  NoteTreeNode,
} from './api/notes';
