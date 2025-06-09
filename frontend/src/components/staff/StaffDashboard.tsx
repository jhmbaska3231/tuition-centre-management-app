// frontend/src/components/staff/StaffDashboard.tsx

import React, { useState, useEffect } from 'react';
import { BookOpen, UserCheck, Settings } from 'lucide-react';
import ClassManagement from './ClassManagement';
import AttendanceTracking from './AttendanceTracking';
import ProfileManagement from '../profile/ProfileManagement';

type StaffTabType = 'classes' | 'attendance' | 'profile';

interface TabConfig {
  id: StaffTabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  badge?: string;
}

interface StaffDashboardProps {
  initialTab?: StaffTabType;
  onTabChange?: (tab: StaffTabType) => void;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ 
  initialTab = 'classes', 
  onTabChange 
}) => {
  const [activeTab, setActiveTab] = useState<StaffTabType>(initialTab);

  const handleTabChange = (tab: StaffTabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, activeTab]);

  const tabs: TabConfig[] = [
    {
      id: 'classes',
      label: 'Class Management',
      icon: <BookOpen size={20} />,
      component: <ClassManagement />,
    },
    {
      id: 'attendance',
      label: 'Attendance Tracking',
      icon: <UserCheck size={20} />,
      component: <AttendanceTracking />,
    },
    {
      id: 'profile',
      label: 'Profile Settings',
      icon: <Settings size={20} />,
      component: <ProfileManagement />,
    },
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Tab Navigation */}
      <div className="sticky top-16 z-30 bg-white shadow-sm border-b border-gray-200 backdrop-blur-sm bg-opacity-95">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto pt-0">
        {currentTab?.component}
      </div>
    </div>
  );
};

export default StaffDashboard;