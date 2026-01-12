import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Bio from '../Bio'

describe('Bio', () => {
  it('renders the section heading', () => {
    const { getByText } = render(<Bio />)
    expect(getByText(/About The Artist/i)).toBeInTheDocument()
  })

  it('renders bio content with key terms', () => {
    const { getByText } = render(<Bio />)
    expect(getByText(/Mixed-Intelligence/i)).toBeInTheDocument()
    expect(getByText(/Danny Reiser/i)).toBeInTheDocument()
    expect(getByText(/neuronoiser/i)).toBeInTheDocument()
  })

  it('matches snapshot', () => {
    const { container } = render(<Bio />)
    expect(container).toMatchSnapshot()
  })
})
