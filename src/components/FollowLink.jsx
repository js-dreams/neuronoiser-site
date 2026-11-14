import AnimatedSection from './AnimatedSection'

const X_URL = 'https://x.com/neuronoiser'
const LINKTREE_URL = 'https://linktr.ee/neuronoiser'

/**
 * A single "follow on X" row, sitting between the streaming grid and the bio.
 *
 * Placement is the whole design decision here. It has to read as LESS central
 * than the album artwork and the Spotify link — so it is below both, has no
 * section heading of its own, and is one inline row rather than a card in the
 * grid. X is also not a place to listen, so putting it inside "Listen
 * Everywhere" would have been wrong twice over: semantically, and because a
 * fifth item breaks that two-column grid.
 *
 * But it has to be far MORE visible than the mailto in the footer, which is
 * 12px grey. So: full-width centred, cyan border that lights on hover, the
 * handle spelled out rather than a bare glyph.
 *
 * The mark is an inline SVG rather than a file in /logos — nothing to deploy,
 * nothing to 404, and it inherits currentColor so it picks up the neon cyan on
 * hover like the rest of the site.
 *
 * The Linktree row (added 14.11) is a peer of the X row, so it gets the
 * identical treatment: same class, same weight, side by side on desktop and
 * stacked on mobile (the labels are too long for half a phone width).
 */
function FollowLink() {
    return (
        <AnimatedSection delay={1100} animationType="animate-slide-in-bottom">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                    href={X_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Follow neuronoiser on X"
                    className="follow-link group"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="w-5 h-5 fill-current flex-shrink-0"
                    >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="font-mono text-sm md:text-base">
                        Follow <span className="text-neon-cyan">@neuronoiser</span> on X
                    </span>
                </a>
                <a
                    href={LINKTREE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="All neuronoiser links on Linktree"
                    className="follow-link group"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="w-5 h-5 fill-none stroke-current flex-shrink-0"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span className="font-mono text-sm md:text-base">
                        All links at <span className="text-neon-cyan">linktr.ee/neuronoiser</span>
                    </span>
                </a>
            </div>
        </AnimatedSection>
    )
}

export default FollowLink
