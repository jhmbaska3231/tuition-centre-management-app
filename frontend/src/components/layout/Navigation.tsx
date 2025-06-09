// src/components/layout/Navigation.tsx

import React, { useState, useRef, useEffect } from 'react';
import { GraduationCap, LogIn, User, Settings, UserPlus, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import LoginModal from '../auth/LoginModal';
import RegistrationModal from '../auth/RegistrationModal';

interface NavigationProps {
  onProfileClick?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ onProfileClick }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    // Add event listener when dropdown is open
    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const handleProfileClick = () => {
    setShowProfileDropdown(false);
    onProfileClick?.();
  };

  return (
    <>
      <nav className="bg-white bg-opacity-95 backdrop-blur-lg shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-800 hidden sm:block">
                Tuition Centre Management
              </span>
              <span className="text-lg font-bold text-gray-800 sm:hidden">
                TCM
              </span>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              {isAuthenticated && user ? (
                <div className="relative" ref={dropdownRef}>
                  {/* User Profile Dropdown */}
                  <button
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center space-x-3 bg-gray-100 rounded-full px-4 py-2 hover:bg-gray-200 transition-colors"
                  >
                    <User className="h-5 w-5 text-gray-600" />
                    <div className="text-left hidden sm:block">
                      <div className="font-semibold text-gray-800">
                        {user.first_name}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {user.role}
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${
                      showProfileDropdown ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showProfileDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="font-semibold text-gray-800">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      
                      <button
                        onClick={handleProfileClick}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <Settings size={16} />
                        <span>Profile Settings</span>
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          logout();
                        }}
                        className="flex items-center space-x-2 w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogIn size={16} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Authentication Buttons */
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    <LogIn size={18} />
                    <span>Login</span>
                  </button>
                  
                  <button
                    onClick={() => setShowRegistrationModal(true)}
                    data-register-btn
                    className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-0.5"
                  >
                    <UserPlus size={18} />
                    <span>Register</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      {/* Modals */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
      <RegistrationModal 
        isOpen={showRegistrationModal} 
        onClose={() => setShowRegistrationModal(false)} 
      />
    </>
  );
};

export default Navigation;