export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-bbc-red border-r-transparent" />
        <p className="mt-4 text-sm text-bbc-gray">Kraunamos naujienos…</p>
      </div>
    </div>
  );
}
