// frontend/src/components/auth/LoginModal.tsx

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  // Helper function to normalize email (trim and lowercase)
  const normalizeEmail = (emailValue: string): string => {
    return emailValue.trim().toLowerCase();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize email before validation
    const normalizedEmail = normalizeEmail(email);
    
    // Update the email state if it was changed by normalization
    if (normalizedEmail !== email) {
      setEmail(normalizedEmail);
    }
    
    if (!normalizedEmail || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(normalizedEmail, password);
      onClose();
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Check if the value contains only whitespace or is just spaces around content
    // If user is typing normally, allow it, but if they paste or type excessive spaces, normalize it
    const hasExcessiveSpaces = value.startsWith('  ') || value.endsWith('  ') || value.includes('   ');
    
    if (hasExcessiveSpaces && value.trim() !== '') {
      // If there are excessive spaces but there's actual content, normalize it
      const normalized = normalizeEmail(value);
      setEmail(normalized);
    } else {
      // Normal typing - allow it as is
      setEmail(value);
    }
    
    setError('');
  };

  const handleEmailBlur = () => {
    // Always normalize on blur to ensure clean final state
    const normalized = normalizeEmail(email);
    if (normalized !== email) {
      setEmail(normalized);
    }
  };

  const handleEmailPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    // Handle paste events to automatically normalize pasted content
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const normalized = normalizeEmail(pastedText);
    setEmail(normalized);
    setError('');
  };

  const handleClose = () => {
    onClose();
    setEmail('');
    setPassword('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md relative shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
        >
          <X size={24} />
        </button>
        
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Login</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              onPaste={handleEmailPaste}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="Enter your password"
              required
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Logging in...
              </div>
            ) : (
              'Login'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p className="mb-2">Test Accounts:</p>
          <p>Admin: admin@tuition.com / password123</p>
          <p>Staff: hui.siew@tuition.com / password123</p>
          <p>Parent: jaytoh@gmail.com / password123</p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;