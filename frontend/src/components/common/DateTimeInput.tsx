// frontend/src/components/common/DateTimeInput.tsx

import React, { useRef } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
}

const DateTimeInput: React.FC<DateTimeInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'DD/MM/YYYY HH:MM',
  min,
  max,
  required,
  disabled
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const displayInputRef = useRef<HTMLInputElement>(null);

  // Format datetime from yyyy-mm-ddThh:mm to dd/mm/yyyy hh:mm for display
  const formatDisplayDateTime = (isoDateTime: string): string => {
    if (!isoDateTime) return '';
    try {
      const [datePart, timePart] = isoDateTime.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      return `${day}/${month}/${year} ${hour}:${minute}`;
    } catch {
      return '';
    }
  };

  // Parse datetime from dd/mm/yyyy hh:mm to yyyy-mm-ddThh:mm for input value
  const parseDisplayDateTime = (displayDateTime: string): string => {
    if (!displayDateTime) return '';
    
    try {
      // Split date and time parts
      const parts = displayDateTime.split(' ');
      if (parts.length !== 2) return '';
      
      const [datePart, timePart] = parts;
      
      // Parse date part
      const dateSegments = datePart.split('/');
      if (dateSegments.length !== 3) return '';
      
      const [day, month, year] = dateSegments;
      
      // Parse time part
      const timeSegments = timePart.split(':');
      if (timeSegments.length !== 2) return '';
      
      const [hour, minute] = timeSegments;
      
      // Validate
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      
      if (dayNum >= 1 && dayNum <= 31 && 
          monthNum >= 1 && monthNum <= 12 && 
          yearNum >= 1900 && yearNum <= 2100 &&
          hourNum >= 0 && hourNum <= 23 &&
          minuteNum >= 0 && minuteNum <= 59) {
        return `${yearNum}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      }
    } catch {
      return '';
    }
    return '';
  };

  const handleDisplayInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Auto-format as user types
    inputValue = inputValue.replace(/[^\d\s:/]/g, ''); // Keep only digits, space, colon, slash
    
    // Format date part (DD/MM/YYYY)
    const dateMatch = inputValue.match(/^(\d{0,2})\/?(\d{0,2})\/?(\d{0,4})/);
    if (dateMatch) {
      let [, day, month, year] = dateMatch;
      let formatted = day;
      if (month) formatted += '/' + month;
      if (year) formatted += '/' + year;
      
      // Add space and time if there's more input
      const remaining = inputValue.replace(/^\d{0,2}\/?(\d{0,2})?\/?(\d{0,4})?/, '').trim();
      if (remaining) {
        formatted += ' ';
        // Format time part (HH:MM)
        const timeMatch = remaining.match(/^(\d{0,2}):?(\d{0,2})/);
        if (timeMatch) {
          let [, hour, minute] = timeMatch;
          formatted += hour;
          if (minute) formatted += ':' + minute;
        }
      }
      
      inputValue = formatted;
    }
    
    // Update display input
    if (displayInputRef.current) {
      displayInputRef.current.value = inputValue;
    }
    
    // Try to parse and update the actual value
    const parsedDateTime = parseDisplayDateTime(inputValue);
    if (parsedDateTime || inputValue === '') {
      onChange(parsedDateTime);
    }
  };

  const handleDisplayInputBlur = () => {
    // Ensure the display shows the properly formatted datetime
    if (displayInputRef.current) {
      displayInputRef.current.value = formatDisplayDateTime(value);
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
      displayInputRef.current.value = formatDisplayDateTime(e.target.value);
    }
  };

  return (
    <div className="relative">
      {/* Display input with dd/mm/yyyy hh:mm format */}
      <input
        ref={displayInputRef}
        type="text"
        defaultValue={formatDisplayDateTime(value)}
        onChange={handleDisplayInputChange}
        onBlur={handleDisplayInputBlur}
        className={`w-full p-3 pr-20 border border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none ${className}`}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={16}
      />
      
      {/* Icons */}
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
        <Clock size={14} className="text-gray-400" />
        <button
          type="button"
          onClick={handleCalendarIconClick}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          disabled={disabled}
        >
          <Calendar size={16} />
        </button>
      </div>
      
      {/* Hidden native datetime-local input for picker functionality */}
      <input
        ref={hiddenInputRef}
        type="datetime-local"
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

export default DateTimeInput;