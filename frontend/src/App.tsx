// src/App.tsx

import React, { useState } from 'react';
import { BookOpen, User, BarChart3, Users, Calendar, CreditCard, UserPlus, Star, CheckCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Navigation from './components/layout/Navigation';
import ParentDashboard from './components/parent/ParentDashboard';
import StaffDashboard from './components/staff/StaffDashboard';

// Feature Card Component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, color }) => (
  <div className="bg-white bg-opacity-95 backdrop-blur-lg p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
    <div className={`text-4xl mb-4 ${color}`}>{icon}</div>
    <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </div>
);

// Testimonial Component
interface TestimonialProps {
  name: string;
  role: string;
  content: string;
  rating: number;
}

const Testimonial: React.FC<TestimonialProps> = ({ name, role, content, rating }) => (
  <div className="bg-white bg-opacity-95 backdrop-blur-lg p-6 rounded-2xl shadow-lg">
    <div className="flex items-center mb-4">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} className="text-yellow-400 fill-current" size={16} />
      ))}
    </div>
    <p className="text-gray-700 mb-4 italic">"{content}"</p>
    <div>
      <p className="font-semibold text-gray-800">{name}</p>
      <p className="text-sm text-gray-500">{role}</p>
    </div>
  </div>
);

// Loading Component
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-blue-50 flex items-center justify-center">
    <div className="bg-white p-8 rounded-2xl shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600"></div>
        <span className="text-lg font-medium text-gray-700">Loading...</span>
      </div>
    </div>
  </div>
);

// Main App Content
const AppContent: React.FC = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<'students' | 'classes' | 'payments' | 'profile'>('students');
  const [currentStaffTab, setCurrentStaffTab] = useState<'classes' | 'students' | 'profile'>('classes');

  const handleProfileClick = () => {
    if (user?.role === 'parent') {
      setCurrentTab('profile');
    } else if (user?.role === 'staff') {
      setCurrentStaffTab('profile');
    }
  };

  const handleTabChange = (tab: 'students' | 'classes' | 'payments' | 'profile') => {
    setCurrentTab(tab);
  };

  const handleStaffTabChange = (tab: 'classes' | 'students' | 'profile') => {
    setCurrentStaffTab(tab);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  // Show different content based on authentication and role
  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation onProfileClick={handleProfileClick} />
        
        {user.role === 'parent' ? (
          // Parent Dashboard with Tabs
          <ParentDashboard 
            initialTab={currentTab}
            onTabChange={handleTabChange}
          />
        ) : (
          // Staff Dashboard with Tabs
          <StaffDashboard 
            initialTab={currentStaffTab}
            onTabChange={handleStaffTabChange}
          />
        )}
      </div>
    );
  }

  // Landing page for non-authenticated users
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Welcome to Our Tuition Center
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed mb-8">
            Comprehensive learning management system designed for modern education.
            Join thousands of students across multiple branches in their learning journey.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button
              onClick={() => {
                // This would trigger the registration modal from Navigation
                document.querySelector<HTMLButtonElement>('[data-register-btn]')?.click();
              }}
              className="flex items-center space-x-2 bg-blue-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-1 shadow-lg"
            >
              <UserPlus size={20} />
              <span>Get Started Today</span>
            </button>
            <button className="text-gray-600 border-2 border-gray-300 px-8 py-4 rounded-full font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all duration-200">
              Learn More
            </button>
          </div>
        </div>
        
        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <FeatureCard
            icon={<BookOpen />}
            title="Multiple Branches"
            description="Access classes across all our branch locations with flexible scheduling and easy enrollment."
            color="text-blue-600"
          />
          
          <FeatureCard
            icon={<User />}
            title="Expert Teachers"
            description="Learn from qualified instructors with specialized subject expertise and proven track records."
            color="text-green-600"
          />
          
          <FeatureCard
            icon={<BarChart3 />}
            title="Progress Tracking"
            description="Monitor student progress with detailed analytics, payment tracking, and enrollment history."
            color="text-purple-600"
          />
        </div>

        {/* Benefits Section */}
        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-2xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">Why Choose Us?</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Flexible Scheduling</h3>
              <p className="text-sm text-gray-600">Classes available across multiple time slots and branches</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <Users className="text-blue-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Small Class Sizes</h3>
              <p className="text-sm text-gray-600">Personalized attention with limited enrollment per class</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4">
                <Calendar className="text-purple-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Easy Management</h3>
              <p className="text-sm text-gray-600">Simple enrollment, cancellation, and payment tracking</p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full mb-4">
                <CreditCard className="text-orange-600" size={24} />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">Transparent Pricing</h3>
              <p className="text-sm text-gray-600">Clear payment history and multiple payment options</p>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">What Parents Say</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Testimonial
              name="Alice Lim"
              role="Parent of 2 students"
              content="The online platform makes it so easy to manage my children's classes and track their progress. Highly recommended!"
              rating={5}
            />
            <Testimonial
              name="David Chen"
              role="Parent"
              content="Excellent teachers and flexible scheduling. My daughter's grades have improved significantly since joining."
              rating={5}
            />
            <Testimonial
              name="Sarah Wong"
              role="Parent of 1 student"
              content="Love the transparency in payment tracking and the ability to enroll across different branches."
              rating={5}
            />
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Ready to Get Started?</h2>
          <p className="text-gray-600 mb-6">
            Join our community of successful students and supportive parents today.
          </p>
          <button
            onClick={() => {
              document.querySelector<HTMLButtonElement>('[data-register-btn]')?.click();
            }}
            className="bg-blue-600 text-white px-8 py-4 rounded-full font-semibold hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-1 shadow-lg"
          >
            Create Your Account
          </button>
        </div>
      </main>
    </div>
  );
};

// Root App Component with Provider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;