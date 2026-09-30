// "An den Startbildschirm anheften": ein Elternteil tippt auf das 📌 neben der Überschrift einer
// beliebigen Einstellungs-Karte (nur Karten mit Überschrift - ohne H2 gibt es keinen Pin); eine Kopie
// der ganzen Karte (mit ihren Reglern/Schaltern, weiterhin bedienbar) erscheint dann auf der Startseite.
// Nochmal antippen (auf der Original-Karte oder der Kopie) entfernt sie wieder.
//
// Eine Karte kommt aus schema.json und hat dort keine eigene id - identifiziert wird sie deshalb über
// die Seite, auf der sie steht, plus ihre (auf einer Seite eindeutige) Überschrift.

import type { Router } from 'express'
import type { MupiboxConfig } from '../models/mupibox-config.model'
import { requireCsrf, requireSession } from './middleware'

export interface PinnedSectionsDeps {
  getMupiboxConfig: () => MupiboxConfig | undefined
  updateMupiboxConfig: (mutate: (cfg: Record<string, unknown>) => void) => Promise<void>
}

interface PinnedSection {
  pageId: string
  title: string
}

function isPinnedSection(value: unknown): value is PinnedSection {
  if (!value || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  return typeof rec.pageId === 'string' && rec.pageId.length > 0 && typeof rec.title === 'string' && rec.title.length > 0
}

function sameSection(a: PinnedSection, b: PinnedSection): boolean {
  return a.pageId === b.pageId && a.title === b.title
}

/**
 * GET /pinned-sections
 * POST /pinned-sections  { pageId, title, pinned }
 */
export function registerPinnedSectionsRoutes(router: Router, deps: PinnedSectionsDeps): void {
  router.get('/pinned-sections', requireSession, (_req, res) => {
    const cfg = deps.getMupiboxConfig()
    const raw = Array.isArray(cfg?.pinnedSections) ? (cfg?.pinnedSections as unknown[]) : []
    res.json({ items: raw.filter(isPinnedSection) })
  })

  router.post('/pinned-sections', requireSession, requireCsrf, async (req, res) => {
    const body = (req.body as { pageId?: unknown; title?: unknown; pinned?: unknown } | undefined) ?? {}
    const section = { pageId: body.pageId, title: body.title }
    if (!isPinnedSection(section)) {
      res.status(400).json({ error: 'invalid_section' })
      return
    }
    const pin = body.pinned !== false
    await deps.updateMupiboxConfig((cfg) => {
      const list = (Array.isArray(cfg.pinnedSections) ? (cfg.pinnedSections as unknown[]) : []).filter(isPinnedSection)
      const withoutThis = list.filter((existing) => !sameSection(existing, section))
      cfg.pinnedSections = pin ? [...withoutThis, section] : withoutThis
    })
    res.json({ ok: true })
  })
}
