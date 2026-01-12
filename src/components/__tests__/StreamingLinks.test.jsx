import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StreamingLinks from '../StreamingLinks'

// Mock the image error handler
vi.mock('../utils/imageUtils', () => ({
  handleImageError: vi.fn()
}))

// Mock AnimatedSection to render children directly
vi.mock('../AnimatedSection', () => ({
  default: ({ children }) => children
}))

describe('StreamingLinks', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  it('renders the section heading', () => {
    render(<StreamingLinks />)
    expect(screen.getByText(/Listen Everywhere/i)).toBeInTheDocument()
  })

  it('renders all streaming service links', () => {
    render(<StreamingLinks />)
    expect(screen.getByText('Spotify')).toBeInTheDocument()
    expect(screen.getByText('Apple Music')).toBeInTheDocument()
    expect(screen.getByText('YouTube')).toBeInTheDocument()
    expect(screen.getByText('SoundCloud')).toBeInTheDocument()
  })

  it('links have correct hrefs and target attributes', () => {
    render(<StreamingLinks />)
    
    const spotifyLink = screen.getByText('Spotify').closest('a')
    expect(spotifyLink).toHaveAttribute('href', 'https://open.spotify.com/artist/09Fjrj2Ojg0e1YPlYxsiHj')
    expect(spotifyLink).toHaveAttribute('target', '_blank')
    expect(spotifyLink).toHaveAttribute('rel', 'noopener noreferrer')

    const appleMusicLink = screen.getByText('Apple Music').closest('a')
    expect(appleMusicLink).toHaveAttribute('href', 'https://music.apple.com/us/artist/neuronoiser/1843991502')
    expect(appleMusicLink).toHaveAttribute('target', '_blank')

    const youtubeLink = screen.getByText('YouTube').closest('a')
    expect(youtubeLink).toHaveAttribute('href', 'https://youtube.com/@neuronoiser')
    expect(youtubeLink).toHaveAttribute('target', '_blank')

    const soundcloudLink = screen.getByText('SoundCloud').closest('a')
    expect(soundcloudLink).toHaveAttribute('href', 'https://soundcloud.com/neuronoiser')
    expect(soundcloudLink).toHaveAttribute('target', '_blank')
  })

  it('matches snapshot', () => {
    const { container } = render(<StreamingLinks />)
    expect(container).toMatchSnapshot()
  })
})
