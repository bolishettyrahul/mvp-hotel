import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary: 'bg-orange-600 hover:bg-orange-700 text-white shadow-soft hover:shadow-elegant active:scale-[0.98]',
  secondary: 'bg-white border border-stone-200 hover:bg-stone-50 text-stone-900 shadow-sm active:scale-[0.98]',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-soft hover:shadow-elegant active:scale-[0.98]',
  ghost: 'hover:bg-stone-100 text-stone-700 active:scale-[0.98]',
};

const sizes = {
  sm: 'px-3 py-2 text-sm min-h-[44px] rounded-lg',
  md: 'px-6 py-2.5 text-base font-semibold min-h-[48px] rounded-xl',
  lg: 'px-8 py-4 text-lg font-bold min-h-[56px] rounded-2xl w-full',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium
        cursor-pointer transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 
        focus-visible:ring-offset-2 focus-visible:ring-orange-500
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin motion-reduce:animate-none -ml-1 mr-2 h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
