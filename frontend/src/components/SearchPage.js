import React, { useState, useEffect } from 'react';
import { searchImages, getImageUrl } from '../services/api';
import MapView from './MapView';
import useGeolocation from '../hooks/useGeolocation';

const SearchPage = () => {
    const { location } = useGeolocation();
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [useLocation, setUseLocation] = useState(true);
    const [radius, setRadius] = useState(10); // km
    const [showMap, setShowMap] = useState(true);

    const handleSearch = async () => {
        if (!query.trim() && !useLocation) {
            setError('Please enter a search term or enable location-based search');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = {
                limit: 50,
            };

            if (query.trim()) {
                params.query = query.trim();
            }

            if (useLocation && location) {
                params.lat = location.latitude;
                params.lon = location.longitude;
                params.radius_m = radius * 1000; // Convert km to meters
            }

            const results = await searchImages(params);
            setSearchResults(results.results || []);
        } catch (err) {
            setError(err.response?.data?.detail || 'Search failed. Please try again.');
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleClearSearch = () => {
        setQuery('');
        setSearchResults([]);
        setError(null);
    };

    // Auto-search on location change
    useEffect(() => {
        if (useLocation && location && !query) {
            handleSearch();
        }
    }, [location, useLocation]);

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="container">
            <div className="card">
                <div className="card-header">
                    <h1 className="card-title">🔍 Search Tool Images</h1>
                    <p className="card-subtitle">Find tool images by tag name or location. Use the map to visualize where tools were found.</p>
                </div>

                {/* Search Form */}
                <div className="search-container">
                    <div className="form-group">
                        <label className="form-label">🔍 Search by Tool Name</label>
                        <div className="search-input">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., hammer, drill, wrench..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <div className="search-icon">🔍</div>
                        </div>
                    </div>

                    <div className="search-filters">
                        <div className="form-group">
                            <label className="form-label">
                                <input
                                    type="checkbox"
                                    checked={useLocation}
                                    onChange={(e) => setUseLocation(e.target.checked)}
                                    style={{ marginRight: '8px' }}
                                />
                                📍 Include location-based search
                            </label>

                            {useLocation && (
                                <div style={{ marginTop: '12px' }}>
                                    <label className="form-label">
                                        Search radius: {radius} km
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={radius}
                                        onChange={(e) => setRadius(parseInt(e.target.value))}
                                        className="form-input"
                                        style={{ marginTop: '4px' }}
                                    />
                                    <small className="form-help">
                                        {location ?
                                            `Current location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` :
                                            'Location not available'
                                        }
                                    </small>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={handleSearch}
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                                    Searching...
                                </>
                            ) : (
                                '🔍 Search'
                            )}
                        </button>
                        <button
                            onClick={handleClearSearch}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            🗑️ Clear
                        </button>
                        <button
                            onClick={() => setShowMap(!showMap)}
                            className={`btn ${showMap ? 'btn-warning' : 'btn-success'}`}
                        >
                            {showMap ? '🗺️ Hide Map' : '🗺️ Show Map'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <strong>⚠️ Search Error:</strong> {error}
                    </div>
                )}

                {/* Map View - Always show when enabled */}
                {showMap && (
                    <div className="card mt-4">
                        <div className="card-header">
                            <h3 className="card-title">🗺️ Map View</h3>
                            <p className="card-subtitle">Tool locations and search radius</p>
                        </div>
                        <MapView
                            images={searchResults}
                            userLocation={useLocation ? location : null}
                            radius={radius * 1000}
                        />
                    </div>
                )}

                {/* Search Results */}
                {loading && (
                    <div className="loading">
                        <div className="spinner"></div>
                        <div className="mt-2">
                            <p>🔍 Searching for tool images...</p>
                        </div>
                    </div>
                )}

                {!loading && searchResults.length > 0 && (
                    <div className="card mt-4">
                        <div className="card-header">
                            <h3 className="card-title">📸 Found {searchResults.length} image{searchResults.length !== 1 ? 's' : ''}</h3>
                            <p className="card-subtitle">Search results for your query</p>
                        </div>

                        <div className="image-grid">
                            {searchResults.map((image) => (
                                <div key={image.id} className="image-card">
                                    <img
                                        src={getImageUrl(image.id)}
                                        alt={image.original_filename || image.filename}
                                        className="image-preview"
                                        loading="lazy"
                                    />
                                    <div className="image-info">
                                        <div className="image-tags">
                                            {image.tags && image.tags.length > 0 ? (
                                                image.tags.map((tag, index) => (
                                                    <span key={index} className="tag">
                                                        {tag}
                                                        {image.confidences && image.confidences[index] && (
                                                            <span> ({(image.confidences[index] * 100).toFixed(0)}%)</span>
                                                        )}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="tag" style={{ background: 'var(--warning-color)' }}>
                                                    No tools detected
                                                </span>
                                            )}
                                        </div>
                                        <div className="image-meta">
                                            📁 {image.original_filename || image.filename}<br />
                                            📍 {image.latitude.toFixed(4)}, {image.longitude.toFixed(4)}<br />
                                            📅 {formatDate(image.created_at)}
                                            {image.file_size && (
                                                <><br />📄 {(image.file_size / 1024).toFixed(1)} KB</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {!loading && searchResults.length === 0 && query && (
                    <div className="card mt-4">
                        <div className="alert alert-warning text-center">
                            <h4>🔍 No Images Found</h4>
                            <p>Try searching for different tool names or adjusting your search radius.</p>
                        </div>
                    </div>
                )}

                {!loading && !query && !useLocation && (
                    <div className="card mt-4">
                        <div className="alert alert-info text-center">
                            <h4>🚀 Start Your Search</h4>
                            <p>Enter a tool name above or enable location-based search to find nearby tool images.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
