
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from society.models import Society


class EmergencyContact(models.Model):

    SERVICE_CHOICES = [
        ('POLICE', 'Police'),
        ('FIRE', 'Fire Department'),
        ('AMBULANCE', 'Ambulance'),
        ('HOSPITAL', 'Hospital'),
        ('OTHER', 'Other'),
    ]

    society = models.ForeignKey(
        Society,
        on_delete=models.CASCADE,
        related_name='emergency_contacts'
    )

    name = models.CharField(max_length=150)

    service_type = models.CharField(
        max_length=20,
        choices=SERVICE_CHOICES
    )

    phone_number = models.CharField(max_length=20)

    email = models.EmailField(blank=True)

    address = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.service_type}"


class GuardianContact(models.Model):

    GUARDIAN_TYPE_CHOICES = [
        ('PRIMARY', 'Primary Guardian'),
        ('SECONDARY', 'Secondary Guardian'),
    ]

    resident = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='guardian_contacts'
    )

    name = models.CharField(max_length=150)

    relationship = models.CharField(max_length=50)

    phone_number = models.CharField(max_length=20)

    email = models.EmailField(blank=True)

    guardian_type = models.CharField(
        max_length=10,
        choices=GUARDIAN_TYPE_CHOICES
    )

    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"{self.name} - {self.get_guardian_type_display()} "
            f"for {self.resident.username}"
        )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['resident', 'guardian_type'],
                name='unique_guardian_type_per_resident'
            )
        ]


class ContactVerificationOTP(models.Model):

    contact = models.ForeignKey(
        GuardianContact,
        on_delete=models.CASCADE,
        related_name='verification_otps',
    )

    code_hash = models.CharField(max_length=128)

    expires_at = models.DateTimeField()

    attempts = models.PositiveSmallIntegerField(default=0)

    is_used = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(
                fields=['contact', 'is_used', 'expires_at'],
                name='contact_otp_active_idx',
            ),
        ]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"Verification OTP for guardian contact #{self.contact_id}"
