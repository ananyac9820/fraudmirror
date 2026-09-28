import { useAppSelector } from '../store';

export default function Dashboard() {
  const user = useAppSelector((s) => s.auth.user);
  return (
    <div className="panel p-6">
      <div className="panel-title">Dashboard</div>
      <h1 className="mt-2 text-2xl font-semibold text-white">Welcome, {user?.name}</h1>
      <p className="mt-2 text-slate-400">Signed in as {user?.role}. The live transaction stream is starting up.</p>
    </div>
  );
}
