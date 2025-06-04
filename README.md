# Glyssa - Interactive Code Tutor

Glyssa is an interactive code tutor that presents as a code editor with AI capabilities. Built with Next.js and React 19, it provides an intuitive interface for learning and understanding code.

## Key Features

- **Interactive Code Editor**: Monaco-based editor with syntax highlighting and code navigation
- **AI Code Explanations**: AI reads code aloud while highlighting lines/blocks in sync with explanations
- **Voice Interaction**: Ask questions via text or voice input about any highlighted code
- **High-Quality Text-to-Speech**: Google Cloud TTS integration for natural-sounding speech
- **Synchronized Highlighting**: Audio explanations are synchronized with visual code highlighting
- **Intuitive Interface**: Modern, dark-themed UI resembling popular code editors

## Google Cloud TTS Integration

Glyssa uses Google Cloud's Text-to-Speech API for high-quality voice output. This integration enables:

- Premium neural voices for natural-sounding explanations
- Synchronized code highlighting during speech
- Support for multiple languages and voice types

### Setting Up Google Cloud TTS

1. The application is configured to use the service account credentials at:
   `/Users/sahaj/Downloads/winter-dynamics-458105-j7-1f53766f35e5.json`

2. This file contains the authentication details needed to access the Google Cloud TTS API

3. In a production environment, these credentials should be stored as environment variables for security

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
