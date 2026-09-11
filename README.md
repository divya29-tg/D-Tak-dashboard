# DTAK Admin Dashboard

A high-performance, real-time tactical command and management dashboard built with React, TypeScript, Vite, and MapLibre GL JS.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **Styling**: Modern CSS with custom DTAK tactical design system
- **Mapping Engine**: MapLibre GL JS + MapTiler API
- **Icons**: Lucide React
- **Linter**: Oxlint

## Project Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env.example` to `.env` and set your MapTiler API key:
   ```bash
   cp .env.example .env
   ```
   Configure your MapTiler API key in `.env`:
   ```env
   VITE_MAPTILER_API_KEY=your_maptiler_api_key_here
   ```

## Development & Build Commands

- **Development Server**:
  ```bash
  npm run dev
  ```

- **TypeScript Typecheck**:
  ```bash
  npm run typecheck
  ```

- **Linting**:
  ```bash
  npm run lint
  ```

- **Production Build**:
  ```bash
  npm run build
  ```

- **Preview Build**:
  ```bash
  npm run preview
  ```

