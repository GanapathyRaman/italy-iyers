# Wiki System for Euro Trip 2026

This directory contains the wiki information system that provides detailed educational content about attractions in the travel guide.

## 📁 Structure

```
wiki/
├── README.md                          # This file
└── attractions/                       # Individual attraction information files
    ├── st-peters-basilica.json       # St. Peter's Basilica info
    ├── colosseum.json                # Colosseum info
    ├── roman-pantheon.json           # Roman Pantheon info
    ├── leaning-tower-pisa.json       # Leaning Tower of Pisa info
    ├── jungfraujoch.json             # Jungfraujoch "Top of Europe" info
    ├── eiffel-tower.json             # Eiffel Tower info
    ├── florence-cathedral.json       # Florence Cathedral (Duomo) info
    ├── st-marks-bell-tower.json      # St. Mark's Bell Tower info
    └── ... (add more attractions as needed)
```

## 📝 JSON File Format

Each attraction JSON file should follow this structure:

```json
{
  "name": "Attraction Name",
  "overview": "Brief overview of the attraction's significance and what it is",
  "history": "Historical background and context about the attraction",
  "highlights": [
    "Key highlight 1",
    "Key highlight 2", 
    "Key highlight 3",
    "Key highlight 4"
  ],
  "tips": "Practical visitor tips including timing, tickets, photography, access info",
  "facts": {
    "Built": "Construction period",
    "Height/Size": "Physical dimensions",
    "Annual Visitors": "Visitor statistics if known",
    "Other Key Fact": "Any other important quick facts"
  }
}
```

## 🔗 How It Works

1. **Info Buttons**: Blue ℹ️ buttons next to attractions in the main app
2. **Dynamic Loading**: Wiki content is loaded only when needed (lazy loading)
3. **Fallback**: Missing files show "Information Coming Soon" message
4. **Caching**: Loaded content is cached to avoid repeated requests

## ➕ Adding New Attractions

To add wiki information for a new attraction:

1. Create a new JSON file in `wiki/attractions/` using the format above
2. Use a descriptive filename like `attraction-name.json` (lowercase, hyphens for spaces)
3. Add an info button to the attraction in the main HTML:

```html
<button class="info-btn" onclick="openAttractionInfo('your-attraction-key')" title="Learn more about Your Attraction">
    <i class="fa-solid fa-info-circle"></i>
</button>
```

4. The `attraction-key` should match your JSON filename (without `.json`)

## 🎯 Content Guidelines

### Overview
- 1-2 sentences introducing the attraction
- Mention its significance and what makes it special

### History  
- Key historical facts and construction details
- Important events or changes over time
- Why it was built and by whom

### Highlights
- 3-5 key things visitors should see or know
- Most important features or areas
- What makes this attraction unique

### Tips
- Practical advice for visitors
- Best times to visit
- Ticket information and access tips
- Photography guidelines
- Duration recommendations

### Facts
- Quick reference information
- Construction dates, dimensions, statistics
- Keep it concise and factual

## 🌍 Coverage

Current attractions with wiki information:
- **Rome**: St. Peter's Basilica, Colosseum, Roman Pantheon
- **Pisa**: Leaning Tower of Pisa  
- **Florence**: Florence Cathedral (Duomo)
- **Venice**: St. Mark's Bell Tower
- **Switzerland**: Jungfraujoch "Top of Europe"
- **Paris**: Eiffel Tower

## 📧 Contributing

To contribute new attraction information or improve existing content:
1. Follow the JSON format above
2. Ensure information is accurate and well-researched
3. Keep tone informative but engaging
4. Include practical visitor information

This modular system allows the travel guide to grow into a comprehensive educational resource while keeping the main code clean and maintainable.