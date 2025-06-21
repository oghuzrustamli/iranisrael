const CONFIG = {
    // Map settings
    map: {
        center: [32.0, 53.0], // Centered between Israel and Iran
        zoom: 5,
        maxZoom: 18,
        minZoom: 3
    },
    
    // News API settings
    newsApi: {
        endpoint: 'https://gnews.io/api/v4/search',
        apiKey: 'c9665cc8bce2c026d78920214847c6e5', // Get free API key from https://gnews.io
        queries: [
            // Combined searches
            'israel iran conflict',
            'israel iran war',
            'israel iran attack',
            'israel iran missile',
            'israel iran drone',
            'israel iran military',
            'israel iran strike',
            
            // Israel specific searches
            'israel military operation',
            'israel missile strike',
            'israel drone attack',
            'israel air strike',
            'israel defense forces attack',
            'israel military base attack',
            'israel strategic strike',
            'israel retaliation',
            'israel bombing',
            
            // Iran specific searches
            'iran military operation',
            'iran missile strike',
            'iran drone attack',
            'iran air strike',
            'iran revolutionary guard attack',
            'iran military base attack',
            'iran strategic strike',
            'iran retaliation',
            'iran bombing',
            
            // Regional context
            'middle east conflict',
            'persian gulf tension',
            'israel military alert',
            'iran military alert',
            'israel air defense',
            'iran air defense',
            
            // Military assets
            'missile launch israel iran',
            'drone attack israel iran',
            'air strike israel iran',
            'military base israel iran',
            'nuclear facility israel iran',
            
            // Specific locations
            'tel aviv attack',
            'jerusalem attack',
            'haifa attack',
            'dimona attack',
            'tehran attack',
            'isfahan attack',
            'natanz attack',
            'fordow attack',
            'bushehr attack',
            
            // Military terminology
            'strategic facilities attacked',
            'military installations hit',
            'defense infrastructure strike',
            'military compound targeted',
            'missile defense activated',
            'air defense response',
            
            // Broader context
            'middle east war',
            'israel security',
            'iran security',
            'regional conflict escalation',
            'military response'
        ],
        lang: 'en'
    },
    
    // Update frequency (in milliseconds)
    updateInterval: 180000, // 3 minutes (reduced from 5 minutes)
    
    // Known locations for faster lookup
    knownLocations: {
        // Israel locations
        'Israel': { lat: 31.0461, lon: 34.8516 },
        'Jerusalem': { lat: 31.7683, lon: 35.2137 },
        'Tel Aviv': { lat: 32.0853, lon: 34.7818 },
        'Haifa': { lat: 32.7940, lon: 34.9896 },
        'Eilat': { lat: 29.5577, lon: 34.9519 },
        'Beer Sheva': { lat: 31.2518, lon: 34.7913 },
        'Dimona': { lat: 31.0684, lon: 35.0333 },
        'Ashkelon': { lat: 31.6689, lon: 34.5742 },
        'Ashdod': { lat: 31.7920, lon: 34.6497 },
        'Netanya': { lat: 32.3329, lon: 34.8599 },
        'Herzliya': { lat: 32.1649, lon: 34.8259 },
        'Ramat Gan': { lat: 32.0684, lon: 34.8248 },
        'Rehovot': { lat: 31.8928, lon: 34.8113 },
        'Rishon LeZion': { lat: 31.9497, lon: 34.8892 },
        'Kiryat Ekron': { lat: 31.8517, lon: 34.8219 },
        'Bnei Brak': { lat: 32.0907, lon: 34.8338 },
        'Caesarea': { lat: 32.5186, lon: 34.9019 },
        'Azor': { lat: 32.0243, lon: 34.8060 },
        'Karmiel': { lat: 32.9170, lon: 35.2950 },
        'Gush Dan': { lat: 32.0853, lon: 34.7818 },
        'West Jerusalem': { lat: 31.7857, lon: 35.2007 },
        'Tamra': { lat: 32.8530, lon: 35.1981 },
        
        // Iran locations
        'Iran': { lat: 32.4279, lon: 53.6880 },
        'Tehran': { lat: 35.6892, lon: 51.3890 },
        'Isfahan': { lat: 32.6546, lon: 51.6680 },
        'Natanz': { lat: 33.5133, lon: 51.9244 },
        'Fordow': { lat: 34.8847, lon: 51.4717 },
        'Bushehr': { lat: 28.9684, lon: 50.8385 },
        'Tabriz': { lat: 38.0962, lon: 46.2738 },
        'Shiraz': { lat: 29.5926, lon: 52.5836 },
        'Kerman': { lat: 30.2839, lon: 57.0834 },
        'Yazd': { lat: 31.8974, lon: 54.3569 },
        'Arak': { lat: 34.0954, lon: 49.7013 },
        'Qom': { lat: 34.6416, lon: 50.8746 },
        'Karaj': { lat: 35.8400, lon: 50.9391 },
        'Mashhad': { lat: 36.2605, lon: 59.6168 },
        'Bandar Abbas': { lat: 27.1832, lon: 56.2667 },
        'Kermanshah': { lat: 34.3277, lon: 47.0778 },
        'Hamadan': { lat: 34.7983, lon: 48.5148 },
        'Urmia': { lat: 37.5527, lon: 45.0759 },
        'Khorramabad': { lat: 33.4647, lon: 48.3486 },
        'Parchin': { lat: 35.5258, lon: 51.7731 },
        'Piranshahr': { lat: 36.7013, lon: 45.1413 },
        'Kashan': { lat: 33.9850, lon: 51.4100 },
        'Khojir': { lat: 35.6891, lon: 51.7371 },
        'Javadabad': { lat: 35.5047, lon: 51.6676 },
        'Najafabad': { lat: 32.6324, lon: 51.3650 },
        'Malard': { lat: 35.6658, lon: 50.9767 },
        'Ijrud': { lat: 36.1406, lon: 48.9387 },
        
        // Military and Nuclear Facilities
        'Dimona Nuclear': { lat: 31.0684, lon: 35.0333 },
        'Natanz Nuclear': { lat: 33.5133, lon: 51.9244 },
        'Fordow Nuclear': { lat: 34.8847, lon: 51.4717 },
        'Bushehr Nuclear': { lat: 28.9684, lon: 50.8385 },
        'Parchin Military': { lat: 35.5258, lon: 51.7731 },
        'Isfahan Nuclear': { lat: 32.6546, lon: 51.6680 },
        'Khojir Missile': { lat: 35.6891, lon: 51.7371 },
        
        // Regional locations
        'Damascus': { lat: 33.5138, lon: 36.2765 },
        'Beirut': { lat: 33.8938, lon: 35.5018 },
        'Gaza': { lat: 31.5017, lon: 34.4668 },
        'West Bank': { lat: 32.0000, lon: 35.2500 },
        'Golan Heights': { lat: 32.9784, lon: 35.7471 },
        'Semnan': { lat: 35.5729, lon: 53.3971 },
        'Bandar-e Mahshahr': { lat: 30.5589, lon: 49.1981 },
        'Khondab': { lat: 34.3139, lon: 49.1847 },
    },
    
    // Location keywords to help identify places in news
    locationKeywords: {
        prefixes: ['in', 'at', 'near', 'from', 'to', 'towards'],
        
        // Keywords that strongly indicate an attack
        attackIndicators: {
            verbs: ['struck', 'hit', 'attacked', 'bombed', 'targeted', 'destroyed', 'damaged', 
                   'exploded', 'impacted', 'blasted', 'shelled', 'fired upon', 'raided'],
            nouns: ['explosion', 'strike', 'attack', 'bombing', 'missile', 'drone', 'impact',
                   'destruction', 'damage', 'blast', 'detonation', 'raid'],
            phrases: ['under attack', 'came under fire', 'was targeted', 'multiple explosions in',
                     'direct hit on', 'successful strike against', 'military operation in',
                     'confirmed damage in', 'casualties reported in']
        },
        
        // Keywords that suggest location mention only
        contextualMentions: {
            verbs: ['said', 'announced', 'claimed', 'reported', 'stated', 'mentioned',
                   'located', 'based', 'situated'],
            prepositions: ['from', 'of', 'in', 'at', 'by'],
            phrases: ['officials in', 'sources from', 'based in', 'located in',
                     'speaking from', 'according to sources in']
        },
        
        suffixes: ['region', 'area', 'city', 'province', 'base', 'facility', 'airport', 
                  'site', 'complex', 'installation', 'center', 'command'],
        
        militaryTerms: ['base', 'facility', 'installation', 'compound', 'site', 'center', 
                       'headquarters', 'command', 'bunker', 'silo', 'depot', 'arsenal',
                       'airbase', 'missile site', 'nuclear facility', 'military complex', 
                       'defense installation', 'strategic site', 'operations center'],
        
        ignoreWords: ['the', 'and', 'or', 'but', 'if', 'on', 'for', 'of', 'with', 'by', 
                     'a', 'an', 'said', 'says', 'reported', 'according', 'claims', 
                     'announced', 'stated', 'confirmed', 'today', 'yesterday', 'tomorrow', 
                     'week', 'month', 'year', 'time', 'now', 'later', 'official', 
                     'officials', 'sources', 'report', 'reports', 'reported', 'reporting']
    },
    
    // Map marker settings
    markers: {
        attack: {
            radius: 12,
            color: '#ff4444',
            weight: 2,
            fillColor: '#ff0000',
            fillOpacity: 0.6,
            pulsing: true,
            // Popup style
            popupOffset: [0, -10],
            popupClassName: 'incident-popup'
        }
    }
}; 