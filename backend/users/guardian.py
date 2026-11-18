"""
Guardian access helpers.

A guardian is a user whose UserProfile role is 'guardian'. A guardian is
linked to a resident when the resident has a GuardianContact row that is
verified by an administrator and whose email or phone number matches the
guardian's account credentials. This is the same matching rule used by
emergency_alerts.notification_service.notify_sos_recipients, so a guardian
sees exactly the residents who would notify them.

Every query here is scoped to the requesting guardian. No view takes a
resident id from the URL, so a guardian cannot reach unrelated residents.
"""

import re

from emergency_alerts.models import SOSAlert, SOSNotification
from emergency_contacts.models import GuardianContact
from users.models import UserProfile


# Alert statuses that still need attention. RESOLVED and CANCELLED are closed.
ACTIVE_ALERT_STATUSES = ["PENDING", "ACKNOWLEDGED", "IN_PROGRESS"]

NOTIFICATION_LIMIT = 50


def normalize_phone(phone):
    """Normalize phone number to last 10 digits for robust comparison."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", str(phone))
    return digits[-10:] if len(digits) >= 10 else digits


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
    account to a resident. Matches against verified contacts by email or
    phone number. Returns an empty queryset when no credentials match.
    """
    if not user:
        return GuardianContact.objects.none()

    clean_email = (user.email or "").strip().lower()
    profile = get_user_profile(user)
    clean_phone = normalize_phone(getattr(profile, "phone_number", ""))

    if not clean_email and not clean_phone:
        return GuardianContact.objects.none()

    all_verified = list(
        GuardianContact.objects.filter(
            is_verified=True,
            resident__is_active=True,
        )
        .exclude(resident=user)
        .select_related("resident")
    )

    matching_ids = []
    for c in all_verified:
        contact_email = (c.email or "").strip().lower()
        contact_phone = normalize_phone(c.phone_number)
        is_match = False
        if clean_email and contact_email and clean_email == contact_email:
            is_match = True
        elif clean_phone and contact_phone and clean_phone == contact_phone:
            is_match = True

        if is_match:
            matching_ids.append(c.id)

    return (
        GuardianContact.objects.filter(id__in=matching_ids)
        .select_related("resident")
        .order_by("resident__username", "id")
    )


def get_guardians_for_resident(resident_user):
    """
    Return all active Guardian users linked to the resident via verified
    GuardianContact rows (matching by email or phone number).
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if not resident_user:
        return []

    verified_contacts = list(
        GuardianContact.objects.filter(
            resident=resident_user,
            is_verified=True,
        )
    )
    if not verified_contacts:
        return []

    candidate_guardians = list(
        User.objects.filter(
            is_active=True,
            profile__role__iexact="guardian",
        )
        .exclude(pk=resident_user.pk)
        .select_related("profile")
    )

    matching_guardians = set()
    for contact in verified_contacts:
        contact_email = (contact.email or "").strip().lower()
        contact_phone = normalize_phone(contact.phone_number)

        for guardian in candidate_guardians:
            guardian_email = (guardian.email or "").strip().lower()
            guardian_profile = getattr(guardian, "profile", None)
            guardian_phone = normalize_phone(
                getattr(guardian_profile, "phone_number", "")
            )

            if contact_email and guardian_email and contact_email == guardian_email:
                matching_guardians.add(guardian)
            elif contact_phone and guardian_phone and contact_phone == guardian_phone:
                matching_guardians.add(guardian)

    return list(matching_guardians)


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
