import Hero from '../components/Hero'
import StreamingLinks from '../components/StreamingLinks'
import Bio from '../components/Bio'
import Footer from '../components/Footer'
import AnimatedSection from '../components/AnimatedSection'
import MusicPlayerUI from '../components/MusicPlayerUI'

function Home() {
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
            <AnimatedSection delay={150} animationType="animate-slide-in-bottom">
                <MusicPlayerUI />
            </AnimatedSection>
            <AnimatedSection delay={400} animationType="animate-slide-in-top">
                <Hero />
            </AnimatedSection>
            <StreamingLinks />
            <AnimatedSection delay={900}>
                <Bio />
            </AnimatedSection>
            <AnimatedSection delay={1150} animationType="animate-slide-in-bottom">
                <Footer />
            </AnimatedSection>
        </div>
    )
}

export default Home
