class MapService {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.markerClusters = new Map(); // Store markers by location
        this.countryBorders = new Map(); // Store country border layers
        this.mapboxToken = 'pk.eyJ1IjoicnVzdGFtbGl0dXJhbiIsImEiOiJjbWM0emZqaDkwbTkzMmpvZnVmMXg0cDk0In0.-BKmIUbF7HoXSVCyDDUxRA';
        console.log('MapService initialized');
        this.init();
        this.addCountryBorders();
    }

    init() {
        console.log('Initializing map...');
        try {
            mapboxgl.accessToken = this.mapboxToken;
            
            // Initialize the map with Mapbox GL
            this.map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/dark-v11',
                center: CONFIG.map.center.reverse(), // Mapbox uses [lng, lat] format
                zoom: CONFIG.map.zoom,
                attributionControl: true
            });

            // Add zoom and rotation controls
            this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
            
            // Add fullscreen control
            this.map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

            console.log('Map initialized successfully with Mapbox GL');
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }

    async addCountryBorders() {
        try {
            this.map.on('load', () => {
                // Add source for country borders
                this.map.addSource('country-borders', {
                    type: 'geojson',
                    data: COUNTRY_BORDERS
                });

                // Add border layer
                this.map.addLayer({
                    'id': 'country-borders',
                    'type': 'line',
                    'source': 'country-borders',
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': '#ff3b30',
                        'line-width': 3,
                        'line-opacity': 0.8,
                        'line-dasharray': [5, 10]
                    }
                });

                // Add fill layer
                this.map.addLayer({
                    'id': 'country-fills',
                    'type': 'fill',
                    'source': 'country-borders',
                    'paint': {
                        'fill-color': '#ff3b30',
                        'fill-opacity': 0.1
                    }
                });
            });

            console.log('Country borders added successfully');
        } catch (error) {
            console.error('Error adding country borders:', error);
        }
    }

    findLocation(locationName) {
        console.log('Looking up location:', locationName);
        
        // Clean up the location name
        const cleanName = locationName.trim()
            .replace(/^(in|at|near|from|to)\s+/i, '') // Remove location prefixes
            .replace(/[,.;].*$/, ''); // Remove everything after comma, period, or semicolon
        
        // Check direct match
        if (CONFIG.knownLocations[cleanName]) {
            console.log('Found exact location match:', cleanName);
            return {
                name: cleanName,
                ...CONFIG.knownLocations[cleanName]
            };
        }
        
        // Check case-insensitive match
        const lowerName = cleanName.toLowerCase();
        for (const [key, coords] of Object.entries(CONFIG.knownLocations)) {
            if (key.toLowerCase() === lowerName) {
                console.log('Found case-insensitive location match:', key);
                return {
                    name: key,
                    ...coords
                };
            }
        }
        
        // Check if the location contains any known location names
        for (const [key, coords] of Object.entries(CONFIG.knownLocations)) {
            if (cleanName.toLowerCase().includes(key.toLowerCase())) {
                console.log('Found partial location match:', key, 'in', cleanName);
                return {
                    name: key,
                    ...coords
                };
            }
        }
        
        console.log('No location match found for:', locationName);
        return null;
    }

    // Calculate offset for overlapping markers
    calculateMarkerOffset(location) {
        const key = `${location.lat},${location.lon}`;
        if (!this.markerClusters.has(key)) {
            this.markerClusters.set(key, []);
            return { lat: 0, lon: 0 };
        }

        const existingMarkers = this.markerClusters.get(key);
        const offset = 0.001; // approximately 100 meters
        const angle = (2 * Math.PI * existingMarkers.length) / 8; // Distribute in a circle
        
        return {
            lat: offset * Math.cos(angle),
            lon: offset * Math.sin(angle)
        };
    }

    addIncident(id, location, details) {
        console.log('Adding incident:', { id, location, details });
        if (this.markers.has(id)) {
            console.log('Incident already exists:', id);
            return;
        }

        try {
            const offset = this.calculateMarkerOffset(location);
            const adjustedLocation = {
                lat: location.lat + offset.lat,
                lon: location.lon + offset.lon
            };

            // Create marker element
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.style.backgroundColor = '#ff4444';
            el.style.border = '2px solid #ffffff';
            el.style.borderRadius = '50%';
            el.style.width = '16px';
            el.style.height = '16px';
            el.style.cursor = 'pointer';

            // Create popup content
            const popupContent = this.createPopupContent(location, details);

            // Create popup with smaller size
            const popup = new mapboxgl.Popup({
                offset: 25,
                closeButton: true,
                closeOnClick: false,
                className: 'custom-popup dark-mode',
                maxWidth: '220px'
            }).setHTML(popupContent);

            // Create marker
            const marker = new mapboxgl.Marker(el)
                .setLngLat([adjustedLocation.lon, adjustedLocation.lat])
                .setPopup(popup)
                .addTo(this.map);

            // Add hover effect
            el.addEventListener('mouseenter', () => {
                el.style.width = '20px';
                el.style.height = '20px';
                el.style.backgroundColor = '#ff6666';
            });

            el.addEventListener('mouseleave', () => {
                el.style.width = '16px';
                el.style.height = '16px';
                el.style.backgroundColor = '#ff4444';
            });

            // Add to clusters
            const key = `${location.lat},${location.lon}`;
            if (!this.markerClusters.has(key)) {
                this.markerClusters.set(key, []);
            }
            this.markerClusters.get(key).push(marker);

            // Store marker
            this.markers.set(id, {
                marker,
                timestamp: new Date(details.timestamp),
                originalLocation: location
            });

            console.log('Incident added successfully:', id);
        } catch (error) {
            console.error('Error adding incident:', error);
        }
    }

    createPopupContent(location, details) {
        const getCountryName = (code) => {
            const strCode = String(code).trim();
            if (strCode === '1') return 'Israel';
            if (strCode === '2') return 'Iran';
            if (['Israel', 'Iran'].includes(strCode)) return strCode;
            return strCode;
        };

        // Format date
        const formatDate = (timestamp) => {
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        };

        return `
            <div class="incident-header dark-mode">
                <h3>${details.title}</h3>
                <div class="date">${formatDate(details.timestamp)}</div>
            </div>
            <div class="incident-body dark-mode">
                <div class="target-info">
                    <div class="value">${location.name} (${getCountryName(location.targetType)})</div>
                </div>
                
                <div class="attack-stats">
                    <div class="stat-box">
                        <div class="value">Attacker: ${getCountryName(location.attacker)}</div>
                    </div>
                </div>
                
                ${location.weaponType ? `
                    <div class="weapon-tags">
                        ${location.weaponType.split(',').map(weapon => 
                            `<span class="weapon-tag">${weapon.trim()}</span>`
                        ).join('')}
                    </div>
                ` : ''}
                
                ${location.casualties ? `
                    <div class="casualties-grid">
                        <div class="stat-box">
                            <span>Deaths: ${location.casualties.dead || 0}</span>
                            <span>Wounded: ${location.casualties.wounded || 0}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    removeIncident(id) {
        console.log('Removing incident:', id);
        if (this.markers.has(id)) {
            const { marker, originalLocation } = this.markers.get(id);
            
            // Remove from cluster
            const key = `${originalLocation.lat},${originalLocation.lon}`;
            if (this.markerClusters.has(key)) {
                const cluster = this.markerClusters.get(key);
                const index = cluster.indexOf(marker);
                if (index > -1) {
                    cluster.splice(index, 1);
                }
                if (cluster.length === 0) {
                    this.markerClusters.delete(key);
                }
            }

            marker.remove();
            this.markers.delete(id);
            console.log('Incident removed:', id);
        }
    }

    clearOldIncidents(maxAge) {
        console.log('Clearing old incidents...');
        const now = Date.now();
        this.markers.forEach(({ marker, timestamp }, id) => {
            if (now - timestamp.getTime() > maxAge) {
                this.removeIncident(id);
            }
        });
    }

    clearAllIncidents() {
        console.log('Clearing all incidents from map');
        this.markers.forEach(({ marker }) => {
            marker.remove();
        });
        this.markers.clear();
        this.markerClusters.clear();
    }
} 