export default function LoadingSpinner({ size = 'md', text = 'กำลังโหลด...' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12', xl: 'h-16 w-16' };
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`animate-spin rounded-full border-2 border-steel-600 border-t-blue-500 ${sizes[size]}`} />
      {text && <p className="text-steel-400 text-sm">{text}</p>}
    </div>
  );
}
