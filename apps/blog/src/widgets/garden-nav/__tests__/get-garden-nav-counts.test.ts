import { getGardenNavCounts } from '../lib/get-garden-nav-counts';

const mockGetNotes = vi.fn();
const mockGetAllNoteTags = vi.fn();

vi.mock('@/src/entities/note', () => ({
  getAllNoteTags: (locale: string) => mockGetAllNoteTags(locale),
  getNotes: (locale: string) => mockGetNotes(locale),
}));

describe('getGardenNavCounts', () => {
  beforeEach(() => {
    mockGetNotes.mockReturnValue([
      { status: 'seedling' },
      { status: 'seedling' },
      { status: 'budding' },
      { status: 'evergreen' },
    ]);
    mockGetAllNoteTags.mockReturnValue([{ name: 'pkm' }, { name: 'react' }, { name: 'testing' }]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('counts all notes, statuses, and tags for the locale', () => {
    expect(getGardenNavCounts('en')).toEqual({
      all: 4,
      seedling: 2,
      budding: 1,
      evergreen: 1,
      tags: 3,
    });

    expect(mockGetNotes).toHaveBeenCalledWith('en');
    expect(mockGetAllNoteTags).toHaveBeenCalledWith('en');
  });
});
