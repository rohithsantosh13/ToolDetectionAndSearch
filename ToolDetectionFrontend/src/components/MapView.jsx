import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getImageUrl } from '../services/api';

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

const MapView = ({ images, userLocation, radius }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map with better default view
    const defaultCenter = userLocation ? [userLocation.latitude, userLocation.longitude] : [40.7128, -74.0060];
    const defaultZoom = userLocation ? 12 : 10;

    mapInstance.current = L.map(mapRef.current).setView(defaultCenter, defaultZoom);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance.current);

    // Add user location marker if available
    if (userLocation) {
      L.marker([userLocation.latitude, userLocation.longitude])
        .addTo(mapInstance.current)
        .bindPopup('📍 Your Location')
        .openPopup();

      // Add radius circle if radius is provided
      if (radius) {
        L.circle([userLocation.latitude, userLocation.longitude], {
          color: 'blue',
          fillColor: 'blue',
          fillOpacity: 0.1,
          radius: radius
        }).addTo(mapInstance.current);
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
    };
  }, [userLocation, radius]);

  useEffect(() => {
    if (!mapInstance.current || !images.length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstance.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Add markers for each image
    images.forEach((image) => {
      const marker = L.marker([image.latitude, image.longitude])
        .addTo(mapInstance.current);

      // Create popup content
      const popupContent = `
        <div style="max-width: 200px;">
          <img src="${getImageUrl(image.id)}" 
               style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" 
               alt="${image.original_filename || image.filename}" />
          <div style="font-size: 12px;">
            <strong>${image.original_filename || image.filename}</strong>
            ${image.tags && image.tags.length > 0 ? `
              <div style="margin: 4px 0;">
                ${image.tags.map((tag, index) => `
                  <span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin: 1px; display: inline-block;">
                    ${tag}
                    ${image.confidences && image.confidences[index] ?
          ` (${(image.confidences[index] * 100).toFixed(0)}%)` : ''}
                  </span>
                `).join('')}
              </div>
            ` : ''}
            <div style="color: #666; margin-top: 4px;">
              📍 ${image.latitude.toFixed(4)}, ${image.longitude.toFixed(4)}
            </div>
            <div style="color: #666; font-size: 10px;">
              ${new Date(image.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });

    // Add user location marker if available
    if (userLocation) {
      const userMarker = L.circleMarker([userLocation.latitude, userLocation.longitude], {
        radius: 8,
        fillColor: '#007bff',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(mapInstance.current);

      userMarker.bindPopup(`
        <div style="text-align: center;">
          <strong>📍 Your Location</strong><br>
          <small>${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}</small>
        </div>
      `);

      markersRef.current.push(userMarker);

      // Add search radius circle
      if (radius) {
        const radiusCircle = L.circle([userLocation.latitude, userLocation.longitude], {
          radius: radius,
          color: '#007bff',
          weight: 2,
          opacity: 0.5,
          fillColor: '#007bff',
          fillOpacity: 0.1
        }).addTo(mapInstance.current);

        markersRef.current.push(radiusCircle);
      }
    }

    // Fit map to show all markers
    if (images.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      mapInstance.current.fitBounds(group.getBounds().pad(0.1));
    } else if (userLocation) {
      mapInstance.current.setView([userLocation.latitude, userLocation.longitude], 13);
    }

  }, [images, userLocation, radius]);

  return (
    <div
      ref={mapRef}
      style={{
        height: '500px',
        width: '100%',
        borderRadius: 'var(--border-radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-md)'
      }}
    />
  );
};

export default MapView;
