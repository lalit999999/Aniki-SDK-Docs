# CLAUDE.md

# Aniki SDK Documentation Website

This document provides project context, architecture, conventions, and implementation guidelines for Claude when working on the Aniki SDK Documentation Website.

---

# Project Overview

The Aniki SDK Documentation Website is the official documentation portal for the **Aniki SDK**, an open-source TypeScript SDK for building production-ready AI Agents.

The website should provide:

- Beautiful SaaS-style landing page
- Complete documentation
- GitHub authentication
- User dashboard
- Admin dashboard
- Contact/Feedback system
- Future-proof architecture for versioned documentation
- Community-driven contribution support

The design should feel similar to products such as:

- Vercel
- Linear
- Resend
- Supabase
- Clerk
- Trigger.dev

The overall experience should be clean, modern, developer-focused, fast, and animation-rich.

---

# Tech Stack

## Frontend

- Next.js (App Router)
- TypeScript
- TailwindCSS
- shadCN/UI
- Framer Motion
- Lucide Icons
- MDX Documentation
- React Query (TanStack Query)

Theme

```
shadCN Theme Code

b6tOz2I1z
```

---

## Backend

- NestJS
- REST API
- JWT Authentication
- Role Guards
- Validation Pipes
- Swagger

---

## Database

MongoDB

Collections

- users
- messages
- feedback
- analytics
- sessions

---

# Authentication

Authentication should only support GitHub.

No email/password login.

No Google login.

Flow

Guest(can see documentation)

↓

GitHub OAuth

↓

User created automatically

↓

role = USER

↓

