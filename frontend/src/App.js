import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './components/HomePage';
import SearchPage from './components/SearchPage';
import './App.css';

function App() {
    return (
        <Router>
            <div className="App">
                <header className="app-header">
                    <div className="container">
                        <h1>🔧 Tool Detection & Search</h1>
                        <nav>
                            <a href="/" className="nav-link">Capture</a>
                            <a href="/search" className="nav-link">Search</a>
                        </nav>
                    </div>
                </header>

                <main className="app-main">
                    <div className="container">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/search" element={<SearchPage />} />
                        </Routes>
                    </div>
                </main>

                <footer className="app-footer">
                    <div className="container">
                        <p>&copy; 2024 Tool Detection App - Open Source</p>
                    </div>
                </footer>
            </div>
        </Router>
    );
}

export default App;
