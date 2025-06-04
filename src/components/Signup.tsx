'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const Signup = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('All fields are required');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Here you would typically make an API call to register the user
      // For now, we'll just simulate a successful signup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirect to home page after successful signup
      router.push('/');
    } catch (error) {
      setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-900 via-black to-zinc-900 subtle-bg-animation">
      <div className="w-full max-w-md p-8 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-800 auth-form-glow shadow-2xl shadow-purple-900/10 transition-all duration-300 hover:shadow-purple-800/20 relative overflow-hidden animate-slide-up">
        <div className="absolute inset-0 bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] from-purple-900/5 via-zinc-900/5 to-purple-900/10 opacity-50"></div>
        
        <div className="relative z-10 mb-8">
          <div className="flex justify-center mb-2">
            <svg className="w-10 h-10 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-purple-500 text-center">Create an Account</h1>
          <p className="mt-2 text-zinc-400 text-center">
            Join Glyssa to start analyzing and optimizing your code
          </p>
        </div>
        
        {error && (
          <div className="p-4 mb-6 bg-red-900/20 backdrop-blur-sm border border-red-500/30 text-red-200 rounded-lg shadow-sm flex items-center gap-3 animate-fade-in">
            <svg className="w-5 h-5 flex-shrink-0 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        
        <form className="relative z-10 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full pl-10 px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-lg shadow-sm 
                           placeholder-zinc-500 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-400 
                           focus:border-purple-400 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-lg shadow-sm 
                             placeholder-zinc-500 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-400 
                             focus:border-purple-400 transition-all"
                  placeholder="john@example.com"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-lg shadow-sm 
                             placeholder-zinc-500 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-400 
                             focus:border-purple-400 transition-all"
                  placeholder="••••••••"
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">Password must be at least 6 characters</p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="block w-full pl-10 px-4 py-3 bg-zinc-800/80 border border-zinc-700 rounded-lg shadow-sm 
                             placeholder-zinc-500 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-400 
                             focus:border-purple-400 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center mb-6">
              <input
                id="agree-terms"
                name="agree-terms"
                type="checkbox"
                className="h-4 w-4 appearance-none border border-zinc-600 rounded bg-zinc-800 checked:bg-purple-500 
                         checked:border-purple-500 focus:ring-offset-zinc-900 focus:ring-1 focus:ring-purple-400 focus:outline-none 
                         transition-colors duration-200 cursor-pointer"
                required
              />
              <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transform scale-50 peer-checked:scale-100 transition-transform duration-100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ left: '0.25rem', marginLeft: '0.25rem' }}>
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <label htmlFor="agree-terms" className="ml-2 block text-sm text-zinc-400">
                I agree to the <a href="#" className="text-purple-400 hover:text-purple-300">Terms of Service</a> and <a href="#" className="text-purple-400 hover:text-purple-300">Privacy Policy</a>
              </label>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white 
                         bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 hover:from-purple-500 hover:via-purple-400 hover:to-purple-500
                         focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-zinc-900
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 relative overflow-hidden group shine-effect"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-400/0 via-purple-400/20 to-purple-400/0 
                             translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Creating account...</span>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Create account
                  </>
                )}
              </span>
            </button>
          </div>
        </form>
        
        <div className="relative z-10 mt-8 text-center">
          <div className="flex items-center justify-center space-x-2">
            <div className="flex-1 h-px bg-zinc-800"></div>
            <span className="px-2 text-xs text-zinc-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-zinc-800"></div>
          </div>
          
          <p className="mt-6 text-sm text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-purple-400 hover:text-purple-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} Glyssa. All rights reserved.</p>
      </div>
    </div>
  );
};

export default Signup;
