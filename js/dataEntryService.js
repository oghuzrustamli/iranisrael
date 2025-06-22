class DataEntryService {
    constructor() {
        this.form = document.getElementById('incident-form');
        this.citiesSelect = document.getElementById('cities');
        this.toggleButton = document.getElementById('toggle-form');
        this.formContainer = document.getElementById('data-entry-form');
        
        // Initialize city data for dropdown
        this.israeliCities = [
            'Tel Aviv', 'Jerusalem', 'Haifa', 'Beer Sheva', 'Dimona',
            'Ashkelon', 'Ashdod', 'Netanya', 'Herzliya', 'Ramat Gan',
            'Rehovot', 'Rishon LeZion', 'Eilat', 'Holon', 'Petah Tikva',
            'Bat Yam', 'Nahariya', 'Kiryat Gat', 'Kiryat Shmona', 'Acre',
            'Safed', 'Kiryat Ekron', 'Bnei Brak', 'Caesarea', 'Azor',
            'Karmiel', 'Gush Dan', 'West Jerusalem', 'Tamra'
        ];
        
        this.iranianCities = [
            'Tehran', 'Isfahan', 'Natanz', 'Bushehr', 'Tabriz',
            'Shiraz', 'Kerman', 'Yazd', 'Arak', 'Qom',
            'Karaj', 'Mashhad', 'Bandar Abbas', 'Kermanshah', 'Hamadan',
            'Urmia', 'Khorramabad', 'Ahvaz', 'Chabahar', 'Zanjan',
            'Qazvin', 'Khorramshahr', 'Dezful', 'Birjand', 'Semnan',
            'Bandar-e Mahshahr', 'Fordow', 'Khondab', 'Parchin',
            'Piranshahr', 'Kashan', 'Khojir', 'Javadabad',
            'Najafabad', 'Malard', 'Ijrud'
        ];

        this.initializeEventListeners();
        this.populateCitiesList('Israel'); // Default to Israeli cities
        this.setDefaultDate();

        // Verify Firebase initialization
        this.checkFirebaseInitialization();
    }

    checkFirebaseInitialization() {
        if (!window.FirebaseService) {
            console.error('Firebase is not initialized!');
            return false;
        }
        console.log('Firebase is initialized and ready');
        return true;
    }

    async saveToFirebase(incidentId, data) {
        if (!this.checkFirebaseInitialization()) {
            throw new Error('Firebase is not initialized');
        }

        try {
            console.log('Attempting to save to Firebase:', { incidentId, data });
            
            // Create a reference to the news collection
            const newsRef = window.FirebaseService.ref(
                window.FirebaseService.database,
                'news/' + incidentId
            );

            // Save to news collection
            await window.FirebaseService.set(newsRef, {
                id: incidentId,
                title: `Attack on ${data.city}`,
                description: `${data.country} attacked ${data.city} using ${data.weapons.join(', ')}`,
                timestamp: data.timestamp,
                source: 'Manual Entry',
                url: '#',
                locations: [{
                    name: data.city,
                    lat: data.coordinates.lat,
                    lon: data.coordinates.lng,
                    attacker: data.country,
                    targetType: data.targetLocation,
                    attackTime: new Date(data.timestamp).toLocaleString(),
                    attackStatus: "successful",
                    casualties: {
                        dead: data.deaths,
                        wounded: data.injured
                    },
                    weaponType: data.weapons.join(', '),
                    isToday: true
                }]
            });

            console.log('Successfully saved to Firebase news collection:', incidentId);
            return true;
        } catch (error) {
            console.error('Firebase save error:', error);
            throw error;
        }
    }

    initializeEventListeners() {
        // Toggle form visibility
        this.toggleButton.addEventListener('click', () => this.toggleForm());
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Country change handler
        document.getElementById('country').addEventListener('change', (e) => {
            this.populateCitiesList(e.target.value);
        });
    }

    setDefaultDate() {
        // Set current date as default
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        
        const defaultDate = `${year}-${month}-${day}`;
        document.getElementById('incident-datetime').value = defaultDate;
    }

    populateCitiesList(country) {
        // Clear existing options
        this.citiesSelect.innerHTML = '';
        
        // Get the appropriate cities list
        const cities = country === 'Israel' ? this.israeliCities : this.iranianCities;
        
        // Add cities to select element
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            this.citiesSelect.appendChild(option);
        });
    }

    toggleForm() {
        const isVisible = this.formContainer.style.display !== 'none';
        this.formContainer.style.display = isVisible ? 'none' : 'block';
        this.toggleButton.textContent = isVisible ? 'Add Incident' : 'Close Form';
        
        if (!isVisible) {
            this.setDefaultDate();
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const selectedDate = new Date(document.getElementById('incident-datetime').value);
        selectedDate.setHours(12, 0, 0, 0);

        // Get selected cities and weapons
        const selectedCities = Array.from(this.citiesSelect.selectedOptions).map(option => option.value);
        const selectedWeapons = Array.from(document.getElementById('weapons').selectedOptions)
            .map(option => option.value);

        // Get casualties data and handle "No Info" case
        const deathsInput = document.getElementById('deaths').value.trim();
        const injuredInput = document.getElementById('injured').value.trim();
        
        const deaths = deathsInput.toLowerCase() === 'no info' ? 'No Info' : 
            isNaN(parseInt(deathsInput)) ? 'No Info' : parseInt(deathsInput);
        
        const injured = injuredInput.toLowerCase() === 'no info' ? 'No Info' : 
            isNaN(parseInt(injuredInput)) ? 'No Info' : parseInt(injuredInput);

        const formData = {
            country: document.getElementById('country').value,
            cities: selectedCities,
            targetLocation: document.getElementById('target-location').value,
            weapons: selectedWeapons,
            deaths: deaths,
            injured: injured,
            timestamp: selectedDate.getTime(),
            type: 'manual'
        };

        try {
            for (const city of selectedCities) {
                const coordinates = await this.getCityCoordinates(city, formData.country);
                const incidentId = `manual-${Date.now()}-${city.replace(/\s+/g, '-')}`;
                
                // Create incident data
                const incidentData = {
                    ...formData,
                    city: city,
                    coordinates: coordinates,
                    timestamp: selectedDate.getTime()
                };

                // Add marker to the map
                if (window.mapService && coordinates.lat !== 0 && coordinates.lng !== 0) {
                    const location = {
                        name: city,
                        lat: coordinates.lat,
                        lon: coordinates.lng,
                        attacker: formData.country === 'Iran' ? '2' : '1',  // Convert country name to code
                        targetType: formData.targetLocation,
                        attackTime: selectedDate.toLocaleString(),
                        attackStatus: "successful",
                        casualties: {
                            dead: formData.deaths,
                            wounded: formData.injured
                        },
                        weaponType: selectedWeapons.join(', ')
                    };

                    window.mapService.addIncident(incidentId, location, {
                        title: `Attack on ${city} - ${formData.targetLocation}`,
                        description: `Manual entry: ${formData.country} attacked ${city} (${formData.targetLocation}) using ${selectedWeapons.join(', ')}`,
                        timestamp: selectedDate.toLocaleString()
                    });
                    
                    window.mapService.map.setView([coordinates.lat, coordinates.lng], 8);
                }

                // Save to Firebase
                await this.saveToFirebase(incidentId, incidentData);
            }

            // Clear form and show success message
            this.form.reset();
            this.setDefaultDate();
            this.populateCitiesList(document.getElementById('country').value);
            alert('Incident(s) added successfully!');
            
            // Refresh the news feed
            if (window.newsService) {
                window.newsService.loadNewsFromFirebase();
            }
        } catch (error) {
            console.error('Error saving data:', error);
            alert('Error saving data: ' + error.message);
        }
    }

    async getCityCoordinates(city, country) {
        // You can replace this with a more accurate geocoding service
        const coordinates = {
            // Israel locations
            'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
            'Jerusalem': { lat: 31.7683, lng: 35.2137 },
            'Haifa': { lat: 32.7940, lng: 34.9896 },
            'Beer Sheva': { lat: 31.2518, lng: 34.7913 },
            'Dimona': { lat: 31.0684, lng: 35.0333 },
            'Ashkelon': { lat: 31.6689, lng: 34.5742 },
            'Ashdod': { lat: 31.7920, lng: 34.6497 },
            'Netanya': { lat: 32.3329, lng: 34.8599 },
            'Herzliya': { lat: 32.1649, lng: 34.8259 },
            'Ramat Gan': { lat: 32.0684, lng: 34.8248 },
            'Rehovot': { lat: 31.8928, lng: 34.8113 },
            'Rishon LeZion': { lat: 31.9497, lng: 34.8892 },
            'Eilat': { lat: 29.5577, lng: 34.9519 },
            'Holon': { lat: 32.0167, lng: 34.7667 },
            'Petah Tikva': { lat: 32.0869, lng: 34.8867 },
            'Bat Yam': { lat: 32.0231, lng: 34.7517 },
            'Nahariya': { lat: 33.0036, lng: 35.0981 },
            'Kiryat Gat': { lat: 31.6100, lng: 34.7642 },
            'Kiryat Shmona': { lat: 33.2075, lng: 35.5708 },
            'Acre': { lat: 32.9281, lng: 35.0820 },
            'Safed': { lat: 32.9646, lng: 35.4960 },
            'Kiryat Ekron': { lat: 31.8517, lng: 34.8219 },
            'Bnei Brak': { lat: 32.0907, lng: 34.8338 },
            'Caesarea': { lat: 32.5186, lng: 34.9019 },
            'Azor': { lat: 32.0243, lng: 34.8060 },
            'Karmiel': { lat: 32.9170, lng: 35.2950 },
            'Gush Dan': { lat: 32.0853, lng: 34.7818 },
            'West Jerusalem': { lat: 31.7857, lng: 35.2007 },
            'Tamra': { lat: 32.8530, lng: 35.1981 },

            // Iran locations
            'Tehran': { lat: 35.6892, lng: 51.3890 },
            'Isfahan': { lat: 32.6546, lng: 51.6680 },
            'Natanz': { lat: 33.5133, lng: 51.9244 },
            'Bushehr': { lat: 28.9684, lng: 50.8385 },
            'Tabriz': { lat: 38.0962, lng: 46.2738 },
            'Shiraz': { lat: 29.5926, lng: 52.5836 },
            'Kerman': { lat: 30.2839, lng: 57.0834 },
            'Yazd': { lat: 31.8974, lng: 54.3569 },
            'Arak': { lat: 34.0954, lng: 49.7013 },
            'Qom': { lat: 34.6416, lng: 50.8746 },
            'Karaj': { lat: 35.8400, lng: 50.9391 },
            'Mashhad': { lat: 36.2605, lng: 59.6168 },
            'Bandar Abbas': { lat: 27.1832, lng: 56.2667 },
            'Kermanshah': { lat: 34.3277, lng: 47.0778 },
            'Hamadan': { lat: 34.7983, lng: 48.5148 },
            'Urmia': { lat: 37.5527, lng: 45.0759 },
            'Khorramabad': { lat: 33.4647, lng: 48.3486 },
            'Ahvaz': { lat: 31.3183, lng: 48.6706 },
            'Chabahar': { lat: 25.2919, lng: 60.6430 },
            'Zanjan': { lat: 36.6736, lng: 48.4787 },
            'Qazvin': { lat: 36.2797, lng: 50.0049 },
            'Khorramshahr': { lat: 30.4256, lng: 48.1891 },
            'Dezful': { lat: 32.3814, lng: 48.4024 },
            'Birjand': { lat: 32.8649, lng: 59.2262 },
            'Semnan': { lat: 35.5729, lng: 53.3971 },
            'Bandar-e Mahshahr': { lat: 30.5589, lng: 49.1981 },
            'Fordow': { lat: 34.8847, lng: 51.4717 },
            'Khondab': { lat: 34.3139, lng: 49.1847 },
            'Parchin': { lat: 35.5258, lng: 51.7731 },
            'Piranshahr': { lat: 36.7013, lng: 45.1413 },
            'Kashan': { lat: 33.9850, lng: 51.4100 },
            'Khojir': { lat: 35.6891, lng: 51.7371 },
            'Javadabad': { lat: 35.5047, lng: 51.6676 },
            'Najafabad': { lat: 32.6324, lng: 51.3650 },
            'Malard': { lat: 35.6658, lng: 50.9767 },
            'Ijrud': { lat: 36.1406, lng: 48.9387 }
        };

        return coordinates[city] || { lat: 0, lng: 0 };
    }
}

// Initialize the service when the page loads
window.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be initialized
    const checkFirebase = setInterval(() => {
        if (window.FirebaseService) {
            window.dataEntryService = new DataEntryService();
            clearInterval(checkFirebase);
        }
    }, 100);
});