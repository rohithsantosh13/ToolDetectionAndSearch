import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLocationName } from '../services/locationService';

// Fix for default markers in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapPicker = ({
    initialLocation = null,
    onLocationSelect,
    height = '400px',
    showCurrentLocation = true
}) => {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markerRef = useRef(null);
    const [selectedLocation, setSelectedLocation] = useState(initialLocation);
    const [locationName, setLocationName] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Handle window resize to update mobile state
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;

        // Initialize map
        const defaultCenter = initialLocation
            ? [initialLocation.latitude, initialLocation.longitude]
            : [40.7128, -74.0060]; // Default to NYC
        const defaultZoom = initialLocation ? 15 : 10;

        mapInstance.current = L.map(mapRef.current, {
            preferCanvas: true,
            zoomControl: true,
            attributionControl: true
        }).setView(defaultCenter, defaultZoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstance.current);

        // Add click handler to map
        mapInstance.current.on('click', handleMapClick);

        // Add touch handlers for mobile
        if (isMobile) {
            mapInstance.current.on('touchstart', (e) => {
                // Prevent default to avoid conflicts with map panning
                e.originalEvent.preventDefault();
            });
        }

        // Add initial marker if location provided
        if (initialLocation) {
            addMarker(initialLocation.latitude, initialLocation.longitude);
        }

        // Ensure map is properly sized
        setTimeout(() => {
            if (mapInstance.current) {
                mapInstance.current.invalidateSize();
            }
        }, 100);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
            }
        };
    }, [isMobile]);

    // Handle window resize for map
    useEffect(() => {
        const handleResize = () => {
            if (mapInstance.current) {
                setTimeout(() => {
                    mapInstance.current.invalidateSize();
                }, 100);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMapClick = async (e) => {
        const { lat, lng } = e.latlng;

        // Add marker immediately with "resolving" message
        addMarker(lat, lng);

        // Get location name
        setLoading(true);
        try {
            console.log('Getting location name for:', lat, lng);
            const locationName = await getLocationName(lat, lng);
            console.log('Location name result:', locationName);
            setLocationName(locationName);

            // Update marker popup with resolved address
            addMarker(lat, lng, locationName);

            const location = {
                latitude: lat,
                longitude: lng,
                name: locationName.name,
                city: locationName.city,
                state: locationName.state,
                country: locationName.country
            };

            setSelectedLocation(location);
            onLocationSelect(location);
        } catch (error) {
            console.error('Error getting location name:', error);

            // Update marker with fallback coordinates
            const fallbackLocationName = {
                name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                city: 'Unknown City',
                state: 'Unknown State',
                country: 'Unknown Country'
            };
            addMarker(lat, lng, fallbackLocationName);

            const location = {
                latitude: lat,
                longitude: lng,
                name: fallbackLocationName.name,
                city: fallbackLocationName.city,
                state: fallbackLocationName.state,
                country: fallbackLocationName.country
            };
            setSelectedLocation(location);
            onLocationSelect(location);
        } finally {
            setLoading(false);
        }
    };

    const addMarker = (lat, lng, locationName = null) => {
        // Remove existing marker
        if (markerRef.current) {
            mapInstance.current.removeLayer(markerRef.current);
        }

        // Create popup content
        const popupContent = locationName ? `
            <div style="text-align: center; min-width: 200px;">
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: #333;">
                    📍 ${locationName.name}
                </div>
                <div style="font-size: 0.875rem; color: #666; margin-bottom: 0.25rem;">
                    ${locationName.city && `${locationName.city}, `}
                    ${locationName.state && `${locationName.state}, `}
                    ${locationName.country}
                </div>
                <div style="font-size: 0.75rem; color: #999; border-top: 1px solid #eee; padding-top: 0.25rem; margin-top: 0.25rem;">
                    ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </div>
            </div>
        ` : `
            <div style="text-align: center;">
                <div style="font-weight: 600; margin-bottom: 0.5rem; color: #333;">
                    📍 Selected Location
                </div>
                <div style="font-size: 0.875rem; color: #666;">
                    ${lat.toFixed(6)}, ${lng.toFixed(6)}
                </div>
                <div style="font-size: 0.75rem; color: #999; margin-top: 0.25rem;">
                    Resolving address...
                </div>
            </div>
        `;

        // Add new marker
        markerRef.current = L.marker([lat, lng])
            .addTo(mapInstance.current)
            .bindPopup(popupContent)
            .openPopup();
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser');
            return;
        }

        // Note: HTTPS is required for mobile geolocation, but we'll allow HTTP for local development
        // For production, ensure the app is served over HTTPS

        setLoading(true);

        // Mobile-optimized options
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // Update map view
                mapInstance.current.setView([latitude, longitude], 15);
                addMarker(latitude, longitude);

                // Get location name
                try {
                    console.log('Getting current location name for:', latitude, longitude);
                    const locationName = await getLocationName(latitude, longitude);
                    console.log('Current location name result:', locationName);
                    setLocationName(locationName);

                    // Update marker popup with resolved address
                    addMarker(latitude, longitude, locationName);

                    const location = {
                        latitude,
                        longitude,
                        name: locationName.name,
                        city: locationName.city,
                        state: locationName.state,
                        country: locationName.country
                    };

                    setSelectedLocation(location);
                    onLocationSelect(location);
                } catch (error) {
                    console.error('Error getting current location name:', error);

                    // Update marker with fallback coordinates
                    const fallbackLocationName = {
                        name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                        city: 'Unknown City',
                        state: 'Unknown State',
                        country: 'Unknown Country'
                    };
                    addMarker(latitude, longitude, fallbackLocationName);

                    const location = {
                        latitude,
                        longitude,
                        name: fallbackLocationName.name,
                        city: fallbackLocationName.city,
                        state: fallbackLocationName.state,
                        country: fallbackLocationName.country
                    };
                    setSelectedLocation(location);
                    onLocationSelect(location);
                } finally {
                    setLoading(false);
                }
            },
            (error) => {
                console.error('Error getting current location:', error);
                let errorMessage = 'Could not get your current location. Please try again or select a location on the map.';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location unavailable. Please check your GPS settings and try again.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again or select a location on the map.';
                        break;
                }

                alert(errorMessage);
                setLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: isMobile ? 30000 : 10000, // Longer timeout for mobile
                maximumAge: 60000
            }
        );
    };

    return (
        <div className="map-picker">
            <div className="map-picker-header" style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: isMobile ? '0.5rem' : '0',
                marginBottom: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'var(--background-secondary)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)'
            }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                        📍 Select Location on Map
                    </h4>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {isMobile ? 'Tap anywhere on the map to select a location' : 'Click anywhere on the map to select a location'}
                    </p>
                </div>
                {showCurrentLocation && (
                    <button
                        onClick={getCurrentLocation}
                        className="btn btn-secondary"
                        disabled={loading}
                        style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.8rem',
                            minHeight: '44px',
                            width: isMobile ? '100%' : 'auto'
                        }}
                    >
                        {loading ? (
                            <>
                                <div className="spinner" style={{ width: '14px', height: '14px', marginRight: '0.5rem' }}></div>
                                Locating...
                            </>
                        ) : (
                            '📍 Use My Location'
                        )}
                    </button>
                )}
            </div>

            <div
                ref={mapRef}
                style={{
                    height: height,
                    width: '100%',
                    borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 1,
                    contain: 'layout style paint',
                    isolation: 'isolate'
                }}
            />

            {selectedLocation && (
                <div className="selected-location" style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem', marginRight: '0.5rem' }}>📍</span>
                        <strong style={{ color: 'var(--text-primary)' }}>Selected Location</strong>
                    </div>
                    <div style={{ marginBottom: '0.5rem', fontWeight: '500' }}>
                        {selectedLocation.name}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        {selectedLocation.city && `${selectedLocation.city}, `}
                        {selectedLocation.state && `${selectedLocation.state}, `}
                        {selectedLocation.country}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                        Coordinates: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                    </div>
                </div>
            )}

            {loading && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '1rem',
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                    <span>Getting location details...</span>
                </div>
            )}
        </div>
    );
};

export default MapPicker;
