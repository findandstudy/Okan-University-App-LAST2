# University Landing Platform

## Overview

This is a multi-tenant landing page and admin panel platform designed for university recruitment through paid advertising. The platform enables high-conversion landing pages with application intake workflows, optimized for fast performance and SEO correctness.

The first tenant is configured for okanuniversity.app. The system supports multiple languages (English, Arabic, Turkish, French, Russian, Farsi) with RTL support for Arabic and Farsi.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with language-prefixed routes (e.g., `/:lang/apply`)
- **State Management**: TanStack React Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, supporting light/dark modes
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Internationalization**: Custom i18n context with language detection, RTL support, and fallback to English

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON APIs under `/api/*` prefix
- **Build Process**: Custom build script using esbuild for server bundling and Vite for client

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` - shared between client and server
- **Migrations**: Managed through Drizzle Kit with `db:push` command
- **Session Storage**: connect-pg-simple for PostgreSQL-backed sessions

### Multi-Tenant Design
- Tenants identified by domain with separate configuration for themes, sections, and content
- Content stored with language-specific JSON objects for internationalization
- Sections are toggleable and orderable per tenant from admin panel

### Key Data Models
- **Tenants**: University configuration with branding and domain mapping
- **Programs**: Academic programs with tuition fees and discounts
- **Leads/Applications**: Student intake with multi-step wizard workflow
- **Sections**: Configurable landing page sections (hero, trust badges, FAQ, etc.)
- **Admin Users**: Panel access with tenant-scoped permissions

### Application Flow
- Landing page with modular sections controlled by admin
- Program finder with filtering (degree, language, fee range)
- Multi-step application wizard: lead capture → program confirmation → document upload
- Clean URL routes without query parameter bloat

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable

### UI/Component Libraries
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-built component styles (new-york style variant)
- **Framer Motion**: Animation library
- **Embla Carousel**: Carousel functionality
- **React Day Picker**: Calendar/date selection
- **cmdk**: Command palette component

### Form & Validation
- **React Hook Form**: Form state management
- **Zod**: Schema validation shared between client and server
- **drizzle-zod**: Generate Zod schemas from Drizzle tables

### Backend Services
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store
- **multer**: File upload handling
- **nodemailer**: Email sending capabilities

### Development Tools
- **Vite**: Frontend build and dev server with HMR
- **esbuild**: Server-side bundling
- **Drizzle Kit**: Database migrations and schema management

### Integrations
- **Google Analytics**: GA4 measurement ID (G-XXXXXXXXXX) stored in tenant settings
- **Google Search Console**: Site verification meta tag stored and injected into landing page head
- **TrackingScripts Component**: Dynamically injects GA and GSC codes into page head, with update and removal handling
- **Object Storage**: Used for logo and favicon uploads via server-side upload endpoint (POST /api/upload with FormData) to avoid CORS issues with presigned URLs

## Admin Features

### Testimonials Management
- Admin page at `/admin/testimonials` for managing student testimonials
- CRUD operations: create, read, update, delete testimonials
- Fields: student name, photo (uploadable), country, program name, rating (1-5 stars), content
- Multi-language support for testimonial content (EN, AR, TR, FR, RU, FA)
- Display order and enabled/disabled toggle
- Photos uploaded via `/api/upload` endpoint and stored in object storage
- Landing page fetches from `/api/testimonials` with fallback to default testimonials if none exist
- Tenant-scoped: each tenant manages their own testimonials

### SEO Settings Management
- Admin page at `/admin/seo` for managing SEO meta tags and social media optimization
- Meta Tags tab: multi-language meta title, description, keywords (EN, AR, TR, FR, RU, FA)
- Robots directive (index/noindex, follow/nofollow) and canonical URL
- Social Media tab: Open Graph (title, description, image, type) and Twitter Card settings
- SEOMetaTags component dynamically injects meta tags into HTML head
- Falls back to tenant university name for page title when no SEO settings exist
- Unique constraint ensures one SEO settings row per tenant

### Landing Page Preloader
- Preloader component displays while initial API data loads
- Shows animated university logo with loading dots
- Provides smooth user experience before full page render