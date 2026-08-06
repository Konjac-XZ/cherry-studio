import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createUpdateTimestamps, uuidPrimaryKeyOrdered } from './_columnHelpers'
import { translateLanguageTable } from './translateLanguage'

/**
 * User glossary entries used to constrain translation terminology.
 *
 * Duplicate source phrases are rejected case-insensitively within one target
 * language by the service. Keeping the display spelling intact is intentional.
 */
export const translateGlossaryTable = sqliteTable(
  'translate_glossary',
  {
    id: uuidPrimaryKeyOrdered(),
    sourcePhrase: text().notNull(),
    targetPhrase: text().notNull(),
    targetLanguage: text()
      .notNull()
      .references(() => translateLanguageTable.langCode, { onDelete: 'cascade' }),
    enabled: integer({ mode: 'boolean' }).notNull().default(true),
    ...createUpdateTimestamps
  },
  (t) => [index('translate_glossary_target_language_idx').on(t.targetLanguage, t.createdAt)]
)
