export default function LoadingSpinner({ size = 'md', text }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12', xl: 'h-16 w-16' };
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`animate-spin rounded-full border-2 border-red-100 border-t-red-600 ${sizes[size]}`} />
      {text && <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>{text}</p>}
    </div>
  );
}
