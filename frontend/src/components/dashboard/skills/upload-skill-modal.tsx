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
  useUploadSkillPackage,
  useSubmitSkillPackage,
} from '@/lib/hooks/use-skill-packages';
import type {
  PackageValidationResult,
  PackageValidationIssue,
  PackageFileInfo,
} from '@/lib/api/skill-packages';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UploadSkillModalProps {
  open: boolean;
  onClose: () => void;
}

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
// Subcomponents
// ---------------------------------------------------------------------------

function ValidationReport({
  result,
}: {
  result: PackageValidationResult;
}) {
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
      {/* Validation Status Header */}
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

      {/* Manifest Details */}
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

      {/* SKILL.md Preview */}
      {result.skillMd && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            SKILL.md
          </p>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
            <p className="text-sm font-medium text-neutral-800">
              {result.skillMd.title}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {result.skillMd.description}
            </p>
          </div>
        </div>
      )}

      {/* Files */}
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

      {/* Issues */}
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
// Main Component
// ---------------------------------------------------------------------------

export function UploadSkillModal({ open, onClose }: UploadSkillModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] =
    useState<PackageValidationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useUploadSkillPackage();
  const submitMutation = useSubmitSkillPackage();

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setUploadResult(null);
    setIsDragging(false);
    uploadMutation.reset();
    submitMutation.reset();
  }, [uploadMutation, submitMutation]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleFileSelect = useCallback(
    (file: File) => {
      setSelectedFile(file);
      setUploadResult(null);
      submitMutation.reset();

      // Upload validates + stores the ZIP on the server
      uploadMutation.mutate(file, {
        onSuccess: (result) => setUploadResult(result),
      });
    },
    [uploadMutation, submitMutation],
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleSubmitForReview = useCallback(() => {
    if (!uploadResult?.valid || !uploadResult.packageId) return;
    submitMutation.mutate(uploadResult, {
      onSuccess: () => {
        handleClose();
      },
    });
  }, [uploadResult, submitMutation, handleClose]);

  const canSubmit =
    uploadResult?.valid &&
    uploadResult.packageId &&
    !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-neutral-900">
            Upload Skill Package
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Upload a .zip or .skill package for validation and submission
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {/* Dropzone */}
          {!selectedFile ? (
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-colors ${
                isDragging
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-neutral-300 bg-neutral-50/50 hover:border-neutral-400 hover:bg-neutral-50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
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
                onChange={handleInputChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Info */}
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
                  onClick={() => {
                    resetState();
                  }}
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Uploading/Validating State */}
              {uploadMutation.isPending && (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                  <p className="text-sm text-neutral-500">
                    Uploading and validating package...
                  </p>
                </div>
              )}

              {/* Upload Error */}
              {uploadMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <p className="text-sm text-red-700">
                    Upload failed. The file may be corrupted or in an
                    unsupported format.
                  </p>
                </div>
              )}

              {/* Validation Result */}
              {uploadResult && <ValidationReport result={uploadResult} />}

              {/* Submit Error */}
              {submitMutation.isError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <p className="text-sm text-red-700">
                    Submission failed. Please try again.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-neutral-200 px-6 py-4">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={handleSubmitForReview}
          >
            {submitMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Submit for Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
