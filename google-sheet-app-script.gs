// Euro Trip Hotels - Google Apps Script Backend
// Version: 1.2 - Proper CORS and Method Handling

function doOptions(e) {
  // Handle CORS preflight requests
  console.log('✅ Handling OPTIONS request');
  return ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  console.log('✅ Handling GET request');
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'Euro Trip Hotels API is running',
      version: '1.2',
      timestamp: new Date().toISOString(),
      methods: ['GET', 'POST', 'OPTIONS']
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
    const data = requestData.data;

    console.log('🎯 Action:', action);
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
    version: '1.2'
  };

  if (data) {
    response.data = data;
  }

  console.log('📤 Sending response:', JSON.stringify(response));

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Add this to your Google Apps Script Code.gs

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
      version: '1.2',
      timestamp: new Date().toISOString(),
      methods: ['GET', 'POST', 'OPTIONS'],
      actions: ['getCities']
    }))
    .setMimeType(ContentService.MimeType.JSON);
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

function formatCityName(sheetName) {
  // Convert sheet names to display format
  return sheetName
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
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
