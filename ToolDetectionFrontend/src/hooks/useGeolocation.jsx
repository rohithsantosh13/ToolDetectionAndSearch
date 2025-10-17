import React, { useState, useEffect } from 'react';

const useGeolocation = () => {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const getCurrentLocation = () => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError('Geolocation is not supported by this browser');
            setLoading(false);
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000, // Cache for 1 minute
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setLocation({
                    latitude,
                    longitude,
                    accuracy,
                });
                setLoading(false);
            },
            (error) => {
                let errorMessage = 'Failed to get location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied by user';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out';
                        break;
                    default:
                        errorMessage = 'Unknown location error';
                        break;
                }
                setError(errorMessage);
                setLoading(false);
            },
            options
        );
    };

    useEffect(() => {
        // Automatically try to get location on mount
        getCurrentLocation();
    }, []);

    return {
        location,
        loading,
        error,
        getCurrentLocation,
    };
};

export default useGeolocation;
