# WorkoutTrackerPWA

A progressive web app for logging gym workouts entirely on-device. The experience is optimised for iOS home screen usage and GitHub Pages hosting.

## Features

- 📱 **Installable PWA** – add the tracker to your iPhone home screen for a native-feeling app.
- 🏋️ **Workout logging** – capture date, focus, notes, and multiple exercises with sets, reps, and weight.
- 📈 **Progress insights** – view weekly session counts, last session volume, and your heaviest lift at a glance.
- 🗂 **Local storage** – all data is saved with `localStorage` and never leaves your device.
- 🔁 **Edit & delete** – update past entries or remove workouts you no longer need.
- 📶 **Offline ready** – a service worker caches the app shell so you can review or add workouts without a connection.

## Getting started

1. Clone or download this repository.
2. Serve the files locally (for example with `npx serve .`) or push to GitHub Pages.
3. Open the site on your device and add it to the home screen for an app-like experience.

## Development notes

- Update `CACHE_NAME` inside `service-worker.js` whenever you change cached assets so users receive the latest build.
- Icons are generated dynamically and embedded as Base64 PNG data URIs to avoid binary assets in the repo.
- No external dependencies are required; the app is built with vanilla HTML, CSS, and JavaScript.
