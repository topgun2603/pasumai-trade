import "server-only";

import {
  BARGAIN_VOCABULARY,
  TOPICS,
  type Speaker,
  type Topic,
  type VocabularyEntry,
} from "@/lib/domain/bargain-vocabulary";
import { LOCALES } from "@/lib/i18n/config";

import { adminDb, hasAdminCredentials } from "./admin";

/**
 * What may be said in a bargain, as operations have it.
 *
 * Read from `bargainPhrases`, falling back to the shipped constant when there
 * are no Admin credentials or the collection is empty. Never falls back to
 * *nothing*: an empty vocabulary is a bargain screen with no way to speak, and
 * a Firestore hiccup must not silence the platform.
 *
 * The same function feeds the screens and the write guard, deliberately. If the
 * picker offered one list and the endpoint checked another, every phrase an
 * operator added would be a button that returns 422.
 */

/** Keeps only the six known languages, and only non-empty strings. */
function readText(value: unknown): Record<string, string> {
  const source = (value ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const locale of LOCALES) {
    const text = source[locale];
    if (typeof text === "string" && text.trim()) out[locale] = text.trim();
  }
  return out;
}

function readSpeaker(value: unknown): Speaker {
  // Defaults to `both` only when the field is a recognised value; anything
  // unreadable is treated below as a reason to drop the row entirely.
  return value === "farmer" || value === "buyer" || value === "both" ? value : "both";
}

function readTopic(value: unknown): Topic {
  return TOPICS.includes(value as Topic) ? (value as Topic) : "closing";
}

export async function readBargainVocabulary(): Promise<{
  vocabulary: VocabularyEntry[];
  /** False when this is the shipped list rather than the stored one. */
  live: boolean;
}> {
  if (!hasAdminCredentials()) {
    return { vocabulary: [...BARGAIN_VOCABULARY], live: false };
  }

  try {
    const snapshot = await adminDb().collection("bargainPhrases").get();
    if (snapshot.empty) return { vocabulary: [...BARGAIN_VOCABULARY], live: false };

    const vocabulary = snapshot.docs
      .map((doc): VocabularyEntry | null => {
        const data = doc.data();
        const text = readText(data.text);

        // English is the fallback every other language leans on. A row without
        // it would render as an empty button, so it is dropped rather than
        // shown blank.
        if (!text.en) return null;

        return {
          id: doc.id,
          text,
          speaker: readSpeaker(data.speaker),
          topic: readTopic(data.topic),
          active: data.active !== false,
        };
      })
      .filter((p): p is VocabularyEntry => p !== null);

    if (vocabulary.length === 0) {
      return { vocabulary: [...BARGAIN_VOCABULARY], live: false };
    }

    return { vocabulary, live: true };
  } catch {
    return { vocabulary: [...BARGAIN_VOCABULARY], live: false };
  }
}
