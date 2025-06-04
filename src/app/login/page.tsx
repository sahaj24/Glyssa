import React from 'react';
import { Metadata } from 'next';
import Login from '../../components/Login';

export const metadata: Metadata = {
  title: 'Sign in to Glyssa | AI-powered Code Analysis',
  description: 'Sign in to your Glyssa account to access AI-powered code analysis and optimization tools.'
};

export default function LoginPage() {
  return <Login />;
}
