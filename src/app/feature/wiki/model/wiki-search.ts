/**
 * Minimum normalized query length that opens Wiki search results.
 *
 * @type {number}
 */
export const WIKI_SEARCH_MIN_QUERY_LENGTH = 3;

/**
 * Maximum number of Wiki search results shown at once.
 *
 * @type {number}
 */
export const WIKI_SEARCH_RESULT_LIMIT = 8;

/**
 * Maximum number of passages shown for one Wiki page.
 *
 * @type {number}
 */
export const WIKI_SEARCH_RESULT_LIMIT_PER_PAGE = 1;

/**
 * Preferred number of characters surrounding a Wiki search match.
 *
 * @type {number}
 */
export const WIKI_SEARCH_PREVIEW_LENGTH = 160;

/**
 * Minimum query-token length eligible for fuzzy matching.
 *
 * @type {number}
 */
export const WIKI_SEARCH_FUZZY_MIN_TOKEN_LENGTH = 3;

/**
 * Longest query-token length that accepts one edit.
 *
 * @type {number}
 */
export const WIKI_SEARCH_FUZZY_ONE_EDIT_MAX_LENGTH = 5;

/**
 * Longest query-token length that accepts two edits.
 *
 * Longer terms accept three edits.
 *
 * @type {number}
 */
export const WIKI_SEARCH_FUZZY_TWO_EDIT_MAX_LENGTH = 8;

/**
 * Source range occupied by one rendered Wiki block-level element.
 *
 * @interface WikiSearchTextBlock
 * @typedef {WikiSearchTextBlock}
 */
export interface WikiSearchTextBlock {
  /**
   * Inclusive block start offset in passage text.
   */
  start: number;
  /**
   * Exclusive block end offset in passage text.
   */
  end: number;
}

/**
 * Build-generated searchable Wiki passage.
 *
 * @interface WikiSearchPassage
 * @typedef {WikiSearchPassage}
 */
export interface WikiSearchPassage {
  /**
   * Canonical page slug.
   */
  pageSlug: string;
  /**
   * Page title.
   */
  pageTitle: string;
  /**
   * Nearest heading identifier used as the navigation fallback.
   */
  sectionId: string;
  /**
   * Nearest heading title.
   */
  sectionTitle: string;
  /**
   * Readable passage text.
   */
  text: string;
  /**
   * Rendered block boundaries within the readable passage text.
   */
  textBlocks: WikiSearchTextBlock[];
  /**
   * Whether the passage contains stable visible text for a native text fragment.
   */
  textFragmentEligible: boolean;
  /**
   * Stable Wiki source order.
   */
  order: number;
}

/**
 * Normalized search value with source offsets.
 *
 * @interface WikiSearchNormalizedValue
 * @typedef {WikiSearchNormalizedValue}
 */
export interface WikiSearchNormalizedValue {
  /**
   * Normalized searchable text.
   */
  text: string;
  /**
   * Source offset for each character in the normalized text.
   */
  sourceOffsets: number[];
  /**
   * Original source-text length.
   */
  sourceLength: number;
}

/**
 * Runtime Wiki search index entry.
 *
 * @interface WikiSearchIndexEntry
 * @typedef {WikiSearchIndexEntry}
 */
export interface WikiSearchIndexEntry {
  /**
   * Build-generated passage.
   */
  passage: WikiSearchPassage;
  /**
   * Normalized page title.
   */
  pageTitle: string;
  /**
   * Normalized section title.
   */
  sectionTitle: string;
  /**
   * Normalized passage with source offsets.
   */
  passageText: WikiSearchNormalizedValue;
}

/**
 * Vocabulary matches and passage candidates resolved for one query token.
 *
 * @interface WikiSearchResolvedToken
 * @typedef {WikiSearchResolvedToken}
 */
export interface WikiSearchResolvedToken {
  /**
   * Accepted edit distance keyed by normalized vocabulary word.
   */
  wordDistances: ReadonlyMap<string, number>;
  /**
   * Runtime search-entry indexes containing at least one matching word.
   */
  entryIndexes: ReadonlySet<number>;
}

/**
 * Search match range in source passage text.
 *
 * @interface WikiSearchMatchRange
 * @typedef {WikiSearchMatchRange}
 */
export interface WikiSearchMatchRange {
  /**
   * Inclusive source start offset.
   */
  start: number;
  /**
   * Exclusive source end offset.
   */
  end: number;
}

/**
 * Query-token occurrence in normalized passage text.
 *
 * @interface WikiSearchTokenOccurrence
 * @typedef {WikiSearchTokenOccurrence}
 */
export interface WikiSearchTokenOccurrence extends WikiSearchMatchRange {
  /**
   * Query-token index represented by the occurrence.
   */
  tokenIndex: number;
  /**
   * Edit distance from the query token.
   */
  distance: number;
  /**
   * Whether the query token is an exact substring of the matched word.
   */
  exact: boolean;
  /**
   * Whether the query token matches the complete word.
   */
  wholeWord: boolean;
}

/**
 * Best complete token match within a Wiki passage.
 *
 * @interface WikiSearchPassageMatch
 * @typedef {WikiSearchPassageMatch}
 */
export interface WikiSearchPassageMatch {
  /**
   * Whole-word source ranges selected for preview and navigation.
   */
  ranges: WikiSearchMatchRange[];
  /**
   * Whether selected ranges respect query-token order.
   */
  ordered: boolean;
  /**
   * Whether the complete normalized query occurs as one phrase.
   */
  phrase: boolean;
  /**
   * Total edit distance across selected token matches.
   */
  distance: number;
  /**
   * Span from the first selected token through the last.
   */
  span: number;
}

/**
 * Token matches collected across one indexed Wiki entry.
 *
 * @interface WikiSearchEntryMatch
 * @typedef {WikiSearchEntryMatch}
 */
export interface WikiSearchEntryMatch {
  /**
   * Per-token page-title matches.
   */
  pageTitle: WikiSearchTokenOccurrence[][];
  /**
   * Per-token section-title matches.
   */
  sectionTitle: WikiSearchTokenOccurrence[][];
  /**
   * Per-token passage matches.
   */
  passageText: WikiSearchTokenOccurrence[][];
  /**
   * Best complete passage match.
   */
  passage: WikiSearchPassageMatch;
}

/**
 * Display segment in a Wiki search preview.
 *
 * @interface WikiSearchPreviewSegment
 * @typedef {WikiSearchPreviewSegment}
 */
export interface WikiSearchPreviewSegment {
  /**
   * Segment text.
   */
  text: string;
  /**
   * Whether the segment matches the query.
   */
  matched: boolean;
}

/**
 * Ranked Wiki search result.
 *
 * @interface WikiSearchResult
 * @typedef {WikiSearchResult}
 */
export interface WikiSearchResult {
  /**
   * Matching passage.
   */
  passage: WikiSearchPassage;
  /**
   * Ranked match score.
   */
  score: number;
  /**
   * Preview segments with query emphasis.
   */
  preview: WikiSearchPreviewSegment[];
  /**
   * Browser-facing navigation URL.
   */
  href: string;
  /**
   * Whether selection should use a native text-fragment navigation.
   */
  usesNativeTextFragment: boolean;
  /**
   * Angular navigation fragment used when native text fragments are unavailable.
   */
  fallbackFragment: string;
}
