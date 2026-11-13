import AnimatedSection from './AnimatedSection'

const X_URL = 'https://x.com/neuronoiser'

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
 */
function FollowLink() {
    return (
        <AnimatedSection delay={1100} animationType="animate-slide-in-bottom">
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
        </AnimatedSection>
    )
}

export default FollowLink
