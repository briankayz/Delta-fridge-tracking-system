import React, { useRef, useState } from 'react';
import { CircleCheck, Download, FileUp, TriangleAlert, Upload } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { AssetRegister } from '../components/AssetRegister';
import { Button, Card, CardHeader } from '../components/ui';
import { api, ImportResult } from '../services/api';
import { useAuth } from '../services/auth';
import { matches, PageProps } from './shared';

/** Cooler register: the list of every cooler Delta owns, imported from the asset system. */
export const RegisterPage: React.FC<PageProps> = ({ feed, search, inspect }) => {
  const { can } = useAuth();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    setBusy(true);
    const ok = await feed.run('Check file', async () => setPreview(await api.importRegister(text, true)));
    if (!ok) setPreview(null);
    setBusy(false);
  };

  const commit = async () => {
    if (!csv) return;
    setBusy(true);
    await feed.run('Import', async () => {
      const r = await api.importRegister(csv, false);
      setResult(r);
      setPreview(null);
      setCsv(null);
    }, 'Cooler register updated.');
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Assets"
        title="Cooler register"
        description="Every Delta cooler, the store it belongs to and its geofence. Import updates from your asset system as CSV."
        actions={
          <a href={api.registerTemplateUrl}>
            <Button icon={Download}>CSV template</Button>
          </a>
        }
      />

      {can('register:import') && (
        <Card>
          <CardHeader title="Import or update coolers" icon={FileUp} subtitle="Required columns: device_id, retailer_name, lat, lng. Existing coolers are updated, never duplicated." />
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  void pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button icon={Upload} onClick={() => fileRef.current?.click()} disabled={busy}>
                Choose CSV file
              </Button>
              {fileName && <span className="text-sm text-slate-600">{fileName}</span>}
            </div>

            {preview && (
              <div className="rounded-md bg-slate-50 p-4 ring-1 ring-inset ring-line space-y-3">
                <div className="text-sm text-slate-800">
                  <span className="font-medium">{preview.rows}</span> rows checked ·{' '}
                  <span className="font-medium text-emerald-700">{preview.rows - preview.errors.length} ready</span>
                  {preview.errors.length > 0 && (
                    <>
                      {' '}
                      · <span className="font-medium text-red-700">{preview.errors.length} with problems</span> (skipped)
                    </>
                  )}
                </div>
                {preview.errors.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-red-700">
                    {preview.errors.slice(0, 50).map((e) => (
                      <li key={e.row} className="flex gap-2">
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => void commit()} disabled={busy || preview.rows === preview.errors.length}>
                    Import {preview.rows - preview.errors.length} coolers
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPreview(null);
                      setCsv(null);
                      setFileName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {result && (
              <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
                <CircleCheck className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                {result.assets_created} coolers added, {result.assets_updated} updated across {result.retailers_upserted} stores.
                {result.errors.length > 0 && ` ${result.errors.length} rows skipped.`}
              </div>
            )}
          </div>
        </Card>
      )}

      <AssetRegister fleet={feed.fleet.filter((c) => matches(c, search))} onSelectCooler={(c) => inspect(c.id)} flashingRowId={feed.flashingRowId} />
    </div>
  );
};
