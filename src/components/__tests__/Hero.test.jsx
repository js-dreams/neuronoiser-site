import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import Hero from '../Hero'

// Mock the image error handler
vi.mock('../utils/imageUtils', () => ({
  handleImageError: vi.fn()
}))

describe('Hero', () => {
  it('renders the hero title', () => {
    const { getByText } = render(<Hero />)
    expect(getByText('neuronoiser')).toBeInTheDocument()
  })

  it('renders the subtitle', () => {
    const { getByText } = render(<Hero />)
    expect(getByText('Smart Noise For Curious Ears')).toBeInTheDocument()
  })

  it('renders hero image with correct src', () => {
    const { container } = render(<Hero />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/cassette.jpeg')
    expect(img).toHaveAttribute('alt', 'Neuronoiser hero image: dark, stylized production setup')
  })

  it('matches snapshot', () => {
    const { container } = render(<Hero />)
    expect(container).toMatchSnapshot()
  })
})
