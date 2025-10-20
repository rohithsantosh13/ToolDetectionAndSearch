// Location Service for reverse geocoding
// Converts coordinates to meaningful location names

/**
 * Validate coordinates
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {boolean} True if coordinates are valid
 */
const isValidCoordinates = (latitude, longitude) => {
    return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        !isNaN(latitude) &&
        !isNaN(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );
};

/**
 * Get location name with retry mechanism
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {number} retryCount - Current retry count
 * @returns {Promise<object>} Location name object
 */
const getLocationNameWithRetry = async (latitude, longitude, retryCount = 0) => {
    try {
        return await getLocationName(latitude, longitude);
    } catch (error) {
        if (retryCount < 2) {
            console.log(`Reverse geocoding failed, retrying... (${retryCount + 1}/2)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return getLocationNameWithRetry(latitude, longitude, retryCount + 1);
        }
        throw error;
    }
};

/**
 * Get location name from coordinates using reverse geocoding
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<{name: string, address: string, city: string, country: string}>}
 */
export const getLocationName = async (latitude, longitude) => {
    try {
        console.log('Making reverse geocoding request for:', latitude, longitude);

        // Add a small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

        // Using OpenStreetMap Nominatim API (free, no API key required)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'ToolDetect/1.0' // Required by Nominatim
                }
            }
        );

        console.log('Reverse geocoding response status:', response.status);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            } else if (response.status === 403) {
                throw new Error('Access forbidden. Please check your internet connection.');
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }

        const data = await response.json();
        console.log('Reverse geocoding response data:', data);

        if (!data || data.error) {
            throw new Error(data.error || 'Location not found');
        }

        // Check if we got valid data
        if (!data.display_name && !data.address) {
            throw new Error('No location data received');
        }

        // Extract meaningful location information
        const address = data.address || {};
        const name = data.display_name || 'Unknown Location';

        // Build a more readable location name
        const locationParts = [];

        // Add specific location details in order of specificity
        if (address.house_number && address.road) {
            locationParts.push(`${address.house_number} ${address.road}`);
        } else if (address.road) {
            locationParts.push(address.road);
        }

        if (address.suburb) {
            locationParts.push(address.suburb);
        } else if (address.neighbourhood) {
            locationParts.push(address.neighbourhood);
        }

        if (address.city || address.town || address.village) {
            locationParts.push(address.city || address.town || address.village);
        }

        if (address.state) {
            locationParts.push(address.state);
        }

        if (address.country) {
            locationParts.push(address.country);
        }

        const readableName = locationParts.length > 0
            ? locationParts.join(', ')
            : name;

        return {
            name: readableName,
            fullAddress: name,
            city: address.city || address.town || address.village || 'Unknown City',
            state: address.state || 'Unknown State',
            country: address.country || 'Unknown Country',
            coordinates: {
                latitude,
                longitude
            },
            accuracy: data.importance || 0.5 // Nominatim importance score
        };

    } catch (error) {
        console.error('Reverse geocoding error:', error);

        // Fallback to coordinates if reverse geocoding fails
        return {
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            fullAddress: `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            city: 'Unknown City',
            state: 'Unknown State',
            country: 'Unknown Country',
            coordinates: {
                latitude,
                longitude
            },
            accuracy: 0.1,
            error: error.message
        };
    }
};

/**
 * Get current location with meaningful name
 * @returns {Promise<{location: object, locationName: object}>}
 */
export const getCurrentLocationWithName = async (retryCount = 0) => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        // Note: HTTPS is required for mobile geolocation, but we'll allow HTTP for local development
        // For production, ensure the app is served over HTTPS

        // Note: We'll let the geolocation API handle permission checks naturally
        // This avoids blocking legitimate requests on mobile devices

        // Mobile-optimized options
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());

        const options = {
            enableHighAccuracy: true,
            timeout: isMobile ? 30000 : 20000, // Longer timeout for mobile
            maximumAge: retryCount === 0 ? 0 : 60000, // No cache on first attempt, 1 minute cache on retries
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude, accuracy } = position.coords;

                    // Validate coordinates
                    if (!isValidCoordinates(latitude, longitude)) {
                        throw new Error('Invalid coordinates received');
                    }

                    // Check accuracy - if too poor, try again
                    if (accuracy > 1000 && retryCount < 2) {
                        console.log(`Poor accuracy (${accuracy}m), retrying...`);
                        setTimeout(() => {
                            getCurrentLocationWithName(retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, 1000);
                        return;
                    }

                    console.log(`Location obtained: ${latitude}, ${longitude}, accuracy: ${accuracy}m`);

                    // Get location name with retry
                    const locationName = await getLocationNameWithRetry(latitude, longitude);

                    resolve({
                        location: {
                            latitude,
                            longitude,
                            accuracy
                        },
                        locationName
                    });
                } catch (error) {
                    console.error('Error in getCurrentLocationWithName:', error);
                    // If reverse geocoding fails, still return coordinates
                    const { latitude, longitude, accuracy } = position.coords;
                    resolve({
                        location: {
                            latitude,
                            longitude,
                            accuracy
                        },
                        locationName: {
                            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                            fullAddress: `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                            city: 'Unknown City',
                            state: 'Unknown State',
                            country: 'Unknown Country',
                            coordinates: { latitude, longitude },
                            accuracy: 0.1,
                            error: error.message
                        }
                    });
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Failed to get location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied. Please allow location access when prompted by your browser.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location unavailable. Please try again or use manual location entry.';
                        break;
                    case error.TIMEOUT:
                        if (retryCount < 2) {
                            console.log('Location timeout, retrying...');
                            setTimeout(() => {
                                getCurrentLocationWithName(retryCount + 1)
                                    .then(resolve)
                                    .catch(reject);
                            }, 2000);
                            return;
                        }
                        errorMessage = 'Location request timed out. Please try again or use manual location entry.';
                        break;
                    default:
                        errorMessage = 'Location error. Please try again or use manual location entry.';
                        break;
                }
                reject(new Error(errorMessage));
            },
            options
        );
    });
};

/**
 * Search for locations by name (forward geocoding)
 * @param {string} query - Location name to search for
 * @returns {Promise<Array>} Array of location results
 */
export const searchLocations = async (query) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'ToolDetect/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        return data.map(item => ({
            name: item.display_name,
            coordinates: {
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon)
            },
            importance: item.importance,
            type: item.type,
            address: item.address
        }));

    } catch (error) {
        console.error('Location search error:', error);
        throw error;
    }
};

/**
 * Get location name for coordinates with caching to avoid repeated API calls
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<string>} Location name
 */
export const getLocationNameForCoords = async (latitude, longitude) => {
    try {
        const locationName = await getLocationName(latitude, longitude);
        return locationName.name;
    } catch (error) {
        console.error('Failed to get location name:', error);
        return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
};

export default {
    getLocationName,
    getCurrentLocationWithName,
    searchLocations,
    getLocationNameForCoords
};
