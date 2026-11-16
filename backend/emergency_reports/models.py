
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from society.models import Society


class EmergencyReport(models.Model):

    INCIDENT_CHOICES = [
        ('MEDICAL', 'Medical Emergency'),
        ('FIRE', 'Fire'),
        ('SECURITY', 'Security Issue'),
        ('ACCIDENT', 'Accident'),
        ('OTHER', 'Other'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Reported'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('ASSIGNED', 'Assigned'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    ]

    reporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='emergency_reports'
    )

    assigned_volunteer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_emergency_reports',
    )

    responded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_emergency_reports',
    )

    society = models.ForeignKey(
        Society,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='emergency_reports'
    )

    incident_type = models.CharField(
        max_length=20,
        choices=INCIDENT_CHOICES
    )

    title = models.CharField(max_length=200, blank=True)

    location = models.CharField(max_length=255)

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )

    description = models.TextField()

    response_notes = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title or self.get_incident_type_display()} - {self.status}"


class EmergencyReportEvent(models.Model):
    EVENT_CHOICES = [
        ('CREATED', 'Created'),
        ('STATUS_CHANGED', 'Status changed'),
        ('ASSIGNED', 'Assigned'),
        ('REASSIGNED', 'Reassigned'),
    ]

    report = models.ForeignKey(
        EmergencyReport,
        on_delete=models.CASCADE,
        related_name='events',
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='emergency_report_events',
    )
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'pk']

    def __str__(self):
        return f'Report #{self.report_id} - {self.get_event_type_display()}'
