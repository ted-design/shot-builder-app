import React from 'react';
import PropTypes from 'prop-types';

/**
 * ProgressBar Component
 *
 * A reusable progress bar component with percentage display.
 * Used to show completion progress (e.g., planning progress for projects).
 *
 * @component
 * @example
 * <ProgressBar
 *   label="Planning progress"
 *   percentage={75}
 *   showPercentage={true}
 * />
 */
const ProgressBar = ({
  label = 'Progress',
  percentage = 0,
  showPercentage = true,
  fillColor = 'bg-emerald-500',
  trackColor = 'bg-slate-200',
  size = 'sm' // 'sm' or 'md'
}) => {
  // Ensure percentage is between 0 and 100
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  const heightClass = size === 'md' ? 'h-3' : 'h-2';

  return (
    <div className="space-y-1">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="font-medium">{Math.round(clampedPercentage)}%</span>
          )}
        </div>
      )}
      <div className={`w-full rounded-full ${trackColor} ${heightClass}`}>
        <div
          className={`${heightClass} rounded-full ${fillColor} transition-all duration-300`}
          style={{ width: `${clampedPercentage}%` }}
          role="progressbar"
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
};

ProgressBar.propTypes = {
  label: PropTypes.string,
  percentage: PropTypes.number.isRequired,
  showPercentage: PropTypes.bool,
  fillColor: PropTypes.string,
  trackColor: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md'])
};

export default ProgressBar;
