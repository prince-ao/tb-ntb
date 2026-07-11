"""Typed failures. A run raises one of these and publishes nothing (PIPE-QUAL-006);
coverage *drops* are not errors — they are recorded in the run report (PIPE-OBS-002)."""


class PipelineError(Exception):
    """Base for any failure that must stop the run with a non-zero exit."""


class ConfigError(PipelineError):
    """Config preflight failed (bad schema_version, unknown kind, missing file, out-of-bound
    committed value). @spec PIPE-PROC-007"""


class DataQualityError(PipelineError):
    """A structural or plausibility gate failed. @spec PIPE-QUAL-001, PIPE-QUAL-003"""


class SlugCollisionError(DataQualityError):
    """Two metros derived the same slug. @spec PIPE-QUAL-004"""


class SchemaValidationError(PipelineError):
    """The assembled object failed schema validation. @spec PIPE-PROC-004"""
