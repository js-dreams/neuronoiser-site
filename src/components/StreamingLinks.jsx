import { handleImageError } from '../utils/imageUtils'

const SECTION_HEADING_CLASS = "text-l md:text-4xl font-mono font-semibold text-neon-cyan border-b-2 border-neon-cyan/50 pb-2"

function StreamingLinks() {
    const links = [
        {
            href: 'https://open.spotify.com/artist/09Fjrj2Ojg0e1YPlYxsiHj',
            icon: '/logos/Spotify.png',
            fallback: 'https://placehold.co/32x32/1DB954/FFFFFF?text=Spotify',
            name: 'Spotify',
            alt: 'Spotify Logo'
        },
        {
            href: 'https://music.apple.com/us/artist/neuronoiser/1843991502',
            icon: '/logos/apple-music.png',
            fallback: 'https://placehold.co/32x32/FC3C44/FFFFFF?text=Apple',
            name: 'Apple Music',
            alt: 'Apple Music Logo'
        }
    ]

    return (
        <section id="links-section" className="space-y-6">
            <h2 className={SECTION_HEADING_CLASS}>
                / {'{'} Listen Everywhere {'}'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                {links.map((link) => (
                    <a 
                        key={link.name}
                        href={link.href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="streaming-link group"
                    >
                        <span className="streaming-icon">
                            <img 
                                src={link.icon} 
                                alt={link.alt} 
                                className="w-8 h-8 object-contain transition duration-300" 
                                onError={(e) => handleImageError(e, link.fallback)}
                            />
                        </span>
                        <span className="streaming-name text-gray-300">{link.name}</span>
                    </a>
                ))}
            </div>
        </section>
    )
}

export default StreamingLinks
