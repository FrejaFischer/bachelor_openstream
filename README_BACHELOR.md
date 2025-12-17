# Bachelor project 2025/2026

This is the repository for my Bachelor project for the Web Development PBA. In this README file the new implementations added to OpenStream by this project will be introduced as an overview.

My project is focused on:

**Adding real-time updates between users editing slideshows, so that OpenStream becomes a better collaboration tool.**

To achieve this there has been added new development in both the frontend and backend application for OpenStream, as well as an addition to the Docker compose configuration.

## Backend changes
To implement handling of real-time updates of a slideshow, there has been added Django Channels to the Django backend. Channels needs to run on an ASGI server, and therefor the runtime server for development has been changed to use Daphne ASGI server instead of the existing WSGI.

The `asgi.py` file now receives the incoming request and handles both HTTP and WS requests.
HTTP request gets handles as before in the `views.py`.
WS request gets handled by the corresponding consumer, which can be found in `consumers.py`.

- New `routing.py` contains WS endpoints / URL patterns. The slideshow WS endpoint is added here.
- New `permissions.py` file has been created to contain permissions helper functions, which is both used in `views.py` and `consumers.py` (so both HTTP and WS)
- The `settings.py` has been changed to use the new ASGI application and include Daphne in installed apps.
- HER ER JEG NÅED TIL - TO DO


## Project changes overview 
List of every file, that has been changed by this project:

### /

- `.gitignore`
- `compose.yaml`
- `README_BACHELOR.md` **(new)**

---

### backend/

- `README.md`
- `myproject.toml`

**backend/openstream/app/**
- `permissions.py` **(new)**
- `views.py`

**backend/openstream/project/**
- `asgi.py`
- `consumers.py` **(new)**
- `routing.py` **(new)**
- `settings.py`

---

### frontend/

**src/assets/pages/content-engine/**
- `main.js`
- `modules/core/slideshowDataManager.js`

**src/assets/utils/**
- `translations.json`
- `utils.js`

**src/components/base/content-engine/**
- `sidebar-content.hbs`
- `top-menu.hbs`


The original OpenStream is developed by Magenta Aps (https://www.magenta.dk).
