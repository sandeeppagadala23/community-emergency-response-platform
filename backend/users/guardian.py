"""
Guardian access helpers.

A guardian is a user whose UserProfile role is 'guardian'. A guardian is
linked to a resident when the resident has a GuardianContact row that is
verified by an administrator and whose email matches the guardian's account
email. This is the same matching rule used by
emergency_alerts.notification_service.notify_sos_recipients, so a guardian
sees exactly the residents who would notify them.

Every query here is scoped to the requesting guardian. No view takes a
resident id from the URL, so a guardian cannot reach unrelated residents.
"""

from emergency_alerts.models import SOSAlert, SOSNotification
from emergency_contacts.models import GuardianContact
from users.models import UserProfile


# Alert statuses that still need attention. RESOLVED and CANCELLED are closed.
ACTIVE_ALERT_STATUSES = ["PENDING", "ACKNOWLEDGED", "IN_PROGRESS"]

NOTIFICATION_LIMIT = 50


def get_user_profile(user):
    """Return the user's UserProfile, or None if it does not exist."""
    try:
        return user.profile
    except UserProfile.DoesNotExist:
        return None


def is_guardian(user):
    profile = get_user_profile(user)
    return profile is not None and getattr(profile, "role", "").lower() == "guardian"


def get_verified_guardian_links(user):
    """
    Return the verified GuardianContact rows that link this guardian
    account to a resident. Returns an empty queryset when the account has
    no email, because an empty email must never match a contact.
    """
    if not user or not user.email:
        return GuardianContact.objects.none()

    clean_email = user.email.strip().lower()
    if not clean_email:
        return GuardianContact.objects.none()

    links = (
        GuardianContact.objects.filter(
            is_verified=True,
            email__iexact=clean_email,
            resident__is_active=True,
        )
        .exclude(email="")
        .exclude(resident=user)
        .select_related("resident")
        .order_by("resident__username", "id")
    )
    if links.exists():
        return links

    all_verified = (
        GuardianContact.objects.filter(
            is_verified=True,
            resident__is_active=True,
        )
        .exclude(email="")
        .exclude(resident=user)
        .select_related("resident")
    )
    matching_ids = [
        c.id for c in all_verified
        if (c.email or "").strip().lower() == clean_email
    ]
    return (
        GuardianContact.objects.filter(id__in=matching_ids)
        .select_related("resident")
        .order_by("resident__username", "id")
    )


def get_linked_resident_ids(user):
    return list(
        get_verified_guardian_links(user)
        .values_list("resident_id", flat=True)
        .distinct()
    )


def get_active_alerts_for_guardian(user):
    resident_ids = get_linked_resident_ids(user)

    if not resident_ids:
        return SOSAlert.objects.none()

    return (
        SOSAlert.objects.filter(
            reporter_id__in=resident_ids,
            status__in=ACTIVE_ALERT_STATUSES,
        )
        .select_related("reporter")
        .order_by("-created_at")
    )


def get_guardian_notifications(user):
    return (
        SOSNotification.objects.filter(
            recipient=user,
            channel="IN_APP",
        )
        .select_related("alert")
        .order_by("-created_at")[:NOTIFICATION_LIMIT]
    )


def get_unread_notification_count(user):
    return (
        SOSNotification.objects.filter(
            recipient=user,
            channel="IN_APP",
        )
        .exclude(status="READ")
        .count()
    )
