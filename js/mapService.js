class MapService {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.markerClusters = new Map(); // Store markers by location
        this.countryBorders = new Map(); // Store country border layers
        this.impactCircles = new Map(); // Store impact radius circles
        this.mapboxToken = 'pk.eyJ1IjoicnVzdGFtbGl0dXJhbiIsImEiOiJjbWM0emZqaDkwbTkzMmpvZnVmMXg0cDk0In0.-BKmIUbF7HoXSVCyDDUxRA';
        
        // Define color schemes for different radius ranges
        this.radiusColors = {
            900: {
                main: '#FF0000',      // Bright red
                fill: '#FF000033',    // Semi-transparent red
                ripple: '#FF0000'     // Red for ripple
            },
            800: {
                main: '#FF4500',      // Orange Red
                fill: '#FF450033',    // Semi-transparent orange red
                ripple: '#FF4500'     // Orange red for ripple
            },
            700: {
                main: '#FF6B00',      // Dark Orange
                fill: '#FF6B0033',    // Semi-transparent dark orange
                ripple: '#FF6B00'     // Dark orange for ripple
            },
            600: {
                main: '#FF8C00',      // Orange
                fill: '#FF8C0033',    // Semi-transparent orange
                ripple: '#FF8C00'     // Orange for ripple
            },
            500: {
                main: '#FFA500',      // Light Orange
                fill: '#FFA50033',    // Semi-transparent light orange
                ripple: '#FFA500'     // Light orange for ripple
            }
        };

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
                attributionControl: true,
                pitch: 0,
                bearing: 0
            });

            // Add zoom and rotation controls
            this.map.addControl(new mapboxgl.NavigationControl({
                showCompass: false
            }), 'top-right');
            
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

    // Get color scheme based on radius
    getColorScheme(radius) {
        // Find the closest radius category
        const radiusCategories = Object.keys(this.radiusColors)
            .map(Number)
            .sort((a, b) => b - a); // Sort in descending order

        for (const category of radiusCategories) {
            if (radius >= category) {
                return this.radiusColors[category];
            }
        }

        // Default color scheme if no match found
        return this.radiusColors[500]; // Use the lowest category colors
    }

    createImpactRadiusLayer(id, location, radius) {
        if (!radius || radius <= 0) return null;

        const colorScheme = this.getColorScheme(radius);
        
        // Create a point feature for the center
        const center = [location.lon, location.lat];
        
        // Create a circle with the specified radius
        const radiusInKm = radius / 1000;
        const options = {
            steps: 64,
            units: 'kilometers'
        };
        
        // Generate circle polygon coordinates
        const coordinates = [];
        const angleStep = 360 / options.steps;
        
        for (let i = 0; i < options.steps; i++) {
            const angle = i * angleStep;
            const lat = location.lat + (radiusInKm / 111.32) * Math.cos(angle * Math.PI / 180);
            const lon = location.lon + (radiusInKm / (111.32 * Math.cos(location.lat * Math.PI / 180))) * Math.sin(angle * Math.PI / 180);
            coordinates.push([lon, lat]);
        }
        coordinates.push(coordinates[0]);

        const circleFeature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [coordinates]
            },
            'properties': {
                'radius': radius,
                'center': center
            }
        };

        const sourceId = `impact-source-${id}`;
        const layerId = `impact-layer-${id}`;

        if (!this.map.getSource(sourceId)) {
            this.map.addSource(sourceId, {
                'type': 'geojson',
                'data': circleFeature
            });
        }

        if (!this.map.getLayer(layerId)) {
            // Add fill layer for the impact radius
            this.map.addLayer({
                'id': layerId,
                'type': 'fill',
                'source': sourceId,
                'paint': {
                    'fill-color': colorScheme.main,
                    'fill-opacity': 0.15
                }
            });

            // Add inner gradient fill layer
            this.map.addLayer({
                'id': `${layerId}-gradient`,
                'type': 'fill',
                'source': sourceId,
                'paint': {
                    'fill-color': colorScheme.main,
                    'fill-opacity': [
                        'interpolate',
                        ['exponential', 2],
                        ['distance-from-center'],
                        0, 0.3,
                        radius * 0.5, 0.15,
                        radius, 0.05
                    ]
                }
            });

            // Add outline layer
            this.map.addLayer({
                'id': `${layerId}-outline`,
                'type': 'line',
                'source': sourceId,
                'paint': {
                    'line-color': colorScheme.main,
                    'line-width': 2,
                    'line-opacity': 0.5
                }
            });

            // Add animated pulse rings
            for (let i = 1; i <= 3; i++) {
                this.map.addLayer({
                    'id': `${layerId}-pulse-${i}`,
                    'type': 'line',
                    'source': sourceId,
                    'paint': {
                        'line-color': colorScheme.main,
                        'line-width': [
                            'interpolate',
                            ['exponential', 1],
                            ['zoom'],
                            10, 2,
                            15, 3
                        ],
                        'line-opacity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            10, 0.3,
                            15, 0.15
                        ],
                        'line-blur': 1
                    }
                });

                const duration = 2000;
                const delay = (i - 1) * (duration / 3);
                
                const animate = () => {
                    const start = performance.now();
                    
                    const frame = (now) => {
                        const progress = (now - start) % duration / duration;
                        const opacity = Math.max(0, 0.5 * (1 - progress));
                        const width = 2 + (progress * 2);
                        
                        if (this.map.getLayer(`${layerId}-pulse-${i}`)) {
                            this.map.setPaintProperty(
                                `${layerId}-pulse-${i}`,
                                'line-opacity',
                                opacity
                            );
                            this.map.setPaintProperty(
                                `${layerId}-pulse-${i}`,
                                'line-width',
                                width
                            );
                            requestAnimationFrame(frame);
                        }
                    };
                    
                    setTimeout(() => requestAnimationFrame(frame), delay);
                };
                
                animate();
            }
        }

        return { 
            sourceId, 
            layerId,
            gradientLayerId: `${layerId}-gradient`,
            outlineLayerId: `${layerId}-outline`,
            pulseLayerIds: [1, 2, 3].map(i => `${layerId}-pulse-${i}`),
            colorScheme
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

            // Get color scheme based on impact radius
            const colorScheme = this.getColorScheme(parseFloat(location.impactRadius || 500));

            // Create marker container
            const container = document.createElement('div');
            container.className = 'marker-container';
            container.style.setProperty('--marker-color', colorScheme.main);

            // Create marker element
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.style.backgroundColor = colorScheme.main;

            // Create ripple container
            const rippleContainer = document.createElement('div');
            rippleContainer.className = 'ripple-container';

            // Create ripple elements with custom color
            const ripple1 = document.createElement('div');
            ripple1.className = 'ripple ripple-1';
            ripple1.style.setProperty('--ripple-color', colorScheme.main);

            const ripple2 = document.createElement('div');
            ripple2.className = 'ripple ripple-2';
            ripple2.style.setProperty('--ripple-color', colorScheme.main);

            // Assemble the marker structure
            rippleContainer.appendChild(ripple1);
            rippleContainer.appendChild(ripple2);
            container.appendChild(rippleContainer);
            container.appendChild(el);

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
            const marker = new mapboxgl.Marker({
                element: container,
                anchor: 'center'
            })
                .setLngLat([adjustedLocation.lon, adjustedLocation.lat])
                .setPopup(popup)
                .addTo(this.map);

            // Add impact radius circle if radius is specified
            let impactCircle = null;
            if (location.impactRadius) {
                impactCircle = this.createImpactRadiusLayer(id, adjustedLocation, parseFloat(location.impactRadius));
            }

            // Add hover effect
            el.addEventListener('mouseenter', () => {
                container.style.width = '20px';
                container.style.height = '20px';
                el.style.backgroundColor = this.adjustColor(colorScheme.main, 20);
                
                // Highlight impact radius on hover
                if (impactCircle) {
                    this.map.setPaintProperty(impactCircle.layerId, 'fill-opacity', 0.25);
                    this.map.setPaintProperty(impactCircle.gradientLayerId, 'fill-opacity', [
                        'interpolate',
                        ['exponential', 2],
                        ['distance-from-center'],
                        0, 0.5,
                        parseFloat(location.impactRadius) * 0.5, 0.25,
                        parseFloat(location.impactRadius), 0.1
                    ]);
                    impactCircle.pulseLayerIds.forEach(layerId => {
                        this.map.setPaintProperty(layerId, 'line-opacity', 0.5);
                    });
                }
            });

            el.addEventListener('mouseleave', () => {
                container.style.width = '16px';
                container.style.height = '16px';
                el.style.backgroundColor = colorScheme.main;
                
                // Reset impact radius opacity on mouse leave
                if (impactCircle) {
                    this.map.setPaintProperty(impactCircle.layerId, 'fill-opacity', 0.15);
                    this.map.setPaintProperty(impactCircle.gradientLayerId, 'fill-opacity', [
                        'interpolate',
                        ['exponential', 2],
                        ['distance-from-center'],
                        0, 0.3,
                        parseFloat(location.impactRadius) * 0.5, 0.15,
                        parseFloat(location.impactRadius), 0.05
                    ]);
                    impactCircle.pulseLayerIds.forEach(layerId => {
                        this.map.setPaintProperty(layerId, 'line-opacity', 0.3);
                    });
                }
            });

            // Add to clusters
            const key = `${location.lat},${location.lon}`;
            if (!this.markerClusters.has(key)) {
                this.markerClusters.set(key, []);
            }
            this.markerClusters.get(key).push(marker);

            // Store marker and impact circle
            this.markers.set(id, {
                marker,
                timestamp: new Date(details.timestamp),
                originalLocation: location,
                impactCircle
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
                    ${location.weaponDetails ? `
                        <div class="weapon-details">
                            <div class="label">Silahın Dəqiq Növü:</div>
                            <div class="value">${location.weaponDetails}</div>
                        </div>
                    ` : ''}
                    ${location.impactRadius ? `
                        <div class="impact-radius">
                            <div class="label">Təsir Radiusu:</div>
                            <div class="value">${location.impactRadius} metr</div>
                        </div>
                    ` : ''}
                ` : ''}
                
                ${location.casualties ? `
                    <div class="casualties-grid">
                        <div class="stat-box">
                            <span>Ölü sayı: ${location.casualties.dead}</span>
                            <span>Yaralı sayı: ${location.casualties.wounded}</span>
                        </div>
                    </div>
                ` : ''}
                
                ${location.id && location.id.startsWith('manual-') ? `
                    <div class="popup-actions">
                        <button class="edit-button" onclick="window.dataEntryService.editIncident('${location.id}')">
                            Düzənlə
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    removeIncident(id) {
        console.log('Removing incident:', id);
        if (this.markers.has(id)) {
            const { marker, originalLocation, impactCircle } = this.markers.get(id);
            
            // Remove impact radius layers if they exist
            if (impactCircle) {
                // Remove pulse layers
                impactCircle.pulseLayerIds.forEach(layerId => {
                    if (this.map.getLayer(layerId)) {
                        this.map.removeLayer(layerId);
                    }
                });
                
                if (this.map.getLayer(impactCircle.outlineLayerId)) {
                    this.map.removeLayer(impactCircle.outlineLayerId);
                }
                if (this.map.getLayer(impactCircle.layerId)) {
                    this.map.removeLayer(impactCircle.layerId);
                }
                if (this.map.getSource(impactCircle.sourceId)) {
                    this.map.removeSource(impactCircle.sourceId);
                }
            }

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

    // Helper function to adjust color brightness
    adjustColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
} 