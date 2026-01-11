import React from 'react';
import { Delete } from 'lucide-react';

interface NumericKeypadProps {
  onNumberPress: (num: number) => void;
  onDelete: () => void;
  disabled?: boolean;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({ onNumberPress, onDelete, disabled = false }) => {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'delete'] as const;

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-[280px] sm:max-w-xs mx-auto px-2 sm:px-0">
      {numbers.map((item, index) => {
        if (item === null) {
          // Empty space
          return <div key={index} />;
        }

        if (item === 'delete') {
          return (
            <button
              key={index}
              onClick={onDelete}
              disabled={disabled}
              className="
                w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20
                rounded-full
                flex items-center justify-center
                bg-white/10
                hover:bg-white/20
                active:bg-white/30
                transition-all duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
                backdrop-blur-sm
                border border-white/10
                touch-manipulation
              "
              aria-label="Delete"
            >
              <Delete size={20} className="sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
            </button>
          );
        }

        return (
          <button
            key={index}
            onClick={() => onNumberPress(item)}
            disabled={disabled}
            className="
              w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20
              rounded-full
              flex items-center justify-center
              text-2xl sm:text-3xl md:text-4xl font-light text-white
              bg-white/10
              hover:bg-white/20
              active:bg-white/30
              transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed
              backdrop-blur-sm
              border border-white/10
              touch-manipulation
            "
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
};

export default NumericKeypad;
