import React from 'react';

export const Tabs = ({ value, onChange, options }) => {
  const spacing = (1 / options.length) * 100;
  const slideStyle = {
    left: `${value * spacing}%`,
    width: `${spacing}%`,
  };

  return (
    <div className="flex justify-center mb-8 relative">
      <div
        className="absolute bottom-0 h-1 rounded bg-sky-600 transition-all z-10"
        style={slideStyle}
      ></div>
      {options.map((option, index) => (
        <button
          className="flex-1 border-b-4 border-b-zinc-300 dark:border-b-zinc-700 hover:opacity-75 transition-opacity px-4 py-2 text-center"
          onClick={() => onChange(index)}
          key={option}
        >
          {option}
        </button>
      ))}
    </div>
  );
};
