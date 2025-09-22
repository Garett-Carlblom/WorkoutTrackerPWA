# WorkoutTrackerPWA

A progressive web app for logging gym workouts entirely on-device. The experience is optimised for iOS home screen usage and GitHub Pages hosting.

## Features

- 📱 **Installable PWA** – add the tracker to your iPhone home screen for a native-feeling app.
- 🏋️ **Workout logging** – capture date, focus, notes, and build routines with as many exercises as you need.
- ✍️ **Inline set tracker** – add or remove sets per exercise while adjusting reps and weight on the fly.
- ⭐ **Templates** – save favourite workout structures and reapply them in a couple of taps for faster logging.
- 📈 **Progress snapshot** – keep tabs on total workouts, this week's sessions, and the number of sets you've logged.
- 🗂 **Local storage** – workouts and templates are saved with `localStorage` and never leave your device.
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
