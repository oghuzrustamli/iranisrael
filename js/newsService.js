class NewsService {
    constructor(mapService) {
        this.newsItems = new Map();
        this.locationCache = new Map();
        this.mapService = mapService;
        this.geminiApiKey = 'AIzaSyB-rps5DDZR0gupBxlaSqylke-M4n2GYyQ';
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.retryDelay = 10000; // Start with 10 seconds delay
        this.maxRetryDelay = 120000; // Max 2 minutes delay
        this.processedTitles = new Set(); // Track processed titles
        this.maxQueueSize = 5; // Maximum number of items to process at once
        this.cutoffDate = new Date('2024-06-20T00:00:00Z'); // Set cutoff date to June 20th, 2024
        this.processingStatus = document.createElement('div');
        this.processingStatus.className = 'processing-status';
        document.body.appendChild(this.processingStatus);
        console.log('NewsService initialized with cutoff date:', this.cutoffDate);
        
        // Load existing news from Firebase on startup
        this.loadNewsFromFirebase();
        
        // Setup refresh button handler
        const refreshButton = document.getElementById('refresh-news');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => this.handleRefresh());
        }

        // Setup clear button handler
        const clearButton = document.getElementById('clear-data');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.handleClear());
        }
    }

    updateStatus(message) {
        this.processingStatus.textContent = message;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async processQueue() {
        if (this.isProcessingQueue) {
            console.log('Already processing queue');
            return;
        }
        
        this.isProcessingQueue = true;
        console.log('Starting queue processing');

        try {
            // Only process up to maxQueueSize items at a time
            const itemsToProcess = this.requestQueue.slice(0, this.maxQueueSize);
            let processedItems = 0;

            for (const item of itemsToProcess) {
                processedItems++;
                this.updateStatus(`Xəbərlər analiz edilir: ${processedItems}/${itemsToProcess.length}`);
                
                try {
                    console.log(`Processing item ${processedItems}/${itemsToProcess.length}`);
                    
                    // Always wait before processing next item
                    if (processedItems > 1) {
                        console.log(`Waiting ${this.retryDelay}ms before next request`);
                        await this.delay(this.retryDelay);
                    }

                    const result = await this.makeGeminiRequest(item.text);
                    console.log('Request successful');
                    item.resolve(result);
                    this.requestQueue.shift();

                } catch (error) {
                    console.error('Error in queue processing:', error);
                    
                    if (error.status === 429 && item.retryCount < 2) { // Reduced max retries to 2
                        // Rate limit hit - increase delay and move to end of queue
                        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay);
                        console.log(`Rate limit hit, increasing delay to ${this.retryDelay}ms`);
                        
                        this.requestQueue.push({
                            ...item,
                            retryCount: (item.retryCount || 0) + 1
                        });
                        this.requestQueue.shift();
                        
                        this.updateStatus(`Rate limit aşıldı. ${this.retryDelay/1000} saniyə gözlənilir...`);
                        await this.delay(this.retryDelay);
                    } else {
                        // Other error or too many retries - skip this request
                        console.log('Skipping failed request');
                        item.reject(error);
                        this.requestQueue.shift();
                    }
                }
            }

            // If there are more items in the queue, schedule next batch
            if (this.requestQueue.length > 0) {
                console.log(`${this.requestQueue.length} items remaining in queue`);
                setTimeout(() => this.processQueue(), this.retryDelay);
            }
        } finally {
            this.isProcessingQueue = false;
            this.updateStatus('');
            console.log('Queue processing completed');
        }
    }

    async makeGeminiRequest(text) {
        const prompt = `
        You are a military conflict analyst specializing in the Israel-Iran conflict. Your task is to STRICTLY identify CONFIRMED attacks between Israel and Iran.

        CRITICAL RULES:
        1. ONLY report cities that were ACTUALLY ATTACKED
        2. Do NOT include cities that are just mentioned in context
        3. Do NOT include cities that are preparing for potential attacks
        4. Do NOT include cities where troops or weapons are just being deployed
        5. Do NOT include cities mentioned in diplomatic discussions
        6. ONLY include attacks that have ALREADY HAPPENED
        7. Be VERY SPECIFIC about the target type (e.g., "Military Base in northern Isfahan", "Uranium Enrichment Facility", "Air Defense System", etc.)
        8. Pay special attention to specific areas within cities (e.g., "military complex in western part", "industrial zone", "research facility")

        When analyzing the attack, verify:
        - There must be explicit confirmation of the attack happening
        - The attack must be DIRECT (Israel attacking Iran or Iran attacking Israel)
        - The location must be specifically targeted, not just mentioned
        - There must be clear indication of actual damage or impact
        - The attack must be recent (within the last few days)
        - Look for specific details about the target (military base, nuclear facility, etc.)
        - Check for mentions of specific areas or facilities within the city

        Types of valid attacks:
        - Missile strikes that reached their target
        - Drone attacks that caused damage
        - Air force bombings that were carried out
        - Confirmed damage to military/civilian infrastructure
        - Successful penetration of air defenses

        Target Categories to identify:
        - Military Facilities: bases, command centers, ammunition depots, radar stations
        - Nuclear Facilities: enrichment plants, research centers, uranium storage
        - Civilian Infrastructure: airports, government buildings, industrial zones
        - Defense Systems: air defense batteries, missile launch sites
        - Research & Development: military research facilities, technology centers

        DO NOT include:
        - Planned or potential attacks
        - Failed or fully intercepted attacks
        - Military movements or preparations
        - Diplomatic warnings or threats
        - Historical references to past conflicts
        - Proxy attacks by allied groups

        News text: "${text}"
        
        If you find a CONFIRMED attack, respond with this JSON:
        {
            "attacked_city": "ONLY include if there is explicit confirmation of an actual attack, otherwise null",
            "attacker": "Israel or Iran (only if explicitly confirmed)",
            "attack_details": {
                "target_type": "Be VERY SPECIFIC about what was hit (e.g., 'Military Base in northern Isfahan', 'Underground Nuclear Facility', etc.) or 'No Info'",
                "attack_time": "specific time of the ACTUAL attack or 'No Info'",
                "attack_status": "only 'successful' if damage confirmed, 'intercepted' if stopped, 'attempted' if unclear"
            },
            "casualties": {
                "dead": "No Info" if unknown, number if confirmed,
                "wounded": "No Info" if unknown, number if confirmed
            },
            "weapon_type": "specific weapons that HIT the target or 'No Info'",
            "is_today": true only if attack happened today, false if earlier, null if unclear,
            "confidence": "0-100 percentage of confidence that this was a CONFIRMED, SUCCESSFUL attack"
        }

        If NO CONFIRMED ATTACK is found, always return:
        {
            "attacked_city": null,
            "attacker": null,
            "attack_details": {
                "target_type": "No Info",
                "attack_time": "No Info",
                "attack_status": "No Info"
            },
            "casualties": {
                "dead": "No Info",
                "wounded": "No Info"
            },
            "weapon_type": "No Info",
            "is_today": null,
            "confidence": 0
        }`;

        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.geminiApiKey
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2000,
                }
            })
        });

        if (!response.ok) {
            const error = new Error('Gemini API request failed');
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        console.log('Gemini raw response:', data);

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const responseText = data.candidates[0].content.parts[0].text;
            console.log('Gemini response text:', responseText);

            const cleanJson = responseText
                .replace(/```json\s*/, '')
                .replace(/```\s*$/, '')
                .trim();

            console.log('Cleaned JSON:', cleanJson);
            
            try {
                const analysis = JSON.parse(cleanJson);
                console.log('Parsed analysis:', analysis);
                return analysis;
            } catch (parseError) {
                console.error('JSON parse error:', parseError);
                console.error('Failed to parse JSON:', cleanJson);
                return null;
            }
        }

        return null;
    }

    async analyzeNewsWithGemini(text) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ text, resolve, reject });
            this.processQueue().catch(console.error);
        });
    }

    async processNewsItems(articles) {
        console.log('Processing news items, count:', articles.length);
        const processedItems = new Map();
        
        // Filter out duplicates, already processed items, and items before cutoff date
        const newArticles = articles.filter(item => {
            const title = item.title.toLowerCase().trim();
            const publishDate = new Date(item.publishedAt);
            
            // Skip if already processed
            if (this.processedTitles.has(title)) {
                console.log('Skipping already processed item:', title);
                return false;
            }

            // Skip if before cutoff date
            if (publishDate <= this.cutoffDate) {
                console.log('Skipping item before cutoff date:', title, publishDate);
                return false;
            }

            this.processedTitles.add(title);
            return true;
        });

        console.log(`Processing ${newArticles.length} new articles (after ${this.cutoffDate.toLocaleDateString()}) out of ${articles.length} total`);
        
        for (const item of newArticles) {
            try {
                console.log('Processing item:', item.title, 'published:', new Date(item.publishedAt));
                const id = this.generateId(item.title);
                
                if (this.newsItems.has(id) || processedItems.has(id)) {
                    console.log('Skipping duplicate item:', item.title);
                    continue;
                }

                // Analyze with Gemini
                const analysis = await this.analyzeNewsWithGemini(item.title + ' ' + item.description);
                console.log('News analysis:', analysis);

                if (analysis && 
                    analysis.attacked_city && 
                    analysis.confidence >= 85 && 
                    analysis.attacker &&
                    analysis.attack_details.attack_status === 'successful') {
                    
                    const location = CONFIG.knownLocations[analysis.attacked_city];
                    if (location) {
                        const newsItem = {
                            id,
                            title: item.title,
                            description: item.description,
                            timestamp: new Date(item.publishedAt),
                            source: item.source.name,
                            url: item.url,
                            locations: [{
                                name: analysis.attacked_city,
                                ...location,
                                attacker: analysis.attacker,
                                targetType: analysis.attack_details.target_type || "No Info",
                                attackTime: analysis.attack_details.attack_time || "No Info",
                                attackStatus: analysis.attack_details.attack_status || "No Info",
                                casualties: {
                                    dead: analysis.casualties.dead || "No Info",
                                    wounded: analysis.casualties.wounded || "No Info"
                                },
                                weaponType: analysis.weapon_type || "No Info",
                                isToday: analysis.is_today
                            }]
                        };

                        processedItems.set(id, newsItem);
                        this.addNewsItemToFeed(id, newsItem);
                    }
                }
            } catch (error) {
                console.error('Error processing news item:', error);
            }
        }

        // Update newsItems with all successfully processed items
        processedItems.forEach((item, id) => {
            this.newsItems.set(id, item);
        });
    }

    async loadNewsFromFirebase() {
        try {
            console.log('Loading news from Firebase...');
            const newsRef = FirebaseService.ref(FirebaseService.database, 'news');
            const snapshot = await FirebaseService.get(newsRef);
            
            if (snapshot.exists()) {
                const newsData = snapshot.val();
                console.log('Loaded news data:', newsData);
                
                // Clear existing news
                this.newsItems.clear();
                document.getElementById('auto-news-feed').innerHTML = '';
                this.mapService.clearAllIncidents();
                
                // Add news items from Firebase
                Object.entries(newsData).forEach(([id, item]) => {
                    // Convert timestamp to Date object if it's not already
                    if (typeof item.timestamp === 'string' || typeof item.timestamp === 'number') {
                        item.timestamp = new Date(item.timestamp);
                    }
                    
                    // Add to news items map
                    this.newsItems.set(id, item);
                    
                    // Add to feed and map
                    this.addNewsItemToFeed(id, item);
                });
                
                console.log('Successfully loaded and displayed all news items');
            } else {
                console.log('No news data in Firebase');
            }
        } catch (error) {
            console.error('Error loading news from Firebase:', error);
        }
    }

    async saveNewsToFirebase() {
        try {
            console.log('Saving news to Firebase...');
            const newsData = {};
            this.newsItems.forEach((item, id) => {
                newsData[id] = {
                    ...item,
                    timestamp: item.timestamp.toISOString()
                };
            });
            
            const newsRef = FirebaseService.ref(FirebaseService.database, 'news');
            await FirebaseService.set(newsRef, newsData);
            console.log('News saved to Firebase successfully');
        } catch (error) {
            console.error('Error saving news to Firebase:', error);
        }
    }

    async fetchNews() {
        console.log('Starting news fetch...');
        
        // Save existing manual entries
        const manualEntries = new Map();
        this.newsItems.forEach((item, id) => {
            if (id.startsWith('manual-')) {
                manualEntries.set(id, item);
            }
        });
        
        for (const query of CONFIG.newsApi.queries) {
            try {
                // Add date filter to the query
                const fromDate = this.cutoffDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
                const url = `${CONFIG.newsApi.endpoint}?q=${encodeURIComponent(query)}&from=${fromDate}&lang=${CONFIG.newsApi.lang}&apikey=${CONFIG.newsApi.apiKey}&max=10&sortby=publishedAt`;
                console.log('Fetching from URL:', url);
                
                const response = await fetch(url);
                console.log('Response status:', response.status);
                
                const data = await response.json();
                console.log('Received data:', data);
                
                if (data.articles && data.articles.length > 0) {
                    console.log(`Processing ${data.articles.length} articles from ${fromDate}...`);
                    await this.processNewsItems(data.articles);
                } else {
                    console.warn('No articles found in response or error:', data);
                }
            } catch (error) {
                console.error('Error fetching news:', error);
                console.error('Query:', query);
            }
        }
        
        // Restore manual entries before saving to Firebase
        manualEntries.forEach((item, id) => {
            this.newsItems.set(id, item);
        });
        
        // Save to Firebase after fetching all news
        await this.saveNewsToFirebase();
    }

    async handleRefresh() {
        try {
            console.log('Manual refresh triggered');
            const refreshButton = document.getElementById('refresh-news');
            refreshButton.disabled = true;
            refreshButton.textContent = 'Yenilənir...';
            
            // Save manual entries before clearing
            const manualEntries = new Map();
            this.newsItems.forEach((item, id) => {
                if (id.startsWith('manual-')) {
                    manualEntries.set(id, item);
                }
            });
            
            // Clear existing news
            this.newsItems.clear();
            document.getElementById('auto-news-feed').innerHTML = '';
            this.mapService.clearAllIncidents();
            
            // Restore manual entries to the map only
            manualEntries.forEach((item, id) => {
                this.newsItems.set(id, item);
                const location = item.locations[0];
                this.mapService.addIncident(id + '-' + location.name, location, {
                    title: item.title,
                    description: item.description,
                    timestamp: item.timestamp.toLocaleString()
                });
            });
            
            // Fetch new news and save to Firebase
            await this.fetchNews();
            
            refreshButton.disabled = false;
            refreshButton.textContent = 'Yeniləmək';
        } catch (error) {
            console.error('Error during refresh:', error);
            const refreshButton = document.getElementById('refresh-news');
            refreshButton.disabled = false;
            refreshButton.textContent = 'Yeniləmək';
        }
    }

    generateId(text) {
        return text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
    }

    addNewsItemToFeed(id, item) {
        try {
            console.log('Adding news item to feed:', id);
            if (!item) {
                console.error('News item not found:', id);
                return;
            }

            // Determine if this is a manual entry
            const isManual = id.startsWith('manual-');
            const location = item.locations[0];
            
            // Determine attacker based on target location
            const determineAttacker = (targetCity) => {
                const iranianCities = [
                    'Tehran', 'Isfahan', 'Natanz', 'Bushehr', 'Tabriz',
                    'Shiraz', 'Kerman', 'Yazd', 'Arak', 'Qom',
                    'Karaj', 'Mashhad', 'Bandar Abbas', 'Kermanshah', 'Hamadan',
                    'Urmia', 'Khorramabad', 'Ahvaz', 'Chabahar', 'Zanjan',
                    'Qazvin', 'Khorramshahr', 'Dezful', 'Birjand', 'Semnan',
                    'Bandar-e Mahshahr', 'Fordow'
                ];
                
                return iranianCities.includes(targetCity) ? '1' : '2'; // 1 for Israel, 2 for Iran
            };

            // Set the attacker based on the target city
            location.attacker = determineAttacker(location.name);
            
            // Create the HTML content with attack details
            const attackDetails = `
                <div class="attack-details">
                    <div>Attacker: ${location.attacker}</div>
                    <div>Target: ${location.targetType}</div>
                    <div>Attack Status: ${location.attackStatus}</div>
                </div>`;

            const casualties = location.casualties ? 
                `<div class="casualties">
                    <div>Casualties: ${location.casualties.dead}</div>
                    <div>Wounded: ${location.casualties.wounded}</div>
                </div>` : '';
            
            const weaponInfo = location.weaponType ? 
                `<div class="weapon-info">Weapon Type: ${location.weaponType}</div>` : '';

            // Add marker for the location
            this.mapService.addIncident(id + '-' + location.name, location, {
                title: item.title,
                description: `${attackDetails}\n${casualties}\n${weaponInfo}`,
                timestamp: item.timestamp.toLocaleString()
            });

            // Only add to news feed if it's an automatic entry
            if (!isManual) {
                const newsDiv = document.createElement('div');
                newsDiv.className = 'news-item';
                newsDiv.dataset.id = id;
                
                const content = `
                    <h3><a href="${item.url}" target="_blank">${item.title}</a></h3>
                    <p>${item.description}</p>
                    ${attackDetails}
                    ${casualties}
                    ${weaponInfo}
                    <div class="news-meta">
                        <span class="source">${item.source}</span>
                        <span class="timestamp">${item.timestamp.toLocaleString()}</span>
                        <span class="auto-tag">Avtomatik</span>
                    </div>
                `;
                
                newsDiv.innerHTML = content;
                console.log('Created news div:', newsDiv);

                const newsFeed = document.getElementById('auto-news-feed');
                if (!newsFeed) {
                    console.error('News feed element not found!');
                    return;
                }

                newsFeed.insertBefore(newsDiv, newsFeed.firstChild);
                console.log('Added news div to automatic feed');
            }
        } catch (error) {
            console.error('Error adding news item to feed:', error);
            console.error('Item:', item);
        }
    }

    clearOldNews(maxAge) {
        console.log('Clearing old news...');
        const now = Date.now();
        this.newsItems.forEach((item, id) => {
            if (now - item.timestamp.getTime() > maxAge) {
                console.log('Removing old news item:', id);
                this.newsItems.delete(id);
                
                // Remove from DOM
                const newsItems = document.querySelectorAll('.news-item');
                newsItems.forEach(newsItem => {
                    if (newsItem.dataset.id === id) {
                        newsItem.remove();
                        console.log('Removed news item from DOM:', id);
                    }
                });
            }
        });
    }

    async removeNewsItem(id) {
        console.log('Removing news item:', id);
        
        try {
            // Remove from newsItems map
            this.newsItems.delete(id);
            
            // Remove from DOM
            const newsItem = document.querySelector(`.news-item[data-id="${id}"]`);
            if (newsItem) {
                newsItem.remove();
                console.log('News item removed from feed:', id);
            }

            // Handle Firebase removal
            const idParts = id.split('-');
            let firebasePath = `news/${id}`;
            
            // For manual entries, try both paths
            if (idParts[0] === 'manual') {
                // Try the full path first
                let newsRef = FirebaseService.ref(
                    FirebaseService.database,
                    firebasePath
                );
                
                let snapshot = await FirebaseService.get(newsRef);
                
                if (!snapshot.exists()) {
                    // If not found, try the alternative path
                    firebasePath = 'news/manual';
                    newsRef = FirebaseService.ref(
                        FirebaseService.database,
                        firebasePath
                    );
                    snapshot = await FirebaseService.get(newsRef);
                }
                
                if (snapshot.exists()) {
                    await FirebaseService.remove(newsRef);
                    console.log('Successfully removed from Firebase:', firebasePath);
                } else {
                    console.log('No Firebase entry found at either path for manual entry');
                }
            } else {
                // For automatic entries, use the standard path
                const newsRef = FirebaseService.ref(
                    FirebaseService.database,
                    firebasePath
                );
                
                const snapshot = await FirebaseService.get(newsRef);
                if (snapshot.exists()) {
                    await FirebaseService.remove(newsRef);
                    console.log('Successfully removed from Firebase:', firebasePath);
                } else {
                    console.log('No Firebase entry found for automatic entry:', firebasePath);
                }
            }

            // Remove from processedTitles to allow re-adding if needed
            const newsData = this.newsItems.get(id);
            if (newsData && newsData.title) {
                this.processedTitles.delete(newsData.title.toLowerCase().trim());
            }
            
        } catch (error) {
            console.error('Error removing news item:', error);
            console.error('Error details:', error.message);
        }
    }

    async handleClear() {
        try {
            if (!confirm('Avtomatik tapılan məlumatları silmək istədiyinizə əminsiniz?')) {
                return;
            }

            console.log('Clearing automatic news data...');
            const clearButton = document.getElementById('clear-data');
            clearButton.disabled = true;
            clearButton.textContent = 'Təmizlənir...';

            // Save manual entries before clearing
            const manualEntries = new Map();
            this.newsItems.forEach((item, id) => {
                if (id.startsWith('manual-')) {
                    manualEntries.set(id, item);
                }
            });

            // Clear all data
            this.newsItems.clear();
            document.getElementById('auto-news-feed').innerHTML = '';
            this.mapService.clearAllIncidents();

            // Restore manual entries
            manualEntries.forEach((item, id) => {
                this.newsItems.set(id, item);
                const location = item.locations[0];
                this.mapService.addIncident(id + '-' + location.name, location, {
                    title: item.title,
                    description: item.description,
                    timestamp: item.timestamp.toLocaleString()
                });
            });

            // Update Firebase to keep only manual entries
            const newsRef = FirebaseService.ref(FirebaseService.database, 'news');
            const newsData = {};
            manualEntries.forEach((item, id) => {
                newsData[id] = {
                    ...item,
                    timestamp: item.timestamp.toISOString()
                };
            });
            await FirebaseService.set(newsRef, newsData);

            console.log('Automatic news cleared successfully, manual entries preserved');
            clearButton.textContent = 'Təmizlə';
            clearButton.disabled = false;

        } catch (error) {
            console.error('Error clearing data:', error);
            const clearButton = document.getElementById('clear-data');
            clearButton.textContent = 'Təmizlə';
            clearButton.disabled = false;
        }
    }
} 