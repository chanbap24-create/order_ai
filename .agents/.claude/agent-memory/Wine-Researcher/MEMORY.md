# Wine Researcher Agent Memory

## Output Location
- Wine research JSON files: `data/wine-research/{winery-name-kebab-case}.json`
- JSON must be valid (verify with `python -m json.tool`)

## Research Workflow
1. WebSearch in parallel: general history, critic scores, Vivino ratings, vineyard details
2. WebFetch official website, Wine Cellar Insider, Chateauneuf.com for deep details
3. Playwright browser for Vivino bottle images (extract img src with `images.vivino.com`)
4. Wine-Searcher returns 403 on WebFetch - use WebSearch results only
5. CellarTracker producer page URL pattern: `cellartracker.com/producer.asp?iProducer={id}`

## Vivino Image Pattern
- Full bottle shot URL format: `https://images.vivino.com/thumbs/{hash}_pb_x600.png`
- Extract via Playwright `browser_evaluate` querying img elements containing `images.vivino`
- Wine page URL: `vivino.com/en/{winery-slug}-{wine-slug}/w/{wine_id}`
- Winery page: `vivino.com/wineries/{winery-slug}`

## JSON Schema Keys (established pattern)
- brand_name_en, brand_name_ko, brand_alias, country, region, appellation, website
- founded_year, description (Korean), history (Korean), winemaking_philosophy (Korean)
- owner (object with family members), winemaker, certifications
- vineyard_info (Korean description + structured data), annual_production
- key_wines (array with blend, aging, scores, ratings), awards (array)
- vivino_summary, cellartracker_summary, tasting_profile_vivino
- food_pairing, images, sources, research_date

## Key Score Sources
- Robert Parker / Wine Advocate, Jeb Dunnuck, Wine Enthusiast, Decanter
- Bettane+Desseauve, Guide Hachette, Concours Général Agricole Paris
- Vivino community rating (4.0 scale), CellarTracker community score (100 scale)
