# OpenStream Frontend

This frontend is built with [Vituum](https://vituum.dev/) - a fast prototyping tool that enhances Vite with multi-page support and template engines.

## Project Structure

```
src/
├── pages/           # Handlebars pages (.hbs files - entry points)
├── components/      # Handlebars components/partials, grouped in folders
│   ├── buttons/     # Button components
│   ├── containers/  # Layout containers
│   ├── navbar/      # Navigation components
│   ├── sidebar/     # Sidebar components
│   └── and so on.../     
└── assets/          # JavaScript, CSS, and other assets
    ├── pages/       # Page-specific JS/CSS
    ├── scss/        # Global SCSS files
    └── utils/       # Utility functions
public/              # Static assets (favicon, images, etc.)
```

## Features

- **Multi-page Application (MPA)** with automatic page discovery
- **Handlebars Templates** with partials system
- **Hot Module Replacement** for fast development
- **SCSS Support** with automatic compilation
- **Bootstrap Integration** for responsive design
- **Custom Client-side Localization** with Django-style syntax

## Development

Frontend automatically starts with docker compose.

```bash
# Auto format Handlebars and Javascript
npm run format:all
```

## Template System

### Pages
Pages are stored in `src/pages/` as `.hbs` files and are automatically discovered by Vituum. Each `.hbs` file becomes a route.

### Components  
Reusable Handlebars components are in `src/components/`. Use them with:
```handlebars
{{> component-name }}
{{> navbar/navbar_branch }}
{{#> containers/html-container title="Page Title"}}...{{/containers/html-container}}
```

### Localization
The project uses Django-style template syntax processed client-side:
```handlebars
<h1>{% trans "Sign in to OpenStream" %}</h1>
```
This is handled by `src/assets/utils/locales.js` for runtime translation.

### Page-specific Assets
Each page can have its own JavaScript and CSS in `src/assets/pages/[page-name]/`:
- `src/assets/pages/dashboard/main.js`
- `src/assets/pages/dashboard/style.scss`

## Migration from vite-plugin-handlebars

This project was migrated from `vite-plugin-handlebars` to Vituum for:
- Better file organization and conventions
- Enhanced Handlebars features
- Automatic multi-page setup
- Better development experience
- Cleaner configuration
