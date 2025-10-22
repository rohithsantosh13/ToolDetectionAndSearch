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
    console.log(`getLocationNameWithRetry called: ${latitude}, ${longitude}, retry: ${retryCount}`);
    try {
        const result = await getLocationName(latitude, longitude);
        console.log('getLocationNameWithRetry success:', result);
        return result;
    } catch (error) {
        console.error(`getLocationNameWithRetry error (attempt ${retryCount + 1}):`, error);
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
    console.log('getCurrentLocationWithName called with retryCount:', retryCount);
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser');
            reject(new Error('Geolocation is not supported by this browser'));
            return;
        }

        console.log('Geolocation is supported, requesting location...');

        // Check if running on HTTPS (required for mobile geolocation)
        const isHttps = window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        console.log('Protocol check:', {
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isHttps
        });

        // Note: HTTPS is required for mobile geolocation, but we'll allow HTTP for local development
        // For production, ensure the app is served over HTTPS

        // Note: We'll let the geolocation API handle permission checks naturally
        // This avoids blocking legitimate requests on mobile devices

        // Enhanced mobile detection
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
        const isAndroid = /android/i.test(navigator.userAgent.toLowerCase());

        // Enhanced geolocation options for better accuracy
        const options = {
            enableHighAccuracy: true,  // Always enable high accuracy
            timeout: isMobile ? 30000 : 20000,  // Longer timeout for mobile
            maximumAge: 0  // Don't use cached location, get fresh location
        };

        // For iOS, we can try to get even more accurate location
        if (isIOS) {
            options.timeout = 45000;  // Even longer timeout for iOS
        }

        // Helper function to process the location
        const processLocation = async (lat, lng, acc) => {
            console.log('Processing location:', lat, lng, 'Accuracy:', acc, 'meters');

            try {
                // Get location name with retry
                const locationName = await getLocationNameWithRetry(lat, lng);
                console.log('Location name resolved:', locationName);

                resolve({
                    location: {
                        latitude: lat,
                        longitude: lng,
                        accuracy: acc
                    },
                    locationName
                });
            } catch (error) {
                console.error('Error getting location name:', error);
                console.log('Attempting fallback location name resolution...');

                // Try a simpler fallback approach
                try {
                    const fallbackName = await getLocationName(lat, lng);
                    console.log('Fallback location name successful:', fallbackName);
                    resolve({
                        location: {
                            latitude: lat,
                            longitude: lng,
                            accuracy: acc
                        },
                        locationName: fallbackName
                    });
                } catch (fallbackError) {
                    console.error('Fallback also failed:', fallbackError);
                    // If reverse geocoding fails, still return coordinates
                    resolve({
                        location: {
                            latitude: lat,
                            longitude: lng,
                            accuracy: acc
                        },
                        locationName: {
                            name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                            fullAddress: `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                            city: 'Unknown City',
                            state: 'Unknown State',
                            country: 'Unknown Country',
                            coordinates: { latitude: lat, longitude: lng },
                            accuracy: acc,
                            error: error.message
                        }
                    });
                }
            }
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                console.log('Geolocation success:', position);
                try {
                    const { latitude, longitude, accuracy } = position.coords;
                    console.log('Position coords:', { latitude, longitude, accuracy });

                    // Validate coordinates
                    if (!isValidCoordinates(latitude, longitude)) {
                        console.error('Invalid coordinates received:', { latitude, longitude });
                        throw new Error('Invalid coordinates received');
                    }

                    console.log(`Location obtained: ${latitude}, ${longitude}, accuracy: ${accuracy}m`);

                    // Enhanced accuracy checking - if accuracy is poor, try to get better location
                    if (accuracy > 100 && retryCount < 2) {
                        console.log(`Location accuracy is low (${accuracy}m), trying to get better location...`);

                        // Try to get a more accurate location
                        navigator.geolocation.getCurrentPosition(
                            async (betterPosition) => {
                                const { latitude: betterLat, longitude: betterLng, accuracy: betterAccuracy } = betterPosition.coords;
                                console.log(`Got better location: ${betterLat}, ${betterLng}, accuracy: ${betterAccuracy}m`);

                                if (betterAccuracy < accuracy) {
                                    console.log('Using better location');
                                    await processLocation(betterLat, betterLng, betterAccuracy);
                                } else {
                                    console.log('Better location not available, using original');
                                    await processLocation(latitude, longitude, accuracy);
                                }
                            },
                            (error) => {
                                console.log('Failed to get better location, using original:', error);
                                processLocation(latitude, longitude, accuracy);
                            },
                            {
                                enableHighAccuracy: true,
                                timeout: 20000,
                                maximumAge: 0
                            }
                        );
                        return;
                    }

                    await processLocation(latitude, longitude, accuracy);
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
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);

                let errorMessage = 'Failed to get location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        console.error('Permission denied - user blocked location access');
                        errorMessage = 'Location access denied. Please allow location access when prompted by your browser.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        console.error('Position unavailable - GPS/location services may be disabled');
                        errorMessage = 'Location unavailable. Please try again or use manual location entry.';
                        break;
                    case error.TIMEOUT:
                        console.error('Location timeout - taking too long to get location');
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
                        console.error('Unknown geolocation error');
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
 * Search for locations by name (forward geocoding) with location bias like Google Maps
 * @param {string} query - Location name to search for
 * @param {Object} currentLocation - Current user location for bias
 * @returns {Promise<Array>} Array of location results
 */
export const searchLocations = async (query, currentLocation = null) => {
    try {
        console.log('Searching locations for:', query, 'with current location bias:', currentLocation);

        // Build search URL with location bias
        let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&extratags=1`;

        // Add location bias if current location is available (like Google Maps)
        if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
            searchUrl += `&viewbox=${currentLocation.longitude - 0.1},${currentLocation.latitude + 0.1},${currentLocation.longitude + 0.1},${currentLocation.latitude - 0.1}&bounded=1`;
            console.log('Using location bias for search');
        }

        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'ToolDetect/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Search results received:', data.length, 'results');

        // Enhanced result processing with distance calculation and smart sorting
        const results = data.map(item => {
            const coords = {
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon)
            };

            // Calculate distance from current location if available
            let distance = null;
            if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
                distance = calculateDistance(
                    currentLocation.latitude,
                    currentLocation.longitude,
                    coords.latitude,
                    coords.longitude
                );
            }

            return {
                name: item.display_name,
                coordinates: coords,
                importance: item.importance || 0,
                type: item.type,
                address: item.address,
                distance: distance,
                relevanceScore: calculateRelevanceScore(item, query, distance)
            };
        });

        // Sort by relevance (distance + importance + query match)
        const sortedResults = results.sort((a, b) => {
            // Prioritize nearby results first
            if (a.distance !== null && b.distance !== null) {
                if (Math.abs(a.distance - b.distance) < 1) { // If distances are very close
                    return b.relevanceScore - a.relevanceScore; // Sort by relevance
                }
                return a.distance - b.distance; // Sort by distance
            }
            return b.relevanceScore - a.relevanceScore; // Sort by relevance
        });

        console.log('Sorted results:', sortedResults.slice(0, 5).map(r => ({
            name: r.name,
            distance: r.distance,
            relevance: r.relevanceScore
        })));

        return sortedResults.slice(0, 8); // Return top 8 results

    } catch (error) {
        console.error('Location search error:', error);
        throw error;
    }
};

/**
 * Calculate distance between two coordinates in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Calculate relevance score for search results
 */
const calculateRelevanceScore = (item, query, distance) => {
    let score = 0;

    // Base importance from OpenStreetMap
    score += (item.importance || 0) * 10;

    // Query match scoring
    const queryLower = query.toLowerCase();
    const displayName = item.display_name.toLowerCase();

    // Exact match gets highest score
    if (displayName.includes(queryLower)) {
        score += 50;
    }

    // Partial match scoring
    const queryWords = queryLower.split(' ');
    let wordMatches = 0;
    queryWords.forEach(word => {
        if (displayName.includes(word)) {
            wordMatches++;
        }
    });
    score += wordMatches * 10;

    // Distance penalty (closer is better)
    if (distance !== null) {
        if (distance < 1) score += 30; // Very close
        else if (distance < 5) score += 20; // Close
        else if (distance < 20) score += 10; // Moderate
        else score += 5; // Far
    }

    // Type-based scoring
    if (item.type === 'house' || item.type === 'building') score += 15;
    else if (item.type === 'street') score += 12;
    else if (item.type === 'city') score += 8;
    else if (item.type === 'state') score += 5;

    return score;
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
