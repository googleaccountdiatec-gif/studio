export interface CrossReference {
  domain: 'capa' | 'change-action'
  id: string
  rawMatch: string
}

/**
 * Parses Change Reason text from Document KPI records to find
 * references to CAPAs and Change Actions (CMIDs).
 *
 * Examples of matched patterns:
 *   "CAPA281: Added field for signature" → { domain: 'capa', id: '281' }
 *   "CMID15: Change of company name"     → { domain: 'change-action', id: '15' }
 *   "Change Action 578: Update Doc"      → { domain: 'change-action', id: '578' }
 *   "according to CAPA 073"              → { domain: 'capa', id: '73' }
 *   "CA600.Used text..."                 → { domain: 'change-action', id: '600' }
 */
export function parseCrossReferences(changeReason: string | undefined | null): CrossReference[] {
  if (!changeReason) return []

  const refs: CrossReference[] = []
  const seen = new Set<string>()

  const patterns: { regex: RegExp; domain: CrossReference['domain'] }[] = [
    { regex: /CAPA\s*0*(\d+)/gi, domain: 'capa' },
    { regex: /CMID\s*0*(\d+)/gi, domain: 'change-action' },
    { regex: /(?:Change Action|CA)\s*0*(\d+)/gi, domain: 'change-action' },
  ]

  for (const { regex, domain } of patterns) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(changeReason)) !== null) {
      const id = match[1]
      const key = `${domain}-${id}`
      if (!seen.has(key)) {
        seen.add(key)
        refs.push({ domain, id, rawMatch: match[0] })
      }
    }
  }

  return refs
}

/**
 * Finds all documents whose Change Reason references a given CAPA ID or CMID.
 */
export function findLinkedDocuments(
  documents: { 'Change Reason'?: string; [key: string]: any }[],
  domain: 'capa' | 'change-action',
  id: string
): typeof documents {
  return documents.filter(doc => {
    const refs = parseCrossReferences(doc['Change Reason'])
    return refs.some(ref => ref.domain === domain && ref.id === id)
  })
}
