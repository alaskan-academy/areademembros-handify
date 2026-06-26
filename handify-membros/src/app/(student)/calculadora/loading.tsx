export default function CalculadoraLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse space-y-4">
      <div className="h-6 w-48 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-full bg-gray-200 rounded-lg mt-2" />
      </div>
    </div>
  );
}
