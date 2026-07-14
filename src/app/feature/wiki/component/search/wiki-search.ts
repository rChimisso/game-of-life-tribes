import {DOCUMENT, isPlatformBrowser} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input, PLATFORM_ID, inject} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {Router} from '@angular/router';

import {WIKI_SEARCH_FUZZY_MIN_TOKEN_LENGTH, WIKI_SEARCH_FUZZY_ONE_EDIT_MAX_LENGTH, WIKI_SEARCH_FUZZY_TWO_EDIT_MAX_LENGTH, WIKI_SEARCH_MIN_QUERY_LENGTH, WIKI_SEARCH_PREVIEW_LENGTH, WIKI_SEARCH_RESULT_LIMIT, WIKI_SEARCH_RESULT_LIMIT_PER_PAGE, WikiSearchEntryMatch, WikiSearchIndexEntry, WikiSearchMatchRange, WikiSearchNormalizedValue, WikiSearchPassage, WikiSearchPassageMatch, WikiSearchPreviewSegment, WikiSearchResolvedToken, WikiSearchResult, WikiSearchTextBlock, WikiSearchTokenOccurrence} from '../../model/wiki-search';

/**
 * Client-side Wiki passage search.
 *
 * @class WikiSearch
 * @typedef {WikiSearch}
 */
