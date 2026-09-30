// "An den Startbildschirm anheften": ein Elternteil tippt auf das 📌 neben einer Hören-Kachel oder
// einer Bibliothek-Zeile, und eine Kopie davon erscheint auf der Startseite; nochmal antippen entfernt
// sie wieder. Der Index eines Eintrags in active_data.json verschiebt sich bei jedem Sync/Edit/Delete
// (siehe ENTRY_IDENT/entryIdent in app.js, wie schon die Wiedergabe selbst Einträge identifiziert) — ein
// angehefteter Eintrag wird deshalb als natürlicher Schlüssel gespeichert (type/id/…/title/artist), nicht
// als Index.

import type { Router } from 'express'
import type { MupiboxConfig } from '../models/mupibox-config.model'
import { requireCsrf, requireSession } from './middleware'

export interface PinnedItemsDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
  updateMupiboxConfig: (mutate: (cfg: Record<string, unknown>) => void) => Promise<void>
}

const IDENT_KEYS = ['type', 'id', 'playlistid', 'showid', 'audiobookid', 'artistid', 'title', 'artist'] as const
type Ident = Record<(typeof IDENT_KEYS)[number], unknown>

function isIdent(value: unknown): value is Ident {
  if (!value || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  return IDENT_KEYS.every((k) => k in rec)
}

function sameIdent(a: Ident, b: Ident): boolean {
  return IDENT_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null))
}

/**
 * GET /pinned-items
 * Die angehefteten Einträge als natürliche Schlüssel (kein Index). Die WebApp
 * gleicht sie gegen die ohnehin geladene /api/data ab, um Cover/Titel zu zeigen.
 *
 * POST /pinned-items  { ident, pinned }
 * Heftet einen Schlüssel an oder entfernt ihn wieder.
 */
export function registerPinnedItemsRoutes(router: Router, deps: PinnedItemsDeps): void {
  router.get('/pinned-items', requireSession, (_req, res) => {
    const cfg = deps.getMupiboxConfig()
    const raw = Array.isArray(cfg?.pinnedItems) ? (cfg?.pinnedItems as unknown[]) : []
    res.json({ items: raw.filter(isIdent) })
  })

  router.post('/pinned-items', requireSession, requireCsrf, async (req, res) => {
    const body = (req.body as { ident?: unknown; pinned?: unknown } | undefined) ?? {}
    if (!isIdent(body.ident)) {
      res.status(400).json({ error: 'invalid_ident' })
      return
    }
    const ident = body.ident
    const pin = body.pinned !== false
    await deps.updateMupiboxConfig((cfg) => {
      const list = (Array.isArray(cfg.pinnedItems) ? (cfg.pinnedItems as unknown[]) : []).filter(isIdent)
      const withoutThis = list.filter((existing) => !sameIdent(existing, ident))
      cfg.pinnedItems = pin ? [...withoutThis, ident] : withoutThis
    })
    res.json({ ok: true })
  })
}
