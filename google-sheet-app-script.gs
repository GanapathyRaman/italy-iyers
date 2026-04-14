// Euro Trip Hotels - Google Apps Script Backend
// Version: 2.0 - New Places API + Auto-Fetch Integration

function doOptions(e) {
  // Handle CORS preflight requests
  console.log('✅ Handling OPTIONS request');
  return ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  console.log('✅ Handling GET request');

  // Check if they want to list cities
  const action = e.parameter.action;

  if (action === 'getCities') {
    return getCitiesFromSheets();
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'Euro Trip Hotels API is running',
      version: '2.0',
      timestamp: new Date().toISOString(),
      methods: ['GET', 'POST', 'OPTIONS'],
      actions: ['getCities', 'addHotel', 'addLandmark', 'searchRestaurants', 'autoFetchRestaurant']
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  console.log('✅ Handling POST request');
  console.log('📥 POST data:', e.postData.contents);
  console.log('📥 POST type:', e.postData.type);
  console.log('📥 Parameters:', JSON.stringify(e.parameters || {}));

  try {
    let requestData;

    // Handle both JSON and form-encoded data
    if (e.postData.type === 'application/json') {
      // Direct JSON request
      console.log('🔵 Parsing JSON data');
      requestData = JSON.parse(e.postData.contents);
    } else if (e.postData.type === 'text/plain') {
      // Text/plain JSON (CORS-friendly for auto-fetch)
      console.log('🔵 Parsing text/plain JSON data');
      requestData = JSON.parse(e.postData.contents);
    } else {
      // Form-encoded request or fallback
      console.log('🔶 Parsing form/URL-encoded data');

      // Try to get data from form parameters first
      if (e.parameters && e.parameters.data) {
        const dataParam = Array.isArray(e.parameters.data) ? e.parameters.data[0] : e.parameters.data;
        console.log('📝 Form data parameter:', dataParam);
        requestData = JSON.parse(dataParam);
      } else {
        // Try to parse URL-decoded content
        const decodedContent = decodeURIComponent(e.postData.contents);
        console.log('🔄 Decoded content:', decodedContent);

        if (decodedContent.startsWith('data=')) {
          const jsonString = decodedContent.substring(5); // Remove "data="
          requestData = JSON.parse(jsonString);
        } else {
          requestData = JSON.parse(decodedContent);
        }
      }
    }

    const action = requestData.action;
    console.log('🎯 Action:', action);

    // Handle Google Maps restaurant search requests
    if (action === 'searchRestaurants') {
      return handleSearchRequest(requestData);
    }

    // Handle Google Maps auto-fetch requests (legacy support)
    if (action === 'autoFetchRestaurant') {
      return handleAutoFetchRequest(requestData);
    }

    // Handle regular submissions
    const data = requestData.data;
    console.log('📊 Data:', JSON.stringify(data));

    if (action === 'addHotel') {
      return addHotelToSheet(data);
    } else if (action === 'addLandmark') {
      return addLandmarkToSheet(data);
    } else {
      console.log('❌ Unknown action:', action);
      return createResponse(false, 'Unknown action: ' + action);
    }

  } catch (error) {
    console.error('❌ Error in doPost:', error);
    console.error('❌ Raw POST data:', e.postData.contents);
    return createResponse(false, 'Server error: ' + error.message + '. Raw data: ' + e.postData.contents.substring(0, 100));
  }
}

function addHotelToSheet(hotelData) {
  try {
    console.log('🏨 Adding hotel to sheet:', JSON.stringify(hotelData));

    const sheetId = '1jHP_o58c99aOtHeeWt5wkDowTkBEj-WqkqNAYWNuF1s';
    const spreadsheet = SpreadsheetApp.openById(sheetId);

    // Get or create sheet for the city
    const cityName = hotelData.city.toLowerCase();
    let sheet = spreadsheet.getSheetByName(cityName);

    if (!sheet) {
      console.log('📋 Creating new sheet for:', cityName);
      sheet = spreadsheet.insertSheet(cityName);
      // Add headers
      sheet.getRange(1, 1, 1, 9).setValues([[
        'Hotel Name', 'Location', 'Main Landmark', 'Distance',
        'Cuisine Tags', 'Price Range', 'Google Maps', 'Notes', 'Timestamp'
      ]]);
    }

    // Check for duplicates
    const existingData = sheet.getDataRange().getValues();
    const hotelExists = existingData.some((row, index) => {
      if (index === 0 || !row[0]) return false; // Skip header row and empty rows
      return row[0].toLowerCase().trim() === hotelData.hotelName.toLowerCase().trim();
    });

    if (hotelExists) {
      console.log('❌ Hotel already exists:', hotelData.hotelName);
      return createResponse(false, 'Hotel "' + hotelData.hotelName + '" already exists in ' + hotelData.city);
    }

    // Get landmark name from options
    const landmarkName = getLandmarkName(hotelData.city, hotelData.mainLandmark);

    // Add new row
    const newRow = [
      hotelData.hotelName,
      hotelData.location,
      landmarkName,
      hotelData.distance,
      hotelData.cuisineTags,
      hotelData.priceRange,
      hotelData.googleMaps,
      hotelData.notes || '',
      new Date().toISOString()
    ];

    sheet.appendRow(newRow);
    console.log('✅ Hotel added successfully:', newRow);

    return createResponse(true, 'Hotel "' + hotelData.hotelName + '" added successfully to ' + hotelData.city + '!');

  } catch (error) {
    console.error('❌ Error adding hotel:', error);
    return createResponse(false, 'Error adding hotel: ' + error.message);
  }
}

function addLandmarkToSheet(landmarkData) {
  try {
    console.log('📍 Adding landmark to sheet:', JSON.stringify(landmarkData));

    const sheetId = '1jHP_o58c99aOtHeeWt5wkDowTkBEj-WqkqNAYWNuF1s';
    const spreadsheet = SpreadsheetApp.openById(sheetId);

    // Get or create landmarks sheet
    let landmarksSheet = spreadsheet.getSheetByName('landmarks');

    if (!landmarksSheet) {
      console.log('📋 Creating landmarks sheet');
      landmarksSheet = spreadsheet.insertSheet('landmarks');
      // Add headers
      landmarksSheet.getRange(1, 1, 1, 4).setValues([[
        'City', 'Landmark Key', 'Landmark Name', 'Timestamp'
      ]]);
    }

    // Check for duplicates
    const existingData = landmarksSheet.getDataRange().getValues();
    const landmarkExists = existingData.some((row, index) => {
      if (index === 0 || !row[0] || !row[1]) return false; // Skip header row and empty rows
      return row[0].toLowerCase().trim() === landmarkData.city.toLowerCase().trim() &&
             row[1].toLowerCase().trim() === landmarkData.key.toLowerCase().trim();
    });

    if (landmarkExists) {
      console.log('❌ Landmark already exists:', landmarkData.name);
      return createResponse(false, 'Landmark "' + landmarkData.name + '" already exists in ' + landmarkData.city);
    }

    // Add new landmark
    const newRow = [
      landmarkData.city,
      landmarkData.key,
      landmarkData.name,
      new Date().toISOString()
    ];

    landmarksSheet.appendRow(newRow);
    console.log('✅ Landmark added successfully:', newRow);

    return createResponse(true, 'Landmark "' + landmarkData.name + '" added successfully to ' + landmarkData.city + '!');

  } catch (error) {
    console.error('❌ Error adding landmark:', error);
    return createResponse(false, 'Error adding landmark: ' + error.message);
  }
}

function getCitiesFromSheets() {
  try {
    console.log('🏙️ Fetching all cities from sheets...');

    const sheetId = '1jHP_o58c99aOtHeeWt5wkDowTkBEj-WqkqNAYWNuF1s';
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheets = spreadsheet.getSheets();

    const cities = [];
    const excludeSheets = ['landmarks']; // Don't include system sheets

    sheets.forEach(sheet => {
      const sheetName = sheet.getName();

      // Skip system sheets and empty names
      if (excludeSheets.includes(sheetName.toLowerCase()) || !sheetName.trim()) {
        return;
      }

      // Check if sheet has hotel data (has more than just headers)
      const dataRange = sheet.getDataRange();
      const rowCount = dataRange.getNumRows();

      if (rowCount > 0) { // Has at least header row
        cities.push({
          key: sheetName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: sheetName,
          displayName: formatCityName(sheetName),
          hotelCount: Math.max(0, rowCount - 1) // Exclude header row
        });
        console.log(`✅ Found city: ${sheetName} (${rowCount - 1} hotels)`);
      } else {
        console.log(`⚠️ Skipping empty city: ${sheetName}`);
      }
    });

    // Sort cities alphabetically
    cities.sort((a, b) => a.displayName.localeCompare(b.displayName));

    console.log(`🌍 Total cities found: ${cities.length}`);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        cities: cities,
        totalCities: cities.length,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('❌ Error fetching cities:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: 'Could not fetch cities: ' + error.message,
        cities: []
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getLandmarkName(city, landmarkKey) {
  const landmarkMap = {
    rome: {
      'colosseum': 'Colosseum',
      'vatican': 'Vatican City',
      'trevi-fountain': 'Trevi Fountain',
      'pantheon': 'Pantheon',
      'spanish-steps': 'Spanish Steps'
    },
    florence: {
      'duomo': 'Florence Cathedral (Duomo)',
      'ponte-vecchio': 'Ponte Vecchio',
      'uffizi': 'Uffizi Gallery',
      'palazzo-pitti': 'Palazzo Pitti'
    },
    venice: {
      'st-marks': "St. Mark's Square",
      'rialto-bridge': 'Rialto Bridge',
      'grand-canal': 'Grand Canal',
      'doges-palace': "Doge's Palace"
    },
    lucerne: {
      'chapel-bridge': 'Chapel Bridge',
      'lake-lucerne': 'Lake Lucerne',
      'mt-pilatus': 'Mt. Pilatus',
      'old-town': 'Old Town'
    },
    paris: {
      'eiffel-tower': 'Eiffel Tower',
      'louvre': 'Louvre Museum',
      'notre-dame': 'Notre Dame',
      'arc-de-triomphe': 'Arc de Triomphe',
      'champs-elysees': 'Champs-Élysées'
    }
  };

  return landmarkMap[city]?.[landmarkKey] || landmarkKey;
}

function createResponse(success, message, data = null) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString(),
    version: '2.0'
  };

  if (data) {
    response.data = data;
  }

  console.log('📤 Sending response:', JSON.stringify(response));

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatCityName(sheetName) {
  // Convert sheet names to display format
  return sheetName
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ═══════════════════════════════════════
// GOOGLE MAPS AUTO-FETCH FUNCTIONALITY
// ═══════════════════════════════════════

/**
 * Handle Google Maps auto-fetch request
 */
function handleAutoFetchRequest(requestData) {
  try {
    const mapsUrl = requestData.mapsUrl;

    if (!mapsUrl) {
      throw new Error('Maps URL is required');
    }

    console.log('🗺️ Processing auto-fetch request for URL:', mapsUrl);

    // Extract ALL possible place IDs from URL
    const placeIds = extractAllPlaceIds(mapsUrl);

    if (placeIds.length === 0) {
      throw new Error('Could not extract place ID from URL. Please make sure you copied the full Google Maps URL.');
    }

    console.log('📍 Extracted place IDs:', placeIds);

    // Try each place ID until one works
    let restaurantData = null;
    let lastError = null;

    for (let i = 0; i < placeIds.length; i++) {
      const placeId = placeIds[i];
      console.log(`🔄 Trying place ID ${i + 1}/${placeIds.length}:`, placeId.id, `(${placeId.type})`);

      try {
        restaurantData = fetchRestaurantDetails(placeId.id);
        console.log('✅ Success with place ID:', placeId.id, `(${placeId.type})`);
        break;
      } catch (error) {
        console.log('❌ Failed with place ID:', placeId.id, `(${placeId.type})`, error.message);
        lastError = error;
      }
    }

    if (!restaurantData) {
      console.log('🔄 All place IDs failed, trying coordinate-based search...');

      // Extract coordinates as final fallback
      const coordinates = extractCoordinates(mapsUrl);
      if (coordinates) {
        console.log('📍 Found coordinates:', coordinates);
        restaurantData = searchPlaceByCoordinates(coordinates.lat, coordinates.lng, mapsUrl);
      }

      if (!restaurantData) {
        throw new Error(`All place ID formats failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }
    }

    // Add the original maps URL
    restaurantData.mapsUrl = mapsUrl;

    return createResponse(true, 'Restaurant details fetched successfully', restaurantData);

  } catch (error) {
    console.error('❌ Auto-fetch error:', error);
    return createResponse(false, error.toString());
  }
}

/**
 * Handle restaurant search request
 */
function handleSearchRequest(requestData) {
  try {
    const query = requestData.query;

    if (!query) {
      throw new Error('Search query is required');
    }

    console.log('🔍 Processing search request for query:', query);

    // Search for restaurants using Places API
    const searchResults = searchRestaurantsByQuery(query);

    return createResponse(true, 'Search completed successfully', searchResults);

  } catch (error) {
    console.error('❌ Search error:', error);
    return createResponse(false, error.toString());
  }
}

/**
 * Fetch restaurant details from Google Maps Places API (New)
 */
function fetchRestaurantDetails(placeId) {
  const API_KEY = 'AIzaSyDgzsjAE2TUm6XpUfn-YbyB5uW72HNixq0';

  // 1. TRY THE NEW PLACES API (v1)
  try {
    // Format place ID properly for New API
    let formattedPlaceId = placeId;
    if (placeId.length < 15 && !placeId.startsWith('places/')) {
      // Knowledge Graph IDs need 'places/' prefix for New API
      formattedPlaceId = `places/${placeId}`;
    }

    const url = `https://places.googleapis.com/v1/${formattedPlaceId}`;
    console.log('🔄 Trying New API with formatted ID:', formattedPlaceId);

    const response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': API_KEY,
        // FieldMask is MANDATORY for the New API
        'X-Goog-FieldMask': 'displayName,formattedAddress,priceLevel,rating,types,nationalPhoneNumber,websiteUri,location'
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const place = JSON.parse(response.getContentText());
      return {
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        priceLevel: place.priceLevel || null,
        rating: place.rating || null,
        cuisineTypes: extractCuisineTypes(place.types || []),
        phone: place.nationalPhoneNumber || '',
        website: place.websiteUri || '',
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null
      };
    }
    console.warn('New API returned status:', response.getResponseCode(), response.getContentText());
  } catch (e) {
    console.error('New API error:', e);
  }

  // 2. FALLBACK TO LEGACY API (Requires "Places API" enabled in Cloud Console)
  console.log('🔄 Falling back to Legacy API...');

  let legacyUrl;

  // Handle hex format place IDs (0x...:0x...)
  if (placeId.includes('0x') && placeId.includes(':')) {
    const hexParts = placeId.split(':');
    if (hexParts.length === 2) {
      // Convert the second hex part to decimal CID
      const hexCid = hexParts[1];
      const decimalCid = parseInt(hexCid, 16);
      console.log('🔄 Converting hex CID to decimal:', hexCid, '→', decimalCid);
      legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?cid=${decimalCid}&fields=name,formatted_address,price_level,rating,types,formatted_phone_number,website,geometry&key=${API_KEY}`;
    } else {
      throw new Error('Invalid hex format place ID');
    }
  } else if (placeId.length < 15 && /^[a-zA-Z0-9_-]+$/.test(placeId)) {
    // Knowledge Graph IDs (short alphanumeric) - skip legacy API as they don't work as CIDs
    throw new Error('Knowledge Graph ID not supported by legacy API');
  } else if (placeId.startsWith('ChIJ')) {
    // Standard place_id format
    legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,price_level,rating,types,formatted_phone_number,website,geometry&key=${API_KEY}`;
  } else {
    // Try as CID for other formats
    legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?cid=${placeId}&fields=name,formatted_address,price_level,rating,types,formatted_phone_number,website,geometry&key=${API_KEY}`;
  }

  console.log('🌍 Calling Legacy URL:', legacyUrl);
  const legacyResponse = UrlFetchApp.fetch(legacyUrl, { muteHttpExceptions: true });
  const legacyData = JSON.parse(legacyResponse.getContentText());

  console.log('📍 Legacy API response:', legacyData);

  if (legacyData.status === 'OK') {
    const res = legacyData.result;
    return {
      name: res.name || '',
      address: res.formatted_address || '',
      priceLevel: res.price_level || null,
      rating: res.rating || null,
      cuisineTypes: extractCuisineTypes(res.types || []),
      phone: res.formatted_phone_number || '',
      website: res.website || '',
      lat: res.geometry?.location?.lat || null,
      lng: res.geometry?.location?.lng || null
    };
  } else {
    throw new Error(`Both APIs failed. Legacy status: ${legacyData.status}`);
  }
}

/**
 * Extract cuisine/restaurant types from Google Places types array
 */
function extractCuisineTypes(types) {
  console.log('🍽️ Extracting cuisine types from:', types);

  const cuisineMapping = {
    // Specific cuisine types
    'italian_restaurant': 'Italian',
    'chinese_restaurant': 'Chinese',
    'indian_restaurant': 'Indian',
    'japanese_restaurant': 'Japanese',
    'mexican_restaurant': 'Mexican',
    'american_restaurant': 'American',
    'french_restaurant': 'French',
    'thai_restaurant': 'Thai',
    'greek_restaurant': 'Greek',
    'mediterranean_restaurant': 'Mediterranean',
    'seafood_restaurant': 'Seafood',
    'vegetarian_restaurant': 'Vegetarian',
    'vegan_restaurant': 'Vegan',
    'fast_food_restaurant': 'Fast Food',
    'fine_dining_restaurant': 'Fine Dining',
    'buffet_restaurant': 'Buffet',
    'brunch_restaurant': 'Brunch',
    'breakfast_restaurant': 'Breakfast',
    'korean_restaurant': 'Korean',
    'vietnamese_restaurant': 'Vietnamese',
    'turkish_restaurant': 'Turkish',
    'lebanese_restaurant': 'Lebanese',
    'spanish_restaurant': 'Spanish',
    'german_restaurant': 'German',
    'ethiopian_restaurant': 'Ethiopian',
    'brazilian_restaurant': 'Brazilian',
    'moroccan_restaurant': 'Moroccan',
    'russian_restaurant': 'Russian',
    'polish_restaurant': 'Polish',
    'portuguese_restaurant': 'Portuguese',
    'peruvian_restaurant': 'Peruvian',
    'indonesian_restaurant': 'Indonesian',
    'filipino_restaurant': 'Filipino',

    // Food service types
    'bakery': 'Bakery',
    'cafe': 'Cafe',
    'coffee_shop': 'Coffee Shop',
    'tea_house': 'Tea House',
    'ice_cream_shop': 'Ice Cream',
    'pizza_place': 'Pizza',
    'sandwich_shop': 'Sandwich Shop',
    'juice_bar': 'Juice Bar',
    'food_truck': 'Food Truck',

    // Service types
    'meal_takeaway': 'Takeaway',
    'meal_delivery': 'Delivery',
    'bar': 'Bar',
    'night_club': 'Nightclub',

    // Generic fallbacks (lower priority)
    'restaurant': 'Restaurant',
    'food': 'Food'
  };

  const cuisines = [];
  const specificCuisines = [];
  const genericTypes = [];

  // Separate specific cuisines from generic types
  types.forEach(type => {
    if (cuisineMapping[type]) {
      if (['restaurant', 'food'].includes(type)) {
        genericTypes.push(cuisineMapping[type]);
      } else {
        specificCuisines.push(cuisineMapping[type]);
      }
    }
  });

  // Only return specific cuisines, not generic ones
  console.log('🔍 Specific cuisines found:', specificCuisines);
  console.log('🔍 Generic types found:', genericTypes);

  if (specificCuisines.length > 0) {
    console.log('✅ Using specific cuisines:', specificCuisines);
    return specificCuisines.slice(0, 3);
  }

  // No specific cuisines found - return empty array for manual entry
  console.log('❌ No specific cuisines found, returning empty for manual entry');
  return [];
}

/**
 * Extract ALL possible Place IDs from Google Maps URL for fallback attempts
 */
function extractAllPlaceIds(mapsUrl) {
  const placeIds = [];

  try {
    mapsUrl = mapsUrl.trim();
    console.log('🔍 Original URL:', mapsUrl);

    // 1. Expand shortened URLs
    if (mapsUrl.includes('goo.gl') || mapsUrl.includes('googleusercontent.com')) {
      console.log('🔗 Detected shortened URL, expanding...');
      try {
        const response = UrlFetchApp.fetch(mapsUrl, {
          followRedirects: false,
          muteHttpExceptions: true
        });
        let redirectUrl = response.getHeaders()['Location'] || response.getHeaders()['location'];
        if (redirectUrl) {
          console.log('🎯 Expanded URL:', redirectUrl);
          mapsUrl = redirectUrl;
        }
      } catch (err) {
        console.warn('⚠️ Expansion failed, proceeding with original URL');
      }
    }

    // PRIORITY 1: Standard ChIJ Place ID (Most reliable)
    let match = mapsUrl.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
    if (match) {
      placeIds.push({ id: match[1], type: 'ChIJ Standard Place ID' });
    }

    // PRIORITY 2: Knowledge Graph ID (Often more current than hex)
    match = mapsUrl.match(/!16s(?:%2Fg%2F|\/g\/)([A-Za-z0-9_-]+)/);
    if (match) {
      placeIds.push({ id: match[1], type: 'Knowledge Graph ID' });
    }

    // PRIORITY 3: Direct place_id parameter
    match = mapsUrl.match(/place_id=([A-Za-z0-9_-]+)/);
    if (match) {
      placeIds.push({ id: match[1], type: 'Direct Place ID Parameter' });
    }

    // PRIORITY 4: Hexadecimal Pair (0x...:0x...) - Often works but may be stale
    match = mapsUrl.match(/(0x[a-fA-F0-9]+:0x[a-fA-F0-9]+)/);
    if (match) {
      placeIds.push({ id: match[1], type: 'Hexadecimal Place ID' });
    }

    // PRIORITY 5: Embedded data string (!1s prefix)
    match = mapsUrl.match(/!4m\d+!3m\d+!1s([A-Za-z0-9_:-]+)/) || mapsUrl.match(/!1s([A-Za-z0-9_:-]+)/);
    if (match && match[1].length > 10 && !placeIds.some(p => p.id === match[1])) {
      placeIds.push({ id: match[1], type: 'Embedded Data String' });
    }

    console.log(`🎯 Found ${placeIds.length} potential place IDs:`, placeIds.map(p => `${p.id} (${p.type})`));
    return placeIds;

  } catch (error) {
    console.error('Error parsing Maps URL:', error);
    return [];
  }
}

/**
 * Extract coordinates from Google Maps URL
 */
function extractCoordinates(mapsUrl) {
  try {
    // Method 1: @lat,lng format
    let match = mapsUrl.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Method 2: !3d!4d format
    match = mapsUrl.match(/!3d(-?\d+\.?\d*).*?!4d(-?\d+\.?\d*)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }

    // Method 3: lat/lng parameters
    const latMatch = mapsUrl.match(/lat=(-?\d+\.?\d*)/);
    const lngMatch = mapsUrl.match(/lng=(-?\d+\.?\d*)/);
    if (latMatch && lngMatch) {
      return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
    }

    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
}

/**
 * Search for restaurants using query string with multiple strategies
 */
function searchRestaurantsByQuery(query) {
  const API_KEY = 'AIzaSyDgzsjAE2TUm6XpUfn-YbyB5uW72HNixq0';

  try {
    console.log('🔍 Searching restaurants with query:', query);

    let allResults = [];

    // Strategy 1: Search query as-is
    console.log('🔍 Strategy 1: Searching as-is');
    const results1 = performTextSearch(query, API_KEY);
    if (results1.length > 0) {
      console.log(`✅ Strategy 1 found ${results1.length} results`);
      allResults = allResults.concat(results1);
    }

    // Strategy 2: Add "restaurant" if not enough results and query doesn't already contain it
    if (allResults.length < 3 && !query.toLowerCase().includes('restaurant')) {
      console.log('🔍 Strategy 2: Adding "restaurant"');
      const results2 = performTextSearch(query + ' restaurant', API_KEY);
      if (results2.length > 0) {
        console.log(`✅ Strategy 2 found ${results2.length} results`);
        allResults = allResults.concat(results2);
      }
    }

    // Strategy 3: Try with broader food-related terms if still not enough results
    if (allResults.length < 3) {
      console.log('🔍 Strategy 3: Adding "food"');
      const results3 = performTextSearch(query + ' food', API_KEY);
      if (results3.length > 0) {
        console.log(`✅ Strategy 3 found ${results3.length} results`);
        allResults = allResults.concat(results3);
      }
    }

    // Remove duplicates based on place_id
    const uniqueResults = [];
    const seenPlaceIds = new Set();

    allResults.forEach(place => {
      if (!seenPlaceIds.has(place.place_id)) {
        seenPlaceIds.add(place.place_id);
        uniqueResults.push(place);
      }
    });

    // Get top 5 unique results
    const topResults = uniqueResults.slice(0, 5);
    console.log(`✅ Found ${topResults.length} unique restaurants, fetching detailed info...`);

    // Enhance each result with detailed information
    const enhancedResults = topResults.map(place => {
      try {
        // Get detailed info from Place Details API
        const detailedInfo = getPlaceDetails(place.place_id, API_KEY);

        // Merge basic info with detailed info
        return {
          ...place,
          phone: detailedInfo.phone || null,
          website: detailedInfo.website || null,
          cuisineTypes: detailedInfo.cuisineTypes || place.cuisineTypes,
          googleMapsUrl: generateGoogleMapsUrl(place.place_id, place.name),
          priceLevel: detailedInfo.priceLevel || place.priceLevel,
          rating: detailedInfo.rating || place.rating
        };
      } catch (error) {
        console.error(`⚠️ Could not fetch details for ${place.name}:`, error);
        // Return original place with generated Google Maps URL
        return {
          ...place,
          googleMapsUrl: generateGoogleMapsUrl(place.place_id, place.name)
        };
      }
    });

    console.log(`✅ Enhanced ${enhancedResults.length} restaurants with detailed info`);
    return enhancedResults;

  } catch (error) {
    console.error('❌ Restaurant search error:', error);
    throw error;
  }
}

/**
 * Perform a single text search with given query
 */
function performTextSearch(searchQuery, apiKey) {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&type=restaurant&key=${apiKey}`;

    console.log('🌍 Text Search URL:', searchUrl);

    const response = UrlFetchApp.fetch(searchUrl, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());

    console.log('📍 Text Search API response status:', data.status, `(${data.results?.length || 0} results)`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Process and return results
      return data.results.map(place => {
        return {
          place_id: place.place_id,
          name: place.name,
          address: place.formatted_address,
          rating: place.rating || null,
          priceLevel: place.price_level || null,
          cuisineTypes: extractCuisineTypes(place.types || []),
          lat: place.geometry?.location?.lat || null,
          lng: place.geometry?.location?.lng || null,
          phone: null, // Basic search doesn't include phone
          website: null, // Basic search doesn't include website
          photos: place.photos ? place.photos.slice(0, 1) : []
        };
      });
    } else {
      console.log(`⚠️ No results for "${searchQuery}":`, data.status, data.error_message);
      return [];
    }

  } catch (error) {
    console.error(`❌ Search error for "${searchQuery}":`, error);
    return [];
  }
}

/**
 * Get detailed place information using Place Details API
 */
function getPlaceDetails(placeId, apiKey) {
  try {
    console.log('🔍 Fetching detailed info for place ID:', placeId);

    // Use Place Details API to get comprehensive information
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,price_level,rating,types,formatted_phone_number,website,geometry&key=${apiKey}`;

    const response = UrlFetchApp.fetch(detailsUrl, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());

    if (data.status === 'OK' && data.result) {
      const place = data.result;

      // Extract more specific cuisine types from detailed API
      const cuisineTypes = extractCuisineTypes(place.types || []);

      return {
        phone: place.formatted_phone_number || null,
        website: place.website || null,
        cuisineTypes: cuisineTypes, // Return empty array if no specific cuisines found
        priceLevel: place.price_level || null,
        rating: place.rating || null
      };
    } else {
      console.log('⚠️ Place Details API failed:', data.status, data.error_message);
      return {};
    }

  } catch (error) {
    console.error('❌ Error fetching place details:', error);
    return {};
  }
}

/**
 * Generate Google Maps URL for a place
 */
function generateGoogleMapsUrl(placeId, placeName) {
  // Generate a proper Google Maps URL using place ID
  console.log('🔗 Generating URL for:', { placeId, placeName });

  if (placeId) {
    const url = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    console.log('✅ Generated URL:', url);
    return url;
  } else if (placeName) {
    // Fallback: search URL with place name
    const url = `https://www.google.com/maps/search/${encodeURIComponent(placeName)}`;
    console.log('✅ Generated fallback URL:', url);
    return url;
  } else {
    console.log('❌ No place ID or name provided');
    return null;
  }
}

/**
 * Search for place using coordinates via Places Search API
 */
function searchPlaceByCoordinates(lat, lng, originalUrl) {
  const API_KEY = 'AIzaSyDgzsjAE2TUm6XpUfn-YbyB5uW72HNixq0';

  try {
    // Extract place name from URL for better search
    const placeName = extractPlaceName(originalUrl);
    console.log('🔍 Extracted place name:', placeName);

    // Use Places Search API to find the place
    const radius = 100; // 100 meters radius
    let searchUrl;

    if (placeName) {
      // Text search with location bias
      searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeName)}&location=${lat},${lng}&radius=${radius}&key=${API_KEY}`;
    } else {
      // Nearby search at exact coordinates
      searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${API_KEY}`;
    }

    console.log('🌍 Searching by coordinates:', searchUrl);

    const response = UrlFetchApp.fetch(searchUrl, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());

    console.log('📍 Search API response status:', data.status);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0]; // Get the first result
      const placeId = place.place_id;

      console.log('✅ Found place via coordinates:', place.name, 'Place ID:', placeId);

      // Now get detailed info using the found place ID
      return fetchRestaurantDetails(placeId);
    } else {
      throw new Error(`Places Search failed: ${data.status} - ${data.error_message || 'No results found'}`);
    }

  } catch (error) {
    console.error('❌ Coordinate search error:', error);
    throw error;
  }
}

/**
 * Extract place name from URL
 */
function extractPlaceName(mapsUrl) {
  try {
    // Extract place name from /place/Name pattern
    const match = mapsUrl.match(/\/place\/([^\/\@\?]+)/);
    if (match) {
      // Decode and clean the place name
      let placeName = decodeURIComponent(match[1]);
      placeName = placeName.replace(/\+/g, ' '); // Replace + with spaces
      return placeName;
    }
    return null;
  } catch (error) {
    console.error('Error extracting place name:', error);
    return null;
  }
}

/**
 * Extract Place ID from various Google Maps URL formats (Legacy - kept for compatibility)
 */
function extractPlaceIdFromUrl(mapsUrl) {
  const placeIds = extractAllPlaceIds(mapsUrl);
  return placeIds.length > 0 ? placeIds[0].id : null;
}

// Test functions
function testConnection() {
  return doGet();
}

function testAddHotel() {
  const testData = {
    city: 'rome',
    hotelName: 'Debug Test Hotel',
    location: 'Via Test 123',
    mainLandmark: 'colosseum',
    distance: '300m',
    cuisineTags: 'Italian, Vegetarian',
    priceRange: '€50-100',
    googleMaps: 'https://maps.google.com/test',
    notes: 'Test hotel for debugging'
  };

  console.log('🧪 Testing hotel addition...');
  return addHotelToSheet(testData);
}

function testAutoFetch() {
  // Test with real shortened URL
  const testUrl = 'https://maps.app.goo.gl/4sGQgdqN8WGBVfm76';

  const testRequest = {
    action: 'autoFetchRestaurant',
    mapsUrl: testUrl
  };

  console.log('🧪 Testing auto-fetch with shortened URL...');
  return handleAutoFetchRequest(testRequest);
}

function testRestaurantSearch() {
  // Test restaurant search functionality
  const testQuery = 'Sangeetha';

  const testRequest = {
    action: 'searchRestaurants',
    query: testQuery
  };

  console.log('🧪 Testing restaurant search with query:', testQuery);
  return handleSearchRequest(testRequest);
}

function testCuisineExtraction() {
  // Test cuisine extraction with different type arrays
  console.log('🧪 Testing cuisine extraction...');

  // Test with common Google Places API types
  const testTypes1 = ['restaurant', 'food', 'establishment'];
  const testTypes2 = ['indian_restaurant', 'restaurant', 'food'];
  const testTypes3 = ['vegetarian_restaurant', 'restaurant'];
  const testTypes4 = ['meal_takeaway', 'restaurant'];

  console.log('Test 1 - Generic types:', testTypes1);
  const result1 = extractCuisineTypes(testTypes1);
  console.log('Result 1:', result1);

  console.log('Test 2 - Indian restaurant:', testTypes2);
  const result2 = extractCuisineTypes(testTypes2);
  console.log('Result 2:', result2);

  console.log('Test 3 - Vegetarian restaurant:', testTypes3);
  const result3 = extractCuisineTypes(testTypes3);
  console.log('Result 3:', result3);

  console.log('Test 4 - Takeaway:', testTypes4);
  const result4 = extractCuisineTypes(testTypes4);
  console.log('Result 4:', result4);

  return {
    test1: { types: testTypes1, cuisines: result1 },
    test2: { types: testTypes2, cuisines: result2 },
    test3: { types: testTypes3, cuisines: result3 },
    test4: { types: testTypes4, cuisines: result4 }
  };
}

function testPlaceDetails() {
  // Test getting place details for Sangeetha
  const API_KEY = 'AIzaSyDgzsjAE2TUm6XpUfn-YbyB5uW72HNixq0';
  const placeId = 'ChIJ353GCXJu5kcRY0NOBAy4j54';

  console.log('🧪 Testing place details for Sangeetha...');
  const details = getPlaceDetails(placeId, API_KEY);
  console.log('Place details result:', details);

  return details;
}

function testUrlGeneration() {
  // Test URL generation function
  const testPlaceId = 'ChIJ353GCXJu5kcRY0NOBAy4j54';
  const testName = 'Sangeetha Restaurant Végétarien';

  console.log('🧪 Testing URL generation...');
  const url = generateGoogleMapsUrl(testPlaceId, testName);
  console.log('Generated URL:', url);

  return {
    placeId: testPlaceId,
    name: testName,
    generatedUrl: url
  };
}

function requestPermissions() {
  // Simple function to trigger permission request
  console.log('🔐 Requesting UrlFetchApp permissions...');
  try {
    const response = UrlFetchApp.fetch('https://www.google.com');
    console.log('✅ Permissions granted successfully!');
    return 'Permissions granted';
  } catch (error) {
    console.error('❌ Permission request failed:', error);
    return 'Permission request failed: ' + error.toString();
  }
}

function forceAuthorization() {
  // Force authorization by testing the actual Google Maps API endpoint
  console.log('🔐 Forcing authorization for Google Maps API...');

  try {
    // Test with actual Google Maps API endpoint (without place_id to get a simple error)
    const API_KEY = 'AIzaSyDgzsjAE2TUm6XpUfn-YbyB5uW72HNixq0';
    const testUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=TEST&key=${API_KEY}`;

    console.log('🌍 Testing Google Maps API authorization...');
    const response = UrlFetchApp.fetch(testUrl);
    const data = JSON.parse(response.getContentText());

    console.log('✅ Authorization successful! API Response:', data.status);
    return 'Google Maps API authorization granted - Status: ' + data.status;
  } catch (error) {
    console.error('❌ Authorization failed:', error);
    return 'Authorization failed: ' + error.toString();
  }
}

function testGoogleDomain() {
  // Test basic google.com access (different permission scope?)
  console.log('🔐 Testing basic google.com access...');

  try {
    const response = UrlFetchApp.fetch('https://www.google.com', {
      method: 'GET',
      muteHttpExceptions: true
    });
    console.log('✅ Google.com access successful! Status:', response.getResponseCode());
    return 'Google.com access granted';
  } catch (error) {
    console.error('❌ Google.com access failed:', error);
    return 'Google.com access failed: ' + error.toString();
  }
}