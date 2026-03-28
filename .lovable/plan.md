
# OpenRouter Activity Dashboard (Grafana style)

## Vizuální styl
- **Tmavé téma** – tmavě šedé/černé pozadí (#1a1a2e / #0f0f23), kartičky s jemným borderem
- Neonové barvy grafů (zelená, cyan, oranžová, fialová)
- Monospace font pro čísla, grid layout panelů

## Hlavní stránka – Dashboard

### Horní lišta
- Logo "OpenRouter Monitor", CSV upload tlačítko (drag & drop dialog)
- Zobrazení období dat (auto z CSV)

### KPI karty (top row)
- **Celkové náklady** ($), **Celkem requestů**, **Průměrný čas odpovědi**, **Celkem tokenů**

### Grafy a panely

1. **Náklady v čase** – line/area chart, osa X = čas, možnost filtrovat per model
2. **Tokeny per request** – stacked bar chart (prompt / completion / reasoning / cached)
3. **Rozložení nákladů per model** – donut/pie chart
4. **Rozložení per provider** – horizontální bar chart (Anthropic, OpenAI, Google atd.)
5. **Rychlost** – line chart generation_time_ms a time_to_first_token_ms v čase
6. **Tabulka requestů** – sortovatelná tabulka se všemi sloupci, search/filter

### Interakce
- CSV upload přes file picker s drag & drop
- Kliknutí na model v grafu filtruje ostatní panely
- Tabulka s řazením a vyhledáváním

## Technologie
- **Recharts** pro grafy
- **PapaParse** pro parsování CSV
- Shadcn tabulka, karty, dialogy
