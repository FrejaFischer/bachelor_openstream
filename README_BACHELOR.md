# Bachelor project 2025/2026

This is the repository for my Bachelor project for the Web Development PBA. In this README file the projects implementations will be introduced and an overview of all changes or added files is available.

My project is focused on:

**Adding real-time updates between users editing slideshows, so that OpenStream becomes a better collaboration tool.**

To achieve this there has been added new development in both the frontend and backend application for OpenStream, as well as an addition to the Docker compose configuration.

## Backend changes
To implement the handling of real-time updates of a slideshow, there has been added Django Channels to the Django backend. Channels needs to run on an ASGI server, and therefor the runtime server for development has been changed to use Daphne ASGI server instead of the existing WSGI.
This is added to the `settings.py` file, where it now uses the new ASGI server configuration and has Daphne in the installed apps. Here the configuration for Channel layers is also set.

The `asgi.py` file now receives the incoming request and sends the HTTP or WebSocket (WS) request to the correct handler.
- HTTP request gets handles as before in the `views.py`.
- WS request gets handled by the corresponding consumer, which can be found in new `consumers.py` file.

New `routing.py` file contains WS endpoints / URL patterns. The new slideshow WS endpoint for creating a real-time connection to a specific slideshow is added here, and points to the slideshow consumer. 

Inside the slideshow consumer in `consumers.py` the WS slideshow request is being handled. First it accepts the connection, then run authentication, and if that is successful then it handles receiving and sending data to and from the client. The consumer sends the current slideshow data after authentication is successful. It sends slideshow changes coming from the client to the slideshows Channel group. Every connected consumer instance to the specific slideshow will then receive the changes and send them to their clients. The consumer uses helper functions for getting and updating the specific slideshow in the database. Here the existing slideshow Model and Serializer are being used.

To check the users permission for accessing or changing the slideshows data in the database, the existing branch checking logic, which original was placed directly in the `views.py` file, has been moved to the new `permissions.py` file. This file has been created to contain permissions helper functions, which is used in both `views.py` and `consumers.py` (e.g. both HTTP and WS requests). The `views.py` file has been changed to use the branch permission helper function from the `permissions.py` file.

### The addition of Redis
A Redis Docker container has been added to OpenStreams `compose.yaml` file. Redis is used for the Channel layer to handle communication between different consumer instances for the same slideshow. A Redis client is also created in the consumer to keep track of active users in the slideshow. This is done by making a Redis set, which can hold a list of active users, and be send to the client.

## Frontend changes
In the OpenStream frontend the `main.js` file for the content-engine now calls the new connectToSlideshow-function to create a WS connection and get slideshow data on page load, instead of the original solution with a HTTP GET request. This new function has been added to the `slideshowDataManager.js` file, which handles keeping track of the slideshow changes.

The `slideshowDataManager.js` has been changed to now include both this new connectToSlideshow function, but also several other new functions handling the WebSocket connection and rendering the presence of collaborators (other active users in the slideshow).

A new helper function has been added to `utils.js` for escaping HTML characters. This functionality is needed in the new implementations in `slideshowDataManager.js`, but can be relevant for other places in OpenStream frontend, and has been placed globally for future access.

A new UI element has been added in the `sidebar-content.hbs` component, to contain a view of these active users. The content of this element is being rendered inside the `slideshowDataManager.js` file.


## Project changes overview 
Here is a list of every file that has been changed or added by this project:

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

**frontend/src/assets/pages/content-engine/**
- `main.js`
- `modules/core/slideshowDataManager.js`

**frontend/src/assets/utils/**
- `translations.json`
- `utils.js`

**frontend/src/components/base/content-engine/**
- `sidebar-content.hbs`
- `top-menu.hbs`


## Quick guide to run the application
This is a quick guide for OpenStream, which shows the nessesary steps towards testing my solution.

To run this application, you'll need Docker. Then run the command: `docker compose up --build` to start the whole application (both frontend, backend, database etc.).
There will be created some test data and one user, which has the superadmin user role:

**Username:** superadmin

**Password:** superadmin

With this user, you'll have access to three organisations, which all have some branches to test with. In this guide we use Lyngby-Taarbæk as an example.

### Setting up the slideshow data
To create a slideshow to test my solution with, you'll need to follow these steps (Remember to be logged in as the superadmin user):
1. First create a global template for the organisation, which can be done in the `Global Settings` inside the Lyngby Taarbæk organisation (http://localhost:5173/manage-templates?mode=template_editor&orgId=1&suborgId=8&branchId=30). You can just make a blank template by clicking on the `+ Add Template` button.
2. Then you'll need to create a sub organisation template, to for example Bibliotekerne (http://localhost:5173/manage-templates?mode=suborg_templates&orgId=1&suborgId=1&branchId=39). Again click on the `+ Add Template` button and choose the global template you made before. You can leave this template blank again.
3. After setting up the nessesary templates, you can then select a branch, for example Lundtofte Bibliotek, where you can create a new slideshow by clicking on `+ Add Content` on http://localhost:5173/manage-content?orgId=1&suborgId=1&branchId=15.
4. Open the slideshow and add a slide on http://localhost:5173/edit-content?id=1&mode=edit&orgId=1&suborgId=1&branchId=15. This is where my solution takes place. By opening a slideshow you will create a WebSocket connection to the backend (http://localhost:8000/admin/), which will make real-time updates between different users.

### Creating a new user
To create a new user for testing multiple users editing a slideshow, follow these steps:
1. Go to http://localhost:5173/select-sub-org?orgId=1 (the overview page for Lyngby Taarbæk organisation), while you are still logged in as superadmin.
2. Click on `Manage Users` and then on `Add User`.
3. Select a role (any role have access to editing slideshows in branches), and fill out all inputs.
4. Then login with the new user in a new browser and access the slideshow from before in Lundtofte Bibliotek branch. Now you can see how my solution can show one users changes to another user. The users can also see each others presence in the left down corner.

***The original OpenStream, which this project is build upon, is developed by Magenta Aps (https://www.magenta.dk).***
