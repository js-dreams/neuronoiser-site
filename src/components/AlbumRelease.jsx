import AnimatedSection from './AnimatedSection'

const SECTION_HEADING_CLASS = "text-l md:text-4xl font-mono font-semibold text-neon-cyan border-b-2 border-neon-cyan/50 pb-2"

const ALBUM_TITLE = 'Self Awareness Is Overrated'
// Vanity host, 301'd at the registrar to the album's Spotify page — so the
// link stays stable here even if the streaming URL ever changes.
const ALBUM_URL = 'https://self-awareness.neuronoiser.com/'

function AlbumRelease() {
    return (
        <section id="album-section" className="space-y-6">
            <AnimatedSection delay={550} animationType="animate-slide-in-top">
                <h2 className={SECTION_HEADING_CLASS}>
                    / {'{'} New Album - Available Now! {'}'}
                </h2>
            </AnimatedSection>
            <AnimatedSection delay={700} animationType="animate-slide-in-bottom">
                <a
                    href={ALBUM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border-2 border-neon-cyan/50 shadow-2xl shadow-neon-cyan/20 transition-all duration-300 ease-in-out hover:translate-y-[-4px] hover:border-neon-cyan hover:shadow-[0_10px_30px_rgba(0,255,255,0.4)]"
                >
                    <img
                        src="/albums/self-awareness-is-overrated.webp"
                        alt={`${ALBUM_TITLE} — album art by neuronoiser. Listen now.`}
                        className="w-full h-auto block"
                    />
                </a>
            </AnimatedSection>
        </section>
    )
}

export default AlbumRelease
