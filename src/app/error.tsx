"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Não foi possível abrir a biblioteca.</h1>
      <p>Tente carregar novamente.</p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