(form for the message to the admin for any query,without login can't fill the form.)

Administrator role is assigned manually by changing the user's role inside MongoDB.

Example

```ts
{
  role: "ADMIN";
}
```

---

# User Roles

## USER

Permissions

- Login
- View documentation
- Send feedback
- Send messages
- View profile
- Update profile

---

## ADMIN

Permissions

- Everything USER can do
- View all users
- Read user messages
- Delete messages
- Archive messages
- Dashboard analytics
- Feedback management

---

# Website Structure

```
/

Landing Page

/docs

Dashboard

/admin

/contact

/changelog

/roadmap

/examples

/contributors

/support

/blog (future)

/playground (future)
```

---

# Landing Page Sections

Landing page should contain:

1. Hero Section

2. Features

3. Why Aniki SDK

4. Code Example

5. Architecture

6. Supported Providers

7. GitHub Statistics

8. Contributors

9. Documentation Preview

10. FAQ

11. Call To Action

12. Footer

---

# Hero Section

Hero should include

- Large heading
- Short description
- GitHub button
- some agent sample code (with animation)
- command to install the SDK(npm command)
- Documentation button
- GitHub stars
- Animated code example
- Background animation

---

# UI Requirements

The UI should look like a premium SaaS product.

Use:

- Rounded corners
- Soft shadows
- Blur effects
- Glassmorphism where appropriate
- Consistent spacing
- Responsive layouts
- Dark mode first
- Excellent typography

---

# Animations

Use Framer Motion.

Animations should include

## Navbar

- Transparent initially
- Shrinks on scroll
- Floating navigation
- Blur background
- Smooth transition

---

## Hero

- Floating cards
- Background gradients
- Moving grid
- Scroll reveal
- Fade animations

---

## Cards

Hover animations

Examples

- Scale
- Glow
- Shadow
- Lift
- Border animation

---

## Scroll Animations

Reveal sections on scroll

Fade

Slide

Scale

---

## Buttons

Hover

Press

Ripple

Gradient transition

---

# Documentation

Documentation should use MDX.

Categories

```
Getting Started

Installation

Quick Start

Providers

Models

Memory

Agents

Tools

Examples

API Reference

Migration Guide

FAQ

Troubleshooting
```

---

# Documentation Features

Support

- Search
- Table of contents
- Previous/Next navigation
- Copy code buttons
- Edit on GitHub
- Reading progress
- Code tabs

---

# Versioned Documentation

Support documentation versioning.

Example

```
v1

v1.1

v2
```

Users should be able to switch versions from the navbar.

Old versions remain accessible.

---

# Search

Provide fast documentation search.

Recommended

- Orama
- Pagefind
- Algolia (future)

---

# Dashboard

User dashboard

Pages

```
Profile

Messages

Bookmarks (future)

Settings
```

---

# Admin Dashboard

Pages

```
Dashboard

Users

Messages

Feedback

Analytics

Settings
```

Dashboard cards

- Users
- Messages
- GitHub Stars
- Page Views
- Popular Docs
- Active Users

---

# Contact Form

Fields

```
Name

GitHub Username

Subject

Category

Message
```

Categories

- General
- Bug
- Feature Request
- Business
- Security

---

# Messages

Messages are stored inside MongoDB.

Admins can

- Read
- Archive
- Delete

Users cannot read messages after submission.

---

# GitHub Integration

Display

- GitHub Stars
- Forks
- Contributors
- Latest Release

Provide links to

- Repository
- Issues
- Discussions

---

# Examples Gallery

Create an Examples page.

Include working examples for

- Next.js
- NestJS
- Express
- Fastify
- Node.js
- AI Chatbot
- RAG
- Memory
- Tool Calling
- Multi Agent
- Streaming

Each example should contain

- Description
- Difficulty
- Features
- GitHub Link
- Copy Button

---

# Roadmap

Create a roadmap page.

Example roadmap

## Completed

- SDK Foundation
- Providers
- Agent API

---

## In Progress

- Memory
- Tool Calling
- Testing
- Better DX

---

## Planned

- Multi Agent
- Voice
- MCP
- Cloud Dashboard
- Marketplace
- Templates

---

# Changelog

Maintain a changelog.

Each release should contain

- Version
- Date
- Features
- Fixes
- Breaking Changes

---

# Community

Community page should include

- Discord (future)
- GitHub Discussions
- Issues
- Pull Requests
- Contribution Guide

---

# Contributors

Display

- GitHub avatars
- Name
- Contributions

---

# Sponsor / Support

Create a support page.

Include

- GitHub Sponsors
- Buy Me a Coffee (future)
- OpenCollective (future)

Explain how sponsorship helps the project.

---

# FAQ

Typical questions

- What is Aniki SDK?
- Why another AI SDK?
- Which providers are supported?
- Can I contribute?
- Is it production ready?
- Is it open source?

---

# Performance Goals

Target

Lighthouse

Performance

95+

Accessibility

95+

SEO

100

Best Practices

100

---

# SEO Essentials

Every page should include

- Title
- Description
- Canonical URL
- Open Graph tags
- Twitter cards
- Structured Data
- Sitemap
- robots.txt
- RSS feed (future)

Generate

- Dynamic metadata
- Open Graph images

Optimize

- Images
- Fonts
- Metadata

Use semantic HTML.

---

# Accessibility

Ensure

- Keyboard navigation
- Focus states
- Screen reader support
- Proper heading hierarchy
- Accessible color contrast
- Reduced motion support

---

# Future Features

- AI Documentation Search
- Playground
- Interactive Examples
- Live Sandbox
- Code Generator
- AI Assistant
- Blog
- Tutorials
- Video Guides
- Theme Customizer
- Notifications
- Release Notes
- Analytics Dashboard
- API Playground

---

# Design Principles

Always prefer

- Simplicity
- Readability
- Consistency
- Smooth animations
- Fast loading
- Responsive layouts
- Developer-first UX

Avoid

- Visual clutter
- Overuse of colors
- Heavy animations
- Slow page loads
- Complex navigation

---

# Folder Structure

```
apps/
    web/
    api/

packages/
    ui/
    config/
    types/

content/
    docs/
    blog/
    changelog/

public/

components/

lib/

hooks/

services/

styles/

types/
```

---

# Code Quality Guidelines

Always

- Use TypeScript
- Use Server Components where possible
- Use Client Components only when necessary
- Write reusable components
- Keep components small
- Prefer composition over duplication
- Follow clean architecture
- Maintain consistent naming conventions
- Ensure responsive design
- Write accessible markup
- Optimize for performance
- Keep animations smooth and purposeful

---

# Vision

The Aniki SDK Documentation Website should become more than just documentation.

It should serve as the central hub for the Aniki SDK ecosystem by providing:

- Beautiful developer experience
- Comprehensive documentation
- Community engagement
- Interactive examples
- Versioned documentation
- Contribution guides
- Release tracking
- Roadmap visibility
- Sponsorship opportunities
- Future AI-powered developer tooling

The final product should feel polished, premium, scalable, and comparable in quality to the documentation websites of leading developer platforms.
