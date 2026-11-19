
from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):

    ROLE_CHOICES = [
        ('resident', 'Resident'),
        ('guardian', 'Guardian'),
        ('volunteer', 'Volunteer'),
        ('security', 'Security Personnel'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES
    )

    phone_number = models.CharField(
        max_length=20,
        unique=True
    )

    employee_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Security or Staff Employee ID (e.g. SEC-001)"
    )

    shift = models.CharField(
        max_length=50,
        blank=True,
        default="Day Shift",
        help_text="Assigned duty shift (e.g. Day Shift, Night Shift)"
    )

    society = models.ForeignKey(
        'society.Society',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_profiles',
        help_text="Assigned society/community for staff and security personnel"
    )

    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"
