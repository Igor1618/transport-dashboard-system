import React from 'react';
import { Calendar } from 'lucide-react';

interface MonthYearPickerProps {
  value: string; // формат "YYYY-MM"
  onChange: (value: string) => void;
  className?: string;
}

const MonthYearPicker: React.FC<MonthYearPickerProps> = ({ value, onChange, className = '' }) => {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // от -2 до +2 лет

  const [year, month] = value.split('-').map(Number);

  const handleMonthChange = (newMonth: number) => {
    const monthStr = String(newMonth).padStart(2, '0');
    onChange(`${year}-${monthStr}`);
  };

  const handleYearChange = (newYear: number) => {
    const monthStr = String(month).padStart(2, '0');
    onChange(`${newYear}-${monthStr}`);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Calendar className="text-gray-600" size={20} />

      {/* Селектор месяца */}
      <select
        value={month}
        onChange={(e) => handleMonthChange(Number(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer text-sm md:text-base"
      >
        {months.map((monthName, index) => (
          <option key={index + 1} value={index + 1}>
            {monthName}
          </option>
        ))}
      </select>

      {/* Селектор года */}
      <select
        value={year}
        onChange={(e) => handleYearChange(Number(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer text-sm md:text-base"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
};

export default MonthYearPicker;
