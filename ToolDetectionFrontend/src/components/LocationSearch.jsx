import React, { useState, useEffect, useRef } from 'react';
import { searchLocations } from '../services/locationService';

const LocationSearch = ({ onLocationSelect, placeholder = "Search for a location...", currentLocation = null }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Debounce search to avoid too many API calls
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim().length > 2) {
                performSearch(query.trim());
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query]);

    const performSearch = async (searchQuery) => {
        setLoading(true);
        try {
            console.log('LocationSearch: Searching with current location bias:', currentLocation);
            const results = await searchLocations(searchQuery, currentLocation);
            console.log('LocationSearch: Received results:', results.length);
            setSuggestions(results);
            setShowSuggestions(true);
            setSelectedIndex(-1);
        } catch (error) {
            console.error('Location search error:', error);
            setSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setQuery(e.target.value);
        setShowSuggestions(true);
    };

    const handleSuggestionClick = (suggestion) => {
        setQuery(suggestion.name);
        setShowSuggestions(false);
        setSuggestions([]);
        onLocationSelect(suggestion);
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSuggestionClick(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
        }
    };

    const handleInputFocus = () => {
        if (suggestions.length > 0) {
            setShowSuggestions(true);
        }
    };

    const handleInputBlur = () => {
        // Delay hiding suggestions to allow clicking on them
        setTimeout(() => {
            setShowSuggestions(false);
            setSelectedIndex(-1);
        }, 200);
    };

    return (
        <div className="location-search" style={{ position: 'relative', width: '100%' }}>
            <div className="search-input">
                <input
                    ref={inputRef}
                    type="text"
                    className="form-input"
                    placeholder={placeholder}
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    style={{
                        paddingLeft: '2.5rem',
                        fontSize: '16px', // Prevents zoom on iOS
                        minHeight: '44px' // Touch-friendly
                    }}
                />
                <div className="search-icon" style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-light)',
                    fontSize: '1rem'
                }}>
                    {loading ? (
                        <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                    ) : (
                        '🔍'
                    )}
                </div>
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="suggestions-dropdown"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'var(--background)',
                        border: '1px solid var(--border-color)',
                        borderTop: 'none',
                        borderRadius: '0 0 var(--border-radius) var(--border-radius)',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto'
                    }}
                >
                    {suggestions.map((suggestion, index) => (
                        <div
                            key={index}
                            className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSuggestionClick(suggestion)}
                            style={{
                                padding: '1rem',
                                cursor: 'pointer',
                                borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                                backgroundColor: index === selectedIndex ? 'var(--background-secondary)' : 'transparent',
                                transition: 'background-color 0.2s ease',
                                minHeight: '44px', // Touch-friendly
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center'
                            }}
                        >
                            <div style={{
                                fontWeight: '500',
                                marginBottom: '0.25rem',
                                color: 'var(--text-primary)'
                            }}>
                                📍 {suggestion.name}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span>
                                    {suggestion.address?.city && `${suggestion.address.city}, `}
                                    {suggestion.address?.state && `${suggestion.address.state}, `}
                                    {suggestion.address?.country}
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {suggestion.distance !== null && (
                                        <span style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--primary-color)',
                                            backgroundColor: 'var(--primary-light)',
                                            padding: '0.125rem 0.375rem',
                                            borderRadius: '0.25rem',
                                            fontWeight: '500'
                                        }}>
                                            {suggestion.distance < 1 ? `${(suggestion.distance * 1000).toFixed(0)}m` : `${suggestion.distance.toFixed(1)}km`}
                                        </span>
                                    )}
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-light)',
                                        backgroundColor: 'var(--background-secondary)',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '0.25rem'
                                    }}>
                                        {suggestion.type}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {query.length > 0 && query.length <= 2 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border-color)',
                    borderTop: 'none',
                    borderRadius: '0 0 var(--border-radius) var(--border-radius)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    textAlign: 'center'
                }}>
                    Type at least 3 characters to search...
                </div>
            )}
        </div>
    );
};

export default LocationSearch;