@Component({
  selector: 'gol-wiki-search',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './wiki-search.html',
  styleUrl: './wiki-search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikiSearch {
  /**
   * Current input value.
   *
   * @public
   * @type {string}
   */
  public query = '';

  /**
   * Ranked visible search results.
   *
   * @public
   * @type {WikiSearchResult[]}
   */
  public results: WikiSearchResult[] = [];

  /**
   * Active result index for keyboard navigation.
   *
   * @public
   * @type {number}
   */
  public activeResultIndex = -1;

  /**
   * Whether focus is currently within the search component.
   *
   * @public
   * @type {boolean}
   */
  public focused = false;

  /**
   * Whether the current query is long enough to search.
   *
   * @public
   * @type {boolean}
   */
  public queryReady = false;

  /**
   * Whether the user dismissed results for the unchanged query.
   *
   * @public
   * @type {boolean}
   */
  public dismissed = false;

  /**
   * Active platform document.
   *
   * @private
   * @readonly
   * @type {Document}
   */
  private readonly document = inject(DOCUMENT);

  /**
   * Angular platform identifier.
   *
   * @private
   * @readonly
   * @type {object}
   */
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Angular application router.
   *
   * @private
   * @readonly
   * @type {Router}
   */
  private readonly router = inject(Router);

  /**
   * Normalized runtime passage index.
   *
   * @private
   * @type {WikiSearchIndexEntry[]}
   */
  private searchIndex: WikiSearchIndexEntry[] = [];

  /**
   * Unique normalized words available to fuzzy query resolution.
   *
   * @private
   * @type {string[]}
   */
  private vocabulary: string[] = [];

  /**
   * Runtime search-entry postings keyed by normalized vocabulary word.
   *
   * @private
   * @type {Map<string, number[]>}
   */
  private wordPostings = new Map<string, number[]>();

  /**
   * Reusable previous row for bounded Levenshtein calculations.
   *
   * @private
   * @type {Uint16Array}
   */
  private levenshteinPrevious = new Uint16Array(0);

  /**
   * Reusable current row for bounded Levenshtein calculations.
   *
   * @private
   * @type {Uint16Array}
   */
  private levenshteinCurrent = new Uint16Array(0);

  /**
   * Whether the active browser exposes native text fragments.
   *
   * @private
   * @readonly
   * @type {boolean}
   */
  private readonly nativeTextFragmentsSupported = isPlatformBrowser(this.platformId) && 'fragmentDirective' in this.document;

  /**
   * Whether the results surface should be rendered.
   *
   * @public
   * @readonly
   * @returns {boolean} true when focused search results should be visible.
   */
  public get resultsVisible(): boolean {
    return this.focused && this.queryReady && !this.dismissed;
  }

  /**
   * Active result option identifier.
   *
   * @public
   * @readonly
   * @returns {string | null} active option ID, or null when no result is active.
   */
  public get activeDescendant(): string | null {
    return this.activeResultIndex >= 0 && this.activeResultIndex < this.results.length ? this.resultId(this.activeResultIndex) : null;
  }

  /**
   * Build-generated passages used to rebuild the runtime search index.
   *
   * @public
   * @param {WikiSearchPassage[]} passages searchable Wiki passages.
   */
  @Input({required: true})
  public set passages(passages: WikiSearchPassage[]) {
    this.searchIndex = passages.map(passage => ({
      passage,
      pageTitle: this.normalizeValue(passage.pageTitle).text,
      sectionTitle: this.normalizeValue(passage.sectionTitle).text,
      passageText: this.normalizeValue(passage.text)
    }));
    this.rebuildVocabularyIndex();
    this.updateSearchResults();
  }

  /**
   * Updates the query and ranked results after input.
   *
   * @public
   * @param {Event} event native input event.
   */
  public onInput(event: Event): void {
    const {target} = event;
    if (target instanceof HTMLInputElement) {
      this.query = target.value;
      this.dismissed = false;
      this.updateSearchResults();
    }
  }

  /**
   * Opens eligible results when focus enters the component.
   *
   * @public
   */
  public onFocusIn(): void {
    this.focused = true;
    this.dismissed = false;
  }

  /**
   * Closes results when focus leaves the complete search component.
   *
   * @public
   * @param {FocusEvent} event bubbling focus event.
   */
  public onFocusOut(event: FocusEvent): void {
    const {currentTarget, relatedTarget} = event;
    const focusRemainsWithinSearch = currentTarget instanceof HTMLElement && relatedTarget instanceof Node && currentTarget.contains(relatedTarget);
    if (!focusRemainsWithinSearch) {
      this.focused = false;
    }
  }

  /**
   * Clears the current query and returns focus to the input.
   *
   * @public
   * @param {HTMLInputElement} input search input.
   */
  public clearSearch(input: HTMLInputElement): void {
    this.resetSearch();
    input.focus();
  }

  /**
   * Handles search input keyboard navigation.
   *
   * @public
   * @param {KeyboardEvent} event input keyboard event.
   */
  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' && this.resultsVisible && this.results.length > 0) {
      event.preventDefault();
      this.activeResultIndex = (this.activeResultIndex + 1) % this.results.length;
    } else if (event.key === 'ArrowUp' && this.resultsVisible && this.results.length > 0) {
      event.preventDefault();
      this.activeResultIndex = (this.activeResultIndex - 1 + this.results.length) % this.results.length;
    } else if (event.key === 'Enter' && this.resultsVisible && this.activeResultIndex >= 0) {
      event.preventDefault();
      this.navigateToResult(this.results[this.activeResultIndex]!);
    } else if (event.key === 'Escape' && this.resultsVisible) {
      event.preventDefault();
      this.dismissed = true;
    }
  }

  /**
   * Makes a pointer-hovered result active for keyboard continuation.
   *
   * @public
   * @param {number} index result index.
   */
  public activateResult(index: number): void {
    this.activeResultIndex = index;
  }

  /**
   * Preserves native text-fragment links and routes fallback selections in place.
   *
   * @public
   * @param {MouseEvent} event result link activation.
   * @param {WikiSearchResult} result selected result.
   */
  public onResultClick(event: MouseEvent, result: WikiSearchResult): void {
    const primaryUnmodifiedClick = event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (primaryUnmodifiedClick && !result.usesNativeTextFragment) {
      event.preventDefault();
      this.navigateWithAngular(result);
    }
  }

  /**
   * Returns a stable DOM identifier for a result option.
   *
   * @public
   * @param {number} index result index.
   * @returns {string} result DOM identifier.
   */
  public resultId(index: number): string {
    return `wiki-search-result-${index}`;
  }

  /**
   * Rebuilds ranked results for the current query.
   *
   * @private
   */
  private updateSearchResults(): void {
    const normalizedQuery = this.normalizeValue(this.query.trim()).text;
    const queryTokens = [...new Set(normalizedQuery.match(/[\p{Letter}\p{Number}_]+/gu) ?? [])];
    const normalizedPhrase = queryTokens.join(' ');
    this.queryReady = normalizedQuery.length >= WIKI_SEARCH_MIN_QUERY_LENGTH && queryTokens.length > 0;
    const rankedResults: WikiSearchResult[] = [];
    if (this.queryReady) {
      const resolvedTokens = queryTokens.map(token => this.resolveQueryToken(token));
      for (const entryIndex of this.candidateEntryIndexes(resolvedTokens)) {
        const result = this.createResult(this.searchIndex[entryIndex]!, normalizedPhrase, queryTokens, resolvedTokens);
        if (result !== null) {
          rankedResults.push(result);
        }
      }
      rankedResults.sort((left, right) => right.score - left.score || left.passage.order - right.passage.order);
    }
    const pageResultCounts = new Map<string, number>();
    const visibleResults: WikiSearchResult[] = [];
    for (const result of rankedResults) {
      const pageResultCount = pageResultCounts.get(result.passage.pageSlug) ?? 0;
      if (visibleResults.length < WIKI_SEARCH_RESULT_LIMIT && pageResultCount < WIKI_SEARCH_RESULT_LIMIT_PER_PAGE) {
        visibleResults.push(result);
        pageResultCounts.set(result.passage.pageSlug, pageResultCount + 1);
      }
    }
    this.results = visibleResults;
    this.activeResultIndex = visibleResults.length > 0 ? 0 : -1;
  }

  /**
   * Rebuilds the unique vocabulary and its runtime search-entry postings.
   *
   * @private
   */
  private rebuildVocabularyIndex(): void {
    const postingSets = new Map<string, Set<number>>();
    let maximumWordLength = 0;
    for (const [entryIndex, entry] of this.searchIndex.entries()) {
      const words = new Set(`${entry.pageTitle} ${entry.sectionTitle} ${entry.passageText.text}`.match(/[\p{Letter}\p{Number}_]+/gu) ?? []);
      for (const word of words) {
        const postings = postingSets.get(word) ?? new Set<number>();
        postings.add(entryIndex);
        postingSets.set(word, postings);
        maximumWordLength = Math.max(maximumWordLength, word.length);
      }
    }
    this.vocabulary = [...postingSets.keys()];
    this.wordPostings = new Map([...postingSets].map(([word, entryIndexes]) => [word, [...entryIndexes]]));
    this.levenshteinPrevious = new Uint16Array(maximumWordLength + 1);
    this.levenshteinCurrent = new Uint16Array(maximumWordLength + 1);
  }

  /**
   * Resolves one query token against the unique vocabulary and its postings.
   *
   * @private
   * @param {string} token normalized query token.
   * @returns {WikiSearchResolvedToken} accepted word distances and candidate entries.
   */
  private resolveQueryToken(token: string): WikiSearchResolvedToken {
    const wordDistances = new Map<string, number>();
    const entryIndexes = new Set<number>();
    const fuzzyEligible = token.length >= WIKI_SEARCH_FUZZY_MIN_TOKEN_LENGTH;
    const maximumDistance = fuzzyEligible ? this.maximumFuzzyDistance(token.length) : 0;
    for (const word of this.vocabulary) {
      let distance = maximumDistance + 1;
      if (word.includes(token)) {
        distance = 0;
      } else if (fuzzyEligible) {
        distance = this.fuzzySubstringDistance(token, word, maximumDistance);
      }
      if (distance <= maximumDistance) {
        wordDistances.set(word, distance);
        for (const entryIndex of this.wordPostings.get(word) ?? []) {
          entryIndexes.add(entryIndex);
        }
      }
    }
    return {wordDistances, entryIndexes};
  }

  /**
   * Intersects query-token postings to select entries requiring full ranking.
   *
   * @private
   * @param {WikiSearchResolvedToken[]} resolvedTokens resolved query tokens.
   * @returns {number[]} runtime search-entry candidate indexes.
   */
  private candidateEntryIndexes(resolvedTokens: WikiSearchResolvedToken[]): number[] {
    const orderedTokens = [...resolvedTokens].sort((left, right) => left.entryIndexes.size - right.entryIndexes.size);
    let candidates: Set<number> | null = null;
    for (const resolvedToken of orderedTokens) {
      if (candidates === null) {
        candidates = new Set(resolvedToken.entryIndexes);
      } else {
        for (const entryIndex of candidates) {
          if (!resolvedToken.entryIndexes.has(entryIndex)) {
            candidates.delete(entryIndex);
          }
        }
      }
    }
    return candidates === null ? [] : [...candidates];
  }

  /**
   * Creates a ranked result when every query token matches an indexed entry.
   *
   * @private
   * @param {WikiSearchIndexEntry} entry normalized passage entry.
   * @param {string} normalizedQuery complete normalized query.
   * @param {string[]} queryTokens distinct normalized query tokens.
   * @param {WikiSearchResolvedToken[]} resolvedTokens vocabulary matches for each query token.
   * @returns {WikiSearchResult | null} ranked result, or null when the entry does not match.
   */
  private createResult(entry: WikiSearchIndexEntry, normalizedQuery: string, queryTokens: string[], resolvedTokens: WikiSearchResolvedToken[]): WikiSearchResult | null {
    const pageTitleMatches = queryTokens.map((token, tokenIndex) => this.findTokenOccurrences(entry.pageTitle, token, tokenIndex, resolvedTokens[tokenIndex]!));
    const sectionTitleMatches = queryTokens.map((token, tokenIndex) => this.findTokenOccurrences(entry.sectionTitle, token, tokenIndex, resolvedTokens[tokenIndex]!));
    const passageTextMatches = queryTokens.map((token, tokenIndex) => this.findTokenOccurrences(entry.passageText.text, token, tokenIndex, resolvedTokens[tokenIndex]!));
    const matchesEveryToken = queryTokens.every((_token, tokenIndex) => pageTitleMatches[tokenIndex]!.length > 0 || sectionTitleMatches[tokenIndex]!.length > 0 || passageTextMatches[tokenIndex]!.length > 0);
    let result: WikiSearchResult | null = null;
    if (matchesEveryToken) {
      const completePassageMatch = passageTextMatches.every(matches => matches.length > 0);
      const passageMatch = completePassageMatch ? this.findPassageMatch(entry.passageText, normalizedQuery, passageTextMatches) : this.emptyPassageMatch();
      const entryMatch: WikiSearchEntryMatch = {
        pageTitle: pageTitleMatches,
        sectionTitle: sectionTitleMatches,
        passageText: passageTextMatches,
        passage: passageMatch
      };
      const score = this.scoreEntry(entry, normalizedQuery, entryMatch);
      const preview = this.createPreview(entry.passage.text, passageMatch.ranges);
      const fallbackFragment = entry.passage.sectionId;
      const textDirective = entry.passage.textFragmentEligible ? this.createTextDirective(entry.passage, passageMatch.ranges) : null;
      const usesNativeTextFragment = this.nativeTextFragmentsSupported && textDirective !== null;
      result = {
        passage: entry.passage,
        score,
        preview,
        href: this.createResultHref(entry.passage, fallbackFragment, usesNativeTextFragment ? textDirective : null),
        usesNativeTextFragment,
        fallbackFragment
      };
    }
    return result;
  }

  /**
   * Scores a matching entry by title, section, phrase, and passage proximity.
   *
   * @private
   * @param {WikiSearchIndexEntry} entry normalized passage entry.
   * @param {string} query complete normalized query.
   * @param {WikiSearchEntryMatch} matches token matches across the indexed entry.
   * @returns {number} deterministic relevance score.
   */
  private scoreEntry(entry: WikiSearchIndexEntry, query: string, matches: WikiSearchEntryMatch): number {
    let score = 0;
    if (entry.pageTitle === query) {
      score += 12000;
    } else if (entry.pageTitle.startsWith(query)) {
      score += 9000;
    } else if (entry.pageTitle.includes(query)) {
      score += 7000;
    }
    if (entry.sectionTitle === query) {
      score += 6000;
    } else if (entry.sectionTitle.startsWith(query)) {
      score += 4500;
    } else if (entry.sectionTitle.includes(query)) {
      score += 3500;
    }
    if (entry.passageText.text.includes(query)) {
      score += 3000;
    }
    if (matches.passage.ranges.length > 0) {
      score += matches.passage.ordered ? 2400 : 900;
      score += matches.passage.phrase ? 1600 : 0;
      score += Math.max(0, WIKI_SEARCH_PREVIEW_LENGTH - matches.passage.span) * 4;
      score -= matches.passage.distance * 600;
    }
    for (let tokenIndex = 0; tokenIndex < matches.pageTitle.length; tokenIndex += 1) {
      score += this.fieldMatchScore(matches.pageTitle[tokenIndex]!, 260);
      score += this.fieldMatchScore(matches.sectionTitle[tokenIndex]!, 180);
      score += this.fieldMatchScore(matches.passageText[tokenIndex]!, 80);
    }
    return score;
  }

  /**
   * Scores the best token match in one indexed field.
   *
   * @private
   * @param {WikiSearchTokenOccurrence[]} occurrences token matches in the field.
   * @param {number} weight maximum field weight.
   * @returns {number} weighted field-match score.
   */
  private fieldMatchScore(occurrences: WikiSearchTokenOccurrence[], weight: number): number {
    let score = 0;
    if (occurrences.length > 0) {
      const bestMatch = [...occurrences].sort((left, right) => this.tokenMatchCost(left) - this.tokenMatchCost(right) || left.start - right.start)[0]!;
      score = Math.max(0, weight - bestMatch.distance * weight * 0.45 - (bestMatch.wholeWord ? 0 : weight * 0.25));
    }
    return score;
  }

  /**
   * Finds exact substring matches or fuzzy substring matches for one query token.
   *
   * @private
   * @param {string} text normalized field text.
   * @param {string} token normalized query token.
   * @param {number} tokenIndex query-token index.
   * @param {WikiSearchResolvedToken} resolvedToken vocabulary matches for the query token.
   * @returns {WikiSearchTokenOccurrence[]} ordered token matches.
   */
  private findTokenOccurrences(text: string, token: string, tokenIndex: number, resolvedToken: WikiSearchResolvedToken): WikiSearchTokenOccurrence[] {
    const occurrences: WikiSearchTokenOccurrence[] = [];
    const matchedWordRanges = new Set<string>();
    let occurrenceIndex = text.indexOf(token);
    while (occurrenceIndex >= 0) {
      const range = this.normalizedWordRange(text, occurrenceIndex, occurrenceIndex + token.length);
      const rangeKey = `${range.start}:${range.end}`;
      if (!matchedWordRanges.has(rangeKey)) {
        occurrences.push({
          ...range,
          tokenIndex,
          distance: 0,
          exact: true,
          wholeWord: range.start === occurrenceIndex && range.end === occurrenceIndex + token.length
        });
        matchedWordRanges.add(rangeKey);
      }
      occurrenceIndex = text.indexOf(token, occurrenceIndex + token.length);
    }
    if (occurrences.length === 0 && token.length >= WIKI_SEARCH_FUZZY_MIN_TOKEN_LENGTH) {
      const maximumDistance = this.maximumFuzzyDistance(token.length);
      for (const wordMatch of text.matchAll(/[\p{Letter}\p{Number}_]+/gu)) {
        const word = wordMatch[0];
        const start = wordMatch.index;
        const distance = resolvedToken.wordDistances.get(word) ?? maximumDistance + 1;
        if (distance <= maximumDistance) {
          occurrences.push({
            start,
            end: start + word.length,
            tokenIndex,
            distance,
            exact: false,
            wholeWord: true
          });
        }
      }
    }
    return occurrences;
  }

  /**
   * Selects the accepted edit distance independently for one query token.
   *
   * @private
   * @param {number} tokenLength query-token length.
   * @returns {number} maximum accepted Levenshtein distance.
   */
  private maximumFuzzyDistance(tokenLength: number): number {
    let maximumDistance = 3;
    if (tokenLength <= WIKI_SEARCH_FUZZY_ONE_EDIT_MAX_LENGTH) {
      maximumDistance = 1;
    } else if (tokenLength <= WIKI_SEARCH_FUZZY_TWO_EDIT_MAX_LENGTH) {
      maximumDistance = 2;
    }
    return maximumDistance;
  }

  /**
   * Finds the nearest substring of an indexed word using bounded Levenshtein distance.
   *
   * @private
   * @param {string} token normalized query token.
   * @param {string} word normalized indexed word.
   * @param {number} maximumDistance accepted distance.
   * @returns {number} nearest substring distance, capped above the accepted maximum.
   */
  private fuzzySubstringDistance(token: string, word: string, maximumDistance: number): number {
    let nearestDistance = maximumDistance + 1;
    const minimumSubstringLength = Math.max(1, token.length - maximumDistance);
    if (word.length >= minimumSubstringLength) {
      const cappedDistance = maximumDistance + 1;
      let previousRow = this.levenshteinPrevious;
      let currentRow = this.levenshteinCurrent;
      previousRow.fill(0, 0, word.length + 1);
      for (let tokenIndex = 1; tokenIndex <= token.length; tokenIndex += 1) {
        currentRow[0] = Math.min(tokenIndex, cappedDistance);
        for (let wordIndex = 1; wordIndex <= word.length; wordIndex += 1) {
          const substitutionCost = token.charAt(tokenIndex - 1) === word.charAt(wordIndex - 1) ? 0 : 1;
          currentRow[wordIndex] = Math.min(
            cappedDistance,
            previousRow[wordIndex]! + 1,
            currentRow[wordIndex - 1]! + 1,
            previousRow[wordIndex - 1]! + substitutionCost
          );
        }
        const swappedRow = previousRow;
        previousRow = currentRow;
        currentRow = swappedRow;
      }
      for (let wordIndex = 1; wordIndex <= word.length; wordIndex += 1) {
        nearestDistance = Math.min(nearestDistance, previousRow[wordIndex]!);
      }
    }
    return nearestDistance;
  }

  /**
   * Finds the best complete passage match, preferring query-token order.
   *
   * @private
   * @param {WikiSearchNormalizedValue} passage normalized passage and source offsets.
   * @param {string} query complete normalized query.
   * @param {WikiSearchTokenOccurrence[][]} tokenOccurrences per-token passage matches.
   * @returns {WikiSearchPassageMatch} best complete passage match.
   */
  private findPassageMatch(passage: WikiSearchNormalizedValue, query: string, tokenOccurrences: WikiSearchTokenOccurrence[][]): WikiSearchPassageMatch {
    const phraseIndex = passage.text.indexOf(query);
    let selectedOccurrences: WikiSearchTokenOccurrence[] = [];
    let ordered = false;
    let phrase = false;
    if (phraseIndex >= 0) {
      const phraseRange = this.normalizedWordRange(passage.text, phraseIndex, phraseIndex + query.length);
      selectedOccurrences = [
        {
          ...phraseRange,
          tokenIndex: 0,
          distance: 0,
          exact: true,
          wholeWord: true
        }
      ];
      ordered = true;
      phrase = true;
    } else {
      selectedOccurrences = this.orderedTokenSequence(tokenOccurrences);
      ordered = selectedOccurrences.length === tokenOccurrences.length;
      if (!ordered) {
        selectedOccurrences = this.tightestTokenWindow(tokenOccurrences.flat(), tokenOccurrences.length);
      }
    }
    const normalizedStart = selectedOccurrences[0]?.start ?? 0;
    const normalizedEnd = selectedOccurrences.at(-1)?.end ?? normalizedStart;
    const sourceRanges = selectedOccurrences.map(occurrence => this.toSourceRange(passage, occurrence));
    return {
      ranges: this.mergeMatchRanges(sourceRanges),
      ordered,
      phrase,
      distance: selectedOccurrences.reduce((total, occurrence) => total + occurrence.distance, 0),
      span: normalizedEnd - normalizedStart
    };
  }

  /**
   * Selects the tightest occurrence sequence that respects query-token order.
   *
   * @private
   * @param {WikiSearchTokenOccurrence[][]} tokenOccurrences per-token occurrences.
   * @returns {WikiSearchTokenOccurrence[]} best ordered sequence, or an empty array.
   */
  private orderedTokenSequence(tokenOccurrences: WikiSearchTokenOccurrence[][]): WikiSearchTokenOccurrence[] {
    let bestSequence: WikiSearchTokenOccurrence[] = [];
    let bestCost = Number.POSITIVE_INFINITY;
    for (const firstOccurrence of tokenOccurrences[0] ?? []) {
      const sequence = [firstOccurrence];
      let previousOccurrence = firstOccurrence;
      let complete = true;
      for (let tokenIndex = 1; tokenIndex < tokenOccurrences.length; tokenIndex += 1) {
        let nextOccurrence: WikiSearchTokenOccurrence | null = null;
        for (const occurrence of tokenOccurrences[tokenIndex]!) {
          const followsPrevious = occurrence.start >= previousOccurrence.end;
          const precedesSelected = nextOccurrence === null || occurrence.start < nextOccurrence.start || occurrence.start === nextOccurrence.start && this.tokenMatchCost(occurrence) < this.tokenMatchCost(nextOccurrence);
          if (followsPrevious && precedesSelected) {
            nextOccurrence = occurrence;
          }
        }
        if (nextOccurrence !== null) {
          sequence.push(nextOccurrence);
          previousOccurrence = nextOccurrence;
        } else {
          complete = false;
        }
      }
      if (complete) {
        const span = sequence.at(-1)!.end - sequence[0]!.start;
        const cost = span + sequence.reduce((total, occurrence) => total + this.tokenMatchCost(occurrence) * WIKI_SEARCH_PREVIEW_LENGTH, 0);
        if (cost < bestCost) {
          bestSequence = sequence;
          bestCost = cost;
        }
      }
    }
    return bestSequence;
  }

  /**
   * Selects one occurrence of every token from the tightest unordered window.
   *
   * @private
   * @param {WikiSearchTokenOccurrence[]} occurrences ordered token occurrences.
   * @param {number} tokenCount number of distinct query tokens.
   * @returns {WikiSearchTokenOccurrence[]} occurrences in the tightest window.
   */
  private tightestTokenWindow(occurrences: WikiSearchTokenOccurrence[], tokenCount: number): WikiSearchTokenOccurrence[] {
    const orderedOccurrences = [...occurrences].sort((left, right) => left.start - right.start || left.end - right.end || this.tokenMatchCost(left) - this.tokenMatchCost(right));
    const counts = new Array<number>(tokenCount).fill(0);
    let matchedTokenCount = 0;
    let left = 0;
    let bestLeft = 0;
    let bestRight = orderedOccurrences.length - 1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let right = 0; right < orderedOccurrences.length; right += 1) {
      const rightOccurrence = orderedOccurrences[right]!;
      if ((counts[rightOccurrence.tokenIndex] ?? 0) === 0) {
        matchedTokenCount += 1;
      }
      counts[rightOccurrence.tokenIndex] = (counts[rightOccurrence.tokenIndex] ?? 0) + 1;
      while (matchedTokenCount === tokenCount && left <= right) {
        const window = orderedOccurrences.slice(left, right + 1);
        const cost = rightOccurrence.end - orderedOccurrences[left]!.start + window.reduce((total, occurrence) => total + this.tokenMatchCost(occurrence) * WIKI_SEARCH_PREVIEW_LENGTH, 0);
        if (cost < bestCost) {
          bestLeft = left;
          bestRight = right;
          bestCost = cost;
        }
        const leftOccurrence = orderedOccurrences[left]!;
        counts[leftOccurrence.tokenIndex] = (counts[leftOccurrence.tokenIndex] ?? 0) - 1;
        if ((counts[leftOccurrence.tokenIndex] ?? 0) === 0) {
          matchedTokenCount -= 1;
        }
        left += 1;
      }
    }
    const selectedOccurrences = new Map<number, WikiSearchTokenOccurrence>();
    if (Number.isFinite(bestCost)) {
      for (const occurrence of orderedOccurrences.slice(bestLeft, bestRight + 1)) {
        const selectedOccurrence = selectedOccurrences.get(occurrence.tokenIndex) ?? null;
        if (selectedOccurrence === null || this.tokenMatchCost(occurrence) < this.tokenMatchCost(selectedOccurrence)) {
          selectedOccurrences.set(occurrence.tokenIndex, occurrence);
        }
      }
    }
    return [...selectedOccurrences.values()].sort((leftRange, rightRange) => leftRange.start - rightRange.start);
  }

  /**
   * Expands a normalized substring to complete word boundaries.
   *
   * @private
   * @param {string} text normalized field text.
   * @param {number} start substring start offset.
   * @param {number} end substring end offset.
   * @returns {WikiSearchMatchRange} complete normalized word range.
   */
  private normalizedWordRange(text: string, start: number, end: number): WikiSearchMatchRange {
    let wordStart = start;
    let wordEnd = end;
    while (wordStart > 0 && this.isSearchWordCharacter(text.charAt(wordStart - 1))) {
      wordStart -= 1;
    }
    while (wordEnd < text.length && this.isSearchWordCharacter(text.charAt(wordEnd))) {
      wordEnd += 1;
    }
    return {start: wordStart, end: wordEnd};
  }

  /**
   * Returns the relevance cost of a token occurrence.
   *
   * @private
   * @param {WikiSearchTokenOccurrence} occurrence token occurrence.
   * @returns {number} lower cost for more exact matches.
   */
  private tokenMatchCost(occurrence: WikiSearchTokenOccurrence): number {
    let exactnessCost = 2;
    if (occurrence.exact) {
      exactnessCost = occurrence.wholeWord ? 0 : 1;
    }
    return occurrence.distance * 4 + exactnessCost;
  }

  /**
   * Merges overlapping whole-word ranges before preview rendering.
   *
   * @private
   * @param {WikiSearchMatchRange[]} ranges ordered source ranges.
   * @returns {WikiSearchMatchRange[]} non-overlapping source ranges.
   */
  private mergeMatchRanges(ranges: WikiSearchMatchRange[]): WikiSearchMatchRange[] {
    const mergedRanges: WikiSearchMatchRange[] = [];
    for (const range of [...ranges].sort((left, right) => left.start - right.start || left.end - right.end)) {
      const previousRange = mergedRanges.at(-1) ?? null;
      if (previousRange !== null && range.start <= previousRange.end) {
        previousRange.end = Math.max(previousRange.end, range.end);
      } else {
        mergedRanges.push({...range});
      }
    }
    return mergedRanges;
  }

  /**
   * Creates a neutral passage match for title- or section-only results.
   *
   * @private
   * @returns {WikiSearchPassageMatch} empty passage match.
   */
  private emptyPassageMatch(): WikiSearchPassageMatch {
    return {
      ranges: [],
      ordered: false,
      phrase: false,
      distance: 0,
      span: WIKI_SEARCH_PREVIEW_LENGTH
    };
  }

  /**
   * Whether a normalized character belongs to a searchable word.
   *
   * @private
   * @param {string} character normalized character.
   * @returns {boolean} true for letters, numbers, and underscores.
   */
  private isSearchWordCharacter(character: string): boolean {
    return /[\p{Letter}\p{Number}_]/u.test(character);
  }

  /**
   * Maps a normalized range back to source passage offsets.
   *
   * @private
   * @param {WikiSearchNormalizedValue} passage normalized passage and offset map.
   * @param {WikiSearchMatchRange} range normalized match range.
   * @returns {WikiSearchMatchRange} source match range.
   */
  private toSourceRange(passage: WikiSearchNormalizedValue, range: WikiSearchMatchRange): WikiSearchMatchRange {
    const start = passage.sourceOffsets[range.start] ?? 0;
    const end = passage.sourceOffsets[range.end] ?? passage.sourceLength;
    return {start, end};
  }

  /**
   * Builds a compact passage preview with matched segments.
   *
   * @private
   * @param {string} text source passage text.
   * @param {WikiSearchMatchRange[]} ranges source match ranges.
   * @returns {WikiSearchPreviewSegment[]} preview display segments.
   */
  private createPreview(text: string, ranges: WikiSearchMatchRange[]): WikiSearchPreviewSegment[] {
    const firstMatch = ranges[0] ?? {start: 0, end: 0};
    const lastMatch = ranges[ranges.length - 1] ?? firstMatch;
    const matchCenter = Math.floor((firstMatch.start + lastMatch.end) / 2);
    let previewStart = Math.max(0, matchCenter - Math.floor(WIKI_SEARCH_PREVIEW_LENGTH / 2));
    let previewEnd = Math.min(text.length, previewStart + WIKI_SEARCH_PREVIEW_LENGTH);
    previewStart = this.moveToWordBoundary(text, previewStart, -1);
    previewEnd = this.moveToWordBoundary(text, previewEnd, 1);
    if (previewEnd - previewStart > WIKI_SEARCH_PREVIEW_LENGTH * 1.5) {
      previewEnd = Math.min(text.length, previewStart + WIKI_SEARCH_PREVIEW_LENGTH);
    }
    const segments: WikiSearchPreviewSegment[] = [];
    if (previewStart > 0) {
      segments.push({text: '…', matched: false});
    }
    let cursor = previewStart;
    for (const range of ranges) {
      const start = Math.max(previewStart, range.start);
      const end = Math.min(previewEnd, range.end);
      if (start < previewEnd && end > previewStart) {
        if (start > cursor) {
          segments.push({text: text.slice(cursor, start), matched: false});
        }
        segments.push({text: text.slice(start, end), matched: true});
        cursor = end;
      }
    }
    if (cursor < previewEnd) {
      segments.push({text: text.slice(cursor, previewEnd), matched: false});
    }
    if (previewEnd < text.length) {
      segments.push({text: '…', matched: false});
    }
    return segments;
  }

  /**
   * Creates a native text directive with short disambiguating context.
   *
   * @private
   * @param {WikiSearchPassage} passage source passage and rendered block boundaries.
   * @param {WikiSearchMatchRange[]} ranges source match ranges.
   * @returns {string | null} encoded directive value, or null without a passage match.
   */
  private createTextDirective(passage: WikiSearchPassage, ranges: WikiSearchMatchRange[]): string | null {
    let directive: string | null = null;
    if (ranges.length > 0) {
      const firstRange = ranges[0]!;
      const lastRange = ranges.at(-1)!;
      const firstBlock = this.textDirectiveBlock(passage.textBlocks, firstRange.start);
      const lastBlock = this.textDirectiveBlock(passage.textBlocks, lastRange.end - 1);
      if (firstBlock !== null && lastBlock !== null) {
        const prefix = this.textDirectiveContext(passage.text.slice(firstBlock.start, firstRange.start), -1);
        const suffix = this.textDirectiveContext(passage.text.slice(lastRange.end, lastBlock.end), 1);
        const start = passage.text.slice(firstRange.start, Math.min(firstRange.end, firstBlock.end));
        const spansMultipleTerms = ranges.length > 1 || firstBlock !== lastBlock;
        const end = spansMultipleTerms ? passage.text.slice(Math.max(lastRange.start, lastBlock.start), lastRange.end) : '';
        const prefixDirective = prefix.length > 0 ? `${this.encodeTextDirectiveTerm(prefix)}-,` : '';
        const endDirective = end.length > 0 ? `,${this.encodeTextDirectiveTerm(end)}` : '';
        const suffixDirective = suffix.length > 0 ? `,-${this.encodeTextDirectiveTerm(suffix)}` : '';
        directive = `${prefixDirective}${this.encodeTextDirectiveTerm(start)}${endDirective}${suffixDirective}`;
      }
    }
    return directive;
  }

  /**
   * Finds the rendered block containing a passage-text offset.
   *
   * @private
   * @param {WikiSearchTextBlock[]} blocks rendered block ranges.
   * @param {number} offset passage-text offset.
   * @returns {WikiSearchTextBlock | null} containing block, or null outside rendered text.
   */
  private textDirectiveBlock(blocks: WikiSearchTextBlock[], offset: number): WikiSearchTextBlock | null {
    let selectedBlock: WikiSearchTextBlock | null = null;
    for (const block of blocks) {
      if (selectedBlock === null && offset >= block.start && offset < block.end) {
        selectedBlock = block;
      }
    }
    return selectedBlock;
  }

  /**
   * Selects up to three nearest context words for a native text directive.
   *
   * @private
   * @param {string} text source text before or after the target.
   * @param {-1 | 1} direction whether context precedes or follows the target.
   * @returns {string} nearest context words.
   */
  private textDirectiveContext(text: string, direction: -1 | 1): string {
    const words = text.trim().split(/\s+/u).filter(word => word.length > 0);
    return direction < 0 ? words.slice(-3).join(' ') : words.slice(0, 3).join(' ');
  }

  /**
   * Builds the browser-facing result URL under the configured application base path.
   *
   * @private
   * @param {WikiSearchPassage} passage matching passage.
   * @param {string} fallbackFragment nearest heading fragment.
   * @param {string | null} textDirective optional encoded text directive.
   * @returns {string} deployable Wiki result URL.
   */
  private createResultHref(passage: WikiSearchPassage, fallbackFragment: string, textDirective: string | null): string {
    const basePath = new URL(this.document.baseURI).pathname.replace(/\/$/, '');
    const pagePath = passage.pageSlug === 'home' ? `${basePath}/wiki/` : `${basePath}/wiki/${encodeURIComponent(passage.pageSlug)}/`;
    const encodedFallback = encodeURIComponent(fallbackFragment);
    const fragment = textDirective === null ? encodedFallback : `${encodedFallback}:~:text=${textDirective}`;
    return `${pagePath}#${fragment}`;
  }

  /**
   * Encodes a text-directive term, including directive-reserved hyphens.
   *
   * @private
   * @param {string} value source term.
   * @returns {string} encoded directive term.
   */
  private encodeTextDirectiveTerm(value: string): string {
    return encodeURIComponent(value).replaceAll('-', '%2D');
  }

  /**
   * Navigates a keyboard-selected result using its preferred strategy.
   *
   * @private
   * @param {WikiSearchResult} result selected result.
   */
  private navigateToResult(result: WikiSearchResult): void {
    const window = this.document.defaultView;
    if (result.usesNativeTextFragment && window !== null) {
      window.location.assign(result.href);
    } else {
      this.navigateWithAngular(result);
    }
  }

  /**
   * Navigates to an ordinary heading fragment through Angular routing.
   *
   * @private
   * @param {WikiSearchResult} result selected result.
   */
  private navigateWithAngular(result: WikiSearchResult): void {
    const commands = result.passage.pageSlug === 'home' ? ['/wiki'] : ['/wiki', result.passage.pageSlug];
    this.resetSearch();
    this.router.navigate(commands, {fragment: result.fallbackFragment}).catch(error => console.error('Failed to navigate to Wiki search result:', error));
  }

  /**
   * Resets all user-visible search state.
   *
   * @private
   */
  private resetSearch(): void {
    this.query = '';
    this.results = [];
    this.activeResultIndex = -1;
    this.queryReady = false;
    this.dismissed = false;
  }

  /**
   * Normalizes text for accent-insensitive matching while retaining source offsets.
   *
   * @private
   * @param {string} value source text.
   * @returns {WikiSearchNormalizedValue} normalized text and source-offset mapping.
   */
  private normalizeValue(value: string): WikiSearchNormalizedValue {
    let text = '';
    const sourceOffsets: number[] = [];
    let sourceOffset = 0;
    for (const sourceCharacter of value) {
      const normalizedCharacter = sourceCharacter.normalize('NFD').replace(/\p{Mark}/gu, '').toLocaleLowerCase();
      for (const normalizedCodePoint of normalizedCharacter) {
        const whitespace = /\s/u.test(normalizedCodePoint);
        if (whitespace) {
          if (text.length > 0 && !text.endsWith(' ')) {
            text += ' ';
            sourceOffsets.push(sourceOffset);
          }
        } else {
          text += normalizedCodePoint;
          sourceOffsets.push(sourceOffset);
        }
      }
      sourceOffset += sourceCharacter.length;
    }
    if (text.endsWith(' ')) {
      text = text.slice(0, -1);
      sourceOffsets.pop();
    }
    return {
      text,
      sourceOffsets,
      sourceLength: value.length
    };
  }

  /**
   * Moves a preview edge toward the nearest whitespace boundary.
   *
   * @private
   * @param {string} text source passage text.
   * @param {number} offset requested preview offset.
   * @param {-1 | 1} direction boundary-search direction.
   * @returns {number} adjusted preview offset.
   */
  private moveToWordBoundary(text: string, offset: number, direction: -1 | 1): number {
    let boundary = offset;
    if (direction < 0) {
      while (boundary > 0 && !/\s/u.test(text.charAt(boundary - 1))) {
        boundary -= 1;
      }
    } else {
      while (boundary < text.length && !/\s/u.test(text.charAt(boundary))) {
        boundary += 1;
      }
    }
    return boundary;
  }
}
