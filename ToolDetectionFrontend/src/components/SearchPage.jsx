import React, { useState, useEffect } from 'react';
import { searchImages, searchByImage, getImageUrl } from '../services/api';
import MapView from './MapView';
import useGeolocation from '../hooks/useGeolocation';
import { getLocationNameForCoords } from '../services/locationService';

// Component to display location name for coordinates
const LocationDisplay = ({ latitude, longitude }) => {
    const [locationName, setLocationName] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (latitude && longitude) {
            getLocationNameForCoords(latitude, longitude)
                .then(name => {
                    setLocationName(name);
                    setLoading(false);
                })
                .catch(() => {
                    setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                    setLoading(false);
                });
        }
    }, [latitude, longitude]);

    if (loading) {
        return <span>Loading location...</span>;
    }

    return <span>{locationName}</span>;
};

const SearchPage = () => {
    const { location, locationName } = useGeolocation();
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [searchType, setSearchType] = useState('text'); // 'text' or 'image'
    const [searchImage, setSearchImage] = useState(null);
    const [searchImagePreview, setSearchImagePreview] = useState(null);
    const [isMobile, setIsMobile] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const streamRef = React.useRef(null);

    // Detect if device is mobile
    React.useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            setIsMobile(isMobileDevice);
        };
        checkMobile();
    }, []);

    // Handle video stream when showCamera changes
    React.useEffect(() => {
        if (showCamera && streamRef.current && videoRef.current) {
            console.log('useEffect: Setting video source from stream');
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.onloadedmetadata = () => {
                console.log('useEffect: Video metadata loaded, starting play');
                videoRef.current.play().then(() => {
                    console.log('useEffect: Video playing successfully');
                    setCameraReady(true);
                }).catch(e => {
                    console.error('useEffect: Play failed:', e);
                    setError('Failed to start camera video. Please try again.');
                });
            };
        }
    }, [showCamera]);

    // Cleanup camera stream on unmount
    React.useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleSearch = async () => {
        // Prevent empty searches
        if (searchType === 'text') {
            if (!query.trim()) {
                setError('Please enter a search term');
                return;
            }
        } else {
            if (!searchImage) {
                setError('Please select an image to search with');
                return;
            }
        }

        setLoading(true);
        setError(null);
        setHasSearched(true);

        try {
            let results;

            if (searchType === 'text') {
                const params = {
                    limit: 50,
                };

                if (query.trim()) {
                    params.query = query.trim();
                }

                if (location) {
                    params.lat = location.latitude;
                    params.lon = location.longitude;
                    params.radius_m = 10000; // Fixed 10km radius
                }

                results = await searchImages(params);
            } else {
                // Image-based search
                console.log('Starting image-based search with:', searchImage.name);
                results = await searchByImage(
                    searchImage,
                    location ? location.latitude : null,
                    location ? location.longitude : null
                );
                console.log('Image search results:', results);
            }

            console.log('Setting search results:', results.results || []);
            setSearchResults(results.results || []);
        } catch (err) {
            console.error('Search error:', err);
            console.error('Error response:', err.response?.data);
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
        setSearchImage(null);
        if (searchImagePreview) {
            URL.revokeObjectURL(searchImagePreview);
            setSearchImagePreview(null);
        }
    };

    const handleImageSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSearchImage(file);
            setError(null);

            // Create preview URL
            const url = URL.createObjectURL(file);
            setSearchImagePreview(url);
        }
    };

    const handleSearchTypeChange = (type) => {
        setSearchType(type);
        setError(null);
        if (type === 'text') {
            setSearchImage(null);
            if (searchImagePreview) {
                URL.revokeObjectURL(searchImagePreview);
                setSearchImagePreview(null);
            }
        }
        setShowCamera(false);
        setCameraReady(false);
        stopCamera();
    };

    const startCamera = async () => {
        try {
            console.log('Starting camera for image search...');
            setCameraReady(false);
            setShowCamera(true);

            // Set a timeout to prevent getting stuck
            const cameraTimeout = setTimeout(() => {
                if (!cameraReady) {
                    console.error('Camera timeout - taking too long to start');
                    setError('Camera is taking too long to start. Please try again.');
                    stopCamera();
                }
            }, 10000); // 10 second timeout

            // Try with environment camera first, then fallback to any camera
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
            } catch (envError) {
                console.log('Environment camera not available, trying default camera...');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                });
            }

            console.log('Camera stream obtained:', stream);
            streamRef.current = stream;

            // Wait for the video element to be rendered and set the stream
            const setVideoSource = () => {
                if (videoRef.current) {
                    console.log('Setting video source...');
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        console.log('Video metadata loaded, starting playback...');
                        videoRef.current.play().then(() => {
                            console.log('Video playing successfully');
                            setCameraReady(true);
                            clearTimeout(cameraTimeout);
                        }).catch(e => {
                            console.error('Play failed:', e);
                            setError('Failed to start camera video. Please try again.');
                            clearTimeout(cameraTimeout);
                        });
                    };
                    videoRef.current.oncanplay = () => {
                        console.log('Video can play');
                    };
                } else {
                    console.error('Video ref not available, retrying...');
                    // Retry after a short delay
                    setTimeout(setVideoSource, 100);
                }
            };

            setTimeout(setVideoSource, 300);
        } catch (err) {
            console.error('Error accessing camera:', err);
            setError('Could not access camera. Please try uploading a file instead.');
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowCamera(false);
        setCameraReady(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            const context = canvas.getContext('2d');

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], 'search-capture.jpg', { type: 'image/jpeg' });
                    setSearchImage(file);
                    setSearchImagePreview(URL.createObjectURL(blob));
                    stopCamera();
                }
            }, 'image/jpeg', 0.8);
        }
    };

    const handleTakePhoto = () => {
        if (isMobile) {
            // For mobile, trigger the file input with camera capture
            document.getElementById('search-image-input').click();
        } else {
            // For desktop, start camera
            startCamera();
        }
    };

    // Removed auto-search on location change to prevent unwanted searches

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
            <div className="page-header">
                <h1>Search Tool Images</h1>
                <p>Find tools by text, image, or location with map visualization</p>
            </div>

            {/* Search Form */}
            <div className="search-card">
                <div className="search-form">
                    {/* Search Type Toggle */}
                    <div className="form-group">
                        <label className="form-label">Search Type</label>
                        <div className="search-type-toggle" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="radio"
                                    name="searchType"
                                    value="text"
                                    checked={searchType === 'text'}
                                    onChange={(e) => handleSearchTypeChange(e.target.value)}
                                />
                                <span>🔤 Text</span>
                            </label>
                            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="radio"
                                    name="searchType"
                                    value="image"
                                    checked={searchType === 'image'}
                                    onChange={(e) => handleSearchTypeChange(e.target.value)}
                                />
                                <span>📷 Image</span>
                            </label>
                        </div>
                    </div>

                    {/* Text Search */}
                    {searchType === 'text' && (
                        <div className="form-group">
                            <label className="form-label">Search by Tool Name</label>
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
                    )}

                    {/* Image Search */}
                    {searchType === 'image' && (
                        <div className="form-group">
                            <label className="form-label">Search with Image</label>

                            <div className="image-search-options" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <button
                                    onClick={handleTakePhoto}
                                    className="btn btn-primary"
                                    style={{ flex: 1 }}
                                >
                                    📷 Take Photo
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleImageSelect}
                                    className="hidden"
                                    id="search-image-input"
                                />
                                <label htmlFor="search-image-input" className="btn btn-secondary" style={{ flex: 1 }}>
                                    📁 Choose File
                                </label>
                            </div>

                            <small style={{ display: 'block', marginBottom: '1rem', color: 'var(--text-light)', fontSize: '0.75rem' }}>
                                {isMobile ? 'Take photo with camera or choose from gallery' : 'Take photo with camera or upload from files'}
                            </small>

                            {searchImagePreview && (
                                <div className="search-image-preview" style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                    <img
                                        src={searchImagePreview}
                                        alt="Search preview"
                                        style={{
                                            maxWidth: '200px',
                                            maxHeight: '200px',
                                            borderRadius: 'var(--border-radius)',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    />
                                    <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-light)' }}>
                                        {searchImage.name}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="search-filters">
                        {location && (
                            <div className="form-group">
                                <div className="location-info">
                                    <small className="form-help">
                                        {locationName ? (
                                            <div>
                                                <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                                    📍 {locationName.name}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                                    {locationName.city && `${locationName.city}, `}
                                                    {locationName.state && `${locationName.state}, `}
                                                    {locationName.country}
                                                </div>
                                            </div>
                                        ) : (
                                            `Current location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                                        )}
                                    </small>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="search-actions">
                        <button
                            onClick={handleSearch}
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner"></div>
                                    {searchType === 'text' ? 'Searching...' : 'Analyzing image...'}
                                </>
                            ) : (
                                <>
                                    <span>{searchType === 'text' ? '🔍' : '📷'}</span>
                                    {searchType === 'text' ? 'Search' : 'Find Similar'}
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleClearSearch}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            <span>🗑️</span>
                            Clear
                        </button>
                        <button
                            onClick={() => setShowMap(!showMap)}
                            className={`btn ${showMap ? 'btn-warning' : 'btn-success'}`}
                        >
                            <span>{showMap ? '🗺️' : '🗺️'}</span>
                            {showMap ? 'Hide Map' : 'Show Map'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Camera Interface for Image Search */}
            {showCamera && searchType === 'image' && (
                <div className="card mt-4">
                    <div className="card-header">
                        <h4 className="card-title">📸 Camera</h4>
                        <p className="card-subtitle">Position your tool in the frame and click capture</p>
                    </div>
                    <div className="camera-container" style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                onLoadStart={() => console.log('Video load started')}
                                onLoadedData={() => console.log('Video data loaded')}
                                onCanPlay={() => console.log('Video can play')}
                                onError={(e) => console.error('Video error:', e)}
                                style={{
                                    width: '100%',
                                    maxWidth: '500px',
                                    height: 'auto',
                                    minHeight: '300px',
                                    backgroundColor: '#000',
                                    borderRadius: 'var(--border-radius)',
                                    border: '1px solid var(--border-color)',
                                    objectFit: 'cover'
                                }}
                            />
                            {!cameraReady && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    color: 'white',
                                    fontSize: '1.2rem',
                                    textAlign: 'center'
                                }}>
                                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                                    <div>Starting camera...</div>
                                </div>
                            )}
                        </div>
                        <canvas
                            ref={canvasRef}
                            style={{ display: 'none' }}
                        />
                        <div className="camera-controls" style={{ marginTop: '1rem' }}>
                            <button
                                onClick={capturePhoto}
                                className="btn btn-primary"
                                style={{ marginRight: '1rem' }}
                                disabled={!cameraReady}
                            >
                                📸 Capture Photo
                            </button>
                            <button
                                onClick={stopCamera}
                                className="btn btn-secondary"
                            >
                                ❌ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    <strong>⚠️ Search Error:</strong> {error}
                </div>
            )}

            {/* Map View */}
            {showMap && (
                <div className="map-card">
                    <MapView
                        images={searchResults}
                        userLocation={location}
                        userLocationName={locationName}
                        radius={10000}
                    />
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Searching for tool images...</p>
                </div>
            )}
            {/* Search Results */}
            {!loading && hasSearched && searchResults.length > 0 && (
                <div className="results-card">
                    <div className="card-header">
                        <h3>Found {searchResults.length} image{searchResults.length !== 1 ? 's' : ''}</h3>
                        <p>Search results for your {searchType === 'image' ? 'image' : 'text'} query</p>
                    </div>

                    <div className="image-grid">
                        {searchResults.map((image) => (
                            <div key={image.id} className="image-card">
                                <div className="image-container">
                                    <img
                                        src={getImageUrl(image.id)}
                                        alt={image.original_filename || image.filename}
                                        className="image-preview"
                                        loading="lazy"
                                        onError={(e) => {
                                            e.target.src = '/placeholder-image.png';
                                            e.target.alt = 'Image not available';
                                        }}
                                    />
                                </div>
                                <div className="image-info">
                                    <div className="image-tags">
                                        {image.tags && image.tags.length > 0 ? (
                                            image.tags.map((tag, index) => (
                                                <span key={index} className="tag">
                                                    {tag}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="tag tag-warning">
                                                No tools detected
                                            </span>
                                        )}
                                    </div>
                                    <div className="image-meta">
                                        <div className="meta-item">
                                            <span className="meta-icon">📍</span>
                                            <LocationDisplay latitude={image.latitude} longitude={image.longitude} />
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-icon">📅</span>
                                            <span>{formatDate(image.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loading && hasSearched && searchResults.length === 0 && (
                <div className="card mt-4">
                    <div className="alert alert-warning text-center">
                        <h4>🔍 No Images Found</h4>
                        <p>Try searching for different tool names or enable location-based search.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchPage;
