import React, { useState } from 'react';
import CameraCapture from './CameraCapture';
import useGeolocation from '../hooks/useGeolocation';

const HomePage = () => {
    const { location, loading: locationLoading, error: locationError, getCurrentLocation } = useGeolocation();
    const [manualLat, setManualLat] = useState('');
    const [manualLon, setManualLon] = useState('');
    const [showManualInput, setShowManualInput] = useState(false);

    const handleLocationToggle = () => {
        setShowManualInput(!showManualInput);
        if (!showManualInput) {
            // Clear manual inputs when switching back to auto
            setManualLat('');
            setManualLon('');
        }
    };

    const getCurrentCoordinates = () => {
        if (showManualInput && manualLat && manualLon) {
            return {
                latitude: parseFloat(manualLat),
                longitude: parseFloat(manualLon),
            };
        }
        return location;
    };

    const currentCoords = getCurrentCoordinates();
    const hasValidLocation = currentCoords &&
        typeof currentCoords.latitude === 'number' &&
        typeof currentCoords.longitude === 'number';

    return (
        <div className="container">
            <div className="card">
                <div className="card-header">
                    <h1 className="card-title">🔧 Tool Detection & Search</h1>
                    <p className="card-subtitle">Take a photo or upload an image of a work tool to automatically detect and tag it with GPS location</p>
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

                            {locationError && (
                                <div className="alert alert-error">
                                    <strong>⚠️ Location Error:</strong> {locationError}
                                    <button onClick={getCurrentLocation} className="btn btn-secondary mt-2">
                                        Try Again
                                    </button>
                                </div>
                            )}

                            {location && !locationError && (
                                <div className="alert alert-success">
                                    <strong>✅ Location Found:</strong> {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                    {location.accuracy && <span> (accuracy: ±{Math.round(location.accuracy)}m)</span>}
                                </div>
                            )}

                            <button
                                onClick={handleLocationToggle}
                                className="btn btn-secondary"
                            >
                                📝 Enter Location Manually
                            </button>
                        </div>
                    ) : (
                        <div className="manual-location">
                            <div className="search-filters">
                                <div className="form-group">
                                    <label className="form-label">Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className="form-input"
                                        placeholder="e.g., 40.7128"
                                        value={manualLat}
                                        onChange={(e) => setManualLat(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        className="form-input"
                                        placeholder="e.g., -74.0060"
                                        value={manualLon}
                                        onChange={(e) => setManualLon(e.target.value)}
                                    />
                                </div>
                            </div>

                            {hasValidLocation && (
                                <div className="alert alert-success">
                                    <strong>✅ Manual Location Set:</strong> {currentCoords.latitude}, {currentCoords.longitude}
                                </div>
                            )}

                            <button
                                onClick={handleLocationToggle}
                                className="btn btn-secondary"
                            >
                                🌍 Use Auto Location
                            </button>
                        </div>
                    )}
                </div>

                {/* Capture Section */}
                {hasValidLocation && (
                    <div className="form-group">
                        <label className="form-label">📸 Capture Tool Image</label>
                        <div className="card">
                            <CameraCapture
                                latitude={currentCoords.latitude}
                                longitude={currentCoords.longitude}
                            />
                        </div>
                    </div>
                )}

                {!hasValidLocation && !locationLoading && (
                    <div className="alert alert-warning">
                        <strong>⚠️ Location Required:</strong> Please provide a valid location to continue.
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;
