const fs = require('fs');
const file = 'src/app/[locale]/dashboard/district/page.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('useDistrictReferrals')) {
  code = code.replace(
    "import { useParams } from 'next/navigation';",
    "import { useParams } from 'next/navigation';\nimport { useAuthClaims } from '@/hooks/useAuthClaims';\nimport { useDistrictReferrals } from '@/hooks/useDistrictReferrals';"
  );
}

code = code.replace(
  "const [liveReferrals, setLiveReferrals] = useState<any[]>([]);\n  const [facilities, setFacilities] = useState<any[]>([]);\n  const [loading, setLoading] = useState(true);",
  "const { claims } = useAuthClaims();\n  const { referrals: liveReferrals, loading } = useDistrictReferrals(claims?.facilityId);\n  const facilities: any[] = [];"
);

code = code.replace(/\/\/ ─── Live Data Fetching ───[\s\S]*?return \(\) => unsub\(\);\n  \}, \[\]\);/g, "// Data fetched via useDistrictReferrals hook");

code = code.replace(
  /const TIER_COLORS: Record<string, string> = {[\s\S]*?};/g,
  `const TIER_COLORS: Record<string, string> = {
  'critical': 'bg-red-900/50 text-red-200 border-red-800',
  'high': 'bg-orange-900/50 text-orange-200 border-orange-800',
  'routine': 'bg-slate-800 text-slate-300 border-slate-700',
};`
);

code = code.replace(
  /const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {[\s\S]*?};/g,
  `const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  'pending': { label: 'In Transit / Pending', icon: ArrowUpRight, color: 'text-blue-400' },
  'acknowledged': { label: 'Acknowledged', icon: Clock, color: 'text-amber-400' },
  'in_transit': { label: 'In Transit', icon: ArrowUpRight, color: 'text-blue-400' },
  'admitted': { label: 'Admitted', icon: CheckCircle2, color: 'text-emerald-400' },
  'completed': { label: 'Closed / Treated', icon: CheckCircle2, color: 'text-emerald-400' },
  'cancelled': { label: 'Cancelled', icon: AlertOctagon, color: 'text-red-400' },
};`
);

code = code.replace('bg-slate-50 border-b border-border', 'bg-slate-900 border-b border-slate-800');
code = code.replace('text-xs text-muted-foreground uppercase bg-slate-900', 'text-xs text-slate-300 uppercase bg-slate-900');
code = code.replace('divide-slate-200', 'divide-slate-800');

code = code.replace('hover:bg-slate-50/80', 'hover:bg-slate-800/50');
code = code.replace('bg-red-50/50', 'bg-red-900/20');

code = code.replace(/text-muted-foreground/g, 'text-slate-300');
code = code.replace(/<div className="font-medium text-slate-300">/g, '<div className="font-medium text-slate-100">');

code = code.replace(/ref\.fbId/g, 'ref.id');
code = code.replace(/ref\.isBreached/g, 'ref.slaBreached');
code = code.replace(/ref\.tier/g, 'ref.urgency');
code = code.replace(/ref\.target_facility/g, 'ref.facilityId');
code = code.replace(/ref\.status !== 'CLOSED'/g, "ref.status !== 'completed'");
code = code.replace(/STATUS_CONFIG\['CREATED'\]/g, "STATUS_CONFIG['pending']");

fs.writeFileSync(file, code);
console.log('Done rewriting');
