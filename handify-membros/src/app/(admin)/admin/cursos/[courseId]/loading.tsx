export default function AdminCursoDetalheLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-5 w-24 bg-gray-200 rounded" />
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-28 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-28 bg-gray-200 rounded-lg" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 w-full bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
