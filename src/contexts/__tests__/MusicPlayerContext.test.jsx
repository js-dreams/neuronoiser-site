import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MusicPlayerProvider, useMusicPlayerContext } from '../MusicPlayerContext'

// Mock gtag
global.gtag = vi.fn()

describe('MusicPlayerContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('throws error when useMusicPlayerContext is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderHook(() => useMusicPlayerContext())
    }).toThrow('useMusicPlayerContext must be used within MusicPlayerProvider')

    consoleSpy.mockRestore()
  })

  it('provides initial loading state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Track 1', url: 'https://example.com/track1.mp3' }
      ]
    })

    const wrapper = ({ children }) => (
      <MusicPlayerProvider>{children}</MusicPlayerProvider>
    )

    const { result } = renderHook(() => useMusicPlayerContext(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.trackStatus).toBe('Loading tracks...')
    expect(result.current.hasError).toBe(false)
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.buttonText).toBe('LOADING...')
  })

  it('loads tracks successfully', async () => {
    const mockTracks = [
      { name: 'Track 1', url: 'https://example.com/track1.mp3' },
      { name: 'Track 2', url: 'https://example.com/track2.mp3' }
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTracks
    })

    const wrapper = ({ children }) => (
      <MusicPlayerProvider>{children}</MusicPlayerProvider>
    )

    const { result } = renderHook(() => useMusicPlayerContext(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.tracks).toHaveLength(2)
    expect(result.current.tracks[0]).toEqual(mockTracks[0])
    expect(result.current.hasError).toBe(false)
    expect(result.current.buttonText).toBe('PLAY TRACK')
  })

  it('handles fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const wrapper = ({ children }) => (
      <MusicPlayerProvider>{children}</MusicPlayerProvider>
    )

    const { result } = renderHook(() => useMusicPlayerContext(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.hasError).toBe(true)
    expect(result.current.trackStatus).toBe('ERROR: Failed to load tracks.')
    expect(result.current.buttonText).toBe('ERROR')
  })

  it('provides handleNextTrack function', async () => {
    const mockTracks = [
      { name: 'Track 1', url: 'https://example.com/track1.mp3' },
      { name: 'Track 2', url: 'https://example.com/track2.mp3' }
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTracks
    })

    const wrapper = ({ children }) => (
      <MusicPlayerProvider>{children}</MusicPlayerProvider>
    )

    const { result } = renderHook(() => useMusicPlayerContext(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const initialIndex = result.current.currentTrackIndex

    act(() => {
      result.current.handleNextTrack()
    })

    await waitFor(() => {
      expect(result.current.currentTrackIndex).toBe((initialIndex + 1) % mockTracks.length)
    })
  })

  it('provides handlePreviousTrack function', async () => {
    const mockTracks = [
      { name: 'Track 1', url: 'https://example.com/track1.mp3' },
      { name: 'Track 2', url: 'https://example.com/track2.mp3' }
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTracks
    })

    const wrapper = ({ children }) => (
      <MusicPlayerProvider>{children}</MusicPlayerProvider>
    )

    const { result } = renderHook(() => useMusicPlayerContext(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    const initialIndex = result.current.currentTrackIndex

    // Move to next track
    act(() => {
      result.current.handleNextTrack()
    })

    await waitFor(() => {
      const nextIndex = (initialIndex + 1) % mockTracks.length
      expect(result.current.currentTrackIndex).toBe(nextIndex)
    })

    const nextIndex = result.current.currentTrackIndex

    // Move back to previous track
    act(() => {
      result.current.handlePreviousTrack()
    })

    await waitFor(() => {
      const prevIndex = (nextIndex - 1 + mockTracks.length) % mockTracks.length
      expect(result.current.currentTrackIndex).toBe(prevIndex)
    })
  })

  it('provides audioRef', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'Track 1', url: 'https://example.com/track1.mp3' }]
    })

    const wrapper = ({ children }) => (
      <MusicPlayerProvider>{children}</MusicPlayerProvider>
    )

    const { result } = renderHook(() => useMusicPlayerContext(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.audioRef).toBeDefined()
    expect(result.current.audioRef.current).toBeInstanceOf(HTMLAudioElement)
  })
})
