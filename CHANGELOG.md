# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Planner board now preloads date lanes (plus an Unassigned lane), offers a talent filter, and exports the current view to PDF for offline sharing.
- Products page multi-select enables archiving, restoring, deleting, and bulk editing style numbers across multiple families with chunked batched writes.
- Reference images for shots now persist and display as preview thumbnails in planner and gallery views (#220)
- Playwright E2E testing infrastructure with Firebase emulator support for testing sidebar summary autosave functionality (#223)

### Changed
- Sticky headers keep titles, search, and primary actions visible on the Shots, Products, Talent, and Locations pages.
- Products page header adds sort controls for style name and style number.

### Fixed
- Environment detection in firebase.ts now correctly uses `import.meta.env.MODE` to prevent App Check from blocking local development (#157)
- Product image uploads now handle errors gracefully with user-friendly messages instead of silent failures (Sentry #6967516025, #220)
