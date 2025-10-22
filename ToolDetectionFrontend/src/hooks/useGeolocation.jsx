import React, { useState, useEffect } from 'react';
import { getCurrentLocationWithName, getLocationName } from '../services/locationService';

const useGeolocation = () => {
    const [location, setLocation] = useState(null);
    const [locationName, setLocationName] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [permissionStatus, setPermissionStatus] = useState('unknown');

    // Check permission status
    useEffect(() => {
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                setPermissionStatus(result.state);
                result.addEventListener('change', () => {
                    setPermissionStatus(result.state);
                });
            });
        }
    }, []);

    const getCurrentLocation = async (isRetry = false, forceFresh = false) => {
        console.log('getCurrentLocation called:', { isRetry, forceFresh, retryCount });
        setLoading(true);
        if (!isRetry) {
            setError(null);
            setRetryCount(0);
        }

        try {
            console.log('Getting current location with enhanced accuracy...');
            const result = await getCurrentLocationWithName(retryCount);

            console.log('Location result:', result);
            console.log('Location accuracy:', result.location.accuracy, 'meters');

            setLocation(result.location);
            setLocationName(result.locationName);
            setError(null);
            setRetryCount(0);

            // Log accuracy information for debugging
            if (result.location.accuracy) {
                if (result.location.accuracy <= 10) {
                    console.log('Excellent location accuracy!');
                } else if (result.location.accuracy <= 50) {
                    console.log('Good location accuracy');
                } else if (result.location.accuracy <= 100) {
                    console.log('Fair location accuracy');
                } else {
                    console.log('Poor location accuracy - consider moving to a better location');
                }
            }
        } catch (err) {
            console.error('Location error:', err);
            setError(err.message);

            // Enhanced retry logic - retry for timeout and poor accuracy
            if (retryCount < 2 && (err.message.includes('timeout') || err.message.includes('accuracy'))) {
                console.log(`Retrying location detection (attempt ${retryCount + 1}/2)...`);
                setRetryCount(prev => prev + 1);
                setTimeout(() => {
                    getCurrentLocation(true);
                }, 2000 * (retryCount + 1)); // Increasing delay between retries
            }
        } finally {
            setLoading(false);
        }
    };

    const updateLocationName = async (latitude, longitude) => {
        try {
            const nameResult = await getLocationName(latitude, longitude);
            setLocationName(nameResult);
        } catch (err) {
            console.error('Failed to get location name:', err);
            // Keep existing location name or set fallback
            if (!locationName) {
                setLocationName({
                    name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                    fullAddress: `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                    city: 'Unknown City',
                    state: 'Unknown State',
                    country: 'Unknown Country',
                    coordinates: { latitude, longitude },
                    accuracy: 0.1
                });
            }
        }
    };

    const setManualLocation = async (latitude, longitude) => {
        setLoading(true);
        setError(null);

        try {
            const locationName = await getLocationName(latitude, longitude);
            setLocation({ latitude, longitude, accuracy: null });
            setLocationName(locationName);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Automatically try to get location on mount
        console.log('useGeolocation: Auto-detecting location on mount...');
        console.log('Browser info:', {
            userAgent: navigator.userAgent,
            protocol: window.location.protocol,
            hostname: window.location.hostname
        });
        getCurrentLocation();
    }, []);

    return {
        location,
        locationName,
        loading,
        error,
        retryCount,
        permissionStatus,
        getCurrentLocation,
        updateLocationName,
        setManualLocation,
    };
};

export default useGeolocation;
