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
        setLoading(true);
        if (!isRetry) {
            setError(null);
            setRetryCount(0);
        }

        try {
            const result = await getCurrentLocationWithName(retryCount);
            setLocation(result.location);
            setLocationName(result.locationName);
            setError(null);
            setRetryCount(0);
        } catch (err) {
            console.error('Location error:', err);
            setError(err.message);

            // Auto-retry only for timeout errors, not permission errors
            if (retryCount < 1 && err.message.includes('timeout')) {
                setRetryCount(prev => prev + 1);
                setTimeout(() => {
                    getCurrentLocation(true);
                }, 3000);
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
