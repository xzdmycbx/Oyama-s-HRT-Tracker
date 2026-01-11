import React, { useState, useRef, useEffect } from 'react';

interface PINInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

const PINInput: React.FC<PINInputProps> = ({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
  autoFocus = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleChange = (index: number, newValue: string) => {
    if (disabled) return;

    // Only allow digits
    const digit = newValue.replace(/\D/g, '').slice(-1);

    const newPIN = value.split('');
    newPIN[index] = digit;

    const updatedPIN = newPIN.join('').slice(0, length);
    onChange(updatedPIN);

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      const newPIN = value.split('');

      if (value[index]) {
        // Clear current digit
        newPIN[index] = '';
        onChange(newPIN.join(''));
      } else if (index > 0) {
        // Move to previous and clear
        newPIN[index - 1] = '';
        onChange(newPIN.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled) return;

    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pastedData);

    // Focus the next empty input or last input
    const nextIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleClick = (index: number) => {
    if (disabled) return;
    setFocusedIndex(index);
    inputRefs.current[index]?.focus();
  };

  return (
    <div className="flex gap-2.5 sm:gap-3 justify-center">
      {Array.from({ length }).map((_, index) => {
        const hasValue = !!value[index];
        const isFocused = focusedIndex === index;

        return (
          <div key={index} className="relative">
            <input
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value[index] || ''}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              onClick={() => handleClick(index)}
              disabled={disabled}
              className={`
                w-11 h-14 sm:w-12 sm:h-16
                text-center text-2xl sm:text-3xl font-medium
                rounded-xl
                transition-all duration-200 ease-out
                outline-none
                ${
                  error
                    ? 'bg-red-500/10 border-2 border-red-500/50 text-red-400'
                    : isFocused
                    ? 'bg-pink-500/10 border-2 border-pink-500/60 text-white shadow-lg shadow-pink-500/20'
                    : hasValue
                    ? 'bg-white/5 border-2 border-white/20 text-white'
                    : 'bg-white/5 border-2 border-white/10 text-white/80'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-text'}
                ${hasValue && !isFocused ? 'text-transparent' : ''}
                backdrop-blur-sm
              `}
              style={{
                caretColor: 'transparent',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              }}
            />
            {/* Show dot when has value and not focused - Apple style */}
            {hasValue && !isFocused && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                    error ? 'bg-red-400' : 'bg-white'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PINInput;
