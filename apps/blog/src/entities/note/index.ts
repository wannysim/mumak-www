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
  getNotesByStatus,
  getNotesByTag,
  getOutgoingNotes,
  hasBlockAnchor,
  hasHeadingAnchor,
} from './api/notes';

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
