import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Delete, Equal, Minus, Plus, X, Divide } from 'lucide-react';

interface CalculatorProps {
  onPinEntered: (pin: string) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ onPinEntered }) => {
  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState('');

  const handleNumber = (num: string) => {
    setDisplay((prev) => (prev === '0' ? num : prev + num));
  };

  const handleOperator = (op: string) => {
    setHistory(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setHistory('');
  };

  const handleEqual = () => {
    // Always pass the current display to the parent for PIN checking
    onPinEntered(display);

    try {
      // Basic calculation logic
      const expression = (history + display).replace(/X/g, '*').replace(/÷/g, '/');
      // Using Function constructor for a simple calculator (safe enough for this demo)
      const result = new Function(`return ${expression}`)();
      setDisplay(String(result));
      setHistory('');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const buttons = [
    { label: 'C', action: handleClear, className: 'bg-red-500/20 text-red-500' },
    { label: '÷', action: () => handleOperator('/'), className: 'bg-orange-500/20 text-orange-500' },
    { label: 'X', action: () => handleOperator('*'), className: 'bg-orange-500/20 text-orange-500' },
    { label: '⌫', action: () => setDisplay(d => d.length > 1 ? d.slice(0, -1) : '0'), className: 'bg-gray-500/20 text-gray-400' },
    { label: '7', action: () => handleNumber('7') },
    { label: '8', action: () => handleNumber('8') },
    { label: '9', action: () => handleNumber('9') },
    { label: '-', action: () => handleOperator('-'), className: 'bg-orange-500/20 text-orange-500' },
    { label: '4', action: () => handleNumber('4') },
    { label: '5', action: () => handleNumber('5') },
    { label: '6', action: () => handleNumber('6') },
    { label: '+', action: () => handleOperator('+'), className: 'bg-orange-500/20 text-orange-500' },
    { label: '1', action: () => handleNumber('1') },
    { label: '2', action: () => handleNumber('2') },
    { label: '3', action: () => handleNumber('3') },
    { label: '=', action: handleEqual, className: 'bg-orange-500 text-white row-span-2' },
    { label: '0', action: () => handleNumber('0'), className: 'col-span-2' },
    { label: '.', action: () => handleNumber('.') },
  ];

  return (
    <div className="flex flex-col h-full bg-black text-white p-6 max-w-md mx-auto rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
      <div className="flex-1 flex flex-col justify-end items-end p-4 mb-4">
        <div className="text-gray-500 text-xl font-mono mb-2">{history}</div>
        <div className="text-6xl font-light tracking-tighter overflow-hidden text-ellipsis w-full text-right">
          {display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {buttons.map((btn, idx) => (
          <motion.button
            key={idx}
            whileTap={{ scale: 0.95 }}
            onClick={btn.action}
            className={`
              h-16 flex items-center justify-center rounded-2xl text-2xl font-medium transition-colors
              ${btn.className || 'bg-zinc-900 hover:bg-zinc-800 text-white'}
            `}
          >
            {btn.label}
          </motion.button>
        ))}
      </div>
      
      <div className="mt-8 text-center text-zinc-700 text-xs uppercase tracking-widest font-mono">
        Smart Calculator
      </div>
    </div>
  );
};
