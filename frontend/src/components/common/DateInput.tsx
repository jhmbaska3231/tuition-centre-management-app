// frontend/src/components/common/DateInput.tsx

import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY',
  min,
  max,
  required,
  disabled
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const displayInputRef = useRef<HTMLInputElement>(null);

  // Format date from yyyy-mm-dd to dd/mm/yyyy for display
  const formatDisplayDate = (isoDate: string): string => {
    if (!isoDate) return '';
    try {
      const [year, month, day] = isoDate.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // Parse date from dd/mm/yyyy to yyyy-mm-dd for input value
  const parseDisplayDate = (displayDate: string): string => {
    if (!displayDate) return '';
    
    // Remove any non-numeric characters except /
    const cleaned = displayDate.replace(/[^\d/]/g, '');
    const parts = cleaned.split('/');
    
    if (parts.length === 3) {
      const [day, month, year] = parts;
      
      // Validate the parts
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      if (dayNum >= 1 && dayNum <= 31 && 
          monthNum >= 1 && monthNum <= 12 && 
          yearNum >= 1900 && yearNum <= 2100) {
        return `${yearNum}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return '';
  };

  const handleDisplayInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Auto-format as user types (add slashes)
    inputValue = inputValue.replace(/\D/g, ''); // Remove non-digits
    if (inputValue.length >= 2) {
      inputValue = inputValue.substring(0, 2) + '/' + inputValue.substring(2);
    }
    if (inputValue.length >= 5) {
      inputValue = inputValue.substring(0, 5) + '/' + inputValue.substring(5, 9);
    }
    
    // Update display input
    if (displayInputRef.current) {
      displayInputRef.current.value = inputValue;
    }
    
    // Try to parse and update the actual value
    const parsedDate = parseDisplayDate(inputValue);
    if (parsedDate || inputValue === '') {
      onChange(parsedDate);
    }
  };

  const handleDisplayInputBlur = () => {
    // Ensure the display shows the properly formatted date
    if (displayInputRef.current) {
      displayInputRef.current.value = formatDisplayDate(value);
    }
  };

  const handleCalendarIconClick = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.showPicker?.();
    }
  };

  const handleNativeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (displayInputRef.current) {
      displayInputRef.current.value = formatDisplayDate(e.target.value);
    }
  };

  return (
    <div className="relative">
      {/* Display input with dd/mm/yyyy format */}
      <input
        ref={displayInputRef}
        type="text"
        defaultValue={formatDisplayDate(value)}
        onChange={handleDisplayInputChange}
        onBlur={handleDisplayInputBlur}
        className={`w-full p-3 pr-10 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none ${className}`}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={10}
      />
      
      {/* Calendar icon */}
      <button
        type="button"
        onClick={handleCalendarIconClick}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        disabled={disabled}
      >
        <Calendar size={16} />
      </button>
      
      {/* Hidden native date input for picker functionality */}
      <input
        ref={hiddenInputRef}
        type="date"
        value={value}
        onChange={handleNativeInputChange}
        className="absolute inset-0 opacity-0 pointer-events-none"
        min={min}
        max={max}
        tabIndex={-1}
      />
    </div>
  );
};

export default DateInput;