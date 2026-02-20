'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
  PenLine,
  Github,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useUploadMarketplacePackage,
  useImportMarketplaceSkill,
  useFetchGitHubSkills,
} from '@/lib/hooks/use-skill-packages';
import type {
  PackageValidationResult,
  PackageValidationIssue,
  PackageFileInfo,
  ImportMarketplaceSkillPayload,
  DiscoveredGitHubSkill,
} from '@/lib/api/skill-packages';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportSkillModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = 'zip' | 'manual' | 'github';

const CATEGORIES = [
  'productivity',
  'communication',
  'analytics',
  'engineering',
  'security',
  'integration',
  'custom',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function issueSeverityIcon(severity: string) {
  switch (severity) {
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Info className="h-3.5 w-3.5 text-blue-500" />;
  }
}

function issueSeverityBg(severity: string): string {
  switch (severity) {
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    default:
      return 'bg-blue-50 border-blue-200';
  }
}

// ---------------------------------------------------------------------------
// Validation Report (reused from upload-skill-modal pattern)
// ---------------------------------------------------------------------------

function ValidationReport({ result }: { result: PackageValidationResult }) {
  const errors = result.issues.filter(
    (i: PackageValidationIssue) => i.severity === 'error',
  );
  const warnings = result.issues.filter(
    (i: PackageValidationIssue) => i.severity === 'warning',
  );
  const infos = result.issues.filter(
    (i: PackageValidationIssue) => i.severity === 'info',
  );

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
          result.valid
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}
      >
        {result.valid ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <div>
          <p
            className={`text-sm font-medium ${result.valid ? 'text-green-700' : 'text-red-700'}`}
          >
            {result.valid ? 'Package is valid' : 'Package has errors'}
          </p>
          <p className="text-xs text-neutral-500">
            {errors.length} error{errors.length !== 1 ? 's' : ''},{' '}
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''},{' '}
            {infos.length} info
          </p>
        </div>
      </div>

      {result.manifest && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Manifest
          </p>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
            <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-neutral-700">
              {JSON.stringify(result.manifest, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {result.files.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Files ({result.files.length})
          </p>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
            {result.files.map((file: PackageFileInfo) => (
              <div
                key={file.path}
                className="flex items-center justify-between border-b border-neutral-100 px-3 py-1.5 last:border-0"
              >
                <span className="font-mono text-xs text-neutral-600">
                  {file.path}
                </span>
                <span className="text-xs text-neutral-400">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.issues.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Issues
          </p>
          <div className="space-y-1.5">
            {result.issues.map((issue: PackageValidationIssue, idx: number) => (
              <div
                key={idx}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${issueSeverityBg(issue.severity)}`}
              >
                <span className="mt-0.5">
                  {issueSeverityIcon(issue.severity)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-700">{issue.message}</p>
                  {issue.file && (
                    <p className="mt-0.5 font-mono text-xs text-neutral-400">
                      {issue.file}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZIP Upload Tab
// ---------------------------------------------------------------------------

function ZipUploadTab({ onSuccess }: { onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] =
    useState<PackageValidationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useUploadMarketplacePackage();
  const importMutation = useImportMarketplaceSkill();

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setUploadResult(null);
    setIsDragging(false);
    uploadMutation.reset();
    importMutation.reset();
  }, [uploadMutation, importMutation]);

  const handleFileSelect = useCallback(
    (file: File) => {
      setSelectedFile(file);
      setUploadResult(null);
      importMutation.reset();
      uploadMutation.mutate(file, {
        onSuccess: (result) => setUploadResult(result),
      });
    },
    [uploadMutation, importMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleImport = useCallback(() => {
    if (!uploadResult?.valid || !uploadResult.manifest) return;
    const manifest = uploadResult.manifest as {
      name: string;
      version: string;
      description: string;
      category: string;
      compatibleRoles: string[];
      permissions: ImportMarketplaceSkillPayload['permissions'];
    };

    importMutation.mutate(
      {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        category: manifest.category,
        compatibleRoles: manifest.compatibleRoles,
        sourceCode: uploadResult.skillMd?.rawContent ?? '',
        permissions: manifest.permissions,
        documentation: uploadResult.skillMd?.description,
        packageId: uploadResult.packageId,
      },
      {
        onSuccess: () => {
          resetState();
          onSuccess();
        },
      },
    );
  }, [uploadResult, importMutation, resetState, onSuccess]);

  const canImport =
    uploadResult?.valid && uploadResult.manifest && !importMutation.isPending;

  return (
    <div className="space-y-4">
      {!selectedFile ? (
        <div
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
            isDragging
              ? 'border-primary-400 bg-primary-50'
              : 'border-neutral-300 bg-neutral-50/50 hover:border-neutral-400 hover:bg-neutral-50'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <Upload className="mb-3 h-8 w-8 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-600">
            Drop your skill package here
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            or click to browse — accepts .zip and .skill files
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.skill"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <FileArchive className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-sm font-medium text-neutral-700">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-neutral-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              onClick={resetState}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {uploadMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
              <p className="text-sm text-neutral-500">
                Uploading and validating package...
              </p>
            </div>
          )}

          {uploadMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">
                Upload failed. The file may be corrupted or in an unsupported
                format.
              </p>
            </div>
          )}

          {uploadResult && <ValidationReport result={uploadResult} />}

          {importMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-700">
                Import failed. Please try again.
              </p>
            </div>
          )}
        </>
      )}

      {selectedFile && uploadResult && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!canImport}
            onClick={handleImport}
          >
            {importMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import to Marketplace
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Entry Tab
// ---------------------------------------------------------------------------

const EMPTY_FORM: ImportMarketplaceSkillPayload = {
  name: '',
  version: '',
  description: '',
  category: 'custom',
  compatibleRoles: [],
  sourceCode: '',
  permissions: {
    network: { allowedDomains: [] },
    files: { readPaths: [], writePaths: [] },
    env: { required: [], optional: [] },
  },
  documentation: '',
};

function ManualEntryTab({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<ImportMarketplaceSkillPayload>({
    ...EMPTY_FORM,
  });
  const [rolesInput, setRolesInput] = useState('');
  const [domainsInput, setDomainsInput] = useState('');

  const importMutation = useImportMarketplaceSkill();

  const handleSubmit = useCallback(() => {
    const payload: ImportMarketplaceSkillPayload = {
      ...form,
      compatibleRoles: rolesInput
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
      permissions: {
        ...form.permissions,
        network: {
          allowedDomains: domainsInput
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
        },
      },
    };

    importMutation.mutate(payload, {
      onSuccess: () => {
        setForm({ ...EMPTY_FORM });
        setRolesInput('');
        setDomainsInput('');
        onSuccess();
      },
    });
  }, [form, rolesInput, domainsInput, importMutation, onSuccess]);

  const canSubmit =
    form.name.length >= 3 &&
    form.version &&
    form.description.length >= 10 &&
    form.sourceCode.length >= 1 &&
    rolesInput.trim().length > 0 &&
    !importMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">
            Name (kebab-case)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="my-skill-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">
            Version (semver)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="1.0.0"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-neutral-600">
          Description (10-500 chars)
        </label>
        <textarea
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          rows={2}
          placeholder="A brief description of what this skill does..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">
            Category
          </label>
          <select
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">
            Compatible Roles (comma-separated)
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="developer, analyst"
            value={rolesInput}
            onChange={(e) => setRolesInput(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-neutral-600">
          Source Code (SKILL.md content)
        </label>
        <textarea
          className="w-full rounded-lg border border-neutral-300 bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          rows={6}
          placeholder="# My Skill&#10;&#10;Instructions for the skill..."
          value={form.sourceCode}
          onChange={(e) => setForm({ ...form, sourceCode: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-neutral-600">
          Allowed Domains (comma-separated, optional)
        </label>
        <input
          type="text"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder="api.example.com, *.github.com"
          value={domainsInput}
          onChange={(e) => setDomainsInput(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-neutral-600">
          Documentation (optional)
        </label>
        <textarea
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          rows={3}
          placeholder="Additional documentation for this skill..."
          value={form.documentation}
          onChange={(e) =>
            setForm({ ...form, documentation: e.target.value })
          }
        />
      </div>

      {importMutation.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            Import failed. Please check your inputs and try again.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
          {importMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Import to Marketplace
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GitHub URL Tab
// ---------------------------------------------------------------------------

function GitHubUrlTab({ onSuccess }: { onSuccess: () => void }) {
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importedCount, setImportedCount] = useState(0);

  const fetchMutation = useFetchGitHubSkills();
  const importMutation = useImportMarketplaceSkill();

  const handleFetch = useCallback(() => {
    if (!url.trim()) return;
    setSelected(new Set());
    setImportedCount(0);
    fetchMutation.mutate(url.trim());
  }, [url, fetchMutation]);

  const toggleSkill = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const skills = fetchMutation.data?.skills ?? [];
    setSelected((prev) =>
      prev.size === skills.length
        ? new Set()
        : new Set(skills.map((_, i) => i)),
    );
  }, [fetchMutation.data]);

  const handleImportSelected = useCallback(async () => {
    const skills = fetchMutation.data?.skills;
    if (!skills) return;

    let count = 0;
    for (const idx of Array.from(selected).sort()) {
      const skill = skills[idx];
      if (!skill) continue;
      try {
        // Bundle companion files (scripts, configs) into sourceCode so they're reviewed
        let fullSourceCode = skill.sourceCode;
        if (skill.companionFiles && skill.companionFiles.length > 0) {
          const companionSection = skill.companionFiles
            .map((f) => `\n---\n## File: ${f.relativePath}\n\`\`\`\n${f.content}\n\`\`\``)
            .join('\n');
          fullSourceCode += `\n\n# Companion Files\n${companionSection}`;
        }

        await importMutation.mutateAsync({
          name: skill.name,
          version: skill.version,
          description: skill.description,
          category: skill.category as ImportMarketplaceSkillPayload['category'],
          compatibleRoles: skill.compatibleRoles,
          sourceCode: fullSourceCode,
          permissions: skill.permissions,
          documentation: skill.documentation,
        });
        count++;
      } catch {
        // Continue importing remaining skills
      }
    }

    setImportedCount(count);
    if (count > 0) {
      onSuccess();
    }
  }, [fetchMutation.data, selected, importMutation, onSuccess]);

  const skills = fetchMutation.data?.skills ?? [];

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-neutral-600">
          GitHub Repository URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetch();
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!url.trim() || fetchMutation.isPending}
            onClick={handleFetch}
          >
            {fetchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Fetch
          </Button>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          Supports full URLs, tree URLs with branch/path, e.g.
          github.com/owner/repo/tree/main/skills/my-skill
        </p>
      </div>

      {/* Loading */}
      {fetchMutation.isPending && (
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">
            Cloning repository and discovering skills...
          </p>
          <p className="text-xs text-neutral-400">This may take 5-15 seconds</p>
        </div>
      )}

      {/* Error */}
      {fetchMutation.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">
            {fetchMutation.error?.message || 'Failed to fetch skills from repository'}
          </p>
        </div>
      )}

      {/* Results */}
      {fetchMutation.isSuccess && skills.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Discovered Skills ({skills.length})
            </p>
            <button
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
              onClick={toggleAll}
            >
              {selected.size === skills.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {skills.map((skill: DiscoveredGitHubSkill, idx: number) => (
              <label
                key={`${skill.name}-${idx}`}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  selected.has(idx)
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-neutral-200 bg-white hover:border-neutral-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(idx)}
                  onChange={() => toggleSkill(idx)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800">
                    {skill.name}
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      v{skill.version}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                    {skill.description}
                  </p>
                  <p className="mt-1 font-mono text-xs text-neutral-400">
                    {skill.skillPath}
                  </p>
                  {skill.companionFiles && skill.companionFiles.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {skill.companionFiles.map((f) => (
                        <span
                          key={f.relativePath}
                          className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-500"
                        >
                          {f.relativePath}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Import button */}
          <div className="flex items-center justify-between">
            {importedCount > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {importedCount} skill{importedCount !== 1 ? 's' : ''} imported
              </div>
            )}
            {importMutation.isError && (
              <p className="text-xs text-red-600">
                Some imports failed. Check the review queue.
              </p>
            )}
            <div className="ml-auto">
              <Button
                size="sm"
                disabled={selected.size === 0 || importMutation.isPending}
                onClick={handleImportSelected}
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import Selected ({selected.size})
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export function ImportSkillModal({ open, onClose }: ImportSkillModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('github');

  const handleClose = useCallback(() => {
    setActiveTab('github');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-neutral-900">
            Import Skill to Marketplace
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Add a new skill to the global marketplace for all tenants
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-b border-neutral-200 px-6">
          <nav className="-mb-px flex gap-1" aria-label="Import tabs">
            <button
              onClick={() => setActiveTab('github')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'github'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
              }`}
            >
              <Github className="h-4 w-4" />
              GitHub URL
            </button>
            <button
              onClick={() => setActiveTab('zip')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'zip'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
              }`}
            >
              <FileArchive className="h-4 w-4" />
              ZIP Upload
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
              }`}
            >
              <PenLine className="h-4 w-4" />
              Manual Entry
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'zip' ? (
            <ZipUploadTab onSuccess={handleClose} />
          ) : activeTab === 'manual' ? (
            <ManualEntryTab onSuccess={handleClose} />
          ) : (
            <GitHubUrlTab onSuccess={handleClose} />
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-neutral-200 px-6 py-4">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
