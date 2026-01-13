import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MusicPlayerProvider } from '../../contexts/MusicPlayerContext'
import Home from '../Home'

// Mock the music.json fetch
global.fetch = vi.fn()

// Mock child components to simplify testing
vi.mock('../../components/MusicPlayerUI', () => ({
  default: () => <div data-testid="music-player-ui">MusicPlayerUI</div>
}))

vi.mock('../../components/Hero', () => ({
  default: () => <div data-testid="hero">Hero</div>
}))

vi.mock('../../components/StreamingLinks', () => ({
  default: () => <div data-testid="streaming-links">StreamingLinks</div>
}))

vi.mock('../../components/Bio', () => ({
  default: () => <div data-testid="bio">Bio</div>
}))

vi.mock('../../components/Footer', () => ({
  default: () => <div data-testid="footer">Footer</div>
}))

vi.mock('../../components/AnimatedSection', () => ({
  default: ({ children }) => <div>{children}</div>
}))

describe('Home', () => {
  beforeEach(() => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { name: 'Track 1', url: 'https://example.com/track1.mp3' }
      ]
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders all main components', () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <MusicPlayerProvider>
          <Home />
        </MusicPlayerProvider>
      </MemoryRouter>
    )

    expect(getByTestId('music-player-ui')).toBeInTheDocument()
    expect(getByTestId('hero')).toBeInTheDocument()
    expect(getByTestId('streaming-links')).toBeInTheDocument()
    expect(getByTestId('bio')).toBeInTheDocument()
    expect(getByTestId('footer')).toBeInTheDocument()
  })

  it('renders with correct container classes', () => {
    const { container } = render(
      <MemoryRouter>
        <MusicPlayerProvider>
          <Home />
        </MusicPlayerProvider>
      </MemoryRouter>
    )

    // The Home component's div is nested inside the router/provider wrappers
    const mainDiv = container.querySelector('.max-w-4xl')
    expect(mainDiv).toBeInTheDocument()
    expect(mainDiv).toHaveClass('max-w-4xl', 'mx-auto', 'p-4', 'md:p-8', 'space-y-8')
  })
})
