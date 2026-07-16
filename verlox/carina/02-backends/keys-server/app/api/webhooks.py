from __future__ import annotations

from typing import Any

import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from app.billing import dispatch_stripe_event
from app.core.config import settings
from app.core.scout_provision import notify_aiva_core_scout_linked, provision_aiva_scout_workspace

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])
legacy_router = APIRouter(prefix="/api/v1/stripe", tags=["webhooks"])


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, str]:
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook not configured")

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload.decode("utf-8"),
            stripe_signature or "",
            settings.stripe_webhook_secret,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if event["type"] == "checkout.session.completed":
        await _handle_checkout_completed(event["data"]["object"])
    await dispatch_stripe_event(event)

    return {"status": "ok"}


@router.post("/stripe/webhook")
async def stripe_webhook_legacy(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, str]:
    return await stripe_webhook(request, stripe_signature)


@legacy_router.post("/webhook")
async def stripe_webhook_legacy_documented(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict[str, str]:
    return await stripe_webhook(request, stripe_signature)


async def _handle_checkout_completed(session: dict[str, Any]) -> None:
    metadata = session.get("metadata") or {}
    product = metadata.get("product")
    if product not in ("carina-aiva", "aiva"):
        return

    workspace_id = metadata.get("workspaceId") or metadata.get("aiva_workspace_id")
    tier = metadata.get("plan") or metadata.get("tier") or "starter"
    email = session.get("customer_email") or metadata.get("account_email")
    if not workspace_id or not email:
        return

    provisioned = await provision_aiva_scout_workspace(
        account_email=str(email),
        aiva_workspace_id=str(workspace_id),
        tier=str(tier),
    )
    if provisioned:
        await notify_aiva_core_scout_linked(
            workspace_id=str(workspace_id),
            tier=str(tier),
            account_email=str(email),
        )
