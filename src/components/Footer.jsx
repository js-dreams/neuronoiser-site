import { Link } from 'react-router-dom'

function Footer() {
    return (
        <footer className="text-center pt-8 border-t border-neon-cyan/20">
            <p className="text-gray-500 text-sm font-mono">
                &copy; 2026 neuronoiser. All Rights Reserved.
            </p>
            <p className="text-gray-600 text-xs mt-1">
                <Link to="/aliens" className="hover:text-neon-cyan transition duration-200 font-mono">🎮 Play Aliens</Link>
            </p>
            <p className="text-gray-600 text-xs mt-2">
                <a href="mailto:danny@neuronoiser.com" className="hover:text-neon-cyan transition duration-200">Contact / Press Inquiries</a>
            </p>
        </footer>
    )
}

export default Footer
