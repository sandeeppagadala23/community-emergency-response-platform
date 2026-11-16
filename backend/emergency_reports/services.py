from django.contrib.auth import get_user_model
from django.db.models import Q

from emergency_alerts.models import SOSNotification


def report_creation_recipients(exclude_user_id):
    user_model = get_user_model()
    return (
        user_model.objects.filter(
            Q(is_staff=True)
            | Q(is_superuser=True)
            | Q(profile__role="security", profile__is_verified=True),
            is_active=True,
        )
        .exclude(pk=exclude_user_id)
        .distinct()
    )


def create_report_notifications(report, recipients, notification_type, title, message):
    created = 0
    for recipient in set(recipients):
        _, was_created = SOSNotification.objects.get_or_create(
            report=report,
            recipient=recipient,
            notification_type=notification_type,
            defaults={
                "channel": "IN_APP",
                "status": "PENDING",
                "title": title,
                "message": message,
            },
        )
        created += int(was_created)
    return created
