import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export default function Card({
  children,
  className = '',
  hover = false,
  size = 'md',
  onClick,
  style
}: CardProps) {
  const sizeClass = size === 'sm' ? 'card-sm' : size === 'lg' ? 'card-lg' : '';
  const hoverClass = hover ? 'cursor-pointer' : '';
  const clickableClass = onClick ? 'cursor-pointer' : '';

  return (
    <div
      className={`card ${sizeClass} ${hoverClass} ${clickableClass} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
