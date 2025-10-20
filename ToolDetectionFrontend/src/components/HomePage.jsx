import React, { useState, useEffect } from 'react';
import CameraCapture from './CameraCapture';
import LocationSearch from './LocationSearch';
import MapPicker from './MapPicker';
import useGeolocation from '../hooks/useGeolocation';

const HomePage = () => {
    const {
        location,
        locationName,
        loading: locationLoading,
        error: locationError,
        retryCount,
        permissionStatus,
        getCurrentLocation,
        setManualLocation
    } = useGeolocation();
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualInputMethod, setManualInputMethod] = useState('address'); // 'address', 'map'
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [isSwitchingToAuto, setIsSwitchingToAuto] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isHttps, setIsHttps] = useState(true);

    // Detect mobile device and HTTPS status
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
            setIsMobile(isMobileDevice);
        };

        const checkHttps = () => {
            setIsHttps(window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        };

        checkMobile();
        checkHttps();
    }, []);

    const handleLocationToggle = () => {
        if (showManualInput) {
            // Switching from manual to auto - get fresh GPS location
            setShowManualInput(false);
            setSelectedLocation(null);
            setIsSwitchingToAuto(true);
            // Clear any previous manual location data
            console.log('Switching to auto location - getting fresh GPS location');
            getCurrentLocation(false, true); // Force fresh GPS location
        } else {
            // Switching from auto to manual
            setShowManualInput(true);
            setIsSwitchingToAuto(false);
        }
    };

    const handleAddressSelect = async (locationData) => {
        setSelectedLocation(locationData);
        await setManualLocation(locationData.coordinates.latitude, locationData.coordinates.longitude);
    };

    const handleMapLocationSelect = async (locationData) => {
        setSelectedLocation(locationData);
        await setManualLocation(locationData.latitude, locationData.longitude);
    };

    const handleInputMethodChange = (method) => {
        setManualInputMethod(method);
        setSelectedLocation(null);
    };

    // Reset switching state when location is obtained
    useEffect(() => {
        if (location && isSwitchingToAuto) {
            setIsSwitchingToAuto(false);
        }
    }, [location, isSwitchingToAuto]);

    const getCurrentCoordinates = () => {
        return location;
    };

    const currentCoords = getCurrentCoordinates();
    const hasValidLocation = currentCoords &&
        typeof currentCoords.latitude === 'number' &&
        typeof currentCoords.longitude === 'number';

    return (
        <div className="container">
            <div className="page-header">
                <h1>Tool Detection & Search</h1>
                <p>Capture tool images with AI detection and GPS location</p>
            </div>

            <div className="main-card">
                <div className="card-header">
                    <h2>Get Started</h2>
                    <p>Set location and capture tools</p>
                </div>

                {/* Location Section */}
                <div className="form-group">
                    <label className="form-label">📍 Location Access</label>

                    {!showManualInput ? (
                        <div className="auto-location">
                            {locationLoading && (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    <span className="ml-2">Getting your location...</span>
                                </div>
                            )}

                            {location && !locationError && (
                                <div className="alert alert-success">
                                    <strong>✅ Location Found:</strong>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                            📍 {locationName?.name || 'Unknown Location'}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {locationName?.city && `${locationName.city}, `}
                                            {locationName?.state && `${locationName.state}, `}
                                            {locationName?.country}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {locationError && (
                                <div className="alert alert-warning">
                                    <strong>⚠️ Location Error:</strong> {locationError}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => getCurrentLocation()}
                                            className="btn btn-secondary"
                                            disabled={locationLoading}
                                            style={{ flex: '1 1 auto', minWidth: '120px' }}
                                        >
                                            {locationLoading ? 'Getting Location...' : 'Try Again'}
                                        </button>
                                        <button
                                            onClick={handleLocationToggle}
                                            className="btn btn-primary"
                                            style={{ flex: '1 1 auto', minWidth: '120px' }}
                                        >
                                            📝 Manual Entry
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!locationError && (
                                <button
                                    onClick={handleLocationToggle}
                                    className="btn btn-secondary"
                                >
                                    📝 Enter Location Manually
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="manual-location">
                            {/* Input Method Selection */}
                            <div className="form-group">
                                <label className="form-label">Choose Input Method</label>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="radio"
                                            name="inputMethod"
                                            value="address"
                                            checked={manualInputMethod === 'address'}
                                            onChange={(e) => handleInputMethodChange(e.target.value)}
                                        />
                                        <span>🏠 Address Search</span>
                                    </label>
                                    <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <input
                                            type="radio"
                                            name="inputMethod"
                                            value="map"
                                            checked={manualInputMethod === 'map'}
                                            onChange={(e) => handleInputMethodChange(e.target.value)}
                                        />
                                        <span>🗺️ Map Picker</span>
                                    </label>
                                </div>
                            </div>


                            {/* Address Search */}
                            {manualInputMethod === 'address' && (
                                <div className="form-group">
                                    <label className="form-label">Search for Location</label>
                                    <LocationSearch
                                        onLocationSelect={handleAddressSelect}
                                        placeholder="Enter address, city, or landmark..."
                                    />
                                    <small className="form-help">
                                        Start typing to search for locations. Select from the dropdown suggestions.
                                    </small>
                                </div>
                            )}

                            {/* Map Picker */}
                            {manualInputMethod === 'map' && (
                                <div className="form-group">
                                    <label className="form-label">Select Location on Map</label>
                                    <MapPicker
                                        onLocationSelect={handleMapLocationSelect}
                                        height="300px"
                                        showCurrentLocation={true}
                                    />
                                    <small className="form-help">
                                        Click anywhere on the map to select a location, or use "Use My Location" to center on your current position.
                                    </small>
                                </div>
                            )}

                            {/* Selected Location Display */}
                            {hasValidLocation && locationName && (
                                <div className="alert alert-success" style={{ marginTop: '1rem' }}>
                                    <strong>✅ Manual Location Set:</strong>
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                            📍 {locationName.name}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {locationName.city && `${locationName.city}, `}
                                            {locationName.state && `${locationName.state}, `}
                                            {locationName.country}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                                            Coordinates: {currentCoords.latitude.toFixed(6)}, {currentCoords.longitude.toFixed(6)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleLocationToggle}
                                className="btn btn-secondary"
                            >
                                🌍 Get My Current Location
                            </button>
                        </div>
                    )}
                </div>

                {/* Capture Section */}
                {hasValidLocation && (
                    <div className="capture-section">
                        <label className="form-label">Capture Tool Image</label>
                        <CameraCapture
                            latitude={currentCoords.latitude}
                            longitude={currentCoords.longitude}
                        />
                    </div>
                )}

                {!hasValidLocation && !locationLoading && (
                    <div className="alert alert-warning">
                        <strong>Location Required:</strong> Please provide a valid location to continue.
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;