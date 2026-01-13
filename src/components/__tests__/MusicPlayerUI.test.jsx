import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MusicPlayerProvider } from '../../contexts/MusicPlayerContext'
import MusicPlayerUI from '../MusicPlayerUI'

// Mock AnimatedSection
vi.mock('../AnimatedSection', () => ({
  default: ({ children }) => <div>{children}</div>
}))

global.fetch = vi.fn()

describe('MusicPlayerUI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Track 1', url: 'https://example.com/track1.mp3' }
      ]
    })

    render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    expect(screen.getByText(/Loading tracks.../i)).toBeInTheDocument()
  })

  it('renders track status when loaded', async () => {
    const mockTracks = [
      { name: 'Test Track', url: 'https://example.com/track.mp3' }
    ]

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockTracks
    })

    render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    // Wait for loading to complete
    await screen.findByText(/Featured Track: Test Track/i)
    expect(screen.getByText(/Featured Track: Test Track/i)).toBeInTheDocument()
  })

  it('renders play button', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Track 1', url: 'https://example.com/track1.mp3' }
      ]
    })

    render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    await screen.findByText(/PLAY TRACK/i)
    expect(screen.getByText(/PLAY TRACK/i)).toBeInTheDocument()
  })

  it('renders navigation buttons when multiple tracks', async () => {
    const mockTracks = [
      { name: 'Track 1', url: 'https://example.com/track1.mp3' },
      { name: 'Track 2', url: 'https://example.com/track2.mp3' }
    ]

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockTracks
    })

    render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    await screen.findByText(/PLAY TRACK/i)

    // Check for previous and next buttons (they have aria-labels)
    const prevButton = screen.getByLabelText(/Previous track/i)
    const nextButton = screen.getByLabelText(/Next track/i)

    expect(prevButton).toBeInTheDocument()
    expect(nextButton).toBeInTheDocument()
  })

  it('does not render navigation buttons for single track', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Track 1', url: 'https://example.com/track1.mp3' }
      ]
    })

    render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    await screen.findByText(/PLAY TRACK/i)

    const prevButton = screen.queryByLabelText(/Previous track/i)
    const nextButton = screen.queryByLabelText(/Next track/i)

    expect(prevButton).not.toBeInTheDocument()
    expect(nextButton).not.toBeInTheDocument()
  })

  it('renders error state', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'))

    render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    await screen.findByText(/ERROR: Failed to load tracks./i)
    expect(screen.getByText(/ERROR: Failed to load tracks./i)).toBeInTheDocument()
    expect(screen.getByText(/ERROR$/i)).toBeInTheDocument() // Button text
  })

  it('renders music player section with correct id', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Track 1', url: 'https://example.com/track1.mp3' }
      ]
    })

    const { container } = render(
      <MusicPlayerProvider>
        <MusicPlayerUI />
      </MusicPlayerProvider>
    )

    await screen.findByText(/PLAY TRACK/i)
    const playerSection = container.querySelector('#music-player')
    expect(playerSection).toBeInTheDocument()
  })
})
