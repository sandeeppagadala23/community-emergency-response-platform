
from django.conf import settings
from django.db import models
from django.db.models import Q


class SOSAlert(models.Model):
    CATEGORY_CHOICES = [
        ("MEDICAL", "Medical"),
        ("FIRE", "Fire"),
        ("SECURITY", "Security"),
        ("ACCIDENT", "Accident"),
        ("OTHER", "Other"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("ACKNOWLEDGED", "Acknowledged"),
        ("IN_PROGRESS", "In Progress"),
        ("RESOLVED", "Resolved"),
        ("CANCELLED", "Cancelled"),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sos_alerts",
    )
    idempotency_key = models.UUIDField(null=True, blank=True)
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
    )
    message = models.TextField(blank=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
    )
    location_text = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
    )
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acknowledged_sos_alerts",
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_sos_alerts",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["reporter", "idempotency_key"],
                name="unique_sos_reporter_idempotency_key",
            )
        ]

    def __str__(self):
        return f"SOS #{self.pk} - {self.category} ({self.status})"


class SOSAlertEvent(models.Model):
    alert = models.ForeignKey(
        SOSAlert,
        on_delete=models.CASCADE,
        related_name="events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sos_alert_events",
    )
    event_type = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"SOS #{self.alert_id} - {self.event_type}"


class SOSNotification(models.Model):
    CHANNEL_CHOICES = [
        ("IN_APP", "In-App"),
        ("EMAIL", "Email"),
        ("SMS", "SMS"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("SENT", "Sent"),
        ("SIMULATED", "Simulated"),
        ("FAILED", "Failed"),
        ("READ", "Read"),
    ]

    alert = models.ForeignKey(
        SOSAlert,
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    report = models.ForeignKey(
        "emergency_reports.EmergencyReport",
        on_delete=models.CASCADE,
        related_name="notifications",
        null=True,
        blank=True,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sos_notifications",
        null=True,
        blank=True,
    )
    guardian_contact = models.ForeignKey(
        "emergency_contacts.GuardianContact",
        on_delete=models.SET_NULL,
        related_name="sos_notifications",
        null=True,
        blank=True,
    )
    destination = models.CharField(max_length=255, blank=True)
    channel = models.CharField(
        max_length=10,
        choices=CHANNEL_CHOICES,
        default="IN_APP",
    )
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="PENDING",
    )
    message = models.TextField(blank=True)
    title = models.CharField(max_length=200, blank=True)
    notification_type = models.CharField(max_length=40, default="SOS_ALERT")
    failure_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(alert__isnull=False, report__isnull=True)
                    | Q(alert__isnull=True, report__isnull=False)
                ),
                name="sosnotification_one_related_record",
            ),
            models.UniqueConstraint(
                fields=["report", "recipient", "notification_type"],
                condition=Q(report__isnull=False, recipient__isnull=False),
                name="unique_report_recipient_notification_type",
            ),
        ]
        indexes = [
            models.Index(
                fields=["recipient", "status", "created_at"],
                name="sosnotification_inbox_idx",
            ),
        ]

    def __str__(self):
        recipient = self.recipient_id or self.guardian_contact_id or "unknown"
        related = (
            f"SOS #{self.alert_id}"
            if self.alert_id
            else f"Report #{self.report_id}"
        )
        return f"Notification for {related} to {recipient}"


class EscalationPolicy(models.Model):
    name = models.CharField(max_length=100, default="Default SOS Policy")
    society = models.ForeignKey(
        "society.Society",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="sos_escalation_policies",
    )
    first_escalation_minutes = models.PositiveIntegerField(default=3)
    second_escalation_minutes = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ResponderAssignment(models.Model):
    alert = models.ForeignKey(
        SOSAlert,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sos_responder_assignments",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-assigned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["alert", "responder"],
                name="unique_sos_alert_responder",
            )
        ]

    def __str__(self):
        return f"SOS #{self.alert_id} assigned to {self.responder_id}"


class ResponderArrivalConfirmation(models.Model):
    RESULT_CONFIRMED = "CONFIRMED"
    RESULT_CHOICES = [(RESULT_CONFIRMED, "Confirmed")]

    assignment = models.OneToOneField(
        ResponderAssignment,
        on_delete=models.PROTECT,
        related_name="arrival_confirmation",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="confirmed_responder_arrivals",
    )
    confirmed_by_role = models.CharField(max_length=20)
    confirmation_result = models.CharField(
        max_length=20,
        choices=RESULT_CHOICES,
        default=RESULT_CONFIRMED,
    )
    confirmation_note = models.CharField(max_length=500, blank=True)
    confirmed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["confirmed_at"]

    def __str__(self):
        return (
            f"Arrival confirmation for assignment #{self.assignment_id} "
            f"by {self.confirmed_by_id}"
        )
