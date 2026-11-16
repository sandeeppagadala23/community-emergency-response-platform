import logging
import smtplib

from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from emergency_contacts.models import GuardianContact
from users.models import UserProfile

from .models import ResponderAssignment, SOSAlert, SOSNotification


User = get_user_model()
logger = logging.getLogger(__name__)


def create_assignment_notification(assignment: ResponderAssignment) -> tuple[SOSNotification, bool]:
    alert = assignment.alert
    return SOSNotification.objects.get_or_create(
        alert=alert,
        recipient=assignment.responder,
        channel="IN_APP",
        notification_type="SOS_ASSIGNED",
        defaults={
            "status": "PENDING",
            "title": "SOS incident assigned",
            "message": (
                f"{alert.get_category_display()} SOS alert "
                f"#{alert.pk} has been assigned to you."
            ),
        },
    )


def notify_sos_recipients(alert: SOSAlert) -> int:
    """Create inbox alerts and console-only email/SMS simulations."""
    recipients = set()
    guardian_contacts = (
        GuardianContact.objects.filter(
            resident=alert.reporter,
            is_verified=True,
        )
        .exclude(email__isnull=True)
        .exclude(email__exact="")
    )

    all_guardians = list(
        User.objects.filter(
            is_active=True,
            profile__role__iexact="guardian",
        )
        .exclude(pk=alert.reporter_id)
        .select_related("profile")
    )

    for contact in guardian_contacts:
        contact_email = (contact.email or "").strip().lower()
        if not contact_email:
            continue
        for guardian_user in all_guardians:
            guardian_email = (guardian_user.email or "").strip().lower()
            if guardian_email == contact_email:
                recipients.add(guardian_user)

    security_profiles = list(
        UserProfile.objects.filter(
            role="security",
            is_verified=True,
            user__is_active=True,
        ).select_related("user")
    )
    recipients.update(
        profile.user
        for profile in security_profiles
        if profile.user_id != alert.reporter_id
    )

    staff_users = list(
        User.objects.filter(is_staff=True, is_active=True)
        .exclude(pk=alert.reporter_id)
    )
    recipients.update(staff_users)

    reporter_name = (
        alert.reporter.get_full_name().strip() or alert.reporter.username
    )
    location_desc = alert.location_text or ""
    loc_suffix = f" at {location_desc}" if location_desc else ""

    message = (
        f"New {alert.get_category_display()} SOS alert "
        f"#{alert.pk} requires attention."
    )

    # Prevent duplicate in-app notifications if request is repeated
    existing_in_app = set(
        SOSNotification.objects.filter(
            alert=alert,
            channel="IN_APP",
            recipient__isnull=False,
        ).values_list("recipient_id", flat=True)
    )

    notifications = []
    for recipient in recipients:
        if recipient.pk in existing_in_app:
            continue

        is_recipient_guardian = getattr(
            getattr(recipient, "profile", None), "role", ""
        ).lower() == "guardian"

        if is_recipient_guardian:
            msg = (
                f"EMERGENCY: {alert.get_category_display()} SOS triggered by "
                f"{reporter_name}{loc_suffix}."
            )
        else:
            msg = (
                f"New {alert.get_category_display()} SOS alert "
                f"#{alert.pk} requires attention."
            )

        notifications.append(
            SOSNotification(
                alert=alert,
                recipient=recipient,
                channel="IN_APP",
                status="PENDING",
                title=f"Emergency {alert.get_category_display()} SOS",
                notification_type="SOS_ALERT",
                message=msg,
            )
        )

    if notifications:
        SOSNotification.objects.bulk_create(notifications)

    external_notifications = []
    seen_destinations = set()

    # Pre-populate seen destinations with already created external notifications
    existing_external = set(
        SOSNotification.objects.filter(
            alert=alert,
            channel__in=["EMAIL", "SMS"],
        ).values_list("channel", "destination")
    )
    seen_destinations.update(existing_external)

    def add_simulated_destination(channel, destination, recipient=None, contact=None):
        destination = destination.strip()
        if not destination:
            return
        normalized = (
            "".join(character for character in destination if character.isdigit())
            if channel == "SMS"
            else destination.casefold()
        )
        key = (channel, normalized)
        if not normalized or key in seen_destinations:
            return
        seen_destinations.add(key)
        external_notifications.append(
            SOSNotification(
                alert=alert,
                recipient=recipient,
                guardian_contact=contact,
                destination=destination,
                channel=channel,
                status="SIMULATED",
                message=message,
            )
        )

    for contact in guardian_contacts:
        add_simulated_destination("EMAIL", contact.email, contact=contact)
        add_simulated_destination("SMS", contact.phone_number, contact=contact)

    for profile in security_profiles:
        if profile.user_id == alert.reporter_id:
            continue
        add_simulated_destination("EMAIL", profile.user.email, recipient=profile.user)
        add_simulated_destination(
            "SMS",
            profile.phone_number,
            recipient=profile.user,
        )

    for user in staff_users:
        add_simulated_destination("EMAIL", user.email, recipient=user)
        try:
            phone_number = user.profile.phone_number
        except UserProfile.DoesNotExist:
            phone_number = ""
        add_simulated_destination("SMS", phone_number, recipient=user)

    for notification in external_notifications:
        try:
            if notification.channel == "EMAIL":
                send_mail(
                    subject=f"Emergency {alert.get_category_display()} alert",
                    message=message,
                    from_email=None,
                    recipient_list=[notification.destination],
                    fail_silently=False,
                )
            else:
                logger.info(
                    "SIMULATED SMS to %s: %s",
                    notification.destination,
                    message,
                )
        except (OSError, smtplib.SMTPException) as error:
            notification.status = "FAILED"
            notification.failure_reason = str(error)
            logger.exception(
                "Could not write simulated %s notification for SOS #%s",
                notification.channel,
                alert.pk,
            )

    if external_notifications:
        SOSNotification.objects.bulk_create(external_notifications)

    return len(notifications)
