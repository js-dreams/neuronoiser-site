import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MusicPlayer from '../MusicPlayer'

// Mock AnimatedSection to render children directly
vi.mock('../AnimatedSection', () => ({
  default: ({ children }) => children
}))

// Mock fetch for music.json
global.fetch = vi.fn()

describe('MusicPlayer', () => {
  const mockTracks = [
    {
      name: 'Test Track 1',
      url: 'https://example.com/track1.mp3',
      spotifyURL: 'https://spotify.com/track1'
    },
    {
      name: 'Test Track 2',
      url: 'https://example.com/track2.mp3'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockTracks
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    render(<MusicPlayer />)
    expect(screen.getByText(/Loading tracks.../i)).toBeInTheDocument()
  })

  it('loads and displays tracks from music.json', async () => {
    render(<MusicPlayer />)
    
    await waitFor(() => {
      expect(screen.queryByText(/Loading tracks.../i)).not.toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith('/music.json')
    expect(screen.getByText(/Featured Track:/i)).toBeInTheDocument()
  })

  it('shows play button when tracks are loaded', async () => {
    render(<MusicPlayer />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /PLAY TRACK/i })).toBeInTheDocument()
    })
  })

  it('shows error state when music.json fails to load', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'))
    
    render(<MusicPlayer />)
    
    await waitFor(() => {
      expect(screen.getByText(/ERROR: Failed to load tracks/i)).toBeInTheDocument()
    })
  })

  it('shows error state when music.json is invalid', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })
    
    render(<MusicPlayer />)
    
    await waitFor(() => {
      expect(screen.getByText(/ERROR: Failed to load tracks/i)).toBeInTheDocument()
    })
  })

  it('renders status indicator', async () => {
    render(<MusicPlayer />)
    
    await waitFor(() => {
      const statusIndicator = document.querySelector('.status-indicator')
      expect(statusIndicator).toBeInTheDocument()
    })
  })

  // Note: Snapshot test removed due to non-deterministic random track selection
  // The component selects a random initial track, making snapshots unstable
})
