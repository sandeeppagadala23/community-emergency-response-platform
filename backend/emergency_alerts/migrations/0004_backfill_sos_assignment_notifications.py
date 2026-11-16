from django.db import migrations


def create_missing_assignment_notifications(apps, schema_editor):
    ResponderAssignment = apps.get_model("emergency_alerts", "ResponderAssignment")
    SOSNotification = apps.get_model("emergency_alerts", "SOSNotification")
    database = schema_editor.connection.alias

    assignments = (
        ResponderAssignment.objects.using(database)
        .select_related("alert", "responder")
        .filter(alert__status__in=["PENDING", "ACKNOWLEDGED", "IN_PROGRESS"])
        .filter(
            responder__is_active=True,
            responder__profile__role__in=["security", "volunteer"],
            responder__profile__is_verified=True,
        )
    )
    for assignment in assignments.iterator():
        alert = assignment.alert
        SOSNotification.objects.using(database).get_or_create(
            alert_id=assignment.alert_id,
            recipient_id=assignment.responder_id,
            channel="IN_APP",
            notification_type="SOS_ASSIGNED",
            defaults={
                "status": "PENDING",
                "title": "SOS incident assigned",
                "message": (
                    f"{alert.category} SOS alert #{alert.pk} has been assigned to you."
                ),
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ("emergency_alerts", "0003_sosnotification_notification_type_and_more"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            create_missing_assignment_notifications,
            migrations.RunPython.noop,
        ),
    ]
