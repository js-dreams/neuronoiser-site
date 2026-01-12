import { handleImageError } from '../utils/imageUtils'
import AnimatedSection from './AnimatedSection'

const SECTION_HEADING_CLASS = "text-l md:text-4xl font-mono font-semibold text-neon-cyan border-b-2 border-neon-cyan/50 pb-2"

function StreamingLinks() {
    const links = [
        {
            href: 'https://open.spotify.com/artist/09Fjrj2Ojg0e1YPlYxsiHj',
            icon: '/logos/Spotify.png',
            fallback: 'https://placehold.co/32x32/1DB954/FFFFFF?text=Spotify',
            name: 'Spotify',
            alt: 'Spotify Logo',
            animationType: 'animate-slide-in-left'
        },
        {
            href: 'https://music.apple.com/us/artist/neuronoiser/1843991502',
            icon: '/logos/apple-music.png',
            fallback: 'https://placehold.co/32x32/FC3C44/FFFFFF?text=Apple',
            name: 'Apple Music',
            alt: 'Apple Music Logo',
            animationType: 'animate-slide-in-right'
        },
        {
            href: 'https://youtube.com/@neuronoiser',
            icon: '/logos/youtube.png',
            fallback: 'https://placehold.co/32x32/FF0000/FFFFFF?text=YT',
            name: 'YouTube',
            alt: 'YouTube Logo',
            animationType: 'animate-slide-in-left'
        },
        {
            href: 'https://soundcloud.com/neuronoiser',
            icon: '/logos/soundcloud.png',
            fallback: 'https://placehold.co/32x32/FF5500/FFFFFF?text=SC',
            name: 'SoundCloud',
            alt: 'SoundCloud Logo',
            animationType: 'animate-slide-in-right'
        }
    ]

    return (
        <section id="links-section" className="space-y-6">
            <AnimatedSection delay={650} animationType="animate-slide-in-top">
                <h2 className={SECTION_HEADING_CLASS}>
                    / {'{'} Listen Everywhere {'}'}
                </h2>
            </AnimatedSection>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                {links.map((link, index) => (
                    <AnimatedSection 
                        key={link.name}
                        delay={850 + (index * 200)}
                        animationType={link.animationType}
                    >
                        <a 
                            href={link.href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="streaming-link group"
                        >
                            <span className="streaming-icon">
                                <img 
                                    src={link.icon} 
                                    alt={link.alt} 
                                    className={`w-8 h-8 object-contain transition duration-300 ${link.name === 'SoundCloud' ? 'rounded' : ''}`}
                                    style={link.name === 'SoundCloud' ? { borderRadius: '6px' } : {}}
                                    onError={(e) => handleImageError(e, link.fallback)}
                                />
                            </span>
                            <span className="streaming-name text-gray-300">{link.name}</span>
                        </a>
                    </AnimatedSection>
                ))}
            </div>
        </section>
    )
}

export default StreamingLinks
