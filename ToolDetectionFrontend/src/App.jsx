import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import ToolChat from './components/ToolChat';
import './App.css';

function Navigation({ isMobile }) {
  const location = useLocation();

  return (
    <nav className={`nav ${isMobile ? 'nav-mobile' : ''}`}>
      <Link
        to="/"
        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
      >
        <span className="nav-icon">📷</span>
        {!isMobile && 'Capture'}
      </Link>
      <Link
        to="/search"
        className={`nav-link ${location.pathname === '/search' ? 'active' : ''}`}
      >
        <span className="nav-icon">🔍</span>
        {!isMobile && 'Search'}
      </Link>
      <Link
        to="/chat"
        className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}
      >
        <span className="nav-icon">🤖</span>
        {!isMobile && 'Assistant'}
      </Link>
    </nav>
  );
}

function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };

    checkMobile();

    // Listen for resize events to handle orientation changes
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Router>
      <div className={`App ${isMobile ? 'mobile-layout' : ''}`}>
        {!isMobile && (
          <header className="app-header">
            <div className="container">
              <div className="header-content">
                <div className="logo">
                  <span className="logo-icon">🔧</span>
                  <h1>ToolDetect</h1>
                </div>
                <Navigation isMobile={isMobile} />
              </div>
            </div>
          </header>
        )}

        <main className={`app-main ${isMobile ? 'mobile-main' : ''}`}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/chat" element={<ToolChat />} />
          </Routes>
        </main>

        {isMobile && (
          <div className="mobile-nav-container">
            <Navigation isMobile={isMobile} />
          </div>
        )}

        {!isMobile && (
          <footer className="app-footer">
            <div className="container">
              <p>&copy; 2025 ToolDetect - AI-Powered Tool Detection</p>
            </div>
          </footer>
        )}
      </div>
    </Router>
  );
}

export default App;