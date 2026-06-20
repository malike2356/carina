from typing import Any, Dict, Literal, Optional, TypedDict

Severity = Literal['info', 'warning', 'critical', 'breach']


class ReportEventOptions(TypedDict, total=False):
    severity: Severity
    event_type: str
    description: str
    metadata: Dict[str, Any]
    session_id: str


class ReportToolCallOptions(TypedDict, total=False):
    tool_name: str
    params: Dict[str, Any]
    result: Any
    duration_ms: int
    session_id: str


class StatusResponse(TypedDict):
    suspended: bool
    reason: Optional[str]
