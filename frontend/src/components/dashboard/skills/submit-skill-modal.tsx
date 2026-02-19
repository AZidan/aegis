'use client';

import * as React from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useSubmitPrivateSkill,
  useValidateSkill,
} from '@/lib/hooks/use-private-skills';
import type { ValidationIssue } from '@/lib/api/private-skills';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
// Props
// ---------------------------------------------------------------------------

interface SubmitSkillModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

// ---------------------------------------------------------------------------
// Submit Skill Modal
// ---------------------------------------------------------------------------

export function SubmitSkillModal({
  open,
  onClose,
  onSubmitted,
}: SubmitSkillModalProps) {
  const [name, setName] = React.useState('');
  const [version, setVersion] = React.useState('1.0.0');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<string>(CATEGORIES[0]);
  const [compatibleRoles, setCompatibleRoles] = React.useState('');
  const [sourceCode, setSourceCode] = React.useState('');
  const [allowedDomains, setAllowedDomains] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [validationIssues, setValidationIssues] = React.useState<
    ValidationIssue[]
  >([]);
  const [success, setSuccess] = React.useState(false);

  const submitMutation = useSubmitPrivateSkill();
  const validateMutation = useValidateSkill();

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setName('');
      setVersion('1.0.0');
      setDescription('');
      setCategory(CATEGORIES[0]);
      setCompatibleRoles('');
      setSourceCode('');
      setAllowedDomains('');
      setError(null);
      setValidationIssues([]);
      setSuccess(false);
    }
  }, [open]);

  const handleValidate = () => {
    setError(null);
    setValidationIssues([]);
    validateMutation.mutate(
      { sourceCode, dryRun: true },
      {
        onSuccess: (report) => {
          setValidationIssues(report.issues);
          if (report.valid) {
            setError(null);
          }
        },
        onError: (err) => {
          setError(err.message || 'Validation failed.');
        },
      },
    );
  };

  const handleSubmit = () => {
    if (!name || !version || !description || !sourceCode) {
      setError('Please fill in all required fields.');
      return;
    }

    setError(null);
    const roles = compatibleRoles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    const domains = allowedDomains
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    submitMutation.mutate(
      {
        name,
        version,
        description,
        category,
        compatibleRoles: roles.length > 0 ? roles : ['*'],
        sourceCode,
        permissions: {
          network: { allowedDomains: domains },
          files: { readPaths: [], writePaths: [] },
          env: { required: [], optional: [] },
        },
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            onSubmitted();
            onClose();
          }, 1500);
        },
        onError: (err) => {
          setError(err.message || 'Failed to submit skill.');
        },
      },
    );
  };

  const inputClasses =
    'w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Private Skill</DialogTitle>
          <DialogDescription>
            Submit a new skill for review by your platform admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-custom-skill"
              className={inputClasses}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Kebab-case (e.g. my-custom-skill)
            </p>
          </div>

          {/* Version */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Version <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className={inputClasses}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the skill"
              className={inputClasses}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`${inputClasses} appearance-none cursor-pointer`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Compatible Roles */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Compatible Roles
            </label>
            <input
              type="text"
              value={compatibleRoles}
              onChange={(e) => setCompatibleRoles(e.target.value)}
              placeholder="developer, analyst (comma-separated)"
              className={inputClasses}
            />
          </div>

          {/* Allowed Domains */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Allowed Domains
            </label>
            <input
              type="text"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              placeholder="api.example.com, cdn.example.com"
              className={inputClasses}
            />
          </div>

          {/* Source Code */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Source Code <span className="text-red-500">*</span>
            </label>
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="Paste your skill source code here..."
              rows={8}
              className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors font-mono resize-y"
            />
          </div>

          {/* Validation issues */}
          {validationIssues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
              {validationIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle
                    className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                      issue.severity === 'error'
                        ? 'text-red-500'
                        : 'text-amber-500'
                    }`}
                  />
                  <p className="text-xs text-neutral-700">
                    <span className="font-medium uppercase">
                      [{issue.severity}]
                    </span>{' '}
                    {issue.message}
                    {issue.line ? ` (line ${issue.line})` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700">
                Skill submitted for review.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={!sourceCode || validateMutation.isPending}
          >
            {validateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              'Validate'
            )}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !name ||
              !sourceCode ||
              submitMutation.isPending ||
              success
            }
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
