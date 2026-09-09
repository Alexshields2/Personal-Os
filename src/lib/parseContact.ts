/**
 * Turning OCR'd screenshot text into a contact draft.
 *
 * This is a guess, and it is presented to you as a guess — the fields it fills
 * are editable before anything is saved. OCR misreads names, and a headline
 * like "Founder | Building the future of X" has no company in it at all, so
 * the honest output is often partial.
 *
 * Tuned for LinkedIn profile and search-result screenshots, which put the name
 * first and the headline directly beneath it.
 */

export interface ContactDraft {
  name: string
  role: string
  company: string
}

/** Chrome LinkedIn puts on the page that is never part of a person's details. */
const NOISE =
  /^(message|connect|follow|following|more|pending|1st|2nd|3rd|view profile|mutual|shared|open to|premium|see all|about|activity|experience|education|skills|contact info|linkedin|home|my network|jobs|notifications)\b/i

/** Job titles worth recognising even when they are not followed by "at". */
const TITLE_WORDS =
  /\b(ceo|coo|cfo|cto|cmo|founder|co-?founder|owner|director|managing director|md|partner|president|vp|vice president|head of [a-z ]+|chief [a-z ]+ officer|general manager|principal)\b/i

function clean(line: string): string {
  return line
    .replace(/[|•·]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Company names are structurally identical to people's names — "Some Company
 * Ltd" is three capitalised words, same as "Mary Jane Doyle". A legal or
 * trading suffix is the one reliable tell.
 */
const COMPANY_SUFFIX =
  /\b(ltd|limited|inc|llc|llp|plc|gmbh|bv|nv|sa|ag|pty|co|corp|corporation|group|holdings|partners|ventures|capital|labs|studio|studios|agency|media|consulting|solutions|technologies|technology|systems|services|global|international)\.?$/i

/** A plausible human name: two to four capitalised words, no digits. */
function looksLikeName(line: string): boolean {
  const l = clean(line)
  if (!l || l.length > 48 || /\d/.test(l)) return false
  if (NOISE.test(l)) return false
  if (TITLE_WORDS.test(l)) return false
  if (/[@:/]/.test(l)) return false
  if (COMPANY_SUFFIX.test(l)) return false
  const words = l.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 4) return false
  // Allow O'Brien, Ní Mhurchú, hyphenated and accented names.
  return words.every((w) => /^[A-ZÀ-Þ][A-Za-zÀ-ÿ'’-]*\.?$/.test(w))
}

/**
 * Pulls role and company out of a headline. Handles the common shapes:
 * "CEO at Acme", "Founder & CEO, Acme", "Acme | CEO", "CEO @ Acme".
 */
export function splitHeadline(headline: string): { role: string; company: string } {
  const h = clean(headline)
  if (!h) return { role: '', company: '' }

  const at = h.match(/^(.*?)\s+(?:at|@|of)\s+(.+)$/i)
  if (at) {
    return { role: clean(at[1]), company: clean(at[2]).replace(/[.,]$/, '') }
  }

  // "CEO, Acme" — only when the left side actually reads as a title, so
  // "Dublin, Ireland" is not mistaken for a role at a company.
  const comma = h.match(/^(.*?),\s*(.+)$/)
  if (comma && TITLE_WORDS.test(comma[1])) {
    return { role: clean(comma[1]), company: clean(comma[2]) }
  }

  if (TITLE_WORDS.test(h)) return { role: h, company: '' }
  return { role: '', company: h }
}

export function parseContact(text: string): ContactDraft {
  const lines = text
    .split(/\r?\n/)
    .map(clean)
    .filter((l) => l.length > 1 && !NOISE.test(l))

  const nameIdx = lines.findIndex(looksLikeName)
  const name = nameIdx >= 0 ? lines[nameIdx] : ''

  // The headline is the first line after the name that carries a title or an
  // "at"; failing that, simply the next line.
  const rest = nameIdx >= 0 ? lines.slice(nameIdx + 1) : lines
  const headline =
    rest.find((l) => TITLE_WORDS.test(l) || /\s(?:at|@)\s/i.test(l)) ?? rest[0] ?? ''

  const { role, company } = splitHeadline(headline)
  return { name, role, company }
}
