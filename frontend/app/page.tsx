'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setLoading(true);
    try {
      // Get user info from Google
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        }
      );

      if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

      const userInfo = await userInfoResponse.json();

      // Create or update user in backend
      const userResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            googleId: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.picture,
          }),
        }
      );

         if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Backend error:', errorText);
      throw new Error('Failed to create user in backend');
    }

      // const { data: user } = await userResponse.json();

      const responseData = await userResponse.json();
    
    if (!responseData.success || !responseData.data) {
      throw new Error('Invalid response from server');
    }

    const user = responseData.data;

      // Store user in localStorage (in production, use proper session management)
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', tokenResponse.access_token);

      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const login = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: (error) => {
      console.error('Google login failed:', error);
      alert('Google login failed. Please try again.');
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ReachInbox</h1>
          <p className="text-gray-600">Email Scheduler Dashboard</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => login()}
            disabled={loading}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-gray-700 font-medium">
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </span>
          </button>
        </div>

        {loading && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Signing you in...
          </div>
        )}
      </div>
    </div>
  );
}
