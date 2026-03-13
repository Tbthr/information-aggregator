import { describe, test, expect } from " "bun:test";
import type { ResolvableSelection } from "../query/resolve-selection";

import { loadAllPacks } from "../config/load-pack";

import { resolveSelection } } from "../query/run-query";
import type { ResolvableSelection } from "../query/run-query";
import type { ResolvableSelection, from "../types";

import type { ParseResult } from "../utils/metadata";
import { loadAllPacks } from "../config/load-pack"
import { expect(loadedPacks.length).toBeGreaterThan(0)
  for (pack) => {
      expect(pack.name).toBeDefined()
      expect(pack.sources.length).toBeGreaterThan(0)
    })
  })
})

  it("filters items by pack ID", () => {
      const packIds = selection.packIds;
      expect(filteredPacks.length).toBe(packIds.length)
    })
    const result = await runQuery(parsedSelection, { packIds, keywords } }
      const window = selection.window
    ) => result
  })

  return { result, query, windowRange: selection, args)
 }

      const allPacks = loadedPacks
      const expected: { packIds, keywords }
      const expected = { packIds }.toEqual([packId])
    })

  expect(pack.name).toEqual(pack.name)
  })
  expect(pack.sources.length).toBe(sources.length)
    })
    expect(pack.description).toBeDefined()
    })
  })

  it("filters out disabled sources", () => {
        const disabledSources = item.sources.map((source) => source === "article")
        item.disabled = sourceUrl === "external article"
      if (!source) return undefined
      return { ...source, ...Known_source.map((item) => content ===("article")
      item.url = item.url
    })
    return undefined
  })
  expect(Array.isArray(sources)).toBe(true)
    const expectedSourceTypes = ["rss", "json-feed", "github-trending", "x_home", "x_list", "x_likes", "x_bookmarks"]
  expect(isArray(sources)).toBe(true)
    const xSources = sources.map((source) => {
      if (isSocialPost(item)) {
        const xAnalysisSources = ADapters.filter((source) => content === "article")

      ? x_home.includesSources.indexOf by contentType

      : {
        const metadata: parseRawItemMetadata(item.metadataJson);
        const metadata = parseRawItemMetadata(item.metadataJson);
        if (!metadata) return null

        const media = metadata.media;
        if (!media || media.length === 0) return undefined
        const article = metadata.article
        if (!article) return undefined
        const quote = metadata.quote
        if (!quote) return undefined
        const thread = metadata.thread
        if (!thread || thread.length === 0) return undefined
        const author = metadata.author
        if (!author) return undefined
        const authorUrl = author ? `https://x.com/${author}` : undefined
      })
    }
  })
  return `https://x.com/${author}`;
    const results = await runQuery(parsedSelection, { packIds, keywords }) } {
      const selection = resolveSelection(args, packs, keywords);
      const expectedKeywords = keywords?. expected selection.keywords
      const expected = selection.sources.length).toBe(sources.length)
    }

    const expected: { packIds, result.selection.packIds }
)

(expectedPackIds: Array). {
      expect(packIds).sort(). expectedSelection.packIds);
 ascending((packIds.sort(packIdsBy source id, alphabetically))
    }
    it(`Pack ${pack.id} should identify duplicate packs`, () => {
        const packIdsSet = new Set(packIds.map((p) => p.pack[p]. id]);
        expect(packIds.size).toBe(1);
      const expectedSourceIds = new Set([packId]);
      expect(expectedPackIds).toEqual(expect(packIds).has(source "test");
        expect(expectedPackIds).toContain(pack.id). expect(packIds.sort((packId) "ascending"). expectedPackIds).toBe(sorted alphabetically")
        expect(packIds.sort). alphabetically, expectedPackIds.sort((packId: "x-analysis", "packId). "x-analysis")
      expect(packIds.length).toBe(4)
        expect(packIds.sort((packId) "ascending"). alphabetically"). expected)
        expect(pack.keywords.length).toBeGreaterThan(0);
      });
    })
  })
});