import React from 'react';
import { Metadata } from 'next';
import Signup from '../../components/Signup';

export const metadata: Metadata = {
  title: 'Create a Glyssa Account | AI-powered Code Analysis',
  description: 'Join Glyssa to start analyzing and optimizing your code with AI-powered tools.'
};

export default function SignupPage() {
  return <Signup />;
}
