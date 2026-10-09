import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import AlbumRelease from '../AlbumRelease'

describe('AlbumRelease', () => {
  it('renders the section heading', () => {
    const { getByText } = render(<AlbumRelease />)
    expect(getByText(/New Album - Available Now!/i)).toBeInTheDocument()
  })

  it('links the artwork to the album', () => {
    const { container } = render(<AlbumRelease />)
    const link = container.querySelector('a')
    expect(link).toHaveAttribute('href', 'https://self-awareness.neuronoiser.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the artwork with a descriptive alt', () => {
    const { container } = render(<AlbumRelease />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/albums/self-awareness-is-overrated.webp')
    expect(img.getAttribute('alt')).toMatch(/Self Awareness Is Overrated/i)
  })

  it('matches snapshot', () => {
    const { container } = render(<AlbumRelease />)
    expect(container).toMatchSnapshot()
  })
})
