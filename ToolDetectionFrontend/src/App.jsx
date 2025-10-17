import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import './App.css';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="nav">
      <Link
        to="/"
        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
      >
        <span className="nav-icon">📷</span>
        Capture
      </Link>
      <Link
        to="/search"
        className={`nav-link ${location.pathname === '/search' ? 'active' : ''}`}
      >
        <span className="nav-icon">🔍</span>
        Search
      </Link>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="container">
            <div className="header-content">
              <div className="logo">
                <span className="logo-icon">🔧</span>
                <h1>ToolDetect</h1>
              </div>
              <Navigation />
            </div>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <div className="container">
            <p>&copy; 2025 ToolDetect - AI-Powered Tool Detection</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;