// frontend/src/components/parent/ParentDashboard.tsx

import React, { useState, useEffect } from 'react';
import { Users, Calendar, CreditCard, Settings } from 'lucide-react';
import StudentManagement from '../students/StudentManagement';
import PaymentHistory from './PaymentHistory';
import ClassOperations from './ClassOperations';
import ProfileManagement from '../profile/ProfileManagement';

type TabType = 'students' | 'classes' | 'payments' | 'profile';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  badge?: string;
}

interface ParentDashboardProps {
  initialTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({ 
  initialTab = 'students', 
  onTabChange 
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = (tab: TabType) => {
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
      id: 'students',
      label: 'My Students',
      icon: <Users size={20} />,
      component: <StudentManagement />,
    },
    {
      id: 'classes',
      label: 'Class Operations',
      icon: <Calendar size={20} />,
      component: <ClassOperations />,
    },
    {
      id: 'payments',
      label: 'Payment History',
      icon: <CreditCard size={20} />,
      component: <PaymentHistory />,
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
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-2 bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content with top padding to account for sticky header */}
      <div className="max-w-6xl mx-auto pt-0">
        {currentTab?.component}
      </div>
    </div>
  );
};

export default ParentDashboard;