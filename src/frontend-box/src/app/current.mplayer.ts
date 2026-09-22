export interface CurrentMPlayer {
  activePlaylist?: string
  totalPlaylist?: number
  activeEpisode?: string
  activeShow?: string
  totalShows?: number
  currentPlayer?: string
  playing?: boolean
  pause?: boolean
  album?: string
  currentTrackname?: string
  currentTracknr?: number
  totalTracks?: number
  progressTime?: number
  volume?: number
  // Radio streams and podcasts are buffered before they start: how far that is (0-100).
  loading?: boolean
  loadProgress?: number
  // Phase 19 Stufe B: wer hat den letzten Command an den Player geschickt?
  // Display-Frontend ('box', Default), Eltern-WebApp ('eltern'),
  // Telegram-Bot ('telegram'). Display nutzt das um bei externer Wiedergabe
  // automatisch zur Player-View zu navigieren.
  triggerSource?: string
  triggerAt?: number
}
